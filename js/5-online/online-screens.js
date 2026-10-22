/* ======================================================================
   FILE: js/5-online/online-screens.js

   THE ONLINE SCREENS
   Everything inside <div id="onlineScreenContent"> is created here, depending
   on online.screen:
     'join'        type the name and the code
     'connecting'  creating the game
     'error', 'gone', 'kicked', 'late'   messages
     'waiting', 'done', 'end'            player screens
     'lobby', 'dashboard', 'end'         host screens (renderHostScreen)
     'picker', 'rules'                   choosing the levels and rules
     'duelLobby', 'duelWaiting', 'hide', 'duelEnd', 'full'   duel screens (duel.js)
     'game'        the game screen is shown instead
   Also here: the player details window, the CSV download and the Online menu
   of the home screen.
   ====================================================================== */

// scheduleOnlineRender(): redraws the online screen (and the details window) in 250 ms.
// Many messages can arrive together; this way the screen is redrawn only once.
function scheduleOnlineRender() {
  if (online.renderTimer) {
    return;
  }
  online.renderTimer = setTimeout(function () {
    online.renderTimer = null;
    if (currentView === 'online') {
      renderOnlineScreen();
    }
    if (!getElement('playerDetailWindow').hidden) {
      renderPlayerDetail();
    }
  }, 250);
}

// buildRulesSummary(rules): the chosen levels and a list with the rules of a class game.
function buildRulesSummary(rules) {
  if (!rules) {
    return `<p class="hint">${translate('El host todavía no ha elegido el juego.', 'The host hasn’t picked the game yet.')}</p>`;
  }
  let chips = '';
  for (const reference of rules.levels) {
    const label = getLevelReferenceLabel(reference);
    chips += `<span class="${getChipClass(label)}">${escapeHtml(label.tag)} · ${escapeHtml(label.name)}</span>`;
  }
  let attemptsText = rules.attempts;
  if (rules.attempts === -1) {
    attemptsText = translate('los de cada nivel', 'each level’s own');
  } else if (rules.attempts === 0) {
    attemptsText = translate('ilimitados', 'unlimited');
  }
  let timeText = translate('sin límite', 'no limit');
  if (rules.timeLimit) {
    timeText = formatTime(rules.timeLimit);
  }
  let levelsText = translate('Todos juegan los mismos niveles', 'Everyone plays the same levels');
  if (rules.differentLevels > 0) {
    levelsText = translate(
      `Niveles distintos por jugador: <b>${rules.differentLevels}</b> al azar de ${rules.levels.length}`,
      `Different levels per player: <b>${rules.differentLevels}</b> at random out of ${rules.levels.length}`,
    );
  }
  let valuesText = translate('Mismos valores para todos', 'Same values for everyone');
  if (rules.differentValues) {
    valuesText = translate('Valores distintos para cada jugador', 'Different values for each player');
  }
  const allowed = translate('permitido', 'allowed');
  const notAllowed = translate('no permitido', 'not allowed');
  let practiceText = notAllowed;
  if (rules.practiceAllowed) {
    practiceText = allowed;
  }
  let leaderboardText = translate('no', 'no');
  if (rules.showLeaderboard) {
    leaderboardText = translate('sí', 'yes');
  }
  let lateText = notAllowed;
  if (rules.lateJoinAllowed) {
    lateText = allowed;
  }
  return `<div class="level-chips">${chips}</div>
  <ul class="summary-list">
    <li>${translate('Intentos por nivel', 'Attempts per level')}: <b>${attemptsText}</b></li>
    <li>${translate('Tiempo por nivel', 'Time per level')}: <b>${timeText}</b></li>
    <li>${levelsText}</li>
    <li>${valuesText}</li>
    <li>${translate('Modo práctica', 'Practice mode')}: <b>${practiceText}</b></li>
    <li>${translate('Tabla de posiciones para los jugadores', 'Leaderboard for players')}: <b>${leaderboardText}</b></li>
    <li>${translate('Entrar con la partida empezada', 'Join after the start')}: <b>${lateText}</b></li>
  </ul>`;
}

// buildPodiumHtml(entries): the podium of the 3 best players (2nd, 1st, 3rd from left to right).
//   entries: list sorted from the best score down, each one { id, name, score }
function buildPodiumHtml(entries) {
  const podiumPlaces = [
    { index: 1, className: 'podium-second' },
    { index: 0, className: 'podium-first' },
    { index: 2, className: 'podium-third' },
  ];
  let html = '<div class="podium">';
  for (const place of podiumPlaces) {
    const entry = entries[place.index];
    if (!entry) {
      continue;
    }
    html += `<div class="${place.className}"><span class="podium-name">${escapeHtml(entry.name)}</span><span class="podium-score">${entry.score} ${translate('pts', 'pts')}</span><span class="podium-block">${place.index + 1}</span></div>`;
  }
  html += '</div>';
  return html;
}

// sortRosterByScore(roster): a copy of the roster from the best score down.
function sortRosterByScore(roster) {
  const sorted = (roster || []).slice();
  sorted.sort(function (first, second) {
    return second.score - first.score;
  });
  return sorted;
}

