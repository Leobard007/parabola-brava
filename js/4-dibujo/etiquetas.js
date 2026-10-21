/* ======================================================================
   ARCHIVO: js/4-dibujo/etiquetas.js

   ACOMODO DE ETIQUETAS
   Evita que las etiquetas de los vectores (y de R, A, B, h máx...) se encimen, sobre todo en
   pantallas pequeñas. Durante el cuadro se juntan todas; al final se colocan por prioridad
   en la primera posición libre. Las que no caben se ocultan (queda un círculo "i") y aparecen
   al pasar el ratón sobre su vector o al tocarlo en el teléfono.
   ====================================================================== */

/* =========================================================
   ACOMODO DE ETIQUETAS
   En lugar de dibujar cada etiqueta en cuanto se pide, se guardan en una lista
   durante el cuadro y al final se colocan todas juntas:
     1. Se ordenan por prioridad (las más importantes primero).
     2. Cada una prueba varias posiciones posibles ("candidatas") alrededor de su vector o punto.
     3. Se usa la primera posición que no se encime con otra etiqueta ya colocada.
     4. Si ninguna cabe, la etiqueta se oculta y en su lugar queda un pequeño círculo "i".
        Al pasar el ratón por encima del vector (o tocarlo en el teléfono) la etiqueta aparece.
   ========================================================= */

// Estado del acomodo de etiquetas: lista del cuadro, zonas ocupadas, zonas táctiles, etiqueta señalada (hover / pinned).
const LBL = { list: [], obstacles: [], hits: [], hover: null, pinned: null, hidden: new Set() };

// Empieza un cuadro nuevo: vacía la lista (se llama en el bucle principal, antes de dibujar)
// Empieza un cuadro nuevo de etiquetas.
function labelsBegin() {
  LBL.list = [];
  LBL.obstacles = [];
  LBL.hits = [];
}

// Medidas de cada estilo de etiqueta: box = recuadro con borde, point = texto a mano con fondo, hand = texto a mano sin fondo
// Tipografía de cada estilo de etiqueta.
function labelFont(style) {
  if (style === 'box')
    return `600 ${Math.round(Math.max(12, Math.min(15, V.s * 0.62)))}px 'IBM Plex Sans', sans-serif`;
  return handFont(style === 'point' ? 1.05 : 1);
}

// Márgenes interiores (horizontal, vertical) de cada estilo de etiqueta.
const LBL_PAD = { box: [4, 3], point: [3, 2], hand: [2, 1] };

/* Pide una etiqueta.
   o = { key, text, col, style, prio, cands: [{ x, y, h: 'left'|'center'|'right', v: 'top'|'middle'|'bottom' }],
         seg: [ax, ay, bx, by] (vector, en píxeles) o pt: [x, y] (punto) para poder tocarla }
   Si no hay modo de acomodo activo, se dibuja directamente en la primera candidata. */

// Pide una etiqueta: se guarda con sus posiciones candidatas y se coloca al final del cuadro.
function queueLabel(o) {
  ctx.font = labelFont(o.style);
  const tw = ctx.measureText(o.text).width,
    fs = parseInt(ctx.font.match(/(\d+)px/)[1], 10);
  const [px, py] = LBL_PAD[o.style];
  o.w = tw + px * 2;
  o.h = fs + py * 2;
  o.fs = fs;
  o.alpha = ctx.globalAlpha;
  o.rects = o.cands.map((c) => {
    let x = c.h === 'center' ? c.x - o.w / 2 : c.h === 'right' ? c.x - o.w : c.x;
    let y = c.v === 'middle' ? c.y - o.h / 2 : c.v === 'bottom' ? c.y - o.h : c.y;
    x = clamp(x, 2, cw - o.w - 2);
    y = clamp(y, 2, ch - o.h - 2); // nunca fuera del canvas
    return { x, y, w: o.w, h: o.h };
  });
  LBL.list.push(o);
  if (o.seg || o.pt) LBL.hits.push({ key: o.key, seg: o.seg, pt: o.pt });
}
// Zona ocupada por un texto que se dibuja directamente (para que las etiquetas la eviten)
// Marca una zona ocupada por texto dibujado directamente, para que las etiquetas la eviten.
function labelObstacle(x, y, w, h) {
  LBL.obstacles.push({ x, y, w, h });
}

// ¿Se tocan dos rectángulos? (m = margen extra en píxeles)
const rectsOverlap = (a, b, m = 2) =>
  a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;

