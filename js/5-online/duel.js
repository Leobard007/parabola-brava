/* ======================================================================
   FILE: js/5-online/duel.js

   1 VS 1 DUELS
   The creator of the duel is the "host" of the connection, but also plays.
   The host decides who wins each round (the first one who reports finishing).
   Modes:
     race  → both play the same level; whoever completes it first wins the round.
             If you fail, the level restarts at once.
     hide  → (Hide & seek) each one hides a piglet on a map; the game creates vectors
             as clues; you must calculate the coordinates of the rival's piglet and
             then knock it down. A wrong answer locks you for 5 s; after 3 missed
             shots you wait 5 s and get 3 more.
   ====================================================================== */

// DUEL_DEFAULT_RULES: the rules of a new duel.
//   duelMode: 'race' or 'hide';  rounds: 1, 3 or 5 (race);  difficulty: 1 or 2 (hide)
//   levels: the levels of the race;  pickerKeys: the levels ticked in the level picker
const DUEL_DEFAULT_RULES = { duelMode: 'race', rounds: 3, difficulty: 1, levels: [], pickerKeys: [] };

// HIDE_AND_SEEK: the fixed values of Hide & seek.
const HIDE_AND_SEEK = {
  worldWidth: 45, //       width of the world (m)
  mapHeight: 20, //        height shown in the hiding map (m)
  minimumX: 8, //          the piglet can be hidden between x = 8 m...
  maximumX: 42, //         ...and x = 42 m
  maximumY: 15, //         and up to 15 m high
  wrongGuessWait: 5000, // milliseconds of wait after a wrong answer
  reloadWait: 5000, //     milliseconds of wait to reload the shots
  shotsPerReload: 3,
};

// duelState: what this browser keeps about the duel.
const duelState = {
  phaseKey: '', //           "status|round|episode" of the last host state (to detect changes)
  myClue: null, //           Hide & seek: the clue made from my hiding spot
  chosenSpot: null, //       Hide & seek: the spot chosen on the map { x, y }
  finishInfo: null, //       when I finished the round: { round, milliseconds }
  wrongGuesses: 0, //        Hide & seek: wrong answers
  restarts: 0, //            race: how many times the level restarted
  reloads: 0, //             Hide & seek: how many times the shots were reloaded
  lockedUntil: 0, //         Hide & seek: no answers until this moment (performance.now())
  reloadingUntil: 0, //      Hide & seek: no shots until this moment
  roundStartTime: 0, //      when the round started (performance.now())
  roundOver: false, //       true once someone won the round
  reloadTimer: null, //      timer of the reload
};

// isDuelMode(): true during a duel.
function isDuelMode() {
  return online.mode === 'duel';
}

// resetDuelLocalState(): clears the local duel state (not the phase key).
function resetDuelLocalState() {
  clearTimeout(duelState.reloadTimer);
  duelState.myClue = null;
  duelState.chosenSpot = null;
  duelState.finishInfo = null;
  duelState.wrongGuesses = 0;
  duelState.restarts = 0;
  duelState.reloads = 0;
  duelState.lockedUntil = 0;
  duelState.reloadingUntil = 0;
  duelState.roundOver = false;
  duelState.reloadTimer = null;
}

// getDuelRival(): information about the rival: { name, live, online, clue } (or null).
function getDuelRival() {
  if (online.role === 'host') {
    const player = hostPlayers[hostState.guestId];
    if (!player) {
      return null;
    }
    let live = null;
    let clue = null;
    if (player.lastMessage) {
      live = player.lastMessage.live;
      clue = player.lastMessage.clue;
    }
    return { name: player.name, live: live, online: player.online, clue: clue };
  }
  if (lastHostState) {
    return { name: lastHostState.hostName, live: lastHostState.live, online: true, clue: lastHostState.clue };
  }
  return null;
}

// getDuelHostState(): the state of the host (built by the host itself, or received).
function getDuelHostState() {
  if (online.role === 'host') {
    return buildHostMessage();
  }
  return lastHostState;
}

/* ----------------------------------------------------------------------
   LIVE PROGRESS (what the rival sees of me)
   ---------------------------------------------------------------------- */

// getDuelLiveInfo(): my live progress.
//   phase:  'hiding', 'ready', 'waiting', 'done', 'solving', 'launching' or 'reloading'
//   errors: wrong answers;  shots: shots used;  targetsLeft / targetsTotal;  restarts
function getDuelLiveInfo() {
  if (online.screen === 'hide') {
    if (duelState.myClue) {
      return { phase: 'ready' };
    }
    return { phase: 'hiding' };
  }
  const onlineGame = gameState.online;
  if (!onlineGame || !onlineGame.mode || !gameState.level) {
    return { phase: 'waiting' };
  }
  if (duelState.finishInfo) {
    return { phase: 'done' };
  }
  const level = gameState.level;
  if (onlineGame.mode === 'race') {
    const solving = levelHasVectors(level) && (level.type === 'displacement' || gameState.phase === 'findUnknowns');
    let targetsTotal = 0;
    for (const piece of gameState.pieces) {
      if (piece.kind === 'target') {
        targetsTotal++;
      }
    }
    let shots = 0;
    if (level.shotCount < 900) {
      shots = level.shotCount - gameState.shotsLeft;
    }
    let errors = 0;
    if (gameState.answer) {
      errors = gameState.answer.attemptsUsed;
    }
    let phase = 'launching';
    if (solving) {
      phase = 'solving';
    }
    return { phase: phase, errors: errors, shots: shots, targetsLeft: countTargetsLeft(), targetsTotal: targetsTotal, restarts: duelState.restarts };
  }
  let phase = 'solving';
  if (gameState.mode === 'reloading') {
    phase = 'reloading';
  } else if (gameState.answerRevealed) {
    phase = 'launching';
  }
  return {
    phase: phase,
    errors: duelState.wrongGuesses,
    shots: duelState.reloads * HIDE_AND_SEEK.shotsPerReload + (level.shotCount - gameState.shotsLeft),
  };
}

// describeRivalLive(live): a sentence that describes the live progress of the rival.
function describeRivalLive(live) {
  if (!live) {
    return translate('conectando…', 'connecting…');
  }
  if (live.phase === 'waiting') return translate('esperando', 'waiting');
  if (live.phase === 'hiding') return translate('escondiendo su cerdito…', 'hiding their piglet…');
  if (live.phase === 'ready') return translate('ya escondió su cerdito', 'has hidden their piglet');
  if (live.phase === 'done') return translate('¡terminó!', 'finished!');
  if (live.phase === 'reloading') return translate('recargando tiros…', 'reloading shots…');
  const isHideAndSeek = isDuelMode() && gameState.online && gameState.online.mode === 'hide';
  if (live.phase === 'solving') {
    let text = translate('resolviendo vectores', 'solving vectors');
    if (isHideAndSeek) {
      text = translate('buscando tu cerdito', 'looking for your piglet');
    }
    if (live.errors > 1) {
      text += translate(` · ${live.errors} errores`, ` · ${live.errors} misses`);
    } else if (live.errors) {
      text += translate(` · ${live.errors} error`, ` · ${live.errors} miss`);
    }
    return text;
  }
  if (live.phase === 'launching') {
    if (isHideAndSeek) {
      if (live.shots === 1) {
        return translate(`¡encontró tu cerdito! · ${live.shots} tiro`, `found your piglet! · ${live.shots} shot`);
      }
      return translate(`¡encontró tu cerdito! · ${live.shots} tiros`, `found your piglet! · ${live.shots} shots`);
    }
    let text = translate(
      `lanzando · objetivos ${live.targetsTotal - live.targetsLeft}/${live.targetsTotal}`,
      `launching · targets ${live.targetsTotal - live.targetsLeft}/${live.targetsTotal}`,
    );
    if (live.shots) {
      text += translate(` · ${live.shots} tiros`, ` · ${live.shots} shots`);
    }
    if (live.restarts > 1) {
      text += translate(` · ${live.restarts} reinicios`, ` · ${live.restarts} restarts`);
    } else if (live.restarts) {
      text += translate(` · ${live.restarts} reinicio`, ` · ${live.restarts} restart`);
    }
    return text;
  }
  return '';
}

