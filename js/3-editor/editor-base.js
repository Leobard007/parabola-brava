/* ======================================================================
   ARCHIVO: js/3-editor/editor-base.js

   EDITOR DE NIVELES: BASE
   Abrir y cerrar el editor, deshacer/rehacer, herramientas, campos del nivel
   (nombre, ancho, tiros, gravedad) y la tabla de variables del lanzamiento.
   ====================================================================== */

/* =========================================================
   MODO EDITOR
   ========================================================= */

// Texto de ayuda de cada herramienta del editor.
const toolHint = (t) =>
  ({
    select: L(
      'Haz clic en un vector, en R, en A, en el lanzador o en una pieza para abrir su tarjeta. Arrastra la punta de un vector para cambiar magnitud y ángulo (con Shift, de 15° en 15°), el rombo para girarlo y el cuerpo para mover toda la cadena. Arrastra B para cambiar R.',
      'Click a vector, R, A, the launcher or a piece to open its card. Drag a vector’s tip to change its length and angle (Shift: 15° steps), the diamond to rotate it and its body to move the whole chain. Drag B to change R.',
    ),
    start: L(
      'Haz clic para poner el punto A, donde empieza el cochinito. También puedes arrastrar A con Mover.',
      'Click to place point A, where the piglet starts. You can also drag A with Move.',
    ),
    wood: L(
      'Haz clic para colocar un bloque de madera. Se apoya sobre lo que haya debajo del clic.',
      'Click to place a wood block. It rests on whatever is below the click.',
    ),
    stone: L(
      'Haz clic para colocar un bloque de piedra. Aguanta un golpe lento y se rompe con impactos de 18 m/s o más.',
      'Click to place a stone block. It survives a slow hit and breaks at 18 m/s or more.',
    ),
    target: L(
      'Haz clic para colocar un objetivo. El nivel se gana al eliminarlos todos.',
      'Click to place a target. The level is won when they are all gone.',
    ),
    terrain: L(
      'Haz clic para crear terreno fijo: su altura es la del punto donde haces clic. El proyectil no lo rompe.',
      'Click to create solid terrain: its height is where you click. The projectile can’t break it.',
    ),
    erase: L(
      'Haz clic o arrastra sobre las piezas para borrarlas.',
      'Click or drag over pieces to erase them.',
    ),
  })[t];

// Crea un nivel en blanco del tipo indicado ('clasico', 'despl' o 'mixto').
function blankLevel(type) {
  const names = {
    clasico: L('Mi nivel', 'My level'),
    despl: L('Mi nivel de vectores', 'My vector level'),
    mixto: L('Mi nivel mixto', 'My mixed level'),
  };
  return normLevel({
    name: names[type],
    type,
    W: type === 'despl' ? 32 : 45,
    shots: 4,
    grid: type === 'clasico',
    terrain: [],
    objs: [],
    vars: defaultVars(),
    mov:
      type !== 'clasico'
        ? {
            ax: 8,
            ay: 0,
            vecs: [
              { d: 10, ang: 30, dir: 'ur' },
              { d: 6, dir: 'u' },
            ],
          }
        : null,
  });
}

// Qué vector se ajusta cuando el usuario cambia R directamente (por defecto, el último).
const adjIndex = (m) => (m.adj != null && m.adj < m.vecs.length ? m.adj : m.vecs.length - 1);

/* --- historial: deshacer y rehacer --- */
// Guarda una copia del nivel en el historial ANTES de un cambio, para poder deshacerlo.
function pushHist() {
  E.hist.push(JSON.stringify(E.draft));
  if (E.hist.length > 80) E.hist.shift();
  E.future = [];
  updUndo();
}

// Activa o desactiva los botones Deshacer / Rehacer.
function updUndo() {
  $('ed-undo').disabled = !E.hist.length;
  $('ed-redo').disabled = !E.future.length;
}

// Quita la selección si el elemento seleccionado ya no existe.
function fixSel() {
  const s = E.sel,
    d = E.draft;
  if (!s) return;
  if (
    (s.type === 'vec' && (!isMov(d) || s.i >= d.mov.vecs.length)) ||
    ((s.type === 'R' || s.type === 'A') && !isMov(d)) ||
    s.ref ||
    (s.type === 'launcher' && d.type === 'despl')
  )
    E.sel = null;
}

