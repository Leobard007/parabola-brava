/* ======================================================================
   ARCHIVO: js/3-editor/panel-variables.js

   EDITOR: PANEL "VARIABLES DEL PROBLEMA"
   Muestra una tarjeta por vector (y otra para R) donde se cambian valores y se elige,
   para cada magnitud, si es Dato, Incógnita (?) u Oculta (—).
   Siempre comprueba que el problema tenga solución, y el botón "Arreglar" lo corrige solo.
   ====================================================================== */

/* =========================================================
   PANEL INTELIGENTE DE VARIABLES
   ========================================================= */

// Para cada magnitud, ¿se podría pedir como incógnita con los datos actuales? (prueba una por una con analyze).
function askable(m) {
  const res = {},
    base = analyze(m);
  const test = (owner, q, show) => {
    const key = `${owner}.${q}`;
    if (show[q] === 'inc') {
      res[key] = !base.missing.includes(key);
      return;
    }
    const save = show[q];
    show[q] = 'inc';
    res[key] = !analyze(m).missing.includes(key);
    show[q] = save;
  };
  m.vecs.forEach((V, i) => Q_BY_KIND[V.kind].forEach((q) => test(i, q, V.show)));
  R_Q.forEach((q) => test('R', q, m.R.show));
  return res;
}

// Nombre con unidad de una magnitud, para el panel.
function nameOf(owner, q) {
  const base = symOf(q, owner);
  if (q === 'dir') return base;
  return `${base} <small>${q === 'ang' ? '°' : Q_UNIT[q]}</small>`;
}

// Nota que explica qué se ajusta al cambiar un valor (ej. "= v·t").
function derivedNote(owner, q, V, m) {
  if (owner === 'R')
    return L(`al cambiarlo se ajusta ${vname(adjIndex(m))}`, `changing it adjusts ${vname(adjIndex(m))}`);
  if (q === 'd' && V.kind === 'vel')
    return L(
      `= v·t (al cambiarlo se ajusta ${V.stretch === 't' ? 't' : 'v'})`,
      `= v·t (changing it adjusts ${V.stretch === 't' ? 't' : 'v'})`,
    );
  if (q === 'd' && V.kind === 'acc')
    return L(
      `= v₀t + ½at² (al cambiarlo se ajusta ${V.stretch === 't' ? 't' : 'a'})`,
      `= v₀t + ½at² (changing it adjusts ${V.stretch === 't' ? 't' : 'a'})`,
    );
  if (q === 'x' || q === 'y') return L('al cambiarlo se ajustan |V| y θ', 'changing it adjusts |V| and θ');
  return '';
}

// HTML de una fila del panel: nombre, valor editable y botones Dato / ? / —.
function svRow(owner, q, prefix, ask) {
  const m = E.draft.mov,
    r = resultant(m),
    isR = owner === 'R';
  const V = isR ? null : m.vecs[owner],
    show = isR ? m.R.show : V.show;
  const vals = isR ? r.R : r.vals[owner],
    key = `${owner}.${q}`,
    st = show[q];
  const pureAng = !isR && q === 'ang' && isPure(V.dir);
  const id = `${prefix}-${owner}-${q}`,
    label = keyLabel(key);
  let val;
  if (pureAng)
    val = `<span class="fixed">${fmtN(vals.ang)}° · ${L('lo fija la dirección', 'set by the direction')}</span>`;
  else if (q === 'dir')
    val = `<select id="${id}" data-o="${owner}" data-q="dir" aria-label="${label}">${DIR_ORDER.map((k) => `<option value="${k}" ${k === vals.dir ? 'selected' : ''}>${DIR_ARROW[k]} ${dirName(k)}</option>`).join('')}</select>`;
  else
    val = `<input type="number" step="any" id="${id}" data-o="${owner}" data-q="${q}" value="${r2(vals[q])}" aria-label="${label}">`;
  let seg = '',
    note = '',
    cls = '';
  if (!pureAng) {
    seg =
      `<span class="seg" role="group" aria-label="${L('Qué sabe el jugador de', 'What the player knows about')} ${label}">` +
      ['dato', 'inc', 'oculto']
        .map((s) => {
          const off = s === 'inc' && !ask[key] && st !== 'inc';
          return `<button type="button" class="s-${s}" data-o="${owner}" data-q="${q}" data-s="${s}" aria-pressed="${st === s}" ${off ? `disabled title="${L('Con los datos actuales no se puede calcular', 'It can’t be worked out from the current data')}"` : ''}>${s === 'dato' ? L('Dato', 'Given') : s === 'inc' ? '?' : '—'}</button>`;
        })
        .join('') +
      '</span>';
    if (st === 'inc') {
      note = ask[key]
        ? L('✓ incógnita con solución', '✓ solvable unknown')
        : L('✗ no se puede calcular con los datos actuales', '✗ can’t be worked out from the current data');
      cls = ask[key] ? 'good' : 'bad';
    } else
      note = ask[key]
        ? L('se puede pedir como incógnita', 'can be asked as an unknown')
        : L('aún no se puede pedir', 'can’t be asked yet');
    const der = derivedNote(owner, q, V, m);
    if (der) note = der + ' · ' + note;
  }
  return `<div class="sv-row st-${pureAng ? 'oculto' : st}"><span class="sv-name">${nameOf(owner, q)}</span><span class="sv-val">${val}</span>${seg}<span class="sv-note ${cls}">${note}</span></div>`;
}

