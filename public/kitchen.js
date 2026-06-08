// Cenario partilhado (servidor + cliente): cozinha gigante estilo "A Webbing Journey".
// Define o tamanho do mundo, os moveis e as funcoes autoritativas de altura/colisao.
//
// Coordenadas do plano: x em [0, WORLD.width], y em [0, WORLD.height] (vista de cima).
// A altura (eixo vertical no 3D) e dada por "top". Sobe-se a SALTAR para cima dos moveis.

export const WORLD = { width: 2600, height: 1800 };

// Tolerancia de bordo: margem para aterrar/passar junto ao topo de um movel.
export const EDGE = 14;
// Diferenca de altura maxima para a crianca conseguir apanhar uma bolacha.
export const HEIGHT_TOL = 40;

// Alturas de referencia (unidades do mundo; bolacha tem raio 24, crianca 46).
const H_CEREAL = 80;
const H_COUNTER = 125;
const H_TABLE = 155;
const H_SHELF = 230;
const H_CABINET = 235;
const H_CUP = 200; // armario aberto (da para entrar)

// base = altura inferior do solido (0 = do chao). Plataformas (ex.: telhado)
// tem base > 0: solidas entre [base, top], com espaco livre por baixo.
function box(kind, x0, y0, x1, y1, top, opts = {}) {
  return { kind, shape: 'box', x0, y0, x1, y1, top, base: 0, blocks: true, ...opts };
}
function cyl(kind, cx, cy, rr, top, opts = {}) {
  return { kind, shape: 'cyl', cx, cy, rr, top, base: 0, blocks: true, ...opts };
}

export const OBSTACLES = [
  // --- Bancadas encostadas a parede de tras ---
  box('counter', 120, 40, 980, 300, H_COUNTER),
  box('stove', 980, 40, 1240, 300, H_COUNTER + 5),
  box('counter', 1240, 40, 2480, 300, H_COUNTER),

  // --- Armarios de cima (saltar da bancada) ---
  box('cabinet', 180, 40, 640, 250, H_CABINET),
  box('cabinet', 1500, 40, 1960, 250, H_CABINET),
  box('cabinet', 2020, 40, 2440, 250, H_CABINET),

  // --- Parede esquerda: armario aberto (da para entrar), com telhado ---
  // Armario em U com o fundo ENCOSTADO a parede esquerda (x=0). Frente aberta.
  box('cupboard', 0, 430, 36, 830, H_CUP), // fundo (encostado a parede esquerda)
  box('cupboard', 0, 430, 300, 466, H_CUP), // lateral de cima
  box('cupboard', 0, 794, 300, 830, H_CUP), // lateral de baixo
  box('door', 300, 457, 600, 475, H_CUP), // porta aberta (solida, aponta para a sala)
  // Telhado reto: laje solida por cima [200..226]; livre por baixo (da para entrar).
  box('roof', 0, 430, 300, 830, H_CUP + 26, { base: H_CUP }),

  // --- Parede direita: bancada + prateleira (encostadas a parede x=2600) ---
  box('counter', 2360, 440, 2600, 1200, H_COUNTER),
  box('shelf', 2360, 1240, 2600, 1500, H_SHELF),

  // --- Mesa de jantar central (refugio alto) ---
  box('table', 1040, 820, 1760, 1320, H_TABLE),

  // --- Ilha de cozinha ---
  box('island', 360, 1060, 920, 1460, H_COUNTER),

  // --- Frascos de vidro (cobertura) ---
  cyl('jar', 520, 170, 55, 145),
  cyl('jar', 1700, 170, 55, 145),
  cyl('jar', 2200, 170, 55, 145),
  cyl('jar', 2450, 820, 55, 145),

  // --- Caixas de cereais no chao (degrau / esconderijo) ---
  box('cereal', 1180, 1480, 1300, 1600, H_CEREAL),
  box('cereal', 760, 700, 880, 820, H_CEREAL),
  box('cereal', 1900, 1360, 2020, 1480, H_CEREAL),
];

