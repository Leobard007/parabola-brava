/* ======================================================================
   FILE: js/3-editor/editor-card-and-pieces.js

   THE FLOATING PROPERTY CARD AND THE PIECES OF THE EDITOR
   - When something is selected in the scene (a vector, R, point A, the launcher or
     a piece) a small card appears over the scene with its values.
   - Placing, finding and removing pieces (wood, stone, targets and terrain).
     Pieces always rest on what is below them.

   editorState.selection can be:
     { type: 'vector', index: 0 }   a vector
     { type: 'resultant' }          R
     { type: 'startPoint' }         point A
     { type: 'launcher' }           the launcher
     { type: 'piece', item: ... }   a wood / stone / target piece of the level
     { type: 'terrain', item: ... } a terrain block of the level
   ====================================================================== */

// buildPropertyCardHeader(title, subtitle, color): the top line of the card with the
// close button (×).
function buildPropertyCardHeader(title, subtitle, color) {
  return `<div class="property-card-header"><div><b style="color:${color}">${title}</b> <small class="hint">${subtitle}</small></div><button class="close-button" id="propertyCardCloseButton" type="button" aria-label="${translate('Cerrar tarjeta', 'Close card')}">×</button></div>`;
}

// renderPropertyCard(): creates (or hides) the card of the selected thing.
function renderPropertyCard() {
  const card = getElement('editorPropertyCard');
  const selection = editorState.selection;
  const draft = editorState.levelDraft;
  if (currentView !== 'game' || gameState.screen !== 'edit' || !selection || !draft) {
    card.hidden = true;
    return;
  }
  let html = '';
  let cardClass = 'property-card';

  if (selection.type === 'vector') {
    const puzzle = draft.vectorPuzzle;
    let vector = null;
    if (puzzle) {
      vector = puzzle.vectors[selection.index];
    }
    if (!vector) {
      card.hidden = true;
      return;
    }
    const askable = findAskableQuantities(puzzle);
    cardClass += ' property-card-vector';
    html = buildPropertyCardHeader(getVectorName(selection.index), getVectorKindName(vector.kind).toLowerCase(), COLORS.vector);
    // kind of vector
    let kindOptions = '';
    for (const kind of VECTOR_KINDS) {
      let selected = '';
      if (kind === vector.kind) {
        selected = 'selected';
      }
      kindOptions += `<option value="${kind}" ${selected}>${getVectorKindName(kind)}</option>`;
    }
    html += `<div class="form-fields"><label class="form-field"><span>${translate('Tipo de magnitud', 'Quantity type')}</span><select id="cardVectorKindSelect">${kindOptions}</select></label>`;
    // what changes when the vector is stretched with the mouse
    if (vector.kind !== 'distance') {
      let mainQuantity = 'acceleration';
      let mainText = translate('la aceleración a', 'the acceleration a');
      if (vector.kind === 'velocity') {
        mainQuantity = 'speed';
        mainText = translate('la velocidad v', 'the speed v');
      }
      let mainSelected = 'selected';
      let timeSelected = '';
      if (vector.stretchChanges === 'time') {
        mainSelected = '';
        timeSelected = 'selected';
      }
      html += `<label class="form-field"><span>${translate('Al estirar cambia', 'Stretching changes')}</span><select id="cardStretchSelect"><option value="${mainQuantity}" ${mainSelected}>${mainText}</option><option value="time" ${timeSelected}>${translate('el tiempo t', 'the time t')}</option></select></label>`;
    }
    let adjustableChecked = '';
    if (getAdjustableVectorIndex(puzzle) === selection.index) {
      adjustableChecked = 'checked';
    }
    html += `</div><label class="checkbox-label"><input type="checkbox" id="cardAdjustableCheckbox" ${adjustableChecked}> ${translate('Ajustable: absorbe los cambios cuando editas R', 'Adjustable: absorbs the changes when you edit R')}</label>`;
    let rows = '';
    for (const quantity of QUANTITIES_BY_KIND[vector.kind]) {
      rows += buildVariableRow(selection.index, quantity, 'card', askable);
    }
    html += `<div class="variable-card">${rows}</div>`;
    if (puzzle.vectors.length > 1) {
      html += `<div class="button-row"><button class="button button-danger button-small" type="button" id="cardRemoveVectorButton">${translate('Quitar vector', 'Remove vector')}</button></div>`;
    }
  } else if (selection.type === 'resultant') {
    const puzzle = draft.vectorPuzzle;
    const askable = findAskableQuantities(puzzle);
    cardClass += ' property-card-resultant';
    html = buildPropertyCardHeader('R', translate('resultante de A a B', 'resultant from A to B'), COLORS.accentDark);
    const adjustableName = getVectorName(getAdjustableVectorIndex(puzzle));
    html += `<p class="hint" style="margin:0">${translate(
      `Al cambiar R se ajusta ${adjustableName}. Para que se ajuste otro, márcalo como “Ajustable” en su tarjeta.`,
      `Changing R adjusts ${adjustableName}. To adjust a different one, mark it “Adjustable” in its card.`,
    )}</p>`;
    let rows = '';
    for (const quantity of RESULTANT_QUANTITIES) {
      rows += buildVariableRow('R', quantity, 'card', askable);
    }
    html += `<div class="variable-card">${rows}</div>`;
  } else if (selection.type === 'startPoint') {
    const puzzle = draft.vectorPuzzle;
    html =
      buildPropertyCardHeader('A', translate('punto de partida', 'starting point'), COLORS.vector) +
      `<div class="form-fields"><label class="form-field"><span>x (m)</span><input type="number" id="cardStartXInput" step="0.5" value="${puzzle.startX}"></label><label class="form-field"><span>y (m)</span><input type="number" id="cardStartYInput" step="0.5" min="0" value="${puzzle.startY}"></label></div>` +
      `<p class="hint" style="margin:0">${translate('Mover A traslada todos los vectores; el problema no cambia.', 'Moving A shifts every vector; the problem stays the same.')}</p>`;
  } else if (selection.type === 'launcher') {
    const launchVariables = draft.launchVariables;
    html = buildPropertyCardHeader(
      translate('Lanzador', 'Launcher'),
      translate('valores con los que empieza el jugador', 'values the player starts with'),
      COLORS.accentDark,
    );
    let fields = '';
    const rangeTexts = [];
    for (const key of LAUNCH_VARIABLE_KEYS) {
      const record = launchVariables[key];
      const info = LAUNCH_VARIABLE_INFO[key];
      fields += `<label class="form-field"><span>${getLaunchVariableName(key)} (${info.unit})</span><input type="number" step="any" id="cardStart-${key}" value="${record.start}"></label>`;
      if (record.locked) {
        rangeTexts.push(`${info.symbol}: ${translate('fija', 'fixed')}`);
      } else {
        rangeTexts.push(`${info.symbol}: ${record.min} ${translate('a', 'to')} ${record.max}`);
      }
    }
    html += `<div class="form-fields">${fields}</div>`;
    html += `<p class="hint" style="margin:0">${rangeTexts.join(' · ')}. ${translate('Los rangos y bloqueos están en Variables del lanzamiento.', 'Ranges and locks are in Launch variables.')}</p>`;
  } else if (selection.item) {
    html = buildPieceCardHtml(selection);
  }
  card.className = cardClass;
  card.innerHTML = html;
  card.hidden = false;
  connectPropertyCard();
  positionPropertyCard();
}

