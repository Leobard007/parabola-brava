/* ======================================================================
   ARCHIVO: js/4-dibujo/dibujo-juego.js

   DIBUJO DE LA ESCENA (modo juego)
   Todo lo que se ve dentro del recuadro de juego se dibuja en un <canvas>, en cada cuadro.
   Conversión de unidades: el mundo está en metros; X() e Y() los convierten a píxeles.
   Para cambiar el aspecto del cochinito, de los bloques o del lanzador, mira drawObj y drawLauncher.
   ====================================================================== */

/* =========================================================
   RENDER
   ========================================================= */

// Tamaño del canvas: dpr = densidad de píxeles de la pantalla; cw / ch = ancho / alto en píxeles CSS.
let dpr = 1,
  cw = 0,
  ch = 0;

// Ajusta el tamaño interno del canvas cuando cambia el tamaño de la ventana.
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cw = cv.clientWidth;
  ch = cv.clientHeight;
  cv.width = Math.round(cw * dpr);
  cv.height = Math.round(ch * dpr);
  if (VIEW === 'game' && S.screen === 'edit') requestAnimationFrame(() => positionPop());
}
new ResizeObserver(resize).observe(cv);
resize();

// Vista actual: escala (s = píxeles por metro) y esquina inferior izquierda visible (x0, y0).
let V = { s: 10, x0: -4, y0: -2 };

// Calcula la escala para que quepa todo el mundo del nivel en el canvas.
function view(W, top, compact) {
  const xa = compact ? 0 : -5,
    xb = W + 2,
    ya = -2.2,
    yb = top + (compact ? 3 : 6);
  const s = Math.min(cw / (xb - xa), ch / (yb - ya));
  V = { s, x0: xa - (cw / s - (xb - xa)) / 2, y0: ya };
}

// Convierte metros a píxeles: X(x) para el eje horizontal, Y(y) para el vertical (en pantalla, y crece hacia abajo).
const X = (x) => (x - V.x0) * V.s,
  Y = (y) => ch - (y - V.y0) * V.s;

// Tipografía "a mano" para las etiquetas de la escena.
const handFont = (k = 1) =>
  `${Math.round(Math.max(12, Math.min(19, V.s * 0.75)) * k)}px Kalam, 'Comic Sans MS', cursive`;

// Qué referencias de escala se dibujan (líneas de la cuadrícula y números).
let VIS = { lines: true, nums: true }; // qué referencias de escala se dibujan en este cuadro

