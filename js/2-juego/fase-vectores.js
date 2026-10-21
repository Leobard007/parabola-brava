/* ======================================================================
   ARCHIVO: js/2-juego/fase-vectores.js

   FASE DE VECTORES (resolver incógnitas)
   En los niveles de desplazamiento y mixtos, el cochinito recorre sus vectores y el
   jugador debe calcular las incógnitas. Este archivo:
     - anima el recorrido,
     - crea el panel de "Datos conocidos" y las casillas de respuesta,
     - comprueba las respuestas (checkAnswer) y muestra la solución paso a paso.
   ====================================================================== */

/* ---------- fase de vectores ---------- */
// Empieza la animación del cochinito recorriendo sus vectores.
function startAnim() {
  const m = S.def.mov,
    Tg = S.mover;
  S.terrain = S.terrain.filter((t) => !t.final);
  Tg.x = m.ax - 0.6;
  Tg.y = m.ay;
  Tg.hidden = false;
  Tg.fixed = true;
  S.anim = { t: 0, pause: 0.8, legDur: 1.1, prog: 0 };
}

// Avanza la animación del recorrido un poquito (se llama en cada cuadro).
function updateAnim(dt) {
  const a = S.anim;
  if (!a) return;
  a.t += dt;
  const m = S.def.mov,
    pts = S.res.pts,
    Tg = S.mover,
    t = a.t - a.pause;
  if (t < 0) return;
  if (m.showPath) {
    const n = pts.length - 1,
      total = n * a.legDur,
      tt = Math.min(t, total);
    const i = Math.min(n - 1, Math.floor(tt / a.legDur));
    let u = (tt - i * a.legDur) / a.legDur;
    u = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    const x = pts[i].x + (pts[i + 1].x - pts[i].x) * u,
      y = pts[i].y + (pts[i + 1].y - pts[i].y) * u;
    Tg.x = x - 0.6;
    Tg.y = y;
    a.prog = i + u;
    if (t >= total) {
      S.anim = null;
      // Duelo Escondite: al llegar, el cerdito desaparece en una nube (reaparece al acertar las coordenadas)
      if (S.online && S.online.mode === 'hide') {
        puff(S.res.F.x, S.res.F.y + 0.6, C.target);
        Tg.hidden = true;
      } else arriveVisual();
    }
  } else {
    puff(m.ax, m.ay + 0.6, C.target);
    Tg.hidden = true;
    S.anim = null;
  }
}

// Coloca al cochinito en el punto final B al terminar la animación.
function arriveVisual() {
  const F = S.res.F;
  S.mover.x = F.x - 0.6;
  S.mover.y = F.y;
  if (F.y > 0.05 && !S.terrain.some((t) => t.final))
    S.terrain.push({ x: F.x - 0.8, w: 1.6, h: F.y, final: true });
}

// Efecto de "nube" de partículas (cuando el cochinito desaparece o aparece).
function puff(x, y, col) {
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2,
      s = 1 + Math.random() * 3;
    S.parts.push({
      k: 'chip',
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s + 1,
      life: 0.9,
      max: 0.9,
      col,
      size: 0.25,
      nograv: true,
    });
  }
  S.parts.push({ k: 'ring', x, y, life: 0.5, max: 0.5 });
  SND.puff();
}
$('replay').onclick = () => {
  if (S.phase === 'find' && S.def.mov.showPath) startAnim();
};
$('ansCheck').onclick = checkAnswer;

// Crea las casillas donde el jugador escribe sus respuestas.
function buildAnswerForm() {
  const box = $('ansFields'),
    prev = S.items.map((_, i) => {
      const el = $(`ans-${i}`);
      return el ? el.value : '';
    });
  box.innerHTML = '';
  S.items.forEach((it, i) => {
    const lab = document.createElement('label');
    lab.className = 'field' + (it.q === 'dir' ? ' full' : '');
    if (it.q === 'dir')
      lab.innerHTML = `<span></span><select id="ans-${i}"><option value="">${L('Elige una dirección…', 'Choose a direction…')}</option>${DIR_ORDER.map((k) => `<option value="${k}">${dirName(k)}</option>`).join('')}</select>`;
    else lab.innerHTML = `<span></span><input type="number" id="ans-${i}" step="any" inputmode="decimal">`;
    const unit = Q_UNIT[it.q];
    lab.querySelector('span').textContent =
      keyLabel(it.key) +
      (unit ? ` (${unit})` : '') +
      (it.q === 'x' || it.q === 'y' ? L(' con signo', ', signed') : '');
    box.appendChild(lab);
    if (prev[i]) $(`ans-${i}`).value = prev[i];
  });
}