// Deshacer el último cambio.
function undo() {
  if (!E.hist.length) return;
  E.future.push(JSON.stringify(E.draft));
  E.draft = JSON.parse(E.hist.pop());
  fixSel();
  refreshAll();
  updUndo();
  msg(L('Cambio deshecho.', 'Change undone.'));
}

// Rehacer el cambio deshecho.
function redo() {
  if (!E.future.length) return;
  E.hist.push(JSON.stringify(E.draft));
  E.draft = JSON.parse(E.future.pop());
  fixSel();
  refreshAll();
  updUndo();
  msg(L('Cambio rehecho.', 'Change redone.'));
}
$('ed-undo').onclick = undo;
$('ed-redo').onclick = redo;

// Cambia entre el modo juego ('play') y el modo editor ('edit').
function setScreen(sc) {
  S.screen = sc;
  $('playUI').hidden = sc !== 'play';
  $('editUI').hidden = sc !== 'edit';
  $('stage').classList.toggle('editing', sc === 'edit');
  if (sc === 'edit') {
    $('overlay').hidden = true;
    S.parts = [];
  }
  cv.style.cursor = 'default';
  updateGameBar();
  hud();
  renderPop();
}

// Abre el editor. Si se pasa un nivel, lo abre (si es de una campaña, abre una copia).
function openEditor(def) {
  showView('game');
  if (def) {
    E.draft = normLevel(clone(def));
    const isCustom = customs.some((c) => c.id === def.id);
    E.editingId = isCustom ? def.id : null;
    if (!isCustom) {
      E.draft.id = null;
      E.draft.name = (lvName(def) + L(' (copia)', ' (copy)')).slice(0, 40);
    }
    E.hist = [];
    E.future = [];
  } else if (!E.draft) {
    E.draft = blankLevel('clasico');
    E.editingId = null;
    E.hist = [];
    E.future = [];
  }
  E.sel = null;
  E.drag = null;
  setScreen('edit');
  fillEditor();
}

// Vuelve al editor después de probar un nivel.
function backToEditor() {
  setScreen('edit');
  fillEditor();
}

$('editBtn').onclick = () => {
  if (S.screen === 'edit') {
    if (S.def && !S.testing) {
      S.score = S.levelStart;
      loadLevel(S.def);
    } else showView('select');
  } else if (S.testing) backToEditor();
  else openEditor(null);
};
$('editThis').onclick = () => openEditor(S.def);

// Cambia el tipo del nivel en edición (lanzamiento, desplazamiento o mixto).
function setType(t) {
  const d = E.draft;
  if (d.type === t) return;
  pushHist();
  const was = d.type;
  d.type = t;
  if (t !== 'clasico' && !d.mov)
    d.mov = normMov(
      {
        ax: Math.round(d.W * 0.3),
        vecs: [
          { d: 10, ang: 30, dir: 'ur' },
          { d: 6, dir: 'u' },
        ],
      },
      d.W,
    );
  if (was === 'clasico' && t !== 'clasico') d.grid = false;
  if (t === 'clasico' && E.tool === 'start') setTool('select');
  if (t === 'despl' && E.tool !== 'select' && E.tool !== 'start') setTool('select');
  E.sel = null;
  fillEditor();
  msg(
    {
      clasico: L('Este nivel ahora es de lanzamiento.', 'This level is now a launch level.'),
      despl: L(
        'Este nivel ahora es de desplazamiento: solo se resuelven los vectores, sin lanzamiento.',
        'This level is now a displacement level: only the vectors are solved, with no launch.',
      ),
      mixto: L(
        'Este nivel ahora es mixto: primero se resuelven los vectores y después se lanza al cochinito.',
        'This level is now mixed: first the vectors are solved, then the piglet is launched at.',
      ),
    }[t],
  );
}
$('tabC').onclick = () => setType('clasico');
$('tabD').onclick = () => setType('despl');
$('tabM').onclick = () => setType('mixto');
$('ed-gridview').addEventListener('change', (e) => {
  E.showGrid = e.target.checked;
});
$('ed-snap').addEventListener('change', (e) => {
  E.snapRound = e.target.checked;
  msg(
    e.target.checked
      ? L(
          'Valores redondos: al arrastrar, las puntas se ajustan a metros enteros y prefieren triángulos exactos como 3-4-5.',
          'Round values: when dragging, tips snap to whole meters and prefer exact triangles like 3-4-5.',
        )
      : L(
          'Valores redondos desactivado: al arrastrar se ajusta a 0.5 m y 1°.',
          'Round values off: dragging snaps to 0.5 m and 1°.',
        ),
  );
});

