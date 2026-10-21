/* ======================================================================
   ARCHIVO: js/5-online/duelo.js

   MODO ONLINE: DUELOS 1 VS 1
   Dos jugadores compiten. Quien crea el duelo hace de host de la conexión y también juega.
     - Carrera: el mismo nivel para los dos; gana la ronda quien lo complete primero.
       Si alguien falla, su nivel se reinicia al instante. Rondas: 1, al mejor de 3 o de 5.
     - Escondite: cada uno esconde un cerdito tocando el mapa; el juego genera vectores
       (dificultad 1: uno; dificultad 2: de 2 a 3) como pistas. Hay que calcular las coordenadas
       del cerdito del rival (con espera de 5 s tras cada error) y luego derribarlo
       (3 tiros; si fallas los 3, esperas 5 s y recargas). Gana quien lo derribe primero.
   Para ajustar tiempos, tiros o el tamaño del mapa, cambia los números de HIDE.
   ====================================================================== */

/* =========================================================
   DUELOS 1 VS 1
   El creador del duelo hace de "host" de la conexión, pero también juega.
   Él decide quién gana cada ronda (el primero que avisa que terminó).
   Modos:
     race (Carrera)   → ambos juegan el mismo nivel; gana la ronda quien lo complete primero.
     hide (Escondite) → cada uno esconde su cerdito; el juego genera vectores como pistas;
                        hay que calcular las coordenadas del cerdito del rival y luego derribarlo.
   ========================================================= */

// Configuración inicial de un duelo: modo (race = Carrera, hide = Escondite), rondas, dificultad y niveles.
const DUEL_DEFAULT = { dm: 'race', rounds: 3, df: 1, lv: [], _keys: [] };

// Medidas del Escondite (en metros y milisegundos): ancho del mundo, zona permitida, espera tras un error,
// espera para recargar y tiros por recarga. Cambia estos números para ajustar el modo.
const HIDE = { W: 45, H: 20, XMIN: 8, XMAX: 42, YMAX: 15, LOCK: 5000, COOL: 5000, SHOTS: 3 };

// Estado local del duelo: mi pista (clue), dónde toqué el mapa (spot), si terminé (fin), errores, recargas, temporizadores...
const DU = {
  key: '',
  clue: null,
  spot: null,
  fin: null,
  errors: 0,
  fails: 0,
  reloads: 0,
  lockUntil: 0,
  coolUntil: 0,
  roundT0: 0,
  roundOver: false,
  coolT: null,
};

// ¿Estamos en un duelo?
function isDuel() {
  return ON.md === 'duel';
}

// Borra el estado local del duelo (al empezar una ronda nueva o una revancha).
function duelResetLocal() {
  clearTimeout(DU.coolT);
  Object.assign(DU, {
    clue: null,
    spot: null,
    fin: null,
    errors: 0,
    fails: 0,
    reloads: 0,
    lockUntil: 0,
    coolUntil: 0,
    roundOver: false,
    coolT: null,
  });
}
/* Datos del rival: [nombre, estado en vivo, conectado] */
// Datos del rival: nombre, progreso en vivo, si está conectado y su pista.
function duelRival() {
  if (ON.role === 'host') {
    const p = HP.get(HS.g);
    return p ? { name: p.name, live: p.raw && p.raw.live, on: p.online, clue: p.raw && p.raw.clue } : null;
  }
  return RH ? { name: RH.hn, live: RH.me, on: true, clue: RH.clue } : null;
}

// Estado del host: el propio si soy el host, o el último recibido si soy el invitado.
function duelHostState() {
  return ON.role === 'host' ? hState() : RH;
}

/* ---------- progreso en vivo (lo que ve el rival) ---------- */
// Mi progreso en vivo, que se envía al rival (resolviendo, lanzando, recargando, terminado...).
function duelLive() {
  if (ON.view === 'hide') return { ph: DU.clue ? 'ready' : 'hide' };
  const o = S.online;
  if (!o || !o.mode || !S.def) return { ph: 'wait' };
  if (DU.fin) return { ph: 'done' };
  if (o.mode === 'race') {
    const d = S.def,
      find = isMov(d) && (d.type === 'despl' || S.phase === 'find');
    return {
      ph: find ? 'find' : 'shoot',
      er: S.ans ? S.ans.used : 0,
      sh: d.shots < 900 ? d.shots - S.shotsLeft : 0,
      tg: targetsLeft(),
      tt: S.objs.filter((x) => x.k === 'target').length,
      fl: DU.fails,
    };
  }
  return {
    ph: S.mode === 'cool' ? 'cool' : S.solved ? 'shoot' : 'find',
    er: DU.errors,
    sh: DU.reloads * HIDE.SHOTS + (S.def.shots - S.shotsLeft),
  };
}

// Convierte el progreso en vivo del rival en un texto legible.
function liveText(lv) {
  if (!lv) return L('conectando…', 'connecting…');
  const t = {
    wait: L('esperando', 'waiting'),
    hide: L('escondiendo su cerdito…', 'hiding their piglet…'),
    ready: L('ya escondió su cerdito', 'has hidden their piglet'),
    done: L('¡terminó!', 'finished!'),
    cool: L('recargando tiros…', 'reloading shots…'),
  }[lv.ph];
  if (t) return t;
  if (lv.ph === 'find') {
    const base =
      ON.md === 'duel' && S.online && S.online.mode === 'hide'
        ? L('buscando tu cerdito', 'looking for your piglet')
        : L('resolviendo vectores', 'solving vectors');
    return (
      base +
      (lv.er
        ? L(` · ${lv.er} error${lv.er > 1 ? 'es' : ''}`, ` · ${lv.er} miss${lv.er > 1 ? 'es' : ''}`)
        : '')
    );
  }
  if (lv.ph === 'shoot') {
    if (S.online && S.online.mode === 'hide')
      return L(
        `¡encontró tu cerdito! · ${lv.sh} tiro${lv.sh === 1 ? '' : 's'}`,
        `found your piglet! · ${lv.sh} shot${lv.sh === 1 ? '' : 's'}`,
      );
    return (
      L(`lanzando · objetivos ${lv.tt - lv.tg}/${lv.tt}`, `launching · targets ${lv.tt - lv.tg}/${lv.tt}`) +
      (lv.sh ? L(` · ${lv.sh} tiros`, ` · ${lv.sh} shots`) : '') +
      (lv.fl
        ? L(` · ${lv.fl} reinicio${lv.fl > 1 ? 's' : ''}`, ` · ${lv.fl} restart${lv.fl > 1 ? 's' : ''}`)
        : '')
    );
  }
  return '';
}

// Marcador de rondas de la Carrera ("Rondas: tú 1 – 0 Ana").
function duelScoreText(h) {
  if (!h || !h.cfg || h.cfg.dm !== 'race') return '';
  const me = (h.rw || []).filter((x) => x === ME.id).length,
    ri = (h.rw || []).filter((x) => x && x !== ME.id).length;
  const rv = duelRival();
  return L(
    `Rondas: tú ${me} – ${ri} ${rv ? rv.name : 'rival'}`,
    `Rounds: you ${me} – ${ri} ${rv ? rv.name : 'rival'}`,
  );
}

// Actualiza la barra del rival que se ve encima de la escena durante un duelo.
function updateRival() {
  const bar = $('rivalBar');
  if (!isDuel() || VIEW !== 'game' || !S.online || !S.online.mode) {
    bar.hidden = true;
    return;
  }
  const rv = duelRival(),
    h = duelHostState();
  bar.hidden = false;
  bar.innerHTML = `<span>⚔ <b>${esc(rv ? rv.name : L('Rival', 'Rival'))}</b>: ${rv && !rv.on ? `<span class="bad">${L('desconectado', 'disconnected')}</span>` : esc(liveText(rv && rv.live))}</span>${duelScoreText(h) ? `<span class="score2">${esc(duelScoreText(h))}</span>` : ''}`;
}

// Texto de la etiqueta del duelo (ronda, cronómetro y esperas).
function duelChip() {
  const o = S.online,
    h = duelHostState(),
    now = performance.now();
  let t =
    o.mode === 'race'
      ? `${L('Duelo', 'Duel')} · ${L('Ronda', 'Round')} ${(h ? h.rd : 0) + 1}/${h && h.cfg ? h.cfg.rounds : 1}`
      : `${L('Duelo', 'Duel')} · ${L('Escondite', 'Hide & seek')}`;
  let warn = false;
  if (DU.lockUntil > now) {
    t += ` · ${L('espera', 'wait')} ${Math.ceil((DU.lockUntil - now) / 1000)} s`;
    warn = true;
  }
  if (DU.coolUntil > now) {
    t += ` · ${L('recarga', 'reload')} ${Math.ceil((DU.coolUntil - now) / 1000)} s`;
    warn = true;
  }
  if (o.mode === 'race') t += ` · ⏱ ${fmtTime((now - DU.roundT0) / 1000)}`;
  return { t, warn };
}

/* ---------- HOST del duelo ---------- */
// El host del duelo recibe el estado del rival: lo acepta (solo uno), detecta si terminó y si ya escondió su cerdito.
function duelHostRemote(id, s) {
  if (s === null) {
    const p = HP.get(id);
    if (p && id === HS.g) {
      p.online = false;
      toast(L(`${p.name} salió del duelo`, `${p.name} left the duel`));
      if (HS.st === 'lobby') {
        HS.g = null;
        HP.delete(id);
      }
      hostSend();
      scheduleRender();
      updateRival();
    }
    return;
  }
  if (s.code !== ON.code || HS.kick.includes(id)) return;
  if (HS.g && id !== HS.g) return; // la sala ya tiene rival
  if (!HS.g) {
    if (HS.st !== 'lobby') return;
    HS.g = id;
  }
  let p = HP.get(id);
  if (!p) {
    p = {
      id,
      name: '',
      ev: new Map(),
      joined: Date.now(),
      online: true,
      raw: null,
      kicked: false,
      st: 'wait',
      lv: [],
      ix: [],
      sc: 0,
      k: 0,
      li: 0,
      at: 0,
    };
    HP.set(id, p);
  }
  const isNew = !p.name;
  p.name =
    String(s.n || '')
      .trim()
      .slice(0, 16) || L('Rival', 'Rival');
  if (isNew || !p.online) {
    toast(L(`${p.name} entró al duelo`, `${p.name} joined the duel`));
    SND.click();
  }
  p.online = true;
  p.raw = s;
  if (s.fin && HS.st === 'play' && s.fin.rd === HS.rd && HS.rw[HS.rd] == null) duelDeclare(id);
  if (HS.st === 'hide' && DU.clue && s.clue) duelStartSeek();
  hostSend();
  scheduleRender();
  updateRival();
}

// Botón "Iniciar duelo".
function duelStart() {
  if (!HS.g || !HS.cfg) return;
  if (HS.cfg.dm === 'race' && !HS.cfg.lv.length) return;
  duelResetLocal();
  HS.rd = 0;
  HS.rw = [];
  HS.win = null;
  HS.ep = Date.now();
  HS.st = HS.cfg.dm === 'hide' ? 'hide' : 'play';
  hostSend(true);
  duelSync(hState());
}

// Los dos ya escondieron su cerdito: empieza la búsqueda.
function duelStartSeek() {
  HS.st = 'play';
  HS.ep = Date.now();
  hostSend(true);
  duelSync(hState());
}

// Decide el ganador de la ronda y si el duelo terminó (Carrera: al mejor de 1, 3 o 5).
function duelDeclare(winner) {
  HS.rw[HS.rd] = winner;
  const wins = (id) => HS.rw.filter((x) => x === id).length;
  if (HS.cfg.dm === 'hide') {
    HS.st = 'end';
    HS.win = winner;
  } else {
    const need = Math.floor(HS.cfg.rounds / 2) + 1;
    if (wins(winner) >= need || HS.rd + 1 >= HS.cfg.rounds) {
      HS.st = 'end';
      HS.win = wins(ME.id) === wins(HS.g) ? null : wins(ME.id) > wins(HS.g) ? ME.id : HS.g;
    } else {
      HS.st = 'roundEnd';
      setTimeout(() => {
        if (HS.st === 'roundEnd') {
          HS.rd++;
          HS.st = 'play';
          HS.ep = Date.now();
          hostSend(true);
          duelSync(hState());
        }
      }, 3800);
    }
  }
  hostSend(true);
  duelSync(hState());
}

// Botón "Revancha": vuelve a la sala con el mismo rival.
function duelRematch() {
  HS.st = 'lobby';
  HS.rd = 0;
  HS.rw = [];
  HS.win = null;
  duelResetLocal();
  hostSend(true);
  duelSync(hState());
}

/* ---------- INVITADO del duelo ---------- */
// El invitado recibe el estado del host del duelo.
function duelGuestHost(s, first) {
  ON.md = 'duel';
  if (Array.isArray(s.kick) && s.kick.includes(ME.id)) {
    ON.view = 'kicked';
    endPlayerGame();
    renderOnline();
    if (ON.net) {
      ON.net.close();
      ON.net = null;
    }
    return;
  }
  if ((s.g && s.g !== ME.id) || (first && s.st !== 'lobby' && s.g !== ME.id)) {
    ON.view = 'full';
    renderOnline();
    if (ON.net) {
      ON.net.close();
      ON.net = null;
    }
    return;
  }
  if (ON.view === 'join') ON.view = 'dwait';
  duelSync(s);
  if (VIEW === 'online' && ['dwait', 'hide'].includes(ON.view)) scheduleRender();
  updateRival();
}

/* ---------- reacción común a los cambios de fase (host e invitado) ---------- */
// Reacciona a cada cambio de fase del duelo (sala, esconder, jugar, fin de ronda, fin) para host e invitado.
function duelSync(h) {
  if (!h || !isDuel()) return;
  const key = `${h.st}|${h.rd}|${h.ep}`,
    changed = key !== DU.key;
  DU.key = key;
  if (h.st === 'lobby') {
    if (changed) {
      duelExitGame();
      duelResetLocal();
      ON.view = ON.role === 'host' ? 'dlobby' : 'dwait';
      showView('online');
      renderOnline();
    }
  } else if (h.st === 'hide') {
    if (changed) {
      duelExitGame();
      duelResetLocal();
      ON.view = 'hide';
      showView('online');
      renderOnline();
      pushState(true);
    }
  } else if (h.st === 'play') {
    if (changed) {
      $('overlay').hidden = true;
      DU.roundOver = true;
      countdown(() => duelBeginRound(duelHostState()));
    }
  } else if (h.st === 'roundEnd') {
    if (changed) duelShowRoundEnd(h);
  } else if (h.st === 'end') {
    if (changed) {
      duelExitGame();
      ON.view = 'dend';
      showView('online');
      renderOnline();
      (h.win === ME.id ? SND.win : SND.bad)();
    }
  }
  updateRival();
}

// Empieza una ronda: carga el nivel de la Carrera o el nivel de búsqueda con las pistas del rival.
function duelBeginRound(h) {
  if (!h || h.st !== 'play') return;
  let d;
  if (h.cfg.dm === 'race') {
    d = resolveRef(h.cfg.lv[h.rd % h.cfg.lv.length], h.rd);
    if (!d) return;
  } else {
    const rv = duelRival();
    if (!rv || !rv.clue) {
      toast(L('No llegaron las pistas del rival.', 'The rival’s clues didn’t arrive.'));
      return;
    }
    d = buildSeekLevel(rv.clue);
  }
  d.id = '__duel';
  if (!S.online) ON.savedScore = S.score;
  S.score = 0;
  DU.fin = null;
  DU.errors = 0;
  DU.fails = 0;
  DU.reloads = 0;
  DU.lockUntil = 0;
  DU.coolUntil = 0;
  DU.roundOver = false;
  DU.roundT0 = performance.now();
  S.online = {
    mode: h.cfg.dm,
    i: 0,
    list: [d],
    cfg: { tm: 0, pr: false, bd: false, lv: [] },
    finished: false,
    deadline: 0,
    t0: 0,
    lastChip: '',
    ended: -1,
  };
  ON.view = 'game';
  loadOnlineLevel(0);
}

// Muestra quién ganó la ronda.
function duelShowRoundEnd(h) {
  DU.roundOver = true;
  if (VIEW !== 'game') return;
  const w = h.rw[h.rd],
    rv = duelRival();
  S.mode = 'end';
  S.proj = null;
  S.endTimer = 0;
  $('ovTitle').textContent =
    w === ME.id
      ? L(`¡Ganaste la ronda ${h.rd + 1}!`, `You won round ${h.rd + 1}!`)
      : L(
          `${rv ? rv.name : 'Tu rival'} ganó la ronda ${h.rd + 1}`,
          `${rv ? rv.name : 'Your rival'} won round ${h.rd + 1}`,
        );
  $('ovStars').innerHTML = '';
  $('ovText').textContent =
    duelScoreText(h) +
    ' · ' +
    L('La siguiente ronda empieza en un momento…', 'The next round starts in a moment…');
  $('ovRetry').hidden = true;
  setNext(null, null);
  $('overlay').hidden = false;
  syncUI();
  (w === ME.id ? SND.win : SND.bad)();
}

// Sale de la escena de juego del duelo.
function duelExitGame() {
  if (S.online && S.online.mode) {
    S.online = null;
    S.score = ON.savedScore;
    $('onChip').hidden = true;
    $('rivalBar').hidden = true;
    $('overlay').hidden = true;
    $('ovRetry').hidden = false;
    const pr = $('practice').closest('label');
    if (pr) pr.hidden = false;
  }
}
/* Avisar que terminé (derribé al cerdito o completé el nivel) */
// Avisa que terminé (completé el nivel o derribé el cerdito).
function duelFinish() {
  const t = Math.round(performance.now() - DU.roundT0);
  if (ON.role === 'host') {
    DU.fin = { rd: HS.rd, t };
    if (HS.st === 'play' && HS.rw[HS.rd] == null) duelDeclare(ME.id);
    else hostSend(true);
  } else {
    DU.fin = { rd: RH ? RH.rd : 0, t };
    playerSend(true);
  }
}
/* Fin de un intento dentro de un duelo: ganar avisa al host; fallar reinicia (carrera) o recarga tiros (escondite) */
// Fin de un intento en un duelo: si gané, aviso; si fallé, Carrera = reinicio inmediato y Escondite = recarga tras 5 s.
function duelLevelEnd(res) {
  const o = S.online;
  if (res === 'w') {
    if (o.ended === 0) return;
    o.ended = 0;
    S.mode = 'end';
    S.proj = null;
    duelFinish();
    if (DU.roundOver && VIEW !== 'game') return;
    $('ovTitle').textContent =
      o.mode === 'hide'
        ? L('¡Le diste al cerdito!', 'You hit the piglet!')
        : L('¡Nivel completado!', 'Level complete!');
    $('ovStars').innerHTML = '';
    $('ovText').textContent = L(
      `Tiempo: ${fmtTime((performance.now() - DU.roundT0) / 1000)}. Esperando el resultado…`,
      `Time: ${fmtTime((performance.now() - DU.roundT0) / 1000)}. Waiting for the result…`,
    );
    $('ovRetry').hidden = true;
    setNext(null, null);
    $('overlay').hidden = false;
    SND.win();
    return;
  }
  if (o.mode === 'race') {
    S.mode = 'end';
    S.proj = null;
    DU.fails++;
    SND.bad();
    toast(L('¡Otra vez! El nivel se reinicia.', 'Again! The level restarts.'));
    pushState();
    setTimeout(() => {
      if (S.online === o && !DU.roundOver && !DU.fin) loadOnlineLevel(0);
    }, 1200);
    return;
  }
  // escondite: sin tiros → esperar 5 s y recargar 3 tiros
  S.mode = 'cool';
  S.proj = null;
  DU.coolUntil = performance.now() + HIDE.COOL;
  floatText(1, Math.max(3, S.def.vars.h0.def + 2), L('Recargando…', 'Reloading…'), C.pencil);
  SND.bad();
  pushState();
  syncUI();
  clearTimeout(DU.coolT);
  DU.coolT = setTimeout(() => {
    if (S.online !== o || DU.fin) return;
    DU.reloads++;
    S.shotsLeft = S.def.shots;
    S.mode = 'aim';
    DU.coolUntil = 0;
    hud();
    syncUI();
    pushState();
  }, HIDE.COOL);
}

/* ---------- ESCONDITE: pistas y nivel de búsqueda ---------- */
/* Crea los vectores-pista que llevan desde el lanzador (0, 0) hasta el escondite.
   Dificultad 1: un solo vector (magnitud y ángulo). Dificultad 2: de 2 a 3 vectores encadenados.
   Los valores se redondean (0.1 m y 1°), así que el cerdito queda en la suma exacta de los vectores. */

// Genera los vectores-pista desde el lanzador (0, 0) hasta el escondite.
// Dificultad 1: un vector. Dificultad 2: 2 o 3 vectores encadenados.
function genClue(hx, hy, df) {
  const r = Math.random,
    r1 = (v) => Math.round(v * 10) / 10;
  const dirFor = (dx, dy) =>
    Math.abs(dy) < 0.05
      ? dx >= 0
        ? 'r'
        : 'l'
      : Math.abs(dx) < 0.05
        ? dy > 0
          ? 'u'
          : 'd'
        : (dy > 0 ? 'u' : 'd') + (dx > 0 ? 'r' : 'l');
  const leg = (dx, dy) => {
    const dir = dirFor(dx, dy);
    return {
      d: r1(Math.hypot(dx, dy)),
      ang: isPure(dir)
        ? dir === 'r' || dir === 'l'
          ? 0
          : 90
        : Math.round((Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI),
      dir,
    };
  };
  let pts = [[0, 0]];
  if (df >= 2) {
    const n = r() < 0.5 ? 2 : 3;
    for (let tries = 0; tries < 60; tries++) {
      pts = [[0, 0]];
      for (let i = 1; i < n; i++)
        pts.push([Math.round((3 + r() * 39) * 2) / 2, Math.round(r() * 16 * 2) / 2]);
      pts.push([hx, hy]);
      if (pts.every((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) >= 4)) break;
    }
  } else pts.push([hx, hy]);
  const vecs = [];
  for (let i = 1; i < pts.length; i++) vecs.push(leg(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  // posición final real = suma de los vectores ya redondeados
  let fx = 0,
    fy = 0;
  vecs.forEach((v) => {
    const vv = vecVals(normVec(v));
    fx += vv.x;
    fy += vv.y;
  });
  return { vecs, fx: r2(fx), fy: r2(Math.max(0, fy)), df };
}

// Crea el nivel de búsqueda a partir de las pistas del rival.
function buildSeekLevel(clue) {
  const d = normLevel({
    name: L('Cerdito del rival', 'Rival’s piglet'),
    type: 'mixto',
    W: HIDE.W,
    shots: HIDE.SHOTS,
    grid: false,
    terrain: [],
    objs: [],
  });
  d.vars = defaultVars();
  d.mov = normMov(
    {
      ax: 3,
      ay: 0,
      showPath: false,
      hideScale: true,
      tries: 6,
      vecs: clue.vecs.map((v) => ({
        d: v.d,
        ang: v.ang,
        dir: v.dir,
        show: isPure(v.dir) ? sh('d dir') : sh('d ang dir'),
      })),
      R: { show: sh('') },
    },
    HIDE.W,
  );
  d.mov.ax = 0;
  d.mov.ay = 0; // los vectores empiezan en el lanzador: el origen (0, 0)
  return d;
}

// Margen de error aceptado para las coordenadas (0.5 m o el 3 % de la distancia).
function hideTol() {
  const F = S.res.F;
  return Math.max(0.5, 0.03 * Math.hypot(F.x, F.y));
}
/* Panel de la fase de búsqueda (reemplaza al panel normal de vectores) */
// Panel del Escondite: pistas, casillas x / y y, al encontrarlo, la solución.
function hideRenderFind() {
  const m = S.def.mov,
    r = S.res,
    solved = S.solved;
  let c = `<p>${L('Tu rival escondió su cerdito. Estos vectores empiezan en <b>el lanzador, el origen (0, 0)</b>, y van uno tras otro hasta el escondite.', 'Your rival hid their piglet. These vectors start at <b>the launcher, the origin (0, 0)</b>, and follow one after another to the hiding spot.')}</p><div class="vlist">`;
  m.vecs.forEach((V, i) => {
    const v = r.vals[i];
    c += `<div class="vrow"><b>${vname(i)}</b> <span class="mono">|${vname(i)}| = ${fmtN(v.d)} m${isPure(v.dir) ? '' : ` · θ = ${fmtN(v.ang)}°`} · ${L('dirección', 'direction')}: ${dirLow(v.dir)}</span></div>`;
  });
  c += `</div><p class="hint">${L('Ángulos desde la horizontal. Suma las componentes: x = Σ |V|·cos θ (con signo), y = Σ |V|·sin θ (con signo).', 'Angles from the horizontal. Add up the components: x = Σ |V|·cos θ (signed), y = Σ |V|·sin θ (signed).')}</p>`;
  $('clues').innerHTML = c;
  $('replay').hidden = true;
  $('ansTitle').textContent = L('Coordenadas del cerdito', 'Piglet coordinates');
  if (!solved) {
    $('ansForm').hidden = false;
    $('ansSol').hidden = true;
    if (!$('hx')) {
      $('ansFields').innerHTML =
        `<label class="field"><span>x (m)</span><input type="number" id="hx" step="any" inputmode="decimal"></label>
        <label class="field"><span>y (m)</span><input type="number" id="hy" step="any" inputmode="decimal"></label>`;
    }
    const left = DU.lockUntil - performance.now();
    $('ansTries').textContent =
      left > 0
        ? L(
            `Incorrecto. Espera ${Math.ceil(left / 1000)} s para volver a intentar.`,
            `Wrong. Wait ${Math.ceil(left / 1000)} s to try again.`,
          )
        : L(
            `Intentos ilimitados · si fallas, esperas 5 s · se acepta ±${fmtN(hideTol())} m`,
            `Unlimited attempts · if you miss, wait 5 s · ±${fmtN(hideTol())} m accepted`,
          );
    $('ansCheck').disabled = left > 0;
  } else {
    $('ansForm').hidden = true;
    $('ansSol').hidden = false;
    const vs = r.vals;
    $('ansSol').innerHTML = `<div class="sub">${L('¡Encontrado!', 'Found!')}</div>
      <div><span class="k">x</span> = ${vs.map((v) => sg(v.x)).join(' ')} = <b>${f(r.F.x)} m</b></div>
      <div><span class="k">y</span> = ${vs.map((v) => sg(v.y)).join(' ')} = <b>${f(r.F.y)} m</b></div>
      <div class="next">${L(`Ahora derríbalo: tienes ${HIDE.SHOTS} tiros. Si fallas los ${HIDE.SHOTS}, esperas 5 s y recargas.`, `Now knock it down: you have ${HIDE.SHOTS} shots. If you miss all ${HIDE.SHOTS}, wait 5 s and reload.`)}</div>`;
  }
}
/* Comprobar las coordenadas escritas */
// Comprueba las coordenadas escritas; si fallas, esperas 5 s.
function hideCheck() {
  if (S.phase !== 'find' || performance.now() < DU.lockUntil) return;
  const x = parseFloat(String($('hx').value).replace(',', '.')),
    y = parseFloat(String($('hy').value).replace(',', '.'));
  if (!isFinite(x) || !isFinite(y)) {
    $('ansFb').innerHTML = `<span class="bad">${L('Escribe x e y.', 'Type x and y.')}</span>`;
    return;
  }
  const F = S.res.F,
    tol = hideTol();
  if (Math.abs(x - F.x) <= tol && Math.abs(y - F.y) <= tol) {
    S.ans.solved = true;
    S.ans.used = DU.errors + 1;
    $('ansFb').innerHTML =
      `<span class="ok">✓ ${L('¡Coordenadas correctas!', 'Correct coordinates!')}</span>`;
    SND.good();
    reveal();
    pushState(true);
    return;
  }
  DU.errors++;
  DU.lockUntil = performance.now() + HIDE.LOCK;
  SND.bad();
  const hints = [];
  hints.push(Math.abs(x - F.x) <= tol ? `<span class="ok">✓ x</span>` : `<span class="bad">✗ x</span>`);
  hints.push(Math.abs(y - F.y) <= tol ? `<span class="ok">✓ y</span>` : `<span class="bad">✗ y</span>`);
  $('ansFb').innerHTML = hints.join(' ');
  hideRenderFind();
  pushState();
  const tick = () => {
    if (!S.online || S.solved) return;
    hideRenderFind();
    if (performance.now() < DU.lockUntil) setTimeout(tick, 250);
  };
  setTimeout(tick, 250);
}

/* ---------- mapa para esconder el cerdito ---------- */
// Dibuja el mapa donde se esconde el cerdito (con cuadrícula en metros).
function drawHideMap() {
  const cvs = $('hideMap');
  if (!cvs) return;
  const w = cvs.clientWidth,
    dpr = Math.min(2, window.devicePixelRatio || 1);
  const h = Math.round(((w - 48) / (HIDE.W + 1)) * HIDE.H + 38); // alto justo para que quepa el mapa completo
  cvs.style.height = h + 'px';
  cvs.width = Math.round(w * dpr);
  cvs.height = Math.round(h * dpr);
  const c = cvs.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pl = 38,
    pb = 28,
    pt = 10,
    pr = 10,
    s = (w - pl - pr) / (HIDE.W + 1);
  const X = (x) => pl + x * s,
    Y = (y) => h - pb - y * s;
  cvs._map = { X, Y, s, pl, pb, h };
  c.fillStyle = C.paper;
  c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(147,194,62,.10)';
  c.fillRect(X(HIDE.XMIN), Y(HIDE.YMAX), (HIDE.XMAX - HIDE.XMIN) * s, HIDE.YMAX * s);
  for (let x = 0; x <= HIDE.W; x++) {
    c.strokeStyle = x % 5 ? C.grid : C['grid-major'];
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(X(x) + 0.5, Y(0));
    c.lineTo(X(x) + 0.5, Y(HIDE.H));
    c.stroke();
  }
  for (let y = 0; y <= HIDE.H; y++) {
    c.strokeStyle = y % 5 ? C.grid : C['grid-major'];
    c.beginPath();
    c.moveTo(X(0), Y(y) + 0.5);
    c.lineTo(X(HIDE.W), Y(y) + 0.5);
    c.stroke();
  }
  c.fillStyle = C['ink-soft'];
  c.font = "11px 'IBM Plex Mono', monospace";
  c.textAlign = 'center';
  c.textBaseline = 'top';
  for (let x = 0; x <= HIDE.W; x += 5) c.fillText(String(x), X(x), Y(0) + 6);
  c.textAlign = 'right';
  c.textBaseline = 'middle';
  for (let y = 5; y <= HIDE.H; y += 5) c.fillText(y + ' m', X(0) - 4, Y(y));
  c.fillStyle = C.earth;
  c.fillRect(X(0) - 6, Y(0), (HIDE.W + 1) * s + 6, 3);
  c.fillStyle = C.ink;
  c.fillRect(X(0) - 5, Y(1.4), 10, 1.4 * s);
  c.fillStyle = C.pencil;
  c.beginPath();
  c.arc(X(0), Y(1.6), 6, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = C.ink;
  c.textAlign = 'left';
  c.textBaseline = 'bottom';
  c.fillText('(0, 0)', X(0) + 8, Y(0) - 2);
  const p = DU.clue ? { x: DU.clue.fx, y: DU.clue.fy } : DU.spot;
  if (p) {
    if (p.y > 0.05) {
      c.fillStyle = C.earth;
      c.fillRect(X(p.x) - 0.8 * s, Y(p.y), 1.6 * s, p.y * s);
    }
    const r = Math.max(8, 0.6 * s);
    c.fillStyle = C.target;
    c.strokeStyle = C['target-dark'];
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(X(p.x), Y(p.y) - r, r * 1.1, r * 0.95, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = C.ink;
    c.beginPath();
    c.arc(X(p.x) - r * 0.35, Y(p.y) - r * 1.15, r * 0.15, 0, 7);
    c.arc(X(p.x) + r * 0.35, Y(p.y) - r * 1.15, r * 0.15, 0, 7);
    c.fill();
    c.textAlign = 'center';
    c.textBaseline = 'bottom';
    c.font = "600 12px 'IBM Plex Mono', monospace";
    c.fillText(`(${fmtN(p.x)}, ${fmtN(p.y)})`, X(p.x), Y(p.y) - r * 2.2);
  }
}

// Coloca el cerdito donde se toca el mapa (redondeado a 0.5 m y dentro de la zona permitida).
function hideMapClick(e) {
  if (DU.clue) return;
  const cvs = $('hideMap'),
    m = cvs._map;
  if (!m) return;
  const rect = cvs.getBoundingClientRect();
  const x = (e.clientX - rect.left - m.pl) / m.s,
    y = (m.h - m.pb - (e.clientY - rect.top)) / m.s;
  DU.spot = {
    x: clamp(Math.round(x * 2) / 2, HIDE.XMIN, HIDE.XMAX),
    y: clamp(Math.round(y * 2) / 2, 0, HIDE.YMAX),
  };
  SND.click();
  drawHideMap();
  const b = $('hdGo');
  if (b) b.disabled = false;
  if ($('hdX')) {
    $('hdX').value = DU.spot.x;
    $('hdY').value = DU.spot.y;
  }
}

// Botón "Esconder aquí": genera las pistas y se las envía al rival.
function hideSubmit() {
  if (!DU.spot || DU.clue) return;
  const h = duelHostState();
  DU.clue = genClue(DU.spot.x, DU.spot.y, h && h.cfg ? h.cfg.df : 1);
  SND.good();
  pushState(true);
  if (ON.role === 'host') {
    const rv = duelRival();
    if (HS.st === 'hide' && rv && rv.clue) duelStartSeek();
  }
  renderOnline();
}

/* ---------- pantallas del duelo ---------- */
// Resumen del modo de duelo elegido.
function duelModeSummary(cfg) {
  if (!cfg) return '';
  if (cfg.dm === 'hide')
    return `<ul class="sumList"><li>${L('Modo', 'Mode')}: <b>${L('Escondite', 'Hide & seek')}</b></li><li>${L('Dificultad', 'Difficulty')}: <b>${cfg.df === 2 ? L('2 · varios vectores', '2 · several vectors') : L('1 · un vector', '1 · one vector')}</b></li>
    <li>${L('Errores ilimitados (espera de 5 s) · 3 tiros por recarga', 'Unlimited misses (5 s wait) · 3 shots per reload')}</li></ul>`;
  const labs = (cfg.lv || []).map(refLabel);
  return `<ul class="sumList"><li>${L('Modo', 'Mode')}: <b>${L('Carrera', 'Race')}</b></li><li>${L('Rondas', 'Rounds')}: <b>${cfg.rounds === 1 ? L('1 ronda', '1 round') : L(`al mejor de ${cfg.rounds}`, `best of ${cfg.rounds}`)}</b></li>
    <li>${L('Si fallas, el nivel se reinicia al instante', 'If you fail, the level restarts instantly')}</li></ul>
    ${labs.length ? `<div class="lvChips">${labs.map((l, i) => `<span class="${l.cls}">${L('R', 'R')}${i + 1} · ${esc(l.name)}</span>`).join('')}</div>` : `<p class="hint">${L('Aún no hay niveles elegidos.', 'No levels picked yet.')}</p>`}`;
}

// Dibuja las pantallas del duelo: sala del host, espera del invitado, esconder, fin y sala llena.
function renderDuel() {
  const body = $('onBody'),
    v = ON.view,
    h = duelHostState(),
    rv = duelRival();
  const codeBox = `<div class="codeBox"><div><small>${L('Código', 'Code')}</small><b>${esc(ON.code)}</b></div>${ON.role === 'host' ? `<button class="btn small" id="onCopy" type="button">${L('Copiar', 'Copy')}</button>` : ''}</div>`;
  const leaveBtn = `<button class="mbtn inline" id="duLeave" type="button">${L('← Salir', '← Leave')}</button>`;
  if (v === 'full') {
    body.innerHTML = `<section class="onCard narrow"><h2>${L('El duelo está lleno', 'The duel is full')}</h2><p>${L('Ese duelo ya tiene dos jugadores. Pide un código nuevo.', 'That duel already has two players. Ask for a new code.')}</p><button class="btn" id="duHome" type="button">${L('Volver al inicio', 'Back to home')}</button></section>`;
    $('duHome').onclick = () => leaveOnline(true);
    return;
  }
  if (v === 'dlobby') {
    const cfg = HS.cfg,
      race = cfg.dm === 'race';
    const reason = !HS.g
      ? L('Espera a que entre tu rival con el código.', 'Wait for your rival to join with the code.')
      : race && !cfg.lv.length
        ? L('Elige al menos un nivel.', 'Pick at least one level.')
        : '';
    body.innerHTML = `<div class="onHead">${leaveBtn}<h2>${L('Duelo 1 vs 1', '1 vs 1 duel')}</h2>${codeBox}</div>
    <div class="onGrid">
      <section class="onCard"><h3>${L('Jugadores', 'Players')}</h3>
        <label class="field"><span>${L('Tu nombre', 'Your name')}</span><input type="text" id="duName" maxlength="16" value="${esc(ME.name)}" placeholder="${L('Anfitrión', 'Host')}"></label>
        <div class="vsRow"><span class="vsName me">${esc(ME.name || L('Tú', 'You'))}</span><span class="vs">VS</span>
          ${HS.g && rv ? `<span class="vsName">${esc(rv.name)} <button type="button" class="kickX" id="duKick" title="${L('Expulsar', 'Remove')}">×</button></span>` : `<span class="vsName wait"><span class="waitDots">${L('Esperando rival', 'Waiting for rival')}</span></span>`}</div>
        <p class="hint">${L(`Tu rival entra con <b>Online → Unirse a un juego</b> y el código <b>${esc(ON.code)}</b>.`, `Your rival joins with <b>Online → Join a game</b> and the code <b>${esc(ON.code)}</b>.`)}</p>
      </section>
      <section class="onCard"><h3>${L('Modo de juego', 'Game mode')}</h3>
        <div class="duModes">
          <button type="button" class="duMode" data-dm="race" aria-pressed="${race}"><b>${L('Carrera', 'Race')}</b><small>${L('El mismo nivel para los dos: gana quien lo complete primero.', 'Same level for both: whoever completes it first wins.')}</small></button>
          <button type="button" class="duMode" data-dm="hide" aria-pressed="${!race}"><b>${L('Escondite', 'Hide & seek')}</b><small>${L('Cada uno esconde un cerdito; encuentra el del rival con vectores y derríbalo.', 'Each one hides a piglet; find your rival’s with vectors and knock it down.')}</small></button>
        </div>
        ${
          race
            ? `<div class="setrow"><span class="setlabel">${L('Rondas', 'Rounds')}</span><div class="seg2 light" role="group">${[1, 3, 5].map((n) => `<button type="button" data-rounds="${n}" aria-pressed="${cfg.rounds === n}">${n === 1 ? '1' : L(`Mejor de ${n}`, `Best of ${n}`)}</button>`).join('')}</div></div>
          <button class="btn big" id="duPick" type="button">${L('Elegir niveles', 'Pick levels')}</button>`
            : `<div class="setrow"><span class="setlabel">${L('Dificultad', 'Difficulty')}</span><div class="seg2 light" role="group">
            <button type="button" data-df="1" aria-pressed="${cfg.df === 1}">${L('1 · un vector', '1 · one vector')}</button>
            <button type="button" data-df="2" aria-pressed="${cfg.df === 2}">${L('2 · varios vectores', '2 · several vectors')}</button></div>
            <small class="hint">${cfg.df === 2 ? L('El juego genera de 2 a 3 vectores encadenados con magnitud, ángulo y dirección.', 'The game makes 2 to 3 chained vectors with length, angle and direction.') : L('El juego da un solo vector desde el lanzador: su magnitud y su ángulo.', 'The game gives a single vector from the launcher: its length and angle.')}</small></div>`
        }
        ${duelModeSummary(cfg)}
        <button class="btn go" id="duStart" type="button" ${reason ? 'disabled' : ''}>${L('Iniciar duelo', 'Start duel')}</button>
        ${reason ? `<p class="hint">${reason}</p>` : ''}
      </section>
    </div>`;
    const nm = $('duName');
    nm.addEventListener('input', () => {
      ME.name = nm.value.trim().slice(0, 16);
      try {
        localStorage.setItem('parabola-brava-name', ME.name);
      } catch (e) {}
      hostSend();
    });
    body.querySelectorAll('[data-dm]').forEach(
      (b) =>
        (b.onclick = () => {
          HS.cfg = { ...HS.cfg, dm: b.dataset.dm };
          hostSend(true);
          renderOnline();
        }),
    );
    body.querySelectorAll('[data-rounds]').forEach(
      (b) =>
        (b.onclick = () => {
          HS.cfg = { ...HS.cfg, rounds: +b.dataset.rounds };
          hostSend(true);
          renderOnline();
        }),
    );
    body.querySelectorAll('[data-df]').forEach(
      (b) =>
        (b.onclick = () => {
          HS.cfg = { ...HS.cfg, df: +b.dataset.df };
          hostSend(true);
          renderOnline();
        }),
    );
    const pk = $('duPick');
    if (pk) pk.onclick = () => openPicker(true);
    const kk = $('duKick');
    if (kk)
      kk.onclick = () => {
        const id = HS.g;
        kickPlayer(id);
        HS.g = null;
        HP.delete(id);
        hostSend(true);
        renderOnline();
      };
    $('duStart').onclick = duelStart;
  } else if (v === 'dwait') {
    body.innerHTML = `<div class="onHead">${leaveBtn}<h2>${L('Duelo 1 vs 1', '1 vs 1 duel')}</h2>${codeBox}</div>
    <section class="onCard narrow"><h2 class="waitDots">${L(`Esperando a que ${esc(h ? h.hn : 'el host')} inicie el duelo`, `Waiting for ${esc(h ? h.hn : 'the host')} to start the duel`)}</h2>
      <div class="vsRow"><span class="vsName me">${esc(ME.name)} ${L('(tú)', '(you)')}</span><span class="vs">VS</span><span class="vsName">${esc(h ? h.hn : '…')}</span></div>
      ${duelModeSummary(h && h.cfg)}</section>`;
  } else if (v === 'hide') {
    const ready = !!DU.clue,
      rvReady = rv && rv.live && rv.live.ph === 'ready';
    body.innerHTML = `<div class="onHead">${leaveBtn}<h2>${L('Esconde tu cerdito', 'Hide your piglet')}</h2>${codeBox}</div>
    <section class="onCard">
      <p>${
        ready
          ? L(
              `Listo: tu cerdito quedó en <b>(${fmtN(DU.clue.fx)}, ${fmtN(DU.clue.fy)})</b>. Tu rival recibirá ${DU.clue.vecs.length === 1 ? 'un vector' : `${DU.clue.vecs.length} vectores`} como pista.`,
              `Done: your piglet is at <b>(${fmtN(DU.clue.fx)}, ${fmtN(DU.clue.fy)})</b>. Your rival will get ${DU.clue.vecs.length === 1 ? 'one vector' : `${DU.clue.vecs.length} vectors`} as a clue.`,
            )
          : L(
              `Toca el mapa para elegir el escondite (x entre ${HIDE.XMIN} y ${HIDE.XMAX} m, altura hasta ${HIDE.YMAX} m). Si queda en el aire, tendrá una plataforma debajo.`,
              `Tap the map to choose the hiding spot (x between ${HIDE.XMIN} and ${HIDE.XMAX} m, height up to ${HIDE.YMAX} m). If it’s in the air, it gets a platform below.`,
            )
      }</p>
      <canvas id="hideMap" class="hideMap" aria-label="${L('Mapa para esconder el cerdito', 'Map to hide the piglet')}"></canvas>
      <div class="hdRow">${
        ready
          ? '<span></span>'
          : `<span class="hdInputs"><label>x (m) <input type="number" id="hdX" min="${HIDE.XMIN}" max="${HIDE.XMAX}" step="0.5" value="${DU.spot ? DU.spot.x : ''}"></label>
          <label>y (m) <input type="number" id="hdY" min="0" max="${HIDE.YMAX}" step="0.5" value="${DU.spot ? DU.spot.y : ''}"></label></span>`
      }
        ${ready ? '' : `<button class="btn go" id="hdGo" type="button" ${DU.spot ? '' : 'disabled'}>${L('Esconder aquí', 'Hide here')}</button>`}</div>
      <p class="hint">⚔ ${esc(rv ? rv.name : L('Rival', 'Rival'))}: ${rvReady ? L('ya escondió su cerdito', 'has hidden their piglet') : L('escondiendo su cerdito…', 'hiding their piglet…')}
        ${ready && rvReady ? ' · ' + L('¡Empieza la búsqueda!', 'The search begins!') : ''}</p>
    </section>`;
    drawHideMap();
    $('hideMap').addEventListener('click', hideMapClick);
    const go = $('hdGo');
    if (go) go.onclick = hideSubmit;
    // también se puede escribir la posición exacta
    ['hdX', 'hdY'].forEach((id) => {
      const el = $(id);
      if (el)
        el.addEventListener('change', () => {
          const x = num($('hdX').value, NaN),
            y = num($('hdY').value, 0);
          if (!isFinite(x)) return;
          DU.spot = {
            x: clamp(Math.round(x * 2) / 2, HIDE.XMIN, HIDE.XMAX),
            y: clamp(Math.round(y * 2) / 2, 0, HIDE.YMAX),
          };
          $('hdX').value = DU.spot.x;
          $('hdY').value = DU.spot.y;
          $('hdGo').disabled = false;
          drawHideMap();
        });
    });
  } else if (v === 'dend') {
    const won = h && h.win === ME.id,
      tie = h && !h.win;
    const rows =
      h && h.cfg && h.cfg.dm === 'race'
        ? (h.rw || [])
            .map(
              (w, i) =>
                `<tr><td>${L('Ronda', 'Round')} ${i + 1}</td><td>${esc(refLabel(h.cfg.lv[i % h.cfg.lv.length]).name)}</td><td><b>${w === ME.id ? L('Tú', 'You') : esc(rv ? rv.name : 'Rival')}</b></td></tr>`,
            )
            .join('')
        : '';
    body.innerHTML = `<section class="onCard narrow duEnd">
      <h2 class="${won ? 'win' : ''}">${tie ? L('¡Empate!', 'It’s a tie!') : won ? L('¡Ganaste el duelo!', 'You won the duel!') : L(`${esc(rv ? rv.name : 'Tu rival')} ganó el duelo`, `${esc(rv ? rv.name : 'Your rival')} won the duel`)}</h2>
      ${
        h && h.cfg && h.cfg.dm === 'race'
          ? `<p>${esc(duelScoreText(h))}</p><div class="tableWrap"><table class="rTable"><tbody>${rows}</tbody></table></div>`
          : `<p>${won ? L('Encontraste y derribaste el cerdito de tu rival primero.', 'You found and knocked down your rival’s piglet first.') : L('Tu rival encontró y derribó tu cerdito primero.', 'Your rival found and knocked down your piglet first.')}</p>`
      }
      ${ON.role === 'host' ? `<button class="btn go" id="duAgain" type="button" ${HS.g ? '' : 'disabled'}>${L('Revancha', 'Rematch')}</button>` : `<p class="hint">${L('Si el host pide revancha, volverás a la sala automáticamente.', 'If the host asks for a rematch, you’ll return to the room automatically.')}</p>`}
      <button class="btn ghost" id="duHome" type="button">${L('Volver al inicio', 'Back to home')}</button>
    </section>`;
    const ag = $('duAgain');
    if (ag) ag.onclick = duelRematch;
    $('duHome').onclick = () => leaveOnline(true);
  }
  const cp = $('onCopy');
  if (cp)
    cp.onclick = () => {
      try {
        navigator.clipboard.writeText(ON.code).then(
          () => toast(L('Código copiado', 'Code copied')),
          () => toast(ON.code),
        );
      } catch (e) {
        toast(ON.code);
      }
    };
  const lv = $('duLeave');
  if (lv)
    lv.onclick = () => {
      if (ON.confirm === 'du') {
        leaveOnline(true);
        return;
      }
      ON.confirm = 'du';
      lv.textContent = L('¿Seguro? Pulsa otra vez', 'Sure? Press again');
      setTimeout(() => {
        if (ON.confirm === 'du') {
          ON.confirm = null;
          const b = $('duLeave');
          if (b) b.textContent = L('← Salir', '← Leave');
        }
      }, 3000);
    };
}
window.addEventListener('resize', () => {
  if (VIEW === 'online' && ON.view === 'hide') drawHideMap();
});
