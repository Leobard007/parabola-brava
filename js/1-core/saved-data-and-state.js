/* ======================================================================
   FILE: js/1-core/saved-data-and-state.js

   SAVED DATA AND GAME STATE
   1) The player's progress (stars and unlocked levels) and the levels made in
      the editor, saved in the browser with localStorage.
   2) gameState: everything about the level being played right now.
   3) editorState: everything about the level being edited right now.
   4) currentView: which screen is shown.
   ====================================================================== */

// Names under which the data is saved in the browser (localStorage).
const PROGRESS_STORAGE_KEY = 'parabola-brava';
const CUSTOM_LEVELS_STORAGE_KEY = 'parabola-brava-custom';

// createFreshProgress(): the progress of a new player.
//   unlockedLaunch / unlockedDisplacement / unlockedMixed: how many levels of each
//                    campaign can be played (1 = only the first one)
//   starsByLevel:    best stars of each level, for example { c1: 3, d2: 1 }
//   lastLevelId:     the last level played (the menu opens on its campaign)
//   formatVersion:   number of the format of this data (4 = current one)
function createFreshProgress() {
  return {
    unlockedLaunch: 1,
    unlockedDisplacement: 1,
    unlockedMixed: 1,
    starsByLevel: {},
    lastLevelId: null,
    formatVersion: 4,
  };
}

// progress: the progress of this player (loaded from the browser below).
let progress = createFreshProgress();

// loadSavedProgress(): reads the progress saved in the browser.
// It also understands the formats of older versions and converts them.
function loadSavedProgress() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) || 'null');
  } catch (error) {
    saved = null;
  }
  if (!saved) {
    return;
  }

  // Current format (version 10 of the game and newer)
  if (saved.formatVersion === 4) {
    progress.unlockedLaunch = saved.unlockedLaunch || 1;
    progress.unlockedDisplacement = saved.unlockedDisplacement || 1;
    progress.unlockedMixed = saved.unlockedMixed || 1;
    progress.lastLevelId = saved.lastLevelId || null;
    if (saved.starsByLevel && typeof saved.starsByLevel === 'object') {
      progress.starsByLevel = saved.starsByLevel;
    }
    return;
  }

  // Old format: { unlocked, unlockedD, unlockedM, stars, last, v }
  if (!saved.unlocked) {
    return;
  }
  progress.unlockedLaunch = saved.unlocked;
  progress.unlockedDisplacement = saved.unlockedD || 1;
  progress.unlockedMixed = saved.unlockedM || 1;
  progress.lastLevelId = saved.last || null;
  // Before format 3, the mixed levels were called "displacement" levels
  if (saved.v !== 3) {
    progress.unlockedMixed = Math.max(progress.unlockedMixed, saved.unlockedD || 1);
    progress.unlockedDisplacement = 1;
  }
  if (Array.isArray(saved.stars)) {
    // the first versions saved the stars as a list: [3, 2, 0, ...] for c1, c2, c3...
    for (let index = 0; index < saved.stars.length; index++) {
      if (saved.stars[index]) {
        progress.starsByLevel['c' + (index + 1)] = saved.stars[index];
      }
    }
  } else if (saved.stars && typeof saved.stars === 'object') {
    progress.starsByLevel = saved.stars;
    if (saved.v !== 3) {
      // the old levels d1 to d4 are now the mixed levels m1 to m4
      const oldIds = ['d1', 'd2', 'd3', 'd4'];
      for (let index = 0; index < oldIds.length; index++) {
        const oldId = oldIds[index];
        if (saved.stars[oldId]) {
          progress.starsByLevel['m' + (index + 1)] = saved.stars[oldId];
        }
        delete progress.starsByLevel[oldId];
      }
    }
  }
}
loadSavedProgress();

// customLevels: the levels the player made (or imported) in the editor.
let customLevels = [];

// loadSavedCustomLevels(): reads the player's levels saved in the browser.
// cleanLevel (js/1-core/levels.js) also converts levels saved by older versions.
function loadSavedCustomLevels() {
  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem(CUSTOM_LEVELS_STORAGE_KEY) || '[]');
  } catch (error) {
    saved = [];
  }
  if (!Array.isArray(saved)) {
    return;
  }
  for (const savedLevel of saved) {
    const level = cleanLevel(savedLevel);
    if (!level.id) {
      level.id = createUniqueId();
    }
    customLevels.push(level);
  }
}
loadSavedCustomLevels();

// saveProgress(): saves the progress in the browser.
function saveProgress() {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    // the browser does not allow saving: the game keeps working without it
  }
}

// saveCustomLevels(): saves the player's levels in the browser.
// Returns true if it worked, false if the browser did not allow it.
function saveCustomLevels() {
  try {
    localStorage.setItem(CUSTOM_LEVELS_STORAGE_KEY, JSON.stringify(customLevels));
    return true;
  } catch (error) {
    return false;
  }
}

// findLevel(id): finds a level (of a campaign or of the player) by its id.
// Returns null if it does not exist.
function findLevel(id) {
  for (const campaign of CAMPAIGNS) {
    for (const level of campaign.levels) {
      if (level.id === id) {
        return level;
      }
    }
  }
  for (const level of customLevels) {
    if (level.id === id) {
      return level;
    }
  }
  return null;
}

// isCustomLevel(id): true if the id belongs to one of the player's levels.
function isCustomLevel(id) {
  for (const level of customLevels) {
    if (level.id === id) {
      return true;
    }
  }
  return false;
}

/* ----------------------------------------------------------------------
   GAME STATE: the level being played
   ---------------------------------------------------------------------- */
const gameState = {
  level: null, //               the level being played (its data, see levels.js)
  pieces: [], //                copy of the pieces, with their live state (alive, falling...)
  terrain: [], //               the terrain blocks of the level
  shotsLeft: 0, //              shots that the player still has
  score: 0, //                  total score shown in the top bar
  scoreAtLevelStart: 0, //      score when the level began (to undo it if the level is retried)
  mode: 'aiming', //            'aiming' (choosing values), 'flying' (projectile in the air) or 'ended'
  projectile: null, //          the projectile in the air (see physics.js), or null
  oldShots: [], //              the last shots, drawn as faint dotted paths
  particles: [], //             small pieces, rings and floating texts of the effects
  practiceModeUsed: false, //   true if practice mode was used in this level (no stars)
  lastShot: null, //            the last finished shot (for the telemetry)
  viewTop: 14, //               highest height (m) that must be visible in the scene
  time: 0, //                   seconds since the game started (for animations)
  screen: 'play', //            'play' (playing) or 'edit' (level editor)
  testingFromEditor: false, //  true when the level is being tested from the editor
  nextButtonAction: null, //    what the "Next" button of the end card does
  phase: 'launch', //           'findUnknowns' (vector puzzle), 'launch' or 'done'
  answerRevealed: false, //     true once the vector answer is shown (solved or out of attempts)
  resultant: null, //           result of calculateResultant for the vector puzzle
  answer: null, //              the player's answers to the vector puzzle (see level-and-hud.js)
  unknownItems: [], //          the unknowns the player must find
  pathAnimation: null, //       animation of the piglet walking along the vectors, or null
  piglet: null, //              the piglet that walks (vector levels)
  endTimer: 0, //               seconds left before showing the end card
  online: null, //              information of the online game being played, or null
};

/* ----------------------------------------------------------------------
   EDITOR STATE: the level being edited
   ---------------------------------------------------------------------- */
const editorState = {
  levelDraft: null, //          the level being edited
  selectedTool: 'select', //    'select', 'start', 'wood', 'stone', 'target', 'terrain' or 'erase'
  selection: null, //           what is selected (a vector, R, A, the launcher or a piece), or null
  dragging: null, //            what is being dragged with the mouse, or null
  editingLevelId: null, //      id of the saved level being edited (null = not saved yet)
  pointerPosition: null, //     where the mouse is, in meters and pixels
  lastBlockSize: {
    //                          size of the last block of each kind (new blocks use it)
    wood: { width: 1, height: 2 },
    stone: { width: 1, height: 2 },
  },
  buttonWaitingConfirmation: null, // id of the button that asks "press again to confirm"
  showGrid: true, //            the editor shows the grid
  undoHistory: [], //           earlier versions of the level (for Undo)
  redoHistory: [], //           versions undone (for Redo)
  roundValues: false, //        "Round values" option: vectors snap to whole meters
  propertyCardNeedsUpdate: false, // true when the property card must be redrawn
};

// currentView: the screen shown: 'home', 'levelSelect', 'game' or 'online'.
let currentView = 'home';
