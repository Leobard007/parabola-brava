/* ======================================================================
   ARCHIVO: js/1-nucleo/sonido.js

   EFECTOS DE SONIDO
   Los sonidos se crean con la Web Audio API del navegador: son ondas generadas al
   momento (no hay archivos .mp3). Cada efecto combina "tonos" con:
     frecuencia inicial y final (Hz), duración (s), tipo de onda y volumen.
   Para cambiar un sonido, modifica esos números. Para silenciar el juego por defecto,
   cambia sound: true por sound: false en js/1-nucleo/idioma.js.
   ====================================================================== */

/* =========================================================
   SONIDO (sintetizado en el navegador)
   ========================================================= */

// Efectos de sonido sintetizados con la Web Audio API (no hay archivos de audio).
// Cada efecto es una función: SND.launch(), SND.pop(), SND.win()...
// Para cambiar un sonido, modifica sus frecuencias (Hz), duración (s) o volumen.
const SND = (() => {
  // (() => { ... })() ejecuta este bloque una sola vez y guarda lo que devuelve en SND
  let ac = null; // el "contexto de audio": se crea la primera vez que suena algo
  const get = () => {
    if (!SET.sound) return null;
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return null;
      }
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  };
  // tone(): un tono que va de la frecuencia f0 a f1 (Hz) en dur segundos.
  //   type = forma de onda: 'sine' (suave), 'triangle', 'square' o 'sawtooth' (más áspera)
  const tone = (f0, f1, dur, type = 'sine', vol = 0.18, delay = 0) => {
    const a = get();
    if (!a) return;
    const t0 = a.currentTime + delay,
      o = a.createOscillator(),
      gn = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(gn).connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  };
  // noise(): ruido filtrado alrededor de freq (Hz); sirve para golpes, crujidos y "whoosh".
  const noise = (dur, freq, vol = 0.2, delay = 0, q = 1) => {
    const a = get();
    if (!a) return;
    const t0 = a.currentTime + delay,
      n = Math.max(1, Math.floor(a.sampleRate * dur));
    const buf = a.createBuffer(1, n, a.sampleRate),
      d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const src = a.createBufferSource(),
      bf = a.createBiquadFilter(),
      gn = a.createGain();
    src.buffer = buf;
    bf.type = 'bandpass';
    bf.frequency.value = freq;
    bf.Q.value = q;
    gn.gain.value = vol;
    src.connect(bf).connect(gn).connect(a.destination);
    src.start(t0);
  };
  // La lista de efectos. Cada uno combina tonos y ruidos:
  return {
    launch: () => {
      noise(0.32, 900, 0.3, 0, 0.6);
      tone(200, 480, 0.22, 'triangle', 0.07);
    },
    thud: () => {
      tone(150, 50, 0.26, 'sine', 0.32);
      noise(0.1, 300, 0.15);
    },
    wood: () => {
      noise(0.16, 1700, 0.32, 0, 2);
      tone(320, 120, 0.1, 'square', 0.05);
    },
    stone: () => {
      noise(0.24, 650, 0.34, 0, 1.4);
      tone(170, 60, 0.2, 'sawtooth', 0.06);
    },
    crack: () => noise(0.08, 2500, 0.2, 0, 3),
    pop: () => {
      tone(480, 1150, 0.14, 'sine', 0.2);
      tone(900, 1800, 0.12, 'triangle', 0.09, 0.05);
    },
    good: () => {
      tone(660, 660, 0.13, 'triangle', 0.18);
      tone(880, 880, 0.24, 'triangle', 0.18, 0.12);
    },
    bad: () => tone(220, 130, 0.32, 'sawtooth', 0.08),
    win: () => [523, 659, 784, 1047].forEach((fq, i) => tone(fq, fq, 0.24, 'triangle', 0.15, i * 0.1)),
    click: () => tone(1100, 850, 0.05, 'square', 0.035),
    puff: () => noise(0.3, 1200, 0.14, 0, 0.8),
  };
})();
