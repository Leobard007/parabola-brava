/* ======================================================================
   FILE: js/5-online/host-and-player.js

   CLASS GAME: THE HOST AND THE PLAYERS
   HOST (the teacher): creates the game, receives the progress of every player,
   decides when the game starts and ends, and can remove players.
   PLAYER: joins with the code, waits, plays the levels and sends its progress.

   THE MESSAGES (each side always sends its WHOLE current state):
     host   → { sender: 'host', version, code, mode, status, episode, rules,
                roster: [ { id, name, score, status, online } ], kickedIds, ...duel fields }
     player → { sender: 'player', version, code, id, name, status, levelIndex,
                levelCount, score, attempts, levelResults, levelOrder, events,
                eventCounter, live, clue, finished }
   ====================================================================== */

// copyRulesForSending(rules): a copy of the rules without pickerKeys (only the host needs them).
function copyRulesForSending(rules) {
  if (!rules) {
    return null;
  }
  const copy = Object.assign({}, rules);
  delete copy.pickerKeys;
  return copy;
}

// getHostPlayerList(): the players of the host as a list.
function getHostPlayerList() {
  const list = [];
  for (const id in hostPlayers) {
    list.push(hostPlayers[id]);
  }
  return list;
}

/* ----------------------------------------------------------------------
   HOST
   ---------------------------------------------------------------------- */

// buildHostMessage(): the state that the host sends to everyone.
function buildHostMessage() {
  const roster = [];
  for (const player of getHostPlayerList()) {
    if (player.kicked) {
      continue;
    }
    // in the lobby only connected players are listed; later, everyone who played
    if (player.online || hostState.status !== 'lobby') {
      roster.push({ id: player.id, name: player.name, score: player.score, status: player.status, online: player.online });
    }
  }
  const message = {
    sender: 'host',
    version: APP_VERSION,
    code: online.code,
    mode: online.mode,
    status: hostState.status,
    episode: hostState.episode,
    rules: copyRulesForSending(hostState.rules),
    roster: roster,
    kickedIds: hostState.kickedIds.slice(-40), // only the last 40
  };
  if (online.mode === 'duel') {
    message.hostName = myPlayer.name || translate('Anfitrión', 'Host');
    message.hostId = myPlayer.id;
    message.guestId = hostState.guestId || null;
    message.round = hostState.round;
    message.roundWinners = hostState.roundWinners;
    message.live = getDuelLiveInfo();
    message.clue = duelState.myClue || null;
    message.winnerId = hostState.winnerId || null;
  }
  // connections with a size limit: remove players from the list until it fits
  if (online.connection && online.connection.sizeLimit !== Infinity) {
    while (JSON.stringify(message).length > MAX_MESSAGE_SIZE && message.roster.length > 0) {
      message.roster.pop();
    }
  }
  return message;
}

// sendHostState(immediately): sends the host state. Without "immediately", it waits
// 200 ms so several quick changes travel in one message.
function sendHostState(immediately) {
  if (!online.connection || online.role !== 'host') {
    return;
  }
  clearTimeout(online.sendTimer);
  if (immediately) {
    online.connection.send(buildHostMessage());
  } else {
    online.sendTimer = setTimeout(function () {
      if (online.connection) {
        online.connection.send(buildHostMessage());
      }
    }, 200);
  }
}

// createGame(mode): creates an online game as host.
//   mode: 'class' (class game) or 'duel' (1 vs 1)
async function createGame(mode) {
  if (!mode) {
    mode = 'class';
  }
  resetOnline();
  online.role = 'host';
  online.screen = 'connecting';
  online.mode = mode;
  if (mode === 'duel') {
    hostState.rules = deepCopy(DUEL_DEFAULT_RULES);
    try {
      myPlayer.name = localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || '';
    } catch (error) {
      // nothing to do
    }
  }
  showView('online');
  renderOnlineScreen();
  const connection = await createConnection();
  if (online.role !== 'host') {
    connection.close(); // the person left while connecting
    return;
  }
  connection.onRemoteState = hostReceiveState;
  connection.onDisconnect = function () {
    showToast(translate('Se perdió la conexión con el servicio en línea.', 'Lost the connection to the online service.'));
  };
  // try up to 5 codes (in case one is already used)
  let result = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    online.code = createGameCode();
    result = await connection.start('host', online.code);
    if (online.role !== 'host') {
      connection.close();
      return;
    }
    if (result.ok || result.reason !== 'taken') {
      break;
    }
  }
  if (!result.ok) {
    online.screen = 'error';
    online.errorText = getConnectionErrorText(result.reason);
    renderOnlineScreen();
    return;
  }
  online.connection = connection;
  if (mode === 'duel') {
    online.screen = 'duelLobby';
  } else {
    online.screen = 'lobby';
  }
  sendHostState(true);
  renderOnlineScreen();
}

