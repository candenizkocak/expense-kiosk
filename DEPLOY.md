# Deployment Guide — Step by Step

## ✅ Step 1: Supabase Schema — DONE
Tables created: `managers`, `employees`, `expenses`

---

## Step 2: Modal OCR Service

### 2a. Install Modal CLI
```bash
pip install modal
modal setup    # Opens browser to authenticate
```

### 2b. Create your Gemini secret
```bash
modal secret create gemini-secret GEMINI_API_KEY=your-gemini-api-key-here
```

### 2c. Test with Gemini only (no GPU, instant)
```bash
cd modal-ocr
modal run modal_ocr.py
```
This sends a blank test image to verify the pipeline works.

### 2d. Deploy
```bash
modal deploy modal_ocr.py
```

Modal will print two endpoint URLs:
```
✓ Created web endpoint ocr => https://YOUR_WORKSPACE--expense-kiosk-ocr-ocr.modal.run
✓ Created web endpoint ocr_gemini => https://YOUR_WORKSPACE--expense-kiosk-ocr-ocr-gemini.modal.run
```

**Save the `ocr` URL** — you'll need it for the web app's `.env.local`.

### 2e. Test with a real receipt
```bash
# Encode a receipt image to base64 and test
python3 -c "
import base64, json, urllib.request

with open('test_receipt.jpg', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode()

req = urllib.request.Request(
    'https://YOUR_WORKSPACE--expense-kiosk-ocr-ocr-gemini.modal.run',
    data=json.dumps({'image_base64': b64}).encode(),
    headers={'Content-Type': 'application/json'},
)
resp = urllib.request.urlopen(req)
print(json.dumps(json.loads(resp.read()), indent=2, ensure_ascii=False))
"
```

### Which endpoint to use?
| Endpoint | GPU | Cost | Speed | Use when |
|----------|-----|------|-------|----------|
| `/ocr` | A10G | ~$0.10/min when active | ~5-15s | Production (tries Qwen first, Gemini fallback) |
| `/ocr-gemini` | None | ~$0.01/receipt | ~2-3s | Testing, or if you want to skip GPU costs |

**Tip**: Start with `/ocr-gemini` to validate everything works, then switch to `/ocr` once you want to use the open-source model.

---

## Step 3: Web App (Next.js → Vercel)

### 3a. Install dependencies
```bash
cd web
npm install
```

### 3b. Create `.env.local`
```bash
cp .env.local.example .env.local
```

Fill in:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
MODAL_OCR_URL=https://YOUR_WORKSPACE--expense-kiosk-ocr-ocr-gemini.modal.run
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3c. Create Storage bucket
In Supabase dashboard:
1. Go to **Storage** → **New bucket**
2. Name: `receipts`
3. Public: **OFF** (private)

### 3d. Create test users
In Supabase dashboard → **Authentication** → **Users** → **Add user**:

1. Create `alice@company.com` with a password → note the UUID
2. Create `bob@company.com` with a password → note the UUID

Then in **SQL Editor**:
```sql
-- Insert manager (use Alice's auth UUID)
INSERT INTO managers (auth_user_id, rfid_uid, name, email) VALUES
  ('paste-alice-auth-uuid-here', 'RFID_MGR_001', 'Alice Manager', 'alice@company.com');

-- Insert employee linked to Alice (use Bob's auth UUID)
INSERT INTO employees (auth_user_id, rfid_uid, name, email, manager_id) VALUES
  ('paste-bob-auth-uuid-here', 'RFID_EMP_001', 'Bob Employee', 'bob@company.com',
    (SELECT id FROM managers WHERE email = 'alice@company.com'));
```

### 3e. Run locally
```bash
npm run dev
```

Open http://localhost:3000 and test:
- Log in as Bob → see empty "My expenses" dashboard
- Log in as Alice → see "Approve expenses" page
- Visit http://localhost:3000/kiosk → test the kiosk flow

### 3f. Deploy to Vercel
```bash
npx vercel
```

Set environment variables in Vercel dashboard (same as `.env.local` but with production values):
- `NEXT_PUBLIC_APP_URL` = `https://expenses.candenizkocak.com`
- Update `MODAL_OCR_URL` to the production endpoint if different

### 3g. Connect your domain
In Vercel dashboard → **Settings** → **Domains** → add `expenses.candenizkocak.com`
Then update DNS at your registrar to point to Vercel.

---

## Step 4: Raspberry Pi (later)

This is the hardware step — do it last once the web app is working.
See README.md for full Pi setup instructions.

For now, you can test the full flow using the kiosk page at `/kiosk` 
in your browser — it has a "Simulate RFID scan" button for development.
