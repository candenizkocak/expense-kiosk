import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

export const maxDuration = 60;

/**
 * POST /api/ocr
 * Body: { image_base64: "<base64 jpeg>" }
 *
 * Reads the `ocr_model` setting from system_settings to decide
 * which Modal endpoint to call:
 *   - "qwen"  → MODAL_OCR_URL_QWEN  (Qwen + Gemini fallback)
 *   - "gemini" → MODAL_OCR_URL_GEMINI (Gemini only, faster)
 */
export async function POST(request: NextRequest) {
  try {
    const { image_base64 } = await request.json();

    if (!image_base64) {
      return NextResponse.json(
        { error: "Missing image_base64" },
        { status: 400 }
      );
    }

    // Read the admin-selected model from DB
    const supabase = createAdminSupabase();
    const { data: setting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "ocr_model")
      .single();

    const selectedModel = setting?.value || "gemini";

    // Pick the right Modal endpoint
    const modalUrl =
      selectedModel === "qwen"
        ? process.env.MODAL_OCR_URL_QWEN
        : process.env.MODAL_OCR_URL_GEMINI;

    if (!modalUrl) {
      return NextResponse.json(
        { error: `OCR endpoint not configured for model: ${selectedModel}` },
        { status: 500 }
      );
    }

    const ocrResponse = await fetch(modalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_base64 }),
    });

    if (!ocrResponse.ok) {
      const errText = await ocrResponse.text();
      console.error("Modal OCR error:", ocrResponse.status, errText);
      return NextResponse.json(
        { error: "OCR service returned an error", details: errText },
        { status: 502 }
      );
    }

    const ocrResult = await ocrResponse.json();
    return NextResponse.json(ocrResult);
  } catch (err) {
    console.error("OCR proxy error:", err);
    return NextResponse.json(
      { error: "Failed to process receipt" },
      { status: 500 }
    );
  }
}
