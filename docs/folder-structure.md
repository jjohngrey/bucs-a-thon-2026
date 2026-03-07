# Exact Folder Structure

This is the exact repo layout to build against for the first implementation phase.

```text
bucs-a-thon-2026/
  README.md
  docs/
    README.md
    architecture.md
    stack.md
    netcode.md
    mvp.md
    folder-structure.md
    execution-plan.md
  apps/
    game-client/
      README.md
      package.json
      tsconfig.json
      vite.config.ts
      index.html
      public/
      src/
        main.ts
        boot/
          game.ts
          config.ts
        scenes/
          BootScene.ts
          MenuScene.ts
          LobbyScene.ts
          CharacterSelectScene.ts
          MatchScene.ts
          ResultsScene.ts
        core/
          engine/
            FixedTicker.ts
            InputBuffer.ts
          math/
            Vec2.ts
            Collision.ts
          state/
            Entity.ts
            PlayerState.ts
            MatchState.ts
        game/
          combat/
            DamageSystem.ts
            KnockbackSystem.ts
            HitboxSystem.ts
          movement/
            MoveSystem.ts
            JumpSystem.ts
            GravitySystem.ts
          rules/
            StockSystem.ts
            RespawnSystem.ts
            WinConditionSystem.ts
        network/
          client.ts
          events.ts
          reconciliation.ts
          snapshotBuffer.ts
        content/
          characters/
            alex.json
            sam.json
          stages/
            rooftop.json
        ui/
          components/
            Button.ts
            Panel.ts
            PlayerCard.ts
          hud/
            DamageMeter.ts
            StockCounter.ts
            MatchTimer.ts
        assets/
          sprites/
          portraits/
          stages/
          audio/
    server/
      README.md
      package.json
      tsconfig.json
      src/
        index.ts
        config/
          env.ts
        http/
          app.ts
          routes.ts
        sockets/
          io.ts
          registerHandlers.ts
        lobby/
          LobbyService.ts
          LobbyStore.ts
          RoomCode.ts
        match/
          MatchService.ts
          MatchLoop.ts
          InputQueue.ts
          SnapshotBuilder.ts
        simulation/
          systems/
            DamageSystem.ts
            KnockbackSystem.ts
            HitboxSystem.ts
            MovementSystem.ts
            StockSystem.ts
          state/
            MatchState.ts
            PlayerState.ts
        validation/
          lobbySchemas.ts
          matchSchemas.ts
      test/
        lobby.test.ts
        match.test.ts
  packages/
    shared/
      README.md
      package.json
      tsconfig.json
      src/
        index.ts
        protocol/
          clientToServer.ts
          serverToClient.ts
          eventNames.ts
        content/
          characterSchema.ts
          stageSchema.ts
        constants/
          gameplay.ts
          network.ts
        types/
          Player.ts
          Lobby.ts
          Match.ts
```

## Ownership Rules

- `apps/game-client/src/game` is gameplay logic on the client side.
- `apps/server/src/simulation` is authoritative gameplay logic on the server side.
- `packages/shared/src/protocol` is the only source of truth for socket event names and payloads.
- `apps/game-client/src/content` contains temporary game data during prototyping.
- Once content grows, move stable schemas to `packages/shared/src/content`.

## Why This Structure

- It gives each team member a clean surface area.
- It prevents UI, netcode, and combat rules from mixing together.
- It keeps server authority explicit instead of hiding match logic in the client.
- It allows you to unit test shared and server logic without booting Phaser.

## Initial Empty Directories To Create First

If you want the minimum starting scaffold, create these first:

- `apps/game-client/src/scenes`
- `apps/game-client/src/game`
- `apps/game-client/src/network`
- `apps/server/src/lobby`
- `apps/server/src/match`
- `apps/server/src/simulation`
- `packages/shared/src/protocol`
- `packages/shared/src/constants`
- `packages/shared/src/types`
