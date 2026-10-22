/* ======================================================================
   FILE: js/1-core/levels.js

   THE LEVELS OF THE GAME
   Every level is a plain JavaScript object (data). This is the format:

   {
     id:          'c1'                 unique name of the level
     name:        'Primer tiro'        name in Spanish
     nameEnglish: 'First shot'         name in English (optional)
     type:        'launch' | 'displacement' | 'mixed'
     worldWidth:  42                   width of the world in meters
     shotCount:   4                    how many shots the player has
     showGrid:    true                 the player sees the grid of the scene
     terrain:     [ { x: 20, width: 1.5, height: 7 } ]
                                       solid blocks of ground that never break
     pieces:      [ { kind: 'wood', x: 28.5, y: 0, width: 1, height: 2 } ]
                                       kind can be 'wood', 'stone' or 'target' (piglet)
     launchVariables: { launchSpeed: {...}, launchAngle: {...}, launchHeight: {...}, gravity: {...} }
                                       see js/1-core/launch-variables.js
     vectorPuzzle: { startX, startY, vectors: [...], ... }   or null
                                       see js/1-core/vectors.js
   }

   HOW TO ADD A LEVEL TO A CAMPAIGN: copy one of the levels below, give it a new
   id (for example 'c6') and change its values. The level list on screen updates
   by itself.

   Older versions of the game used other names (for example W instead of
   worldWidth, objs instead of pieces). The function convertOldLevelFormat
   (at the end of this file) translates those old levels, so old saved levels
   and old share codes keep working.
   ====================================================================== */

// makeBlock(x, y, width, height, kind): creates a wood or stone block.
//   x, y = position of its bottom-left corner, in meters
function makeBlock(x, y, width, height, kind) {
  return { kind: kind, x: x, y: y, width: width, height: height };
}

// makeTarget(centerX, y): creates a piglet (target). Piglets are always 1.2 m wide,
// so this function receives the CENTER of the piglet and calculates its left side.
function makeTarget(centerX, y) {
  return { kind: 'target', x: centerX - 0.6, y: y, width: 1.2, height: 1.2 };
}

/* ----------------------------------------------------------------------
   CAMPAIGN 1: LAUNCH LEVELS
   ---------------------------------------------------------------------- */