// Pontos seguros de nascimento (no chao, longe de moveis solidos).
export const SPAWNS = [
  { x: 420, y: 1680 },
  { x: 900, y: 1700 },
  { x: 1400, y: 1700 },
  { x: 1950, y: 1700 },
  { x: 2250, y: 1620 },
  { x: 1000, y: 560 },
  { x: 1900, y: 560 },
  { x: 520, y: 950 },
];

export function spawnPoint(index) {
  return SPAWNS[index % SPAWNS.length];
}

// --- Geometria auxiliar ---
function pointInRect(x, y, o) {
  return x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1;
}
function pointInCyl(x, y, o) {
  return Math.hypot(x - o.cx, y - o.cy) <= o.rr;
}
function pointInside(x, y, o) {
  return o.shape === 'cyl' ? pointInCyl(x, y, o) : pointInRect(x, y, o);
}

// Altura da superficie onde o jogador assenta/aterra na posicao (x,y) estando a altura h.
// E o topo mais alto cujo nivel esta em/abaixo dos pes (com pequena margem) — chao = 0.
export function heightAt(x, y, h) {
  let best = 0; // chao
  for (const o of OBSTACLES) {
    if (!pointInside(x, y, o)) continue;
    if (o.top <= h + EDGE && o.top > best) best = o.top;
  }
  return best;
}

function circleHitsRect(x, y, r, o) {
  const nx = Math.max(o.x0, Math.min(x, o.x1));
  const ny = Math.max(o.y0, Math.min(y, o.y1));
  return Math.hypot(x - nx, y - ny) < r;
}
function circleHitsCyl(x, y, r, o) {
  return Math.hypot(x - o.cx, y - o.cy) < r + o.rr;
}

// true se a posicao (x,y) com este raio colide com um movel solido
// que o jogador (a esta altura) ainda nao ultrapassou pelo topo.
export function collide(x, y, h, radius) {
  for (const o of OBSTACLES) {
    if (!o.blocks) continue;
    if (h >= o.top - EDGE) continue; // ja esta ao nivel do topo -> pode passar/andar por cima
    if (h < o.base - EDGE) continue; // esta por baixo da plataforma (ex.: telhado) -> passa
    const hit = o.shape === 'cyl' ? circleHitsCyl(x, y, radius, o) : circleHitsRect(x, y, radius, o);
    if (hit) return true;
  }
  return false;
}

// Empurra a posicao para fora de qualquer movel solido em que tenha ficado
// encravada (ex.: ao aterrar encostado a um balcao). Devolve {x,y} corrigidos.
export function resolveCollision(x, y, h, radius) {
  let px = x;
  let py = y;
  for (let iter = 0; iter < 2; iter++) {
    for (const o of OBSTACLES) {
      if (!o.blocks) continue;
      if (h >= o.top - EDGE) continue; // ja esta por cima -> nao empurra
      if (h < o.base - EDGE) continue; // por baixo da plataforma -> nao empurra

      if (o.shape === 'cyl') {
        const dx = px - o.cx;
        const dy = py - o.cy;
        const d = Math.hypot(dx, dy);
        const min = radius + o.rr;
        if (d < min) {
          if (d > 0.001) {
            const k = (min - d) / d;
            px += dx * k;
            py += dy * k;
          } else {
            px += min; // centro coincidente: empurra numa direcao qualquer
          }
        }
        continue;
      }

      // Retangulo: ponto mais proximo do bordo.
      const cx = Math.max(o.x0, Math.min(px, o.x1));
      const cy = Math.max(o.y0, Math.min(py, o.y1));
      const dx = px - cx;
      const dy = py - cy;
      const d = Math.hypot(dx, dy);
      if (d >= radius) continue;

      if (d > 0.001) {
        const k = (radius - d) / d;
        px += dx * k;
        py += dy * k;
      } else {
        // Centro dentro do retangulo: empurra para o bordo mais proximo.
        const left = px - o.x0;
        const right = o.x1 - px;
        const up = py - o.y0;
        const down = o.y1 - py;
        const m = Math.min(left, right, up, down);
        if (m === left) px = o.x0 - radius;
        else if (m === right) px = o.x1 + radius;
        else if (m === up) py = o.y0 - radius;
        else py = o.y1 + radius;
      }
    }
  }
  return { x: px, y: py };
}
