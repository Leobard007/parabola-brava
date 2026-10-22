/* ======================================================================
   FILE: js/3-editor/editor-variables-panel.js

   THE "PROBLEM VARIABLES" PANEL (vector levels)
   One card for each vector and one for R. Each row of a card shows a value
   (that can be edited) and three buttons that decide what the player sees:
     Given → the player sees the value
     ?     → the player must find it (the button turns off if it cannot be calculated)
     —     → hidden
   Every change keeps the problem coherent: for example, changing |R| adjusts the
   "adjustable" vector so the vectors still add up to R.

   Also here: the "Fix" button, the A / attempts / tolerance fields, the advanced
   vector table and the full visibility matrix.
   ====================================================================== */

// findAskableQuantities(puzzle): for every quantity of the puzzle, says if it could be
// asked as an unknown with the data given now. Returns an object like
// { "0.distance": true, "R.angle": false, ... }
function findAskableQuantities(puzzle) {
  const askable = {};
  const baseAnalysis = analyzePuzzle(puzzle);

  // testQuantity: marks the quantity as unknown for a moment and checks if it can be solved
  function testQuantity(owner, quantity, visibility) {
    const key = owner + '.' + quantity;
    if (visibility[quantity] === 'unknown') {
      askable[key] = baseAnalysis.unsolvable.indexOf(key) === -1;
      return;
    }
    const savedState = visibility[quantity];
    visibility[quantity] = 'unknown';
    askable[key] = analyzePuzzle(puzzle).unsolvable.indexOf(key) === -1;
    visibility[quantity] = savedState; // put it back as it was
  }

  for (let index = 0; index < puzzle.vectors.length; index++) {
    const vector = puzzle.vectors[index];
    for (const quantity of QUANTITIES_BY_KIND[vector.kind]) {
      testQuantity(index, quantity, vector.visibility);
    }
  }
  for (const quantity of RESULTANT_QUANTITIES) {
    testQuantity('R', quantity, puzzle.resultant.visibility);
  }
  return askable;
}

// getVariableRowName(owner, quantity): the name at the left of a row, with its unit.
function getVariableRowName(owner, quantity) {
  const symbol = getQuantitySymbol(quantity, owner);
  if (quantity === 'direction') {
    return symbol;
  }
  let unit = QUANTITY_UNITS[quantity];
  if (quantity === 'angle') {
    unit = '°';
  }
  return `${symbol} <small>${unit}</small>`;
}

// getDerivedNote(owner, quantity, vector, puzzle): explains what changes when a value
// that depends on others is edited (for example |V| = v t).
function getDerivedNote(owner, quantity, vector, puzzle) {
  if (owner === 'R') {
    const adjustableName = getVectorName(getAdjustableVectorIndex(puzzle));
    return translate(`al cambiarlo se ajusta ${adjustableName}`, `changing it adjusts ${adjustableName}`);
  }
  if (quantity === 'distance' && vector.kind === 'velocity') {
    let changes = 'v';
    if (vector.stretchChanges === 'time') {
      changes = 't';
    }
    return mathInline('= v t') + translate(` (al cambiarlo se ajusta ${changes})`, ` (changing it adjusts ${changes})`);
  }
  if (quantity === 'distance' && vector.kind === 'acceleration') {
    let changes = 'a';
    if (vector.stretchChanges === 'time') {
      changes = 't';
    }
    return mathInline(`= v₀ t + ${MATH_HALF} a t${mathPower(2)}`) + translate(` (al cambiarlo se ajusta ${changes})`, ` (changing it adjusts ${changes})`);
  }
  if (quantity === 'dx' || quantity === 'dy') {
    return translate('al cambiarlo se ajustan |V| y θ', 'changing it adjusts |V| and θ');
  }
  return '';
}

