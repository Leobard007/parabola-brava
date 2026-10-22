/* ======================================================================
   FILE: js/2-game/vector-puzzle.js

   THE VECTOR PHASE (Displacement and Mixed levels)
   1) The piglet walks from A along the vectors (an animation).
   2) The player reads the known data and writes the unknowns.
   3) "Check" compares the answers with the correct values.
   4) When it is solved (or there are no attempts left) the piglet appears at B
      and the step by step solution is shown.
   ====================================================================== */

// startPathAnimation(): puts the piglet back at A and starts its walk.
function startPathAnimation() {
  const puzzle = gameState.level.vectorPuzzle;
  const piglet = gameState.piglet;
  // remove the pillar under B (it is added again when the piglet arrives)
  const terrainWithoutFinalPillar = [];
  for (const block of gameState.terrain) {
    if (!block.isFinalPillar) {
      terrainWithoutFinalPillar.push(block);
    }
  }
  gameState.terrain = terrainWithoutFinalPillar;
  piglet.x = puzzle.startX - 0.6;
  piglet.y = puzzle.startY;
  piglet.hidden = false;
  piglet.fixedInPlace = true;
  // the animation:
  //   time:             seconds since it started
  //   waitBeforeStart:  seconds of pause before the piglet moves
  //   secondsPerVector: how long each vector takes
  //   progress:         how many vectors are already drawn (1.5 = one and a half)
  gameState.pathAnimation = { time: 0, waitBeforeStart: 0.8, secondsPerVector: 1.1, progress: 0 };
}

// smoothStep(fraction): makes a movement start slowly, go fast and end slowly
// ("ease in-out"). fraction goes from 0 to 1 and the result too.
function smoothStep(fraction) {
  if (fraction < 0.5) {
    return 2 * fraction * fraction;
  }
  return 1 - Math.pow(-2 * fraction + 2, 2) / 2;
}

// updatePathAnimation(secondsPassed): moves the piglet along the vectors. Called on every frame.
function updatePathAnimation(secondsPassed) {
  const animation = gameState.pathAnimation;
  if (!animation) {
    return;
  }
  animation.time += secondsPassed;
  const puzzle = gameState.level.vectorPuzzle;
  const points = gameState.resultant.points;
  const piglet = gameState.piglet;
  const walkingTime = animation.time - animation.waitBeforeStart;
  if (walkingTime < 0) {
    return; // still waiting
  }

  if (puzzle.showPath) {
    const vectorCount = points.length - 1;
    const totalTime = vectorCount * animation.secondsPerVector;
    const clampedTime = Math.min(walkingTime, totalTime);
    // which vector is being walked now, and how much of it (0 to 1)
    const vectorIndex = Math.min(vectorCount - 1, Math.floor(clampedTime / animation.secondsPerVector));
    let fraction = (clampedTime - vectorIndex * animation.secondsPerVector) / animation.secondsPerVector;
    fraction = smoothStep(fraction);
    const startPoint = points[vectorIndex];
    const endPoint = points[vectorIndex + 1];
    const x = startPoint.x + (endPoint.x - startPoint.x) * fraction;
    const y = startPoint.y + (endPoint.y - startPoint.y) * fraction;
    piglet.x = x - 0.6;
    piglet.y = y;
    animation.progress = vectorIndex + fraction;

    if (walkingTime >= totalTime) {
      gameState.pathAnimation = null;
      if (gameState.online && gameState.online.mode === 'hide') {
        // Hide & seek duel: the piglet disappears in a puff when it arrives
        // (it appears again when the coordinates are guessed)
        makePuff(gameState.resultant.endPoint.x, gameState.resultant.endPoint.y + 0.6, COLORS.target);
        piglet.hidden = true;
      } else {
        placePigletAtEnd();
      }
    }
  } else {
    // without the path, the piglet just disappears from A
    makePuff(puzzle.startX, puzzle.startY + 0.6, COLORS.target);
    piglet.hidden = true;
    gameState.pathAnimation = null;
  }
}

// placePigletAtEnd(): puts the piglet at B, with a pillar below it if B is in the air.
function placePigletAtEnd() {
  const endPoint = gameState.resultant.endPoint;
  gameState.piglet.x = endPoint.x - 0.6;
  gameState.piglet.y = endPoint.y;
  addFinalPillar(endPoint);
}