// Coloca y dibuja todas las etiquetas del cuadro
// Coloca todas las etiquetas sin encimarlas; las que no caben se ocultan y dejan un círculo "i".
function labelsFlush() {
  const placed = LBL.obstacles.slice(),
    active = LBL.pinned || LBL.hover,
    hidden = new Set();
  const order = LBL.list
    .map((o, i) => [o, i])
    .sort((a, b) => (b[0].prio || 0) - (a[0].prio || 0) || a[1] - b[1]);
  const draw = [],
    forced = [];
  for (const [o] of order) {
    if (o.key && o.key === active) {
      forced.push(o);
      continue;
    } // la señalada se dibuja al final, encima de todo
    const r = o.rects.find((rc) => !placed.some((p) => rectsOverlap(rc, p)));
    if (r) {
      placed.push(r);
      draw.push([o, r]);
    } else hidden.add(o);
  }
  LBL.hidden = new Set([...hidden].map((o) => o.key).filter(Boolean));
  draw.forEach(([o, r]) => paintLabel(o, r));
  // marcador "i" donde quedó una etiqueta oculta
  hidden.forEach((o) => {
    if (!o.key || (!o.seg && !o.pt)) return;
    const [mx, my] = o.seg ? [(o.seg[0] + o.seg[2]) / 2, (o.seg[1] + o.seg[3]) / 2] : o.pt;
    ctx.globalAlpha = o.alpha;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = o.col;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx, my, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = o.col;
    ctx.font = "700 10px 'IBM Plex Sans', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('i', mx, my + 0.5);
    ctx.globalAlpha = 1;
  });
  // la etiqueta señalada (ratón encima o tocada): resalta su vector y se dibuja en la mejor posición libre
  forced.forEach((o) => {
    if (o.seg) {
      ctx.save();
      ctx.strokeStyle = o.col;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(o.seg[0], o.seg[1]);
      ctx.lineTo(o.seg[2], o.seg[3]);
      ctx.stroke();
      ctx.restore();
    }
    const r = o.rects.find((rc) => !placed.some((p) => rectsOverlap(rc, p))) || o.rects[0];
    paintLabel({ ...o, alpha: 1 }, r, true);
  });
}

// Dibuja una etiqueta en el rectángulo elegido.
function paintLabel(o, r, strong) {
  const [px, py] = LBL_PAD[o.style];
  ctx.globalAlpha = o.alpha;
  ctx.font = labelFont(o.style);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  if (o.style !== 'hand' || strong) {
    ctx.fillStyle = C.paper;
    ctx.globalAlpha = o.alpha * (o.style === 'point' ? 0.85 : 0.92);
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.globalAlpha = o.alpha;
  }
  if (o.style === 'box' || strong) {
    ctx.strokeStyle = o.col;
    ctx.lineWidth = strong ? 2 : 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  }
  ctx.fillStyle = o.col;
  ctx.fillText(o.text, r.x + px, r.y + py + (o.style === 'box' ? 0 : 1));
  ctx.globalAlpha = 1;
}

/* Candidatas para la etiqueta de un segmento (vector o R): a ambos lados, a distintas distancias
   y en distintos puntos del segmento. side = 1 prefiere arriba, -1 prefiere abajo. */

// Posiciones candidatas alrededor de un vector: ambos lados, distintas distancias y puntos del segmento.
function segCands(ax, ay, bx, by, side, gap) {
  let nx = -(by - ay),
    ny = bx - ax;
  const nl = Math.hypot(nx, ny) || 1;
  nx /= nl;
  ny /= nl;
  if ((side > 0 && ny > 0) || (side < 0 && ny < 0)) {
    nx = -nx;
    ny = -ny;
  }
  const out = [];
  for (const s of [1, -1])
    for (const t of [0.5, 0.32, 0.68])
      for (const d of [gap, gap + 16]) {
        const mx = ax + (bx - ax) * t,
          my = ay + (by - ay) * t,
          ux = nx * s,
          uy = ny * s;
        out.push({
          x: mx + ux * d,
          y: my + uy * d,
          h: ux < -0.3 ? 'right' : ux > 0.3 ? 'left' : 'center',
          v: uy < -0.5 ? 'bottom' : uy > 0.5 ? 'top' : 'middle',
        });
      }
  return out;
}
// ¿Qué etiqueta hay bajo el punto (px, py) de la pantalla? (vector a menos de 14 px o punto a menos de 16 px)
// ¿Qué etiqueta (vector o punto) hay bajo el ratón o el dedo?
function labelHitAt(px, py) {
  let best = null,
    bd = 1e9;
  for (const h of LBL.hits) {
    let d;
    if (h.seg) d = segDist(px, py, h.seg[0], h.seg[1], h.seg[2], h.seg[3]);
    else d = Math.hypot(px - h.pt[0], py - h.pt[1]);
    if (d < (h.seg ? 14 : 16) && d < bd) {
      bd = d;
      best = h.key;
    }
  }
  return best;
}
// Ratón: mostrar al pasar por encima. Pantalla táctil: tocar para mostrar / volver a tocar para ocultar.
cv.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  const r = cv.getBoundingClientRect();
  LBL.hover = labelHitAt(e.clientX - r.left, e.clientY - r.top);
});
cv.addEventListener('pointerleave', () => {
  LBL.hover = null;
});
cv.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return;
  const r = cv.getBoundingClientRect(),
    k = labelHitAt(e.clientX - r.left, e.clientY - r.top);
  LBL.pinned = k && k !== LBL.pinned ? k : null;
});
