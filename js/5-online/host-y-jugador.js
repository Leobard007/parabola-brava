/* ======================================================================
   ARCHIVO: js/5-online/host-y-jugador.js

   MODO ONLINE: LÓGICA DEL HOST Y DEL JUGADOR
   HOST: crear partida, recibir jugadores, iniciar, expulsar y terminar.
   JUGADOR: unirse con un código, esperar, cuenta regresiva, jugar sus niveles y
   enviar cada respuesta y cada tiro para que el host los vea.
   ====================================================================== */

/* =========================================================
   HOST
   ========================================================= */

// Estado que el HOST envía a todos: fase, configuración, lista de jugadores y expulsados.
function hState() {
  const ro = [...HP.values()]
    .filter((p) => !p.kicked && (p.online || HS.st !== 'lobby'))
    .map((p) => [p.id, p.name, p.sc, p.st, p.online ? 1 : 0]);
  let cfg = null;
  if (HS.cfg) {
    const { _keys, ...c } = HS.cfg;
    void _keys;
    cfg = c;
  }
  const s = { r: 'h', code: ON.code, md: ON.md, st: HS.st, ep: HS.ep, cfg, ro, kick: HS.kick.slice(-40) };
  if (ON.md === 'duel')
    Object.assign(s, {
      hn: ME.name || L('Anfitrión', 'Host'),
      hid: ME.id,
      g: HS.g || null,
      rd: HS.rd,
      rw: HS.rw,
      me: duelLive(),
      clue: DU.clue || null,
      win: HS.win || null,
    });
  if (ON.net && ON.net.limit !== Infinity)
    while (JSON.stringify(s).length > MAX_STATE && s.ro.length) s.ro.pop();
  return s;
}

// Envía el estado del host (agrupando cambios seguidos para no saturar la red).
function hostSend(now) {
  if (!ON.net || ON.role !== 'host') return;
  clearTimeout(ON.sendT);
  if (now) ON.net.send(hState());
  else ON.sendT = setTimeout(() => ON.net && ON.net.send(hState()), 200);
}

// Crea una partida: conecta, elige un código libre y abre la sala de espera.
async function createGame(md = 'class') {
  resetOnline();
  ON.role = 'host';
  ON.view = 'connecting';
  ON.md = md;
  if (md === 'duel') {
    HS.cfg = clone(DUEL_DEFAULT);
    try {
      ME.name = localStorage.getItem('parabola-brava-name') || '';
    } catch (e) {}
  }
  showView('online');
  renderOnline();
  const net = await makeNet();
  if (ON.role !== 'host') {
    net.close();
    return;
  }
  net.onRemote = hostOnRemote;
  net.onDrop = () =>
    toast(L('Se perdió la conexión con el servicio en línea.', 'Lost the connection to the online service.'));
  let res = null;
  for (let i = 0; i < 5; i++) {
    ON.code = newCode();
    res = await net.start('host', ON.code);
    if (ON.role !== 'host') {
      net.close();
      return;
    }
    if (res.ok || res.reason !== 'taken') break;
  }
  if (!res.ok) {
    ON.view = 'error';
    ON.err = reasonText(res.reason);
    renderOnline();
    return;
  }
  ON.net = net;
  ON.view = md === 'duel' ? 'dlobby' : 'lobby';
  hostSend(true);
  renderOnline();
}

// El host recibe datos de un jugador (o null si se desconectó) y actualiza su tarjeta.
function hostOnRemote(id, s) {
  if (ON.md === 'duel') {
    duelHostRemote(id, s);
    return;
  }
  let p = HP.get(id);
  if (s === null) {
    if (p && p.online) {
      p.online = false;
      if (!p.kicked) toast(L(`${p.name} salió de la partida`, `${p.name} left the game`));
      hostSend();
      scheduleRender();
    }
    return;
  }
  if (HS.kick.includes(id) || s.code !== ON.code) return;
  if (!p) {
    if (HS.st === 'end' || (HS.st === 'play' && !(HS.cfg && HS.cfg.lt))) return;
    p = {
      id,
      name: '',
      st: 'wait',
      li: -1,
      k: 0,
      sc: 0,
      at: 0,
      lv: [],
      ix: [],
      ev: new Map(),
      online: true,
      joined: Date.now(),
      kicked: false,
      raw: null,
    };
    HP.set(id, p);
    p.name =
      String(s.n || '')
        .trim()
        .slice(0, 16) || L('Jugador', 'Player');
    toast(L(`${p.name} entró`, `${p.name} joined`));
    SND.click();
  }
  if (p.raw === s) return;
  p.raw = s;
  p.online = true;
  const wasDone = p.st === 'done';
  p.name =
    String(s.n || p.name)
      .trim()
      .slice(0, 16) || p.name;
  p.st = ['wait', 'play', 'done'].includes(s.st) ? s.st : p.st;
  p.li = num(s.li, p.li);
  p.k = num(s.k, p.k);
  p.sc = num(s.sc, p.sc);
  p.at = num(s.at, p.at);
  if (Array.isArray(s.lv)) p.lv = s.lv.slice(0, 60);
  if (Array.isArray(s.ix)) p.ix = s.ix.slice(0, 60);
  if (Array.isArray(s.ev))
    s.ev.forEach((e) => {
      if (Array.isArray(e) && !p.ev.has(e[0])) p.ev.set(e[0], e);
    });
  if (!wasDone && p.st === 'done') {
    toast(L(`${p.name} terminó con ${p.sc} puntos`, `${p.name} finished with ${p.sc} points`));
    SND.good();
  }
  hostSend();
  scheduleRender();
}

