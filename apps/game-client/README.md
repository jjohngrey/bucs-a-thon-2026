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

## Build

- `npm run build`
- `npm run preview`

## Next integration work

- connect to the Socket.IO backend
- render lobby flow from `lobby:state`
- handle `match:starting`, `match:snapshot`, and `match:ended`
- send `match:input` during active matches