// HTML de una fila de pistas para un vector (sus datos conocidos e incógnitas).
function vecClueRow(owner, kind, show, vals) {
  const qs = owner === 'R' ? R_Q : Q_BY_KIND[kind];
  const items = [];
  qs.forEach((q) => {
    const s = show[q];
    if (s === 'oculto') return;
    const sym = symOf(q, owner);
    if (s === 'inc') items.push(`<span class="unk">${sym} = ?</span>`);
    else if (q === 'dir') items.push(`<span>${L('dirección', 'direction')}: ${fmtQ(q, vals[q])}</span>`);
    else items.push(`<span>${sym} = ${fmtQ(q, vals[q])}</span>`);
  });
  const note =
    owner === 'R'
      ? L(
          'desplazamiento total de A a B (vector resultante)',
          'total displacement from A to B (resultant vector)',
        )
      : kindNote(kind) +
        (kind === 'acc' && show.v0 === 'dato' && vals.v0 === 0
          ? L(' · parte del reposo', ' · starts from rest')
          : '');
  return `<div class="vrow${owner === 'R' ? ' r' : ''}"><b>${vname(owner)}</b>${items.length ? items.join('') : `<span style="color:var(--ink-soft)">${L('sin datos', 'no data')}</span>`}<em>${note}</em></div>`;
}

// Dibuja el panel de "Datos conocidos" y el de respuestas (o la solución si ya terminó).
function renderFind() {
  const d = S.def,
    show = isMov(d);
  $('findUI').hidden = !show;
  $('shootUI').hidden = show && (d.type === 'despl' || S.phase === 'find');
  if (!show) return;
  if (S.online && S.online.mode === 'hide') {
    hideRenderFind();
    return;
  } // duelo Escondite: panel propio (js/5-online/duelo.js)
  const m = d.mov,
    r = S.res,
    n = m.vecs.length;
  let c = `<p>${L(
    `El cochinito parte del punto <b>A</b> y se mueve con ${n === 1 ? 'un vector' : `${n} vectores seguidos`}. Llega al punto <b>B</b>.`,
    `The piglet starts at point <b>A</b> and moves along ${n === 1 ? 'one vector' : `${n} vectors in a row`}. It ends at point <b>B</b>.`,
  )}</p><div class="vlist">`;
  m.vecs.forEach((V, i) => {
    c += vecClueRow(i, V.kind, V.show, r.vals[i]);
  });
  c += vecClueRow('R', null, m.R.show, r.R) + '</div>';
  c += `<p class="hint">${L(
    'Ángulos medidos desde la horizontal (0° a 90°). Componentes con signo: + hacia la derecha o arriba, − hacia la izquierda o abajo.',
    'Angles are measured from the horizontal (0° to 90°). Signed components: + to the right or up, − to the left or down.',
  )}</p>`;
  $('clues').innerHTML = c;
  $('replay').hidden = !m.showPath || S.phase !== 'find';
  $('ansTitle').textContent =
    S.items.length === 1
      ? L('Encuentra la incógnita', 'Find the unknown')
      : L('Encuentra las incógnitas', 'Find the unknowns');
  if (S.phase === 'find') {
    $('ansForm').hidden = false;
    $('ansSol').hidden = true;
    const left = S.ans.tries - S.ans.used;
    $('ansTries').textContent =
      S.ans.tries >= 900
        ? L(
            `Intentos ilimitados · se acepta ±${m.tolD}% en valores y ±${m.tolA}° en ángulos`,
            `Unlimited attempts · ±${m.tolD}% on values and ±${m.tolA}° on angles accepted`,
          )
        : L(
            `${left} intento${left !== 1 ? 's' : ''} · se acepta ±${m.tolD}% en valores y ±${m.tolA}° en ángulos`,
            `${left} attempt${left !== 1 ? 's' : ''} left · ±${m.tolD}% on values and ±${m.tolA}° on angles accepted`,
          );
  } else {
    $('ansForm').hidden = true;
    $('ansSol').hidden = false;
    $('ansSol').innerHTML = solutionHTML();
  }
}

