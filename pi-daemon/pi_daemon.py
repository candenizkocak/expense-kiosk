"""
Expense Kiosk — Raspberry Pi Hardware Daemon

A lightweight FastAPI server that bridges hardware peripherals
(RFID reader + USB camera) to the web application.

Runs on the Pi at http://localhost:8000

Endpoints:
  GET  /scan-rfid   → Waits for an RFID card scan, returns { uid, timestamp }
  GET  /capture      → Takes a photo with the USB camera, returns { image_base64, timestamp }
  GET  /health       → Health check

Install:
  pip install fastapi uvicorn opencv-python-headless evdev Pillow

Run:
  python pi_daemon.py

For development on a machine without RFID/camera hardware,
set MOCK_HARDWARE=1 to use simulated responses.
"""

import asyncio
import base64
import io
import os
import time
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

MOCK_HARDWARE = os.environ.get("MOCK_HARDWARE", "0") == "1"

# ─── Hardware: RFID ───

if not MOCK_HARDWARE:
    try:
        import evdev
        RFID_AVAILABLE = True
    except ImportError:
        RFID_AVAILABLE = False
        print("⚠ evdev not available — RFID will use mock mode")
else:
    RFID_AVAILABLE = False


def find_rfid_device() -> "evdev.InputDevice | None":
    """Find the USB RFID reader among input devices."""
    if not RFID_AVAILABLE:
        return None
    devices = [evdev.InputDevice(path) for path in evdev.list_devices()]
    for device in devices:
        # Most USB RFID readers identify as HID keyboard devices.
        # Adjust this filter based on your specific reader's name.
        name_lower = device.name.lower()
        if any(kw in name_lower for kw in ["rfid", "hid", "card reader", "rf"]):
            print(f"✓ Found RFID device: {device.name} at {device.path}")
            return device
    # If no specific match, try the last input device (common for USB HID readers)
    if devices:
        print(f"⚠ Using fallback device: {devices[-1].name}")
        return devices[-1]
    return None


async def read_rfid_uid(timeout: float = 30.0) -> str:
    """
    Wait for an RFID card scan and return the UID string.

    USB HID RFID readers typically emit keystrokes representing the UID
    followed by Enter. We accumulate characters until Enter is pressed.
    """
    if not RFID_AVAILABLE or MOCK_HARDWARE:
        # Simulated scan for development
        await asyncio.sleep(1.0)
        return "MOCK_RFID_001"

    device = find_rfid_device()
    if not device:
        raise RuntimeError("No RFID reader found")

    # Key code to character mapping (for numeric UIDs)
    KEY_MAP = {
        2: "1", 3: "2", 4: "3", 5: "4", 6: "5",
        7: "6", 8: "7", 9: "8", 10: "9", 11: "0",
        30: "A", 48: "B", 46: "C", 32: "D", 18: "E", 33: "F",
    }

    uid_chars = []
    start = time.time()

    async for event in device.async_read_loop():
        if time.time() - start > timeout:
            raise TimeoutError("RFID scan timed out")

        if event.type == evdev.ecodes.EV_KEY:
            key_event = evdev.categorize(event)
            if key_event.keystate == 1:  # Key down
                code = key_event.scancode
                if code == 28:  # Enter key — end of UID
                    if uid_chars:
                        return "".join(uid_chars)
                elif code in KEY_MAP:
                    uid_chars.append(KEY_MAP[code])

    raise RuntimeError("RFID read loop ended unexpectedly")


# ─── Hardware: Camera ───

if not MOCK_HARDWARE:
    try:
        import cv2
        CAMERA_AVAILABLE = True
    except ImportError:
        CAMERA_AVAILABLE = False
        print("⚠ OpenCV not available — camera will use mock mode")
else:
    CAMERA_AVAILABLE = False


def capture_image(quality: int = 85) -> str:
    """
    Capture a single frame from the USB camera.
    Returns base64-encoded JPEG string.
    """
    if not CAMERA_AVAILABLE or MOCK_HARDWARE:
        # Generate a placeholder image for development
        from PIL import Image, ImageDraw, ImageFont

        img = Image.new("RGB", (640, 480), "#f8f8f8")
        draw = ImageDraw.Draw(img)
        draw.rectangle([20, 20, 620, 460], outline="#ccc", width=2)
        draw.text((200, 200), "MOCK RECEIPT", fill="#999")
        draw.text((180, 240), f"Captured: {datetime.now().strftime('%H:%M:%S')}", fill="#999")

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality)
        return base64.b64encode(buf.getvalue()).decode()

    # Real camera capture
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError("Cannot open camera")

    try:
        # Set resolution (adjust based on your camera)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)

        # Warm up the camera (auto-exposure needs a few frames)
        for _ in range(5):
            cap.read()

        ret, frame = cap.read()
        if not ret:
            raise RuntimeError("Failed to capture frame")

        # Encode as JPEG
        encode_params = [cv2.IMWRITE_JPEG_QUALITY, quality]
        _, buffer = cv2.imencode(".jpg", frame, encode_params)
        return base64.b64encode(buffer.tobytes()).decode()
    finally:
        cap.release()


# ─── FastAPI App ───

@asynccontextmanager
async def lifespan(app: FastAPI):
    mode = "MOCK" if MOCK_HARDWARE else "HARDWARE"
    print(f"🚀 Kiosk daemon starting in {mode} mode")
    print(f"   RFID:   {'mock' if not RFID_AVAILABLE else 'ready'}")
    print(f"   Camera: {'mock' if not CAMERA_AVAILABLE else 'ready'}")
    yield
    print("Kiosk daemon shutting down")


app = FastAPI(title="Expense Kiosk Daemon", lifespan=lifespan)

# Allow requests from the kiosk's Chromium browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "mock_mode": MOCK_HARDWARE,
        "rfid_available": RFID_AVAILABLE,
        "camera_available": CAMERA_AVAILABLE,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/scan-rfid")
async def scan_rfid():
    """Wait for an RFID card scan and return the UID."""
    try:
        uid = await read_rfid_uid(timeout=30.0)
        return {
            "uid": uid,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except TimeoutError:
        return JSONResponse(
            status_code=408,
            content={"error": "RFID scan timed out. Please try again."},
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"RFID read failed: {str(e)}"},
        )


@app.get("/capture")
async def capture():
    """Take a photo of the receipt on the tray."""
    try:
        image_base64 = capture_image(quality=85)
        return {
            "image_base64": image_base64,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Camera capture failed: {str(e)}"},
        )


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("DAEMON_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