// Dibuja el papel milimetrado y los números de los ejes.
function drawGrid() {
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, cw, ch);
  const s = V.s,
    step = s >= 14 ? 1 : s >= 7 ? 2 : 5,
    major = step >= 5 ? 10 : 5;
  const xEnd = V.x0 + cw / s,
    yEnd = V.y0 + ch / s;
  if (VIS.lines) {
    ctx.lineWidth = 1;
    for (let x = Math.ceil(V.x0 / step) * step; x <= xEnd; x += step) {
      ctx.strokeStyle = x % major === 0 ? C['grid-major'] : C.grid;
      ctx.beginPath();
      ctx.moveTo(Math.round(X(x)) + 0.5, 0);
      ctx.lineTo(Math.round(X(x)) + 0.5, Y(0));
      ctx.stroke();
    }
    for (let y = 0; y <= yEnd; y += step) {
      ctx.strokeStyle = y % major === 0 ? C['grid-major'] : C.grid;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(Y(y)) + 0.5);
      ctx.lineTo(cw, Math.round(Y(y)) + 0.5);
      ctx.stroke();
    }
  }
  if (VIS.lines || VIS.nums) {
    ctx.fillStyle = C['ink-soft'];
    ctx.font = `11px 'IBM Plex Mono', monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    for (let y = major; y <= yEnd - 1; y += major) ctx.fillText(VIS.nums ? y + ' m' : '?', 6, Y(y) - 7);
  }
}

// Rayado diagonal (para el terreno).
function hatch(x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = C['earth-dark'];
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  for (let i = -h; i < w; i += 9) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + h);
    ctx.lineTo(x + i + h, y);
    ctx.stroke();
  }
  ctx.restore();
}

// Dibuja un bloque de terreno.
function drawTerrainRect(t, alpha = 1, dashed = false) {
  const gy = Y(0),
    x = X(t.x),
    y = Y(t.h),
    w = t.w * V.s,
    h = gy - y;
  ctx.globalAlpha = alpha;
  if (dashed) {
    ctx.strokeStyle = C['earth-dark'];
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    return;
  }
  ctx.fillStyle = C.earth;
  ctx.fillRect(x, y, w, h);
  hatch(x, y, w, h);
  ctx.strokeStyle = C['earth-dark'];
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h);
  ctx.fillStyle = C['target-dark'];
  ctx.fillRect(x, y, w, Math.max(3, V.s * 0.2));
  ctx.globalAlpha = 1;
}

// Dibuja el suelo y el terreno.
function drawGround(terrain, W) {
  const gy = Y(0);
  ctx.fillStyle = C.earth;
  ctx.fillRect(0, gy, cw, ch - gy);
  hatch(0, gy, cw, ch - gy);
  for (const t of terrain) drawTerrainRect(t);
  ctx.fillStyle = C['target-dark'];
  ctx.fillRect(0, gy, cw, Math.max(3, V.s * 0.2));
  if (!VIS.lines && !VIS.nums) return;
  const major = V.s >= 7 ? 5 : 10;
  ctx.fillStyle = '#f3ece2';
  ctx.font = `11px 'IBM Plex Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let x = 0; x <= W; x += major) {
    ctx.fillRect(X(x) - 0.5, gy + 3, 1, 5);
    ctx.fillText(x === 0 ? '0' : VIS.nums ? String(x) : '?', X(x), gy + 10);
  }
  const lbl = VIS.nums ? 'x (m)' : L('escala oculta', 'scale hidden'),
    lw = ctx.measureText(lbl).width;
  ctx.textAlign = 'left';
  ctx.fillText(lbl, Math.min(cw - lw - 6, X(W) + 10), VIS.nums ? gy + 10 : gy + 26);
}

