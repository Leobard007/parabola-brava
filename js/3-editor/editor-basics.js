/* ======================================================================
   FILE: js/3-editor/editor-basics.js

   LEVEL EDITOR: THE BASICS
   - Opening and closing the editor, and the level type tabs.
   - Undo and Redo (a history of copies of the level).
   - The tools (Move, Point A, Wood, Stone, Target, Terrain, Erase).
   - fillEditor: writes the values of the level in every panel of the editor.
   - The "Level" panel (name, world width, shots, gravity) and the
     "Launch variables" table.

   The level being edited is editorState.levelDraft (see saved-data-and-state.js).
   ====================================================================== */

// getToolHint(tool): the help text shown next to the tool bar.
function getToolHint(tool) {
  if (tool === 'select') {
    return translate(
      'Haz clic en un vector, en R, en A, en el lanzador o en una pieza para abrir su tarjeta. Arrastra la punta de un vector para cambiar magnitud y ángulo (con Shift, de 15° en 15°), el rombo para girarlo y el cuerpo para mover toda la cadena. Arrastra B para cambiar R.',
      'Click a vector, R, A, the launcher or a piece to open its card. Drag a vector’s tip to change its length and angle (Shift: 15° steps), the diamond to rotate it and its body to move the whole chain. Drag B to change R.',
    );
  }
  if (tool === 'start') {
    return translate(
      'Haz clic para poner el punto A, donde empieza el cochinito. También puedes arrastrar A con Mover.',
      'Click to place point A, where the piglet starts. You can also drag A with Move.',
    );
  }
  if (tool === 'wood') {
    return translate(
      'Haz clic para colocar un bloque de madera. Se apoya sobre lo que haya debajo del clic.',
      'Click to place a wood block. It rests on whatever is below the click.',
    );
  }
  if (tool === 'stone') {
    return translate(
      'Haz clic para colocar un bloque de piedra. Aguanta un golpe lento y se rompe con impactos de 18 m/s o más.',
      'Click to place a stone block. It survives a slow hit and breaks at 18 m/s or more.',
    );
  }
  if (tool === 'target') {
    return translate(
      'Haz clic para colocar un objetivo. El nivel se gana al eliminarlos todos.',
      'Click to place a target. The level is won when they are all gone.',
    );
  }
  if (tool === 'terrain') {
    return translate(
      'Haz clic para crear terreno fijo: su altura es la del punto donde haces clic. El proyectil no lo rompe.',
      'Click to create solid terrain: its height is where you click. The projectile can’t break it.',
    );
  }
  if (tool === 'erase') {
    return translate('Haz clic o arrastra sobre las piezas para borrarlas.', 'Click or drag over pieces to erase them.');
  }
  return '';
}

// createBlankLevel(type): a new empty level of the given type.
function createBlankLevel(type) {
  let name = translate('Mi nivel', 'My level');
  let worldWidth = 45;
  let vectorPuzzle = null;
  if (type === 'displacement') {
    name = translate('Mi nivel de vectores', 'My vector level');
    worldWidth = 32;
  }
  if (type === 'mixed') {
    name = translate('Mi nivel mixto', 'My mixed level');
  }
  if (type !== 'launch') {
    vectorPuzzle = {
      startX: 8,
      startY: 0,
      vectors: [
        { distance: 10, angle: 30, direction: 'upRight' },
        { distance: 6, direction: 'up' },
      ],
    };
  }
  return cleanLevel({
    name: name,
    type: type,
    worldWidth: worldWidth,
    shotCount: 4,
    showGrid: type === 'launch',
    terrain: [],
    pieces: [],
    launchVariables: createDefaultLaunchVariables(),
    vectorPuzzle: vectorPuzzle,
  });
}

// getAdjustableVectorIndex(puzzle): the vector that changes when R is edited:
// the one marked as "adjustable", or else the last vector.
function getAdjustableVectorIndex(puzzle) {
  const index = puzzle.adjustableVectorIndex;
  if (index !== null && index !== undefined && index < puzzle.vectors.length) {
    return index;
  }
  return puzzle.vectors.length - 1;
}

/* ----------------------------------------------------------------------
   UNDO AND REDO
   Before every change, a copy of the level (as JSON text) is saved in
   undoHistory. Undo takes the last copy back; Redo does the opposite.
   ---------------------------------------------------------------------- */

