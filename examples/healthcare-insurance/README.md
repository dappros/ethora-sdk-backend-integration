# Healthcare / Insurance integration walkthrough

This example shows how to integrate Ethora chat into an existing healthcare/insurance backend where Admins/Practitioners use a portal and Patients use a mobile/web app. It covers backend wiring, token issuance, chat room provisioning, and frontend embedding pointers.

## Scenario mapping

- Domain: case/claim/encounter ID → `workspaceId` used for chat room name.
- Users: Admin, Practitioner, Patient → `userId` matches your backend’s user identifier.
- Room name (JID): `<appId>_<workspaceId>@conference.xmpp.ethoradev.com` from `createChatName(workspaceId, true)`.
- Auth: server-side JWTs signed with `ETHORA_CHAT_APP_SECRET` via `createChatUserJwtToken(userId)`.

## Prerequisites

- Node.js 18+
- Ethora app credentials set as env vars:
  - `ETHORA_CHAT_API_URL` (e.g., `https://api.ethoradev.com`)
  - `ETHORA_CHAT_APP_ID`
  - `ETHORA_CHAT_APP_SECRET`
- Ethora backend SDK (if you install it from npm instead of using this monorepo):
  ```bash
  npm install @ethora/sdk-backend
  ```
- Optional convenience: copy and edit `env.local.sample` (auto-loaded by backend if present):
  ```bash
  cp env.local.sample .env.local
  # edit .env.local with your real Ethora app id/secret (do not commit secrets)
  ```
- Install example deps for the demo backend (Express + CORS + dotenv + runner):
  ```bash
  npm install express cors dotenv ts-node @types/express @types/cors
  ```

## Files in this example

- `demo-backend.ts`: Minimal Express API that provisions chat rooms per case, creates users, grants access, issues client tokens, and exposes helper endpoints.

## How the backend flow works

1. Case created (or “Enable chat” clicked) – `POST /cases`
   - Backend receives `{ caseId, participants, metadata? }`.
   - For each participant (Admin/Practitioner/Patient) it calls `createUser(...)` (idempotent, with retries and random fallback data if needed).
   - It then creates the chat room via `createChatRoom(caseId, { title: "Case <id>", uuid: caseId, type: "group" })` (idempotent).
   - Finally, it grants access for each participant via `grantUserAccessToChatRoom(caseId, xmppUsername)` using the `xmppUsername` returned by Ethora.
   - The endpoint responds with `{ caseId, roomJid, participants }`, where `roomJid` comes from `createChatName(caseId, true)`.
2. Client token issuance – `GET /chat/token/:userId`
   - Looks up the user in local memory and uses the stored `xmppUsername` when available.
   - Returns a client JWT by calling `createChatUserJwtToken(xmppUsernameOrUserId)` for embedding in the portal or mobile app.