// addFinalPillar(endPoint): adds the pillar under B (only once, and only if B is in the air).
function addFinalPillar(endPoint) {
  if (endPoint.y <= 0.05) {
    return;
  }
  for (const block of gameState.terrain) {
    if (block.isFinalPillar) {
      return; // it is already there
    }
  }
  gameState.terrain.push({ x: endPoint.x - 0.8, width: 1.6, height: endPoint.y, isFinalPillar: true });
}

// makePuff(x, y, color): a small cloud of particles with a sound, at (x, y) in meters.
function makePuff(x, y, color) {
  for (let index = 0; index < 16; index++) {
    const direction = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    gameState.particles.push({
      kind: 'chip',
      x: x,
      y: y,
      speedX: Math.cos(direction) * speed,
      speedY: Math.sin(direction) * speed + 1,
      life: 0.9,
      maxLife: 0.9,
      color: color,
      size: 0.25,
      noGravity: true,
    });
  }
  gameState.particles.push({ kind: 'ring', x: x, y: y, life: 0.5, maxLife: 0.5 });
  playPuffSound();
}

// "Replay the path" button
getElement('replayPathButton').addEventListener('click', function () {
  if (gameState.phase === 'findUnknowns' && gameState.level.vectorPuzzle.showPath) {
    startPathAnimation();
  }
});
// "Check" button
getElement('checkAnswerButton').addEventListener('click', function () {
  checkAnswer();
});

// buildAnswerForm(): creates one answer box for each unknown.
// A direction is chosen from a list; the other values are typed as numbers.
function buildAnswerForm() {
  const answerFields = getElement('answerFields');
  // keep what the player had already written (the form is rebuilt when the language changes)
  const previousValues = [];
  for (let index = 0; index < gameState.unknownItems.length; index++) {
    const oldBox = getElement('answerInput' + index);
    if (oldBox) {
      previousValues.push(oldBox.value);
    } else {
      previousValues.push('');
    }
  }
  answerFields.innerHTML = '';

  for (let index = 0; index < gameState.unknownItems.length; index++) {
    const item = gameState.unknownItems[index];
    const label = document.createElement('label');
    if (item.quantity === 'direction') {
      label.className = 'form-field form-field-full';
      let options = `<option value="">${translate('Elige una dirección…', 'Choose a direction…')}</option>`;
      for (const direction of DIRECTION_ORDER) {
        options += `<option value="${direction}">${getDirectionName(direction)}</option>`;
      }
      label.innerHTML = `<span></span><select id="answerInput${index}">${options}</select>`;
    } else {
      label.className = 'form-field';
      label.innerHTML = `<span></span><input type="number" id="answerInput${index}" step="any" inputmode="decimal">`;
    }
    // the text above the box, for example "|R| (m)" or "Rₓ (m) signed"
    const unit = QUANTITY_UNITS[item.quantity];
    let labelText = getQuantityKeyName(item.key);
    if (unit) {
      labelText += ` (${unit})`;
    }
    if (item.quantity === 'dx' || item.quantity === 'dy') {
      labelText += translate(' con signo', ', signed');
    }
    label.querySelector('span').textContent = labelText;
    answerFields.appendChild(label);
    if (previousValues[index]) {
      getElement('answerInput' + index).value = previousValues[index];
    }
  }
}

// buildKnownDataRow(owner, kind, visibility, values): one row of the "Known data" panel,
// for example "V₁   |V₁| = 12 m   θ = 30°   direction: up and to the right".
//   owner: vector index or 'R'
function buildKnownDataRow(owner, kind, visibility, values) {
  let quantities = RESULTANT_QUANTITIES;
  if (owner !== 'R') {
    quantities = QUANTITIES_BY_KIND[kind];
  }
  const items = [];
  for (const quantity of quantities) {
    const state = visibility[quantity];
    if (state === 'hidden') {
      continue;
    }
    const symbol = getQuantitySymbol(quantity, owner);
    if (state === 'unknown') {
      items.push(`<span class="unknown-value">${symbol} = ?</span>`);
    } else if (quantity === 'direction') {
      items.push(`<span>${translate('dirección', 'direction')}: ${formatQuantityValue(quantity, values[quantity])}</span>`);
    } else {
      items.push(`<span>${symbol} = ${formatQuantityValue(quantity, values[quantity])}</span>`);
    }
  }
  // the small explanation at the end of the row
  let note;
  if (owner === 'R') {
    note = translate('desplazamiento total de A a B (vector resultante)', 'total displacement from A to B (resultant vector)');
  } else {
    note = getVectorKindNote(kind);
    if (kind === 'acceleration' && visibility.initialSpeed === 'given' && values.initialSpeed === 0) {
      note += translate(' · parte del reposo', ' · starts from rest');
    }
  }
  let rowClass = 'vector-row';
  if (owner === 'R') {
    rowClass = 'vector-row vector-row-resultant';
  }
  let itemsHtml = items.join('');
  if (items.length === 0) {
    itemsHtml = `<span style="color:var(--color-ink-soft)">${translate('sin datos', 'no data')}</span>`;
  }
  return `<div class="${rowClass}"><b>${getVectorName(owner)}</b>${itemsHtml}<em>${note}</em></div>`;
}

