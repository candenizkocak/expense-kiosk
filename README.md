# Expense Kiosk

A receipt-scanning kiosk system with OCR, manager approval workflows, and employee expense tracking.

## Architecture

```
┌─────────────────────────────────┐
│  Raspberry Pi (Kiosk)           │
│  RFID reader + Camera + Screen  │
│  Python daemon @ localhost:8000 │
│  Chromium in kiosk mode         │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐     ┌──────────────────────┐
│  Vercel (Next.js)               │────▶│  Modal.com (OCR)     │
│  expenses.candenizkocak.com     │     │  Qwen2.5-VL-7B      │
│  - /kiosk     (kiosk UI)       │     │  Fallback: GPT-4o-m  │
│  - /dashboard (employee view)   │     └──────────────────────┘
│  - /dashboard/manage (manager)  │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  Supabase                       │
│  - PostgreSQL (managers,        │
│    employees, expenses tables)  │
│  - Storage (receipt images)     │
│  - Auth (email/password)        │
│  - RLS (row-level security)     │
└─────────────────────────────────┘
```

## Setup

### 1. Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the migration in the SQL Editor:
   - Open `supabase/migrations/002_clean_schema.sql`
   - Paste and execute in the Supabase SQL Editor
3. Create a Storage bucket named `receipts` (set to private)
4. Enable the Storage policies (uncomment and run section 7 from the migration)
5. Note your **Project URL**, **anon key**, and **service_role key**

### 2. Modal OCR

```bash
cd modal-ocr
pip install modal
modal setup          # One-time auth
modal deploy modal_ocr.py
```

Note the deployed endpoint URL (e.g., `https://your-workspace--expense-kiosk-ocr-ocr.modal.run`).

To add OpenAI fallback:
```bash
modal secret create openai-secret OPENAI_API_KEY=sk-...
```

### 3. Web App (Vercel)

```bash
cd web
npm install
```

Create `.env.local` from the example:
```bash
cp .env.local.example .env.local
# Fill in your Supabase + Modal values
```

Local development:
```bash
npm run dev
```

Deploy to Vercel:
```bash
npx vercel
# Set environment variables in Vercel dashboard
# Point expenses.candenizkocak.com to Vercel
```

### 4. Raspberry Pi

**Hardware needed:**
- Raspberry Pi 4 (4GB+)
- Official 7" or 10" touchscreen
- USB webcam (mounted above a flat receipt tray)
- USB RFID reader (HID-type that emits keystrokes)
- LED strip for tray lighting (optional but recommended)

**Software setup:**
```bash
# On the Pi
cd /home/pi
git clone <this-repo> expense-kiosk
cd expense-kiosk/pi-daemon

# Create venv and install
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Test in mock mode first
MOCK_HARDWARE=1 python pi_daemon.py

# Install systemd service
sudo cp kiosk-daemon.service /etc/systemd/system/
sudo systemctl enable kiosk-daemon
sudo systemctl start kiosk-daemon

# Make kiosk launcher executable
chmod +x start-kiosk.sh

# Add to autostart
echo "@/home/pi/expense-kiosk/pi-daemon/start-kiosk.sh" >> \
  ~/.config/lxsession/LXDE-pi/autostart

# Install unclutter for cursor hiding
sudo apt install unclutter
```

### 5. Seed Test Data

In Supabase SQL Editor:
```sql
-- Create auth users first via Supabase Auth dashboard, then:
INSERT INTO managers (auth_user_id, rfid_uid, name, email) VALUES
  ('<alice-auth-uuid>', 'RFID_MGR_001', 'Alice Manager', 'alice@company.com');

INSERT INTO employees (auth_user_id, rfid_uid, name, email, manager_id) VALUES
  ('<bob-auth-uuid>', 'RFID_EMP_001', 'Bob Employee', 'bob@company.com',
    (SELECT id FROM managers WHERE email = 'alice@company.com'));
```

## User Flows

### Employee (Kiosk)
1. Scan RFID card → authenticated
2. Place receipt on tray → tap "Capture"
3. OCR extracts merchant, amounts, tax → review and edit
4. Tap "Send for approval" → expense saved as pending
5. Drop physical receipt into collection slot

### Manager (Web)
1. Log in at expenses.candenizkocak.com
2. See pending expenses from direct reports
3. Expand to see receipt image + extracted details
4. Approve or reject (with reason)
5. Approved → payment date auto-set to end of month

### Employee (Web)
1. Log in at expenses.candenizkocak.com
2. See list of all submitted expenses
3. Status: pending / approved / rejected
4. If approved: see planned payment date

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel | Supabase service role key (server only) |
| `MODAL_OCR_URL` | Vercel | Modal OCR endpoint URL |
| `NEXT_PUBLIC_APP_URL` | Vercel | `https://expenses.candenizkocak.com` |
| `MOCK_HARDWARE` | Pi | Set to `1` for development without hardware |
| `DAEMON_PORT` | Pi | Default: `8000` |

## Project Structure

```
expense-kiosk/
├── supabase/
│   └── migrations/
│       └── 002_clean_schema.sql      # DB schema (managers, employees, expenses)
├── modal-ocr/
│   ├── modal_ocr.py                  # OCR service (Qwen VL + OpenAI fallback)
│   └── requirements.txt
├── web/                              # Next.js app
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # Login page
│   │   │   ├── kiosk/page.tsx        # Kiosk UI (RFID → capture → review → submit)
│   │   │   ├── dashboard/
│   │   │   │   ├── layout.tsx        # Dashboard shell + nav
│   │   │   │   ├── page.tsx          # Employee: my expenses
│   │   │   │   └── manage/page.tsx   # Manager: approve/reject
│   │   │   └── api/
│   │   │       ├── auth/rfid/route.ts
│   │   │       ├── auth/signout/route.ts
│   │   │       ├── ocr/route.ts
│   │   │       └── expenses/route.ts
│   │   ├── lib/
│   │   │   ├── types.ts
│   │   │   ├── resolve-user.ts       # Resolves auth user → manager or employee
│   │   │   └── supabase/
│   │   │       ├── client.ts
│   │   │       └── server.ts
│   │   └── middleware.ts
│   └── package.json
└── pi-daemon/
    ├── pi_daemon.py                  # FastAPI hardware bridge
    ├── requirements.txt
    ├── kiosk-daemon.service          # systemd unit
    └── start-kiosk.sh               # Chromium kiosk launcher
```