// Construye la solución paso a paso que se muestra al terminar.
function solutionHTML() {
  const m = S.def.mov,
    r = S.res,
    a = S.ans;
  const head = a.solved
    ? `<div class="res" style="color:var(--target-dark)">${a.used > 1 ? L(`¡Correcto en el intento ${a.used}!`, `Correct on attempt ${a.used}!`) : L('¡Correcto al primer intento!', 'Correct on the first try!')} +${a.bonus} ${L('puntos', 'points')}</div>`
    : `<div class="res" style="color:var(--pencil-deep)">${L('Se acabaron los intentos. Esta es la solución:', 'Out of attempts. Here is the solution:')}</div>`;
  let h =
    head +
    (!a.solved && a.lastFb
      ? `<div class="fb" style="font-family:var(--f-body);white-space:normal">${a.lastFb}</div>`
      : '');
  h +=
    `<div class="sub">${L('Respuesta', 'Answer')}</div>` +
    S.items
      .map(
        (it) =>
          `<div class="ans"><span class="k">${keyLabel(it.key)}</span> = <b>${fmtQ(it.q, it.truth)}</b></div>`,
      )
      .join('');
  h += `<div class="sub">${L('Todos los valores del problema', 'Every value in the problem')}</div>`;
  // Cada cálculo se escribe como en el cuaderno: fórmula, sustitución y resultado (ver js/1-nucleo/ecuaciones.js)
  const k = (t) => `<span class="k">${t}</span>`;
  m.vecs.forEach((V, i) => {
    const v = r.vals[i],
      n = vname(i),
      s = n.slice(1);
    h += `<div class="mhead">${n} · ${kindLabel(V.kind).toLowerCase()}</div>`;
    if (V.kind === 'vel')
      h += M.eq(k(`|${n}|`), 'v t', `${fmtN(v.v)} ${M.dot} ${fmtN(v.t)}`, M.res(f(v.d), 'm'));
    if (V.kind === 'acc')
      h += M.eq(
        k(`|${n}|`),
        `v₀ t + ${M.half} a t${M.sup(2)}`,
        `${fmtN(v.v0)} ${M.dot} ${fmtN(v.t)} + ${M.half} ${M.dot} ${fmtN(v.a)} ${M.dot} ${fmtN(v.t)}${M.sup(2)}`,
        M.res(f(v.d), 'm'),
      );
    h +=
      `<div class="mnote">|${n}| = ${f(v.d)} m · θ${s} = ${fmtN(v.ang)}° · ${dirLow(v.dir)}</div>` +
      compEqs(i, v);
  });
  const vs = r.vals;
  h +=
    `<div class="mhead">${L('Resultante R', 'Resultant R')}</div>` +
    sumEq(k('Rₓ'), 'x', vs, r.dx) +
    sumEq(k('Rᵧ'), 'y', vs, r.dy) +
    M.eq(
      k('|R|'),
      M.sqrt(`Rₓ${M.sup(2)} + Rᵧ${M.sup(2)}`),
      M.sqrt(`${M.sq(r.dx)} + ${M.sq(r.dy)}`),
      M.sqrt(`${f(r.dx * r.dx)} + ${f(r.dy * r.dy)}`),
      M.res(f(r.mag), 'm'),
    ) +
    (Math.abs(r.dx) < 1e-6
      ? M.eq(k(L('θ de R', 'θ of R')), M.res('90°') + ` <span class="mnote">(Rₓ = 0)</span>`)
      : M.eq(
          k(L('θ de R', 'θ of R')),
          `tan${M.sup('−1')} ${M.par(M.frac('|Rᵧ|', '|Rₓ|'))}`,
          `tan${M.sup('−1')} ${M.par(M.frac(f(Math.abs(r.dy)), f(Math.abs(r.dx))))}`,
          M.res(f(r.angH, 1) + '°'),
        )) +
    `<div><span class="k">${L('Dirección de R', 'Direction of R')}</span>: <b>${dirLow(r.dir)}</b></div>`;
  if (S.def.type === 'mixto') {
    h +=
      M.eq(
        k('B'),
        'A + R',
        `(x<sub>A</sub> + Rₓ, y<sub>A</sub> + Rᵧ)`,
        `(${M.sum([m.ax, r.dx])}, ${M.sum([m.ay, r.dy])})`,
        M.res(`(${f(r.F.x)}, ${f(r.F.y)})`, 'm'),
      ) +
      `
      <div class="next">${L('Ahora la escala está visible. Lanza para alcanzar al cochinito en B.', 'The scale is visible now. Launch to hit the piglet at B.')}</div>`;
  }
  return h;
}