// Example of level 1, explained:
//   worldWidth: 42                     → the world is 42 m wide
//   shotCount: 4                       → the player has 4 shots
//   terrain: []                        → no fixed terrain
//   makeBlock(28.5, 0, 1, 2, 'wood')   → wood block at x = 28.5 m, y = 0 (on the ground),
//                                        1 m wide and 2 m tall
//   makeTarget(30.5, 2.5)              → piglet centered at x = 30.5 m, 2.5 m above the ground
const LAUNCH_CAMPAIGN = [
  {
    id: 'c1',
    name: 'Primer tiro',
    nameEnglish: 'First shot',
    worldWidth: 42,
    shotCount: 4,
    terrain: [],
    pieces: [makeBlock(28.5, 0, 1, 2, 'wood'), makeBlock(31.5, 0, 1, 2, 'wood'), makeBlock(28.5, 2, 4, 0.5, 'wood'), makeTarget(30.5, 2.5)],
  },
  {
    id: 'c2',
    name: 'El muro',
    nameEnglish: 'The wall',
    worldWidth: 45,
    shotCount: 4,
    terrain: [{ x: 20, width: 1.5, height: 7 }],
    pieces: [makeBlock(31, 0, 0.5, 1.8, 'wood'), makeBlock(34.5, 0, 0.5, 1.8, 'wood'), makeBlock(31, 1.8, 4, 0.4, 'wood'), makeTarget(32.75, 0)],
  },
  {
    id: 'c3',
    name: 'La meseta',
    nameEnglish: 'The plateau',
    worldWidth: 56,
    shotCount: 4,
    terrain: [{ x: 34, width: 18, height: 7 }],
    pieces: [
      makeBlock(38, 7, 1, 2.5, 'stone'),
      makeBlock(42, 7, 1, 2.5, 'stone'),
      makeBlock(38, 9.5, 5, 0.5, 'wood'),
      makeTarget(40.5, 7),
      makeTarget(40.5, 10),
      makeBlock(46, 7, 0.4, 1.6, 'wood'),
      makeBlock(48, 7, 0.4, 1.6, 'wood'),
      makeBlock(46, 8.6, 2.4, 0.4, 'wood'),
      makeTarget(47.2, 7),
    ],
  },
  {
    id: 'c4',
    name: 'La torre',
    nameEnglish: 'The tower',
    worldWidth: 52,
    shotCount: 5,
    terrain: [{ x: 28, width: 2, height: 4 }],
    pieces: [
      makeBlock(38, 0, 0.8, 3, 'stone'),
      makeBlock(42.2, 0, 0.8, 3, 'stone'),
      makeBlock(38, 3, 5, 0.5, 'wood'),
      makeTarget(40.5, 0),
      makeBlock(38.4, 3.5, 0.6, 2.6, 'wood'),
      makeBlock(42, 3.5, 0.6, 2.6, 'wood'),
      makeBlock(38, 6.1, 5, 0.5, 'stone'),
      makeTarget(40.5, 3.5),
      makeTarget(40.5, 6.6),
    ],
  },
  {
    id: 'c5',
    name: 'Lejos y alto',
    nameEnglish: 'Far and high',
    worldWidth: 82,
    shotCount: 5,
    terrain: [
      { x: 40, width: 3, height: 16 },
      { x: 58, width: 22, height: 12 },
    ],
    pieces: [
      makeBlock(64, 12, 0.6, 2.4, 'wood'),
      makeBlock(67.4, 12, 0.6, 2.4, 'wood'),
      makeBlock(64, 14.4, 4, 0.5, 'stone'),
      makeTarget(66, 12),
      makeTarget(66, 14.9),
      makeBlock(71.8, 12, 0.5, 1.6, 'stone'),
      makeBlock(74, 12, 0.5, 1.6, 'stone'),
      makeBlock(71.8, 13.6, 2.7, 0.4, 'stone'),
      makeTarget(73.15, 12),
    ],
  },
];
// Add the fields that every launch level shares
for (const level of LAUNCH_CAMPAIGN) {
  level.type = 'launch';
  level.showGrid = true;
  level.launchVariables = createDefaultLaunchVariables();
  level.vectorPuzzle = null;
}

/* ----------------------------------------------------------------------
   CAMPAIGN 2: DISPLACEMENT LEVELS (only vectors, no launch)
   A vector is written like this:
     { distance: 12, angle: 30, direction: 'upRight',
       visibility: createVisibility('what the player sees', 'what the player must find') }
   For velocity vectors use kind: 'velocity' with speed and time; for acceleration
   vectors use kind: 'acceleration' with acceleration, time and initialSpeed.
   ---------------------------------------------------------------------- */
