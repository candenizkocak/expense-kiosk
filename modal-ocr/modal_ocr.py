"""
Expense Kiosk — Receipt OCR Service (Modal.com)

Primary:  Qwen2.5-VL-7B-Instruct on A10G GPU
Fallback: Google Gemini 3 Flash Preview (if Qwen fails or for quick testing)

Deploy:
    modal deploy modal_ocr.py

Test locally:
    modal run modal_ocr.py::test_ocr

Endpoint:
    POST https://<your-modal-app>.modal.run/ocr
    Body: { "image_base64": "<base64 jpeg>" }
    Returns: {
      "merchant", "date", "net_price", "tax_rate", "tax_amount",
      "total_price", "currency", "line_items", "raw_text",
      "confidence", "model_used"
    }

Setup:
    # Create Gemini secret (for fallback)
    modal secret create gemini-secret GEMINI_API_KEY=your-key-here

    # Optional: Groq secret (alternative fallback)
    modal secret create groq-secret GROQ_API_KEY=your-key-here
"""

import modal
import json
import re
import base64

# ---------------------------------------------------------------------------
# Modal app + image
# ---------------------------------------------------------------------------

app = modal.App("expense-kiosk-ocr")

qwen_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi[standard]",
        "transformers>=4.45.0",
        "torch>=2.1.0",
        "accelerate>=0.25.0",
        "torchvision>=0.16.0",
        "qwen-vl-utils",
        "Pillow",
        "google-genai>=1.0.0",
    )
)

# Lighter image for the web endpoint (no torch needed)
endpoint_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi[standard]",
        "google-genai>=1.0.0",
        "Pillow",
    )
)

EXTRACTION_PROMPT = """You are a receipt OCR system. Extract the following fields from this receipt image.
Return ONLY valid JSON with these exact keys:

{
  "merchant": "Store/restaurant name",
  "date": "YYYY-MM-DD format or null if unreadable",
  "line_items": [
    {"description": "item name", "quantity": 1, "unit_price": 10.00, "total": 10.00}
  ],
  "net_price": 0.00,
  "tax_rate": 0.00,
  "tax_amount": 0.00,
  "total_price": 0.00,
  "currency": "TRY",
  "raw_text": "full text transcription of the receipt"
}

Rules:
- net_price = subtotal before tax
- tax_rate = decimal (e.g. 0.20 for 20%, 0.08 for 8%). Calculate from tax_amount / net_price if not explicitly shown.
- tax_amount = total tax
- total_price = net_price + tax_amount
- If a field is unreadable, set it to null
- currency: detect from symbols (₺=TRY, $=USD, €=EUR, £=GBP) or default TRY
- Return ONLY the JSON object, no markdown fences, no explanation
"""


# ---------------------------------------------------------------------------
# Qwen2.5-VL model class (GPU)
# ---------------------------------------------------------------------------

@app.cls(
    image=qwen_image,
    gpu="A10G",
    timeout=120,
    container_idle_timeout=300,
)
class QwenOCR:
    @modal.enter()
    def load_model(self):
        import torch
        from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor

        model_name = "Qwen/Qwen2.5-VL-7B-Instruct"

        self.processor = AutoProcessor.from_pretrained(model_name)
        self.model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
            model_name,
            torch_dtype=torch.float16,
            device_map="auto",
        )
        self.model.eval()
        print(f"✓ Loaded {model_name}")

    @modal.method()
    def extract(self, image_base64: str) -> dict:
        import torch

        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "image": f"data:image/jpeg;base64,{image_base64}",
                    },
                    {"type": "text", "text": EXTRACTION_PROMPT},
                ],
            }
        ]

        text = self.processor.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        from qwen_vl_utils import process_vision_info

        image_inputs, video_inputs = process_vision_info(messages)
        inputs = self.processor(
            text=[text],
            images=image_inputs,
            videos=video_inputs,
            padding=True,
            return_tensors="pt",
        ).to(self.model.device)

        with torch.no_grad():
            output_ids = self.model.generate(**inputs, max_new_tokens=2048)

        generated = output_ids[0][inputs.input_ids.shape[1] :]
        response_text = self.processor.decode(generated, skip_special_tokens=True)
        return _parse_ocr_response(response_text, model_used="qwen2.5-vl-7b")


# ---------------------------------------------------------------------------
# Gemini fallback (no GPU needed)
# ---------------------------------------------------------------------------

