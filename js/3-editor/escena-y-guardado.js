/* ======================================================================
   ARCHIVO: js/3-editor/escena-y-guardado.js

   EDITOR: EDICIÓN CON EL RATÓN Y GUARDADO
   Arrastrar vectores, el punto B, el punto A, el lanzador y las piezas directamente en la escena.
   Al final: probar, guardar en "Mis niveles", abrir niveles y compartir por código.
   ====================================================================== */

/* =========================================================
   EDICIÓN DIRECTA EN LA ESCENA
   ========================================================= */

// Convierte la posición del ratón (píxeles) a metros del mundo del juego.
function toWorld(e) {
  const r = cv.getBoundingClientRect(),
    px = e.clientX - r.left,
    py = e.clientY - r.top;
  return { x: px / V.s + V.x0, y: (ch - py) / V.s + V.y0, px, py };
}

// Distancia de un punto a un segmento (para saber si el ratón está sobre un vector).
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay,
    Lq = dx * dx + dy * dy;
  const t = Lq ? clamp(((px - ax) * dx + (py - ay) * dy) / Lq, 0, 1) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

// Posición de la punta de la flecha del lanzador.
function launcherTip(v) {
  const ox = X(0),
    oy = Y(v.h0.def),
    th = (v.ang.def * Math.PI) / 180,
    k = 0.13;
  return { ox, oy, x: ox + v.v0.def * Math.cos(th) * k * V.s, y: oy - v.v0.def * Math.sin(th) * k * V.s };
}

// ¿Qué elemento del editor está bajo el cursor? (punta de vector, R, A, lanzador...).
function editorHit(w, tol) {
  const d = E.draft;
  if (isMov(d)) {
    const m = d.mov,
      r = resultant(m),
      pts = r.pts,
      Bp = pts[pts.length - 1];
    if (Math.hypot(w.px - X(Bp.x), w.py - Y(Bp.y)) < tol + 2) return { kind: 'B' };
    if (E.sel && E.sel.type === 'vec' && pts[E.sel.i + 1]) {
      const i = E.sel.i,
        a = pts[i],
        b = pts[i + 1];
      if (Math.hypot(w.px - X(a.x + (b.x - a.x) * 0.62), w.py - Y(a.y + (b.y - a.y) * 0.62)) < tol)
        return { kind: 'rot', i };
    }
    for (let i = 0; i < pts.length - 2; i++) {
      const p = pts[i + 1];
      if (Math.hypot(w.px - X(p.x), w.py - Y(p.y)) < tol) return { kind: 'tip', i };
    }
    if (nearStart(w)) return { kind: 'A' };
    for (let i = 0; i < pts.length - 1; i++)
      if (segDist(w.px, w.py, X(pts[i].x), Y(pts[i].y), X(pts[i + 1].x), Y(pts[i + 1].y)) < tol - 2)
        return { kind: 'body', i };
    if (segDist(w.px, w.py, X(m.ax), Y(m.ay), X(Bp.x), Y(Bp.y)) < tol - 2) return { kind: 'Rbody' };
  }
  if (d.type !== 'despl') {
    const v = d.vars,
      lt = launcherTip(v);
    if (Math.hypot(w.px - lt.x, w.py - lt.y) < tol) return { kind: 'lv' };
    if (Math.hypot(w.px - X(-0.6), w.py - lt.oy) < tol) return { kind: 'lh' };
    if (w.x > -0.8 && w.x < 0.8 && w.y > -0.2 && w.y < v.h0.def + 1.2) return { kind: 'lbody' };
  }
  return null;
}

// Redondea un ángulo: a 1° normalmente o a 15° si se mantiene Shift.
const snapAng = (a, shift) => (shift ? Math.round(a / 15) * 15 : Math.round(a));

