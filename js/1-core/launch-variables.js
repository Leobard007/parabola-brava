/* ======================================================================
   FILE: js/1-core/launch-variables.js

   LAUNCH VARIABLES
   The three values the player can change before launching:
     launchSpeed  (v₀) initial speed in m/s
     launchAngle  (θ)  angle above the horizontal, in degrees
     launchHeight (h₀) height of the launcher, in meters
   plus the gravity (g).

   Every level saves, for each variable, a small "record" like this:
     { start: 18, min: 5, max: 45, step: 0.5, locked: false }
       start  = value at the beginning of the level
       min    = smallest value the player can choose
       max    = largest value the player can choose
       step   = how much the value changes with each move of the slider
       locked = true means the player cannot change it
   and for gravity:  { start: 9.81, locked: false }
   ====================================================================== */

// GRAVITY_OPTIONS: the planets the player can choose in the gravity list.
// Each one has its gravity (m/s²) and its name in Spanish and English.
const GRAVITY_OPTIONS = [
  { gravity: 9.81, spanishName: 'Tierra', englishName: 'Earth' },
  { gravity: 1.62, spanishName: 'Luna', englishName: 'Moon' },
  { gravity: 3.71, spanishName: 'Marte', englishName: 'Mars' },
  { gravity: 24.79, spanishName: 'Júpiter', englishName: 'Jupiter' },
];

// getGravityOptionName(option): the planet name in the chosen language.
function getGravityOptionName(option) {
  return translate(option.spanishName, option.englishName);
}

// LAUNCH_VARIABLE_KEYS: the names of the three launch variables, in the order
// they appear on screen.
const LAUNCH_VARIABLE_KEYS = ['launchSpeed', 'launchAngle', 'launchHeight'];

// LAUNCH_VARIABLE_INFO: fixed information about each launch variable.
//   spanishName / englishName: name shown in the editor
//   symbol:   short symbol used in the equations
//   unit:     unit shown next to the value
//   lowest / highest: the absolute limits the editor allows
//   defaults: the record used when a level does not say anything
const LAUNCH_VARIABLE_INFO = {
  launchSpeed: {
    spanishName: 'Velocidad inicial v₀',
    englishName: 'Initial speed v₀',
    symbol: 'v₀',
    unit: 'm/s',
    lowest: 1,
    highest: 80,
    defaults: { start: 18, min: 5, max: 45, step: 0.5 },
  },
  launchAngle: {
    spanishName: 'Ángulo θ',
    englishName: 'Angle θ',
    symbol: 'θ',
    unit: '°',
    lowest: -89,
    highest: 89,
    defaults: { start: 45, min: -30, max: 85, step: 1 },
  },
  launchHeight: {
    spanishName: 'Altura h₀',
    englishName: 'Height h₀',
    symbol: 'h₀',
    unit: 'm',
    lowest: 0,
    highest: 40,
    defaults: { start: 2, min: 0, max: 15, step: 0.5 },
  },
};

// getLaunchVariableName(key): the name of a launch variable in the chosen language.
function getLaunchVariableName(key) {
  const info = LAUNCH_VARIABLE_INFO[key];
  return translate(info.spanishName, info.englishName);
}

// createDefaultLaunchVariables(): the records used by a brand new level.
function createDefaultLaunchVariables() {
  const launchVariables = {};
  for (const key of LAUNCH_VARIABLE_KEYS) {
    const defaults = LAUNCH_VARIABLE_INFO[key].defaults;
    launchVariables[key] = {
      start: defaults.start,
      min: defaults.min,
      max: defaults.max,
      step: defaults.step,
      locked: false,
    };
  }
  launchVariables.gravity = { start: 9.81, locked: false };
  return launchVariables;
}

// cleanLaunchVariables(source): returns a correct copy of the launch variables of a level.
// It fills in missing values and fixes impossible ones (for example a minimum bigger
// than the maximum), so the rest of the game can trust the values.
// The levels of older versions used short names (v0, ang, h0, g, def); they are
// converted to the current names in js/1-core/levels.js before arriving here.
function cleanLaunchVariables(source) {
  if (!source) {
    source = {};
  }
  const cleaned = createDefaultLaunchVariables();
  for (const key of LAUNCH_VARIABLE_KEYS) {
    const info = LAUNCH_VARIABLE_INFO[key];
    const sourceRecord = source[key] || {};
    const record = cleaned[key];

    record.min = roundToTwoDecimals(clampNumber(parseNumber(sourceRecord.min, record.min), info.lowest, info.highest));
    record.max = roundToTwoDecimals(clampNumber(parseNumber(sourceRecord.max, record.max), info.lowest, info.highest));
    // if the minimum is bigger than the maximum, swap them
    if (record.max < record.min) {
      const smaller = record.max;
      record.max = record.min;
      record.min = smaller;
    }
    // the step must be at least 0.01 and not bigger than the whole range
    let range = record.max - record.min;
    if (range === 0) {
      range = 1;
    }
    record.step = roundToTwoDecimals(clampNumber(parseNumber(sourceRecord.step, record.step), 0.01, Math.max(0.01, range)));
    // the starting value must be inside the range
    record.start = roundToTwoDecimals(clampNumber(parseNumber(sourceRecord.start, record.start), record.min, record.max));
    record.locked = Boolean(sourceRecord.locked);
  }
  const sourceGravity = source.gravity || {};
  cleaned.gravity.start = roundToTwoDecimals(clampNumber(parseNumber(sourceGravity.start, 9.81), 0.1, 50));
  cleaned.gravity.locked = Boolean(sourceGravity.locked);
  return cleaned;
}
