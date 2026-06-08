// Logica do jogo "Bolachas" — servidor autoritativo, estado em memoria.
// A crianca (maior e mais rapida) tenta apanhar todas as bolachas antes do tempo acabar.
// O mundo e uma cozinha gigante com altura: sobe-se pelas rampas e so se apanha
// quem estiver a altura semelhante (definido em public/kitchen.js).

import { WORLD, heightAt, collide, resolveCollision, HEIGHT_TOL, spawnPoint } from '../public/kitchen.js';

export { WORLD };

const ROLE = { CRIANCA: 'crianca', BOLACHA: 'bolacha' };

const SPEED = { [ROLE.CRIANCA]: 290, [ROLE.BOLACHA]: 250 };
const RADIUS = { [ROLE.CRIANCA]: 46, [ROLE.BOLACHA]: 32 };

// Fisica de salto (unidades do mundo por segundo).
const GRAVITY = 1500;
const JUMP_SPEED = 720; // altura maxima ~ 720^2 / (2*1500) ≈ 173 (chega a bancada/mesa)

const ROUND_SECONDS = 75;
const MIN_PLAYERS = 2;
const COUNTDOWN_SECONDS = 3;

const COOKIE_COLORS = ['#d98a3d', '#c97b2c', '#e0a05a', '#b86a22', '#caa06b', '#e8b06a'];

// Estados possiveis da partida.
const PHASE = { WAITING: 'waiting', COUNTDOWN: 'countdown', PLAYING: 'playing', OVER: 'over' };

let nextColorIndex = 0;
let nextSpawnIndex = 0;

export function createGame() {
  return {
    players: new Map(), // id -> player
    phase: PHASE.WAITING,
    timeLeft: ROUND_SECONDS,
    countdown: COUNTDOWN_SECONDS,
    message: 'A espera de jogadores...',
    winner: null, // 'crianca' | 'bolachas' | null
  };
}

export function addPlayer(game, id, name) {
  const hasCrianca = [...game.players.values()].some((p) => p.role === ROLE.CRIANCA);
  const role = hasCrianca ? ROLE.BOLACHA : ROLE.CRIANCA;
  const spawn = spawnPoint(nextSpawnIndex++);
  const color = COOKIE_COLORS[nextColorIndex % COOKIE_COLORS.length];
  nextColorIndex += 1;

  const player = {
    id,
    name: (name || 'Jogador').slice(0, 14),
    role,
    color,
    x: spawn.x,
    y: spawn.y,
    h: 0, // altura atual (chao)
    vh: 0, // velocidade vertical
    grounded: true,
    wantJump: false,
    facing: 1,
    walk: 0, // fase de animacao das pernas
    alive: true,
    input: { dx: 0, dy: 0 },
  };
  game.players.set(id, player);
  return player;
}

export function removePlayer(game, id) {
  const player = game.players.get(id);
  if (!player) return;
  game.players.delete(id);
  // Se a crianca saiu, promove outra pessoa para que o jogo continue.
  if (player.role === ROLE.CRIANCA) {
    const next = [...game.players.values()][0];
    if (next) {
      next.role = ROLE.CRIANCA;
      next.alive = true;
    }
  }
}

export function setInput(game, id, dx, dy, jump = false) {
  const player = game.players.get(id);
  if (!player) return;
  // Normaliza para evitar movimento mais rapido na diagonal.
  const nx = Math.max(-1, Math.min(1, dx));
  const ny = Math.max(-1, Math.min(1, dy));
  const len = Math.hypot(nx, ny);
  const scale = len > 1 ? 1 / len : 1;
  player.input = { dx: nx * scale, dy: ny * scale };
  player.wantJump = !!jump;
}

export function requestRestart(game) {
  if (game.phase === PHASE.OVER || game.phase === PHASE.WAITING) startCountdown(game);
}

function startCountdown(game) {
  if (game.players.size < MIN_PLAYERS) {
    game.phase = PHASE.WAITING;
    game.message = 'A espera de jogadores...';
    return;
  }
  rotateCrianca(game);
  resetPositions(game);
  game.phase = PHASE.COUNTDOWN;
  game.countdown = COUNTDOWN_SECONDS;
  game.timeLeft = ROUND_SECONDS;
  game.winner = null;
  game.message = 'Preparar...';
}

// Garante que ha exatamente uma crianca; escolhe a proxima de forma rotativa.
function rotateCrianca(game) {
  const list = [...game.players.values()];
  if (list.length === 0) return;
  const current = list.find((p) => p.role === ROLE.CRIANCA);
  const idx = current ? (list.indexOf(current) + 1) % list.length : 0;
  list.forEach((p) => {
    p.role = ROLE.BOLACHA;
  });
  list[idx].role = ROLE.CRIANCA;
}

function resetPositions(game) {
  let i = 0;
  for (const p of game.players.values()) {
    const spawn = spawnPoint(i++);
    p.x = spawn.x;
    p.y = spawn.y;
    p.h = 0;
    p.vh = 0;
    p.grounded = true;
    p.wantJump = false;
    p.alive = true;
    p.input = { dx: 0, dy: 0 };
  }
}

