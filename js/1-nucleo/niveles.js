/* ======================================================================
   ARCHIVO: js/1-nucleo/niveles.js

   NIVELES DE LAS CAMPAÑAS
   Este es el archivo para crear o cambiar los niveles incluidos en el juego.
     - CAMPAIGN   → niveles de lanzamiento
     - CAMPAIGN_D → niveles de desplazamiento (vectores)
     - CAMPAIGN_M → niveles mixtos
   Unidades: todas las posiciones y tamaños están en METROS. x = distancia desde el lanzador,
   y = altura sobre el suelo. Consejo: crea un nivel en el editor del juego, usa
   "Generar y copiar código" y compáralo con estos objetos para ver el formato.
   ====================================================================== */

/* ---------- niveles como datos ---------- */
// Atajo para escribir bloques: B(x, y, ancho, alto, tipo) con tipo 'wood' (madera) o 'stone' (piedra).
const B = (x, y, w, h, k) => ({ k, x, y, w, h });

// Atajo para un objetivo (cochinito): T(x del centro, y). Mide 1.2 m × 1.2 m.
const T = (cx, y) => ({ k: 'target', x: cx - 0.6, y, w: 1.2, h: 1.2 });

// NIVELES DE LANZAMIENTO. Cada nivel es un objeto con:
//   id, name / name_en (nombre en español / inglés), W (ancho del mundo en m), shots (tiros),
//   terrain (terreno fijo), objs (bloques y objetivos) y vars (límites de v0, ángulo, altura y gravedad).
// Puedes copiar uno, cambiar los números y tendrás un nivel nuevo.
const CAMPAIGN = [
  // Ejemplo explicado (nivel 1):
  //   W: 42          → el mundo mide 42 m de ancho
  //   shots: 4       → el jugador tiene 4 tiros
  //   terrain: []    → sin terreno fijo. Formato de terreno: { x: inicio, w: ancho, h: alto }
  //   B(28.5,0,1,2,'wood') → bloque de madera en x = 28.5 m, y = 0 (en el suelo), 1 m de ancho y 2 m de alto
  //   T(30.5,2.5)    → objetivo (cochinito) centrado en x = 30.5 m, a 2.5 m de altura
  {
    id: 'c1',
    name: 'Primer tiro',
    name_en: 'First shot',
    W: 42,
    shots: 4,
    terrain: [],
    objs: [B(28.5, 0, 1, 2, 'wood'), B(31.5, 0, 1, 2, 'wood'), B(28.5, 2, 4, 0.5, 'wood'), T(30.5, 2.5)],
  },
  {
    id: 'c2',
    name: 'El muro',
    name_en: 'The wall',
    W: 45,
    shots: 4,
    terrain: [{ x: 20, w: 1.5, h: 7 }],
    objs: [B(31, 0, 0.5, 1.8, 'wood'), B(34.5, 0, 0.5, 1.8, 'wood'), B(31, 1.8, 4, 0.4, 'wood'), T(32.75, 0)],
  },
  {
    id: 'c3',
    name: 'La meseta',
    name_en: 'The plateau',
    W: 56,
    shots: 4,
    terrain: [{ x: 34, w: 18, h: 7 }],
    objs: [
      B(38, 7, 1, 2.5, 'stone'),
      B(42, 7, 1, 2.5, 'stone'),
      B(38, 9.5, 5, 0.5, 'wood'),
      T(40.5, 7),
      T(40.5, 10),
      B(46, 7, 0.4, 1.6, 'wood'),
      B(48, 7, 0.4, 1.6, 'wood'),
      B(46, 8.6, 2.4, 0.4, 'wood'),
      T(47.2, 7),
    ],
  },
  {
    id: 'c4',
    name: 'La torre',
    name_en: 'The tower',
    W: 52,
    shots: 5,
    terrain: [{ x: 28, w: 2, h: 4 }],
    objs: [
      B(38, 0, 0.8, 3, 'stone'),
      B(42.2, 0, 0.8, 3, 'stone'),
      B(38, 3, 5, 0.5, 'wood'),
      T(40.5, 0),
      B(38.4, 3.5, 0.6, 2.6, 'wood'),
      B(42, 3.5, 0.6, 2.6, 'wood'),
      B(38, 6.1, 5, 0.5, 'stone'),
      T(40.5, 3.5),
      T(40.5, 6.6),
    ],
  },
  {
    id: 'c5',
    name: 'Lejos y alto',
    name_en: 'Far and high',
    W: 82,
    shots: 5,
    terrain: [
      { x: 40, w: 3, h: 16 },
      { x: 58, w: 22, h: 12 },
    ],
    objs: [
      B(64, 12, 0.6, 2.4, 'wood'),
      B(67.4, 12, 0.6, 2.4, 'wood'),
      B(64, 14.4, 4, 0.5, 'stone'),
      T(66, 12),
      T(66, 14.9),
      B(71.8, 12, 0.5, 1.6, 'stone'),
      B(74, 12, 0.5, 1.6, 'stone'),
      B(71.8, 13.6, 2.7, 0.4, 'stone'),
      T(73.15, 12),
    ],
  },
].map((l) => ({ ...l, type: 'clasico', grid: true, vars: defaultVars(), mov: null }));
// ↑ .map(...) añade a cada nivel los campos comunes (tipo, cuadrícula visible y variables por defecto).