const DISPLACEMENT_CAMPAIGN = [
  {
    id: 'd1',
    name: 'Suma de vectores',
    nameEnglish: 'Adding vectors',
    worldWidth: 32,
    vectorPuzzle: {
      startX: 8,
      startY: 0,
      vectors: [
        { distance: 12, direction: 'right', visibility: createVisibility('distance direction') },
        { distance: 5, direction: 'up', visibility: createVisibility('distance direction') },
      ],
      resultant: { visibility: createVisibility('', 'distance angle direction') },
    },
  },
  {
    id: 'd2',
    name: 'Descomponer',
    nameEnglish: 'Breaking it down',
    worldWidth: 34,
    vectorPuzzle: {
      startX: 6,
      startY: 0,
      vectors: [{ distance: 20, angle: 30, direction: 'upRight', visibility: createVisibility('') }],
      resultant: { visibility: createVisibility('distance angle direction', 'dx dy') },
    },
  },
  {
    id: 'd3',
    name: 'De componentes a polar',
    nameEnglish: 'Components to polar',
    worldWidth: 30,
    vectorPuzzle: {
      startX: 8,
      startY: 0,
      vectors: [
        { distance: 10, angle: 53.13, direction: 'upRight', visibility: createVisibility('dx dy') },
        { distance: 9.22, angle: 12.53, direction: 'downRight', visibility: createVisibility('dx dy') },
        { distance: 6.71, angle: 63.43, direction: 'upLeft', visibility: createVisibility('dx dy') },
      ],
      resultant: { visibility: createVisibility('', 'distance angle direction') },
    },
  },
  {
    id: 'd4',
    name: 'El vector faltante',
    nameEnglish: 'The missing vector',
    worldWidth: 30,
    vectorPuzzle: {
      startX: 8,
      startY: 0,
      showPath: false,
      vectors: [
        { distance: 4, direction: 'right', visibility: createVisibility('distance direction') },
        { distance: 9.43, angle: 32.01, direction: 'upRight', visibility: createVisibility('direction', 'distance angle') },
      ],
      resultant: { visibility: createVisibility('distance angle direction') },
    },
  },
  {
    id: 'd5',
    name: 'Pitágoras inverso',
    nameEnglish: 'Pythagoras in reverse',
    worldWidth: 32,
    vectorPuzzle: {
      startX: 5,
      startY: 0,
      vectors: [{ distance: 25, angle: 36.87, direction: 'upRight', visibility: createVisibility('') }],
      resultant: { visibility: createVisibility('distance dx direction', 'dy angle') },
    },
  },
  {
    id: 'd6',
    name: 'Velocidad y tiempo',
    nameEnglish: 'Speed and time',
    worldWidth: 30,
    vectorPuzzle: {
      startX: 5,
      startY: 0,
      vectors: [
        { kind: 'velocity', speed: 4, time: 5, angle: 30, direction: 'upRight', visibility: createVisibility('speed time angle direction') },
        { kind: 'velocity', speed: 3, time: 2, direction: 'down', visibility: createVisibility('speed time direction') },
      ],
      resultant: { visibility: createVisibility('', 'distance angle direction') },
    },
  },
  {
    id: 'd7',
    name: '¿Cuánto tardó?',
    nameEnglish: 'How long did it take?',
    worldWidth: 28,
    vectorPuzzle: {
      startX: 8,
      startY: 0,
      showPath: false,
      vectors: [
        { kind: 'velocity', speed: 5, time: 2, direction: 'right', visibility: createVisibility('speed time direction') },
        { kind: 'velocity', speed: 2, time: 3.75, direction: 'up', visibility: createVisibility('speed direction', 'time') },
      ],
      resultant: { visibility: createVisibility('distance direction') },
    },
  },
  {
    id: 'd8',
    name: 'Acelerando',
    nameEnglish: 'Speeding up',
    worldWidth: 28,
    vectorPuzzle: {
      startX: 5,
      startY: 0,
      vectors: [
        {
          kind: 'acceleration',
          acceleration: 2,
          time: 3,
          initialSpeed: 0,
          direction: 'right',
          visibility: createVisibility('acceleration time initialSpeed direction'),
        },
        {
          kind: 'acceleration',
          acceleration: 1,
          time: 4,
          initialSpeed: 0,
          angle: 53.13,
          direction: 'upRight',
          visibility: createVisibility('acceleration time initialSpeed angle direction'),
        },
      ],
      resultant: { visibility: createVisibility('', 'distance angle direction') },
    },
  },
];
// Add the fields that every displacement level shares (and clean its vector puzzle)
for (const level of DISPLACEMENT_CAMPAIGN) {
  level.type = 'displacement';
  level.showGrid = false;
  level.shotCount = 4;
  level.terrain = [];
  level.pieces = [];
  level.launchVariables = createDefaultLaunchVariables();
  level.vectorPuzzle = cleanVectorPuzzle(level.vectorPuzzle, level.worldWidth);
}

/* ----------------------------------------------------------------------
   CAMPAIGN 3: MIXED LEVELS (first find the piglet with vectors, then launch)
   ---------------------------------------------------------------------- */