// Conecta las casillas y botones de las filas con el nivel.
function bindRows(root) {
  root.querySelectorAll('.sv-val input, .sv-val select').forEach((el) =>
    el.addEventListener('change', () => {
      const o = el.dataset.o === 'R' ? 'R' : +el.dataset.o,
        q = el.dataset.q;
      const val = q === 'dir' ? el.value : parseFloat(String(el.value).replace(',', '.'));
      if (q !== 'dir' && !isFinite(val)) {
        refreshMov();
        return;
      }
      pushHist();
      setQuantity(o, q, val);
      refreshMov();
    }),
  );
  root.querySelectorAll('.seg button').forEach((b) =>
    b.addEventListener('click', () => {
      const o = b.dataset.o === 'R' ? 'R' : +b.dataset.o,
        m = E.draft.mov;
      const show = o === 'R' ? m.R.show : m.vecs[o].show;
      if (show[b.dataset.q] === b.dataset.s) return;
      pushHist();
      show[b.dataset.q] = b.dataset.s;
      refreshMov();
    }),
  );
}

// Construye el panel "Variables del problema" con una tarjeta por vector y otra para R.
function buildSmart() {
  const d = E.draft;
  if (!isMov(d)) return;
  const m = d.mov,
    ask = askable(m);
  const card = (owner) => {
    const isR = owner === 'R',
      V = isR ? null : m.vecs[owner],
      qs = isR ? R_Q : Q_BY_KIND[V.kind];
    const sel =
      E.sel && ((isR && E.sel.type === 'R') || (!isR && E.sel.type === 'vec' && E.sel.i === owner))
        ? ' sel'
        : '';
    const head = isR
      ? `R <small>${L('resultante · de A a B', 'resultant · from A to B')}</small>`
      : `${vname(owner)} <small>${kindLabel(V.kind).toLowerCase()}</small>${adjIndex(m) === owner ? ` <span class="badge" title="${L('Absorbe los cambios cuando editas R', 'Absorbs the changes when you edit R')}">${L('ajustable', 'adjustable')}</span>` : ''}`;
    return `<div class="svcard${isR ? ' r' : ''}${sel}"><h5 data-sel="${owner}" title="${L('Seleccionar en la escena', 'Select in the scene')}">${head}</h5>${qs.map((q) => svRow(owner, q, 'sv', ask)).join('')}</div>`;
  };
  $('sv-grid').innerHTML = m.vecs.map((_, i) => card(i)).join('') + card('R');
  bindRows($('sv-grid'));
  $('sv-grid')
    .querySelectorAll('h5[data-sel]')
    .forEach(
      (h) =>
        (h.onclick = () => {
          const o = h.dataset.sel;
          E.sel = o === 'R' ? { type: 'R' } : { type: 'vec', i: +o };
          renderPop();
          buildSmart();
        }),
    );
}

/* --- cambiar valores: cada cambio mantiene coherente el problema --- */
// Cambia la longitud de un vector (ajusta d, v, t o a según su tipo).
function setVecLen(V, len) {
  len = clamp(len, 0.5, 80);
  if (V.kind === 'dist') V.d = r2(len);
  else if (V.kind === 'vel') {
    if (V.stretch === 't') V.t = r2(clamp(len / V.v, 0.1, 60));
    else V.v = r2(clamp(len / V.t, 0.1, 50));
  } else if (V.stretch === 't')
    V.t = r2(clamp((-V.v0 + Math.sqrt(V.v0 * V.v0 + 2 * V.a * len)) / V.a, 0.1, 60));
  else V.a = r2(clamp((2 * (len - V.v0 * V.t)) / (V.t * V.t), 0.05, 20));
}