// saveUndoPoint(): saves a copy of the level before a change. At most 80 copies.
function saveUndoPoint() {
  editorState.undoHistory.push(JSON.stringify(editorState.levelDraft));
  if (editorState.undoHistory.length > 80) {
    editorState.undoHistory.shift(); // forget the oldest copy
  }
  editorState.redoHistory = []; // a new change makes the undone changes disappear
  updateUndoButtons();
}

// updateUndoButtons(): enables or disables the Undo and Redo buttons.
function updateUndoButtons() {
  getElement('editorUndoButton').disabled = editorState.undoHistory.length === 0;
  getElement('editorRedoButton').disabled = editorState.redoHistory.length === 0;
}

// fixSelectionAfterUndo(): after Undo/Redo the selected thing may not exist anymore.
function fixSelectionAfterUndo() {
  const selection = editorState.selection;
  const draft = editorState.levelDraft;
  if (!selection) {
    return;
  }
  const hasVectors = levelHasVectors(draft);
  let removeSelection = false;
  if (selection.type === 'vector' && (!hasVectors || selection.index >= draft.vectorPuzzle.vectors.length)) {
    removeSelection = true;
  }
  if ((selection.type === 'resultant' || selection.type === 'startPoint') && !hasVectors) {
    removeSelection = true;
  }
  if (selection.item) {
    removeSelection = true; // pieces are new objects after Undo
  }
  if (selection.type === 'launcher' && draft.type === 'displacement') {
    removeSelection = true;
  }
  if (removeSelection) {
    editorState.selection = null;
  }
}

// undo(): goes back to the previous copy of the level.
function undo() {
  if (editorState.undoHistory.length === 0) {
    return;
  }
  editorState.redoHistory.push(JSON.stringify(editorState.levelDraft));
  editorState.levelDraft = JSON.parse(editorState.undoHistory.pop());
  fixSelectionAfterUndo();
  refreshEditor();
  updateUndoButtons();
  showEditorMessage(translate('Cambio deshecho.', 'Change undone.'));
}

// redo(): repeats the last change that was undone.
function redo() {
  if (editorState.redoHistory.length === 0) {
    return;
  }
  editorState.undoHistory.push(JSON.stringify(editorState.levelDraft));
  editorState.levelDraft = JSON.parse(editorState.redoHistory.pop());
  fixSelectionAfterUndo();
  refreshEditor();
  updateUndoButtons();
  showEditorMessage(translate('Cambio rehecho.', 'Change redone.'));
}
getElement('editorUndoButton').addEventListener('click', function () {
  undo();
});
getElement('editorRedoButton').addEventListener('click', function () {
  redo();
});

/* ----------------------------------------------------------------------
   OPENING AND CLOSING THE EDITOR
   ---------------------------------------------------------------------- */

// setScreen(screen): switches the game screen between 'play' and 'edit'.
function setScreen(screen) {
  gameState.screen = screen;
  getElement('playControls').hidden = screen !== 'play';
  getElement('editorPanels').hidden = screen !== 'edit';
  // classList.toggle(name, condition) adds the class when the condition is true and removes it otherwise
  getElement('stage').classList.toggle('stage-editing', screen === 'edit');
  if (screen === 'edit') {
    getElement('levelEndOverlay').hidden = true;
    gameState.particles = [];
  }
  gameCanvas.style.cursor = 'default';
  updateGameBar();
  updateHud();
  renderPropertyCard();
}

// openEditor(level): opens the editor.
//   level: a level to edit. A campaign level opens as a copy; one of the player's
//          levels is edited directly. Without a level, the editor continues with the
//          last draft (or a new blank level).
function openEditor(level) {
  showView('game');
  if (level) {
    editorState.levelDraft = cleanLevel(deepCopy(level));
    const levelIsCustom = isCustomLevel(level.id);
    if (levelIsCustom) {
      editorState.editingLevelId = level.id;
    } else {
      editorState.editingLevelId = null;
      editorState.levelDraft.id = null;
      editorState.levelDraft.name = (getLevelName(level) + translate(' (copia)', ' (copy)')).slice(0, 40);
    }
    editorState.undoHistory = [];
    editorState.redoHistory = [];
  } else if (!editorState.levelDraft) {
    editorState.levelDraft = createBlankLevel('launch');
    editorState.editingLevelId = null;
    editorState.undoHistory = [];
    editorState.redoHistory = [];
  }
  editorState.selection = null;
  editorState.dragging = null;
  setScreen('edit');
  fillEditor();
}

