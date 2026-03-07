import "./style.css";
import { MATCH_STATE_EXAMPLE } from "./game/states/MatchState.example";
import { StagePlatform } from "./game/states/MatchState";
import { GravitySystem } from "./game/movement/GravitySystem";
import { JumpSystem } from "./game/movement/JumpSystem";
import { MoveSystem } from "./game/movement/MoveSystem";
import { AttackSystem } from "./game/combat/AttackSystem";
import { HitboxSystem } from "./game/combat/HitboxSystem";
import { DamageSystem } from "./game/combat/DamageSystem";
import { KnockbackSystem } from "./game/combat/KnockbackSystem";
import { StockSystem } from "./game/rules/StockSystem";
import { RespawnSystem } from "./game/rules/RespawnSystem";
import { WinConditionSystem } from "./game/rules/WinConditionSystem";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root element.");
}

const keyDown = new Set<string>();
const previousKeyDown = new Set<string>();
const playerElementsById: Record<string, HTMLDivElement> = {};
const lifeBoxElementsByPlayerId: Record<string, HTMLDivElement> = {};
let hitboxLayerElement: HTMLDivElement | null = null;
let respawnPlatformLayerElement: HTMLDivElement | null = null;
let winnerBannerElement: HTMLDivElement | null = null;
let lastTimestamp = performance.now();
const moveSystem = new MoveSystem({ moveSpeedPerSecond: 360 });
const jumpSystem = new JumpSystem({ jumpVelocity: 820 });
const gravitySystem = new GravitySystem({
  gravityPerSecond: 2200,
  maxFallSpeed: 1400
});
const attackSystem = new AttackSystem();
const hitboxSystem = new HitboxSystem();
const damageSystem = new DamageSystem();
const knockbackSystem = new KnockbackSystem();
const stockSystem = new StockSystem();
const respawnSystem = new RespawnSystem();
const winConditionSystem = new WinConditionSystem();

app.innerHTML = `
  <main class="app-shell">
    <h1>BUCS Fighter - Flat Stage</h1>
    <p>P1: A / D / W / F, P2: Left / Right / Up / Slash</p>
    <section class="stage-card">
      <div class="stage-viewport">
        <div class="blast-zone">
          ${renderPlatforms()}
          <div class="respawn-platform-layer" data-respawn-platform-layer="true"></div>
          <div class="hitbox-layer" data-hitbox-layer="true"></div>
          ${renderPlayers()}
        </div>
      </div>
      <section class="life-hud">
        ${renderLifeBoxes()}
      </section>
      <div class="winner-banner" data-winner-banner="true"></div>
    </section>
  </main>
`;

for (const playerId of MATCH_STATE_EXAMPLE.playerOrder) {
  const element = document.querySelector<HTMLDivElement>(`[data-player-id="${playerId}"]`);
  const lifeElement = document.querySelector<HTMLDivElement>(`[data-life-player-id="${playerId}"]`);
  if (element) {
    playerElementsById[playerId] = element;
  }
  if (lifeElement) {
    lifeBoxElementsByPlayerId[playerId] = lifeElement;
  }
}
hitboxLayerElement = document.querySelector<HTMLDivElement>('[data-hitbox-layer="true"]');
respawnPlatformLayerElement = document.querySelector<HTMLDivElement>(
  '[data-respawn-platform-layer="true"]'
);
winnerBannerElement = document.querySelector<HTMLDivElement>('[data-winner-banner="true"]');

window.addEventListener("keydown", (event) => {
  keyDown.add(event.code);
});

window.addEventListener("keyup", (event) => {
  keyDown.delete(event.code);
});

requestAnimationFrame(tick);

function renderPlatforms(): string {
  return MATCH_STATE_EXAMPLE.stage.platforms.map((platform) => {
    const { leftPct, topPct, widthPct, heightPct } = platformToPct(platform);
    return `<div class="platform" style="left:${leftPct}%;top:${topPct}%;width:${widthPct}%;height:${heightPct}%"></div>`;
  }).join("");
}

function renderPlayers(): string {
  return MATCH_STATE_EXAMPLE.playerOrder.map((playerId) => {
    const player = MATCH_STATE_EXAMPLE.playersById[playerId];
    if (!player) {
      return "";
    }

    const xPct = toXPct(player.position.x);
    const yPct = toYPct(player.position.y);
    const colorClass = playerId === "p1" ? "player-token--p1" : "player-token--p2";
    const facingClass = getFacingClass(player.facing);
    return `
      <div class="player-token ${colorClass} ${facingClass}" data-player-id="${playerId}" style="left:${xPct}%;top:${yPct}%;width:${player.renderSize.x}px;height:${player.renderSize.y}px">
        <span class="player-token__facing">${player.facing === 1 ? ">" : "<"}</span>
        <span>${playerId.toUpperCase()}</span>
      </div>
    `;
  }).join("");
}

