/* ======================================================================
   ARCHIVO: js/2-juego/fisica.js

   FÍSICA DEL DISPARO
   El proyectil sigue la fórmula EXACTA del tiro parabólico sin resistencia del aire:
       x(t) = v₀·cos(θ)·t
       y(t) = h₀ + v₀·sin(θ)·t − ½·g·t²
   Aquí se detectan los choques, se rompen bloques, se eliminan objetivos y caen las piezas.
   Puntuación: objetivo 500, madera 50, piedra 100 (búscalos en killTarget y breakBlock).
   ====================================================================== */

/* ---------- disparo y física ---------- */
// Lanza el proyectil con los valores actuales (v0, ángulo, h0).
function fire() {
  if (S.screen !== 'play' || S.phase !== 'shoot' || S.mode !== 'aim' || S.shotsLeft <= 0) return;
  const v = S.def.vars;
  VKEYS.forEach((k) => {
    P[k] = v[k].locked ? v[k].def : clamp(P[k], v[k].min, v[k].max);
  });
  if (v.g.locked) g = v.g.def;
  const th = (P.ang * Math.PI) / 180;
  S.proj = {
    t: 0,
    vx: P.v0 * Math.cos(th),
    vy0: P.v0 * Math.sin(th),
    h0: P.h0,
    v0: P.v0,
    ang: P.ang,
    g,
    x: 0,
    y: P.h0,
    done: false,
    doneT: 0,
    pts: [{ x: 0, y: P.h0 }],
    lastPt: 0,
    ymax: P.h0,
    apexX: 0,
    hit: null,
    tBefore: targetsLeft(),
  };
  S.shotsLeft--;
  S.mode = 'fly';
  if ($('practice').checked) S.practiceUsed = true;
  SND.launch();
  hud();
  syncUI();
}

// ¿Toca un círculo (el proyectil) a un rectángulo (un bloque)?
function circRect(x, y, r, o) {
  const cx = Math.max(o.x, Math.min(x, o.x + o.w)),
    cy = Math.max(o.y, Math.min(y, o.y + o.h));
  return (x - cx) ** 2 + (y - cy) ** 2 < r * r;
}

// Revisa si el proyectil chocó con algo: objetivo, bloque, terreno, suelo o salió del mapa.
function collide(x, y) {
  for (const o of S.objs) {
    if (!o.alive || o.hidden) continue;
    if (o.k === 'target') {
      if ((x - o.x - 0.6) ** 2 + (y - o.y - 0.6) ** 2 < (R + 0.6) ** 2) return { type: 'obj', o };
    } else if (circRect(x, y, R, o)) return { type: 'obj', o };
  }
  for (const t of S.terrain)
    if (circRect(x, y, R, { x: t.x, y: 0, w: t.w, h: t.h })) return { type: 'terrain' };
  if (y <= 0) return { type: 'ground' };
  if (x > S.def.W + 10 || x < -10) return { type: 'out' };
  return null;
}

// Mueve el proyectil según la fórmula exacta de la parábola. Se divide en 12 pasos pequeños por cuadro
// para no "atravesar" bloques finos.
function updateProj(dt) {
  const p = S.proj;
  if (!p) return;
  if (p.done) {
    p.doneT += dt;
    return;
  }
  const n = 12,
    h = dt / n;
  for (let i = 0; i < n; i++) {
    p.t += h;
    const x = p.vx * p.t,
      y = p.h0 + p.vy0 * p.t - 0.5 * p.g * p.t * p.t;
    p.x = x;
    p.y = y;
    if (y > p.ymax) {
      p.ymax = y;
      p.apexX = x;
    }
    if (p.t - p.lastPt >= 0.05) {
      p.pts.push({ x, y });
      p.lastPt = p.t;
    }
    const hit = collide(x, y);
    if (hit) {
      impact(p, hit);
      break;
    }
  }
}

// Qué pasa al chocar: elimina objetivos, rompe madera, o golpea piedra (se rompe a 18 m/s o más).
function impact(p, hit) {
  p.done = true;
  p.hit = hit.type;
  if (hit.type === 'ground') {
    const tf = (p.vy0 + Math.sqrt(p.vy0 ** 2 + 2 * p.g * p.h0)) / p.g;
    p.t = tf;
    p.x = p.vx * tf;
    p.y = 0;
  }
  const vy = p.vy0 - p.g * p.t;
  p.vImp = Math.hypot(p.vx, vy);
  p.pts.push({ x: p.x, y: p.y });
  if (hit.type === 'obj') {
    const o = hit.o;
    if (o.k === 'target') killTarget(o);
    else if (o.k === 'wood' || p.vImp >= 18)
      breakBlock(o); // 18 = velocidad (m/s) necesaria para romper piedra de un golpe
    else {
      o.hp--;
      if (o.hp <= 0) breakBlock(o);
      else {
        floatText(p.x, p.y + 1, L('¡crack!', 'crack!'), C['stone-dark']);
        SND.crack();
      }
    }
  } else if (hit.type !== 'out') SND.thud();
  if (hit.type !== 'out') dust(p.x, Math.max(p.y, 0));
}