document.querySelectorAll('.tool').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));

// Selecciona una herramienta del editor (mover, madera, piedra, objetivo...).
function setTool(t) {
  E.tool = t;
  document
    .querySelectorAll('.tool')
    .forEach((b) => b.setAttribute('aria-pressed', b.dataset.tool === t ? 'true' : 'false'));
  $('toolHint').textContent = toolHint(t);
}

// Muestra un mensaje en el editor (kind: 'ok' verde, 'err' rojo).
function msg(text, kind) {
  const m = $('ed-msg');
  m.textContent = text;
  m.className = 'msg' + (kind ? ' ' + kind : '');
}

/* --- refresco: reconstruye la interfaz sin perder el campo con foco --- */
// Reconstruye parte de la interfaz sin que el usuario pierda la casilla en la que estaba escribiendo.
function preserveFocus(fn) {
  const a = document.activeElement,
    id = a && a.id;
  fn();
  if (id) {
    const el = document.getElementById(id);
    if (el && el !== document.activeElement)
      try {
        el.focus();
      } catch (e) {}
  }
}

// Vuelve a dibujar todo el panel del editor.
function refreshAll() {
  preserveFocus(fillEditor);
}

// Vuelve a dibujar solo las partes de los vectores (más rápido).
function refreshMov() {
  const d = E.draft;
  if (!isMov(d)) {
    refreshAll();
    return;
  }
  d.mov = normMov(d.mov, d.W);
  preserveFocus(() => {
    fillMovFields();
    buildSmart();
    buildAdvanced();
    movStatus();
    renderPop();
    hud();
  });
}

// Lista desplegable de gravedades del editor.
function edGravOptions() {
  const sel = $('ed-g-sel'),
    v = sel.value;
  sel.innerHTML =
    GRAVS.map(([gv, n]) => `<option value="${gv}">${gName(n)} · ${gv}</option>`).join('') +
    `<option value="custom">${L('Personalizada', 'Custom')}</option>`;
  sel.value = v || '9.81';
}

// Llena todos los campos del editor con los datos del nivel en edición.
function fillEditor() {
  const d = E.draft;
  if (!d) return;
  const mv = isMov(d),
    pure = d.type === 'despl';
  if (mv) d.mov = normMov(d.mov, d.W);
  $('tabC').setAttribute('aria-selected', String(d.type === 'clasico'));
  $('tabD').setAttribute('aria-selected', String(d.type === 'despl'));
  $('tabM').setAttribute('aria-selected', String(d.type === 'mixto'));
  document.querySelector('.tool[data-tool=start]').hidden = !mv;
  document.querySelectorAll('.tool.piece').forEach((b) => (b.hidden = pure));
  if (pure && !['select', 'start'].includes(E.tool)) setTool('select');
  $('toolHint').textContent = toolHint(E.tool);
  document.querySelectorAll('.shootOnly').forEach((el) => (el.hidden = pure));
  $('ed-clear').hidden = pure;
  $('movPanel').hidden = !mv;
  $('ed-name').value = d.name;
  $('ed-W').value = d.W;
  $('ed-shots').value = d.shots;
  edGravOptions();
  const gv = d.vars.g.def,
    known = GRAVS.find(([x]) => Math.abs(x - gv) < 1e-6);
  $('ed-g-sel').value = known ? String(known[0]) : 'custom';
  $('ed-g').value = gv;
  if (!pure) $('ed-g-wrap').hidden = !!known;
  $('ed-g-lock').checked = d.vars.g.locked;
  $('ed-grid').checked = d.grid;
  $('ed-grid-label').textContent = mv
    ? L(
        'El jugador ve la cuadrícula antes de resolver (al resolver siempre aparece)',
        'The player sees the grid before solving (it always appears once solved)',
      )
    : L('El jugador ve la cuadrícula', 'The player sees the grid');
  buildVarTable();
  if (mv) {
    fillMovFields();
    buildSmart();
    buildAdvanced();
    movStatus();
  }
  buildTemplates();
  renderTemplates();
  updateCounts();
  updateSaveButtons();
  fillOpenList();
  hud();
  renderPop();
  updUndo();
}

