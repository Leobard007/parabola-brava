/* ======================================================================
   FILE: js/2-game/controls.js

   THE PLAYER'S CONTROLS
   - The sliders and number boxes of v₀, θ and h₀, and the gravity list.
   - The keyboard (Enter or space launches).
   - The "Launch equations" panel, which is rewritten every time a value changes.
   ====================================================================== */

// connectSliderAndBox(key): links the slider and the number box of one launch variable,
// so moving one changes the other.
//   key: 'launchSpeed', 'launchAngle' or 'launchHeight'
function connectSliderAndBox(key) {
  const slider = getElement(key + 'Slider');
  const numberBox = getElement(key + 'Input');
  // "input" happens continuously while the slider is being moved
  slider.addEventListener('input', function () {
    launcher[key] = Number(slider.value);
    numberBox.value = slider.value;
    updateLaunchPanel();
  });
  // "change" happens when the person finishes typing in the box
  numberBox.addEventListener('change', function () {
    let value = parseFloat(String(numberBox.value).replace(',', '.'));
    if (isNaN(value)) {
      value = launcher[key]; // not a number: keep the previous value
    }
    value = clampNumber(value, Number(numberBox.min), Number(numberBox.max));
    launcher[key] = value;
    numberBox.value = value;
    slider.value = value;
    updateLaunchPanel();
  });
}
connectSliderAndBox('launchSpeed');
connectSliderAndBox('launchAngle');
connectSliderAndBox('launchHeight');

// the gravity list
getElement('gravitySelect').addEventListener('change', function (event) {
  currentGravity = Number(event.target.value);
  getElement('gravityLabel').textContent = currentGravity.toFixed(2);
  updateLaunchPanel();
});
// the practice mode box
getElement('practiceModeCheckbox').addEventListener('change', function () {
  updateLaunchPanel();
});
// the "Launch!" button. launchProjectile is in physics.js, which is loaded AFTER this
// file, so we call it from inside a small function (it will exist when it is clicked).
getElement('launchButton').addEventListener('click', function () {
  launchProjectile();
});

// The keyboard. "keydown" happens every time a key is pressed anywhere on the page.
document.addEventListener('keydown', function (event) {
  const tagName = event.target.tagName; // which kind of element has the focus (INPUT, BUTTON...)
  const isFormField = tagName === 'INPUT' || tagName === 'SELECT';

  // the "How to play" window is open: Escape closes it
  if (!getElement('howToPlayWindow').hidden) {
    if (event.key === 'Escape') {
      closeHowToPlay();
    }
    return;
  }
  // in the menus: Escape closes the settings menu
  if (currentView !== 'game') {
    if (event.key === 'Escape') {
      getElement('settingsMenu').hidden = true;
      getElement('settingsButton').setAttribute('aria-expanded', 'false');
    }
    return;
  }
  // in the editor the keys do other things (js/3-editor/editor-scene-and-saving.js)
  if (gameState.screen === 'edit') {
    handleEditorKey(event);
    return;
  }
  // vector phase: Enter inside an answer box checks the answer
  if (gameState.phase !== 'launch') {
    if (gameState.phase === 'findUnknowns' && event.key === 'Enter' && isFormField && getElement('vectorPuzzlePanels').contains(event.target)) {
      event.preventDefault();
      checkAnswer();
    }
    return;
  }
  // launch phase: Enter, or space when the focus is not on a field or button, launches
  const isTypingElement = isFormField || tagName === 'BUTTON' || tagName === 'TEXTAREA';
  if (event.key === 'Enter' || (event.key === ' ' && !isTypingElement)) {
    // if a number was being typed, apply it first
    if (tagName === 'INPUT' && event.target.type === 'number') {
      event.target.dispatchEvent(new Event('change'));
    }
    if (tagName === 'BUTTON' || tagName === 'TEXTAREA') {
      return; // Enter on a button presses that button, not "Launch"
    }
    event.preventDefault(); // stops the page from scrolling with the space bar
    launchProjectile();
  }
});

// the buttons of the end card
getElement('levelEndRetryButton').addEventListener('click', function () {
  gameState.score = gameState.scoreAtLevelStart;
  loadLevel(gameState.level, { testing: gameState.testingFromEditor });
});
getElement('levelEndNextButton').addEventListener('click', function () {
  if (gameState.nextButtonAction) {
    gameState.nextButtonAction();
  }
});

// calculateLaunchPrediction(launchSpeed, launchAngle, launchHeight, gravity): the exact
// values of a launch, using the projectile motion formulas:
//   speedX       = v₀ cos θ             (horizontal speed, it never changes)
//   speedY       = v₀ sin θ             (initial vertical speed)
//   flightTime   = (vᵧ₀ + √(vᵧ₀² + 2gh₀)) / g     (time until y = 0)
//   range        = vₓ · flightTime      (distance where it lands)
//   maxHeight    = h₀ + vᵧ₀² / 2g       (only if it goes up)
//   timeToApex   = vᵧ₀ / g              (time to reach the highest point)
function calculateLaunchPrediction(launchSpeed, launchAngle, launchHeight, gravity) {
  const angleInRadians = (launchAngle * Math.PI) / 180;
  const speedX = launchSpeed * Math.cos(angleInRadians);
  const speedY = launchSpeed * Math.sin(angleInRadians);
  const flightTime = (speedY + Math.sqrt(speedY * speedY + 2 * gravity * launchHeight)) / gravity;
  let maxHeight = launchHeight;
  let timeToApex = 0;
  if (speedY > 0) {
    maxHeight = launchHeight + (speedY * speedY) / (2 * gravity);
    timeToApex = speedY / gravity;
  }
  return {
    speedX: speedX,
    speedY: speedY,
    flightTime: flightTime,
    range: speedX * flightTime,
    maxHeight: maxHeight,
    timeToApex: timeToApex,
  };
}