// countRoundsWonBy(roundWinners, id): how many rounds a player won.
function countRoundsWonBy(roundWinners, id) {
  let count = 0;
  for (const winnerId of roundWinners || []) {
    if (winnerId === id) {
      count++;
    }
  }
  return count;
}

// buildDuelScoreText(hostMessage): "Rounds: you 1 – 0 Ana" (only in races).
function buildDuelScoreText(hostMessage) {
  if (!hostMessage || !hostMessage.rules || hostMessage.rules.duelMode !== 'race') {
    return '';
  }
  const myWins = countRoundsWonBy(hostMessage.roundWinners, myPlayer.id);
  let rivalWins = 0;
  for (const winnerId of hostMessage.roundWinners || []) {
    if (winnerId && winnerId !== myPlayer.id) {
      rivalWins++;
    }
  }
  const rival = getDuelRival();
  let rivalName = 'rival';
  if (rival) {
    rivalName = rival.name;
  }
  return translate(`Rondas: tú ${myWins} – ${rivalWins} ${rivalName}`, `Rounds: you ${myWins} – ${rivalWins} ${rivalName}`);
}

// updateRivalStatusBar(): the bar under the top bar that shows what the rival is doing.
function updateRivalStatusBar() {
  const bar = getElement('rivalStatusBar');
  if (!isDuelMode() || currentView !== 'game' || !gameState.online || !gameState.online.mode) {
    bar.hidden = true;
    return;
  }
  const rival = getDuelRival();
  const scoreText = buildDuelScoreText(getDuelHostState());
  bar.hidden = false;
  let rivalName = translate('Rival', 'Rival');
  if (rival) {
    rivalName = rival.name;
  }
  let status;
  if (rival && !rival.online) {
    status = `<span class="rival-disconnected">${translate('desconectado', 'disconnected')}</span>`;
  } else {
    let live = null;
    if (rival) {
      live = rival.live;
    }
    status = escapeHtml(describeRivalLive(live));
  }
  let html = `<span>⚔ <b>${escapeHtml(rivalName)}</b>: ${status}</span>`;
  if (scoreText) {
    html += `<span class="rival-score">${escapeHtml(scoreText)}</span>`;
  }
  bar.innerHTML = html;
}

// getDuelChipInfo(): the text of the status chip during a duel: { text, warning }.
function getDuelChipInfo() {
  const onlineGame = gameState.online;
  const hostMessage = getDuelHostState();
  const now = performance.now();
  let text;
  if (onlineGame.mode === 'race') {
    let round = 0;
    let rounds = 1;
    if (hostMessage) {
      round = hostMessage.round;
      if (hostMessage.rules) {
        rounds = hostMessage.rules.rounds;
      }
    }
    text = `${translate('Duelo', 'Duel')} · ${translate('Ronda', 'Round')} ${round + 1}/${rounds}`;
  } else {
    text = `${translate('Duelo', 'Duel')} · ${translate('Escondite', 'Hide & seek')}`;
  }
  let warning = false;
  if (duelState.lockedUntil > now) {
    text += ` · ${translate('espera', 'wait')} ${Math.ceil((duelState.lockedUntil - now) / 1000)} s`;
    warning = true;
  }
  if (duelState.reloadingUntil > now) {
    text += ` · ${translate('recarga', 'reload')} ${Math.ceil((duelState.reloadingUntil - now) / 1000)} s`;
    warning = true;
  }
  if (onlineGame.mode === 'race') {
    text += ` · ⏱ ${formatTime((now - duelState.roundStartTime) / 1000)}`;
  }
  return { text: text, warning: warning };
}

/* ----------------------------------------------------------------------
   THE HOST OF THE DUEL
   ---------------------------------------------------------------------- */

// isRoundWithoutWinner(round): true if nobody has won that round yet.
function isRoundWithoutWinner(round) {
  return hostState.roundWinners[round] === undefined || hostState.roundWinners[round] === null;
}

// duelHostReceiveState(id, message): the state of the rival arrives (or null if it left).
function duelHostReceiveState(id, message) {
  if (message === null) {
    const player = hostPlayers[id];
    if (player && id === hostState.guestId) {
      player.online = false;
      showToast(translate(`${player.name} salió del duelo`, `${player.name} left the duel`));
      if (hostState.status === 'lobby') {
        hostState.guestId = null;
        delete hostPlayers[id];
      }
      sendHostState();
      scheduleOnlineRender();
      updateRivalStatusBar();
    }
    return;
  }
  if (message.code !== online.code || hostState.kickedIds.indexOf(id) !== -1) {
    return;
  }
  if (hostState.guestId && id !== hostState.guestId) {
    return; // the duel already has a rival
  }
  if (!hostState.guestId) {
    if (hostState.status !== 'lobby') {
      return;
    }
    hostState.guestId = id;
  }
  let player = hostPlayers[id];
  if (!player) {
    player = createHostPlayerRecord(id, 0);
    hostPlayers[id] = player;
  }
  const isNew = !player.name;
  player.name = cleanPlayerName(message.name, translate('Rival', 'Rival'));
  if (isNew || !player.online) {
    showToast(translate(`${player.name} entró al duelo`, `${player.name} joined the duel`));
    playClickSound();
  }
  player.online = true;
  player.lastMessage = message;
  checkOtherVersion(id, player.name, message.version);
  // the rival reports that it finished the round first
  if (message.finished && hostState.status === 'playing' && message.finished.round === hostState.round && isRoundWithoutWinner(hostState.round)) {
    declareRoundWinner(id);
  }
  // Hide & seek: both piglets are hidden → the search starts
  if (hostState.status === 'hiding' && duelState.myClue && message.clue) {
    startDuelSearch();
  }
  sendHostState();
  scheduleOnlineRender();
  updateRivalStatusBar();
}

// startDuel(): the host starts the duel.
function startDuel() {
  if (!hostState.guestId || !hostState.rules) {
    return;
  }
  if (hostState.rules.duelMode === 'race' && hostState.rules.levels.length === 0) {
    return;
  }
  resetDuelLocalState();
  hostState.round = 0;
  hostState.roundWinners = [];
  hostState.winnerId = null;
  hostState.episode = Date.now();
  if (hostState.rules.duelMode === 'hide') {
    hostState.status = 'hiding';
  } else {
    hostState.status = 'playing';
  }
  sendHostState(true);
  syncDuelPhase(buildHostMessage());
}

// startDuelSearch(): Hide & seek: both piglets are hidden; the search begins.
function startDuelSearch() {
  hostState.status = 'playing';
  hostState.episode = Date.now();
  sendHostState(true);
  syncDuelPhase(buildHostMessage());
}

// declareRoundWinner(winnerId): someone won the current round.
function declareRoundWinner(winnerId) {
  hostState.roundWinners[hostState.round] = winnerId;
  if (hostState.rules.duelMode === 'hide') {
    hostState.status = 'ended';
    hostState.winnerId = winnerId;
  } else {
    // a race is won by winning more than half of the rounds ("best of")
    const roundsNeeded = Math.floor(hostState.rules.rounds / 2) + 1;
    if (countRoundsWonBy(hostState.roundWinners, winnerId) >= roundsNeeded || hostState.round + 1 >= hostState.rules.rounds) {
      hostState.status = 'ended';
      const myWins = countRoundsWonBy(hostState.roundWinners, myPlayer.id);
      const guestWins = countRoundsWonBy(hostState.roundWinners, hostState.guestId);
      if (myWins === guestWins) {
        hostState.winnerId = null; // tie
      } else if (myWins > guestWins) {
        hostState.winnerId = myPlayer.id;
      } else {
        hostState.winnerId = hostState.guestId;
      }
    } else {
      hostState.status = 'roundEnd';
      // the next round starts after 3.8 seconds
      setTimeout(function () {
        if (hostState.status === 'roundEnd') {
          hostState.round++;
          hostState.status = 'playing';
          hostState.episode = Date.now();
          sendHostState(true);
          syncDuelPhase(buildHostMessage());
        }
      }, 3800);
    }
  }
  sendHostState(true);
  syncDuelPhase(buildHostMessage());
}

// startRematch(): back to the duel lobby to play again.
function startRematch() {
  hostState.status = 'lobby';
  hostState.round = 0;
  hostState.roundWinners = [];
  hostState.winnerId = null;
  resetDuelLocalState();
  sendHostState(true);
  syncDuelPhase(buildHostMessage());
}