def _run_gemini(image_base64: str) -> dict:
    """Fallback: call Gemini 3 Flash Preview via the google-genai SDK."""
    import os
    from google import genai

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")

    client = genai.Client(api_key=api_key)

    # Decode base64 to bytes for inline_data
    image_bytes = base64.b64decode(image_base64)

    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=[
            {
                "role": "user",
                "parts": [
                    {"inline_data": {"mime_type": "image/jpeg", "data": image_base64}},
                    {"text": EXTRACTION_PROMPT},
                ],
            }
        ],
    )

    return _parse_ocr_response(response.text, model_used="gemini-3-flash-preview")


# ---------------------------------------------------------------------------
# Web endpoint
# ---------------------------------------------------------------------------

@app.function(
    image=endpoint_image,
    timeout=120,
    secrets=[modal.Secret.from_name("gemini-secret")],
)
@modal.web_endpoint(method="POST")
def ocr(body: dict) -> dict:
    """
    POST /ocr
    Body: { "image_base64": "<base64 jpeg string>" }

    Tries Qwen first (GPU), falls back to Gemini if it fails.
    """
    image_base64 = body.get("image_base64")
    if not image_base64:
        return {"error": "Missing image_base64 field"}

    # Try Qwen (GPU model)
    try:
        qwen = QwenOCR()
        result = qwen.extract.remote(image_base64)
        return result
    except Exception as e:
        print(f"⚠ Qwen failed: {e}, falling back to Gemini...")

    # Fallback: Gemini
    try:
        result = _run_gemini(image_base64)
        return result
    except Exception as e2:
        return {
            "error": f"Both models failed. Qwen: {e}, Gemini: {e2}",
            "confidence": 0,
            "model_used": "none",
        }


# ---------------------------------------------------------------------------
# Gemini-only endpoint (lighter, cheaper, for testing)
# ---------------------------------------------------------------------------

@app.function(
    image=endpoint_image,
    timeout=60,
    secrets=[modal.Secret.from_name("gemini-secret")],
)
@modal.web_endpoint(method="POST")
def ocr_gemini(body: dict) -> dict:
    """
    POST /ocr-gemini
    Body: { "image_base64": "<base64 jpeg string>" }

    Uses only Gemini — no GPU needed. Good for testing.
    """
    image_base64 = body.get("image_base64")
    if not image_base64:
        return {"error": "Missing image_base64 field"}

    try:
        return _run_gemini(image_base64)
    except Exception as e:
        return {"error": str(e), "confidence": 0, "model_used": "none"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_ocr_response(text: str, model_used: str) -> dict:
    """Parse the model's text output into structured JSON."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group())
            except json.JSONDecodeError:
                data = {"raw_text": text, "error": "Could not parse JSON"}
        else:
            data = {"raw_text": text, "error": "No JSON found in response"}

    # Ensure all expected fields
    defaults = {
        "merchant": None,
        "date": None,
        "line_items": [],
        "net_price": None,
        "tax_rate": None,
        "tax_amount": None,
        "total_price": None,
        "currency": "TRY",
        "raw_text": None,
    }
    for key, default in defaults.items():
        data.setdefault(key, default)

    # Auto-calculate missing fields
    try:
        net = float(data["net_price"]) if data["net_price"] is not None else None
        total = float(data["total_price"]) if data["total_price"] is not None else None
        tax_amt = float(data["tax_amount"]) if data["tax_amount"] is not None else None
        tax_rate = float(data["tax_rate"]) if data["tax_rate"] is not None else None

        if net and total and not tax_amt:
            data["tax_amount"] = round(total - net, 2)
            tax_amt = data["tax_amount"]
        if net and tax_amt and not tax_rate:
            if net > 0:
                data["tax_rate"] = round(tax_amt / net, 4)
        if net and tax_amt and not total:
            data["total_price"] = round(net + tax_amt, 2)
        if total and tax_amt and not net:
            data["net_price"] = round(total - tax_amt, 2)
    except (TypeError, ValueError):
        pass

    data["model_used"] = model_used
    data["confidence"] = 0.9 if "error" not in data else 0.3
    return data


# ---------------------------------------------------------------------------
# Local test
# ---------------------------------------------------------------------------

@app.local_entrypoint()
def test_ocr():
    """Quick test — sends a blank image to verify the pipeline works."""
    import io
    from PIL import Image

    img = Image.new("RGB", (400, 200), "white")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    b64 = base64.b64encode(buf.getvalue()).decode()

    print("Testing Gemini endpoint...")
    result = ocr_gemini.remote({"image_base64": b64})
    print(json.dumps(result, indent=2, ensure_ascii=False))