// Expulsa a un jugador.
function kickPlayer(id) {
  const p = HP.get(id);
  if (!p) return;
  p.kicked = true;
  p.online = false;
  if (!HS.kick.includes(id)) HS.kick.push(id);
  if (ON.net) ON.net.kick(id);
  toast(L(`${p.name} fue expulsado`, `${p.name} was removed`));
  if (DETAIL === id) {
    DETAIL = null;
    $('onDetail').hidden = true;
  }
  hostSend(true);
  renderOnline();
}

// Inicia la partida para todos.
function startGame() {
  const players = [...HP.values()].filter((p) => p.online && !p.kicked);
  if (!HS.cfg || !players.length) return;
  HS.st = 'play';
  HS.ep = Date.now();
  HS.cfg = { ...HS.cfg, sd: HS.cfg.sd || rid() };
  ON.view = 'dash';
  hostSend(true);
  renderOnline();
  toast(L('¡La partida empezó!', 'The game has started!'));
  SND.win();
}

// Termina la partida y muestra el podio.
function endGame() {
  HS.st = 'end';
  ON.view = 'end';
  hostSend(true);
  renderOnline();
  SND.win();
}

// Sale del modo online y vuelve al inicio.
function leaveOnline(toHome = true) {
  if (S.online) {
    S.online = null;
    S.score = ON.savedScore;
    $('onChip').hidden = true;
    $('onBoardBtn').hidden = true;
    $('onBoard').hidden = true;
    $('ovRetry').hidden = false;
    $('practice').closest('label').hidden = false;
  }
  resetOnline();
  if (toHome) showView('home');
}
window.addEventListener('beforeunload', (e) => {
  if (ON.role === 'host' && HS.st !== 'end' && [...HP.values()].some((p) => p.online)) {
    e.preventDefault();
    e.returnValue = '';
  }
  if (ON.net)
    try {
      ON.net.close();
    } catch (x) {}
});

/* =========================================================
   JUGADOR
   ========================================================= */

// Estado que cada JUGADOR envía al host: nombre, nivel, puntos, resultados y últimas respuestas.
function pState() {
  const s = {
    r: 'p',
    code: ON.code,
    id: ME.id,
    n: ME.name,
    st: ME.st,
    li: ME.li,
    k: ME.k,
    sc: ME.sc,
    at: ME.at,
    lv: ME.lv,
    ix: ME.ix,
    ev: ME.ev.slice(-8),
    q: ME.q,
    live: ON.md === 'duel' ? duelLive() : null,
    clue: DU.clue || null,
    fin: DU.fin || null,
  };
  while (JSON.stringify(s).length > MAX_STATE && s.ev.length > 1) s.ev.shift();
  return s;
}

// Envía el estado del jugador.
function playerSend(now) {
  if (!ON.net || ON.role !== 'player') return;
  clearTimeout(ON.sendT);
  if (now) ON.net.send(pState());
  else ON.sendT = setTimeout(() => ON.net && ON.net.send(pState()), 150);
}

