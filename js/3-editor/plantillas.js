/* ======================================================================
   ARCHIVO: js/3-editor/plantillas.js

   EDITOR: PLANTILLAS
   Las plantillas configuran de un clic qué datos ve el jugador y qué debe calcular.
   Para crear tu propia plantilla, copia una de las listas TPL_VEC, TPL_PAR o TPL_MIX
   y cambia su nombre, descripción y lo que hace su función apply.
   ====================================================================== */

/* =========================================================
   PLANTILLAS
   ========================================================= */

// Datos principales que definen cada tipo de vector.
const PRIM = { dist: ['d'], vel: ['v', 't'], acc: ['a', 't', 'v0'] };

// Hace visibles los datos principales de un vector.
function showPrimary(V) {
  const s = sh();
  PRIM[V.kind].forEach((q) => (s[q] = 'dato'));
  s.dir = 'dato';
  if (!isPure(V.dir)) s.ang = 'dato';
  return s;
}

// Asegura que haya al menos n vectores (añade los que falten).
function ensureVecs(m, n) {
  while (m.vecs.length < n) m.vecs.push(normVec({ d: 6, ang: 40, dir: 'ur' }));
}

// Cambia el tipo de un vector conservando su longitud y dirección.
function setKindKeep(V, kind) {
  if (V.kind === kind) return V;
  const len = vecVals(V).d,
    nv = { ...V, kind };
  if (kind === 'dist') nv.d = r2(len);
  if (kind === 'vel') {
    nv.t = V.t || 2;
    nv.v = r2(len / nv.t);
  }
  if (kind === 'acc') {
    nv.t = V.t || 2;
    nv.v0 = 0;
    nv.a = r2((2 * len) / (nv.t * nv.t));
  }
  const show = defaultShow(kind);
  ['ang', 'dir', 'x', 'y'].forEach((q) => (show[q] = V.show[q]));
  if (kind !== 'dist') show.d = V.show.d === 'dato' ? 'oculto' : V.show.d;
  nv.show = show;
  nv.stretch = null;
  return normVec(nv);
}

// Si el vector apunta en dirección pura, la cambia a diagonal (para que su ángulo sea una incógnita útil).
function unPure(V) {
  if (isPure(V.dir)) {
    const map = { r: ['ur', 25], l: ['ul', 25], u: ['ur', 65], d: ['dr', 65] };
    [V.dir, V.ang] = map[V.dir];
  }
}

// Ayuda para plantillas: pone el último vector del tipo indicado y marca una de sus magnitudes como incógnita.
function lastKind(m, kind, unknown) {
  ensureVecs(m, 2);
  const Li = m.vecs.length - 1;
  m.vecs[Li] = setKindKeep(m.vecs[Li], kind);
  m.vecs.forEach((V, i) => {
    V.show = showPrimary(V);
    if (i === Li) V.show[unknown] = 'inc';
  });
  m.R.show = sh('d ang dir');
  m.showPath = false;
}

