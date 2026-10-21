/* ======================================================================
   ARCHIVO: js/5-online/niveles-partida.js

   MODO ONLINE: NIVELES DE LA PARTIDA
   Convierte la selección del host en la lista de niveles de cada jugador:
   mismos niveles o distintos al azar, valores iguales o distintos, e intentos.
   El azar usa una "semilla" (rng), así que cada jugador siempre recibe lo mismo.
   ====================================================================== */

/* ---------- niveles de la partida ---------- */
// Todos los niveles de las campañas en una sola lista.
const CAMP_ALL = () => [...CAMPAIGN, ...CAMPAIGN_D, ...CAMPAIGN_M];

// Clave de una referencia de nivel.
function refKey(ref) {
  return typeof ref === 'string' ? ref : 'x';
}

// Convierte una referencia (id de campaña u objeto de nivel propio) en un nivel jugable.
function resolveRef(ref, i) {
  if (typeof ref === 'string') {
    const l = CAMP_ALL().find((c) => c.id === ref);
    return l ? clone(l) : null;
  }
  if (ref && typeof ref === 'object') {
    const l = normLevel(ref);
    l.id = '__on' + i;
    return l;
  }
  return null;
}

// Etiqueta corta de un nivel ("D1 · Sumando vectores").
function refLabel(ref) {
  if (typeof ref === 'string') {
    for (const c of CAMPAIGNS) {
      const i = c.list.findIndex((l) => l.id === ref);
      if (i >= 0) return { tag: `${c.prefix || 'L'}${i + 1}`, name: lvName(c.list[i]), cls: c.cls };
    }
    return { tag: '?', name: ref, cls: '' };
  }
  const cls = { clasico: 'c', despl: 'd', mixto: 'm' }[ref && ref.type] || 'c';
  return { tag: '★', name: String((ref && ref.name) || L('Nivel', 'Level')).slice(0, 40), cls };
}

// Versión compacta de un nivel propio para enviarla por la red.
function compactDef(def) {
  const d = normLevel(clone(def));
  delete d.id;
  if (d.type === 'clasico') d.mov = null;
  return d;
}

// Crea una versión del nivel con valores distintos (para "valores distintos por jugador").
// Cambia magnitudes y ángulos y comprueba que siga teniendo solución; en lanzamiento mueve un poco las piezas.
function varyLevel(def, rnd) {
  if (def.type === 'clasico') {
    for (let k = 0; k < 10; k++) {
      const dx = (Math.floor(rnd() * 13) - 6) * 0.5;
      const fits = (it) => it.x + dx >= LAUNCH_CLEAR && it.x + dx + it.w <= def.W;
      if (dx && def.objs.every(fits) && def.terrain.every(fits)) {
        const d = clone(def);
        d.objs.forEach((o) => (o.x = r2(o.x + dx)));
        d.terrain.forEach((t) => (t.x = r2(t.x + dx)));
        return d;
      }
    }
    return def;
  }
  for (let k = 0; k < 40; k++) {
    const d = clone(def),
      m = d.mov;
    m.vecs = m.vecs.map((V) => {
      const v = clone(V),
        vv = vecVals(V);
      const byComp =
        V.kind === 'dist' &&
        V.show.d === 'oculto' &&
        V.show.ang === 'oculto' &&
        (V.show.x !== 'oculto' || V.show.y !== 'oculto');
      if (byComp) {
        const bx = Math.round(vv.x),
          by = Math.round(vv.y);
        let x = bx ? bx + Math.floor(rnd() * 5) - 2 : 0,
          y = by ? by + Math.floor(rnd() * 5) - 2 : 0;
        if (bx && Math.sign(x) !== Math.sign(bx)) x = bx;
        if (by && Math.sign(y) !== Math.sign(by)) y = by;
        v.d = r2(Math.max(1, Math.hypot(x, y)));
        if (!isPure(V.dir)) v.ang = r2((Math.atan2(Math.abs(y), Math.abs(x)) * 180) / Math.PI);
      } else {
        const fct = 0.75 + rnd() * 0.55;
        if (V.kind === 'dist') v.d = Math.max(1, Math.round(V.d * fct * 2) / 2);
        if (V.kind === 'vel') v.v = Math.max(0.5, Math.round(V.v * fct * 2) / 2);
        if (V.kind === 'acc') v.a = Math.max(0.1, Math.round(V.a * fct * 10) / 10);
        if (!isPure(V.dir)) v.ang = clamp(Math.round(V.ang + rnd() * 20 - 10), 8, 82);
      }
      return v;
    });
    d.mov = normMov(m, d.W);
    if (!solvability(d.mov).ok || movProblems(d)) continue;
    if (d.type === 'mixto') {
      const F = resultant(d.mov).F,
        near = (it) => F.x > it.x - 1.2 && F.x < it.x + it.w + 1.2;
      if (d.terrain.some(near) || d.objs.some(near)) continue;
    }
    return d;
  }
  return def;
}
/* la lista de niveles de un jugador: igual para todos, o distinta, y con valores iguales o distintos */
// Calcula la lista de niveles de un jugador según las reglas (iguales o al azar, valores iguales o distintos, intentos).
function playerLevels(cfg, pid) {
  const pool = cfg.lv;
  let ix = pool.map((_, i) => i);
  if (cfg.dl > 0) {
    const r = rng(`${cfg.sd}|${pid}|order`);
    for (let i = ix.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [ix[i], ix[j]] = [ix[j], ix[i]];
    }
    ix = ix.slice(0, Math.min(cfg.dl, ix.length));
  }
  const list = ix.map((i) => {
    let d = resolveRef(pool[i], i);
    if (!d) return null;
    if (cfg.vv) d = varyLevel(d, rng(`${cfg.sd}|${pid}|${i}`));
    if (cfg.at === 0) {
      d.shots = 999;
      if (d.mov) d.mov.tries = 999;
    } else if (cfg.at > 0) {
      d.shots = cfg.at;
      if (d.mov) d.mov.tries = cfg.at;
    }
    d.id = '__on' + i;
    return d;
  });
  return { ix: ix.filter((_, k) => list[k]), list: list.filter(Boolean) };
}