// Se une a una partida con un nombre y un código.
async function joinGame(name, code) {
  const msg = $('onJoinMsg'),
    go = $('onJoinGo');
  name = name.trim().slice(0, 16);
  code = code.trim().toUpperCase();
  if (!name) {
    msg.textContent = L('Escribe tu nombre.', 'Type your name.');
    msg.className = 'onMsg bad';
    $('onName').focus();
    return;
  }
  if (!/^[A-Z0-9]{5}$/.test(code)) {
    msg.textContent = L('El código tiene 5 caracteres.', 'The code has 5 characters.');
    msg.className = 'onMsg bad';
    $('onCode').focus();
    return;
  }
  try {
    localStorage.setItem('parabola-brava-name', name);
  } catch (e) {}
  go.disabled = true;
  msg.className = 'onMsg';
  msg.innerHTML = `<span class="waitDots">${L('Buscando la partida', 'Looking for the game')}</span>`;
  if (ON.net) {
    try {
      ON.net.close();
    } catch (e) {}
    ON.net = null;
  }
  RH = null;
  Object.assign(ME, { name, st: 'wait', li: -1, k: 0, sc: 0, at: 0, lv: [], ix: [], ev: [], q: 0 });
  ON.role = 'player';
  ON.code = code;
  const net = await makeNet();
  if (ON.role !== 'player') {
    net.close();
    return;
  }
  net.onRemote = playerOnRemote;
  net.onTry = (i, n) => {
    if (n > 1 && $('onJoinMsg'))
      $('onJoinMsg').innerHTML =
        `<span class="waitDots">${L(`Buscando la partida (conexión ${i} de ${n})`, `Looking for the game (connection ${i} of ${n})`)}</span>`;
  };
  net.onDrop = () =>
    toast(L('Se perdió la conexión con el servicio en línea.', 'Lost the connection to the online service.'));
  ON.net = net;
  net.send(pState());
  const res = await net.start('player', code);
  if (ON.role !== 'player' || ON.net !== net) return;
  if (!res.ok) {
    net.close();
    ON.net = null;
    ON.role = null;
    go.disabled = false;
    msg.textContent = reasonText(res.reason);
    msg.className = 'onMsg bad';
    return;
  }
  playerSend(true);
  ON.joined = true;
  if (RH) handleHost(RH, true);
  else {
    ON.view = 'wait';
    renderOnline();
  }
}

// El jugador recibe el estado del host.
function playerOnRemote(id, s) {
  if (id !== 'host') return;
  if (s === null) {
    if (!ON.role || ON.view === 'kicked' || (RH && RH.st === 'end')) return;
    ON.view = 'gone';
    ON.err = L(
      'El host cerró la partida o perdió la conexión.',
      'The host closed the game or lost the connection.',
    );
    endPlayerGame();
    renderOnline();
    return;
  }
  if (s.code !== ON.code) return;
  RH = s;
  if (ON.joined) handleHost(s, false);
}

// Reacciona a lo que dice el host: expulsión, inicio (cuenta regresiva), fin de partida...
function handleHost(s, first) {
  if (s.md === 'duel') {
    duelGuestHost(s, first);
    return;
  }
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
  if (s.st === 'end') {
    if (ON.view !== 'end') {
      ON.view = 'end';
      endPlayerGame();
      SND.win();
    }
    renderOnline();
    return;
  }
  if (s.st === 'play' && ME.st === 'wait' && ON.ep !== s.ep) {
    if (first && !(s.cfg && s.cfg.lt)) {
      ON.view = 'late';
      renderOnline();
      if (ON.net) {
        ON.net.close();
        ON.net = null;
      }
      return;
    }
    ON.ep = s.ep;
    countdown(() => startPlayerGame(s.cfg));
    return;
  }
  if (ON.view === 'join') {
    ON.view = 'wait';
    renderOnline();
  } else if (ON.view === 'wait' || ON.view === 'done') scheduleRender();
  if (S.online) updateBoard();
}

// Cuenta regresiva 3-2-1-¡Ya! y luego ejecuta done().
function countdown(done) {
  const cd = $('countdown'),
    num = $('cdNum');
  if (VIEW !== 'game') showView('online');
  cd.hidden = false;
  const seq = ['3', '2', '1', L('¡Ya!', 'Go!')];
  let i = 0;
  const step = () => {
    if (i >= seq.length) {
      cd.hidden = true;
      done();
      return;
    }
    num.textContent = seq[i];
    num.style.animation = 'none';
    void num.offsetWidth;
    num.style.animation = '';
    i === seq.length - 1 ? SND.good() : SND.click();
    i++;
    setTimeout(step, 800);
  };
  step();
}