// Coloca un vector a partir de sus componentes x e y (se usa al arrastrar la punta).
function setVecXY(i, x, y) {
  const V = E.draft.mov.vecs[i];
  let len = Math.hypot(x, y);
  if (len < 0.5) {
    if (len > 1e-9) {
      x *= 0.5 / len;
      y *= 0.5 / len;
    } else {
      x = 0.5;
      y = 0;
    }
    len = 0.5;
  }
  const wasPure = isPure(V.dir);
  V.dir = dirOf(x, y);
  V.ang = isPure(V.dir)
    ? V.dir === 'r' || V.dir === 'l'
      ? 0
      : 90
    : r2((Math.atan2(Math.abs(y), Math.abs(x)) * 180) / Math.PI);
  if (wasPure && !isPure(V.dir) && V.show.dir === 'dato' && V.show.ang === 'oculto') V.show.ang = 'dato';
  setVecLen(V, len);
}

// Cambia R ajustando el vector "ajustable" para que la suma dé el nuevo R.
function setRXY(x, y) {
  const m = E.draft.mov,
    r = resultant(m),
    adj = adjIndex(m);
  const o = r.vals.reduce((s, v, i) => (i === adj ? s : { x: s.x + v.x, y: s.y + v.y }), { x: 0, y: 0 });
  setVecXY(adj, x - o.x, y - o.y);
}

// Cambia una magnitud concreta (de un vector o de R) manteniendo el problema coherente.
function setQuantity(owner, q, val) {
  const m = E.draft.mov;
  if (owner === 'R') {
    const r = resultant(m);
    let x = r.dx,
      y = r.dy;
    const sx = x < -0.05 ? -1 : 1,
      sy = y < -0.05 ? -1 : 1;
    if (q === 'd') {
      if (r.mag > 1e-6) {
        x *= val / r.mag;
        y *= val / r.mag;
      } else x = val;
    } else if (q === 'ang') {
      const a = (clamp(val, 0, 90) * Math.PI) / 180;
      x = sx * r.mag * Math.cos(a);
      y = sy * r.mag * Math.sin(a);
    } else if (q === 'dir') {
      const [dx, dy] = DIRV[val];
      if (dx === 0) {
        x = 0;
        y = dy * r.mag;
      } else if (dy === 0) {
        x = dx * r.mag;
        y = 0;
      } else {
        const a = ((r.angH < 1 || r.angH > 89 ? 45 : r.angH) * Math.PI) / 180;
        x = dx * r.mag * Math.cos(a);
        y = dy * r.mag * Math.sin(a);
      }
    } else if (q === 'x') x = val;
    else if (q === 'y') y = val;
    setRXY(x, y);
    return;
  }
  const V = m.vecs[owner],
    cur = vecVals(V);
  if (q === 'd') setVecLen(V, val);
  else if (q === 'v') V.v = r2(clamp(val, 0.1, 50));
  else if (q === 't') V.t = r2(clamp(val, 0.1, 60));
  else if (q === 'a') V.a = r2(clamp(val, 0.05, 20));
  else if (q === 'v0') V.v0 = r2(clamp(val, 0, 30));
  else if (q === 'ang') {
    if (!isPure(V.dir)) V.ang = r2(clamp(val, 0, 90));
  } else if (q === 'dir') {
    const wasPure = isPure(V.dir);
    V.dir = val;
    if (isPure(val)) V.ang = val === 'r' || val === 'l' ? 0 : 90;
    else if (wasPure) {
      V.ang = 30;
      if (V.show.dir === 'dato' && V.show.ang === 'oculto') V.show.ang = 'dato';
    }
  } else if (q === 'x') setVecXY(owner, val, cur.y);
  else if (q === 'y') setVecXY(owner, cur.x, val);
}

