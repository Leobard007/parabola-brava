/* ======================================================================
   ARCHIVO: js/5-online/pantallas-online.js

   MODO ONLINE: PANTALLAS
   Todo lo que se ve en el modo online: unirse, sala de espera, panel del host,
   detalle de cada jugador, ventana "Seleccionar juego", podio y descarga de resultados (CSV).
   Las pantallas se construyen como texto HTML (con plantillas `...${valor}...`) y se
   insertan con innerHTML; después se conectan los botones con .onclick.
   ====================================================================== */

/* =========================================================
   PANTALLAS ONLINE
   ========================================================= */

// Pide redibujar la pantalla online como mucho 4 veces por segundo.
function scheduleRender() {
  if (ON.renderT) return;
  ON.renderT = setTimeout(() => {
    ON.renderT = null;
    if (VIEW === 'online') renderOnline();
    if (!$('onDetail').hidden) renderDetail();
  }, 250);
}

// Resumen de la configuración de la partida (niveles y reglas).
function cfgSummary(cfg) {
  if (!cfg)
    return `<p class="hint">${L('El host todavía no ha elegido el juego.', 'The host hasn’t picked the game yet.')}</p>`;
  const labs = cfg.lv.map(refLabel);
  const att =
    cfg.at === -1
      ? L('los de cada nivel', 'each level’s own')
      : cfg.at === 0
        ? L('ilimitados', 'unlimited')
        : cfg.at;
  return `<div class="lvChips">${labs.map((l) => `<span class="${l.cls}">${esc(l.tag)} · ${esc(l.name)}</span>`).join('')}</div>
  <ul class="sumList">
    <li>${L('Intentos por nivel', 'Attempts per level')}: <b>${att}</b></li>
    <li>${L('Tiempo por nivel', 'Time per level')}: <b>${cfg.tm ? fmtTime(cfg.tm) : L('sin límite', 'no limit')}</b></li>
    <li>${cfg.dl > 0 ? L(`Niveles distintos por jugador: <b>${cfg.dl}</b> al azar de ${cfg.lv.length}`, `Different levels per player: <b>${cfg.dl}</b> at random out of ${cfg.lv.length}`) : L('Todos juegan los mismos niveles', 'Everyone plays the same levels')}</li>
    <li>${cfg.vv ? L('Valores distintos para cada jugador', 'Different values for each player') : L('Mismos valores para todos', 'Same values for everyone')}</li>
    <li>${L('Modo práctica', 'Practice mode')}: <b>${cfg.pr ? L('permitido', 'allowed') : L('no permitido', 'not allowed')}</b></li>
    <li>${L('Tabla de posiciones para los jugadores', 'Leaderboard for players')}: <b>${cfg.bd ? L('sí', 'yes') : L('no', 'no')}</b></li>
    <li>${L('Entrar con la partida empezada', 'Join after the start')}: <b>${cfg.lt ? L('permitido', 'allowed') : L('no permitido', 'not allowed')}</b></li>
  </ul>`;
}

// HTML del podio con los 3 primeros.
function podiumHTML(rows) {
  const top = rows.slice(0, 3),
    order = [1, 0, 2];
  return `<div class="podium">${order.map((k) => (top[k] ? `<div class="p${k + 1}"><span class="nm">${esc(top[k][1])}</span><span class="sc">${top[k][2]} ${L('pts', 'pts')}</span><span class="blk">${k + 1}</span></div>` : '')).join('')}</div>`;
}