// renderOnlineScreen(): draws the online screen that corresponds to online.screen.
function renderOnlineScreen() {
  const content = getElement('onlineScreenContent');
  const screen = online.screen;
  if (screen === 'game') {
    return;
  }
  if (screen === 'picker') {
    renderLevelPicker();
    return;
  }
  if (screen === 'rules') {
    renderRulesScreen();
    return;
  }
  const duelScreens = ['duelLobby', 'duelWaiting', 'hide', 'duelEnd', 'full'];
  if (duelScreens.indexOf(screen) !== -1) {
    renderDuelScreen();
    return;
  }

  if (screen === 'join') {
    let savedName = '';
    try {
      savedName = localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || '';
    } catch (error) {
      // nothing to do
    }
    content.innerHTML = `<div class="online-header"><button class="menu-button menu-button-inline" id="onlineBackButton" type="button">${translate('← Inicio', '← Home')}</button></div>
    <section class="online-card online-card-narrow">
      <h2>${translate('Unirse a un juego', 'Join a game')}</h2>
      <label class="form-field"><span>${translate('Tu nombre', 'Your name')}</span><input type="text" id="joinNameInput" maxlength="16" autocomplete="nickname" value="${escapeHtml(savedName)}"></label>
      <label class="form-field"><span>${translate('Código del juego', 'Game code')}</span><input type="text" id="joinCodeInput" class="code-input" maxlength="5" autocomplete="off" spellcheck="false" autocapitalize="characters" placeholder="K7QX2"></label>
      <button class="button button-go" id="joinButton" type="button">${translate('Entrar', 'Join')}</button>
      <p class="online-message" id="joinMessage" role="status"></p>
    </section>`;
    getElement('onlineBackButton').addEventListener('click', function () {
      leaveOnline(true);
    });
    // the code: only capital letters and numbers
    getElement('joinCodeInput').addEventListener('input', function (event) {
      event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });
    function tryToJoin() {
      joinGame(getElement('joinNameInput').value, getElement('joinCodeInput').value);
    }
    getElement('joinButton').addEventListener('click', tryToJoin);
    const fields = [getElement('joinNameInput'), getElement('joinCodeInput')];
    for (const field of fields) {
      field.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          tryToJoin();
        }
      });
    }
    // put the cursor in the code box if the name is already known
    setTimeout(function () {
      if (savedName) {
        getElement('joinCodeInput').focus();
      } else {
        getElement('joinNameInput').focus();
      }
    }, 50);
    return;
  }

  if (screen === 'connecting') {
    content.innerHTML = `<section class="online-card online-card-narrow"><h2>${translate('Creando la partida', 'Creating the game')}</h2><p class="waiting-dots">${translate('Preparando la sala', 'Setting up the room')}</p>
      <button class="button button-outline" id="onlineBackButton" type="button">${translate('Cancelar', 'Cancel')}</button></section>`;
    getElement('onlineBackButton').addEventListener('click', function () {
      leaveOnline(true);
    });
    return;
  }

  if (screen === 'error' || screen === 'gone' || screen === 'kicked' || screen === 'late') {
    let title;
    let text;
    if (screen === 'error') {
      title = translate('No se pudo conectar', 'Couldn’t connect');
      text = online.errorText;
    } else if (screen === 'gone') {
      title = translate('La partida terminó', 'The game ended');
      text = online.errorText;
    } else if (screen === 'kicked') {
      title = translate('Te sacaron de la partida', 'You were removed from the game');
      text = translate('El host te expulsó de esta partida.', 'The host removed you from this game.');
    } else {
      title = translate('La partida ya empezó', 'The game has already started');
      text = translate(
        'El host no permite entrar con la partida empezada. Pídele que abra una nueva o que permita entrar tarde.',
        'The host doesn’t allow joining after the start. Ask them to open a new game or allow late joining.',
      );
    }
    content.innerHTML = `<section class="online-card online-card-narrow"><h2>${title}</h2><p>${escapeHtml(text)}</p><button class="button" id="onlineBackButton" type="button">${translate('Volver al inicio', 'Back to home')}</button></section>`;
    getElement('onlineBackButton').addEventListener('click', function () {
      leaveOnline(true);
    });
    return;
  }

  if (screen === 'waiting' || screen === 'done') {
    const hostMessage = lastHostState || {};
    const roster = hostMessage.roster || [];
    let names = '';
    let connectedCount = 0;
    for (const entry of roster) {
      if (entry.online) {
        connectedCount++;
      }
      if (entry.online || hostMessage.status !== 'lobby') {
        const isMe = entry.id === myPlayer.id;
        let chipClass = '';
        let youText = '';
        if (isMe) {
          chipClass = 'name-chip-me';
          youText = ' ' + translate('(tú)', '(you)');
        }
        names += `<span class="${chipClass}">${escapeHtml(entry.name)}${youText}</span>`;
      }
    }
    let doneSection = '';
    if (screen === 'done') {
      let leaderboard = '';
      if (hostMessage.rules && hostMessage.rules.showLeaderboard) {
        leaderboard = `<h3>${translate('Tabla de posiciones', 'Leaderboard')}</h3>${buildLeaderboardHtml(roster, myPlayer.id)}`;
      }
      doneSection = `<section class="online-card"><h2>${translate('¡Terminaste!', 'You’re done!')}</h2>
      <p>${translate(
        `Hiciste <b>${myPlayer.score}</b> puntos. Espera a que el host termine la partida para ver el podio.`,
        `You scored <b>${myPlayer.score}</b> points. Wait for the host to end the game to see the podium.`,
      )}</p>
      ${buildMyResultsHtml()}${leaderboard}</section>`;
    }
    let waitingSection = '';
    if (screen === 'waiting') {
      if (!names) {
        names = `<span class="hint">${translate('Solo tú por ahora', 'Just you for now')}</span>`;
      }
      waitingSection = `<section class="online-card"><h2 class="waiting-dots">${translate('Esperando a que el host inicie el juego', 'Waiting for the host to start the game')}</h2>
      <p class="hint">${translate(`Entraste como <b>${escapeHtml(myPlayer.name)}</b>.`, `You joined as <b>${escapeHtml(myPlayer.name)}</b>.`)}</p>
      <h3>${translate('Jugadores en la sala', 'Players in the room')} (${connectedCount})</h3><div class="name-chips">${names}</div>
      <h3>${translate('Juego seleccionado', 'Selected game')}</h3>${buildRulesSummary(hostMessage.rules)}</section>`;
    }
    content.innerHTML = `<div class="online-header"><button class="menu-button menu-button-inline" id="onlineBackButton" type="button">${translate('← Salir', '← Leave')}</button><div class="code-box"><div><small>${translate('Código', 'Code')}</small><b>${escapeHtml(online.code)}</b></div></div></div>
    ${doneSection}
    ${waitingSection}`;
    getElement('onlineBackButton').addEventListener('click', function () {
      if (online.buttonWaitingConfirmation === 'playerLeave') {
        leaveOnline(true);
        return;
      }
      online.buttonWaitingConfirmation = 'playerLeave';
      getElement('onlineBackButton').textContent = translate('¿Seguro? Pulsa otra vez', 'Sure? Press again');
      setTimeout(function () {
        if (online.buttonWaitingConfirmation === 'playerLeave') {
          online.buttonWaitingConfirmation = null;
          const button = getElement('onlineBackButton');
          if (button) {
            button.textContent = translate('← Salir', '← Leave');
          }
        }
      }, 3000);
    });
    return;
  }

  if (screen === 'end' && online.role === 'player') {
    let roster = [];
    if (lastHostState && lastHostState.roster) {
      roster = lastHostState.roster;
    }
    const sorted = sortRosterByScore(roster);
    let myPosition = -1;
    for (let index = 0; index < sorted.length; index++) {
      if (sorted[index].id === myPlayer.id) {
        myPosition = index;
      }
    }
    let positionText = '';
    if (myPosition >= 0) {
      positionText = translate(
        `Quedaste en el puesto <b>${myPosition + 1}</b> de ${sorted.length} con <b>${sorted[myPosition].score}</b> puntos.`,
        `You finished <b>#${myPosition + 1}</b> of ${sorted.length} with <b>${sorted[myPosition].score}</b> points.`,
      );
    }
    content.innerHTML = `<section class="online-card"><h2>${translate('¡Partida terminada!', 'Game over!')}</h2>${buildPodiumHtml(sorted)}
      <p style="text-align:center">${positionText}</p>
      ${buildMyResultsHtml()}${buildLeaderboardHtml(sorted, myPlayer.id)}
      <button class="button" id="onlineBackButton" type="button">${translate('Volver al inicio', 'Back to home')}</button></section>`;
    getElement('onlineBackButton').addEventListener('click', function () {
      leaveOnline(true);
    });
    return;
  }

  if (online.role === 'host') {
    renderHostScreen();
  }
}

// RESULTS_TABLE_HEADER: the header of the tables of results by level.
function buildResultsTableHeader() {
  return `<thead><tr><th>${translate('Nivel', 'Level')}</th><th>${translate('Resultado', 'Result')}</th><th class="number-cell">${translate('Intentos', 'Attempts')}</th><th class="number-cell">${translate('Puntos', 'Points')}</th><th class="number-cell">${translate('Tiempo', 'Time')}</th></tr></thead>`;
}

// sortResultsByLevel(results): a copy of the level results, ordered by level.
function sortResultsByLevel(results) {
  const sorted = results.slice();
  sorted.sort(function (first, second) {
    return first.level - second.level;
  });
  return sorted;
}

// buildMyResultsHtml(): the table with my result in each level.
function buildMyResultsHtml() {
  if (myPlayer.levelResults.length === 0) {
    return '';
  }
  let references = [];
  if (lastHostState && lastHostState.rules && lastHostState.rules.levels) {
    references = lastHostState.rules.levels;
  }
  let rows = '';
  for (const result of sortResultsByLevel(myPlayer.levelResults)) {
    const reference = references[myPlayer.levelOrder[result.level]];
    let levelName = '';
    if (reference !== undefined) {
      levelName = getLevelReferenceLabel(reference).name;
    }
    rows += `<tr><td>${result.level + 1}. ${escapeHtml(levelName)}</td><td>${getResultHtml(result.result)}</td><td class="number-cell">${result.attempts}</td><td class="number-cell">${result.points}</td><td class="number-cell">${formatTime(result.seconds)}</td></tr>`;
  }
  return `<div class="table-wrapper"><table class="results-table">${buildResultsTableHeader()}<tbody>
    ${rows}</tbody></table></div>`;
}

