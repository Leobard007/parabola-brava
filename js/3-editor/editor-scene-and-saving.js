/* ======================================================================
   FILE: js/3-editor/editor-scene-and-saving.js

   EDITING DIRECTLY IN THE SCENE, AND SAVING
   - The mouse (or finger) on the canvas: select, drag vector tips, rotate vectors,
     move point A or B, change the launcher, place / move / resize / erase pieces.
   - Keyboard shortcuts of the editor (Ctrl+Z, Ctrl+Y, Delete, Escape).
   - Test, save, delete, open, and share levels with a code.

   The browser sends "pointer" events for the mouse, a finger or a pen:
     pointerdown (pressed), pointermove (moved), pointerup (released).
   ====================================================================== */

// pointerToWorld(event): converts the position of the pointer on the canvas into meters
// of the world. Returns { x, y } in meters and { pixelX, pixelY } in pixels.
function pointerToWorld(event) {
  // getBoundingClientRect() tells where the canvas is on the screen
  const canvasBox = gameCanvas.getBoundingClientRect();
  const pixelX = event.clientX - canvasBox.left;
  const pixelY = event.clientY - canvasBox.top;
  return {
    x: pixelX / sceneView.scale + sceneView.leftX,
    y: (canvasHeight - pixelY) / sceneView.scale + sceneView.bottomY,
    pixelX: pixelX,
    pixelY: pixelY,
  };
}

// distanceToSegment(pointX, pointY, startX, startY, endX, endY): the shortest distance
// from a point to a line segment (used to know if the pointer is on a vector).
function distanceToSegment(pointX, pointY, startX, startY, endX, endY) {
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  // fraction: where the closest point of the segment is (0 = start, 1 = end)
  let fraction = 0;
  if (lengthSquared > 0) {
    fraction = clampNumber(((pointX - startX) * segmentX + (pointY - startY) * segmentY) / lengthSquared, 0, 1);
  }
  return Math.hypot(pointX - startX - fraction * segmentX, pointY - startY - fraction * segmentY);
}

// LAUNCHER_ARROW_SCALE: length of the launcher arrow on screen: 0.13 m per each m/s of v₀.
const LAUNCHER_ARROW_SCALE = 0.13;

// getLauncherArrowTip(launchVariables): where the launcher arrow starts and ends (pixels).
function getLauncherArrowTip(launchVariables) {
  const originX = toScreenX(0);
  const originY = toScreenY(launchVariables.launchHeight.start);
  const angleInRadians = (launchVariables.launchAngle.start * Math.PI) / 180;
  const speed = launchVariables.launchSpeed.start;
  return {
    originX: originX,
    originY: originY,
    x: originX + speed * Math.cos(angleInRadians) * LAUNCHER_ARROW_SCALE * sceneView.scale,
    y: originY - speed * Math.sin(angleInRadians) * LAUNCHER_ARROW_SCALE * sceneView.scale,
  };
}

