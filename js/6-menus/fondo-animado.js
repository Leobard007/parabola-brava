/* ======================================================================
   ARCHIVO: js/6-menus/fondo-animado.js

   FONDO ANIMADO DE LOS MENÚS (estilo plano de ingeniería)
   Se dibuja en un canvas que ocupa toda la ventana: cuadrícula, lanzador, parábola punteada,
   cochinito que salta y vectores que se dibujan. Si las animaciones están desactivadas,
   se dibuja una sola vez (imagen fija).
   ====================================================================== */

/* =========================================================
   FONDO: PLANO DE INGENIERÍA ANIMADO
   ========================================================= */

// Dibuja el fondo tipo plano de ingeniería: cuadrícula, lanzador, parábola, cochinito y vectores.
// t = tiempo en segundos (controla la animación).
function drawBG(t) {
  const w = bgW,
    h = bgH,
    c = bgx,
    line = C['bp-line'],
    gold = C.gold;
  c.setTransform(bgDpr, 0, 0, bgDpr, 0, 0);
  c.fillStyle = C.bp;
  c.fillRect(0, 0, w, h);
  const vg = c.createRadialGradient(
    w / 2,
    h * 0.45,
    Math.min(w, h) * 0.2,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.75,
  );
  vg.addColorStop(0, 'rgba(40,80,150,.35)');
  vg.addColorStop(1, 'rgba(0,0,0,.35)');
  c.fillStyle = vg;
  c.fillRect(0, 0, w, h);
  // cuadrícula
  c.strokeStyle = line;
  c.lineWidth = 1;
  for (const [step, a] of [
    [24, 0.06],
    [120, 0.14],
  ]) {
    c.globalAlpha = a;
    c.beginPath();
    for (let x = 0.5; x < w; x += step) {
      c.moveTo(x, 0);
      c.lineTo(x, h);
    }
    for (let y = 0.5; y < h; y += step) {
      c.moveTo(0, y);
      c.lineTo(w, y);
    }
    c.stroke();
  }
  c.globalAlpha = 1;
  // marco del plano
  c.globalAlpha = 0.35;
  c.strokeRect(10.5, 10.5, w - 21, h - 21);
  c.globalAlpha = 1;

  const u = Math.min(w, h * 1.4) / 900; // escala general
  const gy = h * 0.86,
    x0 = w * 0.09,
    x1 = w * 0.86;
  const mono = (s) => `${Math.round(Math.max(10, s * u))}px 'IBM Plex Mono', monospace`;
  // suelo con rayado
  c.strokeStyle = line;
  c.globalAlpha = 0.55;
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(18, gy);
  c.lineTo(w - 18, gy);
  c.stroke();
  c.globalAlpha = 0.25;
  c.beginPath();
  for (let x = 24; x < w - 18; x += 14) {
    c.moveTo(x, gy);
    c.lineTo(x - 9, gy + 9);
  }
  c.stroke();
  c.globalAlpha = 1;

  // ciclo del lanzamiento (7 s): vuelo, salto del cochinito, pausa
  const cyc = 7,
    tc = t % cyc,
    fly = 2.6;
  const p = clamp(tc / fly, 0, 1),
    apexH = Math.min(h * 0.52, gy - 60);
  const lh = 34 * u; // altura del lanzador
  const px = (s) => x0 + (x1 - x0) * s,
    py = (s) => gy - lh - 4 * apexH * s * (1 - s) + (lh - 10 * u) * s;
  // lanzador
  c.strokeStyle = line;
  c.lineWidth = 2;
  c.globalAlpha = 0.75;
  c.strokeRect(x0 - 7 * u, gy - lh, 14 * u, lh);
  c.beginPath();
  c.arc(x0, gy - lh, 9 * u, 0, Math.PI * 2);
  c.stroke();
  // trayectoria punteada
  c.setLineDash([3, 9 * u + 3]);
  c.lineCap = 'round';
  c.lineWidth = 3;
  c.strokeStyle = gold;
  c.globalAlpha = 0.85;
  c.beginPath();
  for (let i = 0; i <= 80 * p; i++) {
    const s = i / 80;
    i ? c.lineTo(px(s), py(s)) : c.moveTo(px(s), py(s));
  }
  c.stroke();
  c.setLineDash([]);
  c.lineCap = 'butt';
  // proyectil
  if (p < 1) {
    c.fillStyle = gold;
    c.globalAlpha = 1;
    c.beginPath();
    c.arc(px(p), py(p), 7 * u + 2, 0, Math.PI * 2);
    c.fill();
  }
  // vector v0 y ángulo
  const ang = Math.atan2(py(0) - py(0.04), px(0.04) - px(0));
  c.strokeStyle = line;
  c.globalAlpha = 0.8;
  c.lineWidth = 2;
  const vl = 80 * u + 20,
    vx = x0 + vl * Math.cos(ang),
    vy = gy - lh - vl * Math.sin(ang);
  c.beginPath();
  c.moveTo(x0, gy - lh);
  c.lineTo(vx, vy);
  c.stroke();
  c.beginPath();
  c.moveTo(vx, vy);
  c.lineTo(vx - 10 * Math.cos(ang - 0.4), vy + 10 * Math.sin(ang - 0.4));
  c.lineTo(vx - 10 * Math.cos(ang + 0.4), vy + 10 * Math.sin(ang + 0.4));
  c.closePath();
  c.fillStyle = line;
  c.fill();
  c.setLineDash([4, 4]);
  c.beginPath();
  c.moveTo(x0, gy - lh);
  c.lineTo(x0 + vl * 1.1, gy - lh);
  c.stroke();
  c.setLineDash([]);
  c.beginPath();
  c.arc(x0, gy - lh, vl * 0.55, -ang, 0);
  c.stroke();
  c.font = mono(14);
  c.fillStyle = C['bp-text'];
  c.globalAlpha = 0.8;
  c.fillText('θ', x0 + vl * 0.62, gy - lh - vl * 0.12);
  c.fillText('v₀', vx + 6, vy - 4);
  // cota de altura máxima y alcance
  c.strokeStyle = line;
  c.globalAlpha = 0.45;
  c.lineWidth = 1;
  c.setLineDash([6, 5]);
  const ax = px(0.5),
    ay = py(0.5);
  c.beginPath();
  c.moveTo(ax, ay);
  c.lineTo(ax, gy);
  c.stroke();
  c.setLineDash([]);
  c.globalAlpha = 0.7;
  c.fillText(L('h máx', 'max h'), ax + 8, (ay + gy) / 2);
  const dy = gy + 26 * u + 8;
  c.globalAlpha = 0.55;
  c.beginPath();
  c.moveTo(x0, dy);
  c.lineTo(x1, dy);
  [x0, x1].forEach((x) => {
    c.moveTo(x, dy - 6);
    c.lineTo(x, dy + 6);
  });
  c.stroke();
  c.globalAlpha = 0.7;
  c.textAlign = 'center';
  c.fillText('x = v₀ cos θ · t', (x0 + x1) / 2, dy - 6);
  c.textAlign = 'left';
  // cochinito (salta al ser alcanzado)
  const hit = tc > fly,
    hop = hit
      ? Math.max(0, Math.sin(Math.min(1, (tc - fly) / 0.5) * Math.PI)) * 30 * u +
        (tc < fly + 2 ? Math.abs(Math.sin((tc - fly) * 9)) * 6 * u * Math.max(0, 1 - (tc - fly) / 2) : 0)
      : Math.abs(Math.sin(t * 2.2)) * 3 * u;
  const tx = x1,
    ty = gy - hop,
    r = 15 * u + 4;
  c.globalAlpha = 1;
  c.lineWidth = 2.5;
  c.fillStyle = 'rgba(124,196,107,.9)';
  c.strokeStyle = '#d7f5cf';
  c.beginPath();
  c.ellipse(tx, ty - r * 0.9, r * 1.1, r * 0.9, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = '#10213d';
  c.beginPath();
  c.arc(tx - r * 0.38, ty - r * 1.05, r * 0.16, 0, Math.PI * 2);
  c.arc(tx + r * 0.38, ty - r * 1.05, r * 0.16, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#a7db97';
  c.beginPath();
  c.ellipse(tx, ty - r * 0.62, r * 0.36, r * 0.24, 0, 0, Math.PI * 2);
  c.fill();
  if (hit && tc < fly + 0.7) {
    // destello del impacto
    const k = (tc - fly) / 0.7;
    c.strokeStyle = gold;
    c.globalAlpha = 1 - k;
    c.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        r0 = r * (1.3 + k),
        r1 = r * (1.8 + k * 1.6);
      c.beginPath();
      c.moveTo(tx + Math.cos(a) * r0, ty - r * 0.9 + Math.sin(a) * r0);
      c.lineTo(tx + Math.cos(a) * r1, ty - r * 0.9 + Math.sin(a) * r1);
      c.stroke();
    }
  }

  // vectores que se dibujan (arriba a la derecha)
  const sc = 40 * u + 8,
    vt = (t % 8) / 8,
    ox = Math.min(w * 0.72, w - 3.9 * sc - 30),
    oy = Math.max(h * 0.16, 1.9 * sc + 24);
  const vecs = [
    [1.6, -0.9],
    [1.4, 0.5],
    [0.7, -1.3],
  ];
  let cx = ox,
    cy = oy,
    k = vt * 4.2;
  c.lineWidth = 2.2;
  c.strokeStyle = line;
  c.fillStyle = line;
  c.font = mono(13);
  vecs.forEach((v, i) => {
    const s = clamp(k - i, 0, 1);
    if (s <= 0) return;
    const ex = cx + v[0] * sc * s,
      ey = cy + v[1] * sc * s;
    c.globalAlpha = 0.8;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(ex, ey);
    c.stroke();
    const a = Math.atan2(ey - cy, ex - cx);
    c.beginPath();
    c.moveTo(ex, ey);
    c.lineTo(ex - 9 * Math.cos(a - 0.4), ey - 9 * Math.sin(a - 0.4));
    c.lineTo(ex - 9 * Math.cos(a + 0.4), ey - 9 * Math.sin(a + 0.4));
    c.closePath();
    c.fill();
    if (s === 1) {
      c.globalAlpha = 0.7;
      c.fillText('V' + '₁₂₃'[i], (cx + ex) / 2 + 6, (cy + ey) / 2 - 6);
    }
    cx = ex;
    cy = ey;
  });
  const sR = clamp(k - 3, 0, 1);
  if (sR > 0) {
    const fx = ox + (cx - ox) * sR,
      fy = oy + (cy - oy) * sR;
    c.strokeStyle = gold;
    c.fillStyle = gold;
    c.globalAlpha = 0.9;
    c.setLineDash([7, 5]);
    c.beginPath();
    c.moveTo(ox, oy);
    c.lineTo(fx, fy);
    c.stroke();
    c.setLineDash([]);
    if (sR === 1) {
      c.fillText('R', (ox + cx) / 2 - 4, (oy + cy) / 2 + 18);
      c.beginPath();
      c.arc(cx, cy, 4, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.globalAlpha = 0.8;
  c.fillStyle = line;
  c.beginPath();
  c.arc(ox, oy, 4, 0, Math.PI * 2);
  c.fill();

  // cajetín del plano
  const bw = Math.min(250, w * 0.42),
    bh = 46,
    bx = w - bw - 18,
    by = h - bh - 18;
  if (w > 520) {
    c.globalAlpha = 0.5;
    c.strokeStyle = line;
    c.lineWidth = 1;
    c.strokeRect(bx + 0.5, by + 0.5, bw, bh);
    c.beginPath();
    c.moveTo(bx, by + 22.5);
    c.lineTo(bx + bw, by + 22.5);
    c.moveTo(bx + bw * 0.6 + 0.5, by + 22);
    c.lineTo(bx + bw * 0.6 + 0.5, by + bh);
    c.stroke();
    c.fillStyle = C['bp-text'];
    c.font = "11px 'IBM Plex Mono', monospace";
    c.globalAlpha = 0.65;
    c.fillText('PARÁBOLA BRAVA · g = 9.81 m/s²', bx + 8, by + 15);
    c.fillText(L('SIN AIRE', 'NO DRAG'), bx + 8, by + 38);
    c.fillText(L('HOJA 1/1', 'SHEET 1/1'), bx + bw * 0.6 + 8, by + 38);
  }
  c.globalAlpha = 1;
}