// buildVariableRow(owner, quantity, idPrefix, askable): the HTML of one row of a card.
//   owner:    vector index or 'R'
//   idPrefix: 'panel' (cards of the panel) or 'card' (floating property card); it keeps
//             the ids of both places different
//   askable:  the result of findAskableQuantities
function buildVariableRow(owner, quantity, idPrefix, askable) {
  const puzzle = editorState.levelDraft.vectorPuzzle;
  const resultant = calculateResultant(puzzle);
  const isResultant = owner === 'R';
  let vector = null;
  let visibility;
  let values;
  if (isResultant) {
    visibility = puzzle.resultant.visibility;
    values = resultant.values;
  } else {
    vector = puzzle.vectors[owner];
    visibility = vector.visibility;
    values = resultant.vectorValues[owner];
  }
  const key = owner + '.' + quantity;
  const state = visibility[quantity];
  // the angle of a straight vector is fixed by its direction (0° or 90°)
  const angleIsFixed = !isResultant && quantity === 'angle' && isStraightDirection(vector.direction);
  const id = `${idPrefix}-${owner}-${quantity}`;
  const label = getQuantityKeyName(key);

  // 1) the value: fixed text, direction list or number box
  let valueHtml;
  if (angleIsFixed) {
    valueHtml = `<span class="variable-fixed">${formatNice(values.angle)}° · ${translate('lo fija la dirección', 'set by the direction')}</span>`;
  } else if (quantity === 'direction') {
    let options = '';
    for (const direction of DIRECTION_ORDER) {
      let selected = '';
      if (direction === values.direction) {
        selected = 'selected';
      }
      options += `<option value="${direction}" ${selected}>${DIRECTION_ARROWS[direction]} ${getDirectionName(direction)}</option>`;
    }
    valueHtml = `<select id="${id}" data-owner="${owner}" data-quantity="direction" aria-label="${label}">${options}</select>`;
  } else {
    valueHtml = `<input type="number" step="any" id="${id}" data-owner="${owner}" data-quantity="${quantity}" value="${roundToTwoDecimals(values[quantity])}" aria-label="${label}">`;
  }

  // 2) the Given / ? / — buttons and the note below
  let buttonsHtml = '';
  let note = '';
  let noteClass = '';
  if (!angleIsFixed) {
    const buttonStates = ['given', 'unknown', 'hidden'];
    buttonsHtml = `<span class="visibility-buttons" role="group" aria-label="${translate('Qué sabe el jugador de', 'What the player knows about')} ${label}">`;
    for (const buttonState of buttonStates) {
      let buttonText = '—';
      if (buttonState === 'given') {
        buttonText = translate('Dato', 'Given');
      }
      if (buttonState === 'unknown') {
        buttonText = '?';
      }
      // the "?" button is off when the value can not be calculated
      let disabledAttribute = '';
      if (buttonState === 'unknown' && !askable[key] && state !== 'unknown') {
        disabledAttribute = `disabled title="${translate('Con los datos actuales no se puede calcular', 'It can’t be worked out from the current data')}"`;
      }
      buttonsHtml += `<button type="button" class="visibility-${buttonState}" data-owner="${owner}" data-quantity="${quantity}" data-state="${buttonState}" aria-pressed="${state === buttonState}" ${disabledAttribute}>${buttonText}</button>`;
    }
    buttonsHtml += '</span>';

    if (state === 'unknown') {
      if (askable[key]) {
        note = translate('✓ incógnita con solución', '✓ solvable unknown');
        noteClass = 'note-good';
      } else {
        note = translate('✗ no se puede calcular con los datos actuales', '✗ can’t be worked out from the current data');
        noteClass = 'note-bad';
      }
    } else if (askable[key]) {
      note = translate('se puede pedir como incógnita', 'can be asked as an unknown');
    } else {
      note = translate('aún no se puede pedir', 'can’t be asked yet');
    }
    const derivedNote = getDerivedNote(owner, quantity, vector, puzzle);
    if (derivedNote) {
      note = derivedNote + ' · ' + note;
    }
  }
  let rowClass = 'variable-row';
  if (!angleIsFixed && state === 'unknown') {
    rowClass += ' variable-row-unknown';
  }
  return `<div class="${rowClass}"><span class="variable-name">${getVariableRowName(owner, quantity)}</span><span class="variable-value">${valueHtml}</span>${buttonsHtml}<span class="variable-note ${noteClass}">${note}</span></div>`;
}

// readOwner(element): reads data-owner of an element: 'R' or a vector index (number).
function readOwner(element) {
  if (element.dataset.owner === 'R') {
    return 'R';
  }
  return Number(element.dataset.owner);
}

// connectVariableRows(container): makes the boxes and buttons of the rows work.
function connectVariableRows(container) {
  // the value boxes and direction lists
  const valueControls = container.querySelectorAll('.variable-value input, .variable-value select');
  for (const control of valueControls) {
    control.addEventListener('change', function () {
      const owner = readOwner(control);
      const quantity = control.dataset.quantity;
      let value;
      if (quantity === 'direction') {
        value = control.value;
      } else {
        value = parseFloat(String(control.value).replace(',', '.'));
        if (!isFinite(value)) {
          refreshPuzzleEditor(); // not a number: write the old value again
          return;
        }
      }
      saveUndoPoint();
      setQuantityValue(owner, quantity, value);
      refreshPuzzleEditor();
    });
  }
  // the Given / ? / — buttons
  const visibilityButtons = container.querySelectorAll('.visibility-buttons button');
  for (const button of visibilityButtons) {
    button.addEventListener('click', function () {
      const owner = readOwner(button);
      const puzzle = editorState.levelDraft.vectorPuzzle;
      let visibility;
      if (owner === 'R') {
        visibility = puzzle.resultant.visibility;
      } else {
        visibility = puzzle.vectors[owner].visibility;
      }
      if (visibility[button.dataset.quantity] === button.dataset.state) {
        return; // already in that state
      }
      saveUndoPoint();
      visibility[button.dataset.quantity] = button.dataset.state;
      refreshPuzzleEditor();
    });
  }
}