// renderVectorPuzzlePanels(): shows or hides the panels of the vector phase and fills them.
function renderVectorPuzzlePanels() {
  const level = gameState.level;
  const hasVectors = levelHasVectors(level);
  getElement('vectorPuzzlePanels').hidden = !hasVectors;
  // the launch controls are hidden in displacement levels and during the vector phase
  getElement('launchControls').hidden = hasVectors && (level.type === 'displacement' || gameState.phase === 'findUnknowns');
  if (!hasVectors) {
    return;
  }
  if (gameState.online && gameState.online.mode === 'hide') {
    hideAndSeekRenderPanels(); // the Hide & seek duel has its own panel (js/5-online/duel.js)
    return;
  }
  const puzzle = level.vectorPuzzle;
  const resultant = gameState.resultant;
  const vectorCount = puzzle.vectors.length;

  let html;
  if (vectorCount === 1) {
    html = translate(
      'El cochinito parte del punto <b>A</b> y se mueve con un vector. Llega al punto <b>B</b>.',
      'The piglet starts at point <b>A</b> and moves along one vector. It ends at point <b>B</b>.',
    );
  } else {
    html = translate(
      `El cochinito parte del punto <b>A</b> y se mueve con ${vectorCount} vectores seguidos. Llega al punto <b>B</b>.`,
      `The piglet starts at point <b>A</b> and moves along ${vectorCount} vectors in a row. It ends at point <b>B</b>.`,
    );
  }
  html = `<p>${html}</p><div class="vector-list">`;
  for (let index = 0; index < vectorCount; index++) {
    const vector = puzzle.vectors[index];
    html += buildKnownDataRow(index, vector.kind, vector.visibility, resultant.vectorValues[index]);
  }
  html += buildKnownDataRow('R', null, puzzle.resultant.visibility, resultant.values) + '</div>';
  html += `<p class="hint">${translate(
    'Ángulos medidos desde la horizontal (0° a 90°). Componentes con signo: + hacia la derecha o arriba, − hacia la izquierda o abajo.',
    'Angles are measured from the horizontal (0° to 90°). Signed components: + to the right or up, − to the left or down.',
  )}</p>`;
  getElement('knownDataList').innerHTML = html;

  getElement('replayPathButton').hidden = !puzzle.showPath || gameState.phase !== 'findUnknowns';
  if (gameState.unknownItems.length === 1) {
    getElement('answerTitle').textContent = translate('Encuentra la incógnita', 'Find the unknown');
  } else {
    getElement('answerTitle').textContent = translate('Encuentra las incógnitas', 'Find the unknowns');
  }

  if (gameState.phase === 'findUnknowns') {
    getElement('answerForm').hidden = false;
    getElement('solutionPanel').hidden = true;
    const answer = gameState.answer;
    const attemptsLeft = answer.attemptsAllowed - answer.attemptsUsed;
    const toleranceText = translate(
      `se acepta ±${puzzle.valueTolerancePercent}% en valores y ±${puzzle.angleTolerance}° en ángulos`,
      `±${puzzle.valueTolerancePercent}% on values and ±${puzzle.angleTolerance}° on angles accepted`,
    );
    let attemptsText;
    if (answer.attemptsAllowed >= 900) {
      attemptsText = translate('Intentos ilimitados · ', 'Unlimited attempts · ') + toleranceText;
    } else if (attemptsLeft !== 1) {
      attemptsText = translate(`${attemptsLeft} intentos · `, `${attemptsLeft} attempts left · `) + toleranceText;
    } else {
      attemptsText = translate(`${attemptsLeft} intento · `, `${attemptsLeft} attempt left · `) + toleranceText;
    }
    getElement('attemptsInfo').textContent = attemptsText;
  } else {
    getElement('answerForm').hidden = true;
    // in online games the step by step solution is not shown
    if (gameState.online) {
      getElement('solutionPanel').hidden = true;
    } else {
      getElement('solutionPanel').hidden = false;
      getElement('solutionPanel').innerHTML = buildSolutionHtml();
    }
  }
}
// buildSolutionHtml(): the step by step solution shown after the vector phase.
// Each calculation is written like in a notebook: formula, substitution and result
// (see js/1-core/equations.js).
function buildSolutionHtml() {
  const puzzle = gameState.level.vectorPuzzle;
  const resultant = gameState.resultant;
  const answer = gameState.answer;
  let html = '';

  // 1) the header: solved or out of attempts
  if (answer.solved) {
    let text;
    if (answer.attemptsUsed > 1) {
      text = translate(`¡Correcto en el intento ${answer.attemptsUsed}!`, `Correct on attempt ${answer.attemptsUsed}!`);
    } else {
      text = translate('¡Correcto al primer intento!', 'Correct on the first try!');
    }
    html += `<div class="solution-result" style="color:var(--color-target-dark)">${text} +${answer.bonusPoints} ${translate('puntos', 'points')}</div>`;
  } else {
    html += `<div class="solution-result" style="color:var(--color-accent-dark)">${translate(
      'Se acabaron los intentos. Esta es la solución:',
      'Out of attempts. Here is the solution:',
    )}</div>`;
    if (answer.lastFeedback) {
      html += `<div class="answer-feedback" style="font-family:var(--font-body);white-space:normal">${answer.lastFeedback}</div>`;
    }
  }

  // 2) the correct answers
  html += `<div class="solution-subtitle">${translate('Respuesta', 'Answer')}</div>`;
  for (const item of gameState.unknownItems) {
    html += `<div class="solution-answer">${equationLabel(getQuantityKeyName(item.key))} = <b>${formatQuantityValue(item.quantity, item.trueValue)}</b></div>`;
  }

  // 3) every vector: its length (if it has speed or acceleration) and its components
  html += `<div class="solution-subtitle">${translate('Todos los valores del problema', 'Every value in the problem')}</div>`;
  for (let index = 0; index < puzzle.vectors.length; index++) {
    const vector = puzzle.vectors[index];
    const values = resultant.vectorValues[index];
    const name = getVectorName(index);
    const subscript = name.slice(1);
    html += `<div class="solution-heading">${name} · ${getVectorKindName(vector.kind).toLowerCase()}</div>`;
    if (vector.kind === 'velocity') {
      html += mathEquation(equationLabel(`|${name}|`), [
        'v t',
        `${formatNice(values.speed)} ${MATH_DOT} ${formatNice(values.time)}`,
        mathResult(formatFixed(values.distance), 'm'),
      ]);
    }
    if (vector.kind === 'acceleration') {
      html += mathEquation(equationLabel(`|${name}|`), [
        `v₀ t + ${MATH_HALF} a t${mathPower(2)}`,
        `${formatNice(values.initialSpeed)} ${MATH_DOT} ${formatNice(values.time)} + ${MATH_HALF} ${MATH_DOT} ${formatNice(values.acceleration)} ${MATH_DOT} ${formatNice(values.time)}${mathPower(2)}`,
        mathResult(formatFixed(values.distance), 'm'),
      ]);
    }
    html += `<div class="equation-note">|${name}| = ${formatFixed(values.distance)} m · θ${subscript} = ${formatNice(values.angle)}° · ${getDirectionNameLowercase(values.direction)}</div>`;
    html += componentEquations(index, values);
  }

  // 4) the resultant R: sum of components, length (Pythagoras), angle (tan⁻¹) and direction
  const allValues = resultant.vectorValues;
  html += `<div class="solution-heading">${translate('Resultante R', 'Resultant R')}</div>`;
  html += sumEquation(equationLabel('Rₓ'), 'dx', allValues, resultant.dx);
  html += sumEquation(equationLabel('Rᵧ'), 'dy', allValues, resultant.dy);
  html += mathEquation(equationLabel('|R|'), [
    mathSquareRoot(`Rₓ${mathPower(2)} + Rᵧ${mathPower(2)}`),
    mathSquareRoot(`${mathSquared(resultant.dx)} + ${mathSquared(resultant.dy)}`),
    mathSquareRoot(`${formatFixed(resultant.dx * resultant.dx)} + ${formatFixed(resultant.dy * resultant.dy)}`),
    mathResult(formatFixed(resultant.magnitude), 'm'),
  ]);
  const angleLabel = equationLabel(translate('θ de R', 'θ of R'));
  if (Math.abs(resultant.dx) < 1e-6) {
    html += mathEquation(angleLabel, [mathResult('90°') + ' <span class="equation-note">(Rₓ = 0)</span>']);
  } else {
    html += mathEquation(angleLabel, [
      `tan${mathPower('−1')} ${mathTallParentheses(mathFraction('|Rᵧ|', '|Rₓ|'))}`,
      `tan${mathPower('−1')} ${mathTallParentheses(mathFraction(formatFixed(Math.abs(resultant.dy)), formatFixed(Math.abs(resultant.dx))))}`,
      mathResult(formatFixed(resultant.angle, 1) + '°'),
    ]);
  }
  html += `<div>${equationLabel(translate('Dirección de R', 'Direction of R'))}: <b>${getDirectionNameLowercase(resultant.direction)}</b></div>`;

  // 5) in mixed levels: the position of B, and the next step
  if (gameState.level.type === 'mixed') {
    html += mathEquation(equationLabel('B'), [
      'A + R',
      '(x<sub>A</sub> + Rₓ, y<sub>A</sub> + Rᵧ)',
      `(${mathSum([puzzle.startX, resultant.dx])}, ${mathSum([puzzle.startY, resultant.dy])})`,
      mathResult(`(${formatFixed(resultant.endPoint.x)}, ${formatFixed(resultant.endPoint.y)})`, 'm'),
    ]);
    html += `<div class="solution-next">${translate(
      'Ahora la escala está visible. Lanza para alcanzar al cochinito en B.',
      'The scale is visible now. Launch to hit the piglet at B.',
    )}</div>`;
  }
  return html;
}