// ¿Es correcta la respuesta del jugador para una incógnita? Usa las tolerancias del nivel.
function itemCorrect(it, val) {
  const m = S.def.mov,
    r = S.res;
  if (it.q === 'dir') {
    const v = it.owner === 'R' ? { x: r.dx, y: r.dy, ang: r.angH } : r.vals[it.owner];
    return validDirs(v.x, v.y, v.ang, it.truth, m.tolA).includes(val);
  }
  if (it.q === 'ang') return Math.abs(val - it.truth) <= m.tolA;
  return Math.abs(val - it.truth) <= Math.max(ABS_TOL[it.q] || 0.1, (Math.abs(it.truth) * m.tolD) / 100);
}

// Se ejecuta al pulsar "Comprobar": revisa todas las respuestas, da puntos o resta un intento.
function checkAnswer() {
  if (S.online && S.online.mode === 'hide') {
    hideCheck();
    return;
  } // duelo Escondite
  if (S.phase !== 'find') return;
  const a = S.ans;
  const vals = S.items.map((it, i) =>
    it.q === 'dir' ? $(`ans-${i}`).value : parseFloat(String($(`ans-${i}`).value).replace(',', '.')),
  );
  if (vals.some((v, i) => (S.items[i].q === 'dir' ? !v : !isFinite(v)))) {
    $('ansFb').innerHTML =
      `<span class="bad">${L('Completa todas las casillas antes de comprobar.', 'Fill in every box before checking.')}</span>`;
    return;
  }
  a.used++;
  let all = true;
  const lines = S.items
    .map((it, i) => {
      const ok = itemCorrect(it, vals[i]),
        lab = keyLabel(it.key);
      if (!ok) all = false;
      if (ok) return `<span class="ok">✓ ${lab}: ${L('correcto', 'correct')}</span>`;
      if (it.q === 'dir') return `<span class="bad">✗ ${lab}: ${L('incorrecta', 'wrong')}</span>`;
      const wrongSign =
        (it.q === 'x' || it.q === 'y') &&
        Math.abs(it.truth) > 0.3 &&
        Math.sign(vals[i]) !== Math.sign(it.truth);
      return `<span class="bad">✗ ${lab}: ${wrongSign ? L('revisa el signo', 'check the sign') : vals[i] > it.truth ? L('tu valor es demasiado grande', 'your value is too big') : L('tu valor es demasiado pequeño', 'your value is too small')}</span>`;
    })
    .join('');
  a.lastFb = lines;
  if (S.online) onlineAnswer(vals);
  if (all) {
    a.solved = true;
    a.stars = a.used === 1 ? 3 : a.used === 2 ? 2 : 1;
    // Puntos según el intento en que acertó: 1.º = 1500, 2.º = 1000, 3.º = 600...
    a.bonus = [1500, 1000, 600, 400, 300, 200][a.used - 1] || 200;
    S.score += a.bonus;
    SND.good();
    reveal();
    return;
  }
  SND.bad();
  if (a.used >= a.tries) {
    a.failed = true;
    reveal();
    return;
  }
  $('ansFb').innerHTML = lines;
  renderFind();
}

// Muestra dónde terminó el cochinito (al resolver o al quedarse sin intentos).
function reveal() {
  const F = S.res.F,
    Tg = S.mover;
  S.anim = null;
  S.solved = true;
  if (Tg.hidden) puff(F.x, F.y + 0.6, C.target);
  Tg.hidden = false;
  Tg.x = F.x - 0.6;
  Tg.y = F.y;
  if (F.y > 0.05 && !S.terrain.some((t) => t.final))
    S.terrain.push({ x: F.x - 0.8, w: 1.6, h: F.y, final: true });
  floatText(
    F.x,
    F.y + 2.2,
    S.ans.solved ? L('¡Resuelto!', 'Solved!') : L('Aquí estaba', 'It was here'),
    S.ans.solved ? C.vector : C['pencil-deep'],
  );
  S.top = Math.max(S.top, F.y + 3);
  if (S.def.type === 'mixto') {
    S.phase = 'shoot';
    Tg.fixed = false;
  } else {
    S.phase = 'done';
    S.endTimer = 2.2;
  }
  renderFind();
  hud();
  syncUI();
}