// findEditorHandleAt(pointer, tolerance): finds which part of the vectors or the launcher
// is under the pointer. Returns { part, index } or null. The parts are:
//   'endPointB'      point B (dragging it changes R)
//   'vectorRotate'   the diamond of the selected vector (rotates it)
//   'vectorTip'      the tip of a vector (changes its length and angle)
//   'startPointA'    point A
//   'vectorBody'     the line of a vector (moves the whole chain)
//   'resultantBody'  the line of R (moves the whole chain)
//   'launcherArrow'  the tip of the launcher arrow (changes v₀ and θ)
//   'launcherHeight' the square at the side of the launcher (changes h₀)
//   'launcherBody'   the launcher itself
//   tolerance: how many pixels away still count
function findEditorHandleAt(pointer, tolerance) {
  const draft = editorState.levelDraft;
  if (levelHasVectors(draft)) {
    const puzzle = draft.vectorPuzzle;
    const points = calculateResultant(puzzle).points;
    const endPoint = points[points.length - 1];
    if (Math.hypot(pointer.pixelX - toScreenX(endPoint.x), pointer.pixelY - toScreenY(endPoint.y)) < tolerance + 2) {
      return { part: 'endPointB' };
    }
    const selection = editorState.selection;
    if (selection && selection.type === 'vector' && points[selection.index + 1]) {
      // the diamond is at 62% of the selected vector
      const start = points[selection.index];
      const end = points[selection.index + 1];
      const diamondX = toScreenX(start.x + (end.x - start.x) * 0.62);
      const diamondY = toScreenY(start.y + (end.y - start.y) * 0.62);
      if (Math.hypot(pointer.pixelX - diamondX, pointer.pixelY - diamondY) < tolerance) {
        return { part: 'vectorRotate', index: selection.index };
      }
    }
    // the tips of every vector except the last one (the last tip is B)
    for (let index = 0; index < points.length - 2; index++) {
      const tip = points[index + 1];
      if (Math.hypot(pointer.pixelX - toScreenX(tip.x), pointer.pixelY - toScreenY(tip.y)) < tolerance) {
        return { part: 'vectorTip', index: index };
      }
    }
    if (isNearStartPoint(pointer)) {
      return { part: 'startPointA' };
    }
    for (let index = 0; index < points.length - 1; index++) {
      const distance = distanceToSegment(
        pointer.pixelX,
        pointer.pixelY,
        toScreenX(points[index].x),
        toScreenY(points[index].y),
        toScreenX(points[index + 1].x),
        toScreenY(points[index + 1].y),
      );
      if (distance < tolerance - 2) {
        return { part: 'vectorBody', index: index };
      }
    }
    const resultantDistance = distanceToSegment(
      pointer.pixelX,
      pointer.pixelY,
      toScreenX(puzzle.startX),
      toScreenY(puzzle.startY),
      toScreenX(endPoint.x),
      toScreenY(endPoint.y),
    );
    if (resultantDistance < tolerance - 2) {
      return { part: 'resultantBody' };
    }
  }
  if (draft.type !== 'displacement') {
    const launchVariables = draft.launchVariables;
    const arrowTip = getLauncherArrowTip(launchVariables);
    if (Math.hypot(pointer.pixelX - arrowTip.x, pointer.pixelY - arrowTip.y) < tolerance) {
      return { part: 'launcherArrow' };
    }
    if (Math.hypot(pointer.pixelX - toScreenX(-0.6), pointer.pixelY - arrowTip.originY) < tolerance) {
      return { part: 'launcherHeight' };
    }
    if (pointer.x > -0.8 && pointer.x < 0.8 && pointer.y > -0.2 && pointer.y < launchVariables.launchHeight.start + 1.2) {
      return { part: 'launcherBody' };
    }
  }
  return null;
}

// snapAngle(angle, shiftPressed): rounds an angle to whole degrees, or to steps of 15°
// when Shift is pressed.
function snapAngle(angle, shiftPressed) {
  if (shiftPressed) {
    return Math.round(angle / 15) * 15;
  }
  return Math.round(angle);
}

// snapVectorComponents(dx, dy, shiftPressed): rounds the components of a dragged vector.
//   - "Round values" on: whole meters, preferring exact triangles (3-4-5, 6-8-10...)
//   - otherwise: length in steps of 0.5 m and angle in whole degrees (15° with Shift)
function snapVectorComponents(dx, dy, shiftPressed) {
  if (editorState.roundValues && !shiftPressed) {
    let best = null;
    const roundX = Math.round(dx);
    const roundY = Math.round(dy);
    // try the whole numbers around the pointer and keep the best one
    for (let tryX = roundX - 1; tryX <= roundX + 1; tryX++) {
      for (let tryY = roundY - 1; tryY <= roundY + 1; tryY++) {
        const length = Math.hypot(tryX, tryY);
        if (length < 0.5) {
          continue;
        }
        // an "exact" triangle has a whole number as its length (like 3-4-5)
        const isExactTriangle = tryX !== 0 && tryY !== 0 && Math.abs(length - Math.round(length)) < 1e-9;
        let score = Math.hypot(tryX - dx, tryY - dy);
        if (isExactTriangle) {
          score -= 0.9; // exact triangles are preferred
        }
        if (!best || score < best.score) {
          best = { x: tryX, y: tryY, score: score };
        }
      }
    }
    if (best) {
      return best;
    }
    return { x: roundX, y: roundY };
  }
  const length = Math.max(0.5, Math.round(Math.hypot(dx, dy) * 2) / 2);
  const angleInRadians = (snapAngle((Math.atan2(dy, dx) * 180) / Math.PI, shiftPressed) * Math.PI) / 180;
  return { x: length * Math.cos(angleInRadians), y: length * Math.sin(angleInRadians) };
}

// selectionTypeForPart(part): which thing is selected when a part is clicked.
function selectionTypeForPart(part) {
  if (part === 'vectorTip' || part === 'vectorRotate' || part === 'vectorBody') {
    return 'vector';
  }
  if (part === 'endPointB' || part === 'resultantBody') {
    return 'resultant';
  }
  if (part === 'startPointA') {
    return 'startPoint';
  }
  return 'launcher';
}

// The pointer is pressed on the canvas
gameCanvas.addEventListener('pointerdown', function (event) {
  if (currentView !== 'game' || gameState.screen !== 'edit') {
    return;
  }
  const pointer = pointerToWorld(event);
  editorState.pointerPosition = pointer;
  // "capture" the pointer: the canvas keeps receiving its events even outside it
  try {
    gameCanvas.setPointerCapture(event.pointerId);
  } catch (error) {
    // nothing to do
  }
  const draft = editorState.levelDraft;
  const tool = editorState.selectedTool;
  // fingers are less precise than a mouse, so the tolerance is bigger
  let tolerance = 11;
  if (event.pointerType === 'touch') {
    tolerance = 20;
  }

  if (tool === 'select') {
    // 1) the resize handle of the selected piece
    const selection = editorState.selection;
    if (selection && selection.item && selection.item.kind !== 'target') {
      const handle = getResizeHandlePosition(selection);
      if (Math.hypot(pointer.pixelX - handle.x, pointer.pixelY - handle.y) < tolerance) {
        editorState.dragging = { mode: 'resize', undoSaved: false };
        return;
      }
    }
    // 2) a part of the vectors or the launcher
    const handle = findEditorHandleAt(pointer, tolerance);
    if (handle) {
      const selectionType = selectionTypeForPart(handle.part);
      if (selectionType === 'vector') {
        editorState.selection = { type: 'vector', index: handle.index };
      } else {
        editorState.selection = { type: selectionType };
      }
      // grabOffset: distance from point A to the pointer (to move the chain without jumping)
      let grabOffsetX = 0;
      let grabOffsetY = 0;
      if (levelHasVectors(draft)) {
        grabOffsetX = pointer.x - draft.vectorPuzzle.startX;
        grabOffsetY = pointer.y - draft.vectorPuzzle.startY;
      }
      editorState.dragging = { mode: handle.part, index: handle.index, grabOffsetX: grabOffsetX, grabOffsetY: grabOffsetY, undoSaved: false };
      renderPropertyCard();
      if (levelHasVectors(draft)) {
        buildPuzzleVariableCards();
      }
      return;
    }
    // 3) a piece (or nothing: the selection is removed)
    const found = findPieceAt(pointer);
    editorState.selection = found;
    if (found) {
      editorState.dragging = {
        mode: 'movePiece',
        offsetX: pointer.x - found.item.x,
        offsetY: pointer.y - (found.item.y || 0),
        undoSaved: false,
      };
    }
    renderPropertyCard();
    if (levelHasVectors(draft)) {
      buildPuzzleVariableCards();
    }
  } else if (tool === 'start') {
    saveUndoPoint();
    moveStartPoint({ x: pointer.x, y: pointer.y + 0.6 });
    editorState.dragging = { mode: 'startTool', undoSaved: true };
    editorState.propertyCardNeedsUpdate = true;
  } else if (tool === 'erase') {
    editorState.dragging = { mode: 'erase', undoSaved: false };
    const found = findPieceAt(pointer);
    if (found) {
      saveUndoPoint();
      editorState.dragging.undoSaved = true;
      removeEditorItem(found);
    }
  } else {
    // wood, stone, target or terrain: place a new piece
    saveUndoPoint();
    editorState.selection = placePieceAt(pointer, tool);
    renderPropertyCard();
    updateHud();
  }
});

