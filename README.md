# CasinWorks OPS

Multi-operation hub for **Service Desk**, **Project Manager**, and **Leads**. Each operation has the same pattern: dashboard (KPIs + pie + burn-up), list with inline edits, and a create form. Google Sheets are the source of truth when a sheet ID is configured.

```
/server   Express API, auth, Sheets + sample stores
/client   React + Vite UI
```

## Quick start

```bash
cd server && npm run dev
cd client && npm run dev
```

Open http://localhost:5173 — password from `APP_PASSWORD` (default `changeme`).

After login, pick an operation on the **CasinWorks OPS** home screen.

## Operations & sheet IDs

| Op | Env var | Status |
|----|---------|--------|
| Service Desk | `SHEET_ID_SERVICE_DESK` | **Live** — CasinWorks IT tickets |
| Project Manager | `SHEET_ID_PROJECT_MANAGER` | Ready — paste when Geoff shares |
| Leads | `SHEET_ID_LEADS` | Ready — paste when Geoff shares |

Until a PM/Leads sheet ID is set, those ops use local sample data so dashboards and CRUD already work.

When Geoff shares a link:

1. Copy the sheet ID from the URL  
2. Paste into `server/.env` (`SHEET_ID_PROJECT_MANAGER` or `SHEET_ID_LEADS`)  
3. Share the sheet with the service account as **Editor**  
4. Restart the API  

## Service Desk sheet columns

Tab **Tickets** (header row containing `Ticket ID`):

| Ticket ID | Opened | Client | Project | Title | Category | Priority | Status | Requester | Assignee (IT) | Coordinator | Summary |

Live sheet: [CasinWorks — IT Service Desk Tickets](https://docs.google.com/spreadsheets/d/1bxVxKX3X5oWD43V--GLSpXyyrKXikEjIMKwJPLmCT3M/edit)

## Google credentials

1. Enable **Google Sheets API** in Cloud Console  
2. Create a service account → download JSON key into `server/`  
3. Set `GOOGLE_SERVICE_ACCOUNT_FILE` in `.env`  
4. Share each ops sheet with the service account email as **Editor**

Sheet reads are cached ~5 seconds so bot/sheet edits show up quickly.

## API (Bearer token from `POST /api/login`)

| Method | Path |
|--------|------|
| GET | `/api/ops` |
| GET/POST/PATCH | `/api/ops/service-desk/tickets` (+ `/stats`) |
| GET/POST/PATCH | `/api/ops/project-manager/projects` (+ `/stats`) |
| GET/POST/PATCH | `/api/ops/leads/leads` (+ `/stats`) |

`googleapis` is only imported from `server/sheetsRepo.js`.

## Desktop app (.dmg)

Yes — you can install CasinWorks OPS like a normal Mac app.

### Build the DMG

Requires Node.js on the machine that **builds** the app (and on machines that **run** it, for now):

```bash
# from project root
npm install
npm run desktop:dmg
```

Output:

`dist-desktop/CasinWorks OPS-1.0.0-arm64.dmg`

### Install

1. Open the `.dmg`
2. Drag **CasinWorks OPS** into **Applications**
3. Launch from Finder → Applications  
   (first launch: right-click → Open if macOS blocks an unsigned app)

Login password is still `APP_PASSWORD` from `server/.env` (default `changeme`).

### Notes

- The app starts a local server and opens a native window
- Google Sheet credentials are bundled from `server/` at build time
- First Gatekeeper warning is normal for unsigned personal builds
- Rebuild the DMG after UI/API changes with `npm run desktop:dmg`
