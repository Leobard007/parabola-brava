/* ======================================================================
   ARCHIVO: js/1-nucleo/vectores.js

   MODELO DE VECTORES (modos Desplazamiento y Mixto)
   Aquí está la matemática de los vectores:
     - Cada vector tiene un tipo: distancia, velocidad·tiempo o aceleración·tiempo.
     - Cada magnitud puede ser "dato" (visible), "incógnita" (hay que calcularla) u "oculta".
     - vecVals() calcula los valores de un vector; resultant() los suma.
     - analyze() comprueba si un problema tiene solución con los datos visibles.
   Es el archivo más matemático: normalmente no hace falta modificarlo para personalizar el juego.
   ====================================================================== */

/* =========================================================
   VECTORES: modelo, valores y análisis de solvencia
   ========================================================= */

// Las 8 direcciones posibles y su signo en x e y.
// Ejemplo: 'ul' (arriba a la izquierda) = [-1, +1]: x negativa, y positiva.
const DIRV = {
  ur: [1, 1],
  ul: [-1, 1],
  dl: [-1, -1],
  dr: [1, -1],
  r: [1, 0],
  l: [-1, 0],
  u: [0, 1],
  d: [0, -1],
};

// Nombres de las direcciones en ambos idiomas.
const DIR_NAMES = {
  ur: ['Arriba y a la derecha', 'Up and to the right'],
  ul: ['Arriba y a la izquierda', 'Up and to the left'],
  dl: ['Abajo y a la izquierda', 'Down and to the left'],
  dr: ['Abajo y a la derecha', 'Down and to the right'],
  r: ['Derecha', 'Right'],
  l: ['Izquierda', 'Left'],
  u: ['Arriba', 'Up'],
  d: ['Abajo', 'Down'],
};

// Nombre de una dirección con mayúscula inicial (ej. "Arriba a la derecha").
const dirName = (k) => L(DIR_NAMES[k][0], DIR_NAMES[k][1]);

// Nombre de una dirección en minúsculas.
const dirLow = (k) => (SET.lang === 'en' ? DIR_NAMES[k][1].toLowerCase() : DIR_NAMES[k][0].toLowerCase());

// Orden en que se muestran las direcciones en las listas desplegables.
const DIR_ORDER = ['ur', 'ul', 'dl', 'dr', 'r', 'l', 'u', 'd'];

// Flecha que representa cada dirección (→ ↗ ↑ ...).
const DIR_ARROW = { ur: '↗', ul: '↖', dl: '↙', dr: '↘', r: '→', l: '←', u: '↑', d: '↓' };

// ¿Es una dirección "pura" (derecha, izquierda, arriba o abajo)? En ese caso el ángulo es fijo (0° o 90°).
const isPure = (dir) => DIRV[dir][0] === 0 || DIRV[dir][1] === 0;

// Tipos de vector: distancia, velocidad·tiempo y aceleración·tiempo.
const KINDS = ['dist', 'vel', 'acc'];

// Nombre de un tipo de vector en el idioma actual.
const kindLabel = (k) =>
  ({
    dist: L('Distancia', 'Distance'),
    vel: L('Velocidad y tiempo', 'Speed and time'),
    acc: L('Aceleración y tiempo', 'Acceleration and time'),
  })[k];

// Fórmula que explica cómo se calcula la magnitud de cada tipo de vector.
const kindNote = (k) =>
  ({
    dist: L('desplazamiento', 'displacement'),
    vel: L('velocidad constante: ', 'constant speed: ') + M.inl('|V| = v t'),
    acc:
      L('aceleración constante: ', 'constant acceleration: ') +
      M.inl(`|V| = v₀ t + ${M.half} a t${M.sup(2)}`),
  })[k];

// Qué magnitudes tiene cada tipo de vector (d = distancia, v = velocidad, t = tiempo, a = aceleración, v0 = velocidad inicial,
// ang = ángulo, dir = dirección, x / y = componentes).
const Q_BY_KIND = {
  dist: ['d', 'ang', 'dir', 'x', 'y'],
  vel: ['v', 't', 'd', 'ang', 'dir', 'x', 'y'],
  acc: ['a', 't', 'v0', 'd', 'ang', 'dir', 'x', 'y'],
};

// Columnas de la tabla avanzada del editor.
const Q_COLS = ['d', 'v', 'a', 'v0', 't', 'ang', 'dir', 'x', 'y'];

// Magnitudes de la resultante R.
const R_Q = ['d', 'ang', 'dir', 'x', 'y'];

// Unidad de cada magnitud.
const Q_UNIT = { d: 'm', v: 'm/s', a: 'm/s²', v0: 'm/s', t: 's', ang: '°', dir: '', x: 'm', y: 'm' };

// Tolerancia mínima (absoluta) al comprobar respuestas, para que valores muy pequeños no exijan precisión imposible.
const ABS_TOL = { d: 0.3, x: 0.3, y: 0.3, v: 0.1, v0: 0.1, a: 0.05, t: 0.1 };

// Subíndices ₁₂₃₄ para escribir V₁, V₂...
const SUB = ['₁', '₂', '₃', '₄', '₅'];

// Estados posibles de cada dato: 'dato' (el jugador lo ve), 'inc' (incógnita: hay que calcularlo) u 'oculto'.
const STATES = ['dato', 'oculto', 'inc'];

// Nombre de un vector: vname(0) → "V₁", vname('R') → "R".
const vname = (o) => (o === 'R' ? 'R' : 'V' + SUB[o]);

// Atajo para crear qué datos se muestran.
// sh('d ang', 'dir') → d y ang son datos, dir es incógnita, el resto oculto.
function sh(dato = '', inc = '') {
  const s = {};
  Q_COLS.forEach((q) => (s[q] = 'oculto'));
  dato
    .split(' ')
    .filter(Boolean)
    .forEach((q) => (s[q] = 'dato'));
  inc
    .split(' ')
    .filter(Boolean)
    .forEach((q) => (s[q] = 'inc'));
  return s;
}

// Qué datos se muestran por defecto según el tipo de vector.
function defaultShow(kind) {
  return sh({ dist: 'd ang dir', vel: 'v t ang dir', acc: 'a t v0 ang dir' }[kind]);
}

// Normaliza un vector: corrige valores raros y completa los campos que falten.
function normVec(V) {
  V = V || {};
  const kind = KINDS.includes(V.kind) ? V.kind : 'dist';
  const dir = DIRV[V.dir] ? V.dir : 'ur';
  let ang = r2(clamp(num(V.ang, 30), 0, 90));
  if (dir === 'r' || dir === 'l') ang = 0;
  if (dir === 'u' || dir === 'd') ang = 90;
  const show = defaultShow(kind);
  if (V.show)
    Q_COLS.forEach((q) => {
      if (STATES.includes(V.show[q])) show[q] = V.show[q];
    });
  Q_COLS.forEach((q) => {
    if (!Q_BY_KIND[kind].includes(q)) show[q] = 'oculto';
  });
  if (isPure(dir) && show.ang !== 'inc') show.ang = 'oculto';
  const stretch = kind === 'dist' ? null : V.stretch === 't' ? 't' : kind === 'vel' ? 'v' : 'a';
  return {
    kind,
    stretch,
    d: r2(clamp(num(V.d, 10), 0.5, 80)),
    v: r2(clamp(num(V.v, 4), 0.1, 50)),
    t: r2(clamp(num(V.t, 3), 0.1, 60)),
    a: r2(clamp(num(V.a, 2), 0.05, 20)),
    v0: r2(clamp(num(V.v0, 0), 0, 30)),
    ang,
    dir,
    show,
  };
}

// Normaliza el bloque de vectores de un nivel (punto de inicio A, lista de vectores, R, tolerancias, intentos...).
function normMov(m, W) {
  m = m || {};
  const lo = LAUNCH_CLEAR + 0.6,
    hi = Math.max(lo, W - 0.6);
  let vecs;
  if (Array.isArray(m.vecs) && m.vecs.length) vecs = m.vecs;
  else if (Array.isArray(m.legs) && m.legs.length)
    vecs = m.legs.map((Lg) => ({
      kind: 'dist',
      d: Lg.d,
      ang: Lg.ang,
      dir: Lg.dir,
      show: m.hint === 'polar' ? undefined : sh('x y'),
    }));
  else vecs = [{ kind: 'dist', d: 10, ang: 30, dir: 'ur' }];
  vecs = vecs.slice(0, 4).map(normVec);
  const rs = { d: 'inc', ang: 'inc', dir: 'inc', x: 'oculto', y: 'oculto' };
  if (m.R && m.R.show)
    R_Q.forEach((q) => {
      if (STATES.includes(m.R.show[q])) rs[q] = m.R.show[q];
    });
  return {
    ax: r2(clamp(num(m.ax, Math.round(W * 0.3)), lo, hi)),
    ay: r2(clamp(num(m.ay, 0), 0, 30)),
    vecs,
    R: { show: rs },
    adj: Number.isInteger(m.adj) && m.adj >= 0 && m.adj < vecs.length ? m.adj : null,
    hideScale: m.hideScale !== false,
    showPath: m.showPath !== false,
    tolD: r2(clamp(num(m.tolD, 5), 1, 25)),
    tolA: r2(clamp(num(m.tolA, 3), 0.5, 15)),
    tries: Math.round(clamp(num(m.tries, 3), 1, 6)),
  };
}

// Calcula todos los valores de un vector: magnitud d, componentes x e y, ángulo y dirección.
// Aquí está la física: d = v·t  o  d = v₀·t + ½·a·t².
function vecVals(V) {
  const d = V.kind === 'dist' ? V.d : V.kind === 'vel' ? V.v * V.t : V.v0 * V.t + 0.5 * V.a * V.t * V.t;
  const [sx, sy] = DIRV[V.dir],
    a = (V.ang * Math.PI) / 180;
  let x, y;
  if (sx === 0) {
    x = 0;
    y = sy * d;
  } else if (sy === 0) {
    x = sx * d;
    y = 0;
  } else {
    x = sx * d * Math.cos(a);
    y = sy * d * Math.sin(a);
  }
  return { d, v: V.v, t: V.t, a: V.a, v0: V.v0, ang: sx === 0 ? 90 : sy === 0 ? 0 : V.ang, dir: V.dir, x, y };
}

// Dada una componente x y una y, devuelve la dirección ('r', 'ur', 'u'...).
function dirOf(dx, dy) {
  const e = 0.05,
    h = dx > e ? 'r' : dx < -e ? 'l' : '',
    v = dy > e ? 'u' : dy < -e ? 'd' : '';
  return h && v ? v + h : h || v || 'r';
}