/* --- estado y botón Arreglar --- */
// Muestra si el problema tiene solución y qué debe encontrar el jugador.
function movStatus() {
  const d = E.draft,
    sv = solvability(d.mov),
    geo = movProblems(d),
    r = sv.a.r,
    el = $('sv-status');
  let h = sv.ok
    ? L('✓ Se puede resolver. El jugador debe encontrar: ', '✓ Solvable. The player must find: ') +
      sv.a.inc
        .map((k) => {
          const { owner, q } = splitKey(k);
          return `<b>${keyLabel(k)} = ${fmtQ(q, truthOf(r, owner, q))}</b>`;
        })
        .join(', ') +
      '.'
    : sv.text;
  if (geo) h += `<br><b>${geo}</b>`;
  h += `<br><span class="hint">B = (${f(r.F.x)}, ${f(r.F.y)}) m · ${L(`se ajusta ${vname(adjIndex(d.mov))} cuando editas R`, `${vname(adjIndex(d.mov))} adjusts when you edit R`)}</span>`;
  if (!sv.ok || geo)
    h += ` <button class="btn small edit" type="button" id="sv-fix">${L('Arreglar', 'Fix')}</button>`;
  el.innerHTML = h;
  el.className = 'status' + (sv.ok && !geo ? '' : ' bad');
  const fx = $('sv-fix');
  if (fx) fx.onclick = autoFix;
}

// Botón "Arreglar": cambia lo mínimo para que el problema tenga solución y quepa en el mundo.
function autoFix() {
  pushHist();
  const d = E.draft,
    m = d.mov,
    notes = [];
  let sv = solvability(m);
  if (!sv.a.inc.length) {
    Object.assign(m.R.show, { d: 'inc', ang: 'inc', dir: 'inc' });
    notes.push(
      L('marqué |R|, θ y dirección de R como incógnitas', 'marked |R|, θ and direction of R as unknowns'),
    );
    sv = solvability(m);
  }
  let fallback = false,
    guard = 0;
  while (!sv.ok && sv.a.missing.length && guard++ < 30) {
    const cands = [];
    m.vecs.forEach((V, i) =>
      Q_BY_KIND[V.kind].forEach((q) => {
        if (V.show[q] === 'oculto' && !(q === 'ang' && isPure(V.dir))) cands.push([i, q]);
      }),
    );
    R_Q.forEach((q) => {
      if (m.R.show[q] === 'oculto') cands.push(['R', q]);
    });
    let best = null,
      bestMiss = sv.a.missing.length;
    for (const [o, q] of cands) {
      const show = o === 'R' ? m.R.show : m.vecs[o].show;
      show[q] = 'dato';
      const miss = analyze(m).missing.length;
      show[q] = 'oculto';
      if (miss < bestMiss) {
        bestMiss = miss;
        best = [o, q];
        if (!miss) break;
      }
    }
    if (best) {
      (best[0] === 'R' ? m.R.show : m.vecs[best[0]].show)[best[1]] = 'dato';
      notes.push(
        L(
          `${keyLabel(`${best[0]}.${best[1]}`)} pasa a ser dato`,
          `${keyLabel(`${best[0]}.${best[1]}`)} is now given`,
        ),
      );
    } else if (!fallback) {
      fallback = true;
      m.vecs.forEach((V) => {
        const p = showPrimary(V);
        Object.keys(p).forEach((q) => {
          if (p[q] === 'dato' && V.show[q] === 'oculto') V.show[q] = 'dato';
        });
      });
      notes.push(L('mostré los datos básicos de los vectores', 'showed the vectors’ basic data'));
    } else break;
    sv = solvability(m);
  }
  if (!sv.ok && sv.a.missing.length) {
    sv.a.missing.forEach((k) => {
      const { owner, q } = splitKey(k);
      (owner === 'R' ? m.R.show : m.vecs[owner].show)[q] = 'oculto';
    });
    notes.push(L('oculté las incógnitas que no tenían solución', 'hid the unknowns that had no solution'));
    if (!solvability(m).a.inc.length) {
      Object.assign(m.R.show, { d: 'inc', ang: 'inc', dir: 'inc' });
      m.vecs.forEach((V) => {
        const p = showPrimary(V);
        Object.keys(p).forEach((q) => {
          if (p[q] === 'dato') V.show[q] = 'dato';
        });
      });
    }
  }
  const lo = LAUNCH_CLEAR + 0.6;
  let r = resultant(m);
  if (r.F.x > d.W - 0.6) {
    const need = r.F.x - (d.W - 0.6);
    if (m.ax - need - 0.5 >= lo) {
      m.ax = r2(m.ax - need - 0.5);
      notes.push(L('moví A a la izquierda', 'moved A left'));
    } else {
      d.W = r2(Math.min(150, Math.ceil(r.F.x + 2)));
      notes.push(L(`amplié el mundo a ${d.W} m`, `widened the world to ${d.W} m`));
    }
  }
  r = resultant(m);
  if (r.F.x < lo) {
    const need = lo - r.F.x;
    if (m.ax + need + 0.5 <= d.W - 0.6) {
      m.ax = r2(m.ax + need + 0.5);
      notes.push(L('moví A a la derecha', 'moved A right'));
    } else {
      d.W = r2(Math.min(150, d.W + need + 2));
      m.ax = r2(m.ax + need + 0.5);
      notes.push(L(`amplié el mundo a ${d.W} m`, `widened the world to ${d.W} m`));
    }
  }
  r = resultant(m);
  if (r.F.y < 0) {
    m.ay = r2(Math.min(30, m.ay - r.F.y + 0.5));
    notes.push(L('subí A', 'raised A'));
  }
  if (r.F.y > 35) {
    m.ay = r2(Math.max(0, m.ay - (r.F.y - 35) - 0.5));
    notes.push(L('bajé A', 'lowered A'));
  }
  d.mov = normMov(m, d.W);
  refreshAll();
  const left = solvability(d.mov).ok && !movProblems(d);
  msg(
    notes.length
      ? L(
          `Arreglado: ${notes.join(', ')}.${left ? '' : ' Aún queda algo por revisar.'} Puedes deshacerlo.`,
          `Fixed: ${notes.join(', ')}.${left ? '' : ' Something still needs checking.'} You can undo it.`,
        )
      : L('No encontré nada que arreglar automáticamente.', 'I found nothing to fix automatically.'),
    notes.length && left ? 'ok' : 'err',
  );
}