3. Frontend embed – `GET /cases/:caseId/chat/jid`
   - Returns the full JID for the case via `createChatName(caseId, true)` so the frontend can join the correct room.
   - Web portal: use `@ethora/chat-component` or the web snippet (see https://github.com/dappros/ethora-sdk-web-snippet). Pass `roomJID` and the client token.
   - Mobile: use the React Native component with the same token/JID.
4. Cleanup (optional) – `DELETE /cases/:caseId/chat` and `DELETE /users`
   - On case closure, `deleteChatRoom(caseId)` cleans up the room (returns a reason if not found).
   - `deleteUsers([...])` can be used to bulk-delete users, depending on your retention policy.

## Running the demo backend

From the repo root:

```bash
# Ensure env vars are set (replace with your Ethora app creds)
export ETHORA_CHAT_API_URL=https://api.ethoradev.com
export ETHORA_CHAT_APP_ID=your_app_id
export ETHORA_CHAT_APP_SECRET=your_app_secret

# Install deps once (adds express + ts-node locally)
npm install express @types/express ts-node

# Run the demo server
npx ts-node examples/healthcare-insurance/demo-backend.ts
# Server listens on http://localhost:4000
```

## Running backend and frontend together (quick start)

From repo root, in two shells:

```bash
# Shell 1: backend (auto-loads examples/healthcare-insurance/.env if present)
npx ts-node examples/healthcare-insurance/demo-backend.ts

# Shell 2: frontend
cd examples/healthcare-insurance/demo-frontend
npm install
# Copy sample if needed (frontend reads .env.local automatically):
# cp ../env.local.sample .env
# Then edit .env to point to backend URL.
npm run dev  # open printed URL (default http://localhost:5173)
```

## API sketch (demo-backend.ts)

- `POST /cases`  
  Body: `{ caseId, participants: [{ userId, role, displayName? }], metadata? }`  
  Creates room, creates users if needed, grants access, returns JID.
- `POST /cases/:caseId/users`  
  Body: `{ userId, role, displayName? }`  
  Adds a participant, creates user if needed, grants access.
- `GET /chat/token/:userId`  
  Returns a client JWT for embedding in the chat component/snippet.
- `GET /cases/:caseId/chat/jid`  
  Returns full JID for the case.
- `DELETE /cases/:caseId/chat`  
  Deletes the chat room (returns reason if not found).
- `DELETE /users`  
  Body: `{ userIds: string[] }` bulk deletes users.

## Minimal portal embedding hint

In your portal tab/component, fetch the client token for the logged-in user and render the chat component/snippet:

```tsx
<Chat
  roomJID={roomJidFromApi}
  user={{ token: clientTokenFromBackend }}
  config={{
    xmppSettings: {
      devServer: "wss://xmpp.ethoradev.com:5443/ws",
      host: "xmpp.ethoradev.com",
      conference: "conference.xmpp.ethoradev.com",
    },
    baseUrl: "https://api.ethoradev.com/v1",
    newArch: true,
    refreshTokens: { enabled: true },
  }}
/>
```

Adjust props based on `@ethora/chat-component` documentation and your environment.

## Migration/bulk import tips

- Iterate over existing users: call `createUser` for each, then grant access to relevant cases with `grantUserAccessToChatRoom`.
- For existing cases: call `createChatRoom` once per case before granting user access.
- Add retries/backoff around API calls and log failures for manual review.

# Step-by-step with screenshots

- Download or clone this whole repository into a new folder locally or on your dev server.

You should be in the root folder where you will see this including "src" and "examples" folders:

<img width="1396" height="78" alt="CleanShot 2025-12-10 at 13 40 08@2x" src="https://github.com/user-attachments/assets/fda3fed2-8411-47b8-8994-04e706750dc5" />

- Go to ethora.com, create your app and copy your App (project) credentials from API tab:

<img width="2920" height="2252" alt="CleanShot 2025-12-10 at 13 28 50@2x" src="https://github.com/user-attachments/assets/cce12f60-3d30-4e2b-a830-ca4846e01642" />

- Download / clone backend and frontend example files:

<img width="844" height="216" alt="CleanShot 2025-12-10 at 13 27 13@2x" src="https://github.com/user-attachments/assets/7febd193-3f33-4392-b0bf-365cd56571c2" />

- NPM install in root folder:

<img width="1374" height="318" alt="CleanShot 2025-12-10 at 13 43 07@2x" src="https://github.com/user-attachments/assets/7aed103d-8a53-4a40-bf8c-306c63b8014c" />

- Launch backend app:

> npx ts-node examples/healthcare-insurance/demo-backend.ts

<img width="2246" height="244" alt="CleanShot 2025-12-10 at 14 09 28@2x" src="https://github.com/user-attachments/assets/c0c83418-6955-45e5-b4a8-e6e447c355f3" />

- Open another terminal tab, go to frontend sample folder and do npm install there:

> cd examples/healthcare-insurance/demo-frontend
> npm install

<img width="2750" height="494" alt="CleanShot 2025-12-10 at 14 19 51@2x" src="https://github.com/user-attachments/assets/d7c3af4c-3342-48e7-a70b-45172d07b09a" />

- Do "npm run dev" in the frontend app folder

> npm run dev

You should see Vite running:

<img width="720" height="282" alt="CleanShot 2025-12-10 at 14 21 04@2x" src="https://github.com/user-attachments/assets/05448b9b-6729-4393-bfdc-56ffe4ef5983" />