// listenIfExists(id, eventName, action): adds an event listener only if the element exists.
function listenIfExists(id, eventName, action) {
  const element = getElement(id);
  if (element) {
    element.addEventListener(eventName, action);
  }
}

// connectPropertyCard(): makes the boxes and buttons of the card work.
function connectPropertyCard() {
  const selection = editorState.selection;
  const draft = editorState.levelDraft;
  listenIfExists('propertyCardCloseButton', 'click', function () {
    editorState.selection = null;
    renderPropertyCard();
    if (levelHasVectors(draft)) {
      buildPuzzleVariableCards();
    }
  });
  if (selection.type === 'vector' || selection.type === 'resultant') {
    connectVariableRows(getElement('editorPropertyCard'));
  }
  if (selection.type === 'vector') {
    listenIfExists('cardVectorKindSelect', 'change', function (event) {
      saveUndoPoint();
      const vectors = draft.vectorPuzzle.vectors;
      vectors[selection.index] = changeVectorKindKeepingLength(vectors[selection.index], event.target.value);
      refreshPuzzleEditor();
    });
    listenIfExists('cardStretchSelect', 'change', function (event) {
      saveUndoPoint();
      draft.vectorPuzzle.vectors[selection.index].stretchChanges = event.target.value;
      refreshPuzzleEditor();
    });
    listenIfExists('cardAdjustableCheckbox', 'change', function (event) {
      saveUndoPoint();
      if (event.target.checked) {
        draft.vectorPuzzle.adjustableVectorIndex = selection.index;
      } else {
        draft.vectorPuzzle.adjustableVectorIndex = null;
      }
      refreshPuzzleEditor();
    });
    listenIfExists('cardRemoveVectorButton', 'click', function () {
      removeVector(selection.index);
    });
  }
  if (selection.type === 'startPoint') {
    const startPointIds = ['cardStartXInput', 'cardStartYInput'];
    for (const id of startPointIds) {
      listenIfExists(id, 'change', function () {
        saveUndoPoint();
        const puzzle = draft.vectorPuzzle;
        puzzle.startX = parseNumber(getElement('cardStartXInput').value, puzzle.startX);
        puzzle.startY = parseNumber(getElement('cardStartYInput').value, puzzle.startY);
        refreshPuzzleEditor();
      });
    }
  }
  if (selection.type === 'launcher') {
    for (const key of LAUNCH_VARIABLE_KEYS) {
      listenIfExists('cardStart-' + key, 'change', function (event) {
        saveUndoPoint();
        const record = draft.launchVariables[key];
        record.start = parseNumber(event.target.value, record.start);
        draft.launchVariables = cleanLaunchVariables(draft.launchVariables);
        refreshLaunchVariablesTable();
        renderPropertyCard();
      });
    }
  }
  if (selection.item) {
    connectPieceCard(selection);
  }
}