// saveUndoPointOnce(dragging): during a drag, the undo point is saved only once, at the
// first movement that really changes something.
function saveUndoPointOnce(dragging) {
  if (!dragging.undoSaved) {
    saveUndoPoint();
    dragging.undoSaved = true;
  }
}

// The pointer moves over the canvas
gameCanvas.addEventListener('pointermove', function (event) {
  if (currentView !== 'game' || gameState.screen !== 'edit') {
    return;
  }
  const pointer = pointerToWorld(event);
  editorState.pointerPosition = pointer;
  const draft = editorState.levelDraft;
  const dragging = editorState.dragging;
  const puzzle = draft.vectorPuzzle;

  if (dragging) {
    if (dragging.mode === 'vectorTip') {
      saveUndoPointOnce(dragging);
      const start = calculateResultant(puzzle).points[dragging.index];
      const snapped = snapVectorComponents(pointer.x - start.x, pointer.y - start.y, event.shiftKey);
      setVectorComponents(dragging.index, snapped.x, snapped.y);
    } else if (dragging.mode === 'vectorRotate') {
      saveUndoPointOnce(dragging);
      const resultant = calculateResultant(puzzle);
      const start = resultant.points[dragging.index];
      const length = resultant.vectorValues[dragging.index].distance;
      const angle = snapAngle((Math.atan2(pointer.y - start.y, pointer.x - start.x) * 180) / Math.PI, event.shiftKey);
      const angleInRadians = (angle * Math.PI) / 180;
      setVectorComponents(dragging.index, length * Math.cos(angleInRadians), length * Math.sin(angleInRadians));
    } else if (dragging.mode === 'endPointB') {
      saveUndoPointOnce(dragging);
      const snapped = snapVectorComponents(pointer.x - puzzle.startX, pointer.y - puzzle.startY, event.shiftKey);
      setResultantComponents(snapped.x, snapped.y);
    } else if (dragging.mode === 'vectorBody' || dragging.mode === 'startPointA' || dragging.mode === 'resultantBody') {
      // move the whole chain (point A and every vector)
      saveUndoPointOnce(dragging);
      puzzle.startX = roundToTwoDecimals(clampNumber(snapToStep(pointer.x - dragging.grabOffsetX, 0.5), LAUNCH_CLEAR_ZONE + 0.6, draft.worldWidth - 0.6));
      puzzle.startY = roundToTwoDecimals(clampNumber(snapToStep(pointer.y - dragging.grabOffsetY, 0.5), 0, 30));
    } else if (dragging.mode === 'startTool') {
      moveStartPoint({ x: pointer.x, y: pointer.y + 0.6 });
    } else if (dragging.mode === 'launcherArrow') {
      // the arrow: its length is v₀ and its angle is θ
      saveUndoPointOnce(dragging);
      const arrowTip = getLauncherArrowTip(draft.launchVariables);
      const pixelsPerSpeed = LAUNCHER_ARROW_SCALE * sceneView.scale;
      const speedX = (pointer.pixelX - arrowTip.originX) / pixelsPerSpeed;
      const speedY = (arrowTip.originY - pointer.pixelY) / pixelsPerSpeed;
      draft.launchVariables.launchSpeed.start = Math.round(Math.hypot(speedX, speedY) * 2) / 2;
      draft.launchVariables.launchAngle.start = snapAngle((Math.atan2(speedY, speedX) * 180) / Math.PI, event.shiftKey);
      draft.launchVariables = cleanLaunchVariables(draft.launchVariables);
    } else if (dragging.mode === 'launcherHeight') {
      saveUndoPointOnce(dragging);
      draft.launchVariables.launchHeight.start = Math.max(0, snapToStep(pointer.y, 0.5));
      draft.launchVariables = cleanLaunchVariables(draft.launchVariables);
    } else if (dragging.mode === 'movePiece') {
      if (editorState.selection && editorState.selection.item) {
        saveUndoPointOnce(dragging);
        const item = editorState.selection.item;
        item.x = roundToTwoDecimals(
          clampNumber(snapToStep(pointer.x - dragging.offsetX, 0.25), LAUNCH_CLEAR_ZONE, Math.max(LAUNCH_CLEAR_ZONE, draft.worldWidth - item.width)),
        );
        if (editorState.selection.type === 'piece') {
          item.y = Math.max(0, pointer.y - dragging.offsetY);
        }
        updateSelectedPieceFields();
      }
    } else if (dragging.mode === 'resize') {
      if (editorState.selection && editorState.selection.item) {
        saveUndoPointOnce(dragging);
        const item = editorState.selection.item;
        const isTerrain = editorState.selection.type === 'terrain';
        let smallest = 0.25;
        let widest = 20;
        let tallest = 20;
        let bottom = item.y;
        if (isTerrain) {
          smallest = 0.5;
          widest = 60;
          tallest = 40;
          bottom = 0;
        }
        item.width = roundToTwoDecimals(clampNumber(snapToStep(pointer.x - item.x, 0.25), smallest, Math.min(widest, draft.worldWidth - item.x)));
        item.height = roundToTwoDecimals(clampNumber(snapToStep(pointer.y - bottom, 0.25), smallest, tallest));
        if (!isTerrain) {
          // new blocks of this kind will have this size
          editorState.lastBlockSize[item.kind] = { width: item.width, height: item.height };
        }
        updateSelectedPieceFields();
      }
    } else if (dragging.mode === 'erase') {
      const found = findPieceAt(pointer);
      if (found) {
        saveUndoPointOnce(dragging);
        removeEditorItem(found);
      }
    }
    if (dragging.mode !== 'movePiece' && dragging.mode !== 'resize' && dragging.mode !== 'erase') {
      editorState.propertyCardNeedsUpdate = true; // the card is redrawn in the main loop
    }
  }

  // the shape of the mouse cursor shows what can be done
  let cursor = 'crosshair';
  if (editorState.selectedTool === 'select') {
    cursor = 'default';
    const selection = editorState.selection;
    if (selection && selection.item && selection.item.kind !== 'target') {
      const handle = getResizeHandlePosition(selection);
      if (Math.hypot(pointer.pixelX - handle.x, pointer.pixelY - handle.y) < 11) {
        cursor = 'nwse-resize';
      }
    }
    if (cursor === 'default') {
      const handle = findEditorHandleAt(pointer, 11);
      if (handle) {
        if (dragging) {
          cursor = 'grabbing';
        } else if (handle.part === 'vectorTip' || handle.part === 'endPointB' || handle.part === 'launcherArrow') {
          cursor = 'crosshair';
        } else if (handle.part === 'vectorRotate') {
          cursor = 'alias';
        } else if (handle.part === 'launcherHeight') {
          cursor = 'ns-resize';
        } else {
          cursor = 'grab';
        }
      } else if (findPieceAt(pointer)) {
        if (dragging) {
          cursor = 'grabbing';
        } else {
          cursor = 'grab';
        }
      }
    }
  }
  gameCanvas.style.cursor = cursor;
});

// The pointer is released: the drag ends
function endEditorDrag() {
  const dragging = editorState.dragging;
  if (!dragging) {
    return;
  }
  editorState.dragging = null;
  settleDraftPieces();
  if (dragging.undoSaved) {
    if (dragging.mode === 'launcherArrow' || dragging.mode === 'launcherHeight') {
      refreshLaunchVariablesTable();
    }
    if (levelHasVectors(editorState.levelDraft)) {
      refreshPuzzleEditor();
    }
  }
  renderPropertyCard();
  updateHud();
  updatePieceCounts();
}
gameCanvas.addEventListener('pointerup', function () {
  endEditorDrag();
});
gameCanvas.addEventListener('pointercancel', function () {
  endEditorDrag();
});
gameCanvas.addEventListener('pointerleave', function () {
  if (!editorState.dragging) {
    editorState.pointerPosition = null; // hides the preview of the piece
  }
});

// handleEditorKey(event): keyboard shortcuts of the editor (called from controls.js).
function handleEditorKey(event) {
  const tagName = event.target.tagName;
  const isTyping = tagName === 'INPUT' || tagName === 'SELECT' || tagName === 'TEXTAREA';
  // Ctrl (or Cmd on Mac)
  const controlPressed = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if (controlPressed && !isTyping && key === 'z') {
    event.preventDefault();
    if (event.shiftKey) {
      redo();
    } else {
      undo();
    }
    return;
  }
  if (controlPressed && !isTyping && key === 'y') {
    event.preventDefault();
    redo();
    return;
  }
  if (event.key === 'Escape' && editorState.selection) {
    editorState.selection = null;
    renderPropertyCard();
    if (levelHasVectors(editorState.levelDraft)) {
      buildPuzzleVariableCards();
    }
    return;
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') && !isTyping && editorState.selection) {
    event.preventDefault();
    if (editorState.selection.item) {
      saveUndoPoint();
      removeEditorItem(editorState.selection);
    } else if (editorState.selection.type === 'vector') {
      removeVector(editorState.selection.index);
    }
  }
}