// isAnswerCorrect(item, value): compares one answer with the correct value, using the
// tolerances of the level.
function isAnswerCorrect(item, value) {
  const puzzle = gameState.level.vectorPuzzle;
  const resultant = gameState.resultant;
  if (item.quantity === 'direction') {
    // a direction close to horizontal or vertical also accepts its neighbor directions
    let dx;
    let dy;
    let angle;
    if (item.owner === 'R') {
      dx = resultant.dx;
      dy = resultant.dy;
      angle = resultant.angle;
    } else {
      const values = resultant.vectorValues[item.owner];
      dx = values.dx;
      dy = values.dy;
      angle = values.angle;
    }
    const accepted = getAcceptedDirections(dx, dy, angle, item.trueValue, puzzle.angleTolerance);
    return accepted.indexOf(value) !== -1;
  }
  if (item.quantity === 'angle') {
    return Math.abs(value - item.trueValue) <= puzzle.angleTolerance;
  }
  // other values: the error must be smaller than the % tolerance (or the minimum absolute tolerance)
  const minimumTolerance = ABSOLUTE_TOLERANCES[item.quantity] || 0.1;
  const percentTolerance = (Math.abs(item.trueValue) * puzzle.valueTolerancePercent) / 100;
  return Math.abs(value - item.trueValue) <= Math.max(minimumTolerance, percentTolerance);
}