// getPieceKindName(kind): "Madera" / "Wood"...
function getPieceKindName(kind) {
  if (kind === 'wood') {
    return translate('Madera', 'Wood');
  }
  if (kind === 'stone') {
    return translate('Piedra', 'Stone');
  }
  return translate('Objetivo', 'Target');
}

// buildPieceCardHtml(selection): the card of a piece or terrain block.
function buildPieceCardHtml(selection) {
  const item = selection.item;
  const isTerrain = selection.type === 'terrain';
  let title = translate('Terreno', 'Terrain');
  if (!isTerrain) {
    title = getPieceKindName(item.kind);
  }
  let html = buildPropertyCardHeader(title, translate('pieza', 'piece'), COLORS.ink) + '<div class="form-fields">';
  if (!isTerrain) {
    let options = '';
    const kinds = ['wood', 'stone', 'target'];
    for (const kind of kinds) {
      let selected = '';
      if (item.kind === kind) {
        selected = 'selected';
      }
      options += `<option value="${kind}" ${selected}>${getPieceKindName(kind)}</option>`;
    }
    html += `<label class="form-field"><span>${translate('Tipo', 'Type')}</span><select id="pieceKindSelect">${options}</select></label>`;
  }
  html += `<label class="form-field"><span>x (m)</span><input type="number" id="pieceXInput" step="0.25" value="${item.x}"></label>`;
  if (!isTerrain) {
    html += `<label class="form-field"><span>y (m)</span><input type="number" id="pieceYInput" value="${roundToTwoDecimals(item.y)}" disabled title="${translate('Las piezas se apoyan solas sobre lo que tienen debajo', 'Pieces rest on whatever is below them')}"></label>`;
  }
  // a target always measures 1.2 m, so its size can not be changed
  let sizeDisabled = '';
  if (item.kind === 'target') {
    sizeDisabled = 'disabled';
  }
  html += `<label class="form-field"><span>${translate('Ancho (m)', 'Width (m)')}</span><input type="number" id="pieceWidthInput" step="0.25" min="0.2" value="${item.width}" ${sizeDisabled}></label>`;
  html += `<label class="form-field"><span>${translate('Alto (m)', 'Height (m)')}</span><input type="number" id="pieceHeightInput" step="0.25" min="0.2" value="${item.height}" ${sizeDisabled}></label>`;
  html += `</div><div class="button-row"><button class="button button-danger button-small" type="button" id="deletePieceButton">${translate('Eliminar pieza', 'Delete piece')}</button></div>`;
  return html;
}