/* ----------------------------------------------------------------------
   THE GUEST OF THE DUEL
   ---------------------------------------------------------------------- */

// duelGuestReceiveHost(message, isFirst): the rival (guest) receives the host state.
function duelGuestReceiveHost(message, isFirst) {
  online.mode = 'duel';
  if (Array.isArray(message.kickedIds) && message.kickedIds.indexOf(myPlayer.id) !== -1) {
    online.screen = 'kicked';
    leaveOnlineGameScreen();
    renderOnlineScreen();
    closeOnlineConnection();
    return;
  }
  // the duel already has another rival (or it started without me)
  const someoneElseIsRival = message.guestId && message.guestId !== myPlayer.id;
  const startedWithoutMe = isFirst && message.status !== 'lobby' && message.guestId !== myPlayer.id;
  if (someoneElseIsRival || startedWithoutMe) {
    online.screen = 'full';
    renderOnlineScreen();
    closeOnlineConnection();
    return;
  }
  if (online.screen === 'join') {
    online.screen = 'duelWaiting';
  }
  syncDuelPhase(message);
  if (currentView === 'online' && (online.screen === 'duelWaiting' || online.screen === 'hide')) {
    scheduleOnlineRender();
  }
  updateRivalStatusBar();
}

/* ----------------------------------------------------------------------
   REACTING TO PHASE CHANGES (host and guest)
   ---------------------------------------------------------------------- */

// playWinOrLoseSound(won): the win sound or the wrong sound.
function playWinOrLoseSound(won) {
  if (won) {
    playWinSound();
  } else {
    playWrongSound();
  }
}

// syncDuelPhase(hostMessage): reacts when the host state changes of phase.
function syncDuelPhase(hostMessage) {
  if (!hostMessage || !isDuelMode()) {
    return;
  }
  const key = `${hostMessage.status}|${hostMessage.round}|${hostMessage.episode}`;
  const changed = key !== duelState.phaseKey;
  duelState.phaseKey = key;
  if (hostMessage.status === 'lobby') {
    if (changed) {
      exitDuelGame();
      resetDuelLocalState();
      if (online.role === 'host') {
        online.screen = 'duelLobby';
      } else {
        online.screen = 'duelWaiting';
      }
      showView('online');
      renderOnlineScreen();
    }
  } else if (hostMessage.status === 'hiding') {
    if (changed) {
      exitDuelGame();
      resetDuelLocalState();
      online.screen = 'hide';
      showView('online');
      renderOnlineScreen();
      sendMyState(true);
    }
  } else if (hostMessage.status === 'playing') {
    if (changed) {
      getElement('levelEndOverlay').hidden = true;
      duelState.roundOver = true;
      showCountdown(function () {
        beginDuelRound(getDuelHostState());
      });
    }
  } else if (hostMessage.status === 'roundEnd') {
    if (changed) {
      showDuelRoundEnd(hostMessage);
    }
  } else if (hostMessage.status === 'ended') {
    if (changed) {
      exitDuelGame();
      online.screen = 'duelEnd';
      showView('online');
      renderOnlineScreen();
      playWinOrLoseSound(hostMessage.winnerId === myPlayer.id);
    }
  }
  updateRivalStatusBar();
}

// beginDuelRound(hostMessage): a round starts (after the countdown).
function beginDuelRound(hostMessage) {
  if (!hostMessage || hostMessage.status !== 'playing') {
    return;
  }
  let level;
  if (hostMessage.rules.duelMode === 'race') {
    const levels = hostMessage.rules.levels;
    // each round uses the next level (they repeat if there are fewer levels than rounds)
    level = levelReferenceToLevel(levels[hostMessage.round % levels.length], hostMessage.round);
    if (!level) {
      return;
    }
  } else {
    const rival = getDuelRival();
    if (!rival || !rival.clue) {
      showToast(translate('No llegaron las pistas del rival.', 'The rival’s clues didn’t arrive.'));
      return;
    }
    level = buildSearchLevel(rival.clue);
  }
  level.id = '__duel';
  if (!gameState.online) {
    online.savedScore = gameState.score;
  }
  gameState.score = 0;
  duelState.finishInfo = null;
  duelState.wrongGuesses = 0;
  duelState.restarts = 0;
  duelState.reloads = 0;
  duelState.lockedUntil = 0;
  duelState.reloadingUntil = 0;
  duelState.roundOver = false;
  duelState.roundStartTime = performance.now();
  gameState.online = {
    mode: hostMessage.rules.duelMode,
    levelIndex: 0,
    levels: [level],
    rules: { timeLimit: 0, practiceAllowed: false, showLeaderboard: false, levels: [] },
    finished: false,
    deadline: 0,
    levelStartTime: 0,
    lastChipText: '',
    endedLevelIndex: -1,
  };
  online.screen = 'game';
  loadOnlineLevel(0);
}

// showDuelRoundEnd(hostMessage): the card "You won round 1!" between rounds.
function showDuelRoundEnd(hostMessage) {
  duelState.roundOver = true;
  if (currentView !== 'game') {
    return;
  }
  const winnerId = hostMessage.roundWinners[hostMessage.round];
  const rival = getDuelRival();
  gameState.mode = 'ended';
  gameState.projectile = null;
  gameState.endTimer = 0;
  const roundNumber = hostMessage.round + 1;
  if (winnerId === myPlayer.id) {
    getElement('levelEndTitle').textContent = translate(`¡Ganaste la ronda ${roundNumber}!`, `You won round ${roundNumber}!`);
  } else {
    let rivalName = translate('Tu rival', 'Your rival');
    if (rival) {
      rivalName = rival.name;
    }
    getElement('levelEndTitle').textContent = translate(`${rivalName} ganó la ronda ${roundNumber}`, `${rivalName} won round ${roundNumber}`);
  }
  getElement('levelEndStars').innerHTML = '';
  getElement('levelEndText').textContent =
    buildDuelScoreText(hostMessage) + ' · ' + translate('La siguiente ronda empieza en un momento…', 'The next round starts in a moment…');
  getElement('levelEndRetryButton').hidden = true;
  setNextButton(null, null);
  getElement('levelEndOverlay').hidden = false;
  updateLaunchPanel();
  playWinOrLoseSound(winnerId === myPlayer.id);
}

// exitDuelGame(): leaves the game screen of the duel (keeps the connection).
function exitDuelGame() {
  if (gameState.online && gameState.online.mode) {
    gameState.online = null;
    gameState.score = online.savedScore;
    getElement('onlineStatusChip').hidden = true;
    getElement('rivalStatusBar').hidden = true;
    getElement('levelEndOverlay').hidden = true;
    getElement('levelEndRetryButton').hidden = false;
    const practiceLabel = getElement('practiceModeCheckbox').closest('label');
    if (practiceLabel) {
      practiceLabel.hidden = false;
    }
  }
}

// reportDuelFinished(): tells that I finished (knocked down the piglet or completed the level).
function reportDuelFinished() {
  const milliseconds = Math.round(performance.now() - duelState.roundStartTime);
  if (online.role === 'host') {
    duelState.finishInfo = { round: hostState.round, milliseconds: milliseconds };
    if (hostState.status === 'playing' && isRoundWithoutWinner(hostState.round)) {
      declareRoundWinner(myPlayer.id);
    } else {
      sendHostState(true);
    }
  } else {
    let round = 0;
    if (lastHostState) {
      round = lastHostState.round;
    }
    duelState.finishInfo = { round: round, milliseconds: milliseconds };
    sendPlayerState(true);
  }
}

