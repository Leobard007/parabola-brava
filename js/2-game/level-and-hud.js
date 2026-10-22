/* ======================================================================
   FILE: js/2-game/level-and-hud.js

   LOADING A LEVEL AND THE HUD
   - loadLevel: prepares everything to play a level.
   - applyLaunchVariables: sets the sliders (v₀, θ, h₀) and the gravity of the level.
   - updateHud: the small texts in the corner of the scene (level, shots, targets)
     and the score.
   - updateGameBar: the buttons of the top bar (Menu, Level editor...).
   ====================================================================== */

// loadLevel(level, options): starts playing a level.
//   level:   the level data (see js/1-core/levels.js)
//   options: { testing: true } when it is tested from the editor,
//            { online: true } when it is part of an online game
function loadLevel(level, options) {
  if (!options) {
    options = {};
  }
  showView('game');
  gameState.level = level;
  gameState.testingFromEditor = Boolean(options.testing);

  // remember the last level played (the menu opens on its campaign next time)
  if (!gameState.testingFromEditor && !options.online && level.id) {
    progress.lastLevelId = level.id;
    saveProgress();
  }
  // in online games the level cannot be retried
  getElement('levelEndRetryButton').hidden = Boolean(options.online);

  // Copy the pieces of the level and add the information they need while playing:
  //   health:        stone needs 2 hits (unless the hit is fast), wood and piglets 1
  //   alive:         false once it is broken
  //   falling, fallSpeed, fallStartY: used when it falls because its support broke
  //   blinkOffset:   random number so the piglets do not all blink at the same moment
  gameState.pieces = [];
  for (const piece of level.pieces) {
    let health = 1;
    if (piece.kind === 'stone') {
      health = 2;
    }
    gameState.pieces.push({
      kind: piece.kind,
      x: piece.x,
      y: piece.y,
      width: piece.width,
      height: piece.height,
      health: health,
      alive: true,
      fallSpeed: 0,
      falling: false,
      fallStartY: 0,
      blinkOffset: Math.random() * 4,
    });
  }
  gameState.terrain = level.terrain.slice(); // .slice() makes a copy of the list
  gameState.shotsLeft = level.shotCount;
  gameState.oldShots = [];
  gameState.particles = [];
  gameState.projectile = null;
  gameState.mode = 'aiming';
  gameState.practiceModeUsed = false;
  gameState.lastShot = null;
  gameState.scoreAtLevelStart = gameState.score;
  gameState.phase = 'launch';
  gameState.answerRevealed = false;
  gameState.resultant = null;
  gameState.answer = null;
  gameState.unknownItems = [];
  gameState.pathAnimation = null;
  gameState.piglet = null;
  gameState.endTimer = 0;

  let vectorTop = 0;
  if (levelHasVectors(level)) {
    const puzzle = level.vectorPuzzle;
    const analysis = analyzePuzzle(puzzle);
    gameState.resultant = analysis.resultant;
    gameState.phase = 'findUnknowns';

    // the list of unknowns the player must find, with their correct values
    for (const key of analysis.unknowns) {
      const parts = splitQuantityKey(key);
      gameState.unknownItems.push({
        key: key,
        owner: parts.owner,
        quantity: parts.quantity,
        trueValue: getTrueValue(analysis.resultant, parts.owner, parts.quantity),
      });
    }
    // the player's answers:
    //   attemptsAllowed / attemptsUsed, solved / failed, stars and bonusPoints won,
    //   lastFeedback = the ✓/✗ messages of the last check
    gameState.answer = {
      attemptsAllowed: puzzle.attempts,
      attemptsUsed: 0,
      solved: false,
      failed: false,
      stars: 0,
      bonusPoints: 0,
      lastFeedback: '',
    };
    // if point A is in the air, a small pillar holds the piglet
    if (puzzle.startY > 0.05) {
      gameState.terrain.push({ x: puzzle.startX - 0.8, width: 1.6, height: puzzle.startY, isPillar: true });
    }
    // the piglet that walks along the vectors
    const piglet = {
      kind: 'target',
      x: puzzle.startX - 0.6,
      y: puzzle.startY,
      width: 1.2,
      height: 1.2,
      health: 1,
      alive: true,
      fallSpeed: 0,
      falling: false,
      fallStartY: 0,
      blinkOffset: Math.random() * 4,
      isWalkingPiglet: true,
      fixedInPlace: true, // it does not fall while it walks
      hidden: false,
    };
    gameState.pieces.push(piglet);
    gameState.piglet = piglet;

    // the scene must be tall enough to show the whole path
    for (const point of gameState.resultant.points) {
      vectorTop = Math.max(vectorTop, point.y + 3);
    }
    buildAnswerForm();
    getElement('answerFeedback').innerHTML = '';
    startPathAnimation();
  }

  // viewTop: the scene shows at least 14 m (5 m in displacement levels) and everything
  // that is taller (terrain, pieces, the vector path)
  let viewTop = 14;
  if (level.type === 'displacement') {
    viewTop = 5;
  }
  viewTop = Math.max(viewTop, vectorTop);
  for (const block of gameState.terrain) {
    viewTop = Math.max(viewTop, block.height);
  }
  for (const piece of level.pieces) {
    viewTop = Math.max(viewTop, piece.y + piece.height);
  }
  gameState.viewTop = viewTop;

  getElement('levelEndOverlay').hidden = true;
  applyLaunchVariables(level.launchVariables);
  setScreen('play');
  renderVectorPuzzlePanels();
  updateHud();
  updateTelemetry();
  updateLaunchPanel();
}

// applyLaunchVariables(launchVariables): sets the sliders, number boxes and hints of
// v₀, θ and h₀, and the gravity, using the values of the level.
function applyLaunchVariables(launchVariables) {
  for (const key of LAUNCH_VARIABLE_KEYS) {
    const record = launchVariables[key];
    const unit = LAUNCH_VARIABLE_INFO[key].unit;
    // the ids in index.html are built from the key: launchSpeedSlider, launchSpeedInput...
    const slider = getElement(key + 'Slider');
    const numberBox = getElement(key + 'Input');
    const controls = [slider, numberBox];
    for (const control of controls) {
      control.min = record.min;
      control.max = record.max;
      control.step = record.step;
      control.disabled = record.locked;
    }
    slider.value = record.start;
    numberBox.value = record.start;
    launcher[key] = record.start;
    getElement(key + 'LockBadge').hidden = !record.locked;
    let hint;
    if (record.locked) {
      hint = translate(`El nivel la fija en ${record.start} ${unit}`, `The level fixes it at ${record.start} ${unit}`);
    } else {
      hint = translate(
        `Permitido: ${record.min} a ${record.max} ${unit} · paso ${record.step}`,
        `Allowed: ${record.min} to ${record.max} ${unit} · step ${record.step}`,
      );
    }
    getElement(key + 'Hint').textContent = hint;
  }
  renderGravityOptions(launchVariables.gravity.start);
  currentGravity = launchVariables.gravity.start;
  getElement('gravityLabel').textContent = currentGravity.toFixed(2);
  getElement('gravityLockBadge').hidden = !launchVariables.gravity.locked;
}

// renderGravityOptions(selectedGravity): fills the gravity list (Earth, Moon...).
// If the level uses another gravity, an extra option "Level's own" is added.
function renderGravityOptions(selectedGravity) {
  const gravitySelect = getElement('gravitySelect');
  gravitySelect.innerHTML = '';
  // the options: { gravity, name }
  const options = [];
  let levelGravityIsInList = false;
  for (const option of GRAVITY_OPTIONS) {
    options.push({ gravity: option.gravity, name: getGravityOptionName(option) });
    if (Math.abs(option.gravity - selectedGravity) < 1e-6) {
      levelGravityIsInList = true;
    }
  }
  if (!levelGravityIsInList) {
    options.push({ gravity: selectedGravity, name: translate('Del nivel', 'Level’s own') });
  }
  let selectedValue = '';
  for (const option of options) {
    // document.createElement creates a new HTML element (here an <option> of the list)
    const optionElement = document.createElement('option');
    optionElement.value = option.gravity;
    optionElement.textContent = `${option.name} · ${option.gravity} m/s²`;
    gravitySelect.appendChild(optionElement);
    if (selectedValue === '' && Math.abs(option.gravity - selectedGravity) < 1e-6) {
      selectedValue = String(option.gravity);
    }
  }
  gravitySelect.value = selectedValue;
}

// countTargetsLeft(): how many piglets are still alive.
function countTargetsLeft() {
  let count = 0;
  for (const piece of gameState.pieces) {
    if (piece.kind === 'target' && piece.alive) {
      count++;
    }
  }
  return count;
}

// pluralShots(count): "1 tiro", "3 tiros" / "1 shot", "3 shots"
function pluralShots(count) {
  if (count > 1) {
    return translate(`${count} tiros`, `${count} shots`);
  }
  return translate(`${count} tiro`, `${count} shot`);
}

// updateHud(): updates the small texts in the corner of the scene and the score.
function updateHud() {
  if (currentView !== 'game') {
    return;
  }
  const modeTag = getElement('hudModeTag');
  const phaseTag = getElement('hudPhaseTag');
  const levelName = getElement('hudLevelName');
  const shotsLeft = getElement('hudShotsLeft');
  const targetsLeft = getElement('hudTargetsLeft');

  if (gameState.screen === 'edit') {
    // In the editor: information about the level being edited
    const draft = editorState.levelDraft;
    if (!draft) {
      return;
    }
    modeTag.textContent = translate('Editor', 'Editor');
    if (draft.type === 'displacement') {
      phaseTag.textContent = translate('Desplazamiento', 'Displacement');
    } else if (draft.type === 'mixed') {
      phaseTag.textContent = translate('Mixto', 'Mixed');
    } else {
      phaseTag.textContent = '';
    }
    levelName.textContent = draft.name;
    if (draft.type === 'displacement') {
      shotsLeft.textContent = '';
    } else {
      shotsLeft.textContent = pluralShots(draft.shotCount);
    }
    if (draft.type === 'displacement') {
      let vectorCount = 0;
      if (draft.vectorPuzzle) {
        vectorCount = draft.vectorPuzzle.vectors.length;
      }
      if (vectorCount > 1) {
        targetsLeft.textContent = translate(`${vectorCount} vectores`, `${vectorCount} vectors`);
      } else {
        targetsLeft.textContent = translate(`${vectorCount} vector`, `${vectorCount} vector`);
      }
    } else {
      let targetCount = 0;
      for (const piece of draft.pieces) {
        if (piece.kind === 'target') {
          targetCount++;
        }
      }
      if (draft.type === 'mixed') {
        targetCount++; // the walking piglet
      }
      targetsLeft.textContent = translate(`Objetivos: ${targetCount}`, `Targets: ${targetCount}`);
    }
  } else {
    // While playing
    const level = gameState.level;
    if (!level) {
      return;
    }
    if (gameState.online) {
      modeTag.textContent = 'Online';
    } else if (gameState.testingFromEditor) {
      modeTag.textContent = translate('Prueba', 'Test');
    } else {
      modeTag.textContent = '';
    }

    if (level.type === 'displacement') {
      if (gameState.answerRevealed) {
        phaseTag.textContent = translate('Resuelto', 'Solved');
      } else {
        phaseTag.textContent = translate('Encuentra las incógnitas', 'Find the unknowns');
      }
    } else if (level.type === 'mixed') {
      if (gameState.phase === 'findUnknowns') {
        phaseTag.textContent = translate('Fase 1 · Vectores', 'Phase 1 · Vectors');
      } else {
        phaseTag.textContent = translate('Fase 2 · Lanza', 'Phase 2 · Launch');
      }
    } else {
      phaseTag.textContent = '';
    }

    // level name: "3/5 · Name" online, "D2 · Name" in campaigns, only the name otherwise
    const campaignPlace = findCampaignOfLevel(level);
    if (gameState.online) {
      levelName.textContent = `${gameState.online.levelIndex + 1}/${gameState.online.levels.length} · ${getLevelName(level)}`;
    } else if (campaignPlace) {
      levelName.textContent = `${campaignPlace.campaign.prefix}${campaignPlace.index + 1} · ${getLevelName(level)}`;
    } else {
      levelName.textContent = getLevelName(level);
    }

    // shots: ●●○ (filled = left, empty = used). 900 or more shots means "unlimited".
    if (level.type === 'displacement') {
      shotsLeft.textContent = '';
    } else if (level.shotCount >= 900) {
      shotsLeft.textContent = translate('Tiros: ∞', 'Shots: ∞');
    } else {
      // .repeat(n) writes the same text n times
      const filled = '●'.repeat(Math.max(0, gameState.shotsLeft));
      const empty = '○'.repeat(Math.max(0, level.shotCount - gameState.shotsLeft));
      shotsLeft.textContent = filled + empty;
    }
    shotsLeft.setAttribute('aria-label', translate(`${gameState.shotsLeft} tiros restantes`, `${gameState.shotsLeft} shots left`));

    if (gameState.phase === 'findUnknowns' || level.type === 'displacement') {
      targetsLeft.textContent = '';
    } else {
      targetsLeft.textContent = translate(`Objetivos: ${countTargetsLeft()}`, `Targets: ${countTargetsLeft()}`);
    }
  }
  // toLocaleString writes the number with thousands separators (1,500 or 1.500)
  let locale = 'es';
  if (settings.language === 'en') {
    locale = 'en';
  }
  getElement('scoreValue').textContent = gameState.score.toLocaleString(locale);
}

// updateGameBar(): updates the buttons of the top bar depending on the situation.
function updateGameBar() {
  const editorButton = getElement('editorToggleButton');
  const editThisButton = getElement('editThisLevelButton');
  editorButton.hidden = Boolean(gameState.online);
  if (gameState.online) {
    getElement('gameMenuButton').textContent = translate('Salir de la partida', 'Leave game');
  } else {
    getElement('gameMenuButton').textContent = translate('← Menú', '← Menu');
  }
  if (gameState.online) {
    editThisButton.hidden = true;
    return;
  }
  if (gameState.screen === 'edit') {
    editorButton.textContent = translate('Salir del editor', 'Exit editor');
    editThisButton.hidden = true;
  } else if (gameState.testingFromEditor) {
    editorButton.textContent = translate('Volver al editor', 'Back to editor');
    editThisButton.hidden = true;
  } else {
    editorButton.textContent = translate('Editor de niveles', 'Level editor');
    editThisButton.hidden = !gameState.level;
    if (gameState.level) {
      if (isCustomLevel(gameState.level.id)) {
        editThisButton.textContent = translate('Editar este nivel', 'Edit this level');
      } else {
        editThisButton.textContent = translate('Copiar al editor', 'Copy to editor');
      }
    }
  }
}