// connectPieceCard(selection): makes the fields of the piece card work.
function connectPieceCard(selection) {
  const item = selection.item;
  const isTerrain = selection.type === 'terrain';
  const draft = editorState.levelDraft;

  function applyPieceFields() {
    saveUndoPoint();
    const kindSelect = getElement('pieceKindSelect');
    if (!isTerrain && kindSelect) {
      const newKind = kindSelect.value;
      if (newKind !== item.kind) {
        item.kind = newKind;
        if (newKind === 'target') {
          item.width = 1.2;
          item.height = 1.2;
        } else if (item.width === 1.2 && item.height === 1.2) {
          // it was a target: use the last size used for this kind of block
          item.width = editorState.lastBlockSize[newKind].width;
          item.height = editorState.lastBlockSize[newKind].height;
        }
      }
    }
    if (item.kind !== 'target') {
      let smallest = 0.2;
      let widest = 20;
      let tallest = 20;
      if (isTerrain) {
        smallest = 0.3;
        widest = 60;
        tallest = 40;
      }
      item.width = roundToTwoDecimals(clampNumber(parseNumber(getElement('pieceWidthInput').value, item.width), smallest, widest));
      item.height = roundToTwoDecimals(clampNumber(parseNumber(getElement('pieceHeightInput').value, item.height), smallest, tallest));
    }
    const typedX = parseNumber(getElement('pieceXInput').value, item.x);
    item.x = roundToTwoDecimals(clampNumber(typedX, LAUNCH_CLEAR_ZONE, Math.max(LAUNCH_CLEAR_ZONE, draft.worldWidth - item.width)));
    settleDraftPieces();
    renderPropertyCard();
    updatePieceCounts();
    updateHud();
  }
  const fieldIds = ['pieceKindSelect', 'pieceXInput', 'pieceWidthInput', 'pieceHeightInput'];
  for (const id of fieldIds) {
    listenIfExists(id, 'change', applyPieceFields);
  }
  getElement('deletePieceButton').addEventListener('click', function () {
    saveUndoPoint();
    removeEditorItem(selection);
  });
}

// getSelectionAnchor(selection): the point of the screen (pixels) where the selected
// thing is. Used to place the card on the other side of the scene.
function getSelectionAnchor(selection) {
  const draft = editorState.levelDraft;
  if (!selection || !draft) {
    return null;
  }
  const hasVectors = levelHasVectors(draft);
  if (selection.type === 'vector' && hasVectors) {
    const resultant = calculateResultant(draft.vectorPuzzle);
    const start = resultant.points[selection.index];
    const end = resultant.points[selection.index + 1];
    if (!end) {
      return null;
    }
    return { x: (toScreenX(start.x) + toScreenX(end.x)) / 2, y: (toScreenY(start.y) + toScreenY(end.y)) / 2 };
  }
  if (selection.type === 'resultant' && hasVectors) {
    const resultant = calculateResultant(draft.vectorPuzzle);
    return { x: toScreenX(resultant.endPoint.x), y: toScreenY(resultant.endPoint.y) };
  }
  if (selection.type === 'startPoint' && hasVectors) {
    return { x: toScreenX(draft.vectorPuzzle.startX), y: toScreenY(draft.vectorPuzzle.startY) };
  }
  if (selection.type === 'launcher') {
    return { x: toScreenX(0.6), y: toScreenY(draft.launchVariables.launchHeight.start) };
  }
  if (selection.item) {
    let top = selection.item.y + selection.item.height;
    if (selection.type === 'terrain') {
      top = selection.item.height;
    }
    return { x: toScreenX(selection.item.x + selection.item.width), y: toScreenY(top) };
  }
  return null;
}