// readNumberFromBox(box): reads a number typed in a box (accepts "3,5" or "3.5").
function readNumberFromBox(box) {
  return parseFloat(String(box.value).replace(',', '.'));
}

// BONUS_POINTS_BY_ATTEMPT: points for solving the vectors on the 1st, 2nd, 3rd... attempt.
const BONUS_POINTS_BY_ATTEMPT = [1500, 1000, 600, 400, 300, 200];

// checkAnswer(): the "Check" button: reads the answers and compares them.
function checkAnswer() {
  if (gameState.online && gameState.online.mode === 'hide') {
    hideAndSeekCheckAnswer(); // Hide & seek duel (js/5-online/duel.js)
    return;
  }
  if (gameState.phase !== 'findUnknowns') {
    return;
  }
  const answer = gameState.answer;

  // 1) read every box
  const typedValues = [];
  let somethingIsEmpty = false;
  for (let index = 0; index < gameState.unknownItems.length; index++) {
    const item = gameState.unknownItems[index];
    const box = getElement('answerInput' + index);
    if (item.quantity === 'direction') {
      typedValues.push(box.value);
      if (!box.value) {
        somethingIsEmpty = true;
      }
    } else {
      const number = readNumberFromBox(box);
      typedValues.push(number);
      if (!isFinite(number)) {
        somethingIsEmpty = true;
      }
    }
  }
  if (somethingIsEmpty) {
    getElement('answerFeedback').innerHTML = `<span class="feedback-wrong">${translate(
      'Completa todas las casillas antes de comprobar.',
      'Fill in every box before checking.',
    )}</span>`;
    return;
  }
  answer.attemptsUsed++;

  // 2) compare each answer and write a ✓ or ✗ line for it
  let allCorrect = true;
  let feedbackHtml = '';
  for (let index = 0; index < gameState.unknownItems.length; index++) {
    const item = gameState.unknownItems[index];
    const value = typedValues[index];
    const correct = isAnswerCorrect(item, value);
    const name = getQuantityKeyName(item.key);
    if (correct) {
      feedbackHtml += `<span class="feedback-correct">✓ ${name}: ${translate('correcto', 'correct')}</span>`;
      continue;
    }
    allCorrect = false;
    if (item.quantity === 'direction') {
      feedbackHtml += `<span class="feedback-wrong">✗ ${name}: ${translate('incorrecta', 'wrong')}</span>`;
      continue;
    }
    // a hint: wrong sign, too big or too small
    const isComponent = item.quantity === 'dx' || item.quantity === 'dy';
    const wrongSign = isComponent && Math.abs(item.trueValue) > 0.3 && Math.sign(value) !== Math.sign(item.trueValue);
    let hint;
    if (wrongSign) {
      hint = translate('revisa el signo', 'check the sign');
    } else if (value > item.trueValue) {
      hint = translate('tu valor es demasiado grande', 'your value is too big');
    } else {
      hint = translate('tu valor es demasiado pequeño', 'your value is too small');
    }
    feedbackHtml += `<span class="feedback-wrong">✗ ${name}: ${hint}</span>`;
  }
  answer.lastFeedback = feedbackHtml;
  if (gameState.online) {
    onlineReportAnswer(typedValues); // tell the online game (js/5-online/host-and-player.js)
  }

  // 3) all correct: stars and bonus points depend on the attempt
  if (allCorrect) {
    answer.solved = true;
    if (answer.attemptsUsed === 1) {
      answer.stars = 3;
    } else if (answer.attemptsUsed === 2) {
      answer.stars = 2;
    } else {
      answer.stars = 1;
    }
    answer.bonusPoints = BONUS_POINTS_BY_ATTEMPT[answer.attemptsUsed - 1] || 200;
    gameState.score += answer.bonusPoints;
    playCorrectSound();
    revealAnswer();
    return;
  }
  playWrongSound();
  if (answer.attemptsUsed >= answer.attemptsAllowed) {
    answer.failed = true;
    revealAnswer();
    return;
  }
  getElement('answerFeedback').innerHTML = feedbackHtml;
  renderVectorPuzzlePanels();
}