// buildVariableCard(owner, puzzle, askable): the HTML of the card of one vector (or of R).
function buildVariableCard(owner, puzzle, askable) {
  const isResultant = owner === 'R';
  const selection = editorState.selection;
  let quantities = RESULTANT_QUANTITIES;
  let vector = null;
  if (!isResultant) {
    vector = puzzle.vectors[owner];
    quantities = QUANTITIES_BY_KIND[vector.kind];
  }
  // is this card the selected thing in the scene?
  let isSelected = false;
  if (selection) {
    if (isResultant && selection.type === 'resultant') {
      isSelected = true;
    }
    if (!isResultant && selection.type === 'vector' && selection.index === owner) {
      isSelected = true;
    }
  }
  let header;
  if (isResultant) {
    header = `R <small>${translate('resultante · de A a B', 'resultant · from A to B')}</small>`;
  } else {
    header = `${getVectorName(owner)} <small>${getVectorKindName(vector.kind).toLowerCase()}</small>`;
    if (getAdjustableVectorIndex(puzzle) === owner) {
      header += ` <span class="badge" title="${translate('Absorbe los cambios cuando editas R', 'Absorbs the changes when you edit R')}">${translate('ajustable', 'adjustable')}</span>`;
    }
  }
  let cardClass = 'variable-card';
  if (isResultant) {
    cardClass += ' variable-card-resultant';
  }
  if (isSelected) {
    cardClass += ' variable-card-selected';
  }
  let rowsHtml = '';
  for (const quantity of quantities) {
    rowsHtml += buildVariableRow(owner, quantity, 'panel', askable);
  }
  return `<div class="${cardClass}"><h5 data-select-owner="${owner}" title="${translate('Seleccionar en la escena', 'Select in the scene')}">${header}</h5>${rowsHtml}</div>`;
}

// buildPuzzleVariableCards(): creates every card of the "Problem variables" panel.
function buildPuzzleVariableCards() {
  const draft = editorState.levelDraft;
  if (!levelHasVectors(draft)) {
    return;
  }
  const puzzle = draft.vectorPuzzle;
  const askable = findAskableQuantities(puzzle);
  let html = '';
  for (let index = 0; index < puzzle.vectors.length; index++) {
    html += buildVariableCard(index, puzzle, askable);
  }
  html += buildVariableCard('R', puzzle, askable);
  const cardsContainer = getElement('puzzleVariableCards');
  cardsContainer.innerHTML = html;
  connectVariableRows(cardsContainer);
  // clicking the title of a card selects that vector in the scene
  const titles = cardsContainer.querySelectorAll('h5[data-select-owner]');
  for (const title of titles) {
    title.addEventListener('click', function () {
      if (title.dataset.selectOwner === 'R') {
        editorState.selection = { type: 'resultant' };
      } else {
        editorState.selection = { type: 'vector', index: Number(title.dataset.selectOwner) };
      }
      renderPropertyCard();
      buildPuzzleVariableCards();
    });
  }
}

/* ----------------------------------------------------------------------
   CHANGING VALUES
   Every change keeps the problem coherent.
   ---------------------------------------------------------------------- */

// setVectorLength(vector, length): changes the length of a vector. For velocity and
// acceleration vectors the length is not stored directly, so the speed, acceleration or
// time is changed instead (stretchChanges says which one).
function setVectorLength(vector, length) {
  length = clampNumber(length, 0.5, 80);
  if (vector.kind === 'distance') {
    vector.distance = roundToTwoDecimals(length);
  } else if (vector.kind === 'velocity') {
    // length = v t
    if (vector.stretchChanges === 'time') {
      vector.time = roundToTwoDecimals(clampNumber(length / vector.speed, 0.1, 60));
    } else {
      vector.speed = roundToTwoDecimals(clampNumber(length / vector.time, 0.1, 50));
    }
  } else if (vector.stretchChanges === 'time') {
    // length = v₀t + ½at²  →  t = (−v₀ + √(v₀² + 2a·length)) / a
    const time = (-vector.initialSpeed + Math.sqrt(vector.initialSpeed * vector.initialSpeed + 2 * vector.acceleration * length)) / vector.acceleration;
    vector.time = roundToTwoDecimals(clampNumber(time, 0.1, 60));
  } else {
    // length = v₀t + ½at²  →  a = 2 (length − v₀t) / t²
    const acceleration = (2 * (length - vector.initialSpeed * vector.time)) / (vector.time * vector.time);
    vector.acceleration = roundToTwoDecimals(clampNumber(acceleration, 0.05, 20));
  }
}