function renderLifeBoxes(): string {
  return MATCH_STATE_EXAMPLE.playerOrder.map((playerId) => {
    const player = MATCH_STATE_EXAMPLE.playersById[playerId];
    if (!player) {
      return "";
    }

    const colorClass = playerId === "p1" ? "life-box--p1" : "life-box--p2";
    return `
      <div class="life-box ${colorClass}" data-life-player-id="${playerId}">
        <div class="life-box__name">${playerId.toUpperCase()}</div>
        <div class="life-box__damage">${Math.floor(player.damage)}%</div>
        <div class="life-box__stocks">Stocks: ${player.stocks}</div>
      </div>
    `;
  }).join("");
}

function platformToPct(platform: StagePlatform): {
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
} {
  const worldWidth = MATCH_STATE_EXAMPLE.stage.blastZoneMax.x - MATCH_STATE_EXAMPLE.stage.blastZoneMin.x;
  const worldHeight = MATCH_STATE_EXAMPLE.stage.blastZoneMax.y - MATCH_STATE_EXAMPLE.stage.blastZoneMin.y;

  return {
    leftPct: ((platform.position.x - MATCH_STATE_EXAMPLE.stage.blastZoneMin.x) / worldWidth) * 100,
    topPct: ((platform.position.y - MATCH_STATE_EXAMPLE.stage.blastZoneMin.y) / worldHeight) * 100,
    widthPct: (platform.size.x / worldWidth) * 100,
    heightPct: (platform.size.y / worldHeight) * 100
  };
}

function toXPct(x: number): number {
  const worldWidth = MATCH_STATE_EXAMPLE.stage.blastZoneMax.x - MATCH_STATE_EXAMPLE.stage.blastZoneMin.x;
  return ((x - MATCH_STATE_EXAMPLE.stage.blastZoneMin.x) / worldWidth) * 100;
}

function toYPct(y: number): number {
  const worldHeight = MATCH_STATE_EXAMPLE.stage.blastZoneMax.y - MATCH_STATE_EXAMPLE.stage.blastZoneMin.y;
  return ((y - MATCH_STATE_EXAMPLE.stage.blastZoneMin.y) / worldHeight) * 100;
}

function tick(timestamp: number): void {
  const deltaMs = Math.min(32, timestamp - lastTimestamp);
  lastTimestamp = timestamp;

  const moveDirectionByPlayerId = {
    p1: getMoveDirection("KeyA", "KeyD"),
    p2: getMoveDirection("ArrowLeft", "ArrowRight")
  } as const;
  const jumpPressedByPlayerId = {
    p1: isPressedThisFrame("KeyW"),
    p2: isPressedThisFrame("ArrowUp")
  };
  const attackPressedByPlayerId = {
    p1: keyDown.has("KeyF"),
    p2: keyDown.has("Slash")
  };

  moveSystem.update({
    deltaMs,
    matchState: MATCH_STATE_EXAMPLE,
    moveDirectionByPlayerId
  });
  jumpSystem.update({
    deltaMs,
    matchState: MATCH_STATE_EXAMPLE,
    jumpPressedByPlayerId
  });
  gravitySystem.update({
    deltaMs,
    matchState: MATCH_STATE_EXAMPLE
  });
  attackSystem.update({
    deltaMs,
    matchState: MATCH_STATE_EXAMPLE,
    attackPressedByPlayerId
  });
  hitboxSystem.update({
    deltaMs,
    matchState: MATCH_STATE_EXAMPLE
  });
  const activeHitboxes = hitboxSystem.getActiveHitboxes();
  const damageHitEvents = damageSystem.update({
    deltaMs,
    matchState: MATCH_STATE_EXAMPLE,
    activeHitboxes
  });
  knockbackSystem.update({
    deltaMs,
    matchState: MATCH_STATE_EXAMPLE,
    damageHitEvents
  });
  stockSystem.update({
    deltaMs,
    matchState: MATCH_STATE_EXAMPLE
  });
  respawnSystem.update({
    deltaMs,
    matchState: MATCH_STATE_EXAMPLE
  });
  winConditionSystem.update({
    deltaMs,
    matchState: MATCH_STATE_EXAMPLE
  });

  syncPlayerVisuals();
  syncRespawnPlatformsVisuals();
  syncHitboxVisuals();
  syncLifeHud();

  previousKeyDown.clear();
  for (const code of keyDown) {
    previousKeyDown.add(code);
  }

  requestAnimationFrame(tick);
}

function getMoveDirection(leftKey: string, rightKey: string): -1 | 0 | 1 {
  const leftPressed = keyDown.has(leftKey);
  const rightPressed = keyDown.has(rightKey);
  if (leftPressed === rightPressed) {
    return 0;
  }
  return leftPressed ? -1 : 1;
}

function isPressedThisFrame(keyCode: string): boolean {
  return keyDown.has(keyCode) && !previousKeyDown.has(keyCode);
}