// Ajusta la punta de un vector a valores "redondos" mientras se arrastra.
function snapVecXY(dx, dy, shift) {
  if (E.snapRound && !shift) {
    let best = null;
    const bx = Math.round(dx),
      by = Math.round(dy);
    for (let ix = bx - 1; ix <= bx + 1; ix++)
      for (let iy = by - 1; iy <= by + 1; iy++) {
        const h = Math.hypot(ix, iy);
        if (h < 0.5) continue;
        const exact = ix !== 0 && iy !== 0 && Math.abs(h - Math.round(h)) < 1e-9;
        const score = Math.hypot(ix - dx, iy - dy) - (exact ? 0.9 : 0);
        if (!best || score < best.score) best = { x: ix, y: iy, score };
      }
    return best || { x: bx, y: by };
  }
  const len = Math.max(0.5, Math.round(Math.hypot(dx, dy) * 2) / 2);
  const a = (snapAng((Math.atan2(dy, dx) * 180) / Math.PI, shift) * Math.PI) / 180;
  return { x: len * Math.cos(a), y: len * Math.sin(a) };
}

// Qué se selecciona según la parte del elemento que se toca.
const SEL_OF = {
  tip: 'vec',
  rot: 'vec',
  body: 'vec',
  B: 'R',
  Rbody: 'R',
  A: 'A',
  lv: 'launcher',
  lh: 'launcher',
  lbody: 'launcher',
};
cv.addEventListener('pointerdown', (e) => {
  if (VIEW !== 'game' || S.screen !== 'edit') return;
  const w = toWorld(e);
  E.pointer = w;
  try {
    cv.setPointerCapture(e.pointerId);
  } catch (err) {}
  const d = E.draft,
    t = E.tool,
    tol = e.pointerType === 'touch' ? 20 : 11;
  if (t === 'select') {
    if (E.sel && E.sel.ref && E.sel.ref.k !== 'target') {
      const h = handlePos(E.sel);
      if (Math.hypot(w.px - h.x, w.py - h.y) < tol) {
        E.drag = { mode: 'resize', pushed: false };
        return;
      }
    }
    const hit = editorHit(w, tol);
    if (hit) {
      const st = SEL_OF[hit.kind];
      E.sel = st === 'vec' ? { type: 'vec', i: hit.i } : { type: st };
      E.drag = {
        mode: hit.kind,
        i: hit.i,
        gx: isMov(d) ? w.x - d.mov.ax : 0,
        gy: isMov(d) ? w.y - d.mov.ay : 0,
        pushed: false,
      };
      renderPop();
      if (isMov(d)) buildSmart();
      return;
    }
    const ph = hitTest(w);
    E.sel = ph;
    if (ph) E.drag = { mode: 'move', dx: w.x - ph.ref.x, dy: w.y - (ph.ref.y || 0), pushed: false };
    renderPop();
    if (isMov(d)) buildSmart();
  } else if (t === 'start') {
    pushHist();
    moveStart({ x: w.x, y: w.y + 0.6 });
    E.drag = { mode: 'startTool', pushed: true };
    E.dirty = true;
  } else if (t === 'erase') {
    E.drag = { mode: 'erase', pushed: false };
    const hit = hitTest(w);
    if (hit) {
      pushHist();
      E.drag.pushed = true;
      removeItem(hit);
    }
  } else {
    pushHist();
    E.sel = placeAt(w, t);
    renderPop();
    hud();
  }
});
cv.addEventListener('pointermove', (e) => {
  if (VIEW !== 'game' || S.screen !== 'edit') return;
  const w = toWorld(e);
  E.pointer = w;
  const d = E.draft,
    dr = E.drag,
    m = d.mov;
  if (dr) {
    const first = () => {
      if (!dr.pushed) {
        pushHist();
        dr.pushed = true;
      }
    };
    switch (dr.mode) {
      case 'tip': {
        first();
        const a = resultant(m).pts[dr.i],
          s = snapVecXY(w.x - a.x, w.y - a.y, e.shiftKey);
        setVecXY(dr.i, s.x, s.y);
        break;
      }
      case 'rot': {
        first();
        const r = resultant(m),
          a = r.pts[dr.i],
          len = r.vals[dr.i].d;
        const ang = (snapAng((Math.atan2(w.y - a.y, w.x - a.x) * 180) / Math.PI, e.shiftKey) * Math.PI) / 180;
        setVecXY(dr.i, len * Math.cos(ang), len * Math.sin(ang));
        break;
      }
      case 'B': {
        first();
        const s = snapVecXY(w.x - m.ax, w.y - m.ay, e.shiftKey);
        setRXY(s.x, s.y);
        break;
      }
      case 'body':
      case 'A':
      case 'Rbody':
        first();
        m.ax = r2(clamp(snap(w.x - dr.gx, 0.5), LAUNCH_CLEAR + 0.6, d.W - 0.6));
        m.ay = r2(clamp(snap(w.y - dr.gy, 0.5), 0, 30));
        break;
      case 'startTool':
        moveStart({ x: w.x, y: w.y + 0.6 });
        break;
      case 'lv': {
        first();
        const lt = launcherTip(d.vars),
          k = 0.13 * V.s,
          vx = (w.px - lt.ox) / k,
          vy = (lt.oy - w.py) / k;
        d.vars.v0.def = Math.round(Math.hypot(vx, vy) * 2) / 2;
        d.vars.ang.def = snapAng((Math.atan2(vy, vx) * 180) / Math.PI, e.shiftKey);
        d.vars = normVars(d.vars);
        break;
      }
      case 'lh':
        first();
        d.vars.h0.def = Math.max(0, snap(w.y, 0.5));
        d.vars = normVars(d.vars);
        break;
      case 'move':
        if (E.sel && E.sel.ref) {
          first();
          const o = E.sel.ref;
          o.x = r2(clamp(snap(w.x - dr.dx, 0.25), LAUNCH_CLEAR, Math.max(LAUNCH_CLEAR, d.W - o.w)));
          if (E.sel.type === 'obj') o.y = Math.max(0, w.y - dr.dy);
          liveSelValues();
        }
        break;
      case 'resize':
        if (E.sel && E.sel.ref) {
          first();
          const o = E.sel.ref,
            isT = E.sel.type === 'terrain';
          o.w = r2(clamp(snap(w.x - o.x, 0.25), isT ? 0.5 : 0.25, Math.min(isT ? 60 : 20, d.W - o.x)));
          o.h = r2(clamp(snap(w.y - (isT ? 0 : o.y), 0.25), isT ? 0.5 : 0.25, isT ? 40 : 20));
          if (!isT) E.lastSize[o.k] = [o.w, o.h];
          liveSelValues();
        }
        break;
      case 'erase': {
        const hit = hitTest(w);
        if (hit) {
          first();
          removeItem(hit);
        }
        break;
      }
    }
    if (!['move', 'resize', 'erase'].includes(dr.mode)) E.dirty = true;
  }
  let cur = 'crosshair';
  if (E.tool === 'select') {
    cur = 'default';
    if (E.sel && E.sel.ref && E.sel.ref.k !== 'target') {
      const h = handlePos(E.sel);
      if (Math.hypot(w.px - h.x, w.py - h.y) < 11) cur = 'nwse-resize';
    }
    if (cur === 'default') {
      const h = editorHit(w, 11);
      if (h)
        cur = dr
          ? 'grabbing'
          : { tip: 'crosshair', B: 'crosshair', lv: 'crosshair', rot: 'alias', lh: 'ns-resize' }[h.kind] ||
            'grab';
      else if (hitTest(w)) cur = dr ? 'grabbing' : 'grab';
    }
  }
  cv.style.cursor = cur;
});

// Termina un arrastre.
function endDrag() {
  const dr = E.drag;
  if (!dr) return;
  E.drag = null;
  settleDraft();
  if (dr.pushed) {
    if (dr.mode === 'lv' || dr.mode === 'lh') refreshVarTable();
    if (isMov(E.draft)) refreshMov();
  }
  renderPop();
  hud();
  updateCounts();
}
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);
cv.addEventListener('pointerleave', () => {
  if (!E.drag) E.pointer = null;
});

// Atajos de teclado del editor: Ctrl+Z, Ctrl+Y, Supr, Escape.
function editorKey(e) {
  const typing = /INPUT|SELECT|TEXTAREA/.test(e.target.tagName),
    mod = e.ctrlKey || e.metaKey;
  if (mod && !typing && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
    return;
  }
  if (mod && !typing && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    redo();
    return;
  }
  if (e.key === 'Escape' && E.sel) {
    E.sel = null;
    renderPop();
    if (isMov(E.draft)) buildSmart();
    return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && E.sel) {
    e.preventDefault();
    if (E.sel.ref) {
      pushHist();
      removeItem(E.sel);
    } else if (E.sel.type === 'vec') removeVec(E.sel.i);
  }
}

/* --- probar, guardar, abrir, compartir --- */
// Revisa que el nivel se pueda probar o guardar (tiene objetivos, tiene solución...).
function validDraft() {
  const d = E.draft;
  if (isMov(d)) {
    const p = movProblems(d);
    if (p) {
      msg(p + L(' Pulsa Arreglar en Variables del problema.', ' Press Fix in Problem variables.'), 'err');
      return false;
    }
    const sv = solvability(d.mov);
    if (!sv.ok) {
      msg(
        sv.text + L(' Pulsa Arreglar en Variables del problema.', ' Press Fix in Problem variables.'),
        'err',
      );
      return false;
    }
  } else if (!d.objs.some((o) => o.k === 'target')) {
    msg(
      L(
        'Coloca al menos un objetivo antes de probar o guardar el nivel.',
        'Place at least one target before testing or saving the level.',
      ),
      'err',
    );
    return false;
  }
  return true;
}

// Copia limpia del nivel para guardarla.
function cleanDef() {
  settleDraft();
  const def = normLevel(clone(E.draft));
  if (def.type === 'clasico') def.mov = null;
  if (def.type === 'despl') {
    def.objs = [];
    def.terrain = [];
  }
  return def;
}
$('ed-test').onclick = () => {
  if (!validDraft()) return;
  const def = cleanDef();
  def.id = '__test';
  E.sel = null;
  S.levelStart = S.score;
  loadLevel(def, { testing: true });
  msg('');
};

// Guarda el nivel en Mis niveles.
function storeDraft(asNew) {
  if (!validDraft()) return;
  const def = cleanDef();
  if (E.editingId && !asNew) {
    def.id = E.editingId;
    const i = customs.findIndex((c) => c.id === E.editingId);
    if (i >= 0) customs[i] = def;
    else customs.push(def);
  } else {
    def.id = newId();
    if (asNew && customs.some((c) => c.name === def.name)) def.name = (def.name + ' 2').slice(0, 40);
    customs.push(def);
    E.editingId = def.id;
    E.draft.name = def.name;
    $('ed-name').value = def.name;
  }
  E.draft.id = E.editingId;
  const ok = saveCustoms();
  msg(
    ok
      ? L(`“${def.name}” está guardado en Mis niveles.`, `“${def.name}” is saved in My levels.`)
      : L(
          `“${def.name}” está en Mis niveles durante esta sesión, pero este navegador no permite guardarlo de forma permanente. Usa el código para conservarlo.`,
          `“${def.name}” is in My levels for this session, but this browser won’t store it permanently. Use the code to keep it.`,
        ),
    ok ? 'ok' : 'err',
  );
  updateSaveButtons();
  fillOpenList();
  hud();
}
$('ed-save').onclick = () => storeDraft(false);
$('ed-saveas').onclick = () => storeDraft(true);

// Botón de dos pasos: el primer clic pide confirmación y el segundo ejecuta la acción.
function twoStep(btn, label, action) {
  if (E.confirm === btn.id) {
    E.confirm = null;
    btn.textContent = label();
    action();
    return;
  }
  E.confirm = btn.id;
  btn.textContent = L('Pulsa otra vez para confirmar', 'Press again to confirm');
  setTimeout(() => {
    if (E.confirm === btn.id) {
      E.confirm = null;
      btn.textContent = label();
    }
  }, 3000);
}
$('ed-new').onclick = (e) =>
  twoStep(
    e.currentTarget,
    () => L('Nuevo en blanco', 'New blank level'),
    () => {
      pushHist();
      E.draft = blankLevel(E.draft.type);
      E.editingId = null;
      E.sel = null;
      fillEditor();
      msg(
        L(
          'Nivel en blanco listo. Deshacer recupera el anterior.',
          'Blank level ready. Undo brings back the previous one.',
        ),
      );
    },
  );
$('ed-clear').onclick = (e) =>
  twoStep(
    e.currentTarget,
    () => L('Quitar todas las piezas', 'Remove all pieces'),
    () => {
      pushHist();
      E.draft.objs = [];
      E.draft.terrain = [];
      E.sel = null;
      renderPop();
      updateCounts();
      hud();
      msg(
        L(
          'Se quitaron todas las piezas. Deshacer las recupera.',
          'All pieces removed. Undo brings them back.',
        ),
      );
    },
  );
$('ed-del').onclick = (e) =>
  twoStep(
    e.currentTarget,
    () => L('Eliminar de mis niveles', 'Delete from my levels'),
    () => {
      const name = E.draft.name;
      customs = customs.filter((c) => c.id !== E.editingId);
      delete prog.stars[E.editingId];
      if (prog.last === E.editingId) prog.last = null;
      saveCustoms();
      saveProg();
      E.editingId = null;
      E.draft.id = null;
      updateSaveButtons();
      fillOpenList();
      msg(
        L(
          `“${name}” se eliminó de Mis niveles. Sigue abierto aquí por si quieres guardarlo de nuevo.`,
          `“${name}” was deleted from My levels. It stays open here in case you want to save it again.`,
        ),
      );
    },
  );
$('ed-load').onclick = () => {
  const v = $('ed-open').value;
  if (!v) return;
  const kind = v.slice(0, 1),
    id = v.slice(2);
  const def =
    kind === 'c'
      ? [...CAMPAIGN, ...CAMPAIGN_D, ...CAMPAIGN_M].find((c) => c.id === id)
      : customs.find((c) => c.id === id);
  if (!def) return;
  openEditor(def);
  msg(
    kind === 'c'
      ? L(
          `Abriste una copia de “${lvName(def)}”. Guárdala para tenerla en Mis niveles.`,
          `You opened a copy of “${lvName(def)}”. Save it to keep it in My levels.`,
        )
      : L(`Editando “${def.name}”.`, `Editing “${def.name}”.`),
  );
};

// Convierte un nivel en un código de texto para compartirlo ("PB1.xxxxx").
function encode(def) {
  const { id, ...rest } = def;
  void id;
  return 'PB1.' + btoa(unescape(encodeURIComponent(JSON.stringify(rest))));
}

// Convierte un código de texto en un nivel.
function decode(str) {
  str = str.trim();
  if (str.startsWith('PB1.')) str = decodeURIComponent(escape(atob(str.slice(4).replace(/\s+/g, ''))));
  return JSON.parse(str);
}
$('ed-export').onclick = () => {
  const code = encode(cleanDef());
  const ta = $('ed-code');
  ta.value = code;
  const fallback = () => {
    ta.focus();
    ta.select();
    msg(
      L(
        'Código generado y seleccionado: cópialo con Ctrl+C (o mantén pulsado en el móvil).',
        'Code generated and selected: copy it with Ctrl+C (or long-press on mobile).',
      ),
      'ok',
    );
  };
  try {
    navigator.clipboard
      .writeText(code)
      .then(
        () =>
          msg(
            L(
              'Código copiado. Quien lo pegue en su editor tendrá este mismo nivel.',
              'Code copied. Whoever pastes it into their editor gets this same level.',
            ),
            'ok',
          ),
        fallback,
      );
  } catch (err) {
    fallback();
  }
};
$('ed-import').onclick = () => {
  const txt = $('ed-code').value;
  if (!txt.trim()) {
    msg(L('Pega primero un código en el cuadro.', 'Paste a code into the box first.'), 'err');
    return;
  }
  try {
    const lvl = normLevel(decode(txt));
    pushHist();
    E.draft = lvl;
    E.draft.id = null;
    E.editingId = null;
    E.sel = null;
    fillEditor();
    msg(
      L(
        `Cargado “${lvl.name}”. Guárdalo para tenerlo en Mis niveles.`,
        `Loaded “${lvl.name}”. Save it to keep it in My levels.`,
      ),
      'ok',
    );
  } catch (err) {
    msg(
      L(
        'Ese código no es válido. Revisa que lo hayas copiado completo.',
        'That code isn’t valid. Check that you copied all of it.',
      ),
      'err',
    );
  }
};