// revealAnswer(): the vector phase ends (solved or out of attempts): the piglet
// appears at B, the grid and scale become visible and the solution is shown.
function revealAnswer() {
  const endPoint = gameState.resultant.endPoint;
  const piglet = gameState.piglet;
  gameState.pathAnimation = null;
  gameState.answerRevealed = true;
  if (piglet.hidden) {
    makePuff(endPoint.x, endPoint.y + 0.6, COLORS.target);
  }
  piglet.hidden = false;
  piglet.x = endPoint.x - 0.6;
  piglet.y = endPoint.y;
  addFinalPillar(endPoint);
  if (gameState.answer.solved) {
    addFloatingText(endPoint.x, endPoint.y + 2.2, translate('¡Resuelto!', 'Solved!'), COLORS.vector);
  } else {
    addFloatingText(endPoint.x, endPoint.y + 2.2, translate('Aquí estaba', 'It was here'), COLORS.accentDark);
  }
  gameState.viewTop = Math.max(gameState.viewTop, endPoint.y + 3);
  if (gameState.level.type === 'mixed') {
    // mixed level: now the player must launch at the piglet (which can now fall)
    gameState.phase = 'launch';
    piglet.fixedInPlace = false;
  } else {
    // displacement level: the end card appears after 2.2 seconds
    gameState.phase = 'done';
    gameState.endTimer = 2.2;
  }
  renderVectorPuzzlePanels();
  updateHud();
  updateLaunchPanel();
}