// getResultHtml(result): the result of a level with its color.
function getResultHtml(result) {
  if (result === 'playing') {
    return translate('jugando…', 'playing…');
  }
  if (result === 'won') {
    return `<span style="color:var(--color-target-dark)">✓ ${translate('superado', 'passed')}</span>`;
  }
  if (result === 'failed') {
    return `<span style="color:var(--color-accent-dark)">✗ ${translate('fallado', 'failed')}</span>`;
  }
  if (result === 'timeout') {
    return `<span style="color:#a87a10">⏱ ${translate('tiempo', 'time')}</span>`;
  }
  return '';
}

/* ----------------------------------------------------------------------
   HOST SCREENS
   ---------------------------------------------------------------------- */

// buildStatusChipHtml(player): the small colored label with the state of a player.
function buildStatusChipHtml(player) {
  if (player.kicked) {
    return `<span class="status-chip status-chip-gone">${translate('expulsado', 'removed')}</span>`;
  }
  if (!player.online) {
    return `<span class="status-chip status-chip-gone">${translate('desconectado', 'disconnected')}</span>`;
  }
  if (player.status === 'waiting') {
    return `<span class="status-chip status-chip-waiting">${translate('esperando', 'waiting')}</span>`;
  }
  if (player.status === 'playing') {
    return `<span class="status-chip status-chip-playing">${translate('jugando', 'playing')}</span>`;
  }
  if (player.status === 'done') {
    return `<span class="status-chip status-chip-done">${translate('terminó', 'finished')}</span>`;
  }
  return undefined;
}

// buildProgressSegmentsHtml(player): one small colored bar per level (won, failed, time, playing).
function buildProgressSegmentsHtml(player) {
  let levelCount = player.levelCount;
  if (!levelCount && hostState.rules) {
    levelCount = hostState.rules.differentLevels || hostState.rules.levels.length;
  }
  if (!levelCount) {
    levelCount = 0;
  }
  const resultByLevel = {};
  for (const result of player.levelResults) {
    resultByLevel[result.level] = result.result;
  }
  let html = '<div class="progress-segments">';
  for (let index = 0; index < levelCount; index++) {
    const result = resultByLevel[index];
    let segmentClass = '';
    if (result === 'won') {
      segmentClass = 'segment-won';
    } else if (result === 'failed') {
      segmentClass = 'segment-failed';
    } else if (result === 'timeout') {
      segmentClass = 'segment-timeout';
    } else if (result === 'playing') {
      segmentClass = 'segment-playing';
    }
    html += `<i class="${segmentClass}"></i>`;
  }
  html += '</div>';
  return html;
}

// getSortedPlayers(): the players that were not removed: in the lobby by arrival order,
// later by score (best first).
function getSortedPlayers() {
  const players = [];
  for (const player of getHostPlayerList()) {
    if (!player.kicked) {
      players.push(player);
    }
  }
  players.sort(function (first, second) {
    if (hostState.status === 'lobby') {
      return first.joinedAt - second.joinedAt;
    }
    return second.score - first.score;
  });
  return players;
}