// createHostPlayerRecord(id, levelIndex): a new player in the host's list.
function createHostPlayerRecord(id, levelIndex) {
  return {
    id: id,
    name: '',
    status: 'waiting',
    levelIndex: levelIndex,
    levelCount: 0,
    score: 0,
    attempts: 0,
    levelResults: [],
    levelOrder: [],
    events: {}, //        the events received, by number (so none is counted twice)
    online: true,
    joinedAt: Date.now(),
    kicked: false,
    lastMessage: null, // the last message received from this player
  };
}

// cleanPlayerName(name, fallback): a name of at most 16 characters (or the fallback).
function cleanPlayerName(name, fallback) {
  return (
    String(name || '')
      .trim()
      .slice(0, 16) || fallback
  );
}

// hostReceiveState(id, message): the state of a player arrives (or null if it left).
function hostReceiveState(id, message) {
  if (online.mode === 'duel') {
    duelHostReceiveState(id, message);
    return;
  }
  let player = hostPlayers[id];
  if (message === null) {
    if (player && player.online) {
      player.online = false;
      if (!player.kicked) {
        showToast(translate(`${player.name} salió de la partida`, `${player.name} left the game`));
      }
      sendHostState();
      scheduleOnlineRender();
    }
    return;
  }
  if (hostState.kickedIds.indexOf(id) !== -1 || message.code !== online.code) {
    return;
  }
  if (!player) {
    // a new player: not accepted when the game ended, or when it started without "late join"
    if (hostState.status === 'ended') {
      return;
    }
    if (hostState.status === 'playing' && !(hostState.rules && hostState.rules.lateJoinAllowed)) {
      return;
    }
    player = createHostPlayerRecord(id, -1);
    hostPlayers[id] = player;
    player.name = cleanPlayerName(message.name, translate('Jugador', 'Player'));
    showToast(translate(`${player.name} entró`, `${player.name} joined`));
    playClickSound();
  }
  if (player.lastMessage === message) {
    return; // the same message again
  }
  player.lastMessage = message;
  player.online = true;
  checkOtherVersion(id, player.name, message.version);
  const wasDone = player.status === 'done';
  player.name = cleanPlayerName(message.name || player.name, player.name);
  if (message.status === 'waiting' || message.status === 'playing' || message.status === 'done') {
    player.status = message.status;
  }
  player.levelIndex = parseNumber(message.levelIndex, player.levelIndex);
  player.levelCount = parseNumber(message.levelCount, player.levelCount);
  player.score = parseNumber(message.score, player.score);
  player.attempts = parseNumber(message.attempts, player.attempts);
  if (Array.isArray(message.levelResults)) {
    player.levelResults = message.levelResults.slice(0, 60);
  }
  if (Array.isArray(message.levelOrder)) {
    player.levelOrder = message.levelOrder.slice(0, 60);
  }
  if (Array.isArray(message.events)) {
    for (const event of message.events) {
      if (event && typeof event === 'object' && player.events[event.number] === undefined) {
        player.events[event.number] = event;
      }
    }
  }
  if (!wasDone && player.status === 'done') {
    showToast(translate(`${player.name} terminó con ${player.score} puntos`, `${player.name} finished with ${player.score} points`));
    playCorrectSound();
  }
  sendHostState();
  scheduleOnlineRender();
}