// Textos y visibilidad de los botones Guardar / Guardar como / Eliminar.
function updateSaveButtons() {
  $('ed-save').textContent = E.editingId
    ? L('Guardar cambios', 'Save changes')
    : L('Guardar en mis niveles', 'Save to my levels');
  $('ed-saveas').hidden = !E.editingId;
  $('ed-del').hidden = !E.editingId;
}

// Contador de piezas del nivel.
function updateCounts() {
  const d = E.draft,
    c = (k) => d.objs.filter((o) => o.k === k).length;
  $('edCounts').innerHTML =
    d.type === 'despl'
      ? ''
      : `<span>${L('Objetivos', 'Targets')} <b>${c('target')}</b></span><span>${L('Madera', 'Wood')} <b>${c('wood')}</b></span>` +
        `<span>${L('Piedra', 'Stone')} <b>${c('stone')}</b></span><span>${L('Terreno', 'Terrain')} <b>${d.terrain.length}</b></span>`;
}

// Llena la lista "Abrir un nivel existente".
function fillOpenList() {
  const sel = $('ed-open');
  sel.innerHTML = '';
  [
    [L('Lanzamiento', 'Launch'), CAMPAIGN, ''],
    [L('Desplazamiento', 'Displacement'), CAMPAIGN_D, 'D'],
    [L('Mixta', 'Mixed'), CAMPAIGN_M, 'M'],
  ].forEach(([label, list, prefix]) => {
    const og = document.createElement('optgroup');
    og.label = label + L(' (se abre una copia)', ' (opens a copy)');
    list.forEach((Lv, i) => {
      const o = document.createElement('option');
      o.value = 'c:' + Lv.id;
      o.textContent = `${prefix}${i + 1}. ${lvName(Lv)}`;
      og.appendChild(o);
    });
    sel.appendChild(og);
  });
  if (customs.length) {
    const og = document.createElement('optgroup');
    og.label = L('Mis niveles', 'My levels');
    customs.forEach((Lv) => {
      const o = document.createElement('option');
      o.value = 'u:' + Lv.id;
      o.textContent = { clasico: '', despl: 'D · ', mixto: 'M · ' }[Lv.type] + Lv.name;
      og.appendChild(o);
    });
    sel.appendChild(og);
  }
}

/* --- ajustes del nivel --- */
$('ed-name').addEventListener('change', (e) => {
  pushHist();
  E.draft.name = e.target.value.slice(0, 40) || L('Nivel sin nombre', 'Untitled level');
  hud();
});
$('ed-W').addEventListener('change', (e) => {
  pushHist();
  const d = E.draft;
  d.W = r2(clamp(num(e.target.value, d.W), 20, 150));
  e.target.value = d.W;
  d.objs.forEach((o) => (o.x = clamp(o.x, LAUNCH_CLEAR, Math.max(LAUNCH_CLEAR, d.W - o.w))));
  d.terrain.forEach((t) => (t.x = clamp(t.x, LAUNCH_CLEAR, Math.max(LAUNCH_CLEAR, d.W - t.w))));
  if (d.mov) d.mov = normMov(d.mov, d.W);
  settleDraft();
  refreshAll();
});
$('ed-shots').addEventListener('change', (e) => {
  pushHist();
  E.draft.shots = Math.round(clamp(num(e.target.value, 4), 1, 10));
  e.target.value = E.draft.shots;
  hud();
});
$('ed-g-sel').addEventListener('change', (e) => {
  if (e.target.value === 'custom') {
    $('ed-g-wrap').hidden = false;
    $('ed-g').focus();
    return;
  }
  pushHist();
  E.draft.vars.g.def = +e.target.value;
  $('ed-g').value = e.target.value;
  $('ed-g-wrap').hidden = true;
});
$('ed-g').addEventListener('change', (e) => {
  pushHist();
  E.draft.vars.g.def = r2(clamp(num(e.target.value, 9.81), 0.1, 50));
  e.target.value = E.draft.vars.g.def;
});
$('ed-g-lock').addEventListener('change', (e) => {
  pushHist();
  E.draft.vars.g.locked = e.target.checked;
});
$('ed-grid').addEventListener('change', (e) => {
  pushHist();
  E.draft.grid = e.target.checked;
});

