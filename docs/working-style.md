# Working Style

This repo should be run in a way that keeps agents fast and keeps context clean.

These rules are adapted for this codebase from Peter Steinberger's "Shipping at Inference-Speed" workflow:

- https://steipete.me/posts/2025/shipping-at-inference-speed

## What we should do here

### 1. Keep docs small and current

Only keep docs that describe real current behavior.

For this repo, that means `docs/` should stay limited to:

- architecture
- client/server flow
- netcode
- UI/backend integration
- this working-style doc

If a doc describes a future system that does not exist yet, either delete it or rewrite it as current reality.

### 2. Treat `packages/shared` as the contract

Do not invent event names or payload shapes in the client or server.

If the protocol changes:

1. update `packages/shared`
2. update server/client code
3. update the matching docs
4. add or update a smoke test

### 3. Ship thin vertical slices

Prefer:

- one new socket event or lifecycle change
- one server behavior
- one smoke test
- one doc update

Avoid large speculative rewrites unless they are clearly necessary.

### 4. Build from loops the agent can verify

A change is better when it can be validated locally.

For this repo, the preferred loop is:

1. build shared and server
2. run the relevant smoke test
3. confirm docs still match behavior

Useful commands:

```bash
corepack pnpm check
corepack pnpm smoke:lobby
corepack pnpm smoke:match-start
corepack pnpm smoke:combat
corepack pnpm smoke:match-end
corepack pnpm smoke:return-lobby
```

### 5. Prefer the current working path over long planning

The backend is already ahead of the client.

So the next work should usually be:

- make the current protocol work end-to-end in the UI
- add one missing gameplay rule on the server
- cover it with a smoke test

Not:

- writing large planning docs
- designing systems that are not implemented
- expanding scope before the current loop is solid

### 6. Keep prompts and requests concrete

Good tasks in this repo look like:

- "add stocks decrement when a player is KO'd and cover it with a smoke test"
- "wire `lobby:state` into the lobby screen"
- "document the current `match:snapshot` shape for frontend use"

Bad tasks are broad and underspecified:

- "build the whole game"
- "design the architecture"
- "make multiplayer better"

### 7. Optimize the repo for agent navigation

That means:

- obvious filenames
- current docs in `docs/`
- shared protocol in one place
- tests named after the behavior they prove

If a structure makes humans happy but causes protocol drift or agent confusion, prefer the simpler structure.

### 8. Do not keep duplicate truth

The source of truth should be:

- protocol: `packages/shared`
- server behavior: `apps/server/src`
- operational docs: `docs/`

If those drift, fix the docs or the code immediately.

## Practical rule for future work

For most backend changes, the expected output should be:

1. code change
2. smoke test update or new smoke test
3. docs update

That is the default workflow to follow in this repo.