// backToEditor(): returns to the editor after testing a level.
function backToEditor() {
  setScreen('edit');
  fillEditor();
}

// The top bar button: "Level editor" / "Exit editor" / "Back to editor"
getElement('editorToggleButton').addEventListener('click', function () {
  if (gameState.screen === 'edit') {
    // leaving the editor: back to the level that was being played, or to the menu
    if (gameState.level && !gameState.testingFromEditor) {
      gameState.score = gameState.scoreAtLevelStart;
      loadLevel(gameState.level);
    } else {
      showView('levelSelect');
    }
  } else if (gameState.testingFromEditor) {
    backToEditor();
  } else {
    openEditor(null);
  }
});
// "Edit this level" / "Copy to editor"
getElement('editThisLevelButton').addEventListener('click', function () {
  openEditor(gameState.level);
});

// setLevelType(type): changes the type of the level (tabs Launch / Displacement / Mixed).
function setLevelType(type) {
  const draft = editorState.levelDraft;
  if (draft.type === type) {
    return;
  }
  saveUndoPoint();
  const previousType = draft.type;
  draft.type = type;
  // a vector level needs a vector puzzle
  if (type !== 'launch' && !draft.vectorPuzzle) {
    draft.vectorPuzzle = cleanVectorPuzzle(
      {
        startX: Math.round(draft.worldWidth * 0.3),
        vectors: [
          { distance: 10, angle: 30, direction: 'upRight' },
          { distance: 6, direction: 'up' },
        ],
      },
      draft.worldWidth,
    );
  }
  if (previousType === 'launch' && type !== 'launch') {
    draft.showGrid = false;
  }
  // some tools do not exist in some types
  if (type === 'launch' && editorState.selectedTool === 'start') {
    setTool('select');
  }
  if (type === 'displacement' && editorState.selectedTool !== 'select' && editorState.selectedTool !== 'start') {
    setTool('select');
  }
  editorState.selection = null;
  fillEditor();
  if (type === 'launch') {
    showEditorMessage(translate('Este nivel ahora es de lanzamiento.', 'This level is now a launch level.'));
  } else if (type === 'displacement') {
    showEditorMessage(
      translate(
        'Este nivel ahora es de desplazamiento: solo se resuelven los vectores, sin lanzamiento.',
        'This level is now a displacement level: only the vectors are solved, with no launch.',
      ),
    );
  } else {
    showEditorMessage(
      translate(
        'Este nivel ahora es mixto: primero se resuelven los vectores y después se lanza al cochinito.',
        'This level is now mixed: first the vectors are solved, then the piglet is launched at.',
      ),
    );
  }
}
getElement('editorLaunchTab').addEventListener('click', function () {
  setLevelType('launch');
});
getElement('editorDisplacementTab').addEventListener('click', function () {
  setLevelType('displacement');
});
getElement('editorMixedTab').addEventListener('click', function () {
  setLevelType('mixed');
});

// "Grid in the editor" box
getElement('editorGridCheckbox').addEventListener('change', function (event) {
  editorState.showGrid = event.target.checked;
});
// "Round values" box
getElement('roundValuesCheckbox').addEventListener('change', function (event) {
  editorState.roundValues = event.target.checked;
  if (event.target.checked) {
    showEditorMessage(
      translate(
        'Valores redondos: al arrastrar, las puntas se ajustan a metros enteros y prefieren triángulos exactos como 3-4-5.',
        'Round values: when dragging, tips snap to whole meters and prefer exact triangles like 3-4-5.',
      ),
    );
  } else {
    showEditorMessage(translate('Valores redondos desactivado: al arrastrar se ajusta a 0.5 m y 1°.', 'Round values off: dragging snaps to 0.5 m and 1°.'));
  }
});

// The tool buttons. Each button has data-tool="..." in index.html.
const toolButtons = document.querySelectorAll('.editor-tool');
for (const button of toolButtons) {
  button.addEventListener('click', function () {
    setTool(button.dataset.tool);
  });
}