// Dibuja la pantalla online que toque (unirse, espera, terminado, error, final...).
function renderOnline() {
  const body = $('onBody'),
    v = ON.view;
  if (v === 'game') return;
  if (v === 'pick') {
    renderPick();
    return;
  }
  if (v === 'rules') {
    renderRules();
    return;
  }
  if (['dlobby', 'dwait', 'hide', 'dend', 'full'].includes(v)) {
    renderDuel();
    return;
  }
  const back = (id, label) => `<button class="mbtn inline" id="${id}" type="button">${label}</button>`;
  if (v === 'join') {
    let saved = '';
    try {
      saved = localStorage.getItem('parabola-brava-name') || '';
    } catch (e) {}
    body.innerHTML = `<div class="onHead">${back('onBack', L('← Inicio', '← Home'))}</div>
    <section class="onCard narrow">
      <h2>${L('Unirse a un juego', 'Join a game')}</h2>
      <label class="field"><span>${L('Tu nombre', 'Your name')}</span><input type="text" id="onName" maxlength="16" autocomplete="nickname" value="${esc(saved)}"></label>
      <label class="field"><span>${L('Código del juego', 'Game code')}</span><input type="text" id="onCode" class="codeInput" maxlength="5" autocomplete="off" spellcheck="false" autocapitalize="characters" placeholder="K7QX2"></label>
      <button class="btn go" id="onJoinGo" type="button">${L('Entrar', 'Join')}</button>
      <p class="onMsg" id="onJoinMsg" role="status"></p>
    </section>`;
    $('onBack').onclick = () => {
      leaveOnline(true);
    };
    $('onCode').addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });
    const go = () => joinGame($('onName').value, $('onCode').value);
    $('onJoinGo').onclick = go;
    [$('onName'), $('onCode')].forEach((el) =>
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') go();
      }),
    );
    setTimeout(() => (saved ? $('onCode') : $('onName')).focus(), 50);
    return;
  }
  if (v === 'connecting') {
    body.innerHTML = `<section class="onCard narrow"><h2>${L('Creando la partida', 'Creating the game')}</h2><p class="waitDots">${L('Preparando la sala', 'Setting up the room')}</p>
      <button class="btn ghost" id="onBack" type="button">${L('Cancelar', 'Cancel')}</button></section>`;
    $('onBack').onclick = () => leaveOnline(true);
    return;
  }
  if (v === 'error' || v === 'gone' || v === 'kicked' || v === 'late') {
    const title = {
      error: L('No se pudo conectar', 'Couldn’t connect'),
      gone: L('La partida terminó', 'The game ended'),
      kicked: L('Te sacaron de la partida', 'You were removed from the game'),
      late: L('La partida ya empezó', 'The game has already started'),
    }[v];
    const text = {
      error: ON.err,
      gone: ON.err,
      kicked: L('El host te expulsó de esta partida.', 'The host removed you from this game.'),
      late: L(
        'El host no permite entrar con la partida empezada. Pídele que abra una nueva o que permita entrar tarde.',
        'The host doesn’t allow joining after the start. Ask them to open a new game or allow late joining.',
      ),
    }[v];
    body.innerHTML = `<section class="onCard narrow"><h2>${title}</h2><p>${esc(text)}</p><button class="btn" id="onBack" type="button">${L('Volver al inicio', 'Back to home')}</button></section>`;
    $('onBack').onclick = () => leaveOnline(true);
    return;
  }
  if (v === 'wait' || v === 'done') {
    const h = RH || {},
      ro = h.ro || [];
    const names = ro
      .filter((r) => r[4] || h.st !== 'lobby')
      .map(
        (r) =>
          `<span class="${r[0] === ME.id ? 'me' : ''}">${esc(r[1])}${r[0] === ME.id ? ' ' + L('(tú)', '(you)') : ''}</span>`,
      )
      .join('');
    const doneTop =
      v === 'done'
        ? `<section class="onCard"><h2>${L('¡Terminaste!', 'You’re done!')}</h2>
      <p>${L(`Hiciste <b>${ME.sc}</b> puntos. Espera a que el host termine la partida para ver el podio.`, `You scored <b>${ME.sc}</b> points. Wait for the host to end the game to see the podium.`)}</p>
      ${myResultsHTML()}${h.cfg && h.cfg.bd ? `<h3>${L('Tabla de posiciones', 'Leaderboard')}</h3>${boardHTML(ro, ME.id)}` : ''}</section>`
        : '';
    body.innerHTML = `<div class="onHead">${back('onBack', L('← Salir', '← Leave'))}<div class="codeBox"><div><small>${L('Código', 'Code')}</small><b>${esc(ON.code)}</b></div></div></div>
    ${doneTop}
    ${
      v === 'wait'
        ? `<section class="onCard"><h2 class="waitDots">${L('Esperando a que el host inicie el juego', 'Waiting for the host to start the game')}</h2>
      <p class="hint">${L(`Entraste como <b>${esc(ME.name)}</b>.`, `You joined as <b>${esc(ME.name)}</b>.`)}</p>
      <h3>${L('Jugadores en la sala', 'Players in the room')} (${ro.filter((r) => r[4]).length})</h3><div class="nameChips">${names || `<span class="hint">${L('Solo tú por ahora', 'Just you for now')}</span>`}</div>
      <h3>${L('Juego seleccionado', 'Selected game')}</h3>${cfgSummary(h.cfg)}</section>`
        : ''
    }`;
    $('onBack').onclick = () => {
      if (ON.confirm === 'pl') {
        leaveOnline(true);
        return;
      }
      ON.confirm = 'pl';
      $('onBack').textContent = L('¿Seguro? Pulsa otra vez', 'Sure? Press again');
      setTimeout(() => {
        if (ON.confirm === 'pl') {
          ON.confirm = null;
          const b = $('onBack');
          if (b) b.textContent = L('← Salir', '← Leave');
        }
      }, 3000);
    };
    return;
  }
  if (v === 'end' && ON.role === 'player') {
    const ro = ((RH && RH.ro) || []).slice().sort((a, b) => b[2] - a[2]);
    const pos = ro.findIndex((r) => r[0] === ME.id);
    body.innerHTML = `<section class="onCard"><h2>${L('¡Partida terminada!', 'Game over!')}</h2>${podiumHTML(ro)}
      <p style="text-align:center">${pos >= 0 ? L(`Quedaste en el puesto <b>${pos + 1}</b> de ${ro.length} con <b>${ro[pos][2]}</b> puntos.`, `You finished <b>#${pos + 1}</b> of ${ro.length} with <b>${ro[pos][2]}</b> points.`) : ''}</p>
      ${myResultsHTML()}${boardHTML(ro, ME.id)}
      <button class="btn" id="onBack" type="button">${L('Volver al inicio', 'Back to home')}</button></section>`;
    $('onBack').onclick = () => leaveOnline(true);
    return;
  }
  if (ON.role === 'host') renderHost();
}

// Tabla con los resultados del jugador por nivel.
function myResultsHTML() {
  if (!ME.lv.length) return '';
  const pool = (RH && RH.cfg && RH.cfg.lv) || [];
  return `<div class="tableWrap"><table class="rTable"><thead><tr><th>${L('Nivel', 'Level')}</th><th>${L('Resultado', 'Result')}</th><th class="nr">${L('Intentos', 'Attempts')}</th><th class="nr">${L('Puntos', 'Points')}</th><th class="nr">${L('Tiempo', 'Time')}</th></tr></thead><tbody>
    ${ME.lv
      .slice()
      .sort((a, b) => a[0] - b[0])
      .map((e) => {
        const lab =
          pool[ME.ix[e[0]]] !== undefined ? refLabel(pool[ME.ix[e[0]]]) : { tag: e[0] + 1, name: '' };
        return `<tr><td>${e[0] + 1}. ${esc(lab.name)}</td><td>${resText(e[1])}</td><td class="nr">${e[3]}</td><td class="nr">${e[2]}</td><td class="nr">${fmtTime(e[4])}</td></tr>`;
      })
      .join('')}</tbody></table></div>`;
}

// Texto del resultado de un nivel (superado, fallado, tiempo).
const resText = (c) =>
  [
    L('jugando…', 'playing…'),
    `<span style="color:var(--target-dark)">✓ ${L('superado', 'passed')}</span>`,
    `<span style="color:var(--pencil-deep)">✗ ${L('fallado', 'failed')}</span>`,
    `<span style="color:#a87a10">⏱ ${L('tiempo', 'time')}</span>`,
  ][c] || '';

/* ---------- pantallas del host ---------- */
// Etiqueta de estado de un jugador (esperando, jugando, terminó, desconectado...).
function statusChip(p) {
  if (p.kicked) return `<span class="chipS gone">${L('expulsado', 'removed')}</span>`;
  if (!p.online) return `<span class="chipS gone">${L('desconectado', 'disconnected')}</span>`;
  return {
    wait: `<span class="chipS wait">${L('esperando', 'waiting')}</span>`,
    play: `<span class="chipS play">${L('jugando', 'playing')}</span>`,
    done: `<span class="chipS done">${L('terminó', 'finished')}</span>`,
  }[p.st];
}

// Barra de progreso con un segmento por nivel.
function segsHTML(p) {
  const n = p.k || (HS.cfg ? HS.cfg.dl || HS.cfg.lv.length : 0);
  const by = new Map(p.lv.map((e) => [e[0], e[1]]));
  return `<div class="segs">${Array.from({ length: n }, (_, i) => {
    const c = by.get(i);
    return `<i class="${c === 1 ? 'w' : c === 2 ? 'f' : c === 3 ? 't' : c === 0 ? 'p' : ''}"></i>`;
  }).join('')}</div>`;
}

// Jugadores ordenados (por llegada en la sala, por puntos durante la partida).
function sortedPlayers() {
  return [...HP.values()]
    .filter((p) => !p.kicked)
    .sort((a, b) => (HS.st === 'lobby' ? a.joined - b.joined : b.sc - a.sc));
}

// Dibuja la pantalla del host (sala de espera, partida en curso o resultados).
function renderHost() {
  const body = $('onBody');
  const players = sortedPlayers(),
    online = players.filter((p) => p.online);
  const head = `<div class="onHead"><button class="mbtn inline" id="onHostBack" type="button">${HS.st === 'play' ? L('← Salir (termina la partida)', '← Leave (ends the game)') : L('← Salir', '← Leave')}</button>
    <h2>${HS.st === 'lobby' ? L('Sala de espera', 'Lobby') : HS.st === 'play' ? L('Partida en curso', 'Game in progress') : L('Resultados', 'Results')}</h2>
    <div class="codeBox"><div><small>${L('Código de ingreso', 'Join code')}</small><b>${esc(ON.code)}</b></div><button class="btn small" id="onCopy" type="button">${L('Copiar', 'Copy')}</button></div></div>`;
  let main = '',
    side = '';
  if (HS.st === 'lobby') {
    main = `<section class="onCard"><h3>${L('Jugadores', 'Players')} (${online.length})</h3>
      ${
        online.length
          ? `<div class="nameChips">${online.map((p) => `<span>${esc(p.name)}<button type="button" data-kick="${esc(p.id)}" title="${L('Expulsar', 'Remove')}" aria-label="${L('Expulsar a', 'Remove')} ${esc(p.name)}">×</button></span>`).join('')}</div>`
          : `<div class="empty">${L('Comparte el código', 'Share the code')} <b style="font-family:var(--f-mono);letter-spacing:.1em">${esc(ON.code)}</b>. ${L('Los jugadores entran con “Online → Unirse a un juego” y aparecerán aquí.', 'Players join with “Online → Join a game” and will show up here.')}</div>`
      }
      <p class="hint">${ON.net && ON.net.kind === 'room' ? L('Los jugadores abren este mismo enlace con su cuenta (compártelo desde el menú Compartir).', 'Players open this same link with their account (share it from the Share menu).') : L('Los jugadores abren esta misma página en su dispositivo.', 'Players open this same page on their device.')}</p></section>`;
    const reason = !HS.cfg
      ? L('Primero selecciona el juego.', 'Pick the game first.')
      : !online.length
        ? L('Espera a que entre al menos un jugador.', 'Wait for at least one player to join.')
        : '';
    side = `<section class="onCard"><h3>${L('Juego', 'Game')}</h3>${cfgSummary(HS.cfg)}
      <button class="btn big" id="onPick" type="button">${L('Seleccionar juego', 'Select game')}</button>
      <button class="btn go" id="onStart" type="button" ${reason ? 'disabled' : ''}>${L('Iniciar juego', 'Start game')}</button>
      ${reason ? `<p class="hint">${reason}</p>` : ''}</section>`;
  } else {
    const rows = players
      .map(
        (p, i) => `<button class="pCard${p.online ? '' : ' off'}" type="button" data-p="${esc(p.id)}">
      <div class="pTop"><span class="pName"><span class="rank">${i + 1}</span>${esc(p.name)}</span><span class="pScore">${p.sc}</span></div>
      ${segsHTML(p)}
      <div class="pMeta">${statusChip(p)}${p.st === 'play' ? `<span>${L('Nivel', 'Level')} ${p.li + 1}/${p.k}</span><span>${L('intentos', 'attempts')}: ${p.at}</span>` : ''}${p.st === 'done' ? `<span>${p.lv.filter((e) => e[1] === 1).length}/${p.k} ${L('superados', 'passed')}</span>` : ''}</div>
    </button>`,
      )
      .join('');
    main = `<section class="onCard"><h3>${L('Jugadores', 'Players')} (${online.length}/${players.length})</h3>
      ${HS.st === 'end' ? podiumHTML(players.map((p) => [p.id, p.name, p.sc])) : ''}
      <p class="hint">${L('Haz clic en un nombre para ver sus respuestas, tiros y tiempos.', 'Click a name to see their answers, shots and times.')}</p>
      ${players.length ? `<div class="pList">${rows}</div>` : `<div class="empty">${L('No hay jugadores.', 'No players.')}</div>`}</section>`;
    const done = players.filter((p) => p.st === 'done').length;
    side = `<section class="onCard"><h3>${HS.st === 'end' ? L('Partida terminada', 'Game over') : L('En curso', 'In progress')}</h3>
      <p>${L(`${done} de ${players.length} jugadores terminaron.`, `${done} of ${players.length} players finished.`)}</p>
      ${HS.st === 'play' ? `<button class="btn danger big" id="onEnd" type="button">${L('Terminar partida', 'End game')}</button>` : ''}
      <button class="btn big" id="onCsv" type="button">${L('Descargar resultados (CSV)', 'Download results (CSV)')}</button>
      ${HS.st === 'end' ? `<button class="btn ghost" id="onHome" type="button">${L('Volver al inicio', 'Back to home')}</button>` : ''}
      <h3>${L('Juego', 'Game')}</h3>${cfgSummary(HS.cfg)}</section>`;
  }
  body.innerHTML = head + `<div class="onGrid">${main}${side}</div>`;
  $('onCopy').onclick = () => {
    const done = () => toast(L('Código copiado', 'Code copied'));
    try {
      navigator.clipboard.writeText(ON.code).then(done, () => toast(ON.code));
    } catch (e) {
      toast(ON.code);
    }
  };
  $('onHostBack').onclick = () => {
    const b = $('onHostBack');
    if (HS.st === 'end' || !online.length || ON.confirm === 'host') {
      if (HS.st === 'play') {
        HS.st = 'end';
        hostSend(true);
      }
      setTimeout(() => leaveOnline(true), 100);
      return;
    }
    ON.confirm = 'host';
    b.textContent = L('¿Seguro? Pulsa otra vez', 'Sure? Press again');
    setTimeout(() => {
      if (ON.confirm === 'host') {
        ON.confirm = null;
        renderOnline();
      }
    }, 3000);
  };
  body.querySelectorAll('[data-kick]').forEach((b) => (b.onclick = () => kickPlayer(b.dataset.kick)));
  body.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => openDetail(b.dataset.p)));
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.onclick = fn;
  };
  on('onPick', () => openPicker(false));
  on('onStart', startGame);
  on('onCsv', downloadCsv);
  on('onHome', () => leaveOnline(true));
  on('onEnd', () => {
    const b = $('onEnd');
    if (ON.confirm === 'end') {
      ON.confirm = null;
      endGame();
      return;
    }
    ON.confirm = 'end';
    b.textContent = L('¿Terminar para todos? Pulsa otra vez', 'End for everyone? Press again');
    setTimeout(() => {
      if (ON.confirm === 'end') {
        ON.confirm = null;
        renderOnline();
      }
    }, 3000);
  });
}

/* ---------- detalle de un jugador ---------- */
// Nombre del nivel i de un jugador.
function levelNameFor(p, li) {
  const cfg = HS.cfg;
  if (!cfg) return '';
  const pi = p.ix[li] !== undefined ? p.ix[li] : li;
  return cfg.lv[pi] !== undefined ? refLabel(cfg.lv[pi]).name : '';
}

// Texto de un valor de respuesta.
function valText(q, v) {
  return q === 'dir' ? esc(dirName(v) || v) : fmtQ(q, v);
}

// HTML de un evento en el detalle del jugador.
function evHTML(p, e) {
  const [seq, li, kind] = e,
    lvl = `<small>${L('Nivel', 'Level')} ${li + 1}</small>`;
  if (kind === 'a') {
    const [, , , ok, items] = e;
    return `<div class="ev ${ok ? 'ok' : 'bad'}">${lvl} · ${L('Respuesta', 'Answer')} — ${ok ? `<span class="ok">✓ ${L('correcta', 'correct')}</span>` : `<span class="bad">✗ ${L('incorrecta', 'wrong')}</span>`}<br>
      ${(items || [])
        .map(([k, g, t, okk]) => {
          const q = splitKey(k).q;
          return `${keyLabel(k)} = <b>${valText(q, g)}</b> ${okk ? '<span class="ok">✓</span>' : `<span class="bad">✗</span> <small>(${L('correcto', 'correct')}: ${valText(q, t)})</small>`}`;
        })
        .join(' · ')}</div>`;
  }
  if (kind === 's') {
    const [, , , v0, ang, h0, hits, x] = e;
    return `<div class="ev shot">${lvl} · ${L('Tiro', 'Shot')}: v₀ = ${v0} m/s, θ = ${ang}°, h₀ = ${h0} m → ${hits ? `<span class="ok">${L(`${hits} objetivo${hits > 1 ? 's' : ''}`, `${hits} target${hits > 1 ? 's' : ''}`)}</span>` : `<span class="bad">${L('sin objetivos', 'no targets')}</span>`} <small>(x = ${x} m)</small></div>`;
  }
  if (kind === 'e') {
    const [, , , res, pts] = e;
    return `<div class="ev ${res === 'w' ? 'ok' : 'bad'}">${lvl} · <b>${res === 'w' ? L('Nivel superado', 'Level passed') : res === 't' ? L('Se acabó el tiempo', 'Time ran out') : L('Nivel fallado', 'Level failed')}</b> · +${pts} ${L('pts', 'pts')}</div>`;
  }
  return '';
}

// Abre el detalle de un jugador.
function openDetail(id) {
  DETAIL = id;
  $('onDetail').hidden = false;
  renderDetail();
}

// Dibuja el detalle de un jugador: tabla por nivel y lista de respuestas y tiros.
function renderDetail() {
  const p = HP.get(DETAIL);
  if (!p) {
    $('onDetail').hidden = true;
    return;
  }
  const evs = [...p.ev.values()].sort((a, b) => b[0] - a[0]);
  const n = p.k || 0,
    by = new Map(p.lv.map((e) => [e[0], e]));
  $('odCard').innerHTML =
    `<div class="modalTop"><h2 id="odTitle">${esc(p.name)}</h2><button class="popclose" id="odClose" type="button" aria-label="${L('Cerrar', 'Close')}">×</button></div>
    <div class="pMeta" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${statusChip(p)}<b style="font-family:var(--f-mono);font-size:18px">${p.sc} ${L('pts', 'pts')}</b>${p.st === 'play' ? `<span class="hint">${L('Nivel', 'Level')} ${p.li + 1}/${p.k} · ${L('intentos en este nivel', 'attempts on this level')}: ${p.at}</span>` : ''}</div>
    ${
      n
        ? `<div class="tableWrap"><table class="rTable"><thead><tr><th>${L('Nivel', 'Level')}</th><th>${L('Resultado', 'Result')}</th><th class="nr">${L('Intentos', 'Attempts')}</th><th class="nr">${L('Puntos', 'Points')}</th><th class="nr">${L('Tiempo', 'Time')}</th></tr></thead><tbody>
      ${Array.from({ length: n }, (_, i) => {
        const e = by.get(i);
        return `<tr><td>${i + 1}. ${esc(levelNameFor(p, i))}</td><td>${e ? resText(e[1]) : `<span class="hint">${L('pendiente', 'pending')}</span>`}</td><td class="nr">${e ? e[3] : '–'}</td><td class="nr">${e ? e[2] : '–'}</td><td class="nr">${e && e[1] ? fmtTime(e[4]) : '–'}</td></tr>`;
      }).join('')}
    </tbody></table></div>`
        : `<p class="hint">${L('Todavía no empieza a jugar.', 'Hasn’t started playing yet.')}</p>`
    }
    <h3 style="margin:0;font:400 20px var(--f-display)">${L('Respuestas y tiros', 'Answers and shots')}</h3>
    ${evs.length ? `<div class="evLog">${evs.map((e) => evHTML(p, e)).join('')}</div>` : `<p class="hint">${L('Sin respuestas todavía.', 'No answers yet.')}</p>`}
    <div class="modalNav">${HS.st !== 'end' && !p.kicked ? `<button class="btn danger" id="odKick" type="button">${L('Expulsar', 'Remove')}</button>` : '<span></span>'}<button class="btn" id="odOk" type="button">${L('Cerrar', 'Close')}</button></div>`;
  const close = () => {
    DETAIL = null;
    $('onDetail').hidden = true;
  };
  $('odClose').onclick = close;
  $('odOk').onclick = close;
  const k = $('odKick');
  if (k)
    k.onclick = () => {
      if (ON.confirm === 'kick') {
        ON.confirm = null;
        kickPlayer(p.id);
        return;
      }
      ON.confirm = 'kick';
      k.textContent = L('¿Expulsar? Pulsa otra vez', 'Remove? Press again');
      setTimeout(() => {
        if (ON.confirm === 'kick') {
          ON.confirm = null;
          const b = $('odKick');
          if (b) b.textContent = L('Expulsar', 'Remove');
        }
      }, 3000);
    };
}
$('onDetail').addEventListener('click', (e) => {
  if (e.target === $('onDetail')) {
    DETAIL = null;
    $('onDetail').hidden = true;
  }
});

/* ---------- elegir niveles (pantalla completa) y reglas ---------- */
// Estado del selector: niveles marcados (en orden), reglas y a qué pantalla volver.
const OG = { sel: [], rules: { ...DEFAULT_RULES }, back: 'lobby', forDuel: false, msg: '' };

// Abre la pantalla "Elegir niveles" (para una partida de clase o para la Carrera de un duelo).
function openPicker(forDuel) {
  OG.forDuel = forDuel === true;
  OG.sel = HS.cfg && HS.cfg._keys ? HS.cfg._keys.slice() : [];
  OG.back = ON.view;
  OG.msg = '';
  ON.view = 'pick';
  renderOnline();
  window.scrollTo(0, 0);
}

// Nivel correspondiente a una clave marcada.
function selKeyDef(k) {
  return k.startsWith('u:') ? customs.find((c) => c.id === k.slice(2)) : CAMP_ALL().find((c) => c.id === k);
}

// Secciones del selector de niveles (una por campaña y Mis niveles).
function pickSections() {
  const secs = CAMPAIGNS.map((c) => ({
    key: c.key,
    cls: c.cls,
    title: MODE_INFO()[c.key].t,
    items: c.list.map((l, i) => ({
      key: l.id,
      tag: `${c.prefix || 'L'}${i + 1}`,
      name: lvName(l),
      stars: prog.stars[l.id] || 0,
    })),
  }));
  secs.push({
    key: 'u',
    cls: 'u',
    title: MODE_INFO().u.t,
    items: customs.map((l) => ({
      key: 'u:' + l.id,
      tag: { clasico: 'L', despl: 'D', mixto: 'M' }[l.type],
      name: l.name,
      stars: 0,
      cls: { clasico: 'c', despl: 'd', mixto: 'm' }[l.type],
    })),
  });
  return secs;
}

// Pantalla "Elegir niveles": todas las campañas ordenadas; tocar un nivel lo marca con su número de orden.
function renderPick() {
  const body = $('onBody'),
    secs = pickSections(),
    n = OG.sel.length;
  body.innerHTML = `<div class="onHead"><button class="mbtn inline" id="pkBack" type="button">${L('← Volver', '← Back')}</button>
      <h2>${L('Elegir niveles', 'Pick levels')}</h2></div>
    <section class="onCard">
      <p>${
        OG.forDuel
          ? L(
              'Toca los niveles de la carrera. Cada ronda usa el siguiente nivel de la lista (si hay menos niveles que rondas, se repiten).',
              'Tap the race levels. Each round uses the next level in the list (if there are fewer levels than rounds, they repeat).',
            )
          : L(
              'Toca los niveles en el orden en que quieres que se jueguen. El número de cada tarjeta es su orden.',
              'Tap the levels in the order you want them played. The number on each card is its order.',
            )
      }</p>
      ${secs
        .map(
          (sec) => `<div class="pkSec">
        <div class="pkHead"><h3 class="${sec.cls}">${sec.title}</h3>${sec.items.length ? `<button class="btn ghost small" type="button" data-all="${sec.key}">${L('Marcar todos', 'Tick all')}</button>` : ''}</div>
        ${
          sec.items.length
            ? `<div class="pkGrid">${sec.items
                .map((it) => {
                  const pos = OG.sel.indexOf(it.key);
                  return `<button class="pkCard ${it.cls || sec.cls}" type="button" data-k="${esc(it.key)}" aria-pressed="${pos >= 0}">
            <span class="pkNum">${pos >= 0 ? pos + 1 : ''}</span><b>${esc(it.tag)}</b><span class="pkName">${esc(it.name)}</span>
            ${it.stars ? `<small>${'★'.repeat(it.stars)}</small>` : ''}</button>`;
                })
                .join('')}</div>`
            : `<p class="hint">${L('Aún no tienes niveles propios. Créalos en el editor.', 'You don’t have your own levels yet. Make them in the editor.')}</p>`
        }
      </div>`,
        )
        .join('')}
    </section>
    <div class="pkBar">
      <span>${n ? L(`<b>${n}</b> ${n === 1 ? 'nivel seleccionado' : 'niveles seleccionados'}`, `<b>${n}</b> ${n === 1 ? 'level selected' : 'levels selected'}`) : L('Ningún nivel seleccionado', 'No level selected')}</span>
      <span class="pkBtns">${n ? `<button class="btn ghost small" id="pkClear" type="button">${L('Limpiar', 'Clear')}</button>` : ''}
      <button class="btn go" id="pkGo" type="button" ${n ? '' : 'disabled'}>${L('Continuar →', 'Continue →')}</button></span>
    </div>`;
  body.querySelectorAll('[data-k]').forEach(
    (b) =>
      (b.onclick = () => {
        const k = b.dataset.k;
        const i = OG.sel.indexOf(k);
        if (i >= 0) OG.sel.splice(i, 1);
        else OG.sel.push(k);
        SND.click();
        renderPick();
      }),
  );
  body.querySelectorAll('[data-all]').forEach(
    (b) =>
      (b.onclick = () => {
        secs
          .find((s) => s.key === b.dataset.all)
          .items.forEach((it) => {
            if (!OG.sel.includes(it.key)) OG.sel.push(it.key);
          });
        renderPick();
      }),
  );
  const clr = $('pkClear');
  if (clr)
    clr.onclick = () => {
      OG.sel = [];
      renderPick();
    };
  $('pkBack').onclick = () => {
    ON.view = OG.back;
    renderOnline();
  };
  $('pkGo').onclick = () => {
    const keys = OG.sel.filter((k) => selKeyDef(k));
    if (!keys.length) return;
    if (OG.forDuel) {
      HS.cfg = {
        ...HS.cfg,
        lv: keys.map((k) => (k.startsWith('u:') ? compactDef(selKeyDef(k)) : k)),
        _keys: keys,
      };
      ON.view = 'dlobby';
      hostSend(true);
      renderOnline();
      toast(L('Niveles guardados', 'Levels saved'));
    } else {
      ON.view = 'rules';
      renderOnline();
      window.scrollTo(0, 0);
    }
  };
}

// Pantalla "Reglas de la partida" (paso siguiente al elegir niveles en una partida de clase).
function renderRules() {
  const R = OG.rules,
    pool = OG.sel.length,
    body = $('onBody');
  body.innerHTML = `<div class="onHead"><button class="mbtn inline" id="ruBack" type="button">${L('← Niveles', '← Levels')}</button>
      <h2>${L('Reglas de la partida', 'Game rules')}</h2></div>
    <section class="onCard">
      <h3>${L('Niveles elegidos', 'Chosen levels')} (${pool})</h3>
      <div class="lvChips">${OG.sel
        .map((k, i) => {
          const d = selKeyDef(k);
          return d ? `<span>${i + 1}. ${esc(k.startsWith('u:') ? d.name : lvName(d))}</span>` : '';
        })
        .join('')}</div>
      <div class="rules">
        <div class="rule"><b>${L('Intentos por nivel', 'Attempts per level')}</b>
          <label><input type="radio" name="ogAt" value="-1" ${R.at === -1 ? 'checked' : ''}> ${L('Los de cada nivel', 'Each level’s own')}</label>
          <label><input type="radio" name="ogAt" value="0" ${R.at === 0 ? 'checked' : ''}> ${L('Ilimitados', 'Unlimited')}</label>
          <label><input type="radio" name="ogAt" value="n" ${R.at > 0 ? 'checked' : ''}> ${L('Máximo', 'At most')} <input type="number" id="ogAtN" min="1" max="20" value="${R.atN}"></label>
          <small class="hint">${L('En lanzamiento son tiros; en vectores, intentos de respuesta.', 'In launch levels they are shots; in vector levels, answer attempts.')}</small></div>
        <div class="rule"><b>${L('Tiempo por nivel', 'Time per level')}</b>
          <label><select id="ogTm">${[0, 60, 120, 180, 300, 600].map((s) => `<option value="${s}" ${R.tm === s ? 'selected' : ''}>${s ? fmtTime(s) + ' min' : L('Sin límite', 'No limit')}</option>`).join('')}</select></label></div>
        <div class="rule"><b>${L('Niveles', 'Levels')}</b>
          <label><input type="radio" name="ogDl" value="0" ${!R.dl ? 'checked' : ''}> ${L('Todos juegan los mismos', 'Everyone plays the same ones')}</label>
          <label><input type="radio" name="ogDl" value="n" ${R.dl ? 'checked' : ''}> ${L('Distintos por jugador:', 'Different per player:')} <input type="number" id="ogDlN" min="1" max="${Math.max(1, pool)}" value="${Math.min(R.dlN, Math.max(1, pool))}"></label>
          <small class="hint">${L('Cada jugador recibe esa cantidad, al azar, de los niveles elegidos.', 'Each player gets that many, at random, from the chosen levels.')}</small></div>
        <div class="rule"><b>${L('Valores', 'Values')}</b>
          <label><input type="radio" name="ogVv" value="0" ${!R.vv ? 'checked' : ''}> ${L('Iguales para todos', 'Same for everyone')}</label>
          <label><input type="radio" name="ogVv" value="1" ${R.vv ? 'checked' : ''}> ${L('Distintos por jugador', 'Different per player')}</label>
          <small class="hint">${L('Cambia magnitudes y ángulos de los vectores (siempre con solución) y mueve un poco las estructuras de los niveles de lanzamiento.', 'Changes vector lengths and angles (always solvable) and shifts the structures of launch levels a little.')}</small></div>
        <div class="rule"><b>${L('Opciones', 'Options')}</b>
          <label><input type="checkbox" id="ogPr" ${R.pr ? 'checked' : ''}> ${L('Permitir modo práctica', 'Allow practice mode')}</label>
          <label><input type="checkbox" id="ogBd" ${R.bd ? 'checked' : ''}> ${L('Mostrar tabla de posiciones a los jugadores', 'Show the leaderboard to players')}</label>
          <label><input type="checkbox" id="ogLt" ${R.lt ? 'checked' : ''}> ${L('Permitir entrar con la partida empezada', 'Allow joining after the start')}</label></div>
      </div>
      <p class="onMsg bad" id="ogMsg" role="status">${esc(OG.msg)}</p>
      <div class="modalNav"><button class="btn ghost" id="ruBack2" type="button">${L('← Cambiar niveles', '← Change levels')}</button><button class="btn go" id="ogSave" type="button">${L('Guardar juego', 'Save game')}</button></div>
    </section>`;
  const readRules = () => {
    const atV = (body.querySelector('[name=ogAt]:checked') || {}).value;
    R.atN = Math.round(clamp(num($('ogAtN').value, 3), 1, 20));
    R.at = atV === 'n' ? R.atN : +atV;
    R.tm = +$('ogTm').value;
    R.dlN = Math.round(clamp(num($('ogDlN').value, 2), 1, 60));
    R.dl = (body.querySelector('[name=ogDl]:checked') || {}).value === 'n' ? R.dlN : 0;
    R.vv = (body.querySelector('[name=ogVv]:checked') || {}).value === '1';
    R.pr = $('ogPr').checked;
    R.bd = $('ogBd').checked;
    R.lt = $('ogLt').checked;
  };
  body
    .querySelectorAll('.rules input, .rules select')
    .forEach((el) => el.addEventListener('change', readRules));
  const back = () => {
    readRules();
    ON.view = 'pick';
    renderOnline();
  };
  $('ruBack').onclick = back;
  $('ruBack2').onclick = back;
  $('ogSave').onclick = () => {
    readRules();
    const keys = OG.sel.filter((k) => selKeyDef(k));
    if (!keys.length) {
      back();
      return;
    }
    const lv = keys.map((k) => (k.startsWith('u:') ? compactDef(selKeyDef(k)) : k));
    const cfg = {
      lv,
      at: R.at,
      tm: R.tm,
      dl: R.dl ? Math.min(R.dl, lv.length) : 0,
      vv: R.vv,
      pr: R.pr,
      bd: R.bd,
      lt: R.lt,
      sd: rid(),
      _keys: keys,
    };
    const test = { r: 'h', code: ON.code, st: 'lobby', ep: 0, cfg, ro: [], kick: [] };
    if (ON.net && ON.net.limit !== Infinity && JSON.stringify(test).length > MAX_STATE - 600) {
      OG.msg = L(
        'Los niveles propios seleccionados son demasiado grandes para enviarlos en una partida en línea. Quita alguno o usa niveles de las campañas.',
        'The selected custom levels are too large to send in an online game. Remove one or use campaign levels.',
      );
      $('ogMsg').textContent = OG.msg;
      return;
    }
    HS.cfg = cfg;
    ON.view = 'lobby';
    hostSend(true);
    renderOnline();
    toast(L('Juego guardado', 'Game saved'));
  };
}

/* ---------- resultados en CSV ---------- */
// Genera y descarga los resultados en CSV (se abre con Excel o Google Sheets).
async function downloadCsv() {
  const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const rows = [
    [
      L('jugador', 'player'),
      L('nivel', 'level'),
      L('nombre_nivel', 'level_name'),
      L('tipo', 'type'),
      L('resultado', 'result'),
      L('intentos', 'attempts'),
      L('puntos', 'points'),
      L('tiempo_s', 'time_s'),
      L('detalle', 'detail'),
    ],
  ];
  const resWord = (c) =>
    [
      L('jugando', 'playing'),
      L('superado', 'passed'),
      L('fallado', 'failed'),
      L('tiempo agotado', 'time out'),
    ][c] || '';
  sortedPlayers().forEach((p) => {
    rows.push([
      p.name,
      '',
      '',
      L('total', 'total'),
      p.kicked
        ? L('expulsado', 'removed')
        : !p.online
          ? L('desconectado', 'disconnected')
          : {
              wait: L('esperando', 'waiting'),
              play: L('jugando', 'playing'),
              done: L('terminó', 'finished'),
            }[p.st],
      '',
      p.sc,
      '',
      '',
    ]);
    p.lv
      .slice()
      .sort((a, b) => a[0] - b[0])
      .forEach((e) =>
        rows.push([
          p.name,
          e[0] + 1,
          levelNameFor(p, e[0]),
          L('nivel', 'level'),
          resWord(e[1]),
          e[3],
          e[2],
          e[4],
          '',
        ]),
      );
    [...p.ev.values()]
      .sort((a, b) => a[0] - b[0])
      .forEach((e) => {
        if (e[2] === 'a')
          rows.push([
            p.name,
            e[1] + 1,
            levelNameFor(p, e[1]),
            L('respuesta', 'answer'),
            e[3] ? L('correcta', 'correct') : L('incorrecta', 'wrong'),
            '',
            '',
            '',
            (e[4] || [])
              .map(
                ([k, g, t, ok]) => `${keyLabel(k)}=${g} (${L('correcto', 'correct')} ${t}) ${ok ? '✓' : '✗'}`,
              )
              .join('; '),
          ]);
        if (e[2] === 's')
          rows.push([
            p.name,
            e[1] + 1,
            levelNameFor(p, e[1]),
            L('tiro', 'shot'),
            e[6] ? L('acierto', 'hit') : L('fallo', 'miss'),
            '',
            '',
            '',
            `v0=${e[3]} θ=${e[4]} h0=${e[5]} x=${e[7]}`,
          ]);
      });
  });
  const csv = '﻿' + rows.map((r) => r.map(q).join(',')).join('\r\n');
  const filename = `parabola-brava-${ON.code}.csv`;
  try {
    const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
    if (dl) {
      await dl.save({ filename, data: new Blob([csv], { type: 'text/csv' }) });
      return;
    }
  } catch (e) {
    if (e && e.code && e.code !== 'unavailable') return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

/* ---------- menú Online del inicio ---------- */
$('btnOnline').onclick = (e) => {
  e.stopPropagation();
  SND.click();
  const m = $('onlineMenu'),
    open = m.hidden;
  m.hidden = !open;
  $('btnOnline').setAttribute('aria-expanded', String(open));
  if (open) {
    $('setMenu').hidden = true;
    $('btnSettings').setAttribute('aria-expanded', 'false');
  }
};
document.addEventListener('click', (e) => {
  const m = $('onlineMenu');
  if (!m.hidden && !m.contains(e.target) && !$('btnOnline').contains(e.target)) {
    m.hidden = true;
    $('btnOnline').setAttribute('aria-expanded', 'false');
  }
});
$('btnOnJoin').onclick = () => {
  SND.click();
  $('onlineMenu').hidden = true;
  resetOnline();
  ON.view = 'join';
  showView('online');
  renderOnline();
};
$('btnOnCreate').onclick = () => {
  SND.click();
  $('onlineMenu').hidden = true;
  createGame();
};
$('btnOnDuel').onclick = () => {
  SND.click();
  $('onlineMenu').hidden = true;
  createGame('duel');
};
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('onDetail').hidden) {
    DETAIL = null;
    $('onDetail').hidden = true;
  } else if (!$('onlineMenu').hidden) {
    $('onlineMenu').hidden = true;
    $('btnOnline').setAttribute('aria-expanded', 'false');
  }
});
window.__pbOnline = {
  ON,
  HS,
  HP,
  ME,
  get S() {
    return S;
  },
  get RH() {
    return RH;
  },
  varyLevel,
  playerLevels,
};