// NIVELES DE DESPLAZAMIENTO (solo vectores, sin lanzar).
// mov.ax / mov.ay = punto de inicio A; mov.vecs = lista de vectores;
// show = qué ve el jugador (sh('datos', 'incógnitas')).
const CAMPAIGN_D = [
  // Formato de un vector: { d: distancia en m, ang: ángulo en grados (0° a 90° desde la horizontal),
  //                         dir: dirección ('r' derecha, 'l' izquierda, 'u' arriba, 'd' abajo, 'ur', 'ul', 'dr', 'dl'),
  //                         show: sh('lo que ve el jugador', 'lo que debe calcular') }
  // Para vectores de velocidad usa kind: 'vel' con v y t; de aceleración, kind: 'acc' con a, t y v0.
  {
    id: 'd1',
    name: 'Suma de vectores',
    name_en: 'Adding vectors',
    W: 32,
    mov: {
      ax: 8,
      ay: 0,
      vecs: [
        { d: 12, dir: 'r', show: sh('d dir') },
        { d: 5, dir: 'u', show: sh('d dir') },
      ],
      R: { show: sh('', 'd ang dir') },
    },
  },
  {
    id: 'd2',
    name: 'Descomponer',
    name_en: 'Breaking it down',
    W: 34,
    mov: {
      ax: 6,
      ay: 0,
      vecs: [{ d: 20, ang: 30, dir: 'ur', show: sh('') }],
      R: { show: sh('d ang dir', 'x y') },
    },
  },
  {
    id: 'd3',
    name: 'De componentes a polar',
    name_en: 'Components to polar',
    W: 30,
    mov: {
      ax: 8,
      ay: 0,
      vecs: [
        { d: 10, ang: 53.13, dir: 'ur', show: sh('x y') },
        { d: 9.22, ang: 12.53, dir: 'dr', show: sh('x y') },
        { d: 6.71, ang: 63.43, dir: 'ul', show: sh('x y') },
      ],
      R: { show: sh('', 'd ang dir') },
    },
  },
  {
    id: 'd4',
    name: 'El vector faltante',
    name_en: 'The missing vector',
    W: 30,
    mov: {
      ax: 8,
      ay: 0,
      showPath: false,
      vecs: [
        { d: 4, dir: 'r', show: sh('d dir') },
        { d: 9.43, ang: 32.01, dir: 'ur', show: sh('dir', 'd ang') },
      ],
      R: { show: sh('d ang dir') },
    },
  },
  {
    id: 'd5',
    name: 'Pitágoras inverso',
    name_en: 'Pythagoras in reverse',
    W: 32,
    mov: {
      ax: 5,
      ay: 0,
      vecs: [{ d: 25, ang: 36.87, dir: 'ur', show: sh('') }],
      R: { show: sh('d x dir', 'y ang') },
    },
  },
  {
    id: 'd6',
    name: 'Velocidad y tiempo',
    name_en: 'Speed and time',
    W: 30,
    mov: {
      ax: 5,
      ay: 0,
      vecs: [
        { kind: 'vel', v: 4, t: 5, ang: 30, dir: 'ur', show: sh('v t ang dir') },
        { kind: 'vel', v: 3, t: 2, dir: 'd', show: sh('v t dir') },
      ],
      R: { show: sh('', 'd ang dir') },
    },
  },
  {
    id: 'd7',
    name: '¿Cuánto tardó?',
    name_en: 'How long did it take?',
    W: 28,
    mov: {
      ax: 8,
      ay: 0,
      showPath: false,
      vecs: [
        { kind: 'vel', v: 5, t: 2, dir: 'r', show: sh('v t dir') },
        { kind: 'vel', v: 2, t: 3.75, dir: 'u', show: sh('v dir', 't') },
      ],
      R: { show: sh('d dir') },
    },
  },
  {
    id: 'd8',
    name: 'Acelerando',
    name_en: 'Speeding up',
    W: 28,
    mov: {
      ax: 5,
      ay: 0,
      vecs: [
        { kind: 'acc', a: 2, t: 3, v0: 0, dir: 'r', show: sh('a t v0 dir') },
        { kind: 'acc', a: 1, t: 4, v0: 0, ang: 53.13, dir: 'ur', show: sh('a t v0 ang dir') },
      ],
      R: { show: sh('', 'd ang dir') },
    },
  },
].map((l) => ({
  ...l,
  type: 'despl',
  grid: false,
  shots: 4,
  terrain: [],
  objs: [],
  vars: defaultVars(),
  mov: normMov(l.mov, l.W),
}));

