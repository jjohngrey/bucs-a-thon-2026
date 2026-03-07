# MVP Plan

## Product Goal

Deliver a playable browser game where friends can:

- create a lobby
- join by room code
- pick from a small roster of custom characters
- play a platform-fighter match online

## Scope for MVP

Include:

- 1 stage
- 2 playable characters, stretch to 4
- 2-player online match, stretch to 4-player
- movement, jump, fall
- one basic attack and one special per character
- damage percent
- knockback
- blast-zone KO
- stocks
- respawn
- lobby create/join/ready/start
- simple end screen

Exclude initially:

- items
- advanced ledge mechanics
- shields, grabs, throws
- ranked matchmaking
- persistent progression
- voice chat

## Milestones

### Milestone 1: Offline Combat Prototype

- player movement
- stage collision
- attack hit detection
- damage and knockback
- stock loss and respawn

Success condition: two characters can fight on one machine.

### Milestone 2: Content Pipeline

- character data format
- stage data format
- portraits and basic animations
- character select screen

Success condition: swapping a character mostly means editing data and assets, not rewriting logic.

### Milestone 3: Lobby Service

- server bootstrapped
- create/join by room code
- room roster state
- ready system
- match start flow

Success condition: multiple clients can gather in the same room reliably.

### Milestone 4: Online Match

- input messages
- server-authoritative simulation
- snapshot broadcast
- client reconciliation
- disconnect handling

Success condition: two remote players can complete a match.

### Milestone 5: Expand and Polish

- add more characters
- tune combat feel
- improve effects and sound
- extend to 4 players if stable

Success condition: the game feels like a coherent prototype instead of a tech demo.

## Team Split

### Gameplay Engineer

- movement
- attacks
- collision
- knockback
- stocks and respawn

### Network/Backend Engineer

- socket server
- lobby lifecycle
- room state
- authoritative match flow

### Client/UX Engineer

- menus
- lobby UI
- character select
- HUD
- scene transitions

### Content/Design Engineer

- character concepts
- sprites/portraits
- attack definitions
- balance tuning
- stage setup

## First Build Order

1. Set up monorepo and shared package.
2. Create Phaser scene with one test stage and two boxes as fighters.
3. Implement movement and one attack.
4. Add damage, knockback, and stocks.
5. Build socket server with room codes.
6. Connect client to lobby flow.
7. Send player inputs to server.
8. Add authoritative snapshots and reconcile client state.
9. Add character select and custom content.
10. Tune responsiveness and fix desync issues.

## Non-Negotiable Constraints

- Keep the roster data-driven.
- Keep the protocol typed in the shared package.
- Do not overbuild persistence.
- Do not expand feature scope until the online match loop works.