// duelLevelEnd(result): the end of an attempt in a duel.
//   won: tell the host;  failed in a race: the level restarts;  failed in Hide & seek:
//   wait 5 s and reload the shots.
function duelLevelEnd(result) {
  const onlineGame = gameState.online;
  if (result === 'won') {
    if (onlineGame.endedLevelIndex === 0) {
      return;
    }
    onlineGame.endedLevelIndex = 0;
    gameState.mode = 'ended';
    gameState.projectile = null;
    reportDuelFinished();
    if (duelState.roundOver && currentView !== 'game') {
      return;
    }
    if (onlineGame.mode === 'hide') {
      getElement('levelEndTitle').textContent = translate('¡Le diste al cerdito!', 'You hit the piglet!');
    } else {
      getElement('levelEndTitle').textContent = translate('¡Nivel completado!', 'Level complete!');
    }
    getElement('levelEndStars').innerHTML = '';
    const timeText = formatTime((performance.now() - duelState.roundStartTime) / 1000);
    getElement('levelEndText').textContent = translate(`Tiempo: ${timeText}. Esperando el resultado…`, `Time: ${timeText}. Waiting for the result…`);
    getElement('levelEndRetryButton').hidden = true;
    setNextButton(null, null);
    getElement('levelEndOverlay').hidden = false;
    playWinSound();
    return;
  }
  if (onlineGame.mode === 'race') {
    gameState.mode = 'ended';
    gameState.projectile = null;
    duelState.restarts++;
    playWrongSound();
    showToast(translate('¡Otra vez! El nivel se reinicia.', 'Again! The level restarts.'));
    sendMyState();
    setTimeout(function () {
      if (gameState.online === onlineGame && !duelState.roundOver && !duelState.finishInfo) {
        loadOnlineLevel(0);
      }
    }, 1200);
    return;
  }
  // Hide & seek: no shots left → wait 5 s and reload 3 shots
  gameState.mode = 'reloading';
  gameState.projectile = null;
  duelState.reloadingUntil = performance.now() + HIDE_AND_SEEK.reloadWait;
  addFloatingText(1, Math.max(3, gameState.level.launchVariables.launchHeight.start + 2), translate('Recargando…', 'Reloading…'), COLORS.accent);
  playWrongSound();
  sendMyState();
  updateLaunchPanel();
  clearTimeout(duelState.reloadTimer);
  duelState.reloadTimer = setTimeout(function () {
    if (gameState.online !== onlineGame || duelState.finishInfo) {
      return;
    }
    duelState.reloads++;
    gameState.shotsLeft = gameState.level.shotCount;
    gameState.mode = 'aiming';
    duelState.reloadingUntil = 0;
    updateHud();
    updateLaunchPanel();
    sendMyState();
  }, HIDE_AND_SEEK.reloadWait);
}

/* ----------------------------------------------------------------------
   HIDE & SEEK: THE CLUES AND THE SEARCH LEVEL
   ---------------------------------------------------------------------- */

// roundToOneDecimal(value): 3.14159 → 3.1
function roundToOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

// directionForClue(dx, dy): the direction of a clue vector with these components.
function directionForClue(dx, dy) {
  if (Math.abs(dy) < 0.05) {
    if (dx >= 0) {
      return 'right';
    }
    return 'left';
  }
  if (Math.abs(dx) < 0.05) {
    if (dy > 0) {
      return 'up';
    }
    return 'down';
  }
  let vertical = 'down';
  if (dy > 0) {
    vertical = 'up';
  }
  let horizontal = 'Left';
  if (dx > 0) {
    horizontal = 'Right';
  }
  return vertical + horizontal;
}

// makeClueVector(dx, dy): a clue vector: length rounded to 0.1 m and angle to 1°.
function makeClueVector(dx, dy) {
  const direction = directionForClue(dx, dy);
  let angle;
  if (isStraightDirection(direction)) {
    if (direction === 'right' || direction === 'left') {
      angle = 0;
    } else {
      angle = 90;
    }
  } else {
    angle = Math.round((Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI);
  }
  return { distance: roundToOneDecimal(Math.hypot(dx, dy)), angle: angle, direction: direction };
}

// generateHidingClue(hideX, hideY, difficulty): creates the clue vectors that go from the
// launcher (0, 0) to the hiding spot.
//   difficulty 1: a single vector.  difficulty 2: 2 or 3 chained vectors.
// The values are rounded (0.1 m and 1°), so the piglet is placed at the exact sum of the
// rounded vectors (finalX, finalY).
function generateHidingClue(hideX, hideY, difficulty) {
  let points = [{ x: 0, y: 0 }];
  if (difficulty >= 2) {
    let vectorCount = 3;
    if (Math.random() < 0.5) {
      vectorCount = 2;
    }
    // random middle points; every vector must be at least 4 m long (60 tries)
    for (let attempt = 0; attempt < 60; attempt++) {
      points = [{ x: 0, y: 0 }];
      for (let index = 1; index < vectorCount; index++) {
        points.push({ x: Math.round((3 + Math.random() * 39) * 2) / 2, y: Math.round(Math.random() * 16 * 2) / 2 });
      }
      points.push({ x: hideX, y: hideY });
      let allLongEnough = true;
      for (let index = 1; index < points.length; index++) {
        if (Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y) < 4) {
          allLongEnough = false;
        }
      }
      if (allLongEnough) {
        break;
      }
    }
  } else {
    points.push({ x: hideX, y: hideY });
  }
  const vectors = [];
  for (let index = 1; index < points.length; index++) {
    vectors.push(makeClueVector(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y));
  }
  // the real final position = sum of the rounded vectors
  let finalX = 0;
  let finalY = 0;
  for (const clueVector of vectors) {
    const values = calculateVectorValues(cleanVector(clueVector));
    finalX += values.dx;
    finalY += values.dy;
  }
  return { vectors: vectors, finalX: roundToTwoDecimals(finalX), finalY: roundToTwoDecimals(Math.max(0, finalY)), difficulty: difficulty };
}

// buildSearchLevel(clue): the level where the player looks for the rival's piglet.
function buildSearchLevel(clue) {
  const level = cleanLevel({
    name: translate('Cerdito del rival', 'Rival’s piglet'),
    type: 'mixed',
    worldWidth: HIDE_AND_SEEK.worldWidth,
    shotCount: HIDE_AND_SEEK.shotsPerReload,
    showGrid: false,
    terrain: [],
    pieces: [],
  });
  level.launchVariables = createDefaultLaunchVariables();
  const vectors = [];
  for (const clueVector of clue.vectors) {
    let visibility = createVisibility('distance angle direction');
    if (isStraightDirection(clueVector.direction)) {
      visibility = createVisibility('distance direction');
    }
    vectors.push({ distance: clueVector.distance, angle: clueVector.angle, direction: clueVector.direction, visibility: visibility });
  }
  // showPath: true → the path is animated like in the normal levels
  level.vectorPuzzle = cleanVectorPuzzle(
    { startX: 3, startY: 0, showPath: true, hideScale: true, attempts: 6, vectors: vectors, resultant: { visibility: createVisibility('') } },
    HIDE_AND_SEEK.worldWidth,
  );
  // the vectors start at the launcher: the origin (0, 0)
  level.vectorPuzzle.startX = 0;
  level.vectorPuzzle.startY = 0;
  return level;
}

// getHideTolerance(): the error accepted in the coordinates: 3% of the distance (at least 0.5 m).
function getHideTolerance() {
  const endPoint = gameState.resultant.endPoint;
  return Math.max(0.5, 0.03 * Math.hypot(endPoint.x, endPoint.y));
}