// Dibuja una pieza: madera, piedra u objetivo (el cochinito verde con ojos).
function drawObj(o, alpha = 1) {
  const x = X(o.x),
    y = Y(o.y + o.h),
    w = o.w * V.s,
    h = o.h * V.s;
  ctx.globalAlpha = alpha;
  if (o.k === 'target') {
    const cx = x + w / 2,
      cy = y + h / 2,
      r = w / 2;
    ctx.fillStyle = C.target;
    ctx.strokeStyle = C['target-dark'];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - r * 0.55, cy - r * 0.85, r * 0.22, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.55, cy - r * 0.85, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    const blink = o.blink != null && (S.time + o.blink) % 4 < 0.12;
    ctx.fillStyle = '#fff';
    [-1, 1].forEach((sd) => {
      ctx.beginPath();
      ctx.ellipse(cx + sd * r * 0.35, cy - r * 0.1, r * 0.22, blink ? r * 0.04 : r * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    if (!blink) {
      ctx.fillStyle = C.ink;
      [-1, 1].forEach((sd) => {
        ctx.beginPath();
        ctx.arc(cx + sd * r * 0.35 - r * 0.06, cy - r * 0.08, r * 0.1, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.strokeStyle = C['target-dark'];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.3, r * 0.25, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }
  const stone = o.k === 'stone';
  ctx.fillStyle = stone ? C.stone : C.wood;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = stone ? C['stone-dark'] : C['wood-dark'];
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.lineWidth = 1;
  ctx.globalAlpha = alpha * 0.5;
  ctx.beginPath();
  if (stone) {
    ctx.moveTo(x + w * 0.2, y + h * 0.3);
    ctx.lineTo(x + w * 0.45, y + h * 0.32);
    ctx.moveTo(x + w * 0.6, y + h * 0.7);
    ctx.lineTo(x + w * 0.82, y + h * 0.66);
  } else if (w > h) {
    ctx.moveTo(x + 4, y + h * 0.5);
    ctx.lineTo(x + w - 4, y + h * 0.5);
  } else {
    ctx.moveTo(x + w * 0.5, y + 4);
    ctx.lineTo(x + w * 0.5, y + h - 4);
  }
  ctx.stroke();
  ctx.globalAlpha = alpha;
  if (stone && o.hp === 1) {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.3, y + 2);
    ctx.lineTo(x + w * 0.55, y + h * 0.4);
    ctx.lineTo(x + w * 0.4, y + h * 0.65);
    ctx.lineTo(x + w * 0.7, y + h - 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Dibuja el proyectil.
function drawBall(x, y, vx, vy, alpha = 1) {
  const px = X(x),
    py = Y(y),
    r = R * V.s;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = C.pencil;
  ctx.strokeStyle = C['pencil-deep'];
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const a = Math.atan2(-vy, vx);
  const ex = px + Math.cos(a) * r * 0.35,
    ey = py + Math.sin(a) * r * 0.35 - r * 0.15;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(ex, ey, r * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.arc(ex + Math.cos(a) * r * 0.12, ey + Math.sin(a) * r * 0.12, r * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = Math.max(1.5, r * 0.14);
  ctx.beginPath();
  ctx.moveTo(ex - r * 0.35, ey - r * 0.5);
  ctx.lineTo(ex + r * 0.3, ey - r * 0.32);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// Dibuja el lanzador (torre + horquilla) a la altura h0.
function drawLauncher(h0) {
  const top = Y(h0),
    base = Y(0),
    xl = X(-0.6),
    w = 1.2 * V.s;
  if (h0 > 0.05) {
    ctx.fillStyle = C['ink-soft'];
    ctx.fillRect(xl, top, w, base - top);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(xl + 1, top + 1, w - 2, base - top - 1);
    ctx.strokeStyle = C.paper;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    for (let y = top + 8; y < base; y += 10) {
      ctx.beginPath();
      ctx.moveTo(xl + 3, y);
      ctx.lineTo(xl + w - 3, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (VIS.nums) {
      const dx = X(-2.2);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(dx, base);
      ctx.lineTo(dx, top);
      ctx.moveTo(dx - 4, top);
      ctx.lineTo(dx + 4, top);
      ctx.moveTo(dx - 4, base);
      ctx.lineTo(dx + 4, base);
      ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.font = handFont();
      ctx.save();
      ctx.translate(dx - 6, (top + base) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`h₀ = ${f(h0, 1)} m`, 0, 0);
      ctx.restore();
    }
  }
  ctx.strokeStyle = C['wood-dark'];
  ctx.lineWidth = Math.max(3, V.s * 0.22);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(X(0), top);
  ctx.lineTo(X(-0.45), Y(h0 + 1));
  ctx.moveTo(X(0), top);
  ctx.lineTo(X(0.45), Y(h0 + 1));
  ctx.stroke();
  ctx.lineCap = 'butt';
}

// Dibuja una flecha de (ox, oy) a (ex, ey).
function arrow(ox, oy, ex, ey, col, width = 2.5, hs = 10) {
  ctx.strokeStyle = col;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  if (hs < 1 || Math.hypot(ex - ox, ey - oy) < 2) return;
  const a = Math.atan2(ey - oy, ex - ox);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - hs * Math.cos(a - 0.4), ey - hs * Math.sin(a - 0.4));
  ctx.lineTo(ex - hs * Math.cos(a + 0.4), ey - hs * Math.sin(a + 0.4));
  ctx.fill();
}

// Dibuja la trayectoria completa como línea punteada (vista previa).
function dashedPath(v0, ang, h0, gg, W, col, width = 2) {
  const th = (ang * Math.PI) / 180,
    vx = v0 * Math.cos(th),
    vy = v0 * Math.sin(th);
  ctx.strokeStyle = col;
  ctx.setLineDash([7, 6]);
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let t = 0; t <= 60; t += 0.02) {
    const x = vx * t,
      y = h0 + vy * t - 0.5 * gg * t * t;
    if (t === 0) ctx.moveTo(X(x), Y(y));
    else ctx.lineTo(X(x), Y(y));
    if (y < 0 || x > W + 10) break;
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

// Dibuja la flecha de puntería con v0 y θ, y la trayectoria si el modo práctica está activo.
function drawAim() {
  if (S.mode !== 'aim' || S.phase !== 'shoot') return;
  const th = (P.ang * Math.PI) / 180,
    ox = X(0),
    oy = Y(P.h0);
  const vx = P.v0 * Math.cos(th),
    vy = P.v0 * Math.sin(th);
  ctx.strokeStyle = C['ink-soft'];
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(ox + 3.2 * V.s, oy);
  ctx.stroke();
  ctx.setLineDash([]);
  const ar = 2.2 * V.s;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(ox, oy, ar, th > 0 ? -th : 0, th > 0 ? 0 : -th);
  ctx.stroke();
  ctx.fillStyle = C.ink;
  ctx.font = handFont();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const thTxt = `θ = ${P.ang}°`,
    thY = oy - Math.sin(th / 2) * ar - 2,
    thW = ctx.measureText(thTxt).width;
  ctx.fillText(thTxt, ox + ar + 6, thY);
  labelObstacle(ox + ar + 6, thY - 10, thW, 20); // las etiquetas no se ponen encima de este texto
  if ($('practice').checked) {
    dashedPath(P.v0, P.ang, P.h0, g, S.def.W, C.pencil);
    const t2 = theory(P.v0, P.ang, P.h0, g);
    marker(t2.range, 0, `R = ${f(t2.range, 1)} m`, C.pencil, 'below', 'pr:range');
    if (t2.vy > 0)
      marker(
        t2.vx * t2.tApex,
        t2.hmax,
        `${L('h máx', 'max h')} = ${f(t2.hmax, 1)} m`,
        C.pencil,
        'above',
        'pr:hmax',
      );
  } else {
    ctx.fillStyle = C.pencil;
    for (let t = 0.08; t <= 0.45; t += 0.06) {
      const x = vx * t,
        y = P.h0 + vy * t - 0.5 * g * t * t;
      ctx.beginPath();
      ctx.arc(X(x), Y(y), Math.max(2, V.s * 0.12), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const k = 0.13,
    ex = ox + vx * k * V.s,
    ey = oy - vy * k * V.s;
  arrow(ox, oy, ex, ey, C['pencil-deep']);
  ctx.font = handFont(1.05);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = C['pencil-deep'];
  const v0Txt = `v₀ = ${f(P.v0, 1)} m/s`;
  ctx.fillText(v0Txt, ex + 6, ey - 4);
  labelObstacle(ex + 6, ey - 26, ctx.measureText(v0Txt).width, 22);
  drawBall(0, P.h0, vx, vy);
}

// Marca un punto con un texto (ej. "h máx = 5 m").
function marker(x, y, text, col, where, key) {
  const px = X(x),
    py = Y(y);
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px - 5, py - 5);
  ctx.lineTo(px + 5, py + 5);
  ctx.moveTo(px + 5, py - 5);
  ctx.lineTo(px - 5, py + 5);
  ctx.stroke();
  const above = where === 'above',
    ty = above ? py - 8 : py + (y <= 0.01 ? -8 : 8),
    vv = above || y <= 0.01 ? 'bottom' : 'top';
  // candidatas: centrada, desplazada a la derecha o a la izquierda, y del otro lado
  queueLabel({
    key: key || 'mk:' + text,
    text,
    col,
    style: 'hand',
    prio: 7,
    pt: [px, py],
    cands: [
      { x: px, y: ty, h: 'center', v: vv },
      { x: px + 10, y: ty, h: 'left', v: vv },
      { x: px - 10, y: ty, h: 'right', v: vv },
      { x: px, y: above ? py + 8 : py - 8, h: 'center', v: above ? 'top' : 'bottom' },
    ],
  });
}
// Etiqueta con recuadro en una posición fija (se acomoda con las demás)
// Texto con fondo de papel, para que se lea sobre la cuadrícula.
function textBox(px, py, text, col, align = 'left') {
  queueLabel({ text, col, style: 'box', prio: 1, cands: [{ x: px, y: py, h: align, v: 'middle' }] });
}

// Etiqueta de un punto (A, B) con sus coordenadas.
function pointLabel(x, y, name, text, col) {
  const px = X(x),
    py = Y(y);
  ctx.fillStyle = col;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const label = text ? `${name} ${text}` : name;
  // abajo a la derecha (como siempre), arriba a la derecha, abajo a la izquierda o arriba a la izquierda
  queueLabel({
    key: 'pt:' + name,
    text: label,
    col,
    style: 'point',
    prio: 6,
    pt: [px, py],
    cands: [
      { x: px + 8, y: py + 5, h: 'left', v: 'top' },
      { x: px + 8, y: py - 7, h: 'left', v: 'bottom' },
      { x: px - 8, y: py + 5, h: 'right', v: 'top' },
      { x: px - 8, y: py - 7, h: 'right', v: 'bottom' },
    ],
  });
}
/* Dibuja los vectores (hasta `upto` tramos) con su etiqueta. labelFn(i) devuelve el texto o null. */
// Dibuja la cadena de vectores con sus etiquetas.
function drawVectors(pts, upto, col, labelFn) {
  for (let i = 0; i < pts.length - 1; i++) {
    if (upto <= i) break;
    const u = Math.min(1, upto - i),
      a = pts[i],
      b = pts[i + 1];
    const ex = a.x + (b.x - a.x) * u,
      ey = a.y + (b.y - a.y) * u;
    ctx.setLineDash(u < 1 ? [6, 5] : []);
    arrow(X(a.x), Y(a.y), X(ex), Y(ey), col, 2.2, u < 1 ? 0 : 10);
    ctx.setLineDash([]);
    if (u >= 1 && labelFn) {
      const txt = labelFn(i);
      if (!txt) continue;
      const seg = [X(a.x), Y(a.y), X(b.x), Y(b.y)];
      // la etiqueta prefiere ir arriba del vector; si choca, prueba otros lugares (ver etiquetas.js)
      queueLabel({
        key: 'v' + i,
        text: txt,
        col,
        style: 'box',
        prio: 4,
        seg,
        cands: segCands(...seg, 1, 14),
      });
    }
  }
}

// Dibuja la resultante R (línea discontinua de A a B).
function drawResultant(m, r, col, label, comps) {
  const A = { x: m.ax, y: m.ay },
    F = r.F;
  if (comps) {
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha *= 0.7;
    ctx.beginPath();
    ctx.moveTo(X(A.x), Y(A.y));
    ctx.lineTo(X(F.x), Y(A.y));
    ctx.lineTo(X(F.x), Y(F.y));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = Math.min(1, ctx.globalAlpha / 0.7);
  }
  ctx.setLineDash([9, 5]);
  arrow(X(A.x), Y(A.y), X(F.x), Y(F.y), col, 3, 12);
  ctx.setLineDash([]);
  if (label) {
    const seg = [X(A.x), Y(A.y), X(F.x), Y(F.y)];
    // la de R prefiere ir por debajo, para no chocar con los vectores
    queueLabel({ key: 'R', text: label, col, style: 'box', prio: 5, seg, cands: segCands(...seg, -1, 16) });
  }
}

// Dibuja el rastro de un tiro (actual o anteriores).
function drawTrail(p, kind) {
  ctx.fillStyle = kind === 'live' ? C.pencil : C['ink-soft'];
  ctx.globalAlpha = kind === 'old' ? 0.28 : kind === 'last' ? 0.75 : 1;
  const r = Math.max(1.8, V.s * 0.1);
  for (const q of p.pts) {
    ctx.beginPath();
    ctx.arc(X(q.x), Y(q.y), r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Dibuja las partículas.
function drawParts() {
  for (const p of S.parts) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    if (p.k === 'chip') {
      const sz = p.size * V.s;
      ctx.fillStyle = p.col;
      ctx.save();
      ctx.translate(X(p.x), Y(p.y));
      ctx.rotate(p.rot || 0);
      ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
      ctx.restore();
    } else if (p.k === 'ring') {
      ctx.strokeStyle = C.target;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(X(p.x), Y(p.y), (1 - a) * 2.4 * V.s + 4, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.k === 'text') {
      ctx.fillStyle = p.col;
      ctx.font = handFont(1.15);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.text, X(p.x), Y(p.y));
    }
  }
  ctx.globalAlpha = 1;
}

// ¿Alguna de esas magnitudes es visible?
function hasShown(show, qs) {
  return qs.some((q) => show[q] !== 'oculto');
}

// Dibuja la escena completa del modo juego (se llama en cada cuadro).
function drawPlay() {
  const d = S.def,
    mv = isMov(d);
  VIS = mv
    ? { lines: d.grid || S.solved, nums: !d.mov.hideScale || S.solved }
    : { lines: d.grid, nums: true };
  view(d.W, S.top, d.type === 'despl');
  drawGrid();
  drawGround(S.terrain, d.W);
  if (mv) {
    const m = d.mov,
      r = S.res;
    if (!S.solved) {
      if (m.showPath) {
        const done = !S.anim;
        drawVectors(r.pts, S.anim ? S.anim.prog || 0 : r.pts.length - 1, C.vector, (i) =>
          canvasLabel(i, m.vecs[i].show, r.vals[i], false, m.vecs[i].kind),
        );
        if (done && hasShown(m.R.show, R_Q))
          drawResultant(m, r, C['pencil-deep'], canvasLabel('R', m.R.show, r.R, false), false);
      } else if (S.mover.hidden) {
        ctx.fillStyle = C.vector;
        ctx.font = `${Math.round(Math.max(28, V.s * 2.4))}px 'Lilita One', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.globalAlpha = 0.55 + 0.2 * Math.sin(S.time * 3);
        ctx.fillText('?', X(m.ax), Y(m.ay + 1.4));
        ctx.globalAlpha = 1;
      }
      pointLabel(m.ax, m.ay, 'A', VIS.nums ? `(${f(m.ax, 1)}, ${f(m.ay, 1)})` : '', C.vector);
    } else {
      const aiming = S.phase !== 'shoot' || (S.mode === 'aim' && !S.proj);
      ctx.globalAlpha = aiming ? 0.9 : 0.3;
      drawVectors(
        r.pts,
        r.pts.length - 1,
        C.vector,
        aiming ? (i) => canvasLabel(i, null, r.vals[i], true, m.vecs[i].kind) : null,
      );
      ctx.globalAlpha = aiming ? 1 : 0.3;
      drawResultant(
        m,
        r,
        C['pencil-deep'],
        aiming ? `R: ${fmtN(r.mag)} m · ${fmtN(r.angH)}° · ${DIR_ARROW[r.dir]}` : null,
        aiming,
      );
      ctx.globalAlpha = 1;
      pointLabel(m.ax, m.ay, 'A', `(${f(m.ax, 1)}, ${f(m.ay, 1)})`, C.vector);
      pointLabel(r.F.x, r.F.y, 'B', `(${f(r.F.x, 1)}, ${f(r.F.y, 1)})`, C.vector);
    }
  }
  S.trails.forEach((p, i) => drawTrail(p, i === S.trails.length - 1 && !S.proj ? 'last' : 'old'));
  for (const o of S.objs) if (o.alive && !o.hidden) drawObj(o);
  if (d.type !== 'despl') drawLauncher(S.mode === 'fly' && S.proj ? S.proj.h0 : P.h0);
  drawAim();
  const p = S.proj;
  if (p) {
    drawTrail(p, 'live');
    const vy = p.vy0 - p.g * p.t;
    if (!p.done) drawBall(p.x, p.y, p.vx, vy);
    else drawBall(p.x, Math.max(p.y, 0), p.vx, vy, Math.max(0, 1 - p.doneT));
    if (!p.done && Y(p.y) < 0) {
      const px = Math.min(cw - 14, Math.max(14, X(p.x)));
      ctx.fillStyle = C.pencil;
      ctx.beginPath();
      ctx.moveTo(px, 6);
      ctx.lineTo(px - 8, 20);
      ctx.lineTo(px + 8, 20);
      ctx.fill();
      ctx.font = handFont();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`y = ${f(p.y, 1)} m`, px, 22);
    }
    if (p.done && p.hit !== 'out') {
      if (p.ymax > p.h0 + 0.3)
        marker(p.apexX, p.ymax, `${L('h máx', 'max h')} = ${f(p.ymax, 1)} m`, C.ink, 'above', 'sh:hmax');
      marker(p.x, Math.max(0, p.y), `x = ${f(p.x, 1)} m`, C.ink, 'below', 'sh:x');
    }
  } else if (S.last && S.mode === 'aim' && S.last.hit !== 'out') {
    const q = S.last;
    ctx.globalAlpha = 0.7;
    if (q.ymax > q.h0 + 0.3)
      marker(
        q.apexX,
        q.ymax,
        `${L('h máx', 'max h')} = ${f(q.ymax, 1)} m`,
        C['ink-soft'],
        'above',
        'sh:hmax',
      );
    marker(q.x, Math.max(0, q.y), `x = ${f(q.x, 1)} m`, C['ink-soft'], 'below', 'sh:x');
    ctx.globalAlpha = 1;
  }
  drawParts();
}