// setTool(tool): selects a tool and marks its button as pressed.
function setTool(tool) {
  editorState.selectedTool = tool;
  for (const button of toolButtons) {
    if (button.dataset.tool === tool) {
      button.setAttribute('aria-pressed', 'true');
    } else {
      button.setAttribute('aria-pressed', 'false');
    }
  }
  getElement('editorToolHint').textContent = getToolHint(tool);
}

// showEditorMessage(text, kind): writes a message under the save buttons.
//   kind: 'ok' (green), 'error' (red) or nothing (grey)
function showEditorMessage(text, kind) {
  const messageBox = getElement('editorMessage');
  messageBox.textContent = text;
  let className = 'editor-message';
  if (kind === 'ok') {
    className += ' message-ok';
  }
  if (kind === 'error') {
    className += ' message-error';
  }
  messageBox.className = className;
}

/* ----------------------------------------------------------------------
   REFRESHING THE PANELS
   ---------------------------------------------------------------------- */

// keepFocusWhile(work): runs work() (which rebuilds parts of the page) and then puts the
// keyboard focus back in the box that had it, so the person can keep typing.
function keepFocusWhile(work) {
  const focusedElement = document.activeElement;
  let focusedId = null;
  if (focusedElement) {
    focusedId = focusedElement.id;
  }
  work();
  if (focusedId) {
    const element = document.getElementById(focusedId);
    if (element && element !== document.activeElement) {
      try {
        element.focus();
      } catch (error) {
        // nothing to do
      }
    }
  }
}

// refreshEditor(): rebuilds every panel of the editor.
function refreshEditor() {
  keepFocusWhile(fillEditor);
}

// refreshPuzzleEditor(): rebuilds only the panels of the vector puzzle (faster).
function refreshPuzzleEditor() {
  const draft = editorState.levelDraft;
  if (!levelHasVectors(draft)) {
    refreshEditor();
    return;
  }
  draft.vectorPuzzle = cleanVectorPuzzle(draft.vectorPuzzle, draft.worldWidth);
  keepFocusWhile(function () {
    fillPuzzleFields();
    buildPuzzleVariableCards();
    buildAdvancedVectorTable();
    updatePuzzleStatus();
    renderPropertyCard();
    updateHud();
  });
}

// fillEditorGravityOptions(): fills the gravity list of the "Level" panel.
function fillEditorGravityOptions() {
  const gravitySelect = getElement('editorGravitySelect');
  const previousValue = gravitySelect.value;
  let html = '';
  for (const option of GRAVITY_OPTIONS) {
    html += `<option value="${option.gravity}">${getGravityOptionName(option)} · ${option.gravity}</option>`;
  }
  html += `<option value="custom">${translate('Personalizada', 'Custom')}</option>`;
  gravitySelect.innerHTML = html;
  gravitySelect.value = previousValue || '9.81';
}

// findGravityOption(gravity): the planet with this gravity, or null.
function findGravityOption(gravity) {
  for (const option of GRAVITY_OPTIONS) {
    if (Math.abs(option.gravity - gravity) < 1e-6) {
      return option;
    }
  }
  return null;
}

