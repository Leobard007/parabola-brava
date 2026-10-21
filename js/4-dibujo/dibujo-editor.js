/* ======================================================================
   ARCHIVO: js/4-dibujo/dibujo-editor.js

   DIBUJO DE LA ESCENA (modo editor)
   Igual que el dibujo del juego, pero con agarradores para arrastrar, arcos de ángulo,
   vista previa de piezas y resaltado de la selección.
   ====================================================================== */

// Altura máxima visible en el editor.
function editTop() {
  const d = E.draft,
    v = d.vars;
  let t = Math.max(
    d.type === 'despl' ? 5 : 16,
    ...d.terrain.map((t) => t.h + 3),
    ...d.objs.map((o) => o.y + o.h + 3),
  );
  if (d.type !== 'despl') t = Math.max(t, (v.h0.locked ? v.h0.def : v.h0.max) + 3);
  if (isMov(d)) t = Math.max(t, ...resultant(d.mov).pts.map((p) => p.y + 3));
  return t;
}

// Dibuja un "agarrador" (círculo, cuadrado o rombo) para arrastrar.
function drawHandle(px, py, kind, col) {
  ctx.lineWidth = 2;
  if (kind === 'sq') {
    ctx.fillStyle = col;
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.rect(px - 6.5, py - 6.5, 13, 13);
    ctx.fill();
    ctx.stroke();
    return;
  }
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = col;
  ctx.beginPath();
  if (kind === 'dia') {
    ctx.moveTo(px, py - 8);
    ctx.lineTo(px + 8, py);
    ctx.lineTo(px, py + 8);
    ctx.lineTo(px - 8, py);
    ctx.closePath();
  } else ctx.arc(px, py, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

// Línea resaltada para el elemento seleccionado.
function glowLine(ax, ay, bx, by, col) {
  ctx.save();
  ctx.strokeStyle = col;
  ctx.globalAlpha = 0.2;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(X(ax), Y(ay));
  ctx.lineTo(X(bx), Y(by));
  ctx.stroke();
  ctx.restore();
}

// Arco que muestra un ángulo con su valor.
function angleArc(ax, ay, vx, vy, col, label) {
  if (Math.hypot(vx, vy) < 0.3) return;
  const cx = X(ax),
    cy = Y(ay),
    rad = Math.max(26, Math.min(60, 1.8 * V.s));
  const ra = vx >= -0.05 ? 0 : Math.PI,
    va = Math.atan2(-vy, vx);
  let diff = va - ra;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff <= -Math.PI) diff += 2 * Math.PI;
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(ra) * rad * 1.5, cy);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, ra, ra + diff, diff < 0);
  ctx.stroke();
  const mid = ra + diff / 2;
  // candidatas a lo largo del arco (en el medio, más afuera y hacia los extremos)
  const cands = [
    [mid, 16],
    [mid, 34],
    [ra + diff * 0.25, 18],
    [ra + diff * 0.75, 18],
  ].map(([a, d]) => ({
    x: cx + Math.cos(a) * (rad + d),
    y: cy + Math.sin(a) * (rad + d),
    h: Math.cos(a) < -0.3 ? 'right' : Math.cos(a) > 0.3 ? 'left' : 'center',
    v: 'middle',
  }));
  queueLabel({ key: 'ang', text: label, col, style: 'box', prio: 9, cands });
}