/* --- variables del lanzamiento --- */
// Crea la tabla de variables del lanzamiento (valor inicial, mínimo, máximo, paso, fija).
function buildVarTable() {
  const tb = $('edVars');
  tb.innerHTML = '';
  VKEYS.forEach((k) => {
    const m = VAR_META[k],
      lab = varLabel(k);
    const tr = document.createElement('tr');
    tr.id = `ed-${k}-row`;
    tr.innerHTML = `<th scope="row">${lab}<small>${m.unit} · ${L('entre', 'between')} ${m.lo} ${L('y', 'and')} ${m.hi}</small></th>
      <td><input type="number" id="ed-${k}-def" step="any" aria-label="${lab}: ${L('valor inicial', 'starting value')}"></td>
      <td class="rng"><input type="number" id="ed-${k}-min" step="any" aria-label="${lab}: ${L('mínimo', 'minimum')}"></td>
      <td class="rng"><input type="number" id="ed-${k}-max" step="any" aria-label="${lab}: ${L('máximo', 'maximum')}"></td>
      <td class="rng"><input type="number" id="ed-${k}-step" step="any" min="0.01" aria-label="${lab}: ${L('paso', 'step')}"></td>
      <td><label class="check"><input type="checkbox" id="ed-${k}-lock"> ${L('Fija', 'Fixed')}</label></td>`;
    tb.appendChild(tr);
  });
  tb.querySelectorAll('input').forEach((inp) => inp.addEventListener('change', readVarTable));
  refreshVarTable();
}

// Actualiza los valores de la tabla de variables.
function refreshVarTable() {
  VKEYS.forEach((k) => {
    const c = E.draft.vars[k];
    $(`ed-${k}-def`).value = c.def;
    $(`ed-${k}-min`).value = c.min;
    $(`ed-${k}-max`).value = c.max;
    $(`ed-${k}-step`).value = c.step;
    $(`ed-${k}-lock`).checked = c.locked;
    ['min', 'max', 'step'].forEach((p) => ($(`ed-${k}-${p}`).disabled = c.locked));
    $(`ed-${k}-row`).classList.toggle('locked', c.locked);
  });
}

// Lee la tabla de variables cuando el usuario cambia algo y lo guarda en el nivel.
function readVarTable() {
  pushHist();
  const v = { g: E.draft.vars.g };
  VKEYS.forEach(
    (k) =>
      (v[k] = {
        def: $(`ed-${k}-def`).value,
        min: $(`ed-${k}-min`).value,
        max: $(`ed-${k}-max`).value,
        step: $(`ed-${k}-step`).value,
        locked: $(`ed-${k}-lock`).checked,
      }),
  );
  E.draft.vars = normVars(v);
  refreshVarTable();
  renderPop();
  const adj = VKEYS.some((k) =>
    ['def', 'min', 'max', 'step'].some((p) => num(v[k][p], NaN) !== E.draft.vars[k][p]),
  );
  if (adj)
    msg(
      L(
        'Ajusté algún valor para que el inicial quede entre el mínimo y el máximo, dentro de los límites de cada variable.',
        'I adjusted a value so the starting value sits between the minimum and maximum, within each variable’s limits.',
      ),
    );
}