// fillEditor(): writes the values of the level in every panel of the editor.
function fillEditor() {
  const draft = editorState.levelDraft;
  if (!draft) {
    return;
  }
  const hasVectors = levelHasVectors(draft);
  const onlyVectors = draft.type === 'displacement';
  if (hasVectors) {
    draft.vectorPuzzle = cleanVectorPuzzle(draft.vectorPuzzle, draft.worldWidth);
  }
  // the tabs
  getElement('editorLaunchTab').setAttribute('aria-selected', String(draft.type === 'launch'));
  getElement('editorDisplacementTab').setAttribute('aria-selected', String(draft.type === 'displacement'));
  getElement('editorMixedTab').setAttribute('aria-selected', String(draft.type === 'mixed'));
  // the tools: "Point A" only with vectors, the piece tools only when there is a launch
  document.querySelector('.editor-tool[data-tool=start]').hidden = !hasVectors;
  const pieceToolButtons = document.querySelectorAll('.editor-tool-piece');
  for (const button of pieceToolButtons) {
    button.hidden = onlyVectors;
  }
  if (onlyVectors && editorState.selectedTool !== 'select' && editorState.selectedTool !== 'start') {
    setTool('select');
  }
  getElement('editorToolHint').textContent = getToolHint(editorState.selectedTool);
  // the parts that only make sense when there is a launch (class "launch-only" in index.html)
  const launchOnlyElements = document.querySelectorAll('.launch-only');
  for (const element of launchOnlyElements) {
    element.hidden = onlyVectors;
  }
  getElement('removeAllPiecesButton').hidden = onlyVectors;
  getElement('puzzleVariablesPanel').hidden = !hasVectors;

  // the "Level" panel
  getElement('levelNameInput').value = draft.name;
  getElement('worldWidthInput').value = draft.worldWidth;
  getElement('shotCountInput').value = draft.shotCount;
  fillEditorGravityOptions();
  const gravity = draft.launchVariables.gravity.start;
  const knownPlanet = findGravityOption(gravity);
  if (knownPlanet) {
    getElement('editorGravitySelect').value = String(knownPlanet.gravity);
  } else {
    getElement('editorGravitySelect').value = 'custom';
  }
  getElement('customGravityInput').value = gravity;
  if (!onlyVectors) {
    getElement('customGravityField').hidden = Boolean(knownPlanet);
  }
  getElement('gravityLockedCheckbox').checked = draft.launchVariables.gravity.locked;
  getElement('playerSeesGridCheckbox').checked = draft.showGrid;
  if (hasVectors) {
    getElement('playerSeesGridLabel').textContent = translate(
      'El jugador ve la cuadrícula antes de resolver (al resolver siempre aparece)',
      'The player sees the grid before solving (it always appears once solved)',
    );
  } else {
    getElement('playerSeesGridLabel').textContent = translate('El jugador ve la cuadrícula', 'The player sees the grid');
  }

  buildLaunchVariablesTable();
  if (hasVectors) {
    fillPuzzleFields();
    buildPuzzleVariableCards();
    buildAdvancedVectorTable();
    updatePuzzleStatus();
  }
  buildTemplateButtons();
  showTemplateGroups();
  updatePieceCounts();
  updateSaveButtons();
  fillOpenLevelList();
  updateHud();
  renderPropertyCard();
  updateUndoButtons();
}

// updateSaveButtons(): "Save to my levels" or "Save changes", and the buttons that only
// make sense for a level that is already saved.
function updateSaveButtons() {
  if (editorState.editingLevelId) {
    getElement('saveLevelButton').textContent = translate('Guardar cambios', 'Save changes');
  } else {
    getElement('saveLevelButton').textContent = translate('Guardar en mis niveles', 'Save to my levels');
  }
  getElement('saveAsNewButton').hidden = !editorState.editingLevelId;
  getElement('deleteLevelButton').hidden = !editorState.editingLevelId;
}

// countPiecesOfKind(kind): how many pieces of a kind the draft has.
function countPiecesOfKind(kind) {
  let count = 0;
  for (const piece of editorState.levelDraft.pieces) {
    if (piece.kind === kind) {
      count++;
    }
  }
  return count;
}

// updatePieceCounts(): the counters "Targets 2 · Wood 5 · Stone 1 · Terrain 1".
function updatePieceCounts() {
  const draft = editorState.levelDraft;
  if (draft.type === 'displacement') {
    getElement('pieceCounts').innerHTML = '';
    return;
  }
  getElement('pieceCounts').innerHTML =
    `<span>${translate('Objetivos', 'Targets')} <b>${countPiecesOfKind('target')}</b></span>` +
    `<span>${translate('Madera', 'Wood')} <b>${countPiecesOfKind('wood')}</b></span>` +
    `<span>${translate('Piedra', 'Stone')} <b>${countPiecesOfKind('stone')}</b></span>` +
    `<span>${translate('Terreno', 'Terrain')} <b>${draft.terrain.length}</b></span>`;
}

