/* ======================================================================
   ARCHIVO: js/1-nucleo/guardado-y-estado.js

   GUARDADO Y ESTADO
     - prog: progreso del jugador (estrellas y niveles desbloqueados).
     - customs: niveles creados en el editor ("Mis niveles").
   Ambos se guardan en el localStorage del navegador (un pequeño almacén que conserva
   datos aunque cierres la página).
   También define S (estado del juego), E (estado del editor) y VIEW (pantalla visible).
   ====================================================================== */

/* ---------- almacenamiento ---------- */
// Progreso vacío (todo bloqueado excepto el primer nivel de cada campaña).
const freshProg = () => ({ unlocked: 1, unlockedD: 1, unlockedM: 1, stars: {}, last: null, v: 3 });

// Progreso del jugador: niveles desbloqueados y estrellas. Se lee del navegador (localStorage) al abrir el juego.
let prog = freshProg();
try {
  const s = JSON.parse(localStorage.getItem('parabola-brava') || 'null');
  if (s && s.unlocked) {
    prog.unlocked = s.unlocked;
    prog.unlockedD = s.unlockedD || 1;
    prog.unlockedM = s.unlockedM || 1;
    prog.last = s.last || null;
    if (s.v !== 3) {
      prog.unlockedM = Math.max(prog.unlockedM, s.unlockedD || 1);
      prog.unlockedD = 1;
    }
    if (Array.isArray(s.stars))
      s.stars.forEach((v, i) => {
        if (v) prog.stars['c' + (i + 1)] = v;
      });
    else if (s.stars && typeof s.stars === 'object') {
      prog.stars = s.stars;
      if (s.v !== 3)
        ['d1', 'd2', 'd3', 'd4'].forEach((k, i) => {
          if (s.stars[k]) prog.stars['m' + (i + 1)] = s.stars[k];
          delete prog.stars[k];
        });
    }
  }
} catch (e) {}
prog.v = 3;

// Los niveles creados por el usuario en el editor ("Mis niveles").
let customs = [];
try {
  const a = JSON.parse(localStorage.getItem('parabola-brava-custom') || '[]');
  if (Array.isArray(a))
    customs = a.map(normLevel).map((l) => {
      if (!l.id) l.id = newId();
      return l;
    });
} catch (e) {}

// Guarda el progreso en el navegador.
function saveProg() {
  try {
    localStorage.setItem('parabola-brava', JSON.stringify(prog));
  } catch (e) {}
}

// Guarda "Mis niveles" en el navegador. Devuelve false si el navegador no lo permite.
function saveCustoms() {
  try {
    localStorage.setItem('parabola-brava-custom', JSON.stringify(customs));
    return true;
  } catch (e) {
    return false;
  }
}

// Busca un nivel por su id en todas las campañas y en Mis niveles.
function findLevel(id) {
  return [...CAMPAIGN, ...CAMPAIGN_D, ...CAMPAIGN_M, ...customs].find((l) => l.id === id) || null;
}

/* ---------- estado ---------- */
// S = ESTADO DEL JUEGO mientras juegas: nivel actual (def), piezas (objs), tiros restantes, puntos,
// proyectil en vuelo (proj), fase ('find' = resolver vectores, 'shoot' = lanzar), etc.
const S = {
  def: null,
  objs: [],
  terrain: [],
  shotsLeft: 0,
  score: 0,
  levelStart: 0,
  mode: 'aim',
  proj: null,
  trails: [],
  parts: [],
  practiceUsed: false,
  last: null,
  top: 14,
  time: 0,
  screen: 'play',
  testing: false,
  next: null,
  phase: 'shoot',
  solved: false,
  res: null,
  ans: null,
  items: [],
  anim: null,
  mover: null,
  endTimer: 0,
};

// E = ESTADO DEL EDITOR: nivel en edición (draft), herramienta, selección, historial para deshacer, etc.
const E = {
  draft: null,
  tool: 'select',
  sel: null,
  drag: null,
  editingId: null,
  pointer: null,
  lastSize: { wood: [1, 2], stone: [1, 2] },
  confirm: null,
  showGrid: true,
  hist: [],
  future: [],
  snapRound: false,
  dirty: false,
};

// Pantalla visible: 'home' (inicio), 'select' (elegir nivel), 'game' (juego/editor) u 'online'.
let VIEW = 'home'; // home · select · game