const MIXED_CAMPAIGN = [
  {
    id: 'm1',
    name: 'Primer salto',
    nameEnglish: 'First jump',
    worldWidth: 45,
    shotCount: 4,
    terrain: [],
    pieces: [],
    vectorPuzzle: {
      startX: 15,
      startY: 0,
      vectors: [{ distance: 10, angle: 36.87, direction: 'upRight', visibility: createVisibility('dx dy') }],
      resultant: { visibility: createVisibility('', 'distance angle direction') },
    },
  },
  {
    id: 'm2',
    name: 'Dos vectores',
    nameEnglish: 'Two vectors',
    worldWidth: 45,
    shotCount: 4,
    terrain: [{ x: 20, width: 1.5, height: 5 }],
    pieces: [],
    vectorPuzzle: {
      startX: 12,
      startY: 0,
      vectors: [
        { distance: 5, angle: 36.87, direction: 'upRight', visibility: createVisibility('dx dy') },
        { distance: 10, direction: 'right', visibility: createVisibility('dx dy') },
      ],
      resultant: { visibility: createVisibility('', 'distance angle') },
    },
  },
  {
    id: 'm3',
    name: 'Ida y vuelta',
    nameEnglish: 'There and back',
    worldWidth: 48,
    shotCount: 4,
    terrain: [],
    pieces: [],
    vectorPuzzle: {
      startX: 30,
      startY: 4,
      vectors: [
        { distance: 15, angle: 53.13, direction: 'upRight' },
        { distance: 8, direction: 'left' },
        { distance: 6, direction: 'down' },
      ],
      resultant: { visibility: createVisibility('', 'distance angle direction') },
    },
  },
  {
    id: 'm4',
    name: 'Laberinto',
    nameEnglish: 'Maze',
    worldWidth: 55,
    shotCount: 5,
    terrain: [{ x: 30, width: 1.5, height: 9 }],
    pieces: [makeBlock(46, 0, 0.6, 2, 'stone')],
    vectorPuzzle: {
      startX: 20,
      startY: 0,
      valueTolerancePercent: 4,
      vectors: [
        { distance: 10, angle: 30, direction: 'upRight' },
        { distance: 12, angle: 20, direction: 'downRight' },
        { distance: 6, direction: 'up' },
      ],
      resultant: { visibility: createVisibility('', 'distance angle direction') },
    },
  },
];
// Add the fields that every mixed level shares (and clean its vector puzzle)
for (const level of MIXED_CAMPAIGN) {
  level.type = 'mixed';
  level.showGrid = false;
  level.launchVariables = createDefaultLaunchVariables();
  level.vectorPuzzle = cleanVectorPuzzle(level.vectorPuzzle, level.worldWidth);
}

// CAMPAIGNS: information about the three campaigns.
//   key          name used by the menus
//   levels       the list of levels
//   unlockField  the field of "progress" that says how many levels are unlocked
//   prefix       letter written before the level number ("D3", "M2"...)
const CAMPAIGNS = [
  { key: 'launch', levels: LAUNCH_CAMPAIGN, unlockField: 'unlockedLaunch', prefix: '' },
  { key: 'displacement', levels: DISPLACEMENT_CAMPAIGN, unlockField: 'unlockedDisplacement', prefix: 'D' },
  { key: 'mixed', levels: MIXED_CAMPAIGN, unlockField: 'unlockedMixed', prefix: 'M' },
];

// findCampaignOfLevel(level): says in which campaign a level is, and its position.
// Returns { campaign, index } or null for levels made in the editor.
function findCampaignOfLevel(level) {
  for (const campaign of CAMPAIGNS) {
    const index = campaign.levels.indexOf(level);
    if (index >= 0) {
      return { campaign: campaign, index: index };
    }
  }
  return null;
}

// getLevelName(level): the name of a level in the chosen language.
function getLevelName(level) {
  if (settings.language === 'en' && level.nameEnglish) {
    return level.nameEnglish;
  }
  return level.name;
}

