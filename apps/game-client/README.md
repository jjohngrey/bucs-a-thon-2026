# game-client

Phaser browser client for menus, lobby flow, HUD, and match rendering.

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

## Audio

- Drop `.m4a` files into `public/audio/sfx` and `public/audio/voice-memos`.
- Click `Enable Audio` in the app before testing sounds.
- Expected optional filenames are documented in `public/audio/README.md`.