/* --- vista avanzada: tabla de vectores y matriz --- */
// Campos de cada tipo de vector en la tabla avanzada.
const VAL_FIELDS = {
  dist: [['d', '|V|', 'm']],
  vel: [
    ['v', 'v', 'm/s'],
    ['t', 't', 's'],
  ],
  acc: [
    ['a', 'a', 'm/s²'],
    ['t', 't', 's'],
    ['v0', 'v₀', 'm/s'],
  ],
};

// Llena los campos generales de los vectores (punto A, intentos, tolerancias...).
function fillMovFields() {
  const m = E.draft.mov;
  $('mv-ax').value = m.ax;
  $('mv-ay').value = m.ay;
  $('mv-tries').value = m.tries;
  $('mv-tolD').value = m.tolD;
  $('mv-tolA').value = m.tolA;
  $('mv-hide').checked = m.hideScale;
  $('mv-path').checked = m.showPath;
  $('mv-add').disabled = m.vecs.length >= 4;
}

// Construye la tabla avanzada de vectores.
function buildAdvanced() {
  const m = E.draft.mov,
    tb = $('mv-vecs');
  tb.innerHTML = '';
  m.vecs.forEach((V, i) => {
    const tr = document.createElement('tr');
    const vals = VAL_FIELDS[V.kind]
      .map(
        ([k, lab, unit]) =>
          `<label class="mini">${lab} <input type="number" id="mv-${k}-${i}" step="any" value="${V[k]}" aria-label="${vname(i)}: ${lab}"><em>${unit}</em></label>`,
      )
      .join('');
    tr.innerHTML = `<th scope="row">${vname(i)}</th>
      <td><select id="mv-kind-${i}" aria-label="${vname(i)}: ${L('tipo de magnitud', 'quantity type')}">${KINDS.map((k) => `<option value="${k}" ${k === V.kind ? 'selected' : ''}>${kindLabel(k)}</option>`).join('')}</select></td>
      <td><div class="minis">${vals}</div></td>
      <td><input type="number" id="mv-ang-${i}" step="any" min="0" max="90" value="${V.ang}" ${isPure(V.dir) ? 'disabled' : ''} aria-label="${vname(i)}: ${L('ángulo', 'angle')}"></td>
      <td><select id="mv-dir-${i}" aria-label="${vname(i)}: ${L('dirección', 'direction')}">${DIR_ORDER.map((k) => `<option value="${k}" ${k === V.dir ? 'selected' : ''}>${dirName(k)}</option>`).join('')}</select></td>
      <td>${m.vecs.length > 1 ? `<button class="btn danger small" type="button" data-rm="${i}">${L('Quitar', 'Remove')}</button>` : ''}</td>`;
    tb.appendChild(tr);
  });
  tb.querySelectorAll('input,select').forEach((el) => el.addEventListener('change', readVecTable));
  tb.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => removeVec(+b.dataset.rm)));
  buildMatrix();
}