// kickPlayer(id): removes a player from the game.
function kickPlayer(id) {
  const player = hostPlayers[id];
  if (!player) {
    return;
  }
  player.kicked = true;
  player.online = false;
  if (hostState.kickedIds.indexOf(id) === -1) {
    hostState.kickedIds.push(id);
  }
  if (online.connection) {
    online.connection.kick(id);
  }
  showToast(translate(`${player.name} fue expulsado`, `${player.name} was removed`));
  if (detailPlayerId === id) {
    detailPlayerId = null;
    getElement('playerDetailWindow').hidden = true;
  }
  sendHostState(true);
  renderOnlineScreen();
}

// startGame(): the host starts the class game.
function startGame() {
  let onlinePlayers = 0;
  for (const player of getHostPlayerList()) {
    if (player.online && !player.kicked) {
      onlinePlayers++;
    }
  }
  if (!hostState.rules || onlinePlayers === 0) {
    return;
  }
  hostState.status = 'playing';
  hostState.episode = Date.now();
  // the seed makes the "different" levels the same on the host and the player
  hostState.rules = Object.assign({}, hostState.rules, { seed: hostState.rules.seed || createRandomId() });
  online.screen = 'dashboard';
  sendHostState(true);
  renderOnlineScreen();
  showToast(translate('¡La partida empezó!', 'The game has started!'));
  playWinSound();
}

// endGame(): the host ends the class game for everyone.
function endGame() {
  hostState.status = 'ended';
  online.screen = 'end';
  sendHostState(true);
  renderOnlineScreen();
  playWinSound();
}

// hideOnlineGameControls(): hides the online parts of the game screen and shows the normal ones.
function hideOnlineGameControls() {
  getElement('onlineStatusChip').hidden = true;
  getElement('leaderboardButton').hidden = true;
  getElement('leaderboardPanel').hidden = true;
  getElement('levelEndRetryButton').hidden = false;
  // .closest('label') finds the <label> that contains the practice mode box
  const practiceLabel = getElement('practiceModeCheckbox').closest('label');
  if (practiceLabel) {
    practiceLabel.hidden = false;
  }
}

// leaveOnline(toHome): leaves the online game (and goes to the home screen).
function leaveOnline(toHome) {
  if (toHome === undefined) {
    toHome = true;
  }
  if (gameState.online) {
    gameState.online = null;
    gameState.score = online.savedScore;
    hideOnlineGameControls();
  }
  resetOnline();
  if (toHome) {
    showView('home');
  }
}