// Empieza la partida para este jugador (calcula sus niveles y carga el primero).
function startPlayerGame(cfg) {
  if (!cfg || ON.role !== 'player') return;
  const { ix, list } = playerLevels(cfg, ME.id);
  if (!list.length) {
    ON.view = 'gone';
    ON.err = L('No se pudieron cargar los niveles de la partida.', 'Couldn’t load the game’s levels.');
    renderOnline();
    return;
  }
  ON.savedScore = S.score;
  S.score = 0;
  Object.assign(ME, { st: 'play', k: list.length, ix, lv: [], ev: [], sc: 0, at: 0 });
  S.online = { i: 0, list, cfg, finished: false, deadline: 0, t0: 0, lastChip: '' };
  ON.view = 'game';
  loadOnlineLevel(0);
}

// Carga el nivel número i de la partida y arranca su cronómetro.
function loadOnlineLevel(i) {
  const o = S.online;
  o.i = i;
  o.t0 = performance.now();
  o.deadline = o.cfg.tm > 0 ? o.t0 + o.cfg.tm * 1000 : 0;
  S.levelStart = S.score;
  loadLevel(o.list[i], { online: true });
  const pr = $('practice');
  if (!o.cfg.pr) pr.checked = false;
  pr.closest('label').hidden = !o.cfg.pr;
  syncUI();
  Object.assign(ME, { li: i, at: 0, sc: S.score });
  ME.lv = ME.lv.filter((e) => e[0] !== i);
  ME.lv.push([i, 0, 0, 0, 0]);
  $('onChip').hidden = false;
  $('onBoardBtn').hidden = !o.cfg.bd;
  updateChip(true);
  updateBoard();
  pushState(true);
  updateRival();
}

// Registra un evento (respuesta, tiro o fin de nivel) para que el host lo vea.
function pEvent(kind, data) {
  if (!S.online) return;
  ME.q++;
  ME.ev.push([ME.q, S.online.i, kind, ...data]);
  if (ME.ev.length > 8) ME.ev.shift();
  ME.sc = S.score;
  pushState();
}
// Envía MI estado: como host (en un duelo el host también juega) o como jugador.
// Envía mi estado (como host o como jugador).
function pushState(now) {
  if (ON.role === 'host') hostSend(now);
  else playerSend(now);
}

// Registra una respuesta del jugador con lo que escribió y el valor correcto.
function onlineAnswer(vals) {
  const items = S.items.map((it, i) => [
    it.key,
    it.q === 'dir' ? vals[i] : r2(vals[i]),
    it.q === 'dir' ? it.truth : r2(it.truth),
    itemCorrect(it, vals[i]) ? 1 : 0,
  ]);
  ME.at = S.ans.used;
  pEvent('a', [items.every((x) => x[3]) ? 1 : 0, items]);
}

// Registra un tiro (v0, θ, h0, objetivos alcanzados, x de impacto).
function onlineShot(p, hits) {
  ME.at = S.def.shots - S.shotsLeft;
  pEvent('s', [r2(p.v0), p.ang, r2(p.h0), hits, r2(p.x)]);
}

// Termina un nivel online (ganado, fallado o tiempo agotado) y muestra la tarjeta.
function onlineLevelEnd(res, stars) {
  const o = S.online;
  if (!o) return;
  if (o.mode === 'race' || o.mode === 'hide') {
    duelLevelEnd(res);
    return;
  }
  if (o.ended === o.i) return;
  o.ended = o.i;
  S.mode = 'end';
  S.proj = null;
  S.endTimer = 0;
  const pts = S.score - S.levelStart,
    secs = Math.round((performance.now() - o.t0) / 1000);
  const att =
    S.def.type === 'despl'
      ? S.ans.used
      : S.def.type === 'mixto'
        ? S.ans.used + (S.def.shots - S.shotsLeft)
        : S.def.shots - S.shotsLeft;
  const code = { w: 1, f: 2, t: 3 }[res];
  ME.lv = ME.lv.filter((e) => e[0] !== o.i);
  ME.lv.push([o.i, code, pts, att, secs]);
  ME.sc = S.score;
  ME.at = att;
  pEvent('e', [res, pts, stars || 0]);
  const titles = {
    w: S.def.type === 'despl' ? L('¡Resuelto!', 'Solved!') : L('¡Nivel superado!', 'Level complete!'),
    f: S.def.type === 'despl' ? L('Sin intentos', 'Out of attempts') : L('Sin tiros', 'Out of shots'),
    t: L('Se acabó el tiempo', 'Time’s up'),
  };
  $('ovTitle').textContent = titles[res];
  $('ovStars').innerHTML = res === 'w' ? starsHTML(stars || 0) : '';
  $('ovText').textContent =
    (res === 'w'
      ? L(`+${pts} puntos en ${fmtTime(secs)}.`, `+${pts} points in ${fmtTime(secs)}.`)
      : L(`Este nivel suma ${pts} puntos.`, `This level adds ${pts} points.`)) +
    ' ' +
    L(`Total: ${S.score}.`, `Total: ${S.score}.`);
  $('ovRetry').hidden = true;
  const last = o.i >= o.list.length - 1;
  setNext(
    last
      ? L('Ver mis resultados', 'See my results')
      : L(`Siguiente nivel (${o.i + 2}/${o.list.length})`, `Next level (${o.i + 2}/${o.list.length})`),
    () => (last ? finishPlayer() : loadOnlineLevel(o.i + 1)),
  );
  res === 'w' ? SND.win() : SND.bad();
  $('overlay').hidden = false;
  hud();
  updateChip(true);
}