// renderHostScreen(): the lobby, the dashboard during the game and the results.
function renderHostScreen() {
  const content = getElement('onlineScreenContent');
  const players = getSortedPlayers();
  const onlinePlayers = [];
  for (const player of players) {
    if (player.online) {
      onlinePlayers.push(player);
    }
  }
  let backText = translate('← Salir', '← Leave');
  if (hostState.status === 'playing') {
    backText = translate('← Salir (termina la partida)', '← Leave (ends the game)');
  }
  let title = translate('Resultados', 'Results');
  if (hostState.status === 'lobby') {
    title = translate('Sala de espera', 'Lobby');
  } else if (hostState.status === 'playing') {
    title = translate('Partida en curso', 'Game in progress');
  }
  const header = `<div class="online-header"><button class="menu-button menu-button-inline" id="hostLeaveButton" type="button">${backText}</button>
    <h2>${title}</h2>
    <div class="code-box"><div><small>${translate('Código de ingreso', 'Join code')}</small><b>${escapeHtml(online.code)}</b></div><button class="button button-small" id="copyCodeButton" type="button">${translate('Copiar', 'Copy')}</button></div></div>`;
  let mainSection = '';
  let sideSection = '';

  if (hostState.status === 'lobby') {
    let playersHtml;
    if (onlinePlayers.length > 0) {
      playersHtml = '<div class="name-chips">';
      for (const player of onlinePlayers) {
        playersHtml += `<span>${escapeHtml(player.name)}<button type="button" data-kick-player="${escapeHtml(player.id)}" title="${translate('Expulsar', 'Remove')}" aria-label="${translate('Expulsar a', 'Remove')} ${escapeHtml(player.name)}">×</button></span>`;
      }
      playersHtml += '</div>';
    } else {
      playersHtml = `<div class="empty-box">${translate('Comparte el código', 'Share the code')} <b style="font-family:var(--font-numbers);letter-spacing:.1em">${escapeHtml(online.code)}</b>. ${translate(
        'Los jugadores entran con “Online → Unirse a un juego” y aparecerán aquí.',
        'Players join with “Online → Join a game” and will show up here.',
      )}</div>`;
    }
    let shareHint = translate('Los jugadores abren esta misma página en su dispositivo.', 'Players open this same page on their device.');
    if (online.connection && online.connection.kind === 'room') {
      shareHint = translate(
        'Los jugadores abren este mismo enlace con su cuenta (compártelo desde el menú Compartir).',
        'Players open this same link with their account (share it from the Share menu).',
      );
    }
    mainSection = `<section class="online-card"><h3>${translate('Jugadores', 'Players')} (${onlinePlayers.length})</h3>
      ${playersHtml}
      <p class="hint">${shareHint}</p></section>`;
    // why the game can not start yet
    let reason = '';
    if (!hostState.rules) {
      reason = translate('Primero selecciona el juego.', 'Pick the game first.');
    } else if (onlinePlayers.length === 0) {
      reason = translate('Espera a que entre al menos un jugador.', 'Wait for at least one player to join.');
    }
    let startDisabled = '';
    let reasonHtml = '';
    if (reason) {
      startDisabled = 'disabled';
      reasonHtml = `<p class="hint">${reason}</p>`;
    }
    sideSection = `<section class="online-card"><h3>${translate('Juego', 'Game')}</h3>${buildRulesSummary(hostState.rules)}
      <button class="button button-big" id="selectGameButton" type="button">${translate('Seleccionar juego', 'Select game')}</button>
      <button class="button button-go" id="startGameButton" type="button" ${startDisabled}>${translate('Iniciar juego', 'Start game')}</button>
      ${reasonHtml}</section>`;
  } else {
    let cards = '';
    for (let index = 0; index < players.length; index++) {
      const player = players[index];
      let cardClass = 'player-card';
      if (!player.online) {
        cardClass += ' player-card-offline';
      }
      let meta = buildStatusChipHtml(player);
      if (player.status === 'playing') {
        meta += `<span>${translate('Nivel', 'Level')} ${player.levelIndex + 1}/${player.levelCount}</span><span>${translate('intentos', 'attempts')}: ${player.attempts}</span>`;
      }
      if (player.status === 'done') {
        let passed = 0;
        for (const result of player.levelResults) {
          if (result.result === 'won') {
            passed++;
          }
        }
        meta += `<span>${passed}/${player.levelCount} ${translate('superados', 'passed')}</span>`;
      }
      cards += `<button class="${cardClass}" type="button" data-player-id="${escapeHtml(player.id)}">
      <div class="player-card-top"><span class="player-name"><span class="player-rank">${index + 1}</span>${escapeHtml(player.name)}</span><span class="player-score">${player.score}</span></div>
      ${buildProgressSegmentsHtml(player)}
      <div class="player-meta">${meta}</div>
    </button>`;
    }
    let podium = '';
    if (hostState.status === 'ended') {
      const podiumEntries = [];
      for (const player of players) {
        podiumEntries.push({ id: player.id, name: player.name, score: player.score });
      }
      podium = buildPodiumHtml(podiumEntries);
    }
    let list = `<div class="empty-box">${translate('No hay jugadores.', 'No players.')}</div>`;
    if (players.length > 0) {
      list = `<div class="player-card-grid">${cards}</div>`;
    }
    mainSection = `<section class="online-card"><h3>${translate('Jugadores', 'Players')} (${onlinePlayers.length}/${players.length})</h3>
      ${podium}
      <p class="hint">${translate('Haz clic en un nombre para ver sus respuestas, tiros y tiempos.', 'Click a name to see their answers, shots and times.')}</p>
      ${list}</section>`;
    let doneCount = 0;
    for (const player of players) {
      if (player.status === 'done') {
        doneCount++;
      }
    }
    let sideTitle = translate('En curso', 'In progress');
    if (hostState.status === 'ended') {
      sideTitle = translate('Partida terminada', 'Game over');
    }
    let endButton = '';
    if (hostState.status === 'playing') {
      endButton = `<button class="button button-danger button-big" id="endGameButton" type="button">${translate('Terminar partida', 'End game')}</button>`;
    }
    let homeButton = '';
    if (hostState.status === 'ended') {
      homeButton = `<button class="button button-outline" id="onlineHomeButton" type="button">${translate('Volver al inicio', 'Back to home')}</button>`;
    }
    sideSection = `<section class="online-card"><h3>${sideTitle}</h3>
      <p>${translate(`${doneCount} de ${players.length} jugadores terminaron.`, `${doneCount} of ${players.length} players finished.`)}</p>
      ${endButton}
      <button class="button button-big" id="downloadCsvButton" type="button">${translate('Descargar resultados (CSV)', 'Download results (CSV)')}</button>
      ${homeButton}
      <h3>${translate('Juego', 'Game')}</h3>${buildRulesSummary(hostState.rules)}</section>`;
  }
  content.innerHTML = header + `<div class="online-grid">${mainSection}${sideSection}</div>`;

  getElement('copyCodeButton').addEventListener('click', function () {
    copyGameCode();
  });
  getElement('hostLeaveButton').addEventListener('click', function () {
    const button = getElement('hostLeaveButton');
    // leave at once if the game ended, if nobody is connected, or on the second press
    if (hostState.status === 'ended' || onlinePlayers.length === 0 || online.buttonWaitingConfirmation === 'hostLeave') {
      if (hostState.status === 'playing') {
        hostState.status = 'ended';
        sendHostState(true);
      }
      setTimeout(function () {
        leaveOnline(true);
      }, 100);
      return;
    }
    online.buttonWaitingConfirmation = 'hostLeave';
    button.textContent = translate('¿Seguro? Pulsa otra vez', 'Sure? Press again');
    setTimeout(function () {
      if (online.buttonWaitingConfirmation === 'hostLeave') {
        online.buttonWaitingConfirmation = null;
        renderOnlineScreen();
      }
    }, 3000);
  });
  const kickButtons = content.querySelectorAll('[data-kick-player]');
  for (const button of kickButtons) {
    button.addEventListener('click', function () {
      kickPlayer(button.dataset.kickPlayer);
    });
  }
  const playerCards = content.querySelectorAll('[data-player-id]');
  for (const card of playerCards) {
    card.addEventListener('click', function () {
      openPlayerDetail(card.dataset.playerId);
    });
  }
  listenIfExists('selectGameButton', 'click', function () {
    openLevelPicker(false);
  });
  listenIfExists('startGameButton', 'click', function () {
    startGame();
  });
  listenIfExists('downloadCsvButton', 'click', function () {
    downloadResultsCsv();
  });
  listenIfExists('onlineHomeButton', 'click', function () {
    leaveOnline(true);
  });
  listenIfExists('endGameButton', 'click', function () {
    const button = getElement('endGameButton');
    if (online.buttonWaitingConfirmation === 'endGame') {
      online.buttonWaitingConfirmation = null;
      endGame();
      return;
    }
    online.buttonWaitingConfirmation = 'endGame';
    button.textContent = translate('¿Terminar para todos? Pulsa otra vez', 'End for everyone? Press again');
    setTimeout(function () {
      if (online.buttonWaitingConfirmation === 'endGame') {
        online.buttonWaitingConfirmation = null;
        renderOnlineScreen();
      }
    }, 3000);
  });
}

/* ----------------------------------------------------------------------
   THE DETAILS OF ONE PLAYER (host)
   ---------------------------------------------------------------------- */

// getPlayerLevelName(player, levelIndex): the name of a level of a player.
function getPlayerLevelName(player, levelIndex) {
  const rules = hostState.rules;
  if (!rules) {
    return '';
  }
  let positionInHostList = levelIndex;
  if (player.levelOrder[levelIndex] !== undefined) {
    positionInHostList = player.levelOrder[levelIndex];
  }
  if (rules.levels[positionInHostList] !== undefined) {
    return getLevelReferenceLabel(rules.levels[positionInHostList]).name;
  }
  return '';
}

// formatAnswerValue(quantity, value): an answer written for the host.
function formatAnswerValue(quantity, value) {
  if (quantity === 'direction') {
    if (DIRECTION_NAMES[value]) {
      return escapeHtml(getDirectionName(value));
    }
    return escapeHtml(value);
  }
  return formatQuantityValue(quantity, value);
}

// buildEventHtml(event): one line of the log of answers and shots.
function buildEventHtml(event) {
  const levelText = `<small>${translate('Nivel', 'Level')} ${event.level + 1}</small>`;
  if (event.kind === 'answer') {
    let eventClass = 'event event-wrong';
    let resultText = `<span class="text-wrong">✗ ${translate('incorrecta', 'wrong')}</span>`;
    if (event.correct) {
      eventClass = 'event event-correct';
      resultText = `<span class="text-correct">✓ ${translate('correcta', 'correct')}</span>`;
    }
    const itemTexts = [];
    for (const item of event.items || []) {
      const quantity = splitQuantityKey(item.key).quantity;
      let mark = `<span class="text-wrong">✗</span> <small>(${translate('correcto', 'correct')}: ${formatAnswerValue(quantity, item.correctValue)})</small>`;
      if (item.correct) {
        mark = '<span class="text-correct">✓</span>';
      }
      itemTexts.push(`${getQuantityKeyName(item.key)} = <b>${formatAnswerValue(quantity, item.given)}</b> ${mark}`);
    }
    return `<div class="${eventClass}">${levelText} · ${translate('Respuesta', 'Answer')} — ${resultText}<br>
      ${itemTexts.join(' · ')}</div>`;
  }
  if (event.kind === 'shot') {
    let hitText = `<span class="text-wrong">${translate('sin objetivos', 'no targets')}</span>`;
    if (event.targetsHit > 1) {
      hitText = `<span class="text-correct">${translate(`${event.targetsHit} objetivos`, `${event.targetsHit} targets`)}</span>`;
    } else if (event.targetsHit) {
      hitText = `<span class="text-correct">${translate(`${event.targetsHit} objetivo`, `${event.targetsHit} target`)}</span>`;
    }
    return `<div class="event event-shot">${levelText} · ${translate('Tiro', 'Shot')}: v₀ = ${event.launchSpeed} m/s, θ = ${event.launchAngle}°, h₀ = ${event.launchHeight} m → ${hitText} <small>(x = ${event.landingX} m)</small></div>`;
  }
  if (event.kind === 'levelEnd') {
    let eventClass = 'event event-wrong';
    let text = translate('Nivel fallado', 'Level failed');
    if (event.result === 'won') {
      eventClass = 'event event-correct';
      text = translate('Nivel superado', 'Level passed');
    } else if (event.result === 'timeout') {
      text = translate('Se acabó el tiempo', 'Time ran out');
    }
    return `<div class="${eventClass}">${levelText} · <b>${text}</b> · +${event.points} ${translate('pts', 'pts')}</div>`;
  }
  return '';
}

// getSortedEvents(player, newestFirst): the events of a player in order.
function getSortedEvents(player, newestFirst) {
  const events = [];
  for (const number in player.events) {
    events.push(player.events[number]);
  }
  events.sort(function (first, second) {
    if (newestFirst) {
      return second.number - first.number;
    }
    return first.number - second.number;
  });
  return events;
}

// openPlayerDetail(id): opens the details window of a player.
function openPlayerDetail(id) {
  detailPlayerId = id;
  getElement('playerDetailWindow').hidden = false;
  renderPlayerDetail();
}

// closePlayerDetail(): closes the details window.
function closePlayerDetail() {
  detailPlayerId = null;
  getElement('playerDetailWindow').hidden = true;
}

// renderPlayerDetail(): fills the details window: results by level and the log.
function renderPlayerDetail() {
  const player = hostPlayers[detailPlayerId];
  if (!player) {
    getElement('playerDetailWindow').hidden = true;
    return;
  }
  const events = getSortedEvents(player, true);
  const levelCount = player.levelCount || 0;
  const resultByLevel = {};
  for (const result of player.levelResults) {
    resultByLevel[result.level] = result;
  }
  let playingText = '';
  if (player.status === 'playing') {
    playingText = `<span class="hint">${translate('Nivel', 'Level')} ${player.levelIndex + 1}/${player.levelCount} · ${translate('intentos en este nivel', 'attempts on this level')}: ${player.attempts}</span>`;
  }
  let table;
  if (levelCount) {
    let rows = '';
    for (let index = 0; index < levelCount; index++) {
      const result = resultByLevel[index];
      let resultCell = `<span class="hint">${translate('pendiente', 'pending')}</span>`;
      let attemptsCell = '–';
      let pointsCell = '–';
      let timeCell = '–';
      if (result) {
        resultCell = getResultHtml(result.result);
        attemptsCell = result.attempts;
        pointsCell = result.points;
        if (result.result !== 'playing') {
          timeCell = formatTime(result.seconds);
        }
      }
      rows += `<tr><td>${index + 1}. ${escapeHtml(getPlayerLevelName(player, index))}</td><td>${resultCell}</td><td class="number-cell">${attemptsCell}</td><td class="number-cell">${pointsCell}</td><td class="number-cell">${timeCell}</td></tr>`;
    }
    table = `<div class="table-wrapper"><table class="results-table">${buildResultsTableHeader()}<tbody>
      ${rows}
    </tbody></table></div>`;
  } else {
    table = `<p class="hint">${translate('Todavía no empieza a jugar.', 'Hasn’t started playing yet.')}</p>`;
  }
  let log = `<p class="hint">${translate('Sin respuestas todavía.', 'No answers yet.')}</p>`;
  if (events.length > 0) {
    log = '<div class="event-log">';
    for (const event of events) {
      log += buildEventHtml(event);
    }
    log += '</div>';
  }
  let kickButton = '<span></span>';
  if (hostState.status !== 'ended' && !player.kicked) {
    kickButton = `<button class="button button-danger" id="playerDetailKickButton" type="button">${translate('Expulsar', 'Remove')}</button>`;
  }
  getElement('playerDetailCard').innerHTML =
    `<div class="modal-header"><h2 id="playerDetailTitle">${escapeHtml(player.name)}</h2><button class="close-button" id="playerDetailCloseButton" type="button" aria-label="${translate('Cerrar', 'Close')}">×</button></div>
    <div class="player-meta" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${buildStatusChipHtml(player)}<b style="font-family:var(--font-numbers);font-size:18px">${player.score} ${translate('pts', 'pts')}</b>${playingText}</div>
    ${table}
    <h3 style="margin:0;font:400 20px var(--font-title)">${translate('Respuestas y tiros', 'Answers and shots')}</h3>
    ${log}
    <div class="modal-footer">${kickButton}<button class="button" id="playerDetailOkButton" type="button">${translate('Cerrar', 'Close')}</button></div>`;
  getElement('playerDetailCloseButton').addEventListener('click', closePlayerDetail);
  getElement('playerDetailOkButton').addEventListener('click', closePlayerDetail);
  listenIfExists('playerDetailKickButton', 'click', function () {
    const button = getElement('playerDetailKickButton');
    if (online.buttonWaitingConfirmation === 'kick') {
      online.buttonWaitingConfirmation = null;
      kickPlayer(player.id);
      return;
    }
    online.buttonWaitingConfirmation = 'kick';
    button.textContent = translate('¿Expulsar? Pulsa otra vez', 'Remove? Press again');
    setTimeout(function () {
      if (online.buttonWaitingConfirmation === 'kick') {
        online.buttonWaitingConfirmation = null;
        const kick = getElement('playerDetailKickButton');
        if (kick) {
          kick.textContent = translate('Expulsar', 'Remove');
        }
      }
    }, 3000);
  });
}
// clicking outside the card closes the window
getElement('playerDetailWindow').addEventListener('click', function (event) {
  if (event.target === getElement('playerDetailWindow')) {
    closePlayerDetail();
  }
});

/* ----------------------------------------------------------------------
   PICKING LEVELS (full screen) AND RULES
   The picker keys are the campaign level ids ('c1', 'd3'...) and 'custom:' + id
   for the host's own levels.
   ---------------------------------------------------------------------- */

// levelPicker: the state of the level picker and of the rules screen.
const levelPicker = {
  selectedKeys: [], //            the ticked levels, in the order they were ticked
  rules: Object.assign({}, DEFAULT_RULES), // the values of the rules screen
  returnScreen: 'lobby', //       where the "Back" button goes
  forDuel: false, //              true when picking the levels of a race duel
  message: '', //                 the error message of the rules screen
};

// openLevelPicker(forDuel): opens the level picker.
function openLevelPicker(forDuel) {
  levelPicker.forDuel = forDuel === true;
  levelPicker.selectedKeys = [];
  if (hostState.rules && hostState.rules.pickerKeys) {
    levelPicker.selectedKeys = hostState.rules.pickerKeys.slice();
  }
  levelPicker.returnScreen = online.screen;
  levelPicker.message = '';
  online.screen = 'picker';
  renderOnlineScreen();
  window.scrollTo(0, 0);
}

// findLevelByPickerKey(key): the level of a picker key (or null/undefined).
function findLevelByPickerKey(key) {
  if (key.startsWith('custom:')) {
    const id = key.slice(7);
    for (const level of customLevels) {
      if (level.id === id) {
        return level;
      }
    }
    return undefined;
  }
  return findCampaignLevel(key);
}

// pickerKeyToReference(key): the level reference sent to the players (an id, or a level object).
function pickerKeyToReference(key) {
  if (key.startsWith('custom:')) {
    return compactLevelForSending(findLevelByPickerKey(key));
  }
  return key;
}

// getValidPickerKeys(): the ticked keys whose level still exists.
function getValidPickerKeys() {
  const keys = [];
  for (const key of levelPicker.selectedKeys) {
    if (findLevelByPickerKey(key)) {
      keys.push(key);
    }
  }
  return keys;
}

// buildPickerSections(): the sections of the picker: the three campaigns and my levels.
function buildPickerSections() {
  const sections = [];
  for (const campaign of CAMPAIGNS) {
    const items = [];
    for (let index = 0; index < campaign.levels.length; index++) {
      const level = campaign.levels[index];
      items.push({
        key: level.id,
        tag: `${campaign.prefix || 'L'}${index + 1}`,
        name: getLevelName(level),
        stars: progress.starsByLevel[level.id] || 0,
        typeName: campaign.key,
      });
    }
    sections.push({ key: campaign.key, title: getModeInfo(campaign.key).title, titleClass: 'section-title-' + campaign.key, items: items });
  }
  const customItems = [];
  for (const level of customLevels) {
    let tag = 'L';
    if (level.type === 'displacement') {
      tag = 'D';
    }
    if (level.type === 'mixed') {
      tag = 'M';
    }
    customItems.push({ key: 'custom:' + level.id, tag: tag, name: level.name, stars: 0, typeName: level.type });
  }
  sections.push({ key: 'custom', title: getModeInfo('custom').title, titleClass: '', items: customItems });
  return sections;
}

// renderLevelPicker(): the full screen level picker.
function renderLevelPicker() {
  const content = getElement('onlineScreenContent');
  const sections = buildPickerSections();
  const selectedCount = levelPicker.selectedKeys.length;
  let explanation = translate(
    'Toca los niveles en el orden en que quieres que se jueguen. El número de cada tarjeta es su orden.',
    'Tap the levels in the order you want them played. The number on each card is its order.',
  );
  if (levelPicker.forDuel) {
    explanation = translate(
      'Toca los niveles de la carrera. Cada ronda usa el siguiente nivel de la lista (si hay menos niveles que rondas, se repiten).',
      'Tap the race levels. Each round uses the next level in the list (if there are fewer levels than rounds, they repeat).',
    );
  }
  let sectionsHtml = '';
  for (const section of sections) {
    let tickAllButton = '';
    if (section.items.length > 0) {
      tickAllButton = `<button class="button button-outline button-small" type="button" data-tick-all="${section.key}">${translate('Marcar todos', 'Tick all')}</button>`;
    }
    let cardsHtml;
    if (section.items.length > 0) {
      cardsHtml = '<div class="picker-grid">';
      for (const item of section.items) {
        const position = levelPicker.selectedKeys.indexOf(item.key);
        let orderNumber = '';
        if (position >= 0) {
          orderNumber = position + 1;
        }
        let starsHtml = '';
        if (item.stars) {
          starsHtml = `<small>${'★'.repeat(item.stars)}</small>`;
        }
        cardsHtml += `<button class="picker-card picker-card-${item.typeName}" type="button" data-picker-key="${escapeHtml(item.key)}" aria-pressed="${position >= 0}">
            <span class="picker-order-number">${orderNumber}</span><b>${escapeHtml(item.tag)}</b><span class="picker-level-name">${escapeHtml(item.name)}</span>
            ${starsHtml}</button>`;
      }
      cardsHtml += '</div>';
    } else {
      cardsHtml = `<p class="hint">${translate('Aún no tienes niveles propios. Créalos en el editor.', 'You don’t have your own levels yet. Make them in the editor.')}</p>`;
    }
    sectionsHtml += `<div class="picker-section">
        <div class="picker-section-header"><h3 class="${section.titleClass}">${section.title}</h3>${tickAllButton}</div>
        ${cardsHtml}
      </div>`;
  }
  let countText = translate('Ningún nivel seleccionado', 'No level selected');
  if (selectedCount === 1) {
    countText = translate(`<b>${selectedCount}</b> nivel seleccionado`, `<b>${selectedCount}</b> level selected`);
  } else if (selectedCount > 1) {
    countText = translate(`<b>${selectedCount}</b> niveles seleccionados`, `<b>${selectedCount}</b> levels selected`);
  }
  let clearButton = '';
  let continueDisabled = 'disabled';
  if (selectedCount) {
    clearButton = `<button class="button button-outline button-small" id="pickerClearButton" type="button">${translate('Limpiar', 'Clear')}</button>`;
    continueDisabled = '';
  }
  content.innerHTML = `<div class="online-header"><button class="menu-button menu-button-inline" id="pickerBackButton" type="button">${translate('← Volver', '← Back')}</button>
      <h2>${translate('Elegir niveles', 'Pick levels')}</h2></div>
    <section class="online-card">
      <p>${explanation}</p>
      ${sectionsHtml}
    </section>
    <div class="picker-bottom-bar">
      <span>${countText}</span>
      <span class="picker-buttons">${clearButton}
      <button class="button button-go" id="pickerContinueButton" type="button" ${continueDisabled}>${translate('Continuar →', 'Continue →')}</button></span>
    </div>`;

  const cards = content.querySelectorAll('[data-picker-key]');
  for (const card of cards) {
    card.addEventListener('click', function () {
      const key = card.dataset.pickerKey;
      const position = levelPicker.selectedKeys.indexOf(key);
      if (position >= 0) {
        levelPicker.selectedKeys.splice(position, 1); // untick
      } else {
        levelPicker.selectedKeys.push(key); // tick
      }
      playClickSound();
      renderLevelPicker();
    });
  }
  const tickAllButtons = content.querySelectorAll('[data-tick-all]');
  for (const button of tickAllButtons) {
    button.addEventListener('click', function () {
      for (const section of sections) {
        if (section.key !== button.dataset.tickAll) {
          continue;
        }
        for (const item of section.items) {
          if (levelPicker.selectedKeys.indexOf(item.key) === -1) {
            levelPicker.selectedKeys.push(item.key);
          }
        }
      }
      renderLevelPicker();
    });
  }
  listenIfExists('pickerClearButton', 'click', function () {
    levelPicker.selectedKeys = [];
    renderLevelPicker();
  });
  getElement('pickerBackButton').addEventListener('click', function () {
    online.screen = levelPicker.returnScreen;
    renderOnlineScreen();
  });
  getElement('pickerContinueButton').addEventListener('click', function () {
    const keys = getValidPickerKeys();
    if (keys.length === 0) {
      return;
    }
    if (levelPicker.forDuel) {
      const references = [];
      for (const key of keys) {
        references.push(pickerKeyToReference(key));
      }
      hostState.rules = Object.assign({}, hostState.rules, { levels: references, pickerKeys: keys });
      online.screen = 'duelLobby';
      sendHostState(true);
      renderOnlineScreen();
      showToast(translate('Niveles guardados', 'Levels saved'));
    } else {
      online.screen = 'rules';
      renderOnlineScreen();
      window.scrollTo(0, 0);
    }
  });
}

// checkedAttribute(condition): 'checked' when the condition is true (for radio buttons).
function checkedAttribute(condition) {
  if (condition) {
    return 'checked';
  }
  return '';
}