// When the page is closed: the host is asked to confirm if players are still connected
window.addEventListener('beforeunload', function (event) {
  if (online.role === 'host' && hostState.status !== 'ended') {
    let someoneOnline = false;
    for (const player of getHostPlayerList()) {
      if (player.online) {
        someoneOnline = true;
      }
    }
    if (someoneOnline) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  if (online.connection) {
    try {
      online.connection.close();
    } catch (error) {
      // nothing to do
    }
  }
});

/* ----------------------------------------------------------------------
   PLAYER
   ---------------------------------------------------------------------- */

// PLAYER_NAME_STORAGE_KEY: the name typed last time is remembered in the browser.
const PLAYER_NAME_STORAGE_KEY = 'parabola-brava-name';

// buildPlayerMessage(): the state that a player sends to the host.
function buildPlayerMessage() {
  let live = null;
  if (online.mode === 'duel') {
    live = getDuelLiveInfo();
  }
  const message = {
    sender: 'player',
    version: APP_VERSION,
    code: online.code,
    id: myPlayer.id,
    name: myPlayer.name,
    status: myPlayer.status,
    levelIndex: myPlayer.levelIndex,
    levelCount: myPlayer.levelCount,
    score: myPlayer.score,
    attempts: myPlayer.attempts,
    levelResults: myPlayer.levelResults,
    levelOrder: myPlayer.levelOrder,
    events: myPlayer.events.slice(-8), // only the last 8 events
    eventCounter: myPlayer.eventCounter,
    live: live,
    clue: duelState.myClue || null,
    finished: duelState.finishInfo || null,
  };
  // if it is too big, drop the oldest events
  while (JSON.stringify(message).length > MAX_MESSAGE_SIZE && message.events.length > 1) {
    message.events.shift();
  }
  return message;
}

// sendPlayerState(immediately): sends my state to the host (grouping quick changes, 150 ms).
function sendPlayerState(immediately) {
  if (!online.connection || online.role !== 'player') {
    return;
  }
  clearTimeout(online.sendTimer);
  if (immediately) {
    online.connection.send(buildPlayerMessage());
  } else {
    online.sendTimer = setTimeout(function () {
      if (online.connection) {
        online.connection.send(buildPlayerMessage());
      }
    }, 150);
  }
}

// showJoinMessage(html, isError): writes the message under the "Join" button.
function showJoinMessage(html, isError) {
  const messageBox = getElement('joinMessage');
  if (!messageBox) {
    return;
  }
  messageBox.innerHTML = html;
  if (isError) {
    messageBox.className = 'online-message online-message-error';
  } else {
    messageBox.className = 'online-message';
  }
}

// joinGame(name, code): a player joins a game with its code.
async function joinGame(name, code) {
  const joinButton = getElement('joinButton');
  name = name.trim().slice(0, 16);
  code = code.trim().toUpperCase();
  if (!name) {
    showJoinMessage(escapeHtml(translate('Escribe tu nombre.', 'Type your name.')), true);
    getElement('joinNameInput').focus();
    return;
  }
  // /^[A-Z0-9]{5}$/ is a "regular expression": exactly 5 capital letters or digits
  if (!/^[A-Z0-9]{5}$/.test(code)) {
    showJoinMessage(escapeHtml(translate('El código tiene 5 caracteres.', 'The code has 5 characters.')), true);
    getElement('joinCodeInput').focus();
    return;
  }
  try {
    localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name);
  } catch (error) {
    // nothing to do
  }
  joinButton.disabled = true;
  showJoinMessage(`<span class="waiting-dots">${translate('Buscando la partida', 'Looking for the game')}</span>`, false);
  if (online.connection) {
    try {
      online.connection.close();
    } catch (error) {
      // nothing to do
    }
    online.connection = null;
  }
  lastHostState = null;
  myPlayer.name = name;
  resetMyPlayer();
  online.role = 'player';
  online.code = code;
  const connection = await createConnection();
  if (online.role !== 'player') {
    connection.close();
    return;
  }
  connection.onRemoteState = playerReceiveState;
  connection.onTryingConnection = function (number, total) {
    if (total > 1 && getElement('joinMessage')) {
      getElement('joinMessage').innerHTML = `<span class="waiting-dots">${translate(
        `Buscando la partida (conexión ${number} de ${total})`,
        `Looking for the game (connection ${number} of ${total})`,
      )}</span>`;
    }
  };
  connection.onDisconnect = function () {
    showToast(translate('Se perdió la conexión con el servicio en línea.', 'Lost the connection to the online service.'));
  };
  online.connection = connection;
  connection.send(buildPlayerMessage());
  const result = await connection.start('player', code);
  if (online.role !== 'player' || online.connection !== connection) {
    return;
  }
  if (!result.ok) {
    connection.close();
    online.connection = null;
    online.role = null;
    joinButton.disabled = false;
    showJoinMessage(escapeHtml(getConnectionErrorText(result.reason)), true);
    return;
  }
  sendPlayerState(true);
  online.joined = true;
  if (lastHostState) {
    handleHostMessage(lastHostState, true);
  } else {
    online.screen = 'waiting';
    renderOnlineScreen();
  }
}

// playerReceiveState(id, message): the state of the host arrives (or null if it left).
function playerReceiveState(id, message) {
  if (id !== 'host') {
    return;
  }
  if (message === null) {
    if (!online.role || online.screen === 'kicked' || (lastHostState && lastHostState.status === 'ended')) {
      return;
    }
    online.screen = 'gone';
    online.errorText = translate('El host cerró la partida o perdió la conexión.', 'The host closed the game or lost the connection.');
    leaveOnlineGameScreen();
    renderOnlineScreen();
    return;
  }
  if (message.code !== online.code) {
    return;
  }
  lastHostState = message;
  if (online.joined) {
    handleHostMessage(message, false);
  }
}

// closeOnlineConnection(): closes the connection (used when the player can not stay).
function closeOnlineConnection() {
  if (online.connection) {
    online.connection.close();
    online.connection = null;
  }
}