// hideAndSeekRenderPanels(): the panel of the search phase (it replaces the normal one).
function hideAndSeekRenderPanels() {
  const puzzle = gameState.level.vectorPuzzle;
  const resultant = gameState.resultant;
  const found = gameState.answerRevealed;
  let html = `<p>${translate(
    'Tu rival escondió su cerdito. Estos vectores empiezan en <b>el lanzador, el origen (0, 0)</b>, y van uno tras otro hasta el escondite.',
    'Your rival hid their piglet. These vectors start at <b>the launcher, the origin (0, 0)</b>, and follow one after another to the hiding spot.',
  )}</p><div class="vector-list">`;
  for (let index = 0; index < puzzle.vectors.length; index++) {
    const values = resultant.vectorValues[index];
    const name = getVectorName(index);
    let angleText = '';
    if (!isStraightDirection(values.direction)) {
      angleText = ` · θ = ${formatNice(values.angle)}°`;
    }
    html += `<div class="vector-row"><b>${name}</b> <span class="monospace">|${name}| = ${formatNice(values.distance)} m${angleText} · ${translate('dirección', 'direction')}: ${getDirectionNameLowercase(values.direction)}</span></div>`;
  }
  html += `</div><p class="hint">${translate('Ángulos desde la horizontal. Suma las componentes:', 'Angles from the horizontal. Add up the components:')} ${mathInline('x = Δx₁ + Δx₂ + …')}, ${mathInline('y = Δy₁ + Δy₂ + …')}, ${translate('con', 'with')} ${mathInline('Δx = ±|V| cos θ')} ${translate('y', 'and')} ${mathInline('Δy = ±|V| sin θ')} ${translate('(el signo depende de la dirección).', '(the sign depends on the direction).')}</p>`;
  getElement('knownDataList').innerHTML = html;
  getElement('replayPathButton').hidden = found;
  getElement('answerTitle').textContent = translate('Coordenadas del cerdito', 'Piglet coordinates');
  if (!found) {
    getElement('answerForm').hidden = false;
    getElement('solutionPanel').hidden = true;
    if (!getElement('hideAnswerXInput')) {
      getElement('answerFields').innerHTML =
        `<label class="form-field"><span>x (m)</span><input type="number" id="hideAnswerXInput" step="any" inputmode="decimal"></label>
        <label class="form-field"><span>y (m)</span><input type="number" id="hideAnswerYInput" step="any" inputmode="decimal"></label>`;
    }
    const lockLeft = duelState.lockedUntil - performance.now();
    if (lockLeft > 0) {
      getElement('attemptsInfo').textContent = translate(
        `Incorrecto. Espera ${Math.ceil(lockLeft / 1000)} s para volver a intentar.`,
        `Wrong. Wait ${Math.ceil(lockLeft / 1000)} s to try again.`,
      );
    } else {
      getElement('attemptsInfo').textContent = translate(
        `Intentos ilimitados · si fallas, esperas 5 s · se acepta ±${formatNice(getHideTolerance())} m`,
        `Unlimited attempts · if you miss, wait 5 s · ±${formatNice(getHideTolerance())} m accepted`,
      );
    }
    getElement('checkAnswerButton').disabled = lockLeft > 0;
  } else {
    getElement('answerForm').hidden = true;
    getElement('solutionPanel').hidden = false;
    const allValues = resultant.vectorValues;
    let solution = `<div class="solution-subtitle">${translate('¡Encontrado!', 'Found!')}</div>`;
    for (let index = 0; index < allValues.length; index++) {
      solution += componentEquations(index, allValues[index]);
    }
    solution += sumEquation(equationLabel('x'), 'dx', allValues, resultant.endPoint.x);
    solution += sumEquation(equationLabel('y'), 'dy', allValues, resultant.endPoint.y);
    solution += `<div class="solution-next">${translate(
      `Ahora derríbalo: tienes ${HIDE_AND_SEEK.shotsPerReload} tiros. Si fallas los ${HIDE_AND_SEEK.shotsPerReload}, esperas 5 s y recargas.`,
      `Now knock it down: you have ${HIDE_AND_SEEK.shotsPerReload} shots. If you miss all ${HIDE_AND_SEEK.shotsPerReload}, wait 5 s and reload.`,
    )}</div>`;
    getElement('solutionPanel').innerHTML = solution;
  }
}

// hideAndSeekCheckAnswer(): checks the coordinates typed by the player.
function hideAndSeekCheckAnswer() {
  if (gameState.phase !== 'findUnknowns' || performance.now() < duelState.lockedUntil) {
    return;
  }
  const x = readNumberFromBox(getElement('hideAnswerXInput'));
  const y = readNumberFromBox(getElement('hideAnswerYInput'));
  if (!isFinite(x) || !isFinite(y)) {
    getElement('answerFeedback').innerHTML = `<span class="feedback-wrong">${translate('Escribe x e y.', 'Type x and y.')}</span>`;
    return;
  }
  const endPoint = gameState.resultant.endPoint;
  const tolerance = getHideTolerance();
  const xIsCorrect = Math.abs(x - endPoint.x) <= tolerance;
  const yIsCorrect = Math.abs(y - endPoint.y) <= tolerance;
  if (xIsCorrect && yIsCorrect) {
    gameState.answer.solved = true;
    gameState.answer.attemptsUsed = duelState.wrongGuesses + 1;
    getElement('answerFeedback').innerHTML = `<span class="feedback-correct">✓ ${translate('¡Coordenadas correctas!', 'Correct coordinates!')}</span>`;
    playCorrectSound();
    revealAnswer();
    sendMyState(true);
    return;
  }
  duelState.wrongGuesses++;
  duelState.lockedUntil = performance.now() + HIDE_AND_SEEK.wrongGuessWait;
  playWrongSound();
  let hints = '';
  if (xIsCorrect) {
    hints += '<span class="feedback-correct">✓ x</span>';
  } else {
    hints += '<span class="feedback-wrong">✗ x</span>';
  }
  hints += ' ';
  if (yIsCorrect) {
    hints += '<span class="feedback-correct">✓ y</span>';
  } else {
    hints += '<span class="feedback-wrong">✗ y</span>';
  }
  getElement('answerFeedback').innerHTML = hints;
  hideAndSeekRenderPanels();
  sendMyState();
  // refresh the panel every 250 ms to show the countdown of the wait
  function refreshWhileLocked() {
    if (!gameState.online || gameState.answerRevealed) {
      return;
    }
    hideAndSeekRenderPanels();
    if (performance.now() < duelState.lockedUntil) {
      setTimeout(refreshWhileLocked, 250);
    }
  }
  setTimeout(refreshWhileLocked, 250);
}

/* ----------------------------------------------------------------------
   THE MAP TO HIDE THE PIGLET
   ---------------------------------------------------------------------- */

// hidingMapLayout: how the map is drawn (needed to convert a click into meters).
let hidingMapLayout = null;