// cleanLevel(source): returns a correct copy of a level, with every value inside its
// limits. Used for levels made in the editor, loaded from the browser or from a code.
function cleanLevel(source) {
  if (!source) {
    source = {};
  }
  // levels saved by older versions of the game are translated first
  /* if (isOldLevelFormat(source)) {
    source = convertOldLevelFormat(source);
  } */
  const worldWidth = roundToTwoDecimals(clampNumber(parseNumber(source.worldWidth, 45), 20, 150));

  let type = 'launch';
  if (source.type === 'displacement' || source.type === 'mixed') {
    type = source.type;
  }

  let id = null;
  if (typeof source.id === 'string') {
    id = source.id;
  }

  // the name: at most 40 letters
  const name = String(source.name || translate('Nivel sin nombre', 'Untitled level')).slice(0, 40);

  // showGrid: if the level does not say it, launch levels show the grid
  let showGrid = type === 'launch';
  if (source.showGrid !== undefined) {
    showGrid = Boolean(source.showGrid);
  }

  // terrain: at most 40 blocks, each one inside the world
  const terrain = [];
  let sourceTerrain = source.terrain;
  if (!Array.isArray(sourceTerrain)) {
    sourceTerrain = [];
  }
  for (let index = 0; index < sourceTerrain.length && index < 40; index++) {
    const block = sourceTerrain[index];
    const width = roundToTwoDecimals(clampNumber(parseNumber(block.width, 2), 0.3, 60));
    terrain.push({
      x: roundToTwoDecimals(clampNumber(parseNumber(block.x, 10), LAUNCH_CLEAR_ZONE, Math.max(LAUNCH_CLEAR_ZONE, worldWidth - width))),
      width: width,
      height: roundToTwoDecimals(clampNumber(parseNumber(block.height, 2), 0.3, 40)),
    });
  }

  // pieces: at most 200, only of the three known kinds
  const pieces = [];
  let sourcePieces = source.pieces;
  if (!Array.isArray(sourcePieces)) {
    sourcePieces = [];
  }
  for (let index = 0; index < sourcePieces.length && index < 200; index++) {
    const piece = sourcePieces[index];
    if (!piece || (piece.kind !== 'wood' && piece.kind !== 'stone' && piece.kind !== 'target')) {
      continue;
    }
    let width = 1.2;
    let height = 1.2;
    if (piece.kind !== 'target') {
      width = roundToTwoDecimals(clampNumber(parseNumber(piece.width, 1), 0.2, 20));
      height = roundToTwoDecimals(clampNumber(parseNumber(piece.height, 1), 0.2, 20));
    }
    pieces.push({
      kind: piece.kind,
      x: roundToTwoDecimals(clampNumber(parseNumber(piece.x, 10), LAUNCH_CLEAR_ZONE, Math.max(LAUNCH_CLEAR_ZONE, worldWidth - width))),
      y: roundToTwoDecimals(Math.max(0, parseNumber(piece.y, 0))),
      width: width,
      height: height,
    });
  }

  // the vector puzzle only exists in vector levels (or if the level already had one)
  let vectorPuzzle = null;
  if (type !== 'launch' || source.vectorPuzzle) {
    vectorPuzzle = cleanVectorPuzzle(source.vectorPuzzle, worldWidth);
  }

  return {
    id: id,
    name: name,
    type: type,
    worldWidth: worldWidth,
    shotCount: Math.round(clampNumber(parseNumber(source.shotCount, 4), 1, 10)),
    showGrid: showGrid,
    terrain: terrain,
    pieces: pieces,
    launchVariables: cleanLaunchVariables(source.launchVariables),
    vectorPuzzle: vectorPuzzle,
  };
}

/* ----------------------------------------------------------------------
   SHARE CODES
   A share code is the level written as text (JSON), converted to "base64"
   (letters and numbers only) so it can be copied and pasted safely.
   New codes start with "PB2."; codes of older versions start with "PB1.".
   ---------------------------------------------------------------------- */