// handleHostMessage(message, isFirst): reacts to a new state of the host.
//   isFirst: true for the first state received after joining
function handleHostMessage(message, isFirst) {
  checkOtherVersion('host', message.hostName || translate('El host', 'The host'), message.version);
  if (message.mode === 'duel') {
    duelGuestReceiveHost(message, isFirst);
    return;
  }
  if (Array.isArray(message.kickedIds) && message.kickedIds.indexOf(myPlayer.id) !== -1) {
    online.screen = 'kicked';
    leaveOnlineGameScreen();
    renderOnlineScreen();
    closeOnlineConnection();
    return;
  }
  if (message.status === 'ended') {
    if (online.screen !== 'end') {
      online.screen = 'end';
      leaveOnlineGameScreen();
      playWinSound();
    }
    renderOnlineScreen();
    return;
  }
  if (message.status === 'playing' && myPlayer.status === 'waiting' && online.episode !== message.episode) {
    // the game already started when I arrived and late joining is not allowed
    if (isFirst && !(message.rules && message.rules.lateJoinAllowed)) {
      online.screen = 'late';
      renderOnlineScreen();
      closeOnlineConnection();
      return;
    }
    online.episode = message.episode;
    showCountdown(function () {
      startPlayerGame(message.rules);
    });
    return;
  }
  if (online.screen === 'join') {
    online.screen = 'waiting';
    renderOnlineScreen();
  } else if (online.screen === 'waiting' || online.screen === 'done') {
    scheduleOnlineRender();
  }
  if (gameState.online) {
    updateLeaderboard();
  }
}

// showCountdown(whenFinished): shows "3, 2, 1, Go!" (0.8 s each) and then runs whenFinished.
function showCountdown(whenFinished) {
  const overlay = getElement('countdownOverlay');
  const numberBox = getElement('countdownNumber');
  if (currentView !== 'game') {
    showView('online');
  }
  overlay.hidden = false;
  const steps = ['3', '2', '1', translate('¡Ya!', 'Go!')];
  let stepIndex = 0;
  function showNextStep() {
    if (stepIndex >= steps.length) {
      overlay.hidden = true;
      whenFinished();
      return;
    }
    numberBox.textContent = steps[stepIndex];
    // restart the CSS animation: remove it, force the browser to notice, and put it back
    numberBox.style.animation = 'none';
    void numberBox.offsetWidth;
    numberBox.style.animation = '';
    if (stepIndex === steps.length - 1) {
      playCorrectSound();
    } else {
      playClickSound();
    }
    stepIndex++;
    setTimeout(showNextStep, 800);
  }
  showNextStep();
}

// startPlayerGame(rules): the class game starts for this player.
function startPlayerGame(rules) {
  if (!rules || online.role !== 'player') {
    return;
  }
  const playerLevels = getPlayerLevels(rules, myPlayer.id);
  if (playerLevels.levels.length === 0) {
    online.screen = 'gone';
    online.errorText = translate('No se pudieron cargar los niveles de la partida.', 'Couldn’t load the game’s levels.');
    renderOnlineScreen();
    return;
  }
  online.savedScore = gameState.score;
  gameState.score = 0;
  myPlayer.status = 'playing';
  myPlayer.levelCount = playerLevels.levels.length;
  myPlayer.levelOrder = playerLevels.levelOrder;
  myPlayer.levelResults = [];
  myPlayer.events = [];
  myPlayer.score = 0;
  myPlayer.attempts = 0;
  // the online information of the game being played:
  //   mode:       undefined in class games; 'race' or 'hide' in duels
  //   levelIndex: which level of "levels" is being played
  //   deadline:   when the time of the level ends (0 = no time limit)
  //   levelStartTime: when the level started (performance.now(), in ms)
  //   lastChipText:   the text of the status chip (to update it only when it changes)
  //   endedLevelIndex: the level whose end was already reported
  gameState.online = {
    mode: undefined,
    levelIndex: 0,
    levels: playerLevels.levels,
    rules: rules,
    finished: false,
    deadline: 0,
    levelStartTime: 0,
    lastChipText: '',
    endedLevelIndex: -1,
  };
  online.screen = 'game';
  loadOnlineLevel(0);
}

