/* ======================================================================
   ARCHIVO: js/5-online/red.js

   MODO ONLINE: CONEXIÓN
   El navegador del HOST hace de "servidor": guarda las reglas y recibe el progreso de cada jugador.
   Hay tres formas de conectar (todas con las mismas funciones, por eso el resto del código
   no necesita saber cuál se usa):
     - netMqtt:  servidor MQTT público. Es la principal fuera de claude.ai: funciona entre
                 dispositivos y redes distintas porque todo pasa por el servidor.
     - netPeer:  PeerJS / WebRTC (conexión directa). Respaldo si MQTT no conecta.
     - netRoom:  salas en tiempo real de claude.ai (solo dentro de claude.ai).
     - netLocal: pestañas del mismo navegador, para probar (añade ?net=local a la dirección).
   Cada participante envía su ESTADO COMPLETO cada vez que cambia (no mensajes sueltos);
   así, si un mensaje se pierde, el siguiente lo corrige.
   ====================================================================== */

/* =========================================================
   MODO ONLINE
   El navegador del host hace de servidor: guarda reglas y estado,
   y recibe el progreso de cada jugador.
   Transportes: salas de claude.ai (room) · PeerJS (WebRTC, p. ej. GitHub Pages) · local (pestañas del mismo navegador)
   ========================================================= */

// Espera ms milisegundos (se usa con await: await sleep(500)).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Escapa un texto para meterlo en HTML sin riesgo (evita que un nombre como <b> rompa la página).
const esc = (s) =>
  String(s == null ? '' : s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

// Caracteres permitidos en los códigos de partida (sin O/0 ni I/1 para no confundirlos).
const CODE_CH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// Genera un código de partida de 5 caracteres (ej. "K7QX2").
const newCode = () =>
  Array.from({ length: 5 }, () => CODE_CH[Math.floor(Math.random() * CODE_CH.length)]).join('');

// Genera un identificador aleatorio.
const rid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);