/* ----------------------------------------------------------------------
   TEST, SAVE, OPEN AND SHARE
   ---------------------------------------------------------------------- */

// validateDraft(): checks that the level can be played. Shows the problem if not.
function validateDraft() {
  const draft = editorState.levelDraft;
  const fixHint = translate(' Pulsa Arreglar en Variables del problema.', ' Press Fix in Problem variables.');
  if (levelHasVectors(draft)) {
    const problem = findVectorPuzzleProblem(draft);
    if (problem) {
      showEditorMessage(problem + fixHint, 'error');
      return false;
    }
    const solvability = checkPuzzleSolvability(draft.vectorPuzzle);
    if (!solvability.solvable) {
      showEditorMessage(solvability.message + fixHint, 'error');
      return false;
    }
  } else if (countPiecesOfKind('target') === 0) {
    showEditorMessage(
      translate('Coloca al menos un objetivo antes de probar o guardar el nivel.', 'Place at least one target before testing or saving the level.'),
      'error',
    );
    return false;
  }
  return true;
}

// buildCleanLevelFromDraft(): a clean copy of the draft, ready to be saved or played.
function buildCleanLevelFromDraft() {
  settleDraftPieces();
  const level = cleanLevel(deepCopy(editorState.levelDraft));
  if (level.type === 'launch') {
    level.vectorPuzzle = null;
  }
  if (level.type === 'displacement') {
    level.pieces = [];
    level.terrain = [];
  }
  return level;
}

// "Test level" button
getElement('testLevelButton').addEventListener('click', function () {
  if (!validateDraft()) {
    return;
  }
  const level = buildCleanLevelFromDraft();
  level.id = '__test';
  editorState.selection = null;
  gameState.scoreAtLevelStart = gameState.score;
  loadLevel(level, { testing: true });
  showEditorMessage('');
});

