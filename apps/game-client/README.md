# game-client

Phaser browser client scaffold.

The backend is currently more complete than the client. Use the docs in `../../docs/` and the shared package in `../../packages/shared/` when wiring UI and networking.

## Stack

- TypeScript
- Vite
- Phaser 3

## Run

From `apps/game-client`:

1. `npm install`
2. `npm run dev`

Vite will print the local URL (usually `http://localhost:5173`).

### Backend URL

- Copy `.env.example` to `.env`.
- Set `VITE_SERVER_URL` to the backend address you want to use.
- Example: `VITE_SERVER_URL=http://10.43.80.207:3001`
- If unset, the client falls back to `http(s)://<current-host>:3001`.

## Build

- `npm run build`
- `npm run preview`

## Audio

- Drop `.m4a` files into `public/audio/sfx` and `public/audio/voice-memos`.
- Click `Enable Audio` in the app before testing sounds.
- Expected optional filenames are documented in `public/audio/README.md`.
