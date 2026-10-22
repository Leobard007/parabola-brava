/* ======================================================================
   FILE: js/1-core/sound.js

   SOUND EFFECTS
   The sounds are created with the browser's "Web Audio API": they are waves
   generated at the moment (there are no .mp3 files). Every effect mixes:
     - tones: a note that slides from one frequency to another
     - noise: a short burst of "shhh" filtered around a frequency (hits, cracks)
   To change a sound, change the numbers in its function at the end of this file.
   To start the game with the sound off, change soundEffects: true to false
   in js/1-core/language.js.
   ====================================================================== */

// audioContext: the "audio engine" of the browser. It is created the first time a sound
// plays (browsers only allow sound after the person has touched the page).
let audioContext = null;

// getAudioContext(): returns the audio engine ready to play, or null when the
// sound effects are turned off or the browser has no audio.
function getAudioContext() {
  if (!settings.soundEffects) {
    return null;
  }
  if (!audioContext) {
    try {
      // window.AudioContext is the standard name; webkitAudioContext is the name in old Safari
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioContextClass();
    } catch (error) {
      return null;
    }
  }
  // some browsers start the engine "suspended" until the user interacts with the page
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

// playTone(startFrequency, endFrequency, duration, waveShape, volume, delay):
// plays a note that slides from startFrequency to endFrequency (in hertz) during
// duration seconds.
//   waveShape: 'sine' (soft), 'triangle', 'square' or 'sawtooth' (harsher)
//   volume:    0 = silent, 1 = very loud (the game uses small values like 0.18)
//   delay:     seconds to wait before it starts
function playTone(startFrequency, endFrequency, duration, waveShape, volume, delay) {
  const audio = getAudioContext();
  if (!audio) {
    return;
  }
  if (waveShape === undefined) {
    waveShape = 'sine';
  }
  if (volume === undefined) {
    volume = 0.18;
  }
  if (delay === undefined) {
    delay = 0;
  }
  const startTime = audio.currentTime + delay;
  // the oscillator makes the wave; the gain node controls its volume
  const oscillator = audio.createOscillator();
  const volumeControl = audio.createGain();
  oscillator.type = waveShape;
  oscillator.frequency.setValueAtTime(startFrequency, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), startTime + duration);
  // the volume rises very fast and then fades out (this avoids "clicks")
  volumeControl.gain.setValueAtTime(0.0001, startTime);
  volumeControl.gain.exponentialRampToValueAtTime(volume, startTime + 0.012);
  volumeControl.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  // connect: oscillator → volume control → speakers
  oscillator.connect(volumeControl);
  volumeControl.connect(audio.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.03);
}

// playNoise(duration, frequency, volume, delay, sharpness): plays a burst of noise that
// fades out, filtered around frequency (hertz). Used for hits, cracks and "whoosh".
//   sharpness: how narrow the filter is (higher = more "pitched")
function playNoise(duration, frequency, volume, delay, sharpness) {
  const audio = getAudioContext();
  if (!audio) {
    return;
  }
  if (volume === undefined) {
    volume = 0.2;
  }
  if (delay === undefined) {
    delay = 0;
  }
  if (sharpness === undefined) {
    sharpness = 1;
  }
  const startTime = audio.currentTime + delay;
  // number of audio samples needed for this duration
  const sampleCount = Math.max(1, Math.floor(audio.sampleRate * duration));
  // fill a buffer with random numbers (noise) that get quieter towards the end
  const noiseBuffer = audio.createBuffer(1, sampleCount, audio.sampleRate);
  const samples = noiseBuffer.getChannelData(0);
  for (let index = 0; index < sampleCount; index++) {
    const fadeOut = Math.pow(1 - index / sampleCount, 2);
    samples[index] = (Math.random() * 2 - 1) * fadeOut;
  }
  const noiseSource = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const volumeControl = audio.createGain();
  noiseSource.buffer = noiseBuffer;
  filter.type = 'bandpass'; // only lets through the sounds near "frequency"
  filter.frequency.value = frequency;
  filter.Q.value = sharpness;
  volumeControl.gain.value = volume;
  // connect: noise → filter → volume control → speakers
  noiseSource.connect(filter);
  filter.connect(volumeControl);
  volumeControl.connect(audio.destination);
  noiseSource.start(startTime);
}

/* ----------------------------------------------------------------------
   THE SOUND EFFECTS OF THE GAME
   ---------------------------------------------------------------------- */

// The projectile is launched (a "whoosh" plus a rising note)
function playLaunchSound() {
  playNoise(0.32, 900, 0.3, 0, 0.6);
  playTone(200, 480, 0.22, 'triangle', 0.07);
}
// The projectile hits the ground or the terrain
function playThudSound() {
  playTone(150, 50, 0.26, 'sine', 0.32);
  playNoise(0.1, 300, 0.15);
}
// A wood block breaks
function playWoodBreakSound() {
  playNoise(0.16, 1700, 0.32, 0, 2);
  playTone(320, 120, 0.1, 'square', 0.05);
}
// A stone block breaks
function playStoneBreakSound() {
  playNoise(0.24, 650, 0.34, 0, 1.4);
  playTone(170, 60, 0.2, 'sawtooth', 0.06);
}
// A stone block cracks but does not break yet
function playCrackSound() {
  playNoise(0.08, 2500, 0.2, 0, 3);
}
// A piglet is knocked down
function playPopSound() {
  playTone(480, 1150, 0.14, 'sine', 0.2);
  playTone(900, 1800, 0.12, 'triangle', 0.09, 0.05);
}
// A correct answer
function playCorrectSound() {
  playTone(660, 660, 0.13, 'triangle', 0.18);
  playTone(880, 880, 0.24, 'triangle', 0.18, 0.12);
}
// A wrong answer or a lost level
function playWrongSound() {
  playTone(220, 130, 0.32, 'sawtooth', 0.08);
}
// A level is won: four notes going up (C, E, G, high C)
function playWinSound() {
  const notes = [523, 659, 784, 1047];
  for (let index = 0; index < notes.length; index++) {
    playTone(notes[index], notes[index], 0.24, 'triangle', 0.15, index * 0.1);
  }
}
// A button is pressed
function playClickSound() {
  playTone(1100, 850, 0.05, 'square', 0.035);
}
// A small "puff" when the piglet disappears or appears
function playPuffSound() {
  playNoise(0.3, 1200, 0.14, 0, 0.8);
}
