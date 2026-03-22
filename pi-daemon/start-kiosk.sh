#!/bin/bash
# ============================================================
# Expense Kiosk — Chromium Kiosk Mode Launcher
# ============================================================
# Run this script on the Raspberry Pi desktop session startup.
# Add to: ~/.config/lxsession/LXDE-pi/autostart
#   @/home/pi/expense-kiosk/pi-daemon/start-kiosk.sh
# ============================================================

KIOSK_URL="${KIOSK_URL:-https://expenses.candenizkocak.com/kiosk}"

# Disable screen blanking / screensaver
xset s off
xset -dpms
xset s noblank

# Hide the mouse cursor after 3 seconds of inactivity
unclutter -idle 3 -root &

# Wait for the daemon to be ready
echo "Waiting for kiosk daemon..."
for i in $(seq 1 30); do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "Daemon is ready"
        break
    fi
    sleep 1
done

# Launch Chromium in kiosk mode
chromium-browser \
    --kiosk \
    --noerrdialogs \
    --disable-translate \
    --no-first-run \
    --fast \
    --fast-start \
    --disable-infobars \
    --disable-suggestions-service \
    --disable-save-password-bubble \
    --disable-session-crashed-bubble \
    --disable-features=TranslateUI \
    --overscroll-history-navigation=0 \
    --disable-pinch \
    --autoplay-policy=no-user-gesture-required \
    "$KIOSK_URL"