// fillOpenLevelList(): the list "Open an existing level" (campaigns and my levels).
// Each option has a value like "campaign|c3" or "custom|u123abc".
function fillOpenLevelList() {
  const levelSelect = getElement('openLevelSelect');
  levelSelect.innerHTML = '';
  const groupNames = [translate('Lanzamiento', 'Launch'), translate('Desplazamiento', 'Displacement'), translate('Mixta', 'Mixed')];
  for (let campaignIndex = 0; campaignIndex < CAMPAIGNS.length; campaignIndex++) {
    const campaign = CAMPAIGNS[campaignIndex];
    // <optgroup> is a titled group inside a list
    const group = document.createElement('optgroup');
    group.label = groupNames[campaignIndex] + translate(' (se abre una copia)', ' (opens a copy)');
    for (let index = 0; index < campaign.levels.length; index++) {
      const level = campaign.levels[index];
      const option = document.createElement('option');
      option.value = 'campaign|' + level.id;
      option.textContent = `${campaign.prefix}${index + 1}. ${getLevelName(level)}`;
      group.appendChild(option);
    }
    levelSelect.appendChild(group);
  }
  if (customLevels.length > 0) {
    const group = document.createElement('optgroup');
    group.label = translate('Mis niveles', 'My levels');
    for (const level of customLevels) {
      const option = document.createElement('option');
      option.value = 'custom|' + level.id;
      let typePrefix = '';
      if (level.type === 'displacement') {
        typePrefix = 'D · ';
      }
      if (level.type === 'mixed') {
        typePrefix = 'M · ';
      }
      option.textContent = typePrefix + level.name;
      group.appendChild(option);
    }
    levelSelect.appendChild(group);
  }
}

/* ----------------------------------------------------------------------
   THE "LEVEL" PANEL
   ---------------------------------------------------------------------- */
getElement('levelNameInput').addEventListener('change', function (event) {
  saveUndoPoint();
  editorState.levelDraft.name = event.target.value.slice(0, 40) || translate('Nivel sin nombre', 'Untitled level');
  updateHud();
});
getElement('worldWidthInput').addEventListener('change', function (event) {
  saveUndoPoint();
  const draft = editorState.levelDraft;
  draft.worldWidth = roundToTwoDecimals(clampNumber(parseNumber(event.target.value, draft.worldWidth), 20, 150));
  event.target.value = draft.worldWidth;
  // keep every piece and terrain block inside the new width
  for (const piece of draft.pieces) {
    piece.x = clampNumber(piece.x, LAUNCH_CLEAR_ZONE, Math.max(LAUNCH_CLEAR_ZONE, draft.worldWidth - piece.width));
  }
  for (const block of draft.terrain) {
    block.x = clampNumber(block.x, LAUNCH_CLEAR_ZONE, Math.max(LAUNCH_CLEAR_ZONE, draft.worldWidth - block.width));
  }
  if (draft.vectorPuzzle) {
    draft.vectorPuzzle = cleanVectorPuzzle(draft.vectorPuzzle, draft.worldWidth);
  }
  settleDraftPieces();
  refreshEditor();
});
getElement('shotCountInput').addEventListener('change', function (event) {
  saveUndoPoint();
  editorState.levelDraft.shotCount = Math.round(clampNumber(parseNumber(event.target.value, 4), 1, 10));
  event.target.value = editorState.levelDraft.shotCount;
  updateHud();
});
getElement('editorGravitySelect').addEventListener('change', function (event) {
  if (event.target.value === 'custom') {
    // show the box to type any gravity
    getElement('customGravityField').hidden = false;
    getElement('customGravityInput').focus();
    return;
  }
  saveUndoPoint();
  editorState.levelDraft.launchVariables.gravity.start = Number(event.target.value);
  getElement('customGravityInput').value = event.target.value;
  getElement('customGravityField').hidden = true;
});
getElement('customGravityInput').addEventListener('change', function (event) {
  saveUndoPoint();
  const gravity = editorState.levelDraft.launchVariables.gravity;
  gravity.start = roundToTwoDecimals(clampNumber(parseNumber(event.target.value, 9.81), 0.1, 50));
  event.target.value = gravity.start;
});
getElement('gravityLockedCheckbox').addEventListener('change', function (event) {
  saveUndoPoint();
  editorState.levelDraft.launchVariables.gravity.locked = event.target.checked;
});
getElement('playerSeesGridCheckbox').addEventListener('change', function (event) {
  saveUndoPoint();
  editorState.levelDraft.showGrid = event.target.checked;
});