// positionPropertyCard(): places the card in the top corner OPPOSITE to the selected
// thing, so the card does not cover what is being edited. On phones the CSS places it.
function positionPropertyCard() {
  const card = getElement('editorPropertyCard');
  if (card.hidden) {
    return;
  }
  if (window.matchMedia('(max-width: 640px)').matches) {
    card.style.left = '';
    card.style.top = '';
    return;
  }
  const anchor = getSelectionAnchor(editorState.selection);
  if (!anchor) {
    return;
  }
  const wrapperWidth = getElement('stageWrapper').clientWidth;
  const stageHeight = getElement('stage').clientHeight;
  card.style.maxHeight = Math.max(220, stageHeight - 20) + 'px';
  const cardWidth = card.offsetWidth;
  if (anchor.x < wrapperWidth / 2) {
    card.style.left = wrapperWidth - cardWidth - 10 + 'px';
  } else {
    card.style.left = '10px';
  }
  card.style.top = '10px';
}

/* ----------------------------------------------------------------------
   PLACING PIECES
   ---------------------------------------------------------------------- */

// findDraftSupportHeight(piece, probeY, pieceToSkip): the height where a piece of the
// draft rests: the top of the highest terrain or piece below it (or the ground, 0).
//   probeY: only pieces whose top is below this height (plus 0.3 m) count
function findDraftSupportHeight(piece, probeY, pieceToSkip) {
  let supportY = 0;
  for (const block of editorState.levelDraft.terrain) {
    if (overlapsHorizontally(piece, block)) {
      supportY = Math.max(supportY, block.height);
    }
  }
  for (const other of editorState.levelDraft.pieces) {
    if (other === pieceToSkip) {
      continue;
    }
    const otherTop = other.y + other.height;
    if (overlapsHorizontally(piece, other) && otherTop <= probeY + 0.3 && otherTop > supportY) {
      supportY = otherTop;
    }
  }
  return roundToTwoDecimals(supportY);
}

// settleDraftPieces(): makes every piece of the draft rest on what is below it,
// from the lowest piece to the highest.
function settleDraftPieces() {
  if (!editorState.levelDraft) {
    return;
  }
  const sortedPieces = editorState.levelDraft.pieces.slice();
  sortedPieces.sort(function (first, second) {
    return first.y - second.y;
  });
  for (const piece of sortedPieces) {
    piece.y = findDraftSupportHeight(piece, piece.y, piece);
  }
  updatePieceCounts();
}

// createPiecePreview(pointer, tool): the piece that would be placed at the pointer
// (drawn semi-transparent before clicking). Returns { type: 'piece' | 'terrain', item }.
function createPiecePreview(pointer, tool) {
  const draft = editorState.levelDraft;
  if (tool === 'terrain') {
    const terrainWidth = 4;
    return {
      type: 'terrain',
      item: {
        x: roundToTwoDecimals(clampNumber(snapToStep(pointer.x - terrainWidth / 2, 0.5), LAUNCH_CLEAR_ZONE, draft.worldWidth - terrainWidth)),
        width: terrainWidth,
        height: roundToTwoDecimals(Math.max(1, snapToStep(pointer.y, 0.5))),
      },
    };
  }
  let width = 1.2;
  let height = 1.2;
  if (tool !== 'target') {
    width = editorState.lastBlockSize[tool].width;
    height = editorState.lastBlockSize[tool].height;
  }
  const piece = {
    kind: tool,
    x: roundToTwoDecimals(clampNumber(snapToStep(pointer.x - width / 2, 0.25), LAUNCH_CLEAR_ZONE, Math.max(LAUNCH_CLEAR_ZONE, draft.worldWidth - width))),
    y: 0,
    width: width,
    height: height,
  };
  piece.y = findDraftSupportHeight(piece, Math.max(0, pointer.y), null);
  return { type: 'piece', item: piece };
}