// Texto flotante que sube y se desvanece (ej. "+500").
function floatText(x, y, text, col) {
  S.parts.push({ k: 'text', x, y, vy: 1.4, life: 1.6, max: 1.6, text, col });
}

// Partículas de polvo en el punto de impacto.
function dust(x, y) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI;
    S.parts.push({
      k: 'chip',
      x,
      y,
      vx: Math.cos(a) * 3,
      vy: Math.sin(a) * 3,
      life: 0.6,
      max: 0.6,
      col: C.earth,
      size: 0.15,
    });
  }
}

// Elimina un objetivo y suma 500 puntos. (Cambia el 500 para modificar la puntuación.)
function killTarget(o) {
  if (!o.alive) return;
  o.alive = false;
  S.score += 500;
  SND.pop();
  const cx = o.x + 0.6,
    cy = o.y + 0.6;
  S.parts.push({ k: 'ring', x: cx, y: cy, life: 0.5, max: 0.5 });
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2,
      s = 2 + Math.random() * 4;
    S.parts.push({
      k: 'chip',
      x: cx,
      y: cy,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s + 2,
      life: 1,
      max: 1,
      col: C.target,
      size: 0.22,
    });
  }
  floatText(cx, cy + 1, '+500', C.pencil);
  hud();
}

// Rompe un bloque: madera = 50 puntos, piedra = 100.
function breakBlock(o) {
  if (!o.alive) return;
  o.alive = false;
  const pts = o.k === 'stone' ? 100 : 50;
  S.score += pts;
  o.k === 'stone' ? SND.stone() : SND.wood();
  const n = Math.min(18, Math.ceil(o.w * o.h * 4) + 6);
  for (let i = 0; i < n; i++) {
    S.parts.push({
      k: 'chip',
      x: o.x + Math.random() * o.w,
      y: o.y + Math.random() * o.h,
      vx: (Math.random() - 0.5) * 6,
      vy: Math.random() * 5,
      life: 1.2,
      max: 1.2,
      col: o.k === 'stone' ? C.stone : C.wood,
      size: 0.18 + Math.random() * 0.2,
      rot: Math.random() * 6,
    });
  }
  floatText(o.x + o.w / 2, o.y + o.h + 0.6, '+' + pts, C.ink);
  hud();
}

// ¿Se solapan dos piezas en el eje horizontal?
function overlapX(a, b) {
  return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.05;
}

// Encuentra la superficie sobre la que se apoya una pieza (suelo, terreno u otra pieza).
function support(o) {
  let y = 0,
    who = null;
  for (const t of S.terrain)
    if (overlapX(o, t) && t.h <= o.y + 1e-3 && t.h > y) {
      y = t.h;
      who = null;
    }
  for (const p of S.objs) {
    if (p === o || !p.alive || p.hidden) continue;
    const top = p.y + p.h;
    if (overlapX(o, p) && top <= o.y + 1e-3 && top > y) {
      y = top;
      who = p;
    }
  }
  return { y, who };
}

// Hace caer las piezas que se quedaron sin apoyo (gravedad simple).
// Si un objetivo cae más de 1 m, se elimina.
function settle(dt) {
  const list = S.objs.filter((o) => o.alive && !o.fixed && !o.hidden).sort((a, b) => a.y - b.y);
  for (const o of list) {
    if (!o.alive) continue;
    const sp = support(o);
    if (o.y > sp.y + 1e-3) {
      if (!o.falling) {
        o.falling = true;
        o.fy = o.y;
        o.vy = 0;
      }
      o.vy -= g * dt;
      const ny = o.y + o.vy * dt;
      if (ny <= sp.y) {
        o.y = sp.y;
        const drop = o.fy - sp.y;
        o.falling = false;
        o.vy = 0;
        if (o.k === 'target' && drop > 1.0) killTarget(o);
        else if (o.k !== 'target') {
          if (sp.who && sp.who.k === 'target') killTarget(sp.who);
          if (o.k === 'wood' && drop > 3) breakBlock(o);
        }
      } else o.y = ny;
    } else if (o.falling) {
      o.falling = false;
      o.vy = 0;
    }
  }
}

// ¿Hay alguna pieza cayendo todavía?
function anyFalling() {
  return S.objs.some((o) => o.alive && o.falling);
}

// Mueve y desvanece las partículas (astillas, polvo, textos flotantes).
function updateParts(dt) {
  for (const p of S.parts) {
    p.life -= dt;
    if (p.k === 'chip') {
      if (!p.nograv) p.vy -= g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.rot != null) p.rot += dt * 6;
    } else if (p.k === 'text') p.y += p.vy * dt;
  }
  S.parts = S.parts.filter((p) => p.life > 0);
}