/* ----------------------------------------------------------------------
   THE "LAUNCH VARIABLES" TABLE
   One row for v₀, θ and h₀ with: starting value, minimum, maximum, step and "Fixed".
   ---------------------------------------------------------------------- */

// buildLaunchVariablesTable(): creates the rows of the table.
function buildLaunchVariablesTable() {
  const tableBody = getElement('launchVariablesTableBody');
  tableBody.innerHTML = '';
  for (const key of LAUNCH_VARIABLE_KEYS) {
    const info = LAUNCH_VARIABLE_INFO[key];
    const name = getLaunchVariableName(key);
    const row = document.createElement('tr');
    row.id = key + 'TableRow';
    row.innerHTML = `<th scope="row">${name}<small>${info.unit} · ${translate('entre', 'between')} ${info.lowest} ${translate('y', 'and')} ${info.highest}</small></th>
      <td><input type="number" id="${key}StartInput" step="any" aria-label="${name}: ${translate('valor inicial', 'starting value')}"></td>
      <td class="range-cell"><input type="number" id="${key}MinInput" step="any" aria-label="${name}: ${translate('mínimo', 'minimum')}"></td>
      <td class="range-cell"><input type="number" id="${key}MaxInput" step="any" aria-label="${name}: ${translate('máximo', 'maximum')}"></td>
      <td class="range-cell"><input type="number" id="${key}StepInput" step="any" min="0.01" aria-label="${name}: ${translate('paso', 'step')}"></td>
      <td><label class="checkbox-label"><input type="checkbox" id="${key}FixedCheckbox"> ${translate('Fija', 'Fixed')}</label></td>`;
    tableBody.appendChild(row);
  }
  const inputs = tableBody.querySelectorAll('input');
  for (const input of inputs) {
    input.addEventListener('change', function () {
      readLaunchVariablesTable();
    });
  }
  refreshLaunchVariablesTable();
}

// refreshLaunchVariablesTable(): writes the current values in the table.
function refreshLaunchVariablesTable() {
  for (const key of LAUNCH_VARIABLE_KEYS) {
    const record = editorState.levelDraft.launchVariables[key];
    getElement(key + 'StartInput').value = record.start;
    getElement(key + 'MinInput').value = record.min;
    getElement(key + 'MaxInput').value = record.max;
    getElement(key + 'StepInput').value = record.step;
    getElement(key + 'FixedCheckbox').checked = record.locked;
    // a fixed variable has no range
    getElement(key + 'MinInput').disabled = record.locked;
    getElement(key + 'MaxInput').disabled = record.locked;
    getElement(key + 'StepInput').disabled = record.locked;
    getElement(key + 'TableRow').classList.toggle('row-locked', record.locked);
  }
}

// readLaunchVariablesTable(): reads the table after a change and corrects impossible values.
function readLaunchVariablesTable() {
  saveUndoPoint();
  const typed = { gravity: editorState.levelDraft.launchVariables.gravity };
  for (const key of LAUNCH_VARIABLE_KEYS) {
    typed[key] = {
      start: getElement(key + 'StartInput').value,
      min: getElement(key + 'MinInput').value,
      max: getElement(key + 'MaxInput').value,
      step: getElement(key + 'StepInput').value,
      locked: getElement(key + 'FixedCheckbox').checked,
    };
  }
  editorState.levelDraft.launchVariables = cleanLaunchVariables(typed);
  refreshLaunchVariablesTable();
  renderPropertyCard();
  // if a value had to be corrected, tell the person
  let somethingWasAdjusted = false;
  const fields = ['start', 'min', 'max', 'step'];
  for (const key of LAUNCH_VARIABLE_KEYS) {
    for (const field of fields) {
      if (parseNumber(typed[key][field], NaN) !== editorState.levelDraft.launchVariables[key][field]) {
        somethingWasAdjusted = true;
      }
    }
  }
  if (somethingWasAdjusted) {
    showEditorMessage(
      translate(
        'Ajusté algún valor para que el inicial quede entre el mínimo y el máximo, dentro de los límites de cada variable.',
        'I adjusted a value so the starting value sits between the minimum and maximum, within each variable’s limits.',
      ),
    );
  }
}
