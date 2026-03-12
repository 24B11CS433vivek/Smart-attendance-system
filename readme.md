# AttendX — Free Mobile Barcode/QR Attendance System

## System Architecture

```
4 Phones (any browser)
      │
      ▼
GitHub Pages (index.html + style.css + script.js)
      │  POST /exec  (JSON body)
      ▼
Google Apps Script Web App  ←→  Google Sheets
   (duplicate check,               (Attendance tab)
    timestamp, store)
```

---

## Google Sheet Structure

Sheet name: **Attendance**

| ID | StudentCode | Room   | Timestamp | Date       |
|----|-------------|--------|-----------|------------|
| 1  | CS2301      | Room 1 | 09:15:42  | 2025-08-12 |
| 2  | CS2302      | Room 2 | 09:16:01  | 2025-08-12 |
| 3  | CS2301      | Room 1 | 09:17:00  | 2025-08-12 | ← blocked as duplicate

---

## STEP 1 — Create Google Sheet

1. Go to https://sheets.google.com → New blank spreadsheet
2. Rename it: **AttendX Attendance**
3. Copy the Sheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/ **THIS_PART** /edit`
4. Keep this tab open

---

## STEP 2 — Create Apps Script API

1. In your Google Sheet, click **Extensions → Apps Script**
2. Delete all default code in the editor
3. Open `apps-script.gs` from this project folder
4. Paste the entire contents into the Apps Script editor
5. On line 7, paste your Sheet ID:
   ```js
   const SHEET_ID = "YOUR_SHEET_ID_HERE";
   ```
6. Click 💾 Save (Ctrl+S)

---

## STEP 3 — Deploy Apps Script as Web App

1. Click **Deploy → New deployment**
2. Click the ⚙ gear icon next to "Select type" → choose **Web app**
3. Set these options:
   - Description: `AttendX API v1`
   - Execute as: **Me**
   - Who has access: **Anyone** ← IMPORTANT
4. Click **Deploy**
5. Click **Authorize access** → Choose your Google account → Allow
6. Copy the **Web app URL** (looks like `https://script.google.com/macros/s/AKfy.../exec`)
7. Save this URL — you'll paste it into the phone app

> **Every time you edit the script**, you must deploy a NEW version:
> Deploy → Manage deployments → Edit → New version → Deploy

---

## STEP 4 — Host Frontend on GitHub Pages

### Option A: GitHub Web UI (no coding needed)

1. Go to https://github.com → Sign in (create account if needed)
2. Click **+** → **New repository**
3. Name: `attendance-system` → Set to **Public** → Create
4. Click **Add file → Upload files**
5. Upload all three files: `index.html`, `style.css`, `script.js`
6. Click **Commit changes**
7. Go to **Settings → Pages**
8. Under "Source" → select **Deploy from a branch**
9. Branch: **main** / folder: **/ (root)** → Save
10. Wait ~2 minutes → your site is live at:
    `https://YOUR_USERNAME.github.io/attendance-system`

### Option B: Git CLI
```bash
git init
git add .
git commit -m "AttendX v1"
git remote add origin https://github.com/USERNAME/attendance-system.git
git push -u origin main
```

---

## STEP 5 — First-Time Setup on Each Phone

1. Open Chrome/Safari on phone
2. Go to: `https://YOUR_USERNAME.github.io/attendance-system`
3. First visit → a **Setup API** popup appears
4. Paste your Google Apps Script URL → **Save & Continue**
5. Select the correct Room (Room 1 / 2 / 3 / 4)
6. Tap **START SCANNING** → Allow camera permission
7. Point camera at any barcode or QR code

> The API URL is saved in the phone's local storage — only needs to be entered once.

---

## STEP 6 — Testing

### Quick test (no QR code needed):
1. Open browser DevTools console on desktop
2. Run:
```js
fetch('YOUR_APPS_SCRIPT_URL', {
  method: 'POST',
  headers: {'Content-Type': 'text/plain'},
  body: JSON.stringify({ code: 'CS2301', room: 'Room 1' })
}).then(r => r.json()).then(console.log)
```
Expected output: `{status: "success", message: "CS2301 marked present", ...}`

Run again → Expected: `{status: "duplicate", ...}`

### Test QR codes:
Generate QR codes at https://www.qr-code-generator.com
Use student roll numbers as the text content.

---

## Duplicate Protection (Two Layers)

### Layer 1 — Frontend (instant, offline)
- Every scanned code is saved in `localStorage` keyed by today's date
- If same code is scanned again → shows warning immediately, no API call made
- Resets automatically each day

### Layer 2 — Backend (Google Apps Script)
- Before writing, scans entire sheet for matching `StudentCode + Date`
- If found → returns `{status: "duplicate"}`
- Handles edge case: two phones scanning same student simultaneously

---

## Performance — Handling 400 Students Fast

### Scanner settings used:
- `fps: 15` — fast detection
- `experimentalFeatures: useBarCodeDetectorIfSupported` — uses native browser API where available (Chrome Android = fastest)

### Tips for fast scanning sessions:
- Use **1D barcodes** (Code 128/Code 39) not QR codes — faster to scan
- Print barcodes on **ID cards** (no need to unlock phone)
- Ensure good lighting in each room
- Keep phone steady ~15–20 cm from barcode
- Chrome on Android is the fastest scanner browser

### Throughput estimate:
- ~2–4 seconds per scan (including hand movement + scan + API response)
- 4 rooms × 100 students = 400 scans in ~15–20 minutes

### Offline mode:
- If internet drops mid-session, scans are queued locally
- Queue auto-retries every 30 seconds when internet returns
- Queue indicator shown in the UI

---

## File Structure

```
attendance-system/
├── index.html       ← Scanner UI + Dashboard (single page)
├── style.css        ← All styles (dark theme, animations)
├── script.js        ← Scanner logic, API calls, offline queue
└── apps-script.gs   ← Paste into Google Apps Script (not uploaded to GitHub)
```

---

## Dashboard

Tap the **⊞** grid icon in the top-right corner to see:
- Total present today
- Progress bar (out of 400)
- Per-room breakdown with mini bar charts
- Last 20 scans table

Pull latest data with the **↻** refresh button.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Camera Error" | Allow camera permission in browser settings |
| API not responding | Re-deploy Apps Script as new version; check "Anyone" access |
| Duplicate not detected | Make sure Sheet ID is correct in apps-script.gs |
| Scans not appearing in sheet | Check Apps Script execution logs (Apps Script → Executions) |
| Offline queue not sending | Check internet; tap refresh icon; check API URL is correct |
| QR not scanning | Improve lighting; try barcode instead of QR; clean camera lens |

---

## Security Notes

- The Apps Script URL is semi-private (long random string) — safe enough for internal use
- For extra security: add a secret token check in the Apps Script `doPost()` function
- Student data stays in YOUR Google Sheet — no third-party storage

---

## Cost Breakdown

| Service | Cost |
|---------|------|
| Google Sheets | Free (up to 10M cells) |
| Google Apps Script | Free (6 min/execution, 20k calls/day) |
| GitHub Pages | Free (public repos) |
| Html5-QRCode | Free (MIT license) |
| **Total** | **₹0 / $0** |