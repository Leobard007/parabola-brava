/* ======================================================================
   ARCHIVO: js/3-editor/tarjeta-y-piezas.js

   EDITOR: TARJETA FLOTANTE Y PIEZAS
   La tarjeta flotante muestra las propiedades de lo que seleccionas en la escena.
   También contiene la lógica para colocar, mover y apoyar las piezas.
   ====================================================================== */

/* =========================================================
   TARJETA FLOTANTE DE PROPIEDADES
   ========================================================= */

// Cabecera de la tarjeta flotante.
function popHead(title, sub, col) {
  return `<div class="pophead"><div><b style="color:${col}">${title}</b> <small class="hint">${sub}</small></div><button class="popclose" id="pp-close" type="button" aria-label="${L('Cerrar tarjeta', 'Close card')}">×</button></div>`;
}

// Muestra la tarjeta flotante con las propiedades del elemento seleccionado.
function renderPop() {
  const pop = $('pop'),
    s = E.sel,
    d = E.draft;
  if (VIEW !== 'game' || S.screen !== 'edit' || !s || !d) {
    pop.hidden = true;
    return;
  }
  let h = '',
    cls = 'popcard';
  if (s.type === 'vec') {
    const m = d.mov,
      V = m && m.vecs[s.i];
    if (!V) {
      pop.hidden = true;
      return;
    }
    const ask = askable(m);
    cls += ' vec';
    h = popHead(vname(s.i), kindLabel(V.kind).toLowerCase(), C.vector);
    h += `<div class="fields"><label class="field"><span>${L('Tipo de magnitud', 'Quantity type')}</span><select id="pp-kind">${KINDS.map((k) => `<option value="${k}" ${k === V.kind ? 'selected' : ''}>${kindLabel(k)}</option>`).join('')}</select></label>`;
    if (V.kind !== 'dist') {
      const p = V.kind === 'vel' ? 'v' : 'a';
      h += `<label class="field"><span>${L('Al estirar cambia', 'Stretching changes')}</span><select id="pp-stretch"><option value="${p}" ${V.stretch !== 't' ? 'selected' : ''}>${p === 'v' ? L('la velocidad v', 'the speed v') : L('la aceleración a', 'the acceleration a')}</option><option value="t" ${V.stretch === 't' ? 'selected' : ''}>${L('el tiempo t', 'the time t')}</option></select></label>`;
    }
    h += `</div><label class="check"><input type="checkbox" id="pp-adj" ${adjIndex(m) === s.i ? 'checked' : ''}> ${L('Ajustable: absorbe los cambios cuando editas R', 'Adjustable: absorbs the changes when you edit R')}</label>`;
    h += `<div class="svcard">${Q_BY_KIND[V.kind].map((q) => svRow(s.i, q, 'pp', ask)).join('')}</div>`;
    if (m.vecs.length > 1)
      h += `<div class="btnrow"><button class="btn danger small" type="button" id="pp-del">${L('Quitar vector', 'Remove vector')}</button></div>`;
  } else if (s.type === 'R') {
    const m = d.mov,
      ask = askable(m);
    cls += ' r';
    h = popHead('R', L('resultante de A a B', 'resultant from A to B'), C['pencil-deep']);
    h += `<p class="hint" style="margin:0">${L(`Al cambiar R se ajusta ${vname(adjIndex(m))}. Para que se ajuste otro, márcalo como “Ajustable” en su tarjeta.`, `Changing R adjusts ${vname(adjIndex(m))}. To adjust a different one, mark it “Adjustable” in its card.`)}</p>`;
    h += `<div class="svcard">${R_Q.map((q) => svRow('R', q, 'pp', ask)).join('')}</div>`;
  } else if (s.type === 'A') {
    const m = d.mov;
    h =
      popHead('A', L('punto de partida', 'starting point'), C.vector) +
      `<div class="fields"><label class="field"><span>x (m)</span><input type="number" id="pp-ax" step="0.5" value="${m.ax}"></label><label class="field"><span>y (m)</span><input type="number" id="pp-ay" step="0.5" min="0" value="${m.ay}"></label></div>` +
      `<p class="hint" style="margin:0">${L('Mover A traslada todos los vectores; el problema no cambia.', 'Moving A shifts every vector; the problem stays the same.')}</p>`;
  } else if (s.type === 'launcher') {
    const v = d.vars;
    h = popHead(
      L('Lanzador', 'Launcher'),
      L('valores con los que empieza el jugador', 'values the player starts with'),
      C['pencil-deep'],
    );
    h += `<div class="fields">${VKEYS.map((k) => `<label class="field"><span>${varLabel(k)} (${VAR_META[k].unit})</span><input type="number" step="any" id="pp-${k}" value="${v[k].def}"></label>`).join('')}</div>`;
    h += `<p class="hint" style="margin:0">${VKEYS.map((k) => `${VAR_META[k].sym}: ${v[k].locked ? L('fija', 'fixed') : `${v[k].min} ${L('a', 'to')} ${v[k].max}`}`).join(' · ')}. ${L('Los rangos y bloqueos están en Variables del lanzamiento.', 'Ranges and locks are in Launch variables.')}</p>`;
  } else if (s.ref) {
    h = piecePopHTML(s);
  }
  pop.className = cls;
  pop.innerHTML = h;
  pop.hidden = false;
  bindPop();
  positionPop();
}

// Conecta los campos de la tarjeta flotante con el nivel.
function bindPop() {
  const s = E.sel,
    d = E.draft,
    on = (id, ev, fn) => {
      const el = $(id);
      if (el) el.addEventListener(ev, fn);
    };
  on('pp-close', 'click', () => {
    E.sel = null;
    renderPop();
    if (isMov(d)) buildSmart();
  });
  if (s.type === 'vec' || s.type === 'R') bindRows($('pop'));
  if (s.type === 'vec') {
    on('pp-kind', 'change', (e) => {
      pushHist();
      d.mov.vecs[s.i] = setKindKeep(d.mov.vecs[s.i], e.target.value);
      refreshMov();
    });
    on('pp-stretch', 'change', (e) => {
      pushHist();
      d.mov.vecs[s.i].stretch = e.target.value;
      refreshMov();
    });
    on('pp-adj', 'change', (e) => {
      pushHist();
      d.mov.adj = e.target.checked ? s.i : null;
      refreshMov();
    });
    on('pp-del', 'click', () => removeVec(s.i));
  }
  if (s.type === 'A')
    ['pp-ax', 'pp-ay'].forEach((id) =>
      on(id, 'change', () => {
        pushHist();
        d.mov.ax = num($('pp-ax').value, d.mov.ax);
        d.mov.ay = num($('pp-ay').value, d.mov.ay);
        refreshMov();
      }),
    );
  if (s.type === 'launcher')
    VKEYS.forEach((k) =>
      on('pp-' + k, 'change', (e) => {
        pushHist();
        d.vars[k].def = num(e.target.value, d.vars[k].def);
        d.vars = normVars(d.vars);
        refreshVarTable();
        renderPop();
      }),
    );
  if (s.ref) bindPiecePop(s);
}

// Nombres de los tipos de pieza.
const pieceNames = () => ({
  wood: L('Madera', 'Wood'),
  stone: L('Piedra', 'Stone'),
  target: L('Objetivo', 'Target'),
});

// Contenido de la tarjeta para una pieza (bloque, objetivo o terreno).
function piecePopHTML(s) {
  const o = s.ref,
    isT = s.type === 'terrain',
    names = pieceNames();
  return (
    popHead(isT ? L('Terreno', 'Terrain') : names[o.k], L('pieza', 'piece'), C.ink) +
    `<div class="fields">
    ${
      isT
        ? ''
        : `<label class="field"><span>${L('Tipo', 'Type')}</span><select id="sel-k">${Object.entries(names)
            .map(([k, n]) => `<option value="${k}" ${o.k === k ? 'selected' : ''}>${n}</option>`)
            .join('')}</select></label>`
    }
    <label class="field"><span>x (m)</span><input type="number" id="sel-x" step="0.25" value="${o.x}"></label>
    ${isT ? '' : `<label class="field"><span>y (m)</span><input type="number" id="sel-y" value="${r2(o.y)}" disabled title="${L('Las piezas se apoyan solas sobre lo que tienen debajo', 'Pieces rest on whatever is below them')}"></label>`}
    <label class="field"><span>${L('Ancho (m)', 'Width (m)')}</span><input type="number" id="sel-w" step="0.25" min="0.2" value="${o.w}" ${o.k === 'target' ? 'disabled' : ''}></label>
    <label class="field"><span>${L('Alto (m)', 'Height (m)')}</span><input type="number" id="sel-h" step="0.25" min="0.2" value="${o.h}" ${o.k === 'target' ? 'disabled' : ''}></label>
  </div><div class="btnrow"><button class="btn danger small" type="button" id="sel-del">${L('Eliminar pieza', 'Delete piece')}</button></div>`
  );
}

// Conecta la tarjeta de una pieza.
function bindPiecePop(s) {
  const o = s.ref,
    isT = s.type === 'terrain',
    d = E.draft;
  const upd = () => {
    pushHist();
    if (!isT && $('sel-k')) {
      const k = $('sel-k').value;
      if (k !== o.k) {
        o.k = k;
        if (k === 'target') {
          o.w = 1.2;
          o.h = 1.2;
        } else if (o.w === 1.2 && o.h === 1.2) {
          [o.w, o.h] = E.lastSize[k];
        }
      }
    }
    if (o.k !== 'target') {
      o.w = r2(clamp(num($('sel-w').value, o.w), isT ? 0.3 : 0.2, isT ? 60 : 20));
      o.h = r2(clamp(num($('sel-h').value, o.h), isT ? 0.3 : 0.2, isT ? 40 : 20));
    }
    o.x = r2(clamp(num($('sel-x').value, o.x), LAUNCH_CLEAR, Math.max(LAUNCH_CLEAR, d.W - o.w)));
    settleDraft();
    renderPop();
    updateCounts();
    hud();
  };
  ['sel-k', 'sel-x', 'sel-w', 'sel-h'].forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener('change', upd);
  });
  $('sel-del').onclick = () => {
    pushHist();
    removeItem(s);
  };
}

// Posición en pantalla del elemento seleccionado (para colocar la tarjeta).
function anchorOf(s) {
  const d = E.draft;
  if (!s || !d) return null;
  if (s.type === 'vec' && isMov(d)) {
    const r = resultant(d.mov),
      a = r.pts[s.i],
      b = r.pts[s.i + 1];
    if (!b) return null;
    return { x: (X(a.x) + X(b.x)) / 2, y: (Y(a.y) + Y(b.y)) / 2 };
  }
  if (s.type === 'R' && isMov(d)) {
    const r = resultant(d.mov);
    return { x: X(r.F.x), y: Y(r.F.y) };
  }
  if (s.type === 'A' && isMov(d)) return { x: X(d.mov.ax), y: Y(d.mov.ay) };
  if (s.type === 'launcher') return { x: X(0.6), y: Y(d.vars.h0.def) };
  if (s.ref) {
    const top = s.type === 'terrain' ? s.ref.h : s.ref.y + s.ref.h;
    return { x: X(s.ref.x + s.ref.w), y: Y(top) };
  }
  return null;
}

// Coloca la tarjeta en la esquina contraria al elemento, para no taparlo.
function positionPop() {
  const pop = $('pop');
  if (pop.hidden) return;
  if (window.matchMedia('(max-width: 640px)').matches) {
    pop.style.left = '';
    pop.style.top = '';
    return;
  }
  const a = anchorOf(E.sel);
  if (!a) return;
  // la tarjeta va en la esquina superior opuesta al elemento, para no tapar lo que se edita
  const W = $('stageWrap').clientWidth,
    stH = $('stage').clientHeight;
  pop.style.maxHeight = Math.max(220, stH - 20) + 'px';
  const pw = pop.offsetWidth;
  pop.style.left = (a.x < W / 2 ? W - pw - 10 : 10) + 'px';
  pop.style.top = '10px';
}

/* --- colocación de piezas --- */
// Altura sobre la que se apoya una pieza en el editor.
function supportBelow(o, probeY, skip) {
  let y = 0;
  for (const t of E.draft.terrain) if (overlapX(o, t)) y = Math.max(y, t.h);
  for (const p of E.draft.objs) {
    if (p === skip) continue;
    const top = p.y + p.h;
    if (overlapX(o, p) && top <= probeY + 0.3 && top > y) y = top;
  }
  return r2(y);
}

// Hace que todas las piezas del editor se apoyen en lo que tienen debajo.
function settleDraft() {
  if (!E.draft) return;
  const list = E.draft.objs.slice().sort((a, b) => a.y - b.y);
  for (const o of list) o.y = supportBelow(o, o.y, o);
  updateCounts();
}

// Vista previa (semitransparente) de la pieza que se colocaría con la herramienta actual.
function ghostFor(w, t) {
  const d = E.draft;
  if (t === 'terrain') {
    const tw = 4;
    return {
      type: 'terrain',
      ref: {
        x: r2(clamp(snap(w.x - tw / 2, 0.5), LAUNCH_CLEAR, d.W - tw)),
        w: tw,
        h: r2(Math.max(1, snap(w.y, 0.5))),
      },
    };
  }
  const [ow, oh] = t === 'target' ? [1.2, 1.2] : E.lastSize[t];
  const o = {
    k: t,
    x: r2(clamp(snap(w.x - ow / 2, 0.25), LAUNCH_CLEAR, Math.max(LAUNCH_CLEAR, d.W - ow))),
    y: 0,
    w: ow,
    h: oh,
  };
  o.y = supportBelow(o, Math.max(0, w.y), null);
  return { type: 'obj', ref: o };
}

// Coloca una pieza en la posición indicada.
function placeAt(w, t) {
  const gh = ghostFor(w, t);
  if (gh.type === 'terrain') E.draft.terrain.push(gh.ref);
  else E.draft.objs.push(gh.ref);
  settleDraft();
  return gh;
}

// ¿Está el cursor cerca del punto A?
function nearStart(w) {
  const d = E.draft;
  if (!isMov(d)) return false;
  return Math.hypot(w.x - d.mov.ax, w.y - (d.mov.ay + 0.6)) < Math.max(1.2, 14 / V.s);
}

// Mueve el punto A.
function moveStart(w) {
  const d = E.draft;
  d.mov.ax = r2(clamp(snap(w.x, 0.5), LAUNCH_CLEAR + 0.6, d.W - 0.6));
  d.mov.ay = r2(clamp(snap(w.y - 0.6, 0.5), 0, 30));
}

// ¿Qué pieza hay bajo el cursor?
function hitTest(w) {
  const d = E.draft,
    pad = 6 / V.s;
  if (d.type === 'despl') return null;
  for (let i = d.objs.length - 1; i >= 0; i--) {
    const o = d.objs[i];
    if (w.x >= o.x - pad && w.x <= o.x + o.w + pad && w.y >= o.y - pad && w.y <= o.y + o.h + pad)
      return { type: 'obj', ref: o };
  }
  for (let i = d.terrain.length - 1; i >= 0; i--) {
    const t = d.terrain[i];
    if (w.x >= t.x - pad && w.x <= t.x + t.w + pad && w.y >= -pad && w.y <= t.h + pad)
      return { type: 'terrain', ref: t };
  }
  return null;
}

// Elimina una pieza.
function removeItem(s) {
  const arr = s.type === 'terrain' ? E.draft.terrain : E.draft.objs;
  const i = arr.indexOf(s.ref);
  if (i >= 0) arr.splice(i, 1);
  if (E.sel && E.sel.ref === s.ref) E.sel = null;
  settleDraft();
  renderPop();
  hud();
}

// Posición del cuadradito para cambiar el tamaño de una pieza.
function handlePos(s) {
  const o = s.ref,
    top = s.type === 'terrain' ? o.h : o.y + o.h;
  return { x: X(o.x + o.w), y: Y(top) };
}

// Actualiza los números de la tarjeta mientras se arrastra una pieza.
function liveSelValues() {
  if (!E.sel || !E.sel.ref) return;
  const o = E.sel.ref;
  const set = (id, v) => {
    const el = $(id);
    if (el) el.value = r2(v);
  };
  set('sel-x', o.x);
  set('sel-y', o.y || 0);
  set('sel-w', o.w);
  set('sel-h', o.h);
}
