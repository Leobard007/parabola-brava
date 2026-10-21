/* ======================================================================
   ARCHIVO: js/2-juego/nivel-y-hud.js

   CARGAR UN NIVEL Y LA BARRA DE INFORMACIÓN
   loadLevel() prepara un nivel para jugar. hud() actualiza las etiquetas que se ven
   sobre la escena (nivel, tiros, objetivos) y los puntos.
   ====================================================================== */

/* =========================================================
   MODO JUEGO
   ========================================================= */

// Carga un nivel y deja todo listo para jugar.
//   def: el nivel. opts.testing = true si se prueba desde el editor; opts.online = true en partidas online.
function loadLevel(def, opts = {}) {
  showView('game');
  S.def = def;
  S.testing = !!opts.testing;
  if (!S.testing && !opts.online && def.id) {
    prog.last = def.id;
    saveProg();
  }
  $('ovRetry').hidden = !!opts.online;
  S.objs = def.objs.map((o) => ({
    ...o,
    hp: o.k === 'stone' ? 2 : 1,
    alive: true,
    vy: 0,
    falling: false,
    fy: 0,
    blink: Math.random() * 4,
  }));
  S.terrain = def.terrain.slice();
  S.shotsLeft = def.shots;
  S.trails = [];
  S.parts = [];
  S.proj = null;
  S.mode = 'aim';
  S.practiceUsed = false;
  S.last = null;
  S.levelStart = S.score;
  S.phase = 'shoot';
  S.solved = false;
  S.res = null;
  S.ans = null;
  S.items = [];
  S.anim = null;
  S.mover = null;
  S.endTimer = 0;
  let extraTop = 0;
  if (isMov(def)) {
    const m = def.mov,
      a = analyze(m);
    S.res = a.r;
    S.phase = 'find';
    S.items = a.inc.map((k) => {
      const sk = splitKey(k);
      return { key: k, ...sk, truth: truthOf(a.r, sk.owner, sk.q) };
    });
    S.ans = { tries: m.tries, used: 0, solved: false, failed: false, stars: 0, bonus: 0, lastFb: '' };
    if (m.ay > 0.05) S.terrain.push({ x: m.ax - 0.8, w: 1.6, h: m.ay, pillar: true });
    const Tg = {
      k: 'target',
      x: m.ax - 0.6,
      y: m.ay,
      w: 1.2,
      h: 1.2,
      hp: 1,
      alive: true,
      vy: 0,
      falling: false,
      fy: 0,
      blink: Math.random() * 4,
      mover: true,
      fixed: true,
      hidden: false,
    };
    S.objs.push(Tg);
    S.mover = Tg;
    extraTop = Math.max(...S.res.pts.map((p) => p.y)) + 3;
    buildAnswerForm();
    $('ansFb').innerHTML = '';
    startAnim();
  }
  S.top = Math.max(
    def.type === 'despl' ? 5 : 14,
    extraTop,
    ...S.terrain.map((t) => t.h),
    ...def.objs.map((o) => o.y + o.h),
  );
  $('overlay').hidden = true;
  applyVars(def.vars);
  setScreen('play');
  renderFind();
  hud();
  tele();
  syncUI();
}

// Configura los controles del lanzador (deslizadores y casillas) con los límites del nivel.
function applyVars(v) {
  VKEYS.forEach((k) => {
    const c = v[k],
      r = $(k),
      n = $(k + 'n'),
      unit = VAR_META[k].unit;
    [r, n].forEach((el) => {
      el.min = c.min;
      el.max = c.max;
      el.step = c.step;
      el.disabled = c.locked;
    });
    r.value = c.def;
    n.value = c.def;
    P[k] = c.def;
    $(k + 'Lock').hidden = !c.locked;
    $(k + 'Hint').textContent = c.locked
      ? L(`El nivel la fija en ${c.def} ${unit}`, `The level fixes it at ${c.def} ${unit}`)
      : L(
          `Permitido: ${c.min} a ${c.max} ${unit} · paso ${c.step}`,
          `Allowed: ${c.min} to ${c.max} ${unit} · step ${c.step}`,
        );
  });
  renderGravOptions(v.g.def);
  g = v.g.def;
  $('gLabel').textContent = g.toFixed(2);
  $('gLock').hidden = !v.g.locked;
}

