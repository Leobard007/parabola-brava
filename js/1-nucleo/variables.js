/* ======================================================================
   ARCHIVO: js/1-nucleo/variables.js

   VARIABLES DEL LANZAMIENTO
   Define las variables que controla el jugador (velocidad inicial v₀, ángulo θ, altura h₀)
   y la gravedad: sus nombres, unidades, límites y valores por defecto.
   Para añadir un planeta, agrega una línea a GRAVS.
   ====================================================================== */

/* ---------- variables del lanzamiento ---------- */
// Lista de gravedades disponibles: [valor en m/s², [nombre en español, nombre en inglés]].
// Puedes añadir planetas nuevos aquí.
const GRAVS = [
  [9.81, ['Tierra', 'Earth']],
  [1.62, ['Luna', 'Moon']],
  [3.71, ['Marte', 'Mars']],
  [24.79, ['Júpiter', 'Jupiter']],
];

// Devuelve el nombre de una gravedad en el idioma actual.
const gName = (pair) => L(pair[0], pair[1]);

// Las tres variables que controla el jugador al lanzar.
const VKEYS = ['v0', 'ang', 'h0'];

// Información de cada variable: nombre, símbolo, unidad, límites absolutos (lo/hi)
// y valores por defecto (d) para un nivel nuevo.
const VAR_META = {
  v0: {
    es: 'Velocidad inicial v₀',
    en: 'Initial speed v₀',
    sym: 'v₀',
    unit: 'm/s',
    lo: 1,
    hi: 80,
    d: { def: 18, min: 5, max: 45, step: 0.5 },
  },
  ang: {
    es: 'Ángulo θ',
    en: 'Angle θ',
    sym: 'θ',
    unit: '°',
    lo: -89,
    hi: 89,
    d: { def: 45, min: -30, max: 85, step: 1 },
  },
  h0: {
    es: 'Altura h₀',
    en: 'Height h₀',
    sym: 'h₀',
    unit: 'm',
    lo: 0,
    hi: 40,
    d: { def: 2, min: 0, max: 15, step: 0.5 },
  },
};

// Nombre de una variable en el idioma actual.
const varLabel = (k) => L(VAR_META[k].es, VAR_META[k].en);

// Crea las variables por defecto de un nivel nuevo (copia de VAR_META[...].d).
function defaultVars() {
  const v = {};
  VKEYS.forEach((k) => (v[k] = { ...VAR_META[k].d, locked: false }));
  v.g = { def: 9.81, locked: false };
  return v;
}

// "Normaliza" las variables de un nivel: corrige valores fuera de rango o mal escritos
// para que el juego nunca reciba datos imposibles (ej. mínimo mayor que máximo).
function normVars(src) {
  const out = defaultVars();
  VKEYS.forEach((k) => {
    const m = VAR_META[k],
      s = (src && src[k]) || {},
      o = out[k];
    o.min = r2(clamp(num(s.min, o.min), m.lo, m.hi));
    o.max = r2(clamp(num(s.max, o.max), m.lo, m.hi));
    if (o.max < o.min) [o.min, o.max] = [o.max, o.min];
    o.step = r2(clamp(num(s.step, o.step), 0.01, Math.max(0.01, o.max - o.min || 1)));
    o.def = r2(clamp(num(s.def, o.def), o.min, o.max));
    o.locked = !!s.locked;
  });
  const gsrc = (src && src.g) || {};
  out.g.def = r2(clamp(num(gsrc.def, 9.81), 0.1, 50));
  out.g.locked = !!gsrc.locked;
  return out;
}