// Segundos → "m:ss". Ejemplo: fmtTime(75) → "1:15".
const fmtTime = (s) => {
  s = Math.max(0, Math.round(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Convierte un texto en un número ("hash"); se usa como semilla del generador aleatorio.
function hashStr(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

// Generador de números aleatorios REPETIBLE: con la misma semilla da siempre los mismos números.
// Así cada jugador recibe sus valores "al azar" pero el resultado no cambia si recarga.
function rng(seed) {
  let a = hashStr(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tamaño máximo (en caracteres) del estado que cada participante puede enviar en las salas de claude.ai.
const MAX_STATE = 3800; // límite de las salas de claude.ai (4 KiB por participante)

/* ---------- transportes ---------- */
// Carga un archivo JavaScript externo (se usa para cargar PeerJS solo cuando hace falta).
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

// Elige cómo conectarse:
//   - dentro de claude.ai → salas de Claude (netRoom)
//   - en cualquier otra web (p. ej. GitHub Pages) → primero MQTT (dos servidores públicos) y, si no se puede, PeerJS
//   - con ?net=local en la dirección → pestañas del mismo navegador (netLocal, para pruebas)
// Todas devuelven un objeto con las mismas funciones: start, send, close, kick, onRemote.
async function makeNet() {
  let q = null;
  try {
    q = new URLSearchParams(location.search);
  } catch (e) {}
  const forced = q && q.get('net');
  if (forced === 'local' || window.__pbNet === 'local') return netLocal();
  if (!forced && window.claude && typeof window.claude.use === 'function') {
    try {
      const room = await window.claude.use('room');
      if (room && typeof room.join === 'function') return netRoom(room);
    } catch (e) {}
  }
  // ?mqtt=wss://mi-servidor:8084/mqtt permite usar otro servidor MQTT (útil para pruebas)
  const brokers = q && q.get('mqtt') ? [q.get('mqtt')] : MQTT_BROKERS;
  const list = [];
  if (forced !== 'peer') brokers.forEach((url) => list.push(() => netMqtt(url)));
  if (forced !== 'mqtt') list.push(() => netPeer());
  return netAuto(list);
}

/* Servidores MQTT públicos y gratuitos (con WebSocket seguro). Se prueban en este orden.
   Puedes añadir el tuyo (por ejemplo un Mosquitto propio) al principio de la lista. */

// Lista de servidores MQTT públicos que se prueban en orden.
const MQTT_BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];

/* netAuto: prueba varias conexiones en orden y se queda con la primera que funciona.
   - El HOST usa la primera a la que logra conectarse.
   - El JUGADOR busca la partida en cada una hasta encontrarla
     (por si el host tuvo que usar la segunda o la de respaldo). */

// Prueba varias conexiones en orden y usa la primera que funcione (ver la explicación arriba).
function netAuto(makers) {
  const api = { kind: 'auto', limit: Infinity, onRemote() {}, onDrop() {}, onTry() {} };
  let cur = null;
  api.start = async (role, code) => {
    let sawNotFound = false;
    for (let i = 0; i < makers.length; i++) {
      api.onTry(i + 1, makers.length);
      let net;
      try {
        net = await makers[i]();
      } catch (e) {
        continue;
      }
      net.onRemote = (id, s) => api.onRemote(id, s);
      net.onDrop = (c) => api.onDrop(c);
      const res = await net.start(role, code);
      if (res.ok) {
        cur = net;
        api.kind = net.kind;
        api.limit = net.limit;
        return res;
      }
      try {
        net.close();
      } catch (e) {}
      if (res.reason === 'taken') return res;
      if (res.reason === 'notfound') sawNotFound = true;
    }
    return { ok: false, reason: sawNotFound ? 'notfound' : 'offline' };
  };
  api.send = (s) => {
    if (cur) cur.send(s);
  };
  api.kick = (id) => {
    if (cur) cur.kick(id);
  };
  api.close = () => {
    if (cur) cur.close();
    cur = null;
  };
  return api;
}

/* netMqtt: los mensajes pasan por un servidor MQTT (como los que usan los ESP32).
   Cada participante publica su estado completo en su propio "tema" (topic):
     parabolabrava/v1/CÓDIGO/h        → estado del host
     parabolabrava/v1/CÓDIGO/p/ID     → estado de cada jugador
   Los mensajes son "retenidos": quien llega tarde recibe al instante el último estado.
   El "testamento" (will) borra el estado si alguien se desconecta de golpe. */

// Conexión a través de un servidor MQTT público (funciona entre dispositivos y redes distintas).
async function netMqtt(url) {
  const api = { kind: 'mqtt', limit: Infinity, onRemote() {}, onDrop() {} };
  if (!window.mqtt) await loadScript('https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js');
  const BASE = 'parabolabrava/v1/';
  const STALE = 5 * 60 * 1000; // un estado del host con más de 5 min sin latido se considera abandonado
  let cli = null,
    role,
    code,
    last = null,
    hb = null,
    mine = null;
  const seen = new Map();
  const pub = (topic, obj) => {
    if (cli && cli.connected) cli.publish(topic, obj ? JSON.stringify(obj) : '', { retain: true, qos: 0 });
  };
  api.start = (r, c) =>
    new Promise((resolve) => {
      role = r;
      code = c;
      const base = BASE + c + '/';
      mine = r === 'host' ? base + 'h' : base + 'p/' + ME.id;
      let done = false,
        hostSeen = false,
        otherHost = false;
      const fin = (v) => {
        if (!done) {
          done = true;
          resolve(v);
        }
      };
      try {
        cli = window.mqtt.connect(url, {
          clientId: 'pb_' + rid(),
          clean: true,
          connectTimeout: 7000,
          reconnectPeriod: 3000,
          will: { topic: mine, payload: '', retain: true, qos: 0 },
        });
      } catch (e) {
        fin({ ok: false, reason: 'offline' });
        return;
      }
      cli.on('message', (topic, payload) => {
        const txt = payload ? payload.toString() : '';
        let s = null;
        if (txt) {
          try {
            s = JSON.parse(txt);
          } catch (e) {
            return;
          }
        }
        if (topic === base + 'h') {
          if (role === 'host') {
            if (s && s.hb && Date.now() - s.hb < STALE) otherHost = true;
            return;
          }
          if (!s) {
            if (hostSeen) api.onRemote('host', null);
            return;
          }
          if (s.hb && Date.now() - s.hb > STALE) return;
          hostSeen = true;
          api.onRemote('host', s);
        } else if (role === 'host' && topic.startsWith(base + 'p/')) {
          const id = topic.slice((base + 'p/').length).slice(0, 24);
          if (!s) {
            if (seen.has(id)) {
              seen.delete(id);
              api.onRemote(id, null);
            }
            return;
          }
          seen.set(id, Date.now());
          api.onRemote(id, s);
        }
      });
      cli.on('connect', () => {
        if (done) {
          if (last) pub(mine, last);
          return;
        } // reconexión: vuelve a publicar
        cli.subscribe(role === 'host' ? [base + 'h', base + 'p/+'] : [base + 'h'], { qos: 0 }, (err) => {
          if (err) {
            fin({ ok: false, reason: 'error' });
            return;
          }
          setTimeout(
            () => {
              if (role === 'host') {
                if (otherHost) {
                  fin({ ok: false, reason: 'taken' });
                  return;
                }
                hb = setInterval(() => {
                  if (last) {
                    last = { ...last, hb: Date.now() };
                    pub(mine, last);
                  }
                  const now = Date.now(); // jugadores sin latido en 45 s → desconectados
                  seen.forEach((t, id) => {
                    if (now - t > 45000) {
                      seen.delete(id);
                      api.onRemote(id, null);
                    }
                  });
                }, 15000);
                fin({ ok: true });
              } else {
                if (!hostSeen) {
                  fin({ ok: false, reason: 'notfound' });
                  return;
                }
                hb = setInterval(() => {
                  if (last) pub(mine, last);
                }, 15000);
                fin({ ok: true });
              }
            },
            role === 'host' ? 1200 : 2500,
          );
        });
      });
      cli.on('error', () => {
        if (!done) fin({ ok: false, reason: 'offline' });
      });
      cli.on('close', () => {
        if (!done) {
          fin({ ok: false, reason: 'offline' });
          try {
            cli.end(true);
          } catch (e) {}
        }
      });
      cli.on('offline', () => {
        if (done) api.onDrop('offline');
      });
      setTimeout(() => fin({ ok: false, reason: 'offline' }), 9000);
    });
  api.send = (s) => {
    last = role === 'host' ? { ...s, hb: Date.now() } : s;
    pub(mine, last);
  };
  api.kick = () => {};
  api.close = () => {
    clearInterval(hb);
    if (cli) {
      try {
        pub(mine, null);
        cli.end(false);
      } catch (e) {}
    }
    cli = null;
  };
  return api;
}

// Conexión mediante las salas en tiempo real de claude.ai.
function netRoom(room) {
  const api = { kind: 'room', limit: MAX_STATE, onRemote() {}, onDrop() {} };
  let nr = null,
    role,
    code;
  const ids = new Map();
  const isHost = (s) => s && s.r === 'h' && s.code === code;
  function onPeers(ch) {
    for (const p of ch.peers) {
      if (p.sameTab) continue;
      const s = p.presence || {};
      if (role === 'host' ? !(s.r === 'p' && s.code === code) : !isHost(s)) continue;
      const id = role === 'host' ? String(s.id || p.peer).slice(0, 24) : 'host';
      ids.set(p.peer, id);
      api.onRemote(id, s);
    }
    for (const p of ch.left) {
      const id = ids.get(p.peer);
      if (id) {
        ids.delete(p.peer);
        api.onRemote(id, null);
      }
    }
  }
  api.start = async (r, c) => {
    role = r;
    code = c;
    try {
      nr = await room.join('pb-' + c.toLowerCase());
    } catch (e) {
      return { ok: false, reason: e && e.code === 'not_permitted' ? 'denied' : 'error' };
    }
    nr.onPeers(onPeers, (e) => api.onDrop(e.code));
    const hostHere = () => nr.peers().some((p) => !p.sameTab && isHost(p.presence));
    if (r === 'host') {
      await sleep(1500);
      if (hostHere()) {
        await nr.leave().catch(() => {});
        nr = null;
        return { ok: false, reason: 'taken' };
      }
      return { ok: true };
    }
    for (let i = 0; i < 40; i++) {
      if (hostHere()) return { ok: true };
      await sleep(150);
    }
    await nr.leave().catch(() => {});
    nr = null;
    return { ok: false, reason: 'notfound' };
  };
  api.send = (s) => {
    if (nr) nr.presence(s).catch(() => {});
  };
  api.kick = () => {};
  api.close = () => {
    if (nr) nr.leave().catch(() => {});
    nr = null;
  };
  return api;
}

// Conexión mediante PeerJS (WebRTC): el navegador del host recibe una conexión directa de cada jugador.
// El servidor gratuito de PeerJS solo sirve para "presentar" a los dispositivos al principio.
async function netPeer() {
  const api = { kind: 'peer', limit: Infinity, onRemote() {}, onDrop() {} };
  try {
    if (!window.Peer) await loadScript('https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js');
  } catch (e) {
    api.start = async () => ({ ok: false, reason: 'offline' });
    api.send = () => {};
    api.close = () => {};
    api.kick = () => {};
    return api;
  }
  const PFX = 'parabolabrava-v1-';
  let opts = {};
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('peerhost'))
      opts = {
        host: q.get('peerhost'),
        port: +(q.get('peerport') || 9000),
        path: q.get('peerpath') || '/',
        secure: q.get('peersecure') === '1',
      };
  } catch (e) {}
  let peer = null,
    role,
    hostConn = null,
    last = null;
  const conns = new Map();
  api.start = (r, c) =>
    new Promise((resolve) => {
      role = r;
      let done = false;
      const fin = (v) => {
        if (!done) {
          done = true;
          resolve(v);
        }
      };
      const netErr = (t) =>
        ['network', 'server-error', 'socket-error', 'socket-closed', 'browser-incompatible'].includes(t);
      if (r === 'host') {
        peer = new window.Peer(PFX + c, opts);
        peer.on('open', () => fin({ ok: true }));
        peer.on('error', (e) => {
          if (!done)
            fin({
              ok: false,
              reason: e.type === 'unavailable-id' ? 'taken' : netErr(e.type) ? 'offline' : 'error',
            });
          else if (netErr(e.type)) api.onDrop(e.type);
        });
        peer.on('connection', (conn) => {
          conns.set(conn.peer, { conn, id: null });
          conn.on('open', () => {
            if (last)
              try {
                conn.send({ t: 'h', s: last });
              } catch (x) {}
          });
          conn.on('data', (d) => {
            const ent = conns.get(conn.peer);
            if (!ent || !d || d.t !== 'p' || !d.s || typeof d.s !== 'object') return;
            ent.id = String(d.s.id || conn.peer).slice(0, 24);
            api.onRemote(ent.id, d.s);
          });
          const gone = () => {
            const ent = conns.get(conn.peer);
            conns.delete(conn.peer);
            if (ent && ent.id) api.onRemote(ent.id, null);
          };
          conn.on('close', gone);
          conn.on('error', gone);
        });
        setTimeout(() => fin({ ok: false, reason: 'offline' }), 12000);
      } else {
        peer = new window.Peer(opts);
        peer.on('open', () => {
          hostConn = peer.connect(PFX + c, { reliable: true });
          hostConn.on('open', () => {
            if (last)
              try {
                hostConn.send({ t: 'p', s: last });
              } catch (x) {}
          });
          hostConn.on('data', (d) => {
            if (d && d.t === 'h' && d.s) {
              api.onRemote('host', d.s);
              fin({ ok: true });
            }
          });
          hostConn.on('close', () => {
            if (done) api.onRemote('host', null);
            else fin({ ok: false, reason: 'notfound' });
          });
        });
        peer.on('error', (e) => {
          if (!done)
            fin({
              ok: false,
              reason: e.type === 'peer-unavailable' ? 'notfound' : netErr(e.type) ? 'offline' : 'error',
            });
        });
        setTimeout(() => fin({ ok: false, reason: 'notfound' }), 9000);
      }
    });
  api.send = (s) => {
    last = s;
    if (role === 'host')
      conns.forEach((e) => {
        try {
          if (e.conn.open) e.conn.send({ t: 'h', s });
        } catch (x) {}
      });
    else if (hostConn && hostConn.open)
      try {
        hostConn.send({ t: 'p', s });
      } catch (x) {}
  };
  api.kick = (id) =>
    conns.forEach((e) => {
      if (e.id === id)
        setTimeout(() => {
          try {
            e.conn.close();
          } catch (x) {}
        }, 1500);
    });
  api.close = () => {
    try {
      if (peer) peer.destroy();
    } catch (e) {}
    peer = null;
  };
  return api;
}

// Conexión entre pestañas del mismo navegador (BroadcastChannel). Útil para probar sin internet.
// Abre el juego con ?net=local al final de la dirección.
function netLocal() {
  const api = { kind: 'local', limit: MAX_STATE, onRemote() {}, onDrop() {} };
  const me = rid(),
    seen = new Map(),
    idOf = new Map();
  let bc = null,
    role,
    last = null,
    hb = null;
  const post = (m) => {
    try {
      bc && bc.postMessage(m);
    } catch (e) {}
  };
  const mine = () => last && { k: 'st', from: me, role: role === 'host' ? 'h' : 'p', s: last };
  api.start = (r, c) =>
    new Promise((resolve) => {
      role = r;
      bc = new BroadcastChannel('pb-online-' + c);
      let otherHost = false,
        hostSeen = false;
      bc.onmessage = (ev) => {
        const m = ev.data;
        if (!m || m.from === me) return;
        if (m.k === 'ping') {
          if (last) post(mine());
          return;
        }
        if (m.k === 'bye') {
          const id = idOf.get(m.from);
          if (id) {
            idOf.delete(m.from);
            seen.delete(m.from);
            api.onRemote(id, null);
          }
          return;
        }
        if (m.k !== 'st' || !m.s) return;
        if (m.role === 'h') {
          if (role === 'host') {
            otherHost = true;
            return;
          }
          hostSeen = true;
          idOf.set(m.from, 'host');
          seen.set(m.from, Date.now());
          api.onRemote('host', m.s);
        } else if (role === 'host' && m.role === 'p') {
          const id = String(m.s.id || m.from).slice(0, 24);
          idOf.set(m.from, id);
          seen.set(m.from, Date.now());
          api.onRemote(id, m.s);
        }
      };
      post({ k: 'ping', from: me });
      setTimeout(
        () => {
          if (role === 'host' ? otherHost : !hostSeen) {
            bc.close();
            bc = null;
            resolve({ ok: false, reason: role === 'host' ? 'taken' : 'notfound' });
            return;
          }
          hb = setInterval(() => {
            if (last) post(mine());
            const now = Date.now();
            seen.forEach((t, from) => {
              if (now - t > 6000) {
                const id = idOf.get(from);
                seen.delete(from);
                idOf.delete(from);
                if (id) api.onRemote(id, null);
              }
            });
          }, 1500);
          resolve({ ok: true });
        },
        role === 'host' ? 700 : 1400,
      );
    });
  api.send = (s) => {
    last = s;
    post(mine());
  };
  api.kick = () => {};
  api.close = () => {
    post({ k: 'bye', from: me });
    clearInterval(hb);
    try {
      bc && bc.close();
    } catch (e) {}
    bc = null;
  };
  return api;
}

/* ---------- estado ---------- */
// Estado general del modo online: rol ('host' o 'player'), conexión, código y pantalla actual.
const ON = {
  role: null,
  net: null,
  code: null,
  view: null,
  sendT: null,
  renderT: null,
  savedScore: 0,
  confirm: null,
  md: 'class',
};

// Estado del HOST: fase de la partida ('lobby', 'play', 'end'), configuración elegida y jugadores expulsados.
const HS = { st: 'lobby', ep: 0, cfg: null, kick: [], g: null, rd: 0, rw: [], win: null }; // estado del host

// Jugadores que ve el host (Map: id → datos del jugador).
const HP = new Map(); // jugadores vistos por el host

// Datos de ESTE jugador: nombre, estado, nivel, puntos, resultados por nivel y últimos eventos.
const ME = { id: rid(), name: '', st: 'wait', li: -1, k: 0, sc: 0, at: 0, lv: [], ix: [], ev: [], q: 0 };

// Último estado del host que recibió el jugador.
let RH = null; // último estado del host recibido por el jugador

// Jugador cuyo detalle tiene abierto el host.
let DETAIL = null; // jugador abierto en el panel del host

// Reglas por defecto de una partida nueva.
//   at: intentos (-1 = los del nivel, 0 = ilimitados, n = máximo) · tm: segundos por nivel (0 = sin límite)
//   dl: niveles distintos por jugador (0 = todos iguales) · vv: valores distintos · pr: modo práctica
//   bd: tabla de posiciones · lt: permitir entrar tarde
const DEFAULT_RULES = { at: -1, atN: 3, tm: 0, dl: 0, dlN: 2, vv: false, pr: false, bd: true, lt: false };

// Cierra la conexión y borra todo el estado online.
function resetOnline() {
  if (ON.net)
    try {
      ON.net.close();
    } catch (e) {}
  Object.assign(ON, {
    role: null,
    net: null,
    code: null,
    view: null,
    confirm: null,
    joined: false,
    ep: 0,
    md: 'class',
  });
  Object.assign(HS, { st: 'lobby', ep: 0, cfg: null, kick: [], g: null, rd: 0, rw: [], win: null });
  duelResetLocal();
  DU.key = '';
  $('rivalBar').hidden = true;
  HP.clear();
  RH = null;
  DETAIL = null;
  Object.assign(ME, { st: 'wait', li: -1, k: 0, sc: 0, at: 0, lv: [], ix: [], ev: [], q: 0 });
  $('onDetail').hidden = true;
  $('countdown').hidden = true;
}

// Muestra un aviso temporal en la parte inferior de la pantalla.
function toast(text) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  $('toasts').appendChild(t);
  setTimeout(() => t.remove(), 3800);
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
}

// Texto que explica por qué falló una conexión.
const reasonText = (r) =>
  ({
    taken: L('Ese código ya está en uso.', 'That code is already in use.'),
    notfound: L(
      'No encontré ninguna partida con ese código. Revisa que el host la haya creado y que el código esté bien escrito.',
      'No game found with that code. Check that the host has created it and the code is typed correctly.',
    ),
    offline: L(
      'No se pudo conectar al servicio en línea. Revisa tu conexión a internet.',
      'Couldn’t connect to the online service. Check your internet connection.',
    ),
    denied: L(
      'Esta página no permite partidas en línea para tu cuenta. Pide al dueño que te comparta el juego.',
      'This page doesn’t allow online games for your account. Ask the owner to share the game with you.',
    ),
    error: L(
      'Algo falló al conectar. Inténtalo de nuevo.',
      'Something went wrong while connecting. Try again.',
    ),
  })[r] || L('Algo falló al conectar.', 'Something went wrong while connecting.');