// Lee la tabla avanzada cuando el usuario cambia algo.
function readVecTable() {
  pushHist();
  const d = E.draft,
    m = d.mov;
  m.vecs = m.vecs.map((V, i) => {
    const kind = $(`mv-kind-${i}`).value;
    if (kind !== V.kind) return setKindKeep(V, kind);
    const nv = { ...V, ang: $(`mv-ang-${i}`).value };
    VAL_FIELDS[V.kind].forEach(([k]) => {
      nv[k] = $(`mv-${k}-${i}`).value;
    });
    const dir = $(`mv-dir-${i}`).value;
    if (dir !== V.dir) {
      m.vecs[i] = normVec(nv);
      setQuantity(i, 'dir', dir);
      return m.vecs[i];
    }
    return normVec(nv);
  });
  refreshMov();
}
['mv-ax', 'mv-ay', 'mv-tries', 'mv-tolD', 'mv-tolA', 'mv-hide', 'mv-path'].forEach((id) =>
  $(id).addEventListener('change', () => {
    pushHist();
    const d = E.draft,
      m = d.mov;
    d.mov = normMov(
      {
        ...m,
        ax: $('mv-ax').value,
        ay: $('mv-ay').value,
        hideScale: $('mv-hide').checked,
        showPath: $('mv-path').checked,
        tolD: $('mv-tolD').value,
        tolA: $('mv-tolA').value,
        tries: $('mv-tries').value,
      },
      d.W,
    );
    refreshMov();
  }),
);
$('mv-add').onclick = () => {
  const m = E.draft.mov;
  if (m.vecs.length >= 4) return;
  pushHist();
  m.vecs.push(normVec({ d: 5, ang: 30, dir: 'ur' }));
  E.sel = { type: 'vec', i: m.vecs.length - 1 };
  refreshMov();
  msg(
    L(
      `Añadí ${vname(m.vecs.length - 1)}. Arrastra su punta en la escena o edítalo en su tarjeta.`,
      `Added ${vname(m.vecs.length - 1)}. Drag its tip in the scene or edit it in its card.`,
    ),
  );
};

// Quita un vector.
function removeVec(i) {
  const m = E.draft.mov;
  if (m.vecs.length <= 1) return;
  pushHist();
  m.vecs.splice(i, 1);
  if (m.adj === i) m.adj = null;
  else if (m.adj != null && m.adj > i) m.adj--;
  E.sel = null;
  refreshMov();
  msg(L('Quité el vector. Deshacer lo recupera.', 'Vector removed. Undo brings it back.'));
}

// Construye la matriz completa de qué es dato, incógnita u oculto.
function buildMatrix() {
  const m = E.draft.mov,
    r = resultant(m),
    tb = $('mx-body');
  const row = (owner, kind, show, vals) => {
    const qs = owner === 'R' ? R_Q : Q_BY_KIND[kind];
    const pureAng = owner !== 'R' && isPure(vals.dir);
    const tds = Q_COLS.map((q) => {
      if (!qs.includes(q) || (q === 'ang' && pureAng))
        return `<td class="na" title="${q === 'ang' && pureAng ? L('La dirección ya fija el ángulo (0° o 90°)', 'The direction already sets the angle (0° or 90°)') : L('No aplica a este tipo', 'Doesn’t apply to this type')}">·</td>`;
      const s = show[q];
      return `<td><select id="mx-${owner}-${q}" class="st-${s}" aria-label="${keyLabel(`${owner}.${q}`)}">
        <option value="dato" ${s === 'dato' ? 'selected' : ''}>${L('Dato', 'Given')}</option>
        <option value="inc" ${s === 'inc' ? 'selected' : ''}>?</option>
        <option value="oculto" ${s === 'oculto' ? 'selected' : ''}>—</option></select><small>${q === 'dir' ? DIR_ARROW[vals[q]] : fmtN(vals[q])}</small></td>`;
    }).join('');
    return `<tr><th scope="row">${vname(owner)}<small>${owner === 'R' ? L('resultante', 'resultant') : kindLabel(kind).toLowerCase()}</small></th>${tds}</tr>`;
  };
  tb.innerHTML =
    m.vecs.map((V, i) => row(i, V.kind, V.show, r.vals[i])).join('') + row('R', null, m.R.show, r.R);
  tb.querySelectorAll('select').forEach((sel) =>
    sel.addEventListener('change', () => {
      const [, owner, q] = sel.id.split('-');
      pushHist();
      (owner === 'R' ? m.R.show : m.vecs[+owner].show)[q] = sel.value;
      refreshMov();
    }),
  );
}