// storeDraft(asNew): saves the level in "My levels".
//   asNew: true for "Save as new" (creates a copy instead of replacing)
function storeDraft(asNew) {
  if (!validateDraft()) {
    return;
  }
  const level = buildCleanLevelFromDraft();
  if (editorState.editingLevelId && !asNew) {
    // replace the saved level
    level.id = editorState.editingLevelId;
    let replaced = false;
    for (let index = 0; index < customLevels.length; index++) {
      if (customLevels[index].id === editorState.editingLevelId) {
        customLevels[index] = level;
        replaced = true;
      }
    }
    if (!replaced) {
      customLevels.push(level);
    }
  } else {
    // a new level
    level.id = createUniqueId();
    if (asNew) {
      for (const other of customLevels) {
        if (other.name === level.name) {
          level.name = (level.name + ' 2').slice(0, 40);
          break;
        }
      }
    }
    customLevels.push(level);
    editorState.editingLevelId = level.id;
    editorState.levelDraft.name = level.name;
    getElement('levelNameInput').value = level.name;
  }
  editorState.levelDraft.id = editorState.editingLevelId;
  const saved = saveCustomLevels();
  if (saved) {
    showEditorMessage(translate(`“${level.name}” está guardado en Mis niveles.`, `“${level.name}” is saved in My levels.`), 'ok');
  } else {
    showEditorMessage(
      translate(
        `“${level.name}” está en Mis niveles durante esta sesión, pero este navegador no permite guardarlo de forma permanente. Usa el código para conservarlo.`,
        `“${level.name}” is in My levels for this session, but this browser won’t store it permanently. Use the code to keep it.`,
      ),
      'error',
    );
  }
  updateSaveButtons();
  fillOpenLevelList();
  updateHud();
}
getElement('saveLevelButton').addEventListener('click', function () {
  storeDraft(false);
});
getElement('saveAsNewButton').addEventListener('click', function () {
  storeDraft(true);
});

// confirmWithSecondPress(button, spanishLabel, englishLabel, action): dangerous buttons
// ask "Press again to confirm"; the action happens only on the second press (within 3 s).
function confirmWithSecondPress(button, spanishLabel, englishLabel, action) {
  if (editorState.buttonWaitingConfirmation === button.id) {
    editorState.buttonWaitingConfirmation = null;
    button.textContent = translate(spanishLabel, englishLabel);
    action();
    return;
  }
  editorState.buttonWaitingConfirmation = button.id;
  button.textContent = translate('Pulsa otra vez para confirmar', 'Press again to confirm');
  // setTimeout(function, milliseconds) runs the function once, after that time
  setTimeout(function () {
    if (editorState.buttonWaitingConfirmation === button.id) {
      editorState.buttonWaitingConfirmation = null;
      button.textContent = translate(spanishLabel, englishLabel);
    }
  }, 3000);
}