// loadOnlineLevel(index): starts one level of the online game.
function loadOnlineLevel(index) {
  const onlineGame = gameState.online;
  onlineGame.levelIndex = index;
  // performance.now() gives the milliseconds since the page opened (very precise)
  onlineGame.levelStartTime = performance.now();
  onlineGame.deadline = 0;
  if (onlineGame.rules.timeLimit > 0) {
    onlineGame.deadline = onlineGame.levelStartTime + onlineGame.rules.timeLimit * 1000;
  }
  gameState.scoreAtLevelStart = gameState.score;
  loadLevel(onlineGame.levels[index], { online: true });
  // practice mode only if the rules allow it
  const practiceCheckbox = getElement('practiceModeCheckbox');
  if (!onlineGame.rules.practiceAllowed) {
    practiceCheckbox.checked = false;
  }
  practiceCheckbox.closest('label').hidden = !onlineGame.rules.practiceAllowed;
  updateLaunchPanel();
  myPlayer.levelIndex = index;
  myPlayer.attempts = 0;
  myPlayer.score = gameState.score;
  setMyLevelResult({ level: index, result: 'playing', points: 0, attempts: 0, seconds: 0 });
  getElement('onlineStatusChip').hidden = false;
  getElement('leaderboardButton').hidden = !onlineGame.rules.showLeaderboard;
  updateOnlineStatusChip(true);
  updateLeaderboard();
  sendMyState(true);
  updateRivalStatusBar();
}

// setMyLevelResult(levelResult): saves the result of a level (replacing an older one).
function setMyLevelResult(levelResult) {
  const otherResults = [];
  for (const oldResult of myPlayer.levelResults) {
    if (oldResult.level !== levelResult.level) {
      otherResults.push(oldResult);
    }
  }
  otherResults.push(levelResult);
  myPlayer.levelResults = otherResults;
}

// addPlayerEvent(event): adds an event (answer, shot or level end) and sends it.
// Every event gets a number and the level where it happened. Only the last 8 are kept.
function addPlayerEvent(event) {
  if (!gameState.online) {
    return;
  }
  myPlayer.eventCounter++;
  event.number = myPlayer.eventCounter;
  event.level = gameState.online.levelIndex;
  myPlayer.events.push(event);
  if (myPlayer.events.length > 8) {
    myPlayer.events.shift();
  }
  myPlayer.score = gameState.score;
  sendMyState();
}

// sendMyState(immediately): sends MY state, as host (in a duel the host plays too) or as player.
function sendMyState(immediately) {
  if (online.role === 'host') {
    sendHostState(immediately);
  } else {
    sendPlayerState(immediately);
  }
}

// onlineReportAnswer(typedValues): the player checked an answer of the vector phase.
function onlineReportAnswer(typedValues) {
  const items = [];
  let allCorrect = true;
  for (let index = 0; index < gameState.unknownItems.length; index++) {
    const item = gameState.unknownItems[index];
    const isDirection = item.quantity === 'direction';
    const correct = isAnswerCorrect(item, typedValues[index]);
    if (!correct) {
      allCorrect = false;
    }
    let given = typedValues[index];
    let correctValue = item.trueValue;
    if (!isDirection) {
      given = roundToTwoDecimals(given);
      correctValue = roundToTwoDecimals(correctValue);
    }
    items.push({ key: item.key, given: given, correctValue: correctValue, correct: correct });
  }
  myPlayer.attempts = gameState.answer.attemptsUsed;
  addPlayerEvent({ kind: 'answer', correct: allCorrect, items: items });
}

// onlineReportShot(projectile, targetsHit): the player made a shot.
function onlineReportShot(projectile, targetsHit) {
  myPlayer.attempts = gameState.level.shotCount - gameState.shotsLeft;
  addPlayerEvent({
    kind: 'shot',
    launchSpeed: roundToTwoDecimals(projectile.launchSpeed),
    launchAngle: projectile.launchAngle,
    launchHeight: roundToTwoDecimals(projectile.launchHeight),
    targetsHit: targetsHit,
    landingX: roundToTwoDecimals(projectile.x),
  });
}

// onlineReportLevelEnd(result, stars): a level of the online game ended.
//   result: 'won', 'failed' or 'timeout'
function onlineReportLevelEnd(result, stars) {
  const onlineGame = gameState.online;
  if (!onlineGame) {
    return;
  }
  if (onlineGame.mode === 'race' || onlineGame.mode === 'hide') {
    duelLevelEnd(result); // duels work differently (js/5-online/duel.js)
    return;
  }
  if (onlineGame.endedLevelIndex === onlineGame.levelIndex) {
    return; // already reported
  }
  onlineGame.endedLevelIndex = onlineGame.levelIndex;
  gameState.mode = 'ended';
  gameState.projectile = null;
  gameState.endTimer = 0;
  const level = gameState.level;
  const points = gameState.score - gameState.scoreAtLevelStart;
  const seconds = Math.round((performance.now() - onlineGame.levelStartTime) / 1000);
  // attempts: answer attempts, shots, or both in mixed levels
  const shotsUsed = level.shotCount - gameState.shotsLeft;
  let attempts = shotsUsed;
  if (level.type === 'displacement') {
    attempts = gameState.answer.attemptsUsed;
  } else if (level.type === 'mixed') {
    attempts = gameState.answer.attemptsUsed + shotsUsed;
  }
  setMyLevelResult({ level: onlineGame.levelIndex, result: result, points: points, attempts: attempts, seconds: seconds });
  myPlayer.score = gameState.score;
  myPlayer.attempts = attempts;
  addPlayerEvent({ kind: 'levelEnd', result: result, points: points, stars: stars || 0 });

  // the end card
  let title;
  if (result === 'won') {
    if (level.type === 'displacement') {
      title = translate('¡Resuelto!', 'Solved!');
    } else {
      title = translate('¡Nivel superado!', 'Level complete!');
    }
  } else if (result === 'failed') {
    if (level.type === 'displacement') {
      title = translate('Sin intentos', 'Out of attempts');
    } else {
      title = translate('Sin tiros', 'Out of shots');
    }
  } else {
    title = translate('Se acabó el tiempo', 'Time’s up');
  }
  getElement('levelEndTitle').textContent = title;
  if (result === 'won') {
    getElement('levelEndStars').innerHTML = buildStarsHtml(stars || 0);
  } else {
    getElement('levelEndStars').innerHTML = '';
  }
  let text;
  if (result === 'won') {
    text = translate(`+${points} puntos en ${formatTime(seconds)}.`, `+${points} points in ${formatTime(seconds)}.`);
  } else {
    text = translate(`Este nivel suma ${points} puntos.`, `This level adds ${points} points.`);
  }
  text += ' ' + translate(`Total: ${gameState.score}.`, `Total: ${gameState.score}.`);
  getElement('levelEndText').textContent = text;
  getElement('levelEndRetryButton').hidden = true;
  const isLastLevel = onlineGame.levelIndex >= onlineGame.levels.length - 1;
  if (isLastLevel) {
    setNextButton(translate('Ver mis resultados', 'See my results'), function () {
      finishMyGame();
    });
  } else {
    const nextNumber = onlineGame.levelIndex + 2;
    setNextButton(
      translate(`Siguiente nivel (${nextNumber}/${onlineGame.levels.length})`, `Next level (${nextNumber}/${onlineGame.levels.length})`),
      function () {
        loadOnlineLevel(onlineGame.levelIndex + 1);
      },
    );
  }
  if (result === 'won') {
    playWinSound();
  } else {
    playWrongSound();
  }
  getElement('levelEndOverlay').hidden = false;
  updateHud();
  updateOnlineStatusChip(true);
}

// finishMyGame(): the player finished every level.
function finishMyGame() {
  myPlayer.status = 'done';
  myPlayer.score = gameState.score;
  sendMyState(true);
  if (gameState.online) {
    gameState.online.finished = true;
  }
  online.screen = 'done';
  showView('online');
  renderOnlineScreen();
}

// leaveOnlineGameScreen(): leaves the game screen of an online game (back to the online screen).
function leaveOnlineGameScreen() {
  if (gameState.online) {
    online.finalScore = gameState.score;
    gameState.online = null;
    gameState.score = online.savedScore;
    hideOnlineGameControls();
    getElement('rivalStatusBar').hidden = true;
  }
  getElement('countdownOverlay').hidden = true;
  if (currentView === 'game') {
    showView('online');
  }
}