// Suma los vectores uno detrás de otro y devuelve la resultante R,
// los puntos del camino (pts) y el punto final B.
function resultant(m) {
  const vals = m.vecs.map(vecVals);
  const pts = [{ x: m.ax, y: m.ay }];
  let x = m.ax,
    y = m.ay;
  vals.forEach((v) => {
    x += v.x;
    y += v.y;
    pts.push({ x, y });
  });
  const dx = x - m.ax,
    dy = y - m.ay,
    mag = Math.hypot(dx, dy);
  const angH = mag < 1e-9 ? 0 : (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
  const dir = dirOf(dx, dy);
  return { pts, vals, F: { x, y }, dx, dy, mag, angH, dir, R: { d: mag, ang: angH, dir, x: dx, y: dy } };
}

// Valor correcto de una magnitud (la "respuesta") para comprobar al jugador.
function truthOf(r, owner, q) {
  return owner === 'R' ? r.R[q] : r.vals[owner][q];
}

// Direcciones que se aceptan como correctas (si el ángulo está cerca de 0° o 90° se aceptan dos).
function validDirs(dx, dy, angH, dir, tolA) {
  const s = new Set([dir]);
  const h = dx >= 0 ? 'r' : 'l',
    v = dy >= 0 ? 'u' : 'd';
  if (angH <= tolA) {
    s.add(h);
    s.add('u' + h);
    s.add('d' + h);
  }
  if (angH >= 90 - tolA) {
    s.add(v);
    s.add(v + 'r');
    s.add(v + 'l');
  }
  return [...s];
}
/* Propaga lo que se puede calcular a partir de los datos. Devuelve las incógnitas y las que no se pueden obtener. */
// El "cerebro" que decide si un problema se puede resolver.
// Parte de los datos visibles y aplica reglas (Pitágoras, trigonometría, cinemática, sumas de componentes)
// hasta que no puede deducir nada más. Devuelve qué incógnitas quedaron sin poder calcularse.
function analyze(m) {
  const r = resultant(m),
    K = new Set(),
    inc = [];
  m.vecs.forEach((V, i) =>
    Q_BY_KIND[V.kind].forEach((q) => {
      if (V.show[q] === 'dato') K.add(`${i}.${q}`);
      if (V.show[q] === 'inc') inc.push(`${i}.${q}`);
    }),
  );
  R_Q.forEach((q) => {
    if (m.R.show[q] === 'dato') K.add(`R.${q}`);
    if (m.R.show[q] === 'inc') inc.push(`R.${q}`);
  });
  let ch = true,
    guard = 0;
  const polar = (p, vx, vy) => {
    const h = (q) => K.has(`${p}.${q}`),
      A = (q) => {
        if (!K.has(`${p}.${q}`)) {
          K.add(`${p}.${q}`);
          ch = true;
        }
      };
    const horiz = Math.abs(vy) < 0.05,
      vert = Math.abs(vx) < 0.05;
    if (h('dir') && (horiz || vert)) {
      A('ang');
      A(horiz ? 'y' : 'x');
    }
    if (h('d') && h('ang') && h('dir')) {
      A('x');
      A('y');
    }
    if (h('x') && h('y')) {
      A('d');
      A('ang');
      A('dir');
    }
    if (h('d') && h('x')) {
      A('ang');
      if (h('dir')) A('y');
    }
    if (h('d') && h('y')) {
      A('ang');
      if (h('dir')) A('x');
    }
    if (h('ang') && h('dir') && h('x') && !vert) {
      A('d');
      A('y');
    }
    if (h('ang') && h('dir') && h('y') && !horiz) {
      A('d');
      A('x');
    }
  };
  while (ch && guard++ < 60) {
    ch = false;
    m.vecs.forEach((V, i) => {
      const h = (q) => K.has(`${i}.${q}`),
        A = (q) => {
          if (!K.has(`${i}.${q}`)) {
            K.add(`${i}.${q}`);
            ch = true;
          }
        };
      if (V.kind === 'vel' && ['d', 'v', 't'].filter(h).length >= 2) {
        A('d');
        A('v');
        A('t');
      }
      if (V.kind === 'acc' && ['d', 'a', 't', 'v0'].filter(h).length >= 3) {
        A('d');
        A('a');
        A('t');
        A('v0');
      }
      polar(i, r.vals[i].x, r.vals[i].y);
    });
    polar('R', r.dx, r.dy);
    ['x', 'y'].forEach((c) => {
      const keys = [`R.${c}`, ...m.vecs.map((_, i) => `${i}.${c}`)],
        unk = keys.filter((k) => !K.has(k));
      if (unk.length === 1) {
        K.add(unk[0]);
        ch = true;
      }
    });
  }
  return { r, inc, missing: inc.filter((k) => !K.has(k)) };
}

// Separa una clave como '0.d' en { owner: 0, q: 'd' } (vector V₁, magnitud d).
function splitKey(k) {
  const [o, q] = k.split('.');
  return { owner: o === 'R' ? 'R' : +o, q };
}

// Nombre legible de una clave: '0.d' → "|V₁|", 'R.ang' → "θ de R".
function keyLabel(k) {
  const { owner, q } = splitKey(k),
    n = vname(owner);
  return {
    d: `|${n}|`,
    x: `${n}ₓ`,
    y: `${n}ᵧ`,
    ang: L(`θ de ${n}`, `θ of ${n}`),
    dir: L(`dirección de ${n}`, `direction of ${n}`),
    v: L(`v de ${n}`, `v of ${n}`),
    a: L(`a de ${n}`, `a of ${n}`),
    v0: L(`v₀ de ${n}`, `v₀ of ${n}`),
    t: L(`t de ${n}`, `t of ${n}`),
  }[q];
}

// Da formato a un valor según su magnitud (añade la unidad o el símbolo °).
function fmtQ(q, val) {
  if (q === 'dir') return dirLow(val);
  if (q === 'ang') return fmtN(val) + '°';
  if (q === 'x' || q === 'y') return fmtS(val) + ' m';
  return fmtN(val) + ' ' + Q_UNIT[q];
}

// Símbolo de una magnitud para mostrar en pantalla (|V₁|, θ, Δx...).
function symOf(q, owner) {
  const n = vname(owner);
  return {
    d: `|${n}|`,
    ang: 'θ',
    dir: L('dirección', 'direction'),
    x: owner === 'R' ? 'Rₓ' : 'Δx',
    y: owner === 'R' ? 'Rᵧ' : 'Δy',
    v: 'v',
    a: 'a',
    v0: 'v₀',
    t: 't',
  }[q];
}

// Texto corto "símbolo = valor" para las pistas.
function shortQ(q, val, owner) {
  const n = vname(owner);
  if (val == null)
    return q === 'dir'
      ? L('dir. ?', 'dir. ?')
      : q === 'ang'
        ? 'θ = ?'
        : q === 'd'
          ? `|${n}| = ?`
          : `${symOf(q, owner)} = ?`;
  if (q === 'dir') return DIR_ARROW[val];
  if (q === 'ang') return fmtN(val) + '°';
  if (q === 'd') return fmtN(val) + ' m';
  if (q === 'x' || q === 'y') return `${symOf(q, owner)} = ${fmtS(val)}`;
  return `${symOf(q, owner)} = ${fmtN(val)} ${Q_UNIT[q]}`;
}

// Etiqueta que se dibuja junto a cada vector en la escena.
function canvasLabel(owner, show, vals, full, kind) {
  const qs = owner === 'R' ? R_Q : Q_BY_KIND[kind],
    parts = [];
  qs.forEach((q) => {
    if (full) {
      if (q === 'x' || q === 'y') return;
      if (q === 'ang' && owner !== 'R' && (vals.ang === 0 || vals.ang === 90)) return;
      parts.push(shortQ(q, vals[q], owner));
      return;
    }
    const s = show[q];
    if (s === 'oculto') return;
    parts.push(shortQ(q, s === 'inc' ? null : vals[q], owner));
  });
  return vname(owner) + (parts.length ? ': ' + parts.join(' · ') : '');
}

// Revisa que la geometría del nivel sea válida (que B quede dentro del mundo, encima del suelo...).
// Devuelve un texto con el problema o null si todo está bien.
function movProblems(def) {
  const m = def.mov,
    r = resultant(m),
    lo = LAUNCH_CLEAR + 0.6,
    hi = def.W - 0.6;
  if (r.vals.some((v) => v.d > 80))
    return L(
      'Algún vector mide más de 80 m: reduce la velocidad, la aceleración o el tiempo.',
      'A vector is longer than 80 m: reduce its speed, acceleration or time.',
    );
  if (r.mag < 1)
    return L(
      'El desplazamiento total es casi cero: el cochinito acabaría donde empezó.',
      'The total displacement is almost zero: the piglet would end where it started.',
    );
  if (r.F.x < lo || r.F.x > hi)
    return L(
      `El punto final B cae fuera del mundo (x = ${f(r.F.x, 1)} m). Debe quedar entre ${f(lo, 1)} y ${f(hi, 1)} m: mueve A o amplía el mundo.`,
      `End point B falls outside the world (x = ${f(r.F.x, 1)} m). It must stay between ${f(lo, 1)} and ${f(hi, 1)} m: move A or widen the world.`,
    );
  if (r.F.y < 0)
    return L(
      `El punto final B queda bajo el suelo (y = ${f(r.F.y, 1)} m): sube A o cambia los vectores.`,
      `End point B is below the ground (y = ${f(r.F.y, 1)} m): raise A or change the vectors.`,
    );
  if (r.F.y > 35)
    return L(
      `El punto final B queda demasiado alto (y = ${f(r.F.y, 1)} m). El máximo es 35 m.`,
      `End point B is too high (y = ${f(r.F.y, 1)} m). The maximum is 35 m.`,
    );
  return '';
}

// Usa analyze() y devuelve si el problema tiene solución y un texto explicándolo.
function solvability(m) {
  const a = analyze(m);
  if (!a.inc.length)
    return {
      ok: false,
      text: L(
        'Marca al menos una incógnita (?) para que el jugador tenga algo que encontrar.',
        'Mark at least one unknown (?) so the player has something to find.',
      ),
      a,
    };
  if (a.missing.length)
    return {
      ok: false,
      text:
        L(
          'Con los datos marcados no se puede calcular: ',
          'With the given data it’s impossible to work out: ',
        ) +
        a.missing.map(keyLabel).join(', ') +
        L('. Da más datos o quita esa incógnita.', '. Give more data or remove that unknown.'),
      a,
    };
  return { ok: true, a };
}
