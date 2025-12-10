# Demo frontend (React/Vite)

One-page portal-like view that auto-loads an Ethora chat for a specific case and persona (Admin/Practitioner/Patient) using the demo backend.

## Prereqs
- Node.js 18+
- Demo backend running (default: http://localhost:4000). See `../demo-backend.ts`.
- Ethora app env vars already set for the backend (`ETHORA_CHAT_API_URL`, `ETHORA_CHAT_APP_ID`, `ETHORA_CHAT_APP_SECRET`).

## Install
```bash
cd examples/healthcare-insurance/demo-frontend
npm install
```

## Run
```bash
# optional: point to backend (defaults to http://localhost:4000)
echo "VITE_BACKEND_URL=http://localhost:4000" > .env.local

npm run dev
# open the printed URL (default http://localhost:5173)
```

## What it does
- Hardcodes a sample case `case-123` and personas:
  - Admin (`admin-1`)
  - Practitioner (`practitioner-1`)
  - Patient (`patient-1`)
- On load or persona change:
  - Calls the demo backend to ensure the case + participants exist (`POST /cases`)
  - Fetches JID (`GET /cases/:caseId/chat/jid`)
  - Fetches user token (`GET /chat/token/:userId`)
- Renders `@ethora/chat-component` pre-authenticated for that room/user.

## Files
- `src/App.tsx` — portal UI + data fetching + Chat component.
- `src/main.tsx` — app bootstrap.
- `vite.config.ts`, `tsconfig*.json` — standard Vite/React/TS setup.

## Notes
- Keep the demo backend running while using this frontend.
- Adjust `CASE_ID` or personas in `src/App.tsx` as needed.