function syncPlayerVisuals(): void {
  for (const playerId of MATCH_STATE_EXAMPLE.playerOrder) {
    const player = MATCH_STATE_EXAMPLE.playersById[playerId];
    const element = playerElementsById[playerId];
    if (!player || !element) {
      continue;
    }

    element.style.left = `${toXPct(player.position.x)}%`;
    element.style.top = `${toYPct(player.position.y)}%`;
    element.style.width = `${player.renderSize.x}px`;
    element.style.height = `${player.renderSize.y}px`;
    element.classList.remove("player-token--face-left", "player-token--face-right");
    element.classList.add(getFacingClass(player.facing));
    const facingIndicator = element.querySelector<HTMLSpanElement>(".player-token__facing");
    if (facingIndicator) {
      facingIndicator.textContent = player.facing === 1 ? ">" : "<";
    }

    const shouldBlink = player.respawnInvulnerabilityMs > 0;
    if (!shouldBlink) {
      element.style.opacity = "1";
    } else {
      const blinkVisible = Math.floor(lastTimestamp / 90) % 2 === 0;
      element.style.opacity = blinkVisible ? "1" : "0.35";
    }
  }
}

function getFacingClass(facing: -1 | 1): string {
  return facing === 1 ? "player-token--face-right" : "player-token--face-left";
}

function syncHitboxVisuals(): void {
  if (!hitboxLayerElement) {
    return;
  }

  const worldWidth = MATCH_STATE_EXAMPLE.stage.blastZoneMax.x - MATCH_STATE_EXAMPLE.stage.blastZoneMin.x;
  const worldHeight = MATCH_STATE_EXAMPLE.stage.blastZoneMax.y - MATCH_STATE_EXAMPLE.stage.blastZoneMin.y;
  const activeHitboxes = hitboxSystem.getActiveHitboxes();

  hitboxLayerElement.innerHTML = activeHitboxes.map((hitbox) => {
    const leftPct = ((hitbox.x - MATCH_STATE_EXAMPLE.stage.blastZoneMin.x) / worldWidth) * 100;
    const topPct = ((hitbox.y - MATCH_STATE_EXAMPLE.stage.blastZoneMin.y) / worldHeight) * 100;
    const widthPct = (hitbox.width / worldWidth) * 100;
    const heightPct = (hitbox.height / worldHeight) * 100;
    return `
      <div
        class="hitbox-debug"
        style="left:${leftPct}%;top:${topPct}%;width:${widthPct}%;height:${heightPct}%"
      ></div>
    `;
  }).join("");
}

function syncRespawnPlatformsVisuals(): void {
  if (!respawnPlatformLayerElement) {
    return;
  }

  const worldWidth = MATCH_STATE_EXAMPLE.stage.blastZoneMax.x - MATCH_STATE_EXAMPLE.stage.blastZoneMin.x;
  const worldHeight = MATCH_STATE_EXAMPLE.stage.blastZoneMax.y - MATCH_STATE_EXAMPLE.stage.blastZoneMin.y;

  const platformHtml = MATCH_STATE_EXAMPLE.playerOrder.map((playerId) => {
    const player = MATCH_STATE_EXAMPLE.playersById[playerId];
    if (
      !player ||
      player.respawnInvulnerabilityMs <= 0 ||
      player.respawnPlatformCenterX === null ||
      player.respawnPlatformY === null ||
      player.respawnPlatformWidth <= 0
    ) {
      return "";
    }

    const leftWorld = player.respawnPlatformCenterX - player.respawnPlatformWidth / 2;
    const topWorld = player.respawnPlatformY;
    const leftPct = ((leftWorld - MATCH_STATE_EXAMPLE.stage.blastZoneMin.x) / worldWidth) * 100;
    const topPct = ((topWorld - MATCH_STATE_EXAMPLE.stage.blastZoneMin.y) / worldHeight) * 100;
    const widthPct = (player.respawnPlatformWidth / worldWidth) * 100;
    const heightPct = (14 / worldHeight) * 100;

    return `
      <div
        class="respawn-platform"
        style="left:${leftPct}%;top:${topPct}%;width:${widthPct}%;height:${heightPct}%"
      ></div>
    `;
  }).join("");

  respawnPlatformLayerElement.innerHTML = platformHtml;
}

function syncLifeHud(): void {
  for (const playerId of MATCH_STATE_EXAMPLE.playerOrder) {
    const player = MATCH_STATE_EXAMPLE.playersById[playerId];
    const lifeBox = lifeBoxElementsByPlayerId[playerId];
    if (!player || !lifeBox) {
      continue;
    }

    lifeBox.innerHTML = `
      <div class="life-box__name">${playerId.toUpperCase()}</div>
      <div class="life-box__damage">${Math.floor(player.damage)}%</div>
      <div class="life-box__stocks">Stocks: ${player.stocks}</div>
    `;
  }

  if (!winnerBannerElement) {
    return;
  }

  if (MATCH_STATE_EXAMPLE.phase === "finished" && MATCH_STATE_EXAMPLE.winnerPlayerId) {
    winnerBannerElement.textContent = `${MATCH_STATE_EXAMPLE.winnerPlayerId.toUpperCase()} wins`;
    winnerBannerElement.classList.add("winner-banner--visible");
    return;
  }

  winnerBannerElement.textContent = "";
  winnerBannerElement.classList.remove("winner-banner--visible");
}