// encodeLevelCode(level): turns a level into a share code.
function encodeLevelCode(level) {
  // copy the level without its id (the person who loads it gets a new one)
  const levelWithoutId = deepCopy(level);
  delete levelWithoutId.id;
  const jsonText = JSON.stringify(levelWithoutId);
  // btoa() converts text to base64, but it only accepts simple letters. The combination
  // unescape(encodeURIComponent(...)) first converts accents and symbols (á, ñ, ₀...) into
  // simple letters, so btoa() can handle them.
  return 'PB2.' + btoa(unescape(encodeURIComponent(jsonText)));
}

// decodeLevelCode(code): turns a share code back into a level (the opposite of encodeLevelCode).
// It also accepts the plain JSON text of a level. If the code is broken it throws an error,
// so whoever calls it must use try { ... } catch.
function decodeLevelCode(code) {
  let text = code.trim();
  if (text.startsWith('PB2.') || text.startsWith('PB1.')) {
    // remove the "PBx." prefix and any spaces or line breaks added when copying
    const base64Text = text.slice(4).replace(/\s+/g, '');
    // atob() converts base64 back to text; decodeURIComponent(escape(...)) restores the accents
    text = decodeURIComponent(escape(atob(base64Text)));
  }
  return JSON.parse(text);
}

/* ----------------------------------------------------------------------
   OLD LEVEL FORMAT (versions 1 to 9 of the game)
   ---------------------------------------------------------------------- */