// placePieceAt(pointer, tool): adds a new piece (or terrain) to the draft.
// Returns the new selection.
function placePieceAt(pointer, tool) {
  const preview = createPiecePreview(pointer, tool);
  if (preview.type === 'terrain') {
    editorState.levelDraft.terrain.push(preview.item);
  } else {
    editorState.levelDraft.pieces.push(preview.item);
  }
  settleDraftPieces();
  return preview;
}

// isNearStartPoint(pointer): true if the pointer is on point A (the piglet at A).
function isNearStartPoint(pointer) {
  const draft = editorState.levelDraft;
  if (!levelHasVectors(draft)) {
    return false;
  }
  const distance = Math.hypot(pointer.x - draft.vectorPuzzle.startX, pointer.y - (draft.vectorPuzzle.startY + 0.6));
  return distance < Math.max(1.2, 14 / sceneView.scale);
}

// moveStartPoint(pointer): moves point A to the pointer (snapped to 0.5 m).
function moveStartPoint(pointer) {
  const draft = editorState.levelDraft;
  draft.vectorPuzzle.startX = roundToTwoDecimals(clampNumber(snapToStep(pointer.x, 0.5), LAUNCH_CLEAR_ZONE + 0.6, draft.worldWidth - 0.6));
  draft.vectorPuzzle.startY = roundToTwoDecimals(clampNumber(snapToStep(pointer.y - 0.6, 0.5), 0, 30));
}

// findPieceAt(pointer): the piece or terrain block under the pointer (with a margin of
// 6 pixels). Returns { type: 'piece' | 'terrain', item } or null.
function findPieceAt(pointer) {
  const draft = editorState.levelDraft;
  const margin = 6 / sceneView.scale;
  if (draft.type === 'displacement') {
    return null;
  }
  // from the last to the first, so the piece drawn on top is found first
  for (let index = draft.pieces.length - 1; index >= 0; index--) {
    const piece = draft.pieces[index];
    const insideX = pointer.x >= piece.x - margin && pointer.x <= piece.x + piece.width + margin;
    const insideY = pointer.y >= piece.y - margin && pointer.y <= piece.y + piece.height + margin;
    if (insideX && insideY) {
      return { type: 'piece', item: piece };
    }
  }
  for (let index = draft.terrain.length - 1; index >= 0; index--) {
    const block = draft.terrain[index];
    const insideX = pointer.x >= block.x - margin && pointer.x <= block.x + block.width + margin;
    const insideY = pointer.y >= -margin && pointer.y <= block.height + margin;
    if (insideX && insideY) {
      return { type: 'terrain', item: block };
    }
  }
  return null;
}

// removeEditorItem(found): removes a piece or terrain block ({ type, item }) from the draft.
function removeEditorItem(found) {
  let list = editorState.levelDraft.pieces;
  if (found.type === 'terrain') {
    list = editorState.levelDraft.terrain;
  }
  const index = list.indexOf(found.item);
  if (index >= 0) {
    list.splice(index, 1);
  }
  if (editorState.selection && editorState.selection.item === found.item) {
    editorState.selection = null;
  }
  settleDraftPieces();
  renderPropertyCard();
  updateHud();
}

// getResizeHandlePosition(selection): where the small square to resize a piece is
// (its top-right corner), in pixels.
function getResizeHandlePosition(selection) {
  const item = selection.item;
  let top = item.y + item.height;
  if (selection.type === 'terrain') {
    top = item.height;
  }
  return { x: toScreenX(item.x + item.width), y: toScreenY(top) };
}

// updateSelectedPieceFields(): while a piece is dragged, updates the numbers of its card.
function updateSelectedPieceFields() {
  if (!editorState.selection || !editorState.selection.item) {
    return;
  }
  const item = editorState.selection.item;
  const fields = [
    { id: 'pieceXInput', value: item.x },
    { id: 'pieceYInput', value: item.y || 0 },
    { id: 'pieceWidthInput', value: item.width },
    { id: 'pieceHeightInput', value: item.height },
  ];
  for (const field of fields) {
    const box = getElement(field.id);
    if (box) {
      box.value = roundToTwoDecimals(field.value);
    }
  }
}