// Dibuja la escena del editor (se llama en cada cuadro).
function drawEdit() {
  const d = E.draft,
    v = d.vars,
    mv = isMov(d);
  VIS = { lines: E.showGrid, nums: true };
  if (!E.drag) view(d.W, editTop(), d.type === 'despl');
  drawGrid();
  drawGround(d.type === 'despl' ? [] : d.terrain, d.W);

  ctx.strokeStyle = C['pencil-deep'];
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(X(d.W), 0);
  ctx.lineTo(X(d.W), Y(0));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.save();
  ctx.translate(X(d.W) - 6, 40);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = C['pencil-deep'];
  ctx.font = handFont(0.9);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${SET.lang === 'en' ? 'end of world' : 'fin del mundo'} · ${d.W} m`, 0, 0);
  ctx.restore();

  if (d.type !== 'despl' && !v.h0.locked && v.h0.max > v.h0.min) {
    ctx.fillStyle = C.pencil;
    ctx.globalAlpha = 0.14;
    ctx.fillRect(X(-0.9), Y(v.h0.max), 1.8 * V.s, (v.h0.max - v.h0.min) * V.s);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = C.pencil;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(X(-0.9), Y(v.h0.max), 1.8 * V.s, (v.h0.max - v.h0.min) * V.s);
    ctx.setLineDash([]);
  }

  if (mv) {
    const m = d.mov,
      r = resultant(m),
      pts = r.pts;
    const selV = E.sel && E.sel.type === 'vec' && pts[E.sel.i + 1] ? E.sel.i : -1,
      selR = E.sel && E.sel.type === 'R';
    if (m.ay > 0.05) drawTerrainRect({ x: m.ax - 0.8, w: 1.6, h: m.ay });
    if (r.F.y > 0.05) drawTerrainRect({ x: r.F.x - 0.8, w: 1.6, h: r.F.y }, 0.8, true);
    if (selV >= 0) glowLine(pts[selV].x, pts[selV].y, pts[selV + 1].x, pts[selV + 1].y, C.vector);
    if (selR) glowLine(m.ax, m.ay, r.F.x, r.F.y, C['pencil-deep']);
    drawVectors(pts, pts.length - 1, C.vector, (i) => canvasLabel(i, null, r.vals[i], true, m.vecs[i].kind));
    drawResultant(
      m,
      r,
      C['pencil-deep'],
      `R: ${fmtN(r.mag)} m · ${fmtN(r.angH)}° · ${DIR_ARROW[r.dir]}`,
      false,
    );
    drawObj({ k: 'target', x: r.F.x - 0.6, y: r.F.y, w: 1.2, h: 1.2 }, 0.45);
    drawObj({ k: 'target', x: m.ax - 0.6, y: m.ay, w: 1.2, h: 1.2 });
    pointLabel(m.ax, m.ay, 'A', `(${f(m.ax, 1)}, ${f(m.ay, 1)})`, C.vector);
    pointLabel(r.F.x, r.F.y, 'B', `(${f(r.F.x, 1)}, ${f(r.F.y, 1)})`, C['pencil-deep']);
    if (selV >= 0) {
      const a = pts[selV],
        b = pts[selV + 1],
        vv = r.vals[selV];
      angleArc(a.x, a.y, vv.x, vv.y, C.vector, `θ = ${fmtN(vv.ang)}°`);
      drawHandle(X(a.x + (b.x - a.x) * 0.62), Y(a.y + (b.y - a.y) * 0.62), 'dia', C.vector);
    }
    if (selR) angleArc(m.ax, m.ay, r.dx, r.dy, C['pencil-deep'], `θ = ${fmtN(r.angH)}°`);
    pts.slice(1, -1).forEach((p) => drawHandle(X(p.x), Y(p.y), 'ci', C.vector));
    drawHandle(X(r.F.x), Y(r.F.y), 'sq', C['pencil-deep']);
  }
  if (d.type === 'despl') return;

  for (const o of d.objs) drawObj(o);
  drawLauncher(v.h0.def);
  const ox = X(0),
    oy = Y(v.h0.def),
    L = 4.5 * V.s;
  if (!v.ang.locked) {
    const a1 = (-v.ang.max * Math.PI) / 180,
      a2 = (-v.ang.min * Math.PI) / 180;
    ctx.fillStyle = C.pencil;
    ctx.globalAlpha = 0.1;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.arc(ox, oy, L, a1, a2);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = C.pencil;
    ctx.lineWidth = 1;
    [a1, a2].forEach((a) => {
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(a) * L, oy + Math.sin(a) * L);
      ctx.stroke();
    });
    ctx.fillStyle = C['pencil-deep'];
    ctx.font = handFont(0.9);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(
      `θ: ${v.ang.min}° ${SET.lang === 'en' ? 'to' : 'a'} ${v.ang.max}°`,
      ox + Math.cos(a1) * L + 4,
      oy + Math.sin(a1) * L,
    );
  }
  dashedPath(v.v0.def, v.ang.def, v.h0.def, v.g.def, d.W, C['ink-soft'], 1.5);
  const lt = launcherTip(v);
  arrow(ox, oy, lt.x, lt.y, C['pencil-deep']);
  ctx.font = handFont();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = C['pencil-deep'];
  const ltTxt = `v₀ = ${fmtN(v.v0.def)} m/s · θ = ${fmtN(v.ang.def)}°`;
  ctx.fillText(ltTxt, lt.x + 8, lt.y - 6);
  labelObstacle(lt.x + 8, lt.y - 28, ctx.measureText(ltTxt).width, 22);
  drawBall(0, v.h0.def, 1, 0);
  if (E.sel && E.sel.type === 'launcher') {
    ctx.strokeStyle = C['pencil-deep'];
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(X(-0.9), Y(v.h0.def + 1.3), 1.8 * V.s, (v.h0.def + 1.3) * V.s);
    ctx.setLineDash([]);
  }
  drawHandle(lt.x, lt.y, 'ci', C['pencil-deep']);
  drawHandle(X(-0.6), oy, 'sq', C['ink-soft']);

  if (E.pointer && !E.drag && !['select', 'erase', 'start'].includes(E.tool)) {
    const gh = ghostFor(E.pointer, E.tool);
    if (gh.type === 'terrain') drawTerrainRect(gh.ref, 0.45);
    else drawObj(gh.ref, 0.5);
  }
  if (E.pointer && !E.drag && (E.tool === 'select' || E.tool === 'erase')) {
    const h = hitTest(E.pointer);
    if (h && (!E.sel || h.ref !== E.sel.ref)) outline(h, E.tool === 'erase' ? C.pencil : C.ink, false);
  }
  if (E.sel && E.sel.ref) outline(E.sel, C.pencil, true);
}

// Contorno punteado alrededor de la pieza seleccionada.
function outline(s, col, withHandle) {
  const o = s.ref,
    isT = s.type === 'terrain';
  const x = X(o.x),
    y = Y(isT ? o.h : o.y + o.h),
    w = o.w * V.s,
    h = o.h * V.s;
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
  ctx.setLineDash([]);
  if (withHandle && o.k !== 'target') {
    ctx.fillStyle = C.pencil;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(x + w - 6, y - 6, 12, 12);
    ctx.fill();
    ctx.stroke();
  }
}