// "New blank level"
getElement('newBlankLevelButton').addEventListener('click', function (event) {
  confirmWithSecondPress(event.currentTarget, 'Nuevo en blanco', 'New blank level', function () {
    saveUndoPoint();
    editorState.levelDraft = createBlankLevel(editorState.levelDraft.type);
    editorState.editingLevelId = null;
    editorState.selection = null;
    fillEditor();
    showEditorMessage(translate('Nivel en blanco listo. Deshacer recupera el anterior.', 'Blank level ready. Undo brings back the previous one.'));
  });
});
// "Remove all pieces"
getElement('removeAllPiecesButton').addEventListener('click', function (event) {
  confirmWithSecondPress(event.currentTarget, 'Quitar todas las piezas', 'Remove all pieces', function () {
    saveUndoPoint();
    editorState.levelDraft.pieces = [];
    editorState.levelDraft.terrain = [];
    editorState.selection = null;
    renderPropertyCard();
    updatePieceCounts();
    updateHud();
    showEditorMessage(translate('Se quitaron todas las piezas. Deshacer las recupera.', 'All pieces removed. Undo brings them back.'));
  });
});
// "Delete from my levels"
getElement('deleteLevelButton').addEventListener('click', function (event) {
  confirmWithSecondPress(event.currentTarget, 'Eliminar de mis niveles', 'Delete from my levels', function () {
    const name = editorState.levelDraft.name;
    const remainingLevels = [];
    for (const level of customLevels) {
      if (level.id !== editorState.editingLevelId) {
        remainingLevels.push(level);
      }
    }
    customLevels = remainingLevels;
    delete progress.starsByLevel[editorState.editingLevelId];
    if (progress.lastLevelId === editorState.editingLevelId) {
      progress.lastLevelId = null;
    }
    saveCustomLevels();
    saveProgress();
    editorState.editingLevelId = null;
    editorState.levelDraft.id = null;
    updateSaveButtons();
    fillOpenLevelList();
    showEditorMessage(
      translate(
        `“${name}” se eliminó de Mis niveles. Sigue abierto aquí por si quieres guardarlo de nuevo.`,
        `“${name}” was deleted from My levels. It stays open here in case you want to save it again.`,
      ),
    );
  });
});
// "Open" button
getElement('openLevelButton').addEventListener('click', function () {
  const value = getElement('openLevelSelect').value;
  if (!value) {
    return;
  }
  // the value is "campaign|id" or "custom|id"
  const parts = value.split('|');
  const source = parts[0];
  const id = parts[1];
  let level = null;
  if (source === 'campaign') {
    for (const campaign of CAMPAIGNS) {
      for (const campaignLevel of campaign.levels) {
        if (campaignLevel.id === id) {
          level = campaignLevel;
        }
      }
    }
  } else {
    for (const customLevel of customLevels) {
      if (customLevel.id === id) {
        level = customLevel;
      }
    }
  }
  if (!level) {
    return;
  }
  openEditor(level);
  if (source === 'campaign') {
    showEditorMessage(
      translate(
        `Abriste una copia de “${getLevelName(level)}”. Guárdala para tenerla en Mis niveles.`,
        `You opened a copy of “${getLevelName(level)}”. Save it to keep it in My levels.`,
      ),
    );
  } else {
    showEditorMessage(translate(`Editando “${level.name}”.`, `Editing “${level.name}”.`));
  }
});

// "Generate and copy code" button
getElement('exportCodeButton').addEventListener('click', function () {
  const code = encodeLevelCode(buildCleanLevelFromDraft());
  const codeBox = getElement('levelCodeBox');
  codeBox.value = code;
  // if copying is not possible, select the text so the person can copy it by hand
  function selectCodeForManualCopy() {
    codeBox.focus();
    codeBox.select();
    showEditorMessage(
      translate(
        'Código generado y seleccionado: cópialo con Ctrl+C (o mantén pulsado en el móvil).',
        'Code generated and selected: copy it with Ctrl+C (or long-press on mobile).',
      ),
      'ok',
    );
  }
  function showCopiedMessage() {
    showEditorMessage(
      translate(
        'Código copiado. Quien lo pegue en su editor tendrá este mismo nivel.',
        'Code copied. Whoever pastes it into their editor gets this same level.',
      ),
      'ok',
    );
  }
  try {
    // navigator.clipboard.writeText copies text to the clipboard. It finishes a moment
    // later, so .then(success, failure) says what to do when it works or when it fails.
    navigator.clipboard.writeText(code).then(showCopiedMessage, selectCodeForManualCopy);
  } catch (error) {
    selectCodeForManualCopy();
  }
});

// "Load pasted code" button
getElement('importCodeButton').addEventListener('click', function () {
  const text = getElement('levelCodeBox').value;
  if (!text.trim()) {
    showEditorMessage(translate('Pega primero un código en el cuadro.', 'Paste a code into the box first.'), 'error');
    return;
  }
  try {
    const level = cleanLevel(decodeLevelCode(text));
    saveUndoPoint();
    editorState.levelDraft = level;
    editorState.levelDraft.id = null;
    editorState.editingLevelId = null;
    editorState.selection = null;
    fillEditor();
    showEditorMessage(
      translate(`Cargado “${level.name}”. Guárdalo para tenerlo en Mis niveles.`, `Loaded “${level.name}”. Save it to keep it in My levels.`),
      'ok',
    );
  } catch (error) {
    showEditorMessage(
      translate('Ese código no es válido. Revisa que lo hayas copiado completo.', 'That code isn’t valid. Check that you copied all of it.'),
      'error',
    );
  }
});