// Llena la lista desplegable de gravedades.
function renderGravOptions(val) {
  const sel = $('grav');
  sel.innerHTML = '';
  const list = GRAVS.map(([gv, n]) => [gv, gName(n)]);
  if (!list.some(([gv]) => Math.abs(gv - val) < 1e-6)) list.push([val, L('Del nivel', 'Level’s own')]);
  list.forEach(([gv, n]) => {
    const o = document.createElement('option');
    o.value = gv;
    o.textContent = `${n} · ${gv} m/s²`;
    sel.appendChild(o);
  });
  sel.value = String(list.find(([gv]) => Math.abs(gv - val) < 1e-6)[0]);
}

// Cuántos objetivos (cochinitos) quedan vivos.
function targetsLeft() {
  return S.objs.filter((o) => o.k === 'target' && o.alive).length;
}

// Actualiza las etiquetas de la parte superior de la escena (nivel, tiros, objetivos) y los puntos.
function hud() {
  if (VIEW !== 'game') return;
  if (S.screen === 'edit') {
    const d = E.draft;
    if (!d) return;
    $('hudTag').textContent = L('Editor', 'Editor');
    $('hudPhase').textContent = {
      clasico: '',
      despl: L('Desplazamiento', 'Displacement'),
      mixto: L('Mixto', 'Mixed'),
    }[d.type];
    $('hudLevel').textContent = d.name;
    $('hudShots').textContent =
      d.type === 'despl'
        ? ''
        : L(`${d.shots} tiro${d.shots > 1 ? 's' : ''}`, `${d.shots} shot${d.shots > 1 ? 's' : ''}`);
    const n = d.objs.filter((o) => o.k === 'target').length + (d.type === 'mixto' ? 1 : 0),
      nv = d.mov ? d.mov.vecs.length : 0;
    $('hudTargets').textContent =
      d.type === 'despl'
        ? L(`${nv} vector${nv > 1 ? 'es' : ''}`, `${nv} vector${nv > 1 ? 's' : ''}`)
        : L(`Objetivos: ${n}`, `Targets: ${n}`);
  } else {
    const d = S.def;
    if (!d) return;
    const c = campaignOf(d);
    $('hudTag').textContent = S.online ? 'Online' : S.testing ? L('Prueba', 'Test') : '';
    $('hudPhase').textContent =
      d.type === 'despl'
        ? S.solved
          ? L('Resuelto', 'Solved')
          : L('Encuentra las incógnitas', 'Find the unknowns')
        : d.type === 'mixto'
          ? S.phase === 'find'
            ? L('Fase 1 · Vectores', 'Phase 1 · Vectors')
            : L('Fase 2 · Lanza', 'Phase 2 · Launch')
          : '';
    $('hudLevel').textContent = S.online
      ? `${S.online.i + 1}/${S.online.list.length} · ${lvName(d)}`
      : c
        ? `${c.prefix}${c.i + 1} · ${lvName(d)}`
        : lvName(d);
    $('hudShots').textContent =
      d.type === 'despl'
        ? ''
        : d.shots >= 900
          ? L('Tiros: ∞', 'Shots: ∞')
          : '●'.repeat(Math.max(0, S.shotsLeft)) + '○'.repeat(Math.max(0, d.shots - S.shotsLeft));
    $('hudShots').setAttribute(
      'aria-label',
      L(`${S.shotsLeft} tiros restantes`, `${S.shotsLeft} shots left`),
    );
    $('hudTargets').textContent =
      S.phase === 'find' || d.type === 'despl'
        ? ''
        : L(`Objetivos: ${targetsLeft()}`, `Targets: ${targetsLeft()}`);
  }
  $('score').textContent = S.score.toLocaleString(SET.lang === 'en' ? 'en' : 'es');
}

// Actualiza los botones de la barra superior según el modo (juego, editor, prueba u online).
function updateGameBar() {
  const eb = $('editBtn'),
    et = $('editThis');
  eb.hidden = !!S.online;
  $('btnMenu').textContent = S.online ? L('Salir de la partida', 'Leave game') : L('← Menú', '← Menu');
  if (S.online) {
    et.hidden = true;
    return;
  }
  if (S.screen === 'edit') {
    eb.textContent = L('Salir del editor', 'Exit editor');
    et.hidden = true;
  } else if (S.testing) {
    eb.textContent = L('Volver al editor', 'Back to editor');
    et.hidden = true;
  } else {
    eb.textContent = L('Editor de niveles', 'Level editor');
    et.hidden = !S.def;
    if (S.def)
      et.textContent = customs.some((c) => c.id === S.def.id)
        ? L('Editar este nivel', 'Edit this level')
        : L('Copiar al editor', 'Copy to editor');
  }
}