// setVectorComponents(index, dx, dy): changes a vector so its components are dx and dy.
function setVectorComponents(index, dx, dy) {
  const vector = editorState.levelDraft.vectorPuzzle.vectors[index];
  let length = Math.hypot(dx, dy);
  // the minimum length is 0.5 m
  if (length < 0.5) {
    if (length > 1e-9) {
      dx = (dx * 0.5) / length;
      dy = (dy * 0.5) / length;
    } else {
      dx = 0.5;
      dy = 0;
    }
    length = 0.5;
  }
  const wasStraight = isStraightDirection(vector.direction);
  vector.direction = directionFromComponents(dx, dy);
  if (isStraightDirection(vector.direction)) {
    if (vector.direction === 'right' || vector.direction === 'left') {
      vector.angle = 0;
    } else {
      vector.angle = 90;
    }
  } else {
    vector.angle = roundToTwoDecimals((Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI);
  }
  // a vector that stops being straight shows its angle if the direction was given
  if (wasStraight && !isStraightDirection(vector.direction) && vector.visibility.direction === 'given' && vector.visibility.angle === 'hidden') {
    vector.visibility.angle = 'given';
  }
  setVectorLength(vector, length);
}

// setResultantComponents(dx, dy): changes R. Only the adjustable vector changes, so that
// all the vectors together add up to the new R.
function setResultantComponents(dx, dy) {
  const puzzle = editorState.levelDraft.vectorPuzzle;
  const resultant = calculateResultant(puzzle);
  const adjustableIndex = getAdjustableVectorIndex(puzzle);
  // sum of the other vectors
  let othersX = 0;
  let othersY = 0;
  for (let index = 0; index < resultant.vectorValues.length; index++) {
    if (index !== adjustableIndex) {
      othersX += resultant.vectorValues[index].dx;
      othersY += resultant.vectorValues[index].dy;
    }
  }
  setVectorComponents(adjustableIndex, dx - othersX, dy - othersY);
}

// setQuantityValue(owner, quantity, value): changes one value of a vector or of R.
function setQuantityValue(owner, quantity, value) {
  const puzzle = editorState.levelDraft.vectorPuzzle;

  if (owner === 'R') {
    const resultant = calculateResultant(puzzle);
    let dx = resultant.dx;
    let dy = resultant.dy;
    let signX = 1;
    if (dx < -0.05) {
      signX = -1;
    }
    let signY = 1;
    if (dy < -0.05) {
      signY = -1;
    }
    if (quantity === 'distance') {
      // same direction, new length
      if (resultant.magnitude > 1e-6) {
        dx = (dx * value) / resultant.magnitude;
        dy = (dy * value) / resultant.magnitude;
      } else {
        dx = value;
      }
    } else if (quantity === 'angle') {
      const angleInRadians = (clampNumber(value, 0, 90) * Math.PI) / 180;
      dx = signX * resultant.magnitude * Math.cos(angleInRadians);
      dy = signY * resultant.magnitude * Math.sin(angleInRadians);
    } else if (quantity === 'direction') {
      const signs = DIRECTION_SIGNS[value];
      if (signs[0] === 0) {
        dx = 0;
        dy = signs[1] * resultant.magnitude;
      } else if (signs[1] === 0) {
        dx = signs[0] * resultant.magnitude;
        dy = 0;
      } else {
        // a diagonal direction: keep the angle (or use 45° if it was almost straight)
        let angle = resultant.angle;
        if (angle < 1 || angle > 89) {
          angle = 45;
        }
        const angleInRadians = (angle * Math.PI) / 180;
        dx = signs[0] * resultant.magnitude * Math.cos(angleInRadians);
        dy = signs[1] * resultant.magnitude * Math.sin(angleInRadians);
      }
    } else if (quantity === 'dx') {
      dx = value;
    } else if (quantity === 'dy') {
      dy = value;
    }
    setResultantComponents(dx, dy);
    return;
  }

  const vector = puzzle.vectors[owner];
  const currentValues = calculateVectorValues(vector);
  if (quantity === 'distance') {
    setVectorLength(vector, value);
  } else if (quantity === 'speed') {
    vector.speed = roundToTwoDecimals(clampNumber(value, 0.1, 50));
  } else if (quantity === 'time') {
    vector.time = roundToTwoDecimals(clampNumber(value, 0.1, 60));
  } else if (quantity === 'acceleration') {
    vector.acceleration = roundToTwoDecimals(clampNumber(value, 0.05, 20));
  } else if (quantity === 'initialSpeed') {
    vector.initialSpeed = roundToTwoDecimals(clampNumber(value, 0, 30));
  } else if (quantity === 'angle') {
    if (!isStraightDirection(vector.direction)) {
      vector.angle = roundToTwoDecimals(clampNumber(value, 0, 90));
    }
  } else if (quantity === 'direction') {
    const wasStraight = isStraightDirection(vector.direction);
    vector.direction = value;
    if (isStraightDirection(value)) {
      if (value === 'right' || value === 'left') {
        vector.angle = 0;
      } else {
        vector.angle = 90;
      }
    } else if (wasStraight) {
      vector.angle = 30;
      if (vector.visibility.direction === 'given' && vector.visibility.angle === 'hidden') {
        vector.visibility.angle = 'given';
      }
    }
  } else if (quantity === 'dx') {
    setVectorComponents(owner, value, currentValues.dy);
  } else if (quantity === 'dy') {
    setVectorComponents(owner, currentValues.dx, value);
  }
}

/* ----------------------------------------------------------------------
   STATUS LINE AND THE "FIX" BUTTON
   ---------------------------------------------------------------------- */

// updatePuzzleStatus(): the line that says if the puzzle can be solved, and where B is.
function updatePuzzleStatus() {
  const draft = editorState.levelDraft;
  const solvability = checkPuzzleSolvability(draft.vectorPuzzle);
  const geometryProblem = findVectorPuzzleProblem(draft);
  const resultant = solvability.analysis.resultant;
  const statusBox = getElement('puzzleStatus');

  let html;
  if (solvability.solvable) {
    const unknownTexts = [];
    for (const key of solvability.analysis.unknowns) {
      const parts = splitQuantityKey(key);
      const trueValue = getTrueValue(resultant, parts.owner, parts.quantity);
      unknownTexts.push(`<b>${getQuantityKeyName(key)} = ${formatQuantityValue(parts.quantity, trueValue)}</b>`);
    }
    html = translate('✓ Se puede resolver. El jugador debe encontrar: ', '✓ Solvable. The player must find: ') + unknownTexts.join(', ') + '.';
  } else {
    html = solvability.message;
  }
  if (geometryProblem) {
    html += `<br><b>${geometryProblem}</b>`;
  }
  const adjustableName = getVectorName(getAdjustableVectorIndex(draft.vectorPuzzle));
  html += `<br><span class="hint">B = (${formatFixed(resultant.endPoint.x)}, ${formatFixed(resultant.endPoint.y)}) m · ${translate(
    `se ajusta ${adjustableName} cuando editas R`,
    `${adjustableName} adjusts when you edit R`,
  )}</span>`;
  const everythingIsFine = solvability.solvable && !geometryProblem;
  if (!everythingIsFine) {
    html += ` <button class="button button-small button-accent" type="button" id="autoFixButton">${translate('Arreglar', 'Fix')}</button>`;
  }
  statusBox.innerHTML = html;
  if (everythingIsFine) {
    statusBox.className = 'puzzle-status';
  } else {
    statusBox.className = 'puzzle-status puzzle-status-problem';
  }
  const fixButton = getElement('autoFixButton');
  if (fixButton) {
    fixButton.addEventListener('click', function () {
      autoFixPuzzle();
    });
  }
}

// getVisibilityOf(puzzle, owner): the visibility record of a vector or of R.
function getVisibilityOf(puzzle, owner) {
  if (owner === 'R') {
    return puzzle.resultant.visibility;
  }
  return puzzle.vectors[owner].visibility;
}

// showPrimaryDataOfEveryVector(puzzle, onlyHidden): makes the basic data of every vector
// visible. With onlyHidden = true it only changes the values that were hidden.
function showPrimaryDataOfEveryVector(puzzle, onlyHidden) {
  for (const vector of puzzle.vectors) {
    const primary = createPrimaryVisibility(vector);
    for (const quantity in primary) {
      if (primary[quantity] !== 'given') {
        continue;
      }
      if (!onlyHidden || vector.visibility[quantity] === 'hidden') {
        vector.visibility[quantity] = 'given';
      }
    }
  }
}

// markResultantAsUnknown(puzzle): asks for |R|, θ and direction of R.
function markResultantAsUnknown(puzzle) {
  puzzle.resultant.visibility.distance = 'unknown';
  puzzle.resultant.visibility.angle = 'unknown';
  puzzle.resultant.visibility.direction = 'unknown';
}

// autoFixPuzzle(): the "Fix" button. Tries to make the puzzle solvable (by showing more
// data) and to keep point B inside the world (by moving A or widening the world).
function autoFixPuzzle() {
  saveUndoPoint();
  const draft = editorState.levelDraft;
  const puzzle = draft.vectorPuzzle;
  const notes = []; // what was changed, to tell the person

  // 1) there must be something to find
  let solvability = checkPuzzleSolvability(puzzle);
  if (solvability.analysis.unknowns.length === 0) {
    markResultantAsUnknown(puzzle);
    notes.push(translate('marqué |R|, θ y dirección de R como incógnitas', 'marked |R|, θ and direction of R as unknowns'));
    solvability = checkPuzzleSolvability(puzzle);
  }

  // 2) while some unknown can not be solved, show the hidden value that helps the most
  let primaryDataWasShown = false;
  let rounds = 0;
  while (!solvability.solvable && solvability.analysis.unsolvable.length > 0 && rounds < 30) {
    rounds++;
    // candidates: every hidden value
    const candidates = [];
    for (let index = 0; index < puzzle.vectors.length; index++) {
      const vector = puzzle.vectors[index];
      for (const quantity of QUANTITIES_BY_KIND[vector.kind]) {
        const fixedAngle = quantity === 'angle' && isStraightDirection(vector.direction);
        if (vector.visibility[quantity] === 'hidden' && !fixedAngle) {
          candidates.push({ owner: index, quantity: quantity });
        }
      }
    }
    for (const quantity of RESULTANT_QUANTITIES) {
      if (puzzle.resultant.visibility[quantity] === 'hidden') {
        candidates.push({ owner: 'R', quantity: quantity });
      }
    }
    // try each candidate as "given" and keep the one that leaves fewer unsolvable unknowns
    let best = null;
    let bestUnsolvableCount = solvability.analysis.unsolvable.length;
    for (const candidate of candidates) {
      const visibility = getVisibilityOf(puzzle, candidate.owner);
      visibility[candidate.quantity] = 'given';
      const unsolvableCount = analyzePuzzle(puzzle).unsolvable.length;
      visibility[candidate.quantity] = 'hidden';
      if (unsolvableCount < bestUnsolvableCount) {
        bestUnsolvableCount = unsolvableCount;
        best = candidate;
        if (unsolvableCount === 0) {
          break;
        }
      }
    }
    if (best) {
      getVisibilityOf(puzzle, best.owner)[best.quantity] = 'given';
      const name = getQuantityKeyName(best.owner + '.' + best.quantity);
      notes.push(translate(`${name} pasa a ser dato`, `${name} is now given`));
    } else if (!primaryDataWasShown) {
      primaryDataWasShown = true;
      showPrimaryDataOfEveryVector(puzzle, true);
      notes.push(translate('mostré los datos básicos de los vectores', 'showed the vectors’ basic data'));
    } else {
      break;
    }
    solvability = checkPuzzleSolvability(puzzle);
  }
  // 3) still unsolvable: hide the unknowns without solution
  if (!solvability.solvable && solvability.analysis.unsolvable.length > 0) {
    for (const key of solvability.analysis.unsolvable) {
      const parts = splitQuantityKey(key);
      getVisibilityOf(puzzle, parts.owner)[parts.quantity] = 'hidden';
    }
    notes.push(translate('oculté las incógnitas que no tenían solución', 'hid the unknowns that had no solution'));
    if (checkPuzzleSolvability(puzzle).analysis.unknowns.length === 0) {
      markResultantAsUnknown(puzzle);
      showPrimaryDataOfEveryVector(puzzle, false);
    }
  }

  // 4) keep point B inside the world
  const lowestX = LAUNCH_CLEAR_ZONE + 0.6;
  let resultant = calculateResultant(puzzle);
  if (resultant.endPoint.x > draft.worldWidth - 0.6) {
    const needed = resultant.endPoint.x - (draft.worldWidth - 0.6);
    if (puzzle.startX - needed - 0.5 >= lowestX) {
      puzzle.startX = roundToTwoDecimals(puzzle.startX - needed - 0.5);
      notes.push(translate('moví A a la izquierda', 'moved A left'));
    } else {
      draft.worldWidth = roundToTwoDecimals(Math.min(150, Math.ceil(resultant.endPoint.x + 2)));
      notes.push(translate(`amplié el mundo a ${draft.worldWidth} m`, `widened the world to ${draft.worldWidth} m`));
    }
  }
  resultant = calculateResultant(puzzle);
  if (resultant.endPoint.x < lowestX) {
    const needed = lowestX - resultant.endPoint.x;
    if (puzzle.startX + needed + 0.5 <= draft.worldWidth - 0.6) {
      puzzle.startX = roundToTwoDecimals(puzzle.startX + needed + 0.5);
      notes.push(translate('moví A a la derecha', 'moved A right'));
    } else {
      draft.worldWidth = roundToTwoDecimals(Math.min(150, draft.worldWidth + needed + 2));
      puzzle.startX = roundToTwoDecimals(puzzle.startX + needed + 0.5);
      notes.push(translate(`amplié el mundo a ${draft.worldWidth} m`, `widened the world to ${draft.worldWidth} m`));
    }
  }
  resultant = calculateResultant(puzzle);
  if (resultant.endPoint.y < 0) {
    puzzle.startY = roundToTwoDecimals(Math.min(30, puzzle.startY - resultant.endPoint.y + 0.5));
    notes.push(translate('subí A', 'raised A'));
  }
  if (resultant.endPoint.y > 35) {
    puzzle.startY = roundToTwoDecimals(Math.max(0, puzzle.startY - (resultant.endPoint.y - 35) - 0.5));
    notes.push(translate('bajé A', 'lowered A'));
  }
  draft.vectorPuzzle = cleanVectorPuzzle(puzzle, draft.worldWidth);
  refreshEditor();

  const nowCorrect = checkPuzzleSolvability(draft.vectorPuzzle).solvable && !findVectorPuzzleProblem(draft);
  if (notes.length === 0) {
    showEditorMessage(translate('No encontré nada que arreglar automáticamente.', 'I found nothing to fix automatically.'), 'error');
    return;
  }
  let stillWrongText = '';
  if (!nowCorrect) {
    stillWrongText = translate(' Aún queda algo por revisar.', ' Something still needs checking.');
  }
  let kind = 'error';
  if (nowCorrect) {
    kind = 'ok';
  }
  showEditorMessage(
    translate(`Arreglado: ${notes.join(', ')}.${stillWrongText} Puedes deshacerlo.`, `Fixed: ${notes.join(', ')}.${stillWrongText} You can undo it.`),
    kind,
  );
}

/* ----------------------------------------------------------------------
   POINT A, ATTEMPTS, TOLERANCES, AND THE ADVANCED VIEW
   ---------------------------------------------------------------------- */

// VALUE_FIELDS_BY_KIND: the number boxes of each kind of vector in the advanced table.
const VALUE_FIELDS_BY_KIND = {
  distance: [{ quantity: 'distance', label: '|V|', unit: 'm' }],
  velocity: [
    { quantity: 'speed', label: 'v', unit: 'm/s' },
    { quantity: 'time', label: 't', unit: 's' },
  ],
  acceleration: [
    { quantity: 'acceleration', label: 'a', unit: 'm/s²' },
    { quantity: 'time', label: 't', unit: 's' },
    { quantity: 'initialSpeed', label: 'v₀', unit: 'm/s' },
  ],
};

// fillPuzzleFields(): writes point A, attempts, tolerances and the two check boxes.
function fillPuzzleFields() {
  const puzzle = editorState.levelDraft.vectorPuzzle;
  getElement('startPointXInput').value = puzzle.startX;
  getElement('startPointYInput').value = puzzle.startY;
  getElement('answerAttemptsInput').value = puzzle.attempts;
  getElement('valueToleranceInput').value = puzzle.valueTolerancePercent;
  getElement('angleToleranceInput').value = puzzle.angleTolerance;
  getElement('hideScaleCheckbox').checked = puzzle.hideScale;
  getElement('showPathCheckbox').checked = puzzle.showPath;
  getElement('addVectorButton').disabled = puzzle.vectors.length >= 4;
}

// buildAdvancedVectorTable(): the table with one row per vector (kind, values, angle,
// direction and a Remove button).
function buildAdvancedVectorTable() {
  const puzzle = editorState.levelDraft.vectorPuzzle;
  const tableBody = getElement('advancedVectorTableBody');
  tableBody.innerHTML = '';
  for (let index = 0; index < puzzle.vectors.length; index++) {
    const vector = puzzle.vectors[index];
    const name = getVectorName(index);
    const row = document.createElement('tr');

    let valueBoxes = '';
    for (const field of VALUE_FIELDS_BY_KIND[vector.kind]) {
      valueBoxes += `<label class="mini-field">${field.label} <input type="number" id="advanced-${field.quantity}-${index}" step="any" value="${vector[field.quantity]}" aria-label="${name}: ${field.label}"><em>${field.unit}</em></label>`;
    }
    let kindOptions = '';
    for (const kind of VECTOR_KINDS) {
      let selected = '';
      if (kind === vector.kind) {
        selected = 'selected';
      }
      kindOptions += `<option value="${kind}" ${selected}>${getVectorKindName(kind)}</option>`;
    }
    let directionOptions = '';
    for (const direction of DIRECTION_ORDER) {
      let selected = '';
      if (direction === vector.direction) {
        selected = 'selected';
      }
      directionOptions += `<option value="${direction}" ${selected}>${getDirectionName(direction)}</option>`;
    }
    let angleDisabled = '';
    if (isStraightDirection(vector.direction)) {
      angleDisabled = 'disabled';
    }
    let removeButton = '';
    if (puzzle.vectors.length > 1) {
      removeButton = `<button class="button button-danger button-small" type="button" data-remove-vector="${index}">${translate('Quitar', 'Remove')}</button>`;
    }
    row.innerHTML = `<th scope="row">${name}</th>
      <td><select id="advanced-kind-${index}" aria-label="${name}: ${translate('tipo de magnitud', 'quantity type')}">${kindOptions}</select></td>
      <td><div class="mini-fields">${valueBoxes}</div></td>
      <td><input type="number" id="advanced-angle-${index}" step="any" min="0" max="90" value="${vector.angle}" ${angleDisabled} aria-label="${name}: ${translate('ángulo', 'angle')}"></td>
      <td><select id="advanced-direction-${index}" aria-label="${name}: ${translate('dirección', 'direction')}">${directionOptions}</select></td>
      <td>${removeButton}</td>`;
    tableBody.appendChild(row);
  }
  const controls = tableBody.querySelectorAll('input, select');
  for (const control of controls) {
    control.addEventListener('change', function () {
      readAdvancedVectorTable();
    });
  }
  const removeButtons = tableBody.querySelectorAll('[data-remove-vector]');
  for (const button of removeButtons) {
    button.addEventListener('click', function () {
      removeVector(Number(button.dataset.removeVector));
    });
  }
  buildVisibilityMatrix();
}

// readAdvancedVectorTable(): reads the advanced table after a change.
function readAdvancedVectorTable() {
  saveUndoPoint();
  const puzzle = editorState.levelDraft.vectorPuzzle;
  for (let index = 0; index < puzzle.vectors.length; index++) {
    const vector = puzzle.vectors[index];
    const kind = getElement('advanced-kind-' + index).value;
    if (kind !== vector.kind) {
      puzzle.vectors[index] = changeVectorKindKeepingLength(vector, kind);
      continue;
    }
    const newVector = deepCopy(vector);
    newVector.angle = getElement('advanced-angle-' + index).value;
    for (const field of VALUE_FIELDS_BY_KIND[vector.kind]) {
      newVector[field.quantity] = getElement(`advanced-${field.quantity}-${index}`).value;
    }
    puzzle.vectors[index] = cleanVector(newVector);
    const direction = getElement('advanced-direction-' + index).value;
    if (direction !== vector.direction) {
      setQuantityValue(index, 'direction', direction);
    }
  }
  refreshPuzzleEditor();
}

// The fields of point A, attempts, tolerances and the two check boxes
const puzzleFieldIds = [
  'startPointXInput',
  'startPointYInput',
  'answerAttemptsInput',
  'valueToleranceInput',
  'angleToleranceInput',
  'hideScaleCheckbox',
  'showPathCheckbox',
];
for (const fieldId of puzzleFieldIds) {
  getElement(fieldId).addEventListener('change', function () {
    saveUndoPoint();
    const draft = editorState.levelDraft;
    const newPuzzle = deepCopy(draft.vectorPuzzle);
    newPuzzle.startX = getElement('startPointXInput').value;
    newPuzzle.startY = getElement('startPointYInput').value;
    newPuzzle.hideScale = getElement('hideScaleCheckbox').checked;
    newPuzzle.showPath = getElement('showPathCheckbox').checked;
    newPuzzle.valueTolerancePercent = getElement('valueToleranceInput').value;
    newPuzzle.angleTolerance = getElement('angleToleranceInput').value;
    newPuzzle.attempts = getElement('answerAttemptsInput').value;
    draft.vectorPuzzle = cleanVectorPuzzle(newPuzzle, draft.worldWidth);
    refreshPuzzleEditor();
  });
}

// "Add vector" button (at most 4 vectors)
getElement('addVectorButton').addEventListener('click', function () {
  const puzzle = editorState.levelDraft.vectorPuzzle;
  if (puzzle.vectors.length >= 4) {
    return;
  }
  saveUndoPoint();
  puzzle.vectors.push(cleanVector({ distance: 5, angle: 30, direction: 'upRight' }));
  editorState.selection = { type: 'vector', index: puzzle.vectors.length - 1 };
  refreshPuzzleEditor();
  const name = getVectorName(puzzle.vectors.length - 1);
  showEditorMessage(
    translate(`Añadí ${name}. Arrastra su punta en la escena o edítalo en su tarjeta.`, `Added ${name}. Drag its tip in the scene or edit it in its card.`),
  );
});

// removeVector(index): removes a vector (there must always be at least one).
function removeVector(index) {
  const puzzle = editorState.levelDraft.vectorPuzzle;
  if (puzzle.vectors.length <= 1) {
    return;
  }
  saveUndoPoint();
  puzzle.vectors.splice(index, 1); // .splice(index, 1) removes 1 element at that position
  // the adjustable vector index may need to move
  if (puzzle.adjustableVectorIndex === index) {
    puzzle.adjustableVectorIndex = null;
  } else if (puzzle.adjustableVectorIndex !== null && puzzle.adjustableVectorIndex > index) {
    puzzle.adjustableVectorIndex--;
  }
  editorState.selection = null;
  refreshPuzzleEditor();
  showEditorMessage(translate('Quité el vector. Deshacer lo recupera.', 'Vector removed. Undo brings it back.'));
}

// buildVisibilityMatrixRow(owner, kind, visibility, values): one row of the matrix.
function buildVisibilityMatrixRow(owner, kind, visibility, values) {
  let quantities = RESULTANT_QUANTITIES;
  if (owner !== 'R') {
    quantities = QUANTITIES_BY_KIND[kind];
  }
  const angleIsFixed = owner !== 'R' && isStraightDirection(values.direction);
  let cells = '';
  for (const quantity of ALL_QUANTITIES) {
    const notThisKind = quantities.indexOf(quantity) === -1;
    if (notThisKind || (quantity === 'angle' && angleIsFixed)) {
      let title = translate('No aplica a este tipo', 'Doesn’t apply to this type');
      if (quantity === 'angle' && angleIsFixed) {
        title = translate('La dirección ya fija el ángulo (0° o 90°)', 'The direction already sets the angle (0° or 90°)');
      }
      cells += `<td class="not-applicable" title="${title}">·</td>`;
      continue;
    }
    const state = visibility[quantity];
    let selectedGiven = '';
    let selectedUnknown = '';
    let selectedHidden = '';
    if (state === 'given') selectedGiven = 'selected';
    if (state === 'unknown') selectedUnknown = 'selected';
    if (state === 'hidden') selectedHidden = 'selected';
    let shownValue = formatNice(values[quantity]);
    if (quantity === 'direction') {
      shownValue = DIRECTION_ARROWS[values[quantity]];
    }
    cells += `<td><select class="select-${state}" data-owner="${owner}" data-quantity="${quantity}" aria-label="${getQuantityKeyName(owner + '.' + quantity)}">
        <option value="given" ${selectedGiven}>${translate('Dato', 'Given')}</option>
        <option value="unknown" ${selectedUnknown}>?</option>
        <option value="hidden" ${selectedHidden}>—</option></select><small>${shownValue}</small></td>`;
  }
  let subtitle = translate('resultante', 'resultant');
  if (owner !== 'R') {
    subtitle = getVectorKindName(kind).toLowerCase();
  }
  return `<tr><th scope="row">${getVectorName(owner)}<small>${subtitle}</small></th>${cells}</tr>`;
}

// buildVisibilityMatrix(): the full matrix: every quantity of every vector with its state.
function buildVisibilityMatrix() {
  const puzzle = editorState.levelDraft.vectorPuzzle;
  const resultant = calculateResultant(puzzle);
  const tableBody = getElement('visibilityMatrixBody');
  let html = '';
  for (let index = 0; index < puzzle.vectors.length; index++) {
    const vector = puzzle.vectors[index];
    html += buildVisibilityMatrixRow(index, vector.kind, vector.visibility, resultant.vectorValues[index]);
  }
  html += buildVisibilityMatrixRow('R', null, puzzle.resultant.visibility, resultant.values);
  tableBody.innerHTML = html;
  const selects = tableBody.querySelectorAll('select');
  for (const select of selects) {
    select.addEventListener('change', function () {
      saveUndoPoint();
      getVisibilityOf(puzzle, readOwner(select))[select.dataset.quantity] = select.value;
      refreshPuzzleEditor();
    });
  }
}