// El jugador terminó todos sus niveles.
function finishPlayer() {
  ME.st = 'done';
  ME.sc = S.score;
  pushState(true);
  if (S.online) S.online.finished = true;
  ON.view = 'done';
  showView('online');
  renderOnline();
}

// Sale del modo juego online (por fin de partida, expulsión o desconexión).
function endPlayerGame() {
  if (S.online) {
    ON.finalScore = S.score;
    S.online = null;
    S.score = ON.savedScore;
    $('onChip').hidden = true;
    $('onBoardBtn').hidden = true;
    $('onBoard').hidden = true;
    $('ovRetry').hidden = false;
    $('rivalBar').hidden = true;
    const pr = $('practice').closest('label');
    if (pr) pr.hidden = false;
  }
  $('countdown').hidden = true;
  if (VIEW === 'game') showView('online');
}

// Revisa el tiempo límite en cada cuadro.
function onlineTick() {
  const o = S.online;
  if (!o || o.finished) return;
  if (
    o.deadline &&
    S.mode !== 'end' &&
    !(S.def.type === 'despl' && S.solved) &&
    performance.now() > o.deadline
  ) {
    S.phase = 'done';
    onlineLevelEnd('t', 0);
    return;
  }
  updateChip(false);
}

// Texto de la etiqueta "Online · código · Nivel · tiempo".
function updateChip(force) {
  const o = S.online;
  if (!o) return;
  let t = `${L('Online', 'Online')} · ${ON.code} · ${L('Nivel', 'Level')} ${o.i + 1}/${o.list.length}`;
  let warn = false;
  if (o.mode) {
    const d = duelChip();
    t = d.t;
    warn = d.warn;
  }
  if (o.deadline && S.mode !== 'end') {
    const left = (o.deadline - performance.now()) / 1000;
    t += ` · ⏱ ${fmtTime(left)}`;
    warn = left < 15;
  }
  if (force || t !== o.lastChip) {
    o.lastChip = t;
    $('onChip').textContent = t;
    $('onChip').classList.toggle('warn', warn);
  }
}

// HTML de la tabla de posiciones.
function boardHTML(ro, meId) {
  const list = (ro || []).slice().sort((a, b) => b[2] - a[2]);
  if (!list.length) return `<p class="hint">${L('Aún no hay puntos.', 'No points yet.')}</p>`;
  return `<ol class="board">${list.map((r) => `<li class="${r[0] === meId ? 'me' : ''}"><span>${esc(r[1])}${r[0] === meId ? ' ' + L('(tú)', '(you)') : ''}</span><b>${r[2]}</b></li>`).join('')}</ol>`;
}

// Actualiza la tabla de posiciones del jugador.
function updateBoard() {
  if (!S.online || $('onBoard').hidden || !RH) return;
  $('onBoard').innerHTML =
    `<h3 style="margin:0 0 6px;font:400 20px var(--f-display)">${L('Tabla de posiciones', 'Leaderboard')}</h3>` +
    boardHTML(RH.ro, ME.id);
}
$('onBoardBtn').onclick = () => {
  const b = $('onBoard');
  b.hidden = !b.hidden;
  $('onBoardBtn').setAttribute('aria-expanded', String(!b.hidden));
  updateBoard();
};

// Botón "Salir de la partida" (pide confirmación).
function onlineMenuBtn() {
  const b = $('btnMenu');
  if (ON.confirm === 'leave') {
    ON.confirm = null;
    leaveOnline(true);
    return;
  }
  ON.confirm = 'leave';
  b.textContent = L('¿Seguro? Pulsa otra vez', 'Sure? Press again');
  setTimeout(() => {
    if (ON.confirm === 'leave') {
      ON.confirm = null;
      updateGameBar();
    }
  }, 3000);
}