// renderRulesScreen(): the screen "Game rules" of a class game.
function renderRulesScreen() {
  const rules = levelPicker.rules;
  const levelCount = levelPicker.selectedKeys.length;
  const content = getElement('onlineScreenContent');
  let chips = '';
  for (let index = 0; index < levelPicker.selectedKeys.length; index++) {
    const key = levelPicker.selectedKeys[index];
    const level = findLevelByPickerKey(key);
    if (!level) {
      continue;
    }
    let name = getLevelName(level);
    if (key.startsWith('custom:')) {
      name = level.name;
    }
    chips += `<span>${index + 1}. ${escapeHtml(name)}</span>`;
  }
  let timeOptions = '';
  const timeChoices = [0, 60, 120, 180, 300, 600];
  for (const seconds of timeChoices) {
    let selected = '';
    if (rules.timeLimit === seconds) {
      selected = 'selected';
    }
    let label = translate('Sin límite', 'No limit');
    if (seconds) {
      label = formatTime(seconds) + ' min';
    }
    timeOptions += `<option value="${seconds}" ${selected}>${label}</option>`;
  }
  const maximumDifferent = Math.max(1, levelCount);
  content.innerHTML = `<div class="online-header"><button class="menu-button menu-button-inline" id="rulesBackButton" type="button">${translate('← Niveles', '← Levels')}</button>
      <h2>${translate('Reglas de la partida', 'Game rules')}</h2></div>
    <section class="online-card">
      <h3>${translate('Niveles elegidos', 'Chosen levels')} (${levelCount})</h3>
      <div class="level-chips">${chips}</div>
      <div class="rule-grid">
        <div class="rule-box"><b>${translate('Intentos por nivel', 'Attempts per level')}</b>
          <label><input type="radio" name="attemptsChoice" value="-1" ${checkedAttribute(rules.attempts === -1)}> ${translate('Los de cada nivel', 'Each level’s own')}</label>
          <label><input type="radio" name="attemptsChoice" value="0" ${checkedAttribute(rules.attempts === 0)}> ${translate('Ilimitados', 'Unlimited')}</label>
          <label><input type="radio" name="attemptsChoice" value="number" ${checkedAttribute(rules.attempts > 0)}> ${translate('Máximo', 'At most')} <input type="number" id="attemptsNumberInput" min="1" max="20" value="${rules.attemptsNumber}"></label>
          <small class="hint">${translate('En lanzamiento son tiros; en vectores, intentos de respuesta.', 'In launch levels they are shots; in vector levels, answer attempts.')}</small></div>
        <div class="rule-box"><b>${translate('Tiempo por nivel', 'Time per level')}</b>
          <label><select id="timeLimitSelect">${timeOptions}</select></label></div>
        <div class="rule-box"><b>${translate('Niveles', 'Levels')}</b>
          <label><input type="radio" name="levelsChoice" value="0" ${checkedAttribute(!rules.differentLevels)}> ${translate('Todos juegan los mismos', 'Everyone plays the same ones')}</label>
          <label><input type="radio" name="levelsChoice" value="number" ${checkedAttribute(rules.differentLevels)}> ${translate('Distintos por jugador:', 'Different per player:')} <input type="number" id="differentLevelsInput" min="1" max="${maximumDifferent}" value="${Math.min(rules.differentLevelsNumber, maximumDifferent)}"></label>
          <small class="hint">${translate('Cada jugador recibe esa cantidad, al azar, de los niveles elegidos.', 'Each player gets that many, at random, from the chosen levels.')}</small></div>
        <div class="rule-box"><b>${translate('Valores', 'Values')}</b>
          <label><input type="radio" name="valuesChoice" value="0" ${checkedAttribute(!rules.differentValues)}> ${translate('Iguales para todos', 'Same for everyone')}</label>
          <label><input type="radio" name="valuesChoice" value="1" ${checkedAttribute(rules.differentValues)}> ${translate('Distintos por jugador', 'Different per player')}</label>
          <small class="hint">${translate(
            'Cambia magnitudes y ángulos de los vectores (siempre con solución) y mueve un poco las estructuras de los niveles de lanzamiento.',
            'Changes vector lengths and angles (always solvable) and shifts the structures of launch levels a little.',
          )}</small></div>
        <div class="rule-box"><b>${translate('Opciones', 'Options')}</b>
          <label><input type="checkbox" id="practiceAllowedCheckbox" ${checkedAttribute(rules.practiceAllowed)}> ${translate('Permitir modo práctica', 'Allow practice mode')}</label>
          <label><input type="checkbox" id="showLeaderboardCheckbox" ${checkedAttribute(rules.showLeaderboard)}> ${translate('Mostrar tabla de posiciones a los jugadores', 'Show the leaderboard to players')}</label>
          <label><input type="checkbox" id="lateJoinCheckbox" ${checkedAttribute(rules.lateJoinAllowed)}> ${translate('Permitir entrar con la partida empezada', 'Allow joining after the start')}</label></div>
      </div>
      <p class="online-message online-message-error" id="rulesMessage" role="status">${escapeHtml(levelPicker.message)}</p>
      <div class="modal-footer"><button class="button button-outline" id="rulesChangeLevelsButton" type="button">${translate('← Cambiar niveles', '← Change levels')}</button><button class="button button-go" id="saveRulesButton" type="button">${translate('Guardar juego', 'Save game')}</button></div>
    </section>`;

  // readCheckedValue(groupName): the value of the chosen radio button of a group
  function readCheckedValue(groupName) {
    const checked = content.querySelector(`[name=${groupName}]:checked`);
    if (checked) {
      return checked.value;
    }
    return undefined;
  }
  // readRules(): reads every control of the screen into levelPicker.rules
  function readRules() {
    rules.attemptsNumber = Math.round(clampNumber(parseNumber(getElement('attemptsNumberInput').value, 3), 1, 20));
    const attemptsChoice = readCheckedValue('attemptsChoice');
    if (attemptsChoice === 'number') {
      rules.attempts = rules.attemptsNumber;
    } else {
      rules.attempts = Number(attemptsChoice);
    }
    rules.timeLimit = Number(getElement('timeLimitSelect').value);
    rules.differentLevelsNumber = Math.round(clampNumber(parseNumber(getElement('differentLevelsInput').value, 2), 1, 60));
    if (readCheckedValue('levelsChoice') === 'number') {
      rules.differentLevels = rules.differentLevelsNumber;
    } else {
      rules.differentLevels = 0;
    }
    rules.differentValues = readCheckedValue('valuesChoice') === '1';
    rules.practiceAllowed = getElement('practiceAllowedCheckbox').checked;
    rules.showLeaderboard = getElement('showLeaderboardCheckbox').checked;
    rules.lateJoinAllowed = getElement('lateJoinCheckbox').checked;
  }
  const controls = content.querySelectorAll('.rule-grid input, .rule-grid select');
  for (const control of controls) {
    control.addEventListener('change', readRules);
  }
  function goBackToPicker() {
    readRules();
    online.screen = 'picker';
    renderOnlineScreen();
  }
  getElement('rulesBackButton').addEventListener('click', goBackToPicker);
  getElement('rulesChangeLevelsButton').addEventListener('click', goBackToPicker);
  getElement('saveRulesButton').addEventListener('click', function () {
    readRules();
    const keys = getValidPickerKeys();
    if (keys.length === 0) {
      goBackToPicker();
      return;
    }
    const references = [];
    for (const key of keys) {
      references.push(pickerKeyToReference(key));
    }
    let differentLevels = 0;
    if (rules.differentLevels) {
      differentLevels = Math.min(rules.differentLevels, references.length);
    }
    const newRules = {
      levels: references,
      attempts: rules.attempts,
      timeLimit: rules.timeLimit,
      differentLevels: differentLevels,
      differentValues: rules.differentValues,
      practiceAllowed: rules.practiceAllowed,
      showLeaderboard: rules.showLeaderboard,
      lateJoinAllowed: rules.lateJoinAllowed,
      seed: createRandomId(),
      pickerKeys: keys,
    };
    // connections with a size limit: check that the levels fit in a message
    const testMessage = { sender: 'host', code: online.code, status: 'lobby', episode: 0, rules: newRules, roster: [], kickedIds: [] };
    if (online.connection && online.connection.sizeLimit !== Infinity && JSON.stringify(testMessage).length > MAX_MESSAGE_SIZE - 600) {
      levelPicker.message = translate(
        'Los niveles propios seleccionados son demasiado grandes para enviarlos en una partida en línea. Quita alguno o usa niveles de las campañas.',
        'The selected custom levels are too large to send in an online game. Remove one or use campaign levels.',
      );
      getElement('rulesMessage').textContent = levelPicker.message;
      return;
    }
    hostState.rules = newRules;
    online.screen = 'lobby';
    sendHostState(true);
    renderOnlineScreen();
    showToast(translate('Juego guardado', 'Game saved'));
  });
}

