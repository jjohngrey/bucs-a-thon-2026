# shared

Shared TypeScript package for protocol definitions, constants, and content schemas.

## Current contents

- socket event names
- client/server payload types
- lobby/match/player domain types
- core gameplay and network constants

## Main source folders

- `src/protocol`: event names and payload types
- `src/types`: lobby, player, and match types
- `src/constants`: gameplay and networking defaults

## Purpose

This package is the contract between `apps/server` and `apps/game-client`.

Import from `@bucs/shared` instead of redefining:

- event names
- payloads
- snapshot types
- shared gameplay constants

## Build

```bash
tsc -p packages/shared/tsconfig.json
```