// updateOnlineGame(): called on every frame during an online game: checks the time limit
// and updates the status chip.
function updateOnlineGame() {
  const onlineGame = gameState.online;
  if (!onlineGame || onlineGame.finished) {
    return;
  }
  const solvedDisplacement = gameState.level.type === 'displacement' && gameState.answerRevealed;
  if (onlineGame.deadline && gameState.mode !== 'ended' && !solvedDisplacement && performance.now() > onlineGame.deadline) {
    gameState.phase = 'done';
    onlineReportLevelEnd('timeout', 0);
    return;
  }
  updateOnlineStatusChip(false);
}

// updateOnlineStatusChip(force): the small chip of the top bar ("Online · K7QX2 · Level 2/5 · ⏱ 1:30").
function updateOnlineStatusChip(force) {
  const onlineGame = gameState.online;
  if (!onlineGame) {
    return;
  }
  let text = `${translate('Online', 'Online')} · ${online.code} · ${translate('Nivel', 'Level')} ${onlineGame.levelIndex + 1}/${onlineGame.levels.length}`;
  let warning = false;
  if (onlineGame.mode) {
    const duelChip = getDuelChipInfo();
    text = duelChip.text;
    warning = duelChip.warning;
  }
  if (onlineGame.deadline && gameState.mode !== 'ended') {
    const secondsLeft = (onlineGame.deadline - performance.now()) / 1000;
    text += ` · ⏱ ${formatTime(secondsLeft)}`;
    warning = secondsLeft < 15; // red when less than 15 s are left
  }
  if (force || text !== onlineGame.lastChipText) {
    onlineGame.lastChipText = text;
    const chip = getElement('onlineStatusChip');
    chip.textContent = text;
    chip.classList.toggle('online-status-chip-warning', warning);
  }
}

// buildLeaderboardHtml(roster, myId): the leaderboard list, from the best score down.
function buildLeaderboardHtml(roster, myId) {
  const sorted = (roster || []).slice();
  sorted.sort(function (first, second) {
    return second.score - first.score;
  });
  if (sorted.length === 0) {
    return `<p class="hint">${translate('Aún no hay puntos.', 'No points yet.')}</p>`;
  }
  let html = '<ol class="leaderboard-list">';
  for (const entry of sorted) {
    const isMe = entry.id === myId;
    let itemClass = '';
    let youText = '';
    if (isMe) {
      itemClass = 'leaderboard-me';
      youText = ' ' + translate('(tú)', '(you)');
    }
    html += `<li class="${itemClass}"><span>${escapeHtml(entry.name)}${youText}</span><b>${entry.score}</b></li>`;
  }
  html += '</ol>';
  return html;
}

// updateLeaderboard(): rewrites the leaderboard panel (if it is open).
function updateLeaderboard() {
  if (!gameState.online || getElement('leaderboardPanel').hidden || !lastHostState) {
    return;
  }
  getElement('leaderboardPanel').innerHTML =
    `<h3 style="margin:0 0 6px;font:400 20px var(--font-title)">${translate('Tabla de posiciones', 'Leaderboard')}</h3>` +
    buildLeaderboardHtml(lastHostState.roster, myPlayer.id);
}
getElement('leaderboardButton').addEventListener('click', function () {
  const panel = getElement('leaderboardPanel');
  panel.hidden = !panel.hidden;
  getElement('leaderboardButton').setAttribute('aria-expanded', String(!panel.hidden));
  updateLeaderboard();
});

// handleOnlineMenuButton(): the "Leave game" button of the top bar asks for confirmation.
function handleOnlineMenuButton() {
  const menuButton = getElement('gameMenuButton');
  if (online.buttonWaitingConfirmation === 'leave') {
    online.buttonWaitingConfirmation = null;
    leaveOnline(true);
    return;
  }
  online.buttonWaitingConfirmation = 'leave';
  menuButton.textContent = translate('¿Seguro? Pulsa otra vez', 'Sure? Press again');
  setTimeout(function () {
    if (online.buttonWaitingConfirmation === 'leave') {
      online.buttonWaitingConfirmation = null;
      updateGameBar();
    }
  }, 3000);
}