// NIVELES MIXTOS: primero se resuelven los vectores y después se lanza al objetivo.
const CAMPAIGN_M = [
  {
    id: 'm1',
    name: 'Primer salto',
    name_en: 'First jump',
    W: 45,
    shots: 4,
    terrain: [],
    objs: [],
    mov: {
      ax: 15,
      ay: 0,
      vecs: [{ d: 10, ang: 36.87, dir: 'ur', show: sh('x y') }],
      R: { show: sh('', 'd ang dir') },
    },
  },
  {
    id: 'm2',
    name: 'Dos vectores',
    name_en: 'Two vectors',
    W: 45,
    shots: 4,
    terrain: [{ x: 20, w: 1.5, h: 5 }],
    objs: [],
    mov: {
      ax: 12,
      ay: 0,
      vecs: [
        { d: 5, ang: 36.87, dir: 'ur', show: sh('x y') },
        { d: 10, dir: 'r', show: sh('x y') },
      ],
      R: { show: sh('', 'd ang') },
    },
  },
  {
    id: 'm3',
    name: 'Ida y vuelta',
    name_en: 'There and back',
    W: 48,
    shots: 4,
    terrain: [],
    objs: [],
    mov: {
      ax: 30,
      ay: 4,
      vecs: [
        { d: 15, ang: 53.13, dir: 'ur' },
        { d: 8, dir: 'l' },
        { d: 6, dir: 'd' },
      ],
      R: { show: sh('', 'd ang dir') },
    },
  },
  {
    id: 'm4',
    name: 'Laberinto',
    name_en: 'Maze',
    W: 55,
    shots: 5,
    terrain: [{ x: 30, w: 1.5, h: 9 }],
    objs: [B(46, 0, 0.6, 2, 'stone')],
    mov: {
      ax: 20,
      ay: 0,
      tolD: 4,
      vecs: [
        { d: 10, ang: 30, dir: 'ur' },
        { d: 12, ang: 20, dir: 'dr' },
        { d: 6, dir: 'u' },
      ],
      R: { show: sh('', 'd ang dir') },
    },
  },
].map((l) => ({ ...l, type: 'mixto', grid: false, vars: defaultVars(), mov: normMov(l.mov, l.W) }));

// Nombre de un nivel en el idioma actual (usa name_en si existe y el idioma es inglés).
const lvName = (def) => (SET.lang === 'en' && def.name_en ? def.name_en : def.name);

// Normaliza un nivel completo: limita tamaños, corrige datos y completa lo que falte.
// Se usa con los niveles de las campañas, los creados en el editor y los importados por código.
function normLevel(raw) {
  raw = raw || {};
  const W = r2(clamp(num(raw.W, 45), 20, 150));
  const legacy = raw.mov && Array.isArray(raw.mov.legs) && !raw.mov.vecs;
  let type = ['clasico', 'despl', 'mixto'].includes(raw.type) ? raw.type : 'clasico';
  if (legacy && type === 'despl') type = 'mixto';
  return {
    id: typeof raw.id === 'string' ? raw.id : null,
    name: String(raw.name || L('Nivel sin nombre', 'Untitled level')).slice(0, 40),
    type,
    W,
    shots: Math.round(clamp(num(raw.shots, 4), 1, 10)),
    grid: raw.grid !== undefined ? !!raw.grid : type === 'clasico' || legacy,
    terrain: (Array.isArray(raw.terrain) ? raw.terrain : []).slice(0, 40).map((t) => {
      const w = r2(clamp(num(t.w, 2), 0.3, 60));
      return {
        x: r2(clamp(num(t.x, 10), LAUNCH_CLEAR, Math.max(LAUNCH_CLEAR, W - w))),
        w,
        h: r2(clamp(num(t.h, 2), 0.3, 40)),
      };
    }),
    objs: (Array.isArray(raw.objs) ? raw.objs : [])
      .slice(0, 200)
      .filter((o) => o && ['wood', 'stone', 'target'].includes(o.k))
      .map((o) => {
        const w = o.k === 'target' ? 1.2 : r2(clamp(num(o.w, 1), 0.2, 20));
        const h = o.k === 'target' ? 1.2 : r2(clamp(num(o.h, 1), 0.2, 20));
        return {
          k: o.k,
          x: r2(clamp(num(o.x, 10), LAUNCH_CLEAR, Math.max(LAUNCH_CLEAR, W - w))),
          y: r2(Math.max(0, num(o.y, 0))),
          w,
          h,
        };
      }),
    vars: normVars(raw.vars),
    mov: type !== 'clasico' || raw.mov ? normMov(raw.mov, W) : null,
  };
}

// Las tres campañas, con la clave donde se guarda cuántos niveles están desbloqueados y su prefijo ("", "D", "M").
const CAMPAIGNS = [
  { key: 'c', list: CAMPAIGN, unlock: 'unlocked', prefix: '', cls: 'c' },
  { key: 'd', list: CAMPAIGN_D, unlock: 'unlockedD', prefix: 'D', cls: 'd' },
  { key: 'm', list: CAMPAIGN_M, unlock: 'unlockedM', prefix: 'M', cls: 'm' },
];

// Busca a qué campaña pertenece un nivel y en qué posición está.
function campaignOf(def) {
  for (const c of CAMPAIGNS) {
    const i = c.list.indexOf(def);
    if (i >= 0) return { ...c, i };
  }
  return null;
}
