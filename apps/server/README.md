# server

Node + TypeScript backend for lobby state, socket events, and authoritative match flow.

Current lobby support:

- `lobby:create`
- `lobby:join`
- `lobby:leave`
- `lobby:ready`
- `lobby:state` broadcast after each lobby mutation

Current match support:

- `match:start`
- in-memory match session creation
- `match:starting` broadcast with countdown
- automatic lobby transition to `in-match`
- match cleanup on leave/disconnect

Current bootstrap includes:

- HTTP server with `GET /health`
- Socket.IO server wiring
- connection and disconnect logging
- initial `session:joined` emission
- handler registration split from bootstrap
- local bind defaults to `127.0.0.1:3001`
