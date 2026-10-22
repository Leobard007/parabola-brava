/* ======================================================================
   FILE: js/5-online/network.js

   ONLINE MODE: CONNECTIONS AND SHARED STATE
   There is no game server of our own. The browser of the person who creates
   the game (the "host") keeps the rules and the state, and each player sends
   their progress. The messages travel through one of these "connections":

     MQTT    a public message server (the same kind used by ESP32 boards).
             Used first. Free public servers: EMQX and HiveMQ.
     PeerJS  direct browser-to-browser connection (WebRTC). Used if MQTT fails.
     room    the multiplayer rooms of claude.ai (only when the game runs there).
     local   tabs of the same browser (only for tests: add ?net=local to the address).

   Every connection works the same way, so the rest of the game does not care
   which one is used. A connection is an object with:
     start(role, code)  connects as 'host' or 'player' to the game with that code.
                        It finishes later (it returns a "Promise"), with the
                        result { ok: true } or { ok: false, reason: '...' }
     send(state)        sends my whole current state to the others
     kick(id)           disconnects a player (only some connections can)
     close()            disconnects
     onRemoteState(id, state)  is called when the state of someone else arrives
                               (state = null means that person left)
     onDisconnect(reason)      is called if the connection is lost

   Useful options in the address of the page (for tests):
     ?net=mqtt or ?net=peer or ?net=local   use only that kind of connection
     ?mqtt=wss://server:port/mqtt           use another MQTT server
     ?peerhost=...&peerport=...             use another PeerJS server

   About "async", "await" and "Promise": some things take time (connecting to a
   server, for example). A function marked "async" can "await" them: it pauses at
   that line until the result arrives, without freezing the page.
   ====================================================================== */

// wait(milliseconds): a pause that can be used with await, for example: await wait(1500);
function wait(milliseconds) {
  return new Promise(function (resolve) {
    setTimeout(resolve, milliseconds);
  });
}