// OLD_DIRECTION_NAMES: old short direction names → current names.
/* const OLD_DIRECTION_NAMES = {
  ur: 'upRight',
  ul: 'upLeft',
  dl: 'downLeft',
  dr: 'downRight',
  r: 'right',
  l: 'left',
  u: 'up',
  d: 'down',
};
// OLD_QUANTITY_NAMES: old short quantity names → current names.
const OLD_QUANTITY_NAMES = {
  d: 'distance',
  v: 'speed',
  t: 'time',
  a: 'acceleration',
  v0: 'initialSpeed',
  ang: 'angle',
  dir: 'direction',
  x: 'dx',
  y: 'dy',
};
// OLD_VISIBILITY_NAMES: old visibility names (in Spanish) → current names.
const OLD_VISIBILITY_NAMES = { dato: 'given', inc: 'unknown', oculto: 'hidden' };
// OLD_LEVEL_TYPES: old level types → current types.
const OLD_LEVEL_TYPES = { clasico: 'launch', despl: 'displacement', mixto: 'mixed' };
// OLD_VECTOR_KINDS: old kinds of vector → current kinds.
const OLD_VECTOR_KINDS = { dist: 'distance', vel: 'velocity', acc: 'acceleration' };

// isOldLevelFormat(level): true if the level uses the names of older versions.
function isOldLevelFormat(level) {
  if (level.W !== undefined || level.objs !== undefined || level.vars !== undefined || level.mov !== undefined) {
    return true;
  }
  return OLD_LEVEL_TYPES[level.type] !== undefined;
}

// convertOldVisibility(oldShow): converts an old "show" record ({ d: 'dato', ang: 'inc' ... })
// into a current visibility record ({ distance: 'given', angle: 'unknown' ... }).
function convertOldVisibility(oldShow) {
  if (!oldShow) {
    return undefined;
  }
  const visibility = {};
  for (const oldName in oldShow) {
    const newName = OLD_QUANTITY_NAMES[oldName];
    const newState = OLD_VISIBILITY_NAMES[oldShow[oldName]];
    if (newName && newState) {
      visibility[newName] = newState;
    }
  }
  return visibility;
}

// convertOldVector(oldVector): converts one vector of the old format.
function convertOldVector(oldVector) {
  if (!oldVector) {
    return {};
  }
  let stretchChanges = undefined;
  if (oldVector.stretch === 't') {
    stretchChanges = 'time';
  }
  return {
    kind: OLD_VECTOR_KINDS[oldVector.kind],
    distance: oldVector.d,
    speed: oldVector.v,
    time: oldVector.t,
    acceleration: oldVector.a,
    initialSpeed: oldVector.v0,
    angle: oldVector.ang,
    direction: OLD_DIRECTION_NAMES[oldVector.dir],
    stretchChanges: stretchChanges,
    visibility: convertOldVisibility(oldVector.show),
  };
}

// convertOldLevelFormat(oldLevel): converts a whole level of the old format.
// The result still needs cleanLevel() (which calls this function by itself).
function convertOldLevelFormat(oldLevel) {
  let type = OLD_LEVEL_TYPES[oldLevel.type];
  let showGrid = oldLevel.grid;
  let vectorPuzzle = undefined;

  if (oldLevel.mov) {
    const oldPuzzle = oldLevel.mov;
    const vectors = [];
    if (Array.isArray(oldPuzzle.vecs) && oldPuzzle.vecs.length > 0) {
      for (const oldVector of oldPuzzle.vecs) {
        vectors.push(convertOldVector(oldVector));
      }
    } else if (Array.isArray(oldPuzzle.legs) && oldPuzzle.legs.length > 0) {
      // Very old levels (version 2) used "legs" instead of vectors. They were always
      // mixed levels and showed the grid; their components were given unless hint was 'polar'.
      for (const leg of oldPuzzle.legs) {
        let visibility = createVisibility('dx dy');
        if (oldPuzzle.hint === 'polar') {
          visibility = undefined;
        }
        vectors.push({ kind: 'distance', distance: leg.d, angle: leg.ang, direction: OLD_DIRECTION_NAMES[leg.dir], visibility: visibility });
      }
      if (type === 'displacement') {
        type = 'mixed';
      }
      if (showGrid === undefined) {
        showGrid = true;
      }
    }
    let resultantVisibility = undefined;
    if (oldPuzzle.R && oldPuzzle.R.show) {
      resultantVisibility = convertOldVisibility(oldPuzzle.R.show);
    }
    vectorPuzzle = {
      startX: oldPuzzle.ax,
      startY: oldPuzzle.ay,
      vectors: vectors,
      resultant: { visibility: resultantVisibility },
      adjustableVectorIndex: oldPuzzle.adj,
      hideScale: oldPuzzle.hideScale,
      showPath: oldPuzzle.showPath,
      valueTolerancePercent: oldPuzzle.tolD,
      angleTolerance: oldPuzzle.tolA,
      attempts: oldPuzzle.tries,
    };
  }

  // launch variables: v0 → launchSpeed, ang → launchAngle, h0 → launchHeight, def → start
  let launchVariables = undefined;
  if (oldLevel.vars) {
    launchVariables = {};
    const oldKeys = { v0: 'launchSpeed', ang: 'launchAngle', h0: 'launchHeight' };
    for (const oldKey in oldKeys) {
      const oldRecord = oldLevel.vars[oldKey];
      if (oldRecord) {
        launchVariables[oldKeys[oldKey]] = { start: oldRecord.def, min: oldRecord.min, max: oldRecord.max, step: oldRecord.step, locked: oldRecord.locked };
      }
    }
    if (oldLevel.vars.g) {
      launchVariables.gravity = { start: oldLevel.vars.g.def, locked: oldLevel.vars.g.locked };
    }
  }

  const terrain = [];
  if (Array.isArray(oldLevel.terrain)) {
    for (const block of oldLevel.terrain) {
      terrain.push({ x: block.x, width: block.w, height: block.h });
    }
  }
  const pieces = [];
  if (Array.isArray(oldLevel.objs)) {
    for (const piece of oldLevel.objs) {
      if (piece) {
        pieces.push({ kind: piece.k, x: piece.x, y: piece.y, width: piece.w, height: piece.h });
      }
    }
  }

  return {
    id: oldLevel.id,
    name: oldLevel.name,
    nameEnglish: oldLevel.name_en,
    type: type,
    worldWidth: oldLevel.W,
    shotCount: oldLevel.shots,
    showGrid: showGrid,
    terrain: terrain,
    pieces: pieces,
    launchVariables: launchVariables,
    vectorPuzzle: vectorPuzzle,
  };
}
 */