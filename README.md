# SheShield — Full-stack Hackathon Prototype

A mobile-friendly online safety assistant with a Node.js backend and local JSON persistence. No external packages are required.

## Requirements
- Node.js 18 or newer
- Modern browser (Chrome, Firefox, Edge, Safari)

## Run locally
1. Extract the ZIP file.
2. Open a terminal in the `SheShield_FullStack` folder.
3. Run `npm start`.
4. Open `http://localhost:3000`.

## Features
- Responsive dashboard with message screening, incident records, evidence integrity, and reporting guidance.
- Explainable rule-based message screening via `POST /api/screen`.
- Incident CRUD basics: create, list, and delete through API endpoints.
- Downloadable incident reports and complaint drafts.
- Browser-side SHA-256 hashing with comparison against a recorded hash.
- Basic security headers, request-size limit, input length limits, no third-party analytics or external runtime dependencies.

## API
- `GET /api/health` — status
- `POST /api/screen` — `{ "message": "...", "incidentType": "..." }`
- `GET /api/incidents` — list saved records
- `POST /api/incidents` — create a record
- `DELETE /api/incidents/:id` — delete one record

## Storage and privacy
Incident records are stored in `data/incidents.json` on the machine running the server. This is a hackathon-grade local persistence layer, not an encrypted production database. Do not put real sensitive data into a public demo. The prototype has no authentication, authorization, encryption-at-rest, audit trail, backup, or multi-user isolation. Anyone with access to the running server and its data file may be able to access saved records. The evidence file is hashed in the browser and is not uploaded by the hash feature, but incident form data is sent to the local backend for saving.

## Important limitations
- Screening is simple phrase matching, not a trained AI model, and can be wrong.
- The complaint draft is not submitted automatically and is not legal advice.
- SHA-256 detects differences relative to a recorded hash; it does not prove authenticity, authorship, completeness, or admissibility.
- Verify current reporting guidance before public release.
- For public deployment, add authentication, per-user access controls, encrypted storage, CSRF protections where applicable, rate limiting, stronger validation, backups, privacy review, accessibility tests, and professional security review.
- Do not present this prototype as an emergency service.
```