// PLANTILLAS DE VECTORES. Cada una: id, n (nombre es/en), d (descripción es/en) y apply (qué cambia).
// Puedes añadir tus propias plantillas copiando una.
const TPL_VEC = [
  {
    id: 'sumR',
    n: ['Encontrar R', 'Find R'],
    d: ['Vectores completos; pide |R|, θ y dirección', 'Full vectors; asks for |R|, θ and direction'],
    apply: (m) => {
      m.vecs.forEach((V) => (V.show = showPrimary(V)));
      m.R.show = sh('', 'd ang dir');
      m.showPath = true;
    },
  },
  {
    id: 'decomp',
    n: ['Descomponer R', 'Break down R'],
    d: ['Da |R|, θ y dirección; pide Rₓ y Rᵧ', 'Gives |R|, θ and direction; asks for Rₓ and Rᵧ'],
    apply: (m) => {
      m.vecs.forEach((V) => (V.show = sh()));
      m.R.show = sh('d ang dir', 'x y');
      m.showPath = true;
    },
  },
  {
    id: 'comp',
    n: ['De componentes a polar', 'Components to polar'],
    d: [
      'Da Δx y Δy de cada vector; pide |R|, θ y dirección',
      'Gives Δx and Δy of each vector; asks for |R|, θ and direction',
    ],
    apply: (m) => {
      m.vecs.forEach((V) => (V.show = sh('x y')));
      m.R.show = sh('', 'd ang dir');
      m.showPath = true;
    },
  },
  {
    id: 'missing',
    n: ['Vector faltante', 'Missing vector'],
    d: [
      'Da R y los demás vectores; pide magnitud y ángulo del último',
      'Gives R and the other vectors; asks for the last one’s length and angle',
    ],
    apply: (m) => {
      ensureVecs(m, 2);
      const Li = m.vecs.length - 1;
      m.vecs[Li] = setKindKeep(m.vecs[Li], 'dist');
      unPure(m.vecs[Li]);
      m.vecs.forEach((V, i) => (V.show = i < Li ? showPrimary(V) : sh('dir', 'd ang')));
      m.R.show = sh('d ang dir');
      m.showPath = false;
    },
  },
  {
    id: 'pyth',
    n: ['Pitágoras inverso', 'Pythagoras in reverse'],
    d: ['Da |R|, Rₓ y la dirección; pide Rᵧ y θ', 'Gives |R|, Rₓ and the direction; asks for Rᵧ and θ'],
    apply: (m) => {
      m.vecs.forEach((V) => (V.show = sh()));
      m.R.show = sh('d x dir', 'y ang');
      m.showPath = true;
    },
  },
  {
    id: 'time',
    n: ['¿Cuánto tardó?', 'How long did it take?'],
    d: [
      'Da la velocidad y R; pide el tiempo del último vector',
      'Gives the speed and R; asks for the last vector’s time',
    ],
    apply: (m) => lastKind(m, 'vel', 't'),
  },
  {
    id: 'speed',
    n: ['¿Qué velocidad?', 'What speed?'],
    d: [
      'Da el tiempo y R; pide la velocidad del último vector',
      'Gives the time and R; asks for the last vector’s speed',
    ],
    apply: (m) => lastKind(m, 'vel', 'v'),
  },
  {
    id: 'accel',
    n: ['¿Qué aceleración?', 'What acceleration?'],
    d: [
      'Da t, v₀ y R; pide la aceleración del último vector',
      'Gives t, v₀ and R; asks for the last vector’s acceleration',
    ],
    apply: (m) => lastKind(m, 'acc', 'a'),
  },
];

// PLANTILLAS DE LANZAMIENTO: deciden qué variables puede cambiar el jugador.
const TPL_PAR = [
  {
    id: 'free',
    n: ['Lanzamiento libre', 'Free launch'],
    d: ['v₀, θ y h₀ libres en rangos amplios', 'v₀, θ and h₀ free across wide ranges'],
    apply: (v) => VKEYS.forEach((k) => Object.assign(v[k], VAR_META[k].d, { locked: false })),
  },
  {
    id: 'onlyAng',
    n: ['Solo el ángulo', 'Angle only'],
    d: ['v₀ y h₀ fijas; el jugador elige θ', 'v₀ and h₀ fixed; the player picks θ'],
    apply: (v) => {
      v.v0.locked = true;
      v.h0.locked = true;
      Object.assign(v.ang, { min: 0, max: 85, step: 1, locked: false });
    },
  },
  {
    id: 'onlyV',
    n: ['Solo la velocidad', 'Speed only'],
    d: ['θ y h₀ fijos; el jugador elige v₀', 'θ and h₀ fixed; the player picks v₀'],
    apply: (v) => {
      v.ang.locked = true;
      v.h0.locked = true;
      Object.assign(v.v0, { min: 5, max: 45, step: 0.5, locked: false });
    },
  },
  {
    id: 'onlyH',
    n: ['Solo la altura', 'Height only'],
    d: ['v₀ y θ fijos; el jugador elige h₀', 'v₀ and θ fixed; the player picks h₀'],
    apply: (v) => {
      v.v0.locked = true;
      v.ang.locked = true;
      Object.assign(v.h0, { min: 0, max: 20, step: 0.5, locked: false });
    },
  },
  {
    id: 'horiz',
    n: ['Tiro horizontal', 'Horizontal launch'],
    d: [
      'θ = 0° desde una altura fija; el jugador elige v₀',
      'θ = 0° from a fixed height; the player picks v₀',
    ],
    apply: (v) => {
      Object.assign(v.ang, { def: 0, locked: true });
      Object.assign(v.h0, { def: Math.max(8, v.h0.def), locked: true });
      Object.assign(v.v0, { min: 2, max: 40, step: 0.5, locked: false });
    },
  },
  {
    id: 'ground',
    n: ['Desde el suelo', 'From the ground'],
    d: ['h₀ = 0 fija; el jugador elige v₀ y θ', 'h₀ = 0 fixed; the player picks v₀ and θ'],
    apply: (v) => {
      Object.assign(v.h0, { def: 0, locked: true });
      Object.assign(v.v0, { locked: false });
      Object.assign(v.ang, { min: 5, max: 85, locked: false });
    },
  },
  {
    id: 'precise',
    n: ['Precisión', 'Precision'],
    d: [
      'Rangos estrechos y pasos finos alrededor de los valores actuales',
      'Narrow ranges and fine steps around the current values',
    ],
    apply: (v) => {
      v.v0 = { ...v.v0, locked: false, min: r2(v.v0.def - 4), max: r2(v.v0.def + 4), step: 0.1 };
      v.ang = { ...v.ang, locked: false, min: r2(v.ang.def - 8), max: r2(v.ang.def + 8), step: 0.5 };
      v.h0.locked = true;
    },
  },
];