// updateLaunchPanel(): rewrites the "Launch equations" panel with the current values,
// and enables or disables the Launch button and the gravity list.
// The equations are written like in a notebook (see js/1-core/equations.js).
function updateLaunchPanel() {
  if (!gameState.level) {
    return;
  }
  const prediction = calculateLaunchPrediction(launcher.launchSpeed, launcher.launchAngle, launcher.launchHeight, currentGravity);
  const practiceMode = getElement('practiceModeCheckbox').checked;
  const timeSquared = `t${mathPower(2)}`;
  const initialSpeedYText = mathSum([prediction.speedY]); // "8.66" or "−8.66"
  let speedYSign = '+';
  if (prediction.speedY < 0) {
    speedYSign = '−';
  }
  const speedText = formatFixed(launcher.launchSpeed, 1);
  const heightText = formatFixed(launcher.launchHeight, 1);
  const absoluteSpeedYText = formatFixed(Math.abs(prediction.speedY));

  let html = '';
  html += mathEquation(equationLabel('vₓ'), [
    'v₀ cos θ',
    `${speedText} ${MATH_DOT} cos ${launcher.launchAngle}°`,
    mathResult(formatFixed(prediction.speedX), 'm/s'),
  ]);
  html += mathEquation(equationLabel('vᵧ₀'), ['v₀ sin θ', `${speedText} ${MATH_DOT} sin ${launcher.launchAngle}°`, mathResult(initialSpeedYText, 'm/s')]);
  html += mathEquation(equationLabel('x(t)'), ['vₓ t', `${formatFixed(prediction.speedX)} t`]);
  html += mathEquation(equationLabel('y(t)'), [
    `h₀ + vᵧ₀ t − ${MATH_HALF} g ${timeSquared}`,
    `${heightText} ${speedYSign} ${absoluteSpeedYText} t − ${MATH_HALF} ${MATH_DOT} ${formatFixed(currentGravity)} ${timeSquared}`,
    `${heightText} ${speedYSign} ${absoluteSpeedYText} t − ${formatFixed(currentGravity / 2, 3)} ${timeSquared}`,
  ]);
  html += mathEquation(equationLabel('vᵧ(t)'), ['vᵧ₀ − g t', `${initialSpeedYText} − ${formatFixed(currentGravity)} t`]);

  if (practiceMode) {
    // practice mode: also the maximum height, flight time and range
    html += '<div class="practice-predictions">';
    if (prediction.speedY > 0) {
      html += mathEquation(equationLabel(translate('h máx', 'max h')), [
        `h₀ + ${mathFraction(`vᵧ₀${mathPower(2)}`, '2g')}`,
        `${heightText} + ${mathFraction(mathSquared(prediction.speedY), `2 ${MATH_DOT} ${formatFixed(currentGravity)}`)}`,
        mathResult(formatFixed(prediction.maxHeight), 'm'),
      ]);
      html += mathEquation(equationLabel(translate('t subida', 'rise t')), [
        mathFraction('vᵧ₀', 'g'),
        mathFraction(formatFixed(prediction.speedY), formatFixed(currentGravity)),
        mathResult(formatFixed(prediction.timeToApex), 's'),
      ]);
    } else {
      html += mathEquation(equationLabel(translate('h máx', 'max h')), ['h₀', mathResult(formatFixed(prediction.maxHeight), 'm')]);
      html += `<div class="equation-note">${translate('(no sube porque vᵧ₀ ≤ 0)', '(it doesn’t rise because vᵧ₀ ≤ 0)')}</div>`;
    }
    html += `<div class="equation-note">${translate('Cuando vuelve al suelo (y = 0):', 'When it returns to the ground (y = 0):')}</div>`;
    html += mathEquation(equationLabel(translate('t vuelo', 'flight t')), [
      mathFraction(`vᵧ₀ + ${mathSquareRoot(`vᵧ₀${mathPower(2)} + 2 g h₀`)}`, 'g'),
      mathFraction(
        `${mathNumber(prediction.speedY)} + ${mathSquareRoot(`${mathSquared(prediction.speedY)} + 2 ${MATH_DOT} ${formatFixed(currentGravity)} ${MATH_DOT} ${heightText}`)}`,
        formatFixed(currentGravity),
      ),
      mathResult(formatFixed(prediction.flightTime), 's'),
    ]);
    html += mathEquation(equationLabel(translate('Alcance', 'Range')), [
      'vₓ t',
      `${formatFixed(prediction.speedX)} ${MATH_DOT} ${formatFixed(prediction.flightTime)}`,
      mathResult(formatFixed(prediction.range), 'm'),
    ]);
    html += '</div>';
  } else {
    html += `<div class="launch-note">${translate(
      'Calcula tú el alcance y la altura máxima, o activa el modo práctica para verlos (ese nivel no dará estrellas).',
      'Work out the range and maximum height yourself, or turn on practice mode to see them (that level won’t award stars).',
    )}</div>`;
  }
  getElement('launchEquations').innerHTML = html;
  getElement('launchButton').disabled = gameState.mode !== 'aiming' || gameState.phase !== 'launch';
  getElement('gravitySelect').disabled = gameState.level.launchVariables.gravity.locked || gameState.mode === 'flying';
}