// Avanca a simulacao em dt segundos.
export function step(game, dt) {
  syncPhaseWithPlayers(game);

  if (game.phase === PHASE.COUNTDOWN) {
    game.countdown -= dt;
    if (game.countdown <= 0) {
      game.phase = PHASE.PLAYING;
      game.message = 'Apanha as bolachas!';
    }
    moveOnly(game, dt, false); // deixa mexer, mas ainda nao apanha
    return;
  }

  if (game.phase === PHASE.PLAYING) {
    moveOnly(game, dt, true);
    game.timeLeft -= dt;
    checkEndConditions(game);
  }
}

function syncPhaseWithPlayers(game) {
  if (game.players.size < MIN_PLAYERS && game.phase !== PHASE.WAITING) {
    game.phase = PHASE.WAITING;
    game.message = 'A espera de jogadores...';
  }
  if (game.phase === PHASE.WAITING && game.players.size >= MIN_PLAYERS) {
    startCountdown(game);
  }
}

function moveOnly(game, dt, allowCatch) {
  for (const p of game.players.values()) {
    const speed = SPEED[p.role];
    const vx = p.input.dx * speed;
    const vy = p.input.dy * speed;
    const r = RADIUS[p.role];

    if (p.alive) {
      // Altura no inicio do tick (usada para deteccao de aterragem sem tunneling).
      const prevH = p.h;

      // --- Vertical: salto + gravidade ---
      if (p.wantJump && p.grounded) {
        p.vh = JUMP_SPEED;
        p.grounded = false;
      }
      p.vh -= GRAVITY * dt;
      const newH = prevH + p.vh * dt;

      // --- Horizontal: move eixo a eixo para deslizar nos moveis solidos ---
      // Usa prevH: se estavas em cima de um movel, continuas a poder andar la por cima.
      const nx = p.x + vx * dt;
      if (!collide(nx, p.y, prevH, r)) p.x = nx;
      const ny = p.y + vy * dt;
      if (!collide(p.x, ny, prevH, r)) p.y = ny;

      // Empurra para fora de qualquer movel onde tenha ficado encravado
      // (ex.: ao aterrar encostado a um balcao) — evita ficar preso.
      const fixed = resolveCollision(p.x, p.y, prevH, r);
      p.x = fixed.x;
      p.y = fixed.y;

      p.x = Math.max(r, Math.min(WORLD.width - r, p.x));
      p.y = Math.max(r, Math.min(WORLD.height - r, p.y));

      // --- Aterrar: a superficie de suporte e a mais alta alcancavel a partir de
      // prevH. Como filtramos por prevH (e nao pela altura ja descida), uma queda
      // grande num so tick continua a aterrar na plataforma que atravessou. ---
      const support = heightAt(p.x, p.y, prevH);
      if (newH <= support) {
        p.h = support;
        p.vh = 0;
        p.grounded = true;
      } else {
        p.h = newH;
        p.grounded = false;
      }
    }

    if (Math.abs(vx) > 1) p.facing = vx > 0 ? 1 : -1;
    const moving = Math.hypot(vx, vy) > 1;
    p.walk = moving && p.grounded ? p.walk + dt * 10 : p.walk;
  }

  if (!allowCatch) return;

  const crianca = [...game.players.values()].find((p) => p.role === ROLE.CRIANCA);
  if (!crianca) return;
  for (const p of game.players.values()) {
    if (p.role !== ROLE.BOLACHA || !p.alive) continue;
    const dist = Math.hypot(p.x - crianca.x, p.y - crianca.y);
    const sameLevel = Math.abs(p.h - crianca.h) < HEIGHT_TOL;
    if (sameLevel && dist < RADIUS[ROLE.CRIANCA] + RADIUS[ROLE.BOLACHA] - 6) {
      p.alive = false; // apanhada!
    }
  }
}

function checkEndConditions(game) {
  const bolachas = [...game.players.values()].filter((p) => p.role === ROLE.BOLACHA);
  const restantes = bolachas.filter((p) => p.alive);

  if (bolachas.length > 0 && restantes.length === 0) {
    endRound(game, ROLE.CRIANCA);
    return;
  }
  if (game.timeLeft <= 0) {
    game.timeLeft = 0;
    endRound(game, 'bolachas');
  }
}

function endRound(game, winner) {
  game.phase = PHASE.OVER;
  game.winner = winner;
  game.message =
    winner === ROLE.CRIANCA
      ? 'A crianca apanhou todas as bolachas!'
      : 'As bolachas fugiram! Ganharam as bolachas!';
}

// Estado minimo enviado aos clientes.
export function snapshot(game) {
  return {
    phase: game.phase,
    timeLeft: Math.ceil(game.timeLeft),
    countdown: Math.ceil(game.countdown),
    message: game.message,
    winner: game.winner,
    world: WORLD,
    players: [...game.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      color: p.color,
      x: Math.round(p.x),
      y: Math.round(p.y),
      h: Math.round(p.h),
      grounded: p.grounded,
      facing: p.facing,
      walk: Number(p.walk.toFixed(2)),
      alive: p.alive,
    })),
  };
}