/* ----------------------------------------------------------------------
   RESULTS AS A CSV FILE (it can be opened with Excel or Google Sheets)
   ---------------------------------------------------------------------- */

// getResultWord(result): the result of a level as a word for the CSV.
function getResultWord(result) {
  if (result === 'playing') return translate('jugando', 'playing');
  if (result === 'won') return translate('superado', 'passed');
  if (result === 'failed') return translate('fallado', 'failed');
  if (result === 'timeout') return translate('tiempo agotado', 'time out');
  return '';
}

// getPlayerStatusWord(player): the state of a player as a word for the CSV.
function getPlayerStatusWord(player) {
  if (player.kicked) return translate('expulsado', 'removed');
  if (!player.online) return translate('desconectado', 'disconnected');
  if (player.status === 'waiting') return translate('esperando', 'waiting');
  if (player.status === 'playing') return translate('jugando', 'playing');
  if (player.status === 'done') return translate('terminó', 'finished');
  return undefined;
}

// csvCell(value): a value between quotes, with the quotes inside doubled (CSV rule).
function csvCell(value) {
  if (value === null || value === undefined) {
    value = '';
  }
  return `"${String(value).replace(/"/g, '""')}"`;
}

// downloadResultsCsv(): creates the CSV file with every result and downloads it.
async function downloadResultsCsv() {
  const rows = [
    [
      translate('jugador', 'player'),
      translate('nivel', 'level'),
      translate('nombre_nivel', 'level_name'),
      translate('tipo', 'type'),
      translate('resultado', 'result'),
      translate('intentos', 'attempts'),
      translate('puntos', 'points'),
      translate('tiempo_s', 'time_s'),
      translate('detalle', 'detail'),
    ],
  ];
  for (const player of getSortedPlayers()) {
    rows.push([player.name, '', '', translate('total', 'total'), getPlayerStatusWord(player), '', player.score, '', '']);
    for (const result of sortResultsByLevel(player.levelResults)) {
      rows.push([
        player.name,
        result.level + 1,
        getPlayerLevelName(player, result.level),
        translate('nivel', 'level'),
        getResultWord(result.result),
        result.attempts,
        result.points,
        result.seconds,
        '',
      ]);
    }
    for (const event of getSortedEvents(player, false)) {
      if (event.kind === 'answer') {
        const details = [];
        for (const item of event.items || []) {
          let mark = '✗';
          if (item.correct) {
            mark = '✓';
          }
          details.push(`${getQuantityKeyName(item.key)}=${item.given} (${translate('correcto', 'correct')} ${item.correctValue}) ${mark}`);
        }
        let resultText = translate('incorrecta', 'wrong');
        if (event.correct) {
          resultText = translate('correcta', 'correct');
        }
        rows.push([
          player.name,
          event.level + 1,
          getPlayerLevelName(player, event.level),
          translate('respuesta', 'answer'),
          resultText,
          '',
          '',
          '',
          details.join('; '),
        ]);
      }
      if (event.kind === 'shot') {
        let resultText = translate('fallo', 'miss');
        if (event.targetsHit) {
          resultText = translate('acierto', 'hit');
        }
        rows.push([
          player.name,
          event.level + 1,
          getPlayerLevelName(player, event.level),
          translate('tiro', 'shot'),
          resultText,
          '',
          '',
          '',
          `v0=${event.launchSpeed} θ=${event.launchAngle} h0=${event.launchHeight} x=${event.landingX}`,
        ]);
      }
    }
  }
  // build the text: cells separated by commas, rows by line breaks.
  // The invisible character ﻿ at the start makes Excel read the accents correctly.
  const lines = [];
  for (const row of rows) {
    const cells = [];
    for (const value of row) {
      cells.push(csvCell(value));
    }
    lines.push(cells.join(','));
  }
  const csvText = '﻿' + lines.join('\r\n');
  const fileName = `parabola-brava-${online.code}.csv`;
  // inside claude.ai, its own download service is used
  try {
    let downloads = null;
    if (window.claude && window.claude.use) {
      downloads = await window.claude.use('downloads');
    }
    if (downloads) {
      await downloads.save({ filename: fileName, data: new Blob([csvText], { type: 'text/csv' }) });
      return;
    }
  } catch (error) {
    if (error && error.code && error.code !== 'unavailable') {
      return;
    }
  }
  // normal download: a temporary link to the file (a "Blob") that is clicked by code
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csvText], { type: 'text/csv' }));
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  setTimeout(function () {
    URL.revokeObjectURL(link.href);
    link.remove();
  }, 1000);
}

/* ----------------------------------------------------------------------
   THE "ONLINE" MENU OF THE HOME SCREEN
   ---------------------------------------------------------------------- */
getElement('onlineButton').addEventListener('click', function (event) {
  event.stopPropagation(); // so the click does not reach the document (which closes menus)
  playClickSound();
  const menu = getElement('onlineMenu');
  const opening = menu.hidden;
  menu.hidden = !opening;
  getElement('onlineButton').setAttribute('aria-expanded', String(opening));
  if (opening) {
    getElement('settingsMenu').hidden = true;
    getElement('settingsButton').setAttribute('aria-expanded', 'false');
  }
});
// a click anywhere else closes the Online menu
document.addEventListener('click', function (event) {
  const menu = getElement('onlineMenu');
  if (!menu.hidden && !menu.contains(event.target) && !getElement('onlineButton').contains(event.target)) {
    menu.hidden = true;
    getElement('onlineButton').setAttribute('aria-expanded', 'false');
  }
});
getElement('onlineJoinButton').addEventListener('click', function () {
  playClickSound();
  getElement('onlineMenu').hidden = true;
  resetOnline();
  online.screen = 'join';
  showView('online');
  renderOnlineScreen();
});
getElement('onlineClassGameButton').addEventListener('click', function () {
  playClickSound();
  getElement('onlineMenu').hidden = true;
  createGame('class');
});
getElement('onlineDuelButton').addEventListener('click', function () {
  playClickSound();
  getElement('onlineMenu').hidden = true;
  createGame('duel');
});
// Escape closes the player details or the Online menu
document.addEventListener('keydown', function (event) {
  if (event.key !== 'Escape') {
    return;
  }
  if (!getElement('playerDetailWindow').hidden) {
    closePlayerDetail();
  } else if (!getElement('onlineMenu').hidden) {
    getElement('onlineMenu').hidden = true;
    getElement('onlineButton').setAttribute('aria-expanded', 'false');
  }
});