// drawHidingMap(): draws the map where the piglet is hidden.
function drawHidingMap() {
  const mapCanvas = getElement('hidingMapCanvas');
  if (!mapCanvas) {
    return;
  }
  const width = mapCanvas.clientWidth;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  // the exact height so the whole map fits
  const height = Math.round(((width - 48) / (HIDE_AND_SEEK.worldWidth + 1)) * HIDE_AND_SEEK.mapHeight + 38);
  mapCanvas.style.height = height + 'px';
  mapCanvas.width = Math.round(width * ratio);
  mapCanvas.height = Math.round(height * ratio);
  const context = mapCanvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  // margins: left 38 px (for the numbers), bottom 28 px, right 10 px
  const leftMargin = 38;
  const bottomMargin = 28;
  const rightMargin = 10;
  const scale = (width - leftMargin - rightMargin) / (HIDE_AND_SEEK.worldWidth + 1);
  function mapX(x) {
    return leftMargin + x * scale;
  }
  function mapY(y) {
    return height - bottomMargin - y * scale;
  }
  hidingMapLayout = { leftMargin: leftMargin, bottomMargin: bottomMargin, height: height, scale: scale };

  context.fillStyle = COLORS.paper;
  context.fillRect(0, 0, width, height);
  // the allowed zone, in light green
  context.fillStyle = 'rgba(147,194,62,.10)';
  context.fillRect(
    mapX(HIDE_AND_SEEK.minimumX),
    mapY(HIDE_AND_SEEK.maximumY),
    (HIDE_AND_SEEK.maximumX - HIDE_AND_SEEK.minimumX) * scale,
    HIDE_AND_SEEK.maximumY * scale,
  );
  // the grid: one line per meter, darker every 5 m
  for (let x = 0; x <= HIDE_AND_SEEK.worldWidth; x++) {
    if (x % 5) {
      context.strokeStyle = COLORS.grid;
    } else {
      context.strokeStyle = COLORS.gridMajor;
    }
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(mapX(x) + 0.5, mapY(0));
    context.lineTo(mapX(x) + 0.5, mapY(HIDE_AND_SEEK.mapHeight));
    context.stroke();
  }
  for (let y = 0; y <= HIDE_AND_SEEK.mapHeight; y++) {
    if (y % 5) {
      context.strokeStyle = COLORS.grid;
    } else {
      context.strokeStyle = COLORS.gridMajor;
    }
    context.beginPath();
    context.moveTo(mapX(0), mapY(y) + 0.5);
    context.lineTo(mapX(HIDE_AND_SEEK.worldWidth), mapY(y) + 0.5);
    context.stroke();
  }
  // the numbers of the axes
  context.fillStyle = COLORS.inkSoft;
  context.font = "11px 'IBM Plex Mono', monospace";
  context.textAlign = 'center';
  context.textBaseline = 'top';
  for (let x = 0; x <= HIDE_AND_SEEK.worldWidth; x += 5) {
    context.fillText(String(x), mapX(x), mapY(0) + 6);
  }
  context.textAlign = 'right';
  context.textBaseline = 'middle';
  for (let y = 5; y <= HIDE_AND_SEEK.mapHeight; y += 5) {
    context.fillText(y + ' m', mapX(0) - 4, mapY(y));
  }
  // ground, launcher and the origin
  context.fillStyle = COLORS.earth;
  context.fillRect(mapX(0) - 6, mapY(0), (HIDE_AND_SEEK.worldWidth + 1) * scale + 6, 3);
  context.fillStyle = COLORS.ink;
  context.fillRect(mapX(0) - 5, mapY(1.4), 10, 1.4 * scale);
  context.fillStyle = COLORS.accent;
  context.beginPath();
  context.arc(mapX(0), mapY(1.6), 6, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = COLORS.ink;
  context.textAlign = 'left';
  context.textBaseline = 'bottom';
  context.fillText('(0, 0)', mapX(0) + 8, mapY(0) - 2);
  // the piglet at the chosen spot (or at the final position of the clue)
  let spot = duelState.chosenSpot;
  if (duelState.myClue) {
    spot = { x: duelState.myClue.finalX, y: duelState.myClue.finalY };
  }
  if (spot) {
    if (spot.y > 0.05) {
      context.fillStyle = COLORS.earth;
      context.fillRect(mapX(spot.x) - 0.8 * scale, mapY(spot.y), 1.6 * scale, spot.y * scale);
    }
    const radius = Math.max(8, 0.6 * scale);
    context.fillStyle = COLORS.target;
    context.strokeStyle = COLORS.targetDark;
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(mapX(spot.x), mapY(spot.y) - radius, radius * 1.1, radius * 0.95, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = COLORS.ink;
    context.beginPath();
    context.arc(mapX(spot.x) - radius * 0.35, mapY(spot.y) - radius * 1.15, radius * 0.15, 0, 7);
    context.arc(mapX(spot.x) + radius * 0.35, mapY(spot.y) - radius * 1.15, radius * 0.15, 0, 7);
    context.fill();
    context.textAlign = 'center';
    context.textBaseline = 'bottom';
    context.font = "600 12px 'IBM Plex Mono', monospace";
    context.fillText(`(${formatNice(spot.x)}, ${formatNice(spot.y)})`, mapX(spot.x), mapY(spot.y) - radius * 2.2);
  }
}

// setChosenSpot(x, y): chooses the hiding spot (snapped to 0.5 m and inside the allowed zone).
function setChosenSpot(x, y) {
  duelState.chosenSpot = {
    x: clampNumber(Math.round(x * 2) / 2, HIDE_AND_SEEK.minimumX, HIDE_AND_SEEK.maximumX),
    y: clampNumber(Math.round(y * 2) / 2, 0, HIDE_AND_SEEK.maximumY),
  };
}

// handleHidingMapClick(event): a click (or tap) on the map chooses the hiding spot.
function handleHidingMapClick(event) {
  if (duelState.myClue) {
    return; // already hidden
  }
  const mapCanvas = getElement('hidingMapCanvas');
  const layout = hidingMapLayout;
  if (!layout) {
    return;
  }
  const box = mapCanvas.getBoundingClientRect();
  const x = (event.clientX - box.left - layout.leftMargin) / layout.scale;
  const y = (layout.height - layout.bottomMargin - (event.clientY - box.top)) / layout.scale;
  setChosenSpot(x, y);
  playClickSound();
  drawHidingMap();
  const hideButton = getElement('hideHereButton');
  if (hideButton) {
    hideButton.disabled = false;
  }
  if (getElement('hideSpotXInput')) {
    getElement('hideSpotXInput').value = duelState.chosenSpot.x;
    getElement('hideSpotYInput').value = duelState.chosenSpot.y;
  }
}

// confirmHidingSpot(): the "Hide here" button: creates the clue and sends it.
function confirmHidingSpot() {
  if (!duelState.chosenSpot || duelState.myClue) {
    return;
  }
  const hostMessage = getDuelHostState();
  let difficulty = 1;
  if (hostMessage && hostMessage.rules) {
    difficulty = hostMessage.rules.difficulty;
  }
  duelState.myClue = generateHidingClue(duelState.chosenSpot.x, duelState.chosenSpot.y, difficulty);
  playCorrectSound();
  sendMyState(true);
  if (online.role === 'host') {
    const rival = getDuelRival();
    if (hostState.status === 'hiding' && rival && rival.clue) {
      startDuelSearch();
    }
  }
  renderOnlineScreen();
}

/* ----------------------------------------------------------------------
   THE DUEL SCREENS
   ---------------------------------------------------------------------- */

// buildDuelRulesSummary(rules): a short list with the rules of the duel.
function buildDuelRulesSummary(rules) {
  if (!rules) {
    return '';
  }
  if (rules.duelMode === 'hide') {
    let difficultyText = translate('1 · un vector', '1 · one vector');
    if (rules.difficulty === 2) {
      difficultyText = translate('2 · varios vectores', '2 · several vectors');
    }
    return `<ul class="summary-list"><li>${translate('Modo', 'Mode')}: <b>${translate('Escondite', 'Hide & seek')}</b></li><li>${translate('Dificultad', 'Difficulty')}: <b>${difficultyText}</b></li>
    <li>${translate('Errores ilimitados (espera de 5 s) · 3 tiros por recarga', 'Unlimited misses (5 s wait) · 3 shots per reload')}</li></ul>`;
  }
  let roundsText = translate(`al mejor de ${rules.rounds}`, `best of ${rules.rounds}`);
  if (rules.rounds === 1) {
    roundsText = translate('1 ronda', '1 round');
  }
  let html = `<ul class="summary-list"><li>${translate('Modo', 'Mode')}: <b>${translate('Carrera', 'Race')}</b></li><li>${translate('Rondas', 'Rounds')}: <b>${roundsText}</b></li>
    <li>${translate('Si fallas, el nivel se reinicia al instante', 'If you fail, the level restarts instantly')}</li></ul>`;
  const levels = rules.levels || [];
  if (levels.length > 0) {
    html += '<div class="level-chips">';
    for (let index = 0; index < levels.length; index++) {
      const label = getLevelReferenceLabel(levels[index]);
      html += `<span class="${getChipClass(label)}">${translate('R', 'R')}${index + 1} · ${escapeHtml(label.name)}</span>`;
    }
    html += '</div>';
  } else {
    html += `<p class="hint">${translate('Aún no hay niveles elegidos.', 'No levels picked yet.')}</p>`;
  }
  return html;
}

// getChipClass(label): the CSS class that colors a level label (chip-launch, chip-mixed...).
function getChipClass(label) {
  if (!label.typeName) {
    return '';
  }
  return 'chip-' + label.typeName;
}

// renderDuelScreen(): draws the duel screens (lobby, waiting, hiding, end, full).
function renderDuelScreen() {
  const content = getElement('onlineScreenContent');
  const screen = online.screen;
  const hostMessage = getDuelHostState();
  const rival = getDuelRival();
  let copyButton = '';
  if (online.role === 'host') {
    copyButton = `<button class="button button-small" id="copyCodeButton" type="button">${translate('Copiar', 'Copy')}</button>`;
  }
  const codeBox = `<div class="code-box"><div><small>${translate('Código', 'Code')}</small><b>${escapeHtml(online.code)}</b></div>${copyButton}</div>`;
  const leaveButton = `<button class="menu-button menu-button-inline" id="duelLeaveButton" type="button">${translate('← Salir', '← Leave')}</button>`;
  let rivalName = translate('Rival', 'Rival');
  if (rival) {
    rivalName = rival.name;
  }

  if (screen === 'full') {
    content.innerHTML = `<section class="online-card online-card-narrow"><h2>${translate('El duelo está lleno', 'The duel is full')}</h2><p>${translate(
      'Ese duelo ya tiene dos jugadores. Pide un código nuevo.',
      'That duel already has two players. Ask for a new code.',
    )}</p><button class="button" id="duelHomeButton" type="button">${translate('Volver al inicio', 'Back to home')}</button></section>`;
    getElement('duelHomeButton').addEventListener('click', function () {
      leaveOnline(true);
    });
    return;
  }

  if (screen === 'duelLobby') {
    const rules = hostState.rules;
    const isRace = rules.duelMode === 'race';
    // why the duel can not start yet
    let reason = '';
    if (!hostState.guestId) {
      reason = translate('Espera a que entre tu rival con el código.', 'Wait for your rival to join with the code.');
    } else if (isRace && rules.levels.length === 0) {
      reason = translate('Elige al menos un nivel.', 'Pick at least one level.');
    }
    let rivalHtml;
    if (hostState.guestId && rival) {
      rivalHtml = `<span class="versus-name">${escapeHtml(rival.name)} <button type="button" class="remove-player-button" id="duelKickButton" title="${translate('Expulsar', 'Remove')}">×</button></span>`;
    } else {
      rivalHtml = `<span class="versus-name versus-name-waiting"><span class="waiting-dots">${translate('Esperando rival', 'Waiting for rival')}</span></span>`;
    }
    let modeOptions;
    if (isRace) {
      let roundButtons = '';
      const roundChoices = [1, 3, 5];
      for (const rounds of roundChoices) {
        let label = translate(`Mejor de ${rounds}`, `Best of ${rounds}`);
        if (rounds === 1) {
          label = '1';
        }
        roundButtons += `<button type="button" data-rounds="${rounds}" aria-pressed="${rules.rounds === rounds}">${label}</button>`;
      }
      modeOptions = `<div class="settings-row"><span class="settings-label">${translate('Rondas', 'Rounds')}</span><div class="segmented-buttons segmented-buttons-small" role="group">${roundButtons}</div></div>
          <button class="button button-big" id="duelPickLevelsButton" type="button">${translate('Elegir niveles', 'Pick levels')}</button>`;
    } else {
      let difficultyHint = translate(
        'El juego da un solo vector desde el lanzador: su magnitud y su ángulo.',
        'The game gives a single vector from the launcher: its length and angle.',
      );
      if (rules.difficulty === 2) {
        difficultyHint = translate(
          'El juego genera de 2 a 3 vectores encadenados con magnitud, ángulo y dirección.',
          'The game makes 2 to 3 chained vectors with length, angle and direction.',
        );
      }
      modeOptions = `<div class="settings-row"><span class="settings-label">${translate('Dificultad', 'Difficulty')}</span><div class="segmented-buttons segmented-buttons-small" role="group">
            <button type="button" data-difficulty="1" aria-pressed="${rules.difficulty === 1}">${translate('1 · un vector', '1 · one vector')}</button>
            <button type="button" data-difficulty="2" aria-pressed="${rules.difficulty === 2}">${translate('2 · varios vectores', '2 · several vectors')}</button></div>
            <small class="hint">${difficultyHint}</small></div>`;
    }
    let startDisabled = '';
    let reasonHtml = '';
    if (reason) {
      startDisabled = 'disabled';
      reasonHtml = `<p class="hint">${reason}</p>`;
    }
    content.innerHTML = `<div class="online-header">${leaveButton}<h2>${translate('Duelo 1 vs 1', '1 vs 1 duel')}</h2>${codeBox}</div>
    <div class="online-grid">
      <section class="online-card"><h3>${translate('Jugadores', 'Players')}</h3>
        <label class="form-field"><span>${translate('Tu nombre', 'Your name')}</span><input type="text" id="duelNameInput" maxlength="16" value="${escapeHtml(myPlayer.name)}" placeholder="${translate('Anfitrión', 'Host')}"></label>
        <div class="versus-row"><span class="versus-name versus-name-me">${escapeHtml(myPlayer.name || translate('Tú', 'You'))}</span><span class="versus-label">VS</span>
          ${rivalHtml}</div>
        <p class="hint">${translate(
          `Tu rival entra con <b>Online → Unirse a un juego</b> y el código <b>${escapeHtml(online.code)}</b>.`,
          `Your rival joins with <b>Online → Join a game</b> and the code <b>${escapeHtml(online.code)}</b>.`,
        )}</p>
      </section>
      <section class="online-card"><h3>${translate('Modo de juego', 'Game mode')}</h3>
        <div class="duel-mode-grid">
          <button type="button" class="duel-mode-button" data-duel-mode="race" aria-pressed="${isRace}"><b>${translate('Carrera', 'Race')}</b><small>${translate(
            'El mismo nivel para los dos: gana quien lo complete primero.',
            'Same level for both: whoever completes it first wins.',
          )}</small></button>
          <button type="button" class="duel-mode-button" data-duel-mode="hide" aria-pressed="${!isRace}"><b>${translate('Escondite', 'Hide & seek')}</b><small>${translate(
            'Cada uno esconde un cerdito; encuentra el del rival con vectores y derríbalo.',
            'Each one hides a piglet; find your rival’s with vectors and knock it down.',
          )}</small></button>
        </div>
        ${modeOptions}
        ${buildDuelRulesSummary(rules)}
        <button class="button button-go" id="startDuelButton" type="button" ${startDisabled}>${translate('Iniciar duelo', 'Start duel')}</button>
        ${reasonHtml}
      </section>
    </div>`;
    const nameInput = getElement('duelNameInput');
    nameInput.addEventListener('input', function () {
      myPlayer.name = nameInput.value.trim().slice(0, 16);
      try {
        localStorage.setItem(PLAYER_NAME_STORAGE_KEY, myPlayer.name);
      } catch (error) {
        // nothing to do
      }
      sendHostState();
    });
    const modeButtons = content.querySelectorAll('[data-duel-mode]');
    for (const button of modeButtons) {
      button.addEventListener('click', function () {
        hostState.rules = Object.assign({}, hostState.rules, { duelMode: button.dataset.duelMode });
        sendHostState(true);
        renderOnlineScreen();
      });
    }
    const roundButtons = content.querySelectorAll('[data-rounds]');
    for (const button of roundButtons) {
      button.addEventListener('click', function () {
        hostState.rules = Object.assign({}, hostState.rules, { rounds: Number(button.dataset.rounds) });
        sendHostState(true);
        renderOnlineScreen();
      });
    }
    const difficultyButtons = content.querySelectorAll('[data-difficulty]');
    for (const button of difficultyButtons) {
      button.addEventListener('click', function () {
        hostState.rules = Object.assign({}, hostState.rules, { difficulty: Number(button.dataset.difficulty) });
        sendHostState(true);
        renderOnlineScreen();
      });
    }
    listenIfExists('duelPickLevelsButton', 'click', function () {
      openLevelPicker(true);
    });
    listenIfExists('duelKickButton', 'click', function () {
      const guestId = hostState.guestId;
      kickPlayer(guestId);
      hostState.guestId = null;
      delete hostPlayers[guestId];
      sendHostState(true);
      renderOnlineScreen();
    });
    getElement('startDuelButton').addEventListener('click', function () {
      startDuel();
    });
  } else if (screen === 'duelWaiting') {
    let hostName = '…';
    let hostNameText = translate('el host', 'the host');
    let rules = null;
    if (hostMessage) {
      hostName = hostMessage.hostName;
      hostNameText = hostMessage.hostName;
      rules = hostMessage.rules;
    }
    content.innerHTML = `<div class="online-header">${leaveButton}<h2>${translate('Duelo 1 vs 1', '1 vs 1 duel')}</h2>${codeBox}</div>
    <section class="online-card online-card-narrow"><h2 class="waiting-dots">${translate(
      `Esperando a que ${escapeHtml(hostNameText)} inicie el duelo`,
      `Waiting for ${escapeHtml(hostNameText)} to start the duel`,
    )}</h2>
      <div class="versus-row"><span class="versus-name versus-name-me">${escapeHtml(myPlayer.name)} ${translate('(tú)', '(you)')}</span><span class="versus-label">VS</span><span class="versus-name">${escapeHtml(hostName)}</span></div>
      ${buildDuelRulesSummary(rules)}</section>`;
  } else if (screen === 'hide') {
    const ready = Boolean(duelState.myClue);
    const rivalReady = rival && rival.live && rival.live.phase === 'ready';
    let explanation;
    if (ready) {
      const clue = duelState.myClue;
      let clueCount = translate(`${clue.vectors.length} vectores`, `${clue.vectors.length} vectors`);
      if (clue.vectors.length === 1) {
        clueCount = translate('un vector', 'one vector');
      }
      explanation = translate(
        `Listo: tu cerdito quedó en <b>(${formatNice(clue.finalX)}, ${formatNice(clue.finalY)})</b>. Tu rival recibirá ${clueCount} como pista.`,
        `Done: your piglet is at <b>(${formatNice(clue.finalX)}, ${formatNice(clue.finalY)})</b>. Your rival will get ${clueCount} as a clue.`,
      );
    } else {
      explanation = translate(
        `Toca el mapa para elegir el escondite (x entre ${HIDE_AND_SEEK.minimumX} y ${HIDE_AND_SEEK.maximumX} m, altura hasta ${HIDE_AND_SEEK.maximumY} m). Si queda en el aire, tendrá una plataforma debajo.`,
        `Tap the map to choose the hiding spot (x between ${HIDE_AND_SEEK.minimumX} and ${HIDE_AND_SEEK.maximumX} m, height up to ${HIDE_AND_SEEK.maximumY} m). If it’s in the air, it gets a platform below.`,
      );
    }
    let spotX = '';
    let spotY = '';
    let hideButtonDisabled = 'disabled';
    if (duelState.chosenSpot) {
      spotX = duelState.chosenSpot.x;
      spotY = duelState.chosenSpot.y;
      hideButtonDisabled = '';
    }
    let inputsHtml = '<span></span>';
    let hideButtonHtml = '';
    if (!ready) {
      inputsHtml = `<span class="hide-inputs"><label>x (m) <input type="number" id="hideSpotXInput" min="${HIDE_AND_SEEK.minimumX}" max="${HIDE_AND_SEEK.maximumX}" step="0.5" value="${spotX}"></label>
          <label>y (m) <input type="number" id="hideSpotYInput" min="0" max="${HIDE_AND_SEEK.maximumY}" step="0.5" value="${spotY}"></label></span>`;
      hideButtonHtml = `<button class="button button-go" id="hideHereButton" type="button" ${hideButtonDisabled}>${translate('Esconder aquí', 'Hide here')}</button>`;
    }
    let rivalText = translate('escondiendo su cerdito…', 'hiding their piglet…');
    if (rivalReady) {
      rivalText = translate('ya escondió su cerdito', 'has hidden their piglet');
    }
    let searchText = '';
    if (ready && rivalReady) {
      searchText = ' · ' + translate('¡Empieza la búsqueda!', 'The search begins!');
    }
    content.innerHTML = `<div class="online-header">${leaveButton}<h2>${translate('Esconde tu cerdito', 'Hide your piglet')}</h2>${codeBox}</div>
    <section class="online-card">
      <p>${explanation}</p>
      <canvas id="hidingMapCanvas" class="hide-map" aria-label="${translate('Mapa para esconder el cerdito', 'Map to hide the piglet')}"></canvas>
      <div class="hide-row">${inputsHtml}
        ${hideButtonHtml}</div>
      <p class="hint">⚔ ${escapeHtml(rivalName)}: ${rivalText}
        ${searchText}</p>
    </section>`;
    drawHidingMap();
    getElement('hidingMapCanvas').addEventListener('click', handleHidingMapClick);
    listenIfExists('hideHereButton', 'click', function () {
      confirmHidingSpot();
    });
    // the exact position can also be typed
    const spotInputIds = ['hideSpotXInput', 'hideSpotYInput'];
    for (const id of spotInputIds) {
      listenIfExists(id, 'change', function () {
        const x = parseNumber(getElement('hideSpotXInput').value, NaN);
        const y = parseNumber(getElement('hideSpotYInput').value, 0);
        if (!isFinite(x)) {
          return;
        }
        setChosenSpot(x, y);
        getElement('hideSpotXInput').value = duelState.chosenSpot.x;
        getElement('hideSpotYInput').value = duelState.chosenSpot.y;
        getElement('hideHereButton').disabled = false;
        drawHidingMap();
      });
    }
  } else if (screen === 'duelEnd') {
    const won = hostMessage && hostMessage.winnerId === myPlayer.id;
    const tie = hostMessage && !hostMessage.winnerId;
    const isRace = hostMessage && hostMessage.rules && hostMessage.rules.duelMode === 'race';
    let rivalNameForEnd = translate('Tu rival', 'Your rival');
    if (rival) {
      rivalNameForEnd = rival.name;
    }
    let title;
    if (tie) {
      title = translate('¡Empate!', 'It’s a tie!');
    } else if (won) {
      title = translate('¡Ganaste el duelo!', 'You won the duel!');
    } else {
      title = translate(`${escapeHtml(rivalNameForEnd)} ganó el duelo`, `${escapeHtml(rivalNameForEnd)} won the duel`);
    }
    let details;
    if (isRace) {
      let rows = '';
      const winners = hostMessage.roundWinners || [];
      const levels = hostMessage.rules.levels;
      for (let index = 0; index < winners.length; index++) {
        let winnerName = 'Rival';
        if (rival) {
          winnerName = escapeHtml(rival.name);
        }
        if (winners[index] === myPlayer.id) {
          winnerName = translate('Tú', 'You');
        }
        const levelName = getLevelReferenceLabel(levels[index % levels.length]).name;
        rows += `<tr><td>${translate('Ronda', 'Round')} ${index + 1}</td><td>${escapeHtml(levelName)}</td><td><b>${winnerName}</b></td></tr>`;
      }
      details = `<p>${escapeHtml(buildDuelScoreText(hostMessage))}</p><div class="table-wrapper"><table class="results-table"><tbody>${rows}</tbody></table></div>`;
    } else if (won) {
      details = `<p>${translate('Encontraste y derribaste el cerdito de tu rival primero.', 'You found and knocked down your rival’s piglet first.')}</p>`;
    } else {
      details = `<p>${translate('Tu rival encontró y derribó tu cerdito primero.', 'Your rival found and knocked down your piglet first.')}</p>`;
    }
    let rematchHtml;
    if (online.role === 'host') {
      let rematchDisabled = 'disabled';
      if (hostState.guestId) {
        rematchDisabled = '';
      }
      rematchHtml = `<button class="button button-go" id="rematchButton" type="button" ${rematchDisabled}>${translate('Revancha', 'Rematch')}</button>`;
    } else {
      rematchHtml = `<p class="hint">${translate(
        'Si el host pide revancha, volverás a la sala automáticamente.',
        'If the host asks for a rematch, you’ll return to the room automatically.',
      )}</p>`;
    }
    let titleClass = '';
    if (won) {
      titleClass = 'duel-end-win';
    }
    content.innerHTML = `<section class="online-card online-card-narrow duel-end">
      <h2 class="${titleClass}">${title}</h2>
      ${details}
      ${rematchHtml}
      <button class="button button-outline" id="duelHomeButton" type="button">${translate('Volver al inicio', 'Back to home')}</button>
    </section>`;
    listenIfExists('rematchButton', 'click', function () {
      startRematch();
    });
    getElement('duelHomeButton').addEventListener('click', function () {
      leaveOnline(true);
    });
  }

  listenIfExists('copyCodeButton', 'click', function () {
    copyGameCode();
  });
  const leave = getElement('duelLeaveButton');
  if (leave) {
    leave.addEventListener('click', function () {
      if (online.buttonWaitingConfirmation === 'duelLeave') {
        leaveOnline(true);
        return;
      }
      online.buttonWaitingConfirmation = 'duelLeave';
      leave.textContent = translate('¿Seguro? Pulsa otra vez', 'Sure? Press again');
      setTimeout(function () {
        if (online.buttonWaitingConfirmation === 'duelLeave') {
          online.buttonWaitingConfirmation = null;
          const button = getElement('duelLeaveButton');
          if (button) {
            button.textContent = translate('← Salir', '← Leave');
          }
        }
      }, 3000);
    });
  }
}

// copyGameCode(): copies the game code to the clipboard (or shows it if it is not possible).
function copyGameCode() {
  try {
    navigator.clipboard.writeText(online.code).then(
      function () {
        showToast(translate('Código copiado', 'Code copied'));
      },
      function () {
        showToast(online.code);
      },
    );
  } catch (error) {
    showToast(online.code);
  }
}

// When the window changes size, the hiding map is drawn again
window.addEventListener('resize', function () {
  if (currentView === 'online' && online.screen === 'hide') {
    drawHidingMap();
  }
});