// PLANTILLAS MIXTAS: combinan una plantilla de vectores (vec) y una de lanzamiento (par).
const TPL_MIX = [
  {
    id: 'mx1',
    n: ['Encuentra y derriba', 'Find and knock down'],
    d: ['Encontrar R y lanzamiento libre', 'Find R and free launch'],
    vec: 'sumR',
    par: 'free',
  },
  {
    id: 'mx2',
    n: ['Componentes y puntería', 'Components and aim'],
    d: ['De componentes a polar; solo el ángulo al lanzar', 'Components to polar; angle only when launching'],
    vec: 'comp',
    par: 'onlyAng',
  },
  {
    id: 'mx3',
    n: ['Descompón y dispara', 'Break down and fire'],
    d: ['Descomponer R; solo la velocidad al lanzar', 'Break down R; speed only when launching'],
    vec: 'decomp',
    par: 'onlyV',
  },
  {
    id: 'mx4',
    n: ['Desde la torre', 'From the tower'],
    d: ['Encontrar R; tiro horizontal desde una altura', 'Find R; horizontal launch from a height'],
    vec: 'sumR',
    par: 'horiz',
  },
  {
    id: 'mx5',
    n: ['Cronómetro', 'Stopwatch'],
    d: ['¿Cuánto tardó?; lanzamiento desde el suelo', 'How long did it take?; launch from the ground'],
    vec: 'time',
    par: 'ground',
  },
];

// Nombre de una plantilla en el idioma actual.
const tplName = (t) => L(t.n[0], t.n[1]);

// Crea los botones de plantillas.
function buildTemplates() {
  const btn = (t, cls, group) =>
    `<button class="tpl ${cls}" type="button" data-g="${group}" data-t="${t.id}">${tplName(t)}<small>${L(t.d[0], t.d[1])}</small></button>`;
  $('tpl-vec').innerHTML = TPL_VEC.map((t) => btn(t, '', 'vec')).join('');
  $('tpl-par').innerHTML = TPL_PAR.map((t) => btn(t, 'par', 'par')).join('');
  $('tpl-mix').innerHTML = TPL_MIX.map((t) => btn(t, 'mix', 'mix')).join('');
  document.querySelectorAll('.tpl').forEach((b) => (b.onclick = () => applyTpl(b.dataset.g, b.dataset.t)));
}

// Muestra solo las plantillas que tienen sentido para el tipo de nivel.
function renderTemplates() {
  const t = E.draft.type;
  $('tplVec').hidden = t === 'clasico';
  $('tplMix').hidden = t !== 'mixto';
  $('tplPar').hidden = t === 'despl';
}

// Aplica una plantilla al nivel en edición.
function applyTpl(group, id) {
  const d = E.draft;
  pushHist();
  const vecT = (x) => TPL_VEC.find((t) => t.id === x),
    parT = (x) => TPL_PAR.find((t) => t.id === x);
  let t;
  if (group === 'vec') {
    t = vecT(id);
    t.apply(d.mov);
  }
  if (group === 'par') {
    t = parT(id);
    t.apply(d.vars);
  }
  if (group === 'mix') {
    t = TPL_MIX.find((x) => x.id === id);
    vecT(t.vec).apply(d.mov);
    parT(t.par).apply(d.vars);
  }
  d.vars = normVars(d.vars);
  if (d.mov) d.mov = normMov(d.mov, d.W);
  E.sel = null;
  refreshAll();
  const ok = !isMov(d) || (solvability(d.mov).ok && !movProblems(d));
  msg(
    L(
      `Plantilla “${tplName(t)}” aplicada. Ajusta los valores a tu gusto${ok ? '' : '; revisa el aviso en rojo o pulsa Arreglar'}. Deshacer la revierte.`,
      `Template “${tplName(t)}” applied. Adjust the values as you like${ok ? '' : '; check the red notice or press Fix'}. Undo reverts it.`,
    ),
    ok ? 'ok' : 'err',
  );
}