// escapeHtml(text): makes a text safe to put inside HTML. Names typed by players could
// contain characters like < or > that the browser would read as HTML code.
function escapeHtml(text) {
  if (text === null || text === undefined) {
    text = '';
  }
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// GAME_CODE_CHARACTERS: the characters used in game codes. Characters that look alike
// (0 and O, 1 and I and L) are not used.
const GAME_CODE_CHARACTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// createGameCode(): a random code of 5 characters, for example "K7QX2".
function createGameCode() {
  let code = '';
  for (let index = 0; index < 5; index++) {
    code += GAME_CODE_CHARACTERS[Math.floor(Math.random() * GAME_CODE_CHARACTERS.length)];
  }
  return code;
}

// createRandomId(): a random id of 12 letters and numbers (to identify each player).
function createRandomId() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

// formatTime(seconds): seconds written as minutes:seconds, for example 75 → "1:15".
function formatTime(seconds) {
  seconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(seconds / 60);
  const restOfSeconds = seconds % 60;
  // padStart(2, '0') adds a 0 in front when there is only one digit: 5 → "05"
  return `${minutes}:${String(restOfSeconds).padStart(2, '0')}`;
}

/* ----------------------------------------------------------------------
   RANDOM NUMBERS WITH A "SEED"
   Math.random() gives different numbers every time. A seeded random generator
   gives ALWAYS THE SAME numbers for the same seed text. The host and each
   player use it to build exactly the same "different values" levels without
   sending them. You do not need to understand the bit operations below
   (Math.imul, ^, >>>): they just mix the bits of a number.
   ---------------------------------------------------------------------- */

// hashText(text): turns a text into a big whole number (always the same for the same text).
function hashText(text) {
  let hash = 1779033703 ^ text.length;
  for (let index = 0; index < text.length; index++) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return hash >>> 0;
}

// createSeededRandom(seedText): creates a random generator. Use nextRandom(generator)
// to get each number.
function createSeededRandom(seedText) {
  return { state: hashText(seedText) };
}

// nextRandom(generator): the next random number between 0 and 1 of a seeded generator.
function nextRandom(generator) {
  generator.state = generator.state | 0;
  generator.state = (generator.state + 0x6d2b79f5) | 0;
  let mixed = Math.imul(generator.state ^ (generator.state >>> 15), 1 | generator.state);
  mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
  return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
}

// MAX_MESSAGE_SIZE: the claude.ai rooms allow at most 4 KiB per participant.
const MAX_MESSAGE_SIZE = 3800;

/* ----------------------------------------------------------------------
   LOADING EXTERNAL LIBRARIES
   ---------------------------------------------------------------------- */

// loadScript(url): adds a <script> to the page to download a library, and finishes when
// it is loaded (or fails if it cannot be downloaded).
function loadScript(url) {
  return new Promise(function (resolve, reject) {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// The libraries used by the online mode (downloaded only when they are needed):
//   MQTT.js: talks to MQTT servers from the browser (https://github.com/mqttjs)
//   PeerJS:  makes browser-to-browser connections easy (https://peerjs.com)
const MQTT_LIBRARY_URL = 'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js';
const PEERJS_LIBRARY_URL = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';

// MQTT_SERVERS: public and free MQTT servers (with secure WebSocket), tried in this order.
// You can add your own server (for example a Mosquitto of yours) at the beginning.
const MQTT_SERVERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];

// readAddressOption(name): reads an option from the page address, for example
// readAddressOption('net') gives 'local' for ".../index.html?net=local". null if missing.
function readAddressOption(name) {
  try {
    // URLSearchParams reads the part of the address after "?"
    return new URLSearchParams(location.search).get(name);
  } catch (error) {
    return null;
  }
}

// createEmptyConnection(kind, sizeLimit): a connection object with empty functions,
// to be completed by each kind of connection.
function createEmptyConnection(kind, sizeLimit) {
  return {
    kind: kind,
    sizeLimit: sizeLimit, // biggest message allowed (Infinity = no limit)
    onRemoteState: function () {},
    onDisconnect: function () {},
    onTryingConnection: function () {},
    start: function () {
      return Promise.resolve({ ok: false, reason: 'offline' });
    },
    send: function () {},
    kick: function () {},
    close: function () {},
  };
}

// createConnection(): chooses and creates the connection to use.
async function createConnection() {
  const forcedKind = readAddressOption('net');
  if (forcedKind === 'local' || window.parabolaBravaNetwork === 'local') {
    return createLocalConnection();
  }
  // inside claude.ai, the rooms of claude.ai are used
  if (!forcedKind && window.claude && typeof window.claude.use === 'function') {
    try {
      const room = await window.claude.use('room');
      if (room && typeof room.join === 'function') {
        return createRoomConnection(room);
      }
    } catch (error) {
      // not available: continue with the others
    }
  }
  // the list of connections to try, in order
  let mqttServers = MQTT_SERVERS;
  if (readAddressOption('mqtt')) {
    mqttServers = [readAddressOption('mqtt')];
  }
  const options = [];
  if (forcedKind !== 'peer') {
    for (const serverUrl of mqttServers) {
      options.push({ kind: 'mqtt', url: serverUrl });
    }
  }
  if (forcedKind !== 'mqtt') {
    options.push({ kind: 'peer' });
  }
  return createAutoConnection(options);
}

// makeConnection(option): creates one connection of the list of createConnection.
async function makeConnection(option) {
  if (option.kind === 'mqtt') {
    return createMqttConnection(option.url);
  }
  return createPeerConnection();
}

/* ----------------------------------------------------------------------
   AUTOMATIC CONNECTION: tries several connections in order and keeps the
   first one that works.
   - The HOST uses the first one it can connect to.
   - The PLAYER looks for the game in each one until it finds it
     (in case the host had to use the second one or the backup one).
   ---------------------------------------------------------------------- */
function createAutoConnection(options) {
  const connection = createEmptyConnection('auto', Infinity);
  let currentConnection = null;

  connection.start = async function (role, code) {
    let sawNotFound = false;
    for (let index = 0; index < options.length; index++) {
      connection.onTryingConnection(index + 1, options.length);
      let attempt;
      try {
        attempt = await makeConnection(options[index]);
      } catch (error) {
        continue; // the library could not be downloaded: try the next one
      }
      // pass the messages of this connection to whoever listens to the automatic one
      attempt.onRemoteState = function (id, state) {
        connection.onRemoteState(id, state);
      };
      attempt.onDisconnect = function (reason) {
        connection.onDisconnect(reason);
      };
      const result = await attempt.start(role, code);
      if (result.ok) {
        currentConnection = attempt;
        connection.kind = attempt.kind;
        connection.sizeLimit = attempt.sizeLimit;
        return result;
      }
      try {
        attempt.close();
      } catch (error) {
        // nothing to do
      }
      if (result.reason === 'taken') {
        return result;
      }
      if (result.reason === 'notfound') {
        sawNotFound = true;
      }
    }
    if (sawNotFound) {
      return { ok: false, reason: 'notfound' };
    }
    return { ok: false, reason: 'offline' };
  };
  connection.send = function (state) {
    if (currentConnection) {
      currentConnection.send(state);
    }
  };
  connection.kick = function (id) {
    if (currentConnection) {
      currentConnection.kick(id);
    }
  };
  connection.close = function () {
    if (currentConnection) {
      currentConnection.close();
    }
    currentConnection = null;
  };
  return connection;
}

/* ----------------------------------------------------------------------
   MQTT CONNECTION
   Each participant publishes their whole state in their own "topic":
     parabolabrava/v2/CODE/h        → state of the host
     parabolabrava/v2/CODE/p/ID     → state of each player
   The messages are "retained": whoever arrives late receives the last state
   at once. The "will" (last will) erases the state if someone disconnects
   suddenly. Every 15 s each one publishes again (a "heartbeat").
   (Version 10 changed the format of the messages, so its topics use "v2".)
   ---------------------------------------------------------------------- */
async function createMqttConnection(serverUrl) {
  const connection = createEmptyConnection('mqtt', Infinity);
  if (!window.mqtt) {
    await loadScript(MQTT_LIBRARY_URL);
  }
  const TOPIC_START = 'parabolabrava/v2/';
  // a host state without heartbeat for more than 5 minutes is considered abandoned
  const ABANDONED_AFTER = 5 * 60 * 1000;
  let client = null; // the MQTT client of the library
  let myRole;
  let lastSentState = null;
  let heartbeatTimer = null;
  let myTopic = null;
  const lastSeenPlayers = {}; // player id → last time a message arrived

  // publish(topic, state): publishes a state (or erases it with null) as a retained message
  function publish(topic, state) {
    if (client && client.connected) {
      let text = '';
      if (state) {
        text = JSON.stringify(state);
      }
      client.publish(topic, text, { retain: true, qos: 0 });
    }
  }

  connection.start = function (role, code) {
    return new Promise(function (resolve) {
      myRole = role;
      const gameTopic = TOPIC_START + code + '/';
      const hostTopic = gameTopic + 'h';
      const playerTopicStart = gameTopic + 'p/';
      if (role === 'host') {
        myTopic = hostTopic;
      } else {
        myTopic = playerTopicStart + myPlayer.id;
      }
      let finished = false;
      let hostSeen = false;
      let anotherHostExists = false;
      // finish(result): gives the result of start (only the first time)
      function finish(result) {
        if (!finished) {
          finished = true;
          resolve(result);
        }
      }
      try {
        // mqtt.connect opens the connection. "will" is published by the server if we vanish.
        client = window.mqtt.connect(serverUrl, {
          clientId: 'pb_' + createRandomId(),
          clean: true,
          connectTimeout: 7000,
          reconnectPeriod: 3000,
          will: { topic: myTopic, payload: '', retain: true, qos: 0 },
        });
      } catch (error) {
        finish({ ok: false, reason: 'offline' });
        return;
      }

      // a message arrives
      client.on('message', function (topic, payload) {
        let text = '';
        if (payload) {
          text = payload.toString();
        }
        let state = null;
        if (text) {
          try {
            state = JSON.parse(text);
          } catch (error) {
            return; // not a valid message
          }
        }
        if (topic === hostTopic) {
          if (myRole === 'host') {
            // someone else is already the host with this code
            if (state && state.heartbeat && Date.now() - state.heartbeat < ABANDONED_AFTER) {
              anotherHostExists = true;
            }
            return;
          }
          if (!state) {
            if (hostSeen) {
              connection.onRemoteState('host', null);
            }
            return;
          }
          if (state.heartbeat && Date.now() - state.heartbeat > ABANDONED_AFTER) {
            return; // an old abandoned game
          }
          hostSeen = true;
          connection.onRemoteState('host', state);
        } else if (myRole === 'host' && topic.startsWith(playerTopicStart)) {
          const playerId = topic.slice(playerTopicStart.length).slice(0, 24);
          if (!state) {
            if (lastSeenPlayers[playerId] !== undefined) {
              delete lastSeenPlayers[playerId];
              connection.onRemoteState(playerId, null);
            }
            return;
          }
          lastSeenPlayers[playerId] = Date.now();
          connection.onRemoteState(playerId, state);
        }
      });

      // connected (also after an automatic reconnection)
      client.on('connect', function () {
        if (finished) {
          // reconnection: publish my state again
          if (lastSentState) {
            publish(myTopic, lastSentState);
          }
          return;
        }
        let topics = [hostTopic];
        if (myRole === 'host') {
          topics = [hostTopic, playerTopicStart + '+']; // "+" means "any player"
        }
        client.subscribe(topics, { qos: 0 }, function (error) {
          if (error) {
            finish({ ok: false, reason: 'error' });
            return;
          }
          // wait a moment to receive the retained messages, then decide
          let waitTime = 2500;
          if (myRole === 'host') {
            waitTime = 1200;
          }
          setTimeout(function () {
            if (myRole === 'host') {
              if (anotherHostExists) {
                finish({ ok: false, reason: 'taken' });
                return;
              }
              heartbeatTimer = setInterval(function () {
                if (lastSentState) {
                  // Object.assign({}, a, b) makes a new object with the fields of a and b
                  lastSentState = Object.assign({}, lastSentState, { heartbeat: Date.now() });
                  publish(myTopic, lastSentState);
                }
                // players without heartbeat for 45 s are considered disconnected
                const now = Date.now();
                for (const playerId in lastSeenPlayers) {
                  if (now - lastSeenPlayers[playerId] > 45000) {
                    delete lastSeenPlayers[playerId];
                    connection.onRemoteState(playerId, null);
                  }
                }
              }, 15000);
              finish({ ok: true });
            } else {
              if (!hostSeen) {
                finish({ ok: false, reason: 'notfound' });
                return;
              }
              heartbeatTimer = setInterval(function () {
                if (lastSentState) {
                  publish(myTopic, lastSentState);
                }
              }, 15000);
              finish({ ok: true });
            }
          }, waitTime);
        });
      });
      client.on('error', function () {
        if (!finished) {
          finish({ ok: false, reason: 'offline' });
        }
      });
      client.on('close', function () {
        if (!finished) {
          finish({ ok: false, reason: 'offline' });
          try {
            client.end(true);
          } catch (error) {
            // nothing to do
          }
        }
      });
      client.on('offline', function () {
        if (finished) {
          connection.onDisconnect('offline');
        }
      });
      // if nothing happened in 9 seconds, give up
      setTimeout(function () {
        finish({ ok: false, reason: 'offline' });
      }, 9000);
    });
  };
  connection.send = function (state) {
    if (myRole === 'host') {
      lastSentState = Object.assign({}, state, { heartbeat: Date.now() });
    } else {
      lastSentState = state;
    }
    publish(myTopic, lastSentState);
  };
  connection.close = function () {
    clearInterval(heartbeatTimer);
    if (client) {
      try {
        publish(myTopic, null); // erase my retained state
        client.end(false);
      } catch (error) {
        // nothing to do
      }
    }
    client = null;
  };
  return connection;
}

/* ----------------------------------------------------------------------
   CLAUDE.AI ROOM CONNECTION
   Each participant shows their state as their "presence" in a room.
   ---------------------------------------------------------------------- */
function createRoomConnection(room) {
  const connection = createEmptyConnection('room', MAX_MESSAGE_SIZE);
  let joinedRoom = null;
  let myRole;
  let gameCode;
  const idOfPeer = {}; // room participant → player id

  // isHostState(state): true if the presence is the host of this game
  function isHostState(state) {
    return state && state.sender === 'host' && state.code === gameCode;
  }
  // receivePeers(changes): the participants of the room changed
  function receivePeers(changes) {
    for (const peer of changes.peers) {
      if (peer.sameTab) {
        continue;
      }
      const state = peer.presence || {};
      if (myRole === 'host') {
        if (!(state.sender === 'player' && state.code === gameCode)) {
          continue;
        }
      } else if (!isHostState(state)) {
        continue;
      }
      let id = 'host';
      if (myRole === 'host') {
        id = String(state.id || peer.peer).slice(0, 24);
      }
      idOfPeer[peer.peer] = id;
      connection.onRemoteState(id, state);
    }
    for (const peer of changes.left) {
      const id = idOfPeer[peer.peer];
      if (id) {
        delete idOfPeer[peer.peer];
        connection.onRemoteState(id, null);
      }
    }
  }
  // hostIsHere(): true if the host of the game is in the room
  function hostIsHere() {
    for (const peer of joinedRoom.peers()) {
      if (!peer.sameTab && isHostState(peer.presence)) {
        return true;
      }
    }
    return false;
  }
  // leaveRoom(): leaves the room, ignoring errors
  async function leaveRoom() {
    try {
      await joinedRoom.leave();
    } catch (error) {
      // nothing to do
    }
    joinedRoom = null;
  }

  connection.start = async function (role, code) {
    myRole = role;
    gameCode = code;
    try {
      joinedRoom = await room.join('pb-' + code.toLowerCase());
    } catch (error) {
      if (error && error.code === 'not_permitted') {
        return { ok: false, reason: 'denied' };
      }
      return { ok: false, reason: 'error' };
    }
    joinedRoom.onPeers(receivePeers, function (error) {
      connection.onDisconnect(error.code);
    });
    if (role === 'host') {
      await wait(1500);
      if (hostIsHere()) {
        await leaveRoom();
        return { ok: false, reason: 'taken' };
      }
      return { ok: true };
    }
    // player: look for the host for 6 seconds (40 × 150 ms)
    for (let attempt = 0; attempt < 40; attempt++) {
      if (hostIsHere()) {
        return { ok: true };
      }
      await wait(150);
    }
    await leaveRoom();
    return { ok: false, reason: 'notfound' };
  };
  connection.send = function (state) {
    if (joinedRoom) {
      joinedRoom.presence(state).catch(function () {});
    }
  };
  connection.close = function () {
    if (joinedRoom) {
      joinedRoom.leave().catch(function () {});
    }
    joinedRoom = null;
  };
  return connection;
}

/* ----------------------------------------------------------------------
   PEERJS CONNECTION (browser to browser)
   The host registers the name "parabolabrava-v2-CODE" in the free PeerJS server;
   each player connects directly to that name. Messages: { type, state }.
   ---------------------------------------------------------------------- */
async function createPeerConnection() {
  const connection = createEmptyConnection('peer', Infinity);
  try {
    if (!window.Peer) {
      await loadScript(PEERJS_LIBRARY_URL);
    }
  } catch (error) {
    return connection; // the library could not be downloaded: start() will say "offline"
  }
  const NAME_START = 'parabolabrava-v2-';
  // another PeerJS server can be chosen in the address (for tests)
  let serverOptions = {};
  if (readAddressOption('peerhost')) {
    serverOptions = {
      host: readAddressOption('peerhost'),
      port: Number(readAddressOption('peerport') || 9000),
      path: readAddressOption('peerpath') || '/',
      secure: readAddressOption('peersecure') === '1',
    };
  }
  let peer = null;
  let myRole;
  let hostLink = null; // player: the link to the host
  let lastSentState = null;
  const playerLinks = {}; // host: PeerJS id → { link, playerId }

  // isNetworkError(type): errors that mean "no internet or no server"
  function isNetworkError(type) {
    const networkErrors = ['network', 'server-error', 'socket-error', 'socket-closed', 'browser-incompatible'];
    return networkErrors.indexOf(type) !== -1;
  }

  connection.start = function (role, code) {
    return new Promise(function (resolve) {
      myRole = role;
      let finished = false;
      function finish(result) {
        if (!finished) {
          finished = true;
          resolve(result);
        }
      }
      if (role === 'host') {
        peer = new window.Peer(NAME_START + code, serverOptions);
        peer.on('open', function () {
          finish({ ok: true });
        });
        peer.on('error', function (error) {
          if (!finished) {
            if (error.type === 'unavailable-id') {
              finish({ ok: false, reason: 'taken' });
            } else if (isNetworkError(error.type)) {
              finish({ ok: false, reason: 'offline' });
            } else {
              finish({ ok: false, reason: 'error' });
            }
          } else if (isNetworkError(error.type)) {
            connection.onDisconnect(error.type);
          }
        });
        // a player connects
        peer.on('connection', function (link) {
          playerLinks[link.peer] = { link: link, playerId: null };
          link.on('open', function () {
            if (lastSentState) {
              try {
                link.send({ type: 'host', state: lastSentState });
              } catch (error) {
                // nothing to do
              }
            }
          });
          link.on('data', function (data) {
            const entry = playerLinks[link.peer];
            if (!entry || !data || data.type !== 'player' || !data.state || typeof data.state !== 'object') {
              return;
            }
            entry.playerId = String(data.state.id || link.peer).slice(0, 24);
            connection.onRemoteState(entry.playerId, data.state);
          });
          function linkClosed() {
            const entry = playerLinks[link.peer];
            delete playerLinks[link.peer];
            if (entry && entry.playerId) {
              connection.onRemoteState(entry.playerId, null);
            }
          }
          link.on('close', linkClosed);
          link.on('error', linkClosed);
        });
        setTimeout(function () {
          finish({ ok: false, reason: 'offline' });
        }, 12000);
      } else {
        peer = new window.Peer(serverOptions);
        peer.on('open', function () {
          hostLink = peer.connect(NAME_START + code, { reliable: true });
          hostLink.on('open', function () {
            if (lastSentState) {
              try {
                hostLink.send({ type: 'player', state: lastSentState });
              } catch (error) {
                // nothing to do
              }
            }
          });
          hostLink.on('data', function (data) {
            if (data && data.type === 'host' && data.state) {
              connection.onRemoteState('host', data.state);
              finish({ ok: true });
            }
          });
          hostLink.on('close', function () {
            if (finished) {
              connection.onRemoteState('host', null);
            } else {
              finish({ ok: false, reason: 'notfound' });
            }
          });
        });
        peer.on('error', function (error) {
          if (!finished) {
            if (error.type === 'peer-unavailable') {
              finish({ ok: false, reason: 'notfound' });
            } else if (isNetworkError(error.type)) {
              finish({ ok: false, reason: 'offline' });
            } else {
              finish({ ok: false, reason: 'error' });
            }
          }
        });
        setTimeout(function () {
          finish({ ok: false, reason: 'notfound' });
        }, 9000);
      }
    });
  };
  connection.send = function (state) {
    lastSentState = state;
    if (myRole === 'host') {
      for (const peerId in playerLinks) {
        const entry = playerLinks[peerId];
        try {
          if (entry.link.open) {
            entry.link.send({ type: 'host', state: state });
          }
        } catch (error) {
          // nothing to do
        }
      }
    } else if (hostLink && hostLink.open) {
      try {
        hostLink.send({ type: 'player', state: state });
      } catch (error) {
        // nothing to do
      }
    }
  };
  connection.kick = function (playerId) {
    for (const peerId in playerLinks) {
      const entry = playerLinks[peerId];
      if (entry.playerId === playerId) {
        // close the link after 1.5 s (so the player first receives the message saying so)
        setTimeout(function () {
          try {
            entry.link.close();
          } catch (error) {
            // nothing to do
          }
        }, 1500);
      }
    }
  };
  connection.close = function () {
    try {
      if (peer) {
        peer.destroy();
      }
    } catch (error) {
      // nothing to do
    }
    peer = null;
  };
  return connection;
}

/* ----------------------------------------------------------------------
   LOCAL CONNECTION (tabs of the same browser, for tests)
   Uses BroadcastChannel: a way for tabs of the same site to send messages to
   each other. Messages: { kind: 'ping' | 'state' | 'bye', from, role, state }.
   ---------------------------------------------------------------------- */
function createLocalConnection() {
  const connection = createEmptyConnection('local', MAX_MESSAGE_SIZE);
  const myTabId = createRandomId();
  const lastSeenTabs = {}; // tab id → last time a message arrived
  const idOfTab = {}; // tab id → player id ('host' for the host)
  let channel = null;
  let myRole;
  let lastSentState = null;
  let heartbeatTimer = null;

  function post(message) {
    try {
      if (channel) {
        channel.postMessage(message);
      }
    } catch (error) {
      // nothing to do
    }
  }
  function postMyState() {
    if (!lastSentState) {
      return;
    }
    let roleName = 'player';
    if (myRole === 'host') {
      roleName = 'host';
    }
    post({ kind: 'state', from: myTabId, role: roleName, state: lastSentState });
  }

  connection.start = function (role, code) {
    return new Promise(function (resolve) {
      myRole = role;
      channel = new BroadcastChannel('pb-online-v2-' + code);
      let anotherHostExists = false;
      let hostSeen = false;
      channel.onmessage = function (event) {
        const message = event.data;
        if (!message || message.from === myTabId) {
          return;
        }
        if (message.kind === 'ping') {
          postMyState();
          return;
        }
        if (message.kind === 'bye') {
          const id = idOfTab[message.from];
          if (id) {
            delete idOfTab[message.from];
            delete lastSeenTabs[message.from];
            connection.onRemoteState(id, null);
          }
          return;
        }
        if (message.kind !== 'state' || !message.state) {
          return;
        }
        if (message.role === 'host') {
          if (myRole === 'host') {
            anotherHostExists = true;
            return;
          }
          hostSeen = true;
          idOfTab[message.from] = 'host';
          lastSeenTabs[message.from] = Date.now();
          connection.onRemoteState('host', message.state);
        } else if (myRole === 'host' && message.role === 'player') {
          const id = String(message.state.id || message.from).slice(0, 24);
          idOfTab[message.from] = id;
          lastSeenTabs[message.from] = Date.now();
          connection.onRemoteState(id, message.state);
        }
      };
      post({ kind: 'ping', from: myTabId });
      let waitTime = 1400;
      if (role === 'host') {
        waitTime = 700;
      }
      setTimeout(function () {
        let failed = !hostSeen;
        let reason = 'notfound';
        if (myRole === 'host') {
          failed = anotherHostExists;
          reason = 'taken';
        }
        if (failed) {
          channel.close();
          channel = null;
          resolve({ ok: false, reason: reason });
          return;
        }
        heartbeatTimer = setInterval(function () {
          postMyState();
          const now = Date.now();
          for (const tabId in lastSeenTabs) {
            if (now - lastSeenTabs[tabId] > 6000) {
              const id = idOfTab[tabId];
              delete lastSeenTabs[tabId];
              delete idOfTab[tabId];
              if (id) {
                connection.onRemoteState(id, null);
              }
            }
          }
        }, 1500);
        resolve({ ok: true });
      }, waitTime);
    });
  };
  connection.send = function (state) {
    lastSentState = state;
    postMyState();
  };
  connection.close = function () {
    post({ kind: 'bye', from: myTabId });
    clearInterval(heartbeatTimer);
    try {
      if (channel) {
        channel.close();
      }
    } catch (error) {
      // nothing to do
    }
    channel = null;
  };
  return connection;
}

/* ----------------------------------------------------------------------
   THE STATE OF THE ONLINE MODE
   ---------------------------------------------------------------------- */

// online: general information about the online game of this browser.
const online = {
  role: null, //                  'host' or 'player' (null = not online)
  connection: null, //            the connection (see above)
  code: null, //                  the 5-character code of the game
  screen: null, //                which online screen is shown (see online-screens.js)
  sendTimer: null, //             timer used to group several sends into one
  renderTimer: null, //           timer used to group several screen redraws into one
  savedScore: 0, //               the score of single player mode, restored when leaving
  buttonWaitingConfirmation: null, // which button asks "Sure? Press again"
  mode: 'class', //               'class' (class game) or 'duel' (1 vs 1)
  joined: false, //               player: true once connected to the host
  episode: 0, //                  player: start time of the game being played
  errorText: '', //               text shown on the error screens
  finalScore: 0, //               player: score when the game ended
};

// hostState: what the host keeps (and sends to everyone).
const hostState = {
  status: 'lobby', //   'lobby', 'playing', 'ended'; in duels also 'hiding' and 'roundEnd'
  episode: 0, //        start time of the current game or round
  rules: null, //       the levels and rules chosen (see online-screens.js)
  kickedIds: [], //     ids of the removed players
  guestId: null, //     duel: id of the rival
  round: 0, //          duel: number of the current round (0 = first)
  roundWinners: [], //  duel: id of the winner of each round
  winnerId: null, //    duel: id of the winner of the duel (null = tie)
};

// hostPlayers: the players seen by the host, by id: hostPlayers['abc123'] = { ... }
const hostPlayers = {};

// myPlayer: my own state as a player (in duels the host plays too).
const myPlayer = {
  id: createRandomId(),
  name: '',
  status: 'waiting', //  'waiting', 'playing' or 'done'
  levelIndex: -1, //     the level being played (0 = first)
  levelCount: 0, //      how many levels I have to play
  score: 0,
  attempts: 0, //        attempts used in the current level
  levelResults: [], //   result of each level: { level, result, points, attempts, seconds }
  levelOrder: [], //     which levels of the host list I play, in order
  events: [], //         the last answers, shots and level ends (see addPlayerEvent)
  eventCounter: 0, //    number of the last event
};

// lastHostState: the last state of the host received by this player.
let lastHostState = null;
// detailPlayerId: the player whose details the host is viewing (or null).
let detailPlayerId = null;

// DEFAULT_RULES: the starting values of the "Game rules" screen.
const DEFAULT_RULES = {
  attempts: -1, //               -1 = each level's own, 0 = unlimited, n = at most n
  attemptsNumber: 3, //          the n of "at most n"
  timeLimit: 0, //               seconds per level (0 = no limit)
  differentLevels: 0, //         levels per player chosen at random (0 = everyone the same)
  differentLevelsNumber: 2, //   the number typed for "different per player"
  differentValues: false, //     each player gets different values
  practiceAllowed: false,
  showLeaderboard: true,
  lateJoinAllowed: false,
};

// clearObject(object): deletes every field of an object (keeping the same object).
function clearObject(object) {
  for (const key in object) {
    delete object[key];
  }
}

// resetMyPlayer(): my player state back to the start (the id and name are kept).
function resetMyPlayer() {
  myPlayer.status = 'waiting';
  myPlayer.levelIndex = -1;
  myPlayer.levelCount = 0;
  myPlayer.score = 0;
  myPlayer.attempts = 0;
  myPlayer.levelResults = [];
  myPlayer.levelOrder = [];
  myPlayer.events = [];
  myPlayer.eventCounter = 0;
}

// resetOnline(): closes the connection and clears every online state.
function resetOnline() {
  if (online.connection) {
    try {
      online.connection.close();
    } catch (error) {
      // nothing to do
    }
  }
  online.role = null;
  online.connection = null;
  online.code = null;
  online.screen = null;
  online.buttonWaitingConfirmation = null;
  online.joined = false;
  online.episode = 0;
  online.mode = 'class';
  hostState.status = 'lobby';
  hostState.episode = 0;
  hostState.rules = null;
  hostState.kickedIds = [];
  hostState.guestId = null;
  hostState.round = 0;
  hostState.roundWinners = [];
  hostState.winnerId = null;
  resetDuelLocalState();
  duelState.phaseKey = '';
  getElement('rivalStatusBar').hidden = true;
  clearObject(hostPlayers);
  lastHostState = null;
  detailPlayerId = null;
  resetMyPlayer();
  getElement('playerDetailWindow').hidden = true;
  getElement('countdownOverlay').hidden = true;
}

// versionWarningsShown: the people already warned about a different version.
const versionWarningsShown = {};

// checkOtherVersion(id, name, version): warns (once per person) if someone in the game
// uses another version of the game.
function checkOtherVersion(id, name, version) {
  if (!version || version === APP_VERSION || versionWarningsShown[id]) {
    return;
  }
  versionWarningsShown[id] = true;
  showToast(
    translate(
      `${name} usa la versión ${version} y tú la ${APP_VERSION}. Actualicen en Configuración para evitar diferencias.`,
      `${name} is on version ${version} and you are on ${APP_VERSION}. Update in Settings to avoid differences.`,
    ),
  );
}

// showToast(text): a small notice that appears at the bottom for 3.8 seconds.
function showToast(text) {
  const toastArea = getElement('toastArea');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = text;
  toastArea.appendChild(toast);
  setTimeout(function () {
    toast.remove();
  }, 3800);
  // at most 4 notices at the same time
  while (toastArea.children.length > 4) {
    toastArea.firstChild.remove();
  }
}

// getConnectionErrorText(reason): the text that explains why the connection failed.
function getConnectionErrorText(reason) {
  if (reason === 'taken') {
    return translate('Ese código ya está en uso.', 'That code is already in use.');
  }
  if (reason === 'notfound') {
    return translate(
      'No encontré ninguna partida con ese código. Revisa que el host la haya creado y que el código esté bien escrito.',
      'No game found with that code. Check that the host has created it and the code is typed correctly.',
    );
  }
  if (reason === 'offline') {
    return translate(
      'No se pudo conectar al servicio en línea. Revisa tu conexión a internet.',
      'Couldn’t connect to the online service. Check your internet connection.',
    );
  }
  if (reason === 'denied') {
    return translate(
      'Esta página no permite partidas en línea para tu cuenta. Pide al dueño que te comparta el juego.',
      'This page doesn’t allow online games for your account. Ask the owner to share the game with you.',
    );
  }
  if (reason === 'error') {
    return translate('Algo falló al conectar. Inténtalo de nuevo.', 'Something went wrong while connecting. Try again.');
  }
  return translate('Algo falló al conectar.', 'Something went wrong while connecting.');
}
