/* ======================================================================
   FILE: js/2-game/level-end.js

   END OF A SHOT AND END OF A LEVEL
   - finishShot: after each shot, decides if the level is won, lost or continues.
   - winLevel / loseLevel / endDisplacementLevel: show the end card with stars.
   - updateTelemetry: the "Telemetry" panel (time, position and speed).

   SCORING
     piglet knocked down: +500     wood block: +50     stone block: +100
     each unused shot at the end: +1000 (not when shots are unlimited)
     vectors solved: +1500 on the 1st attempt, +1000 on the 2nd, +600, +400, +300, +200
   STARS (launch levels): 1 shot used = 3 stars, 2 shots = 2 stars, more = 1 star.
   ====================================================================== */

// finishShot(): called when the projectile stopped and nothing is falling anymore.
function finishShot() {
  const projectile = gameState.projectile;
  // keep the last 4 shots to draw their paths
  gameState.oldShots.push(projectile);
  if (gameState.oldShots.length > 4) {
    gameState.oldShots.shift(); // .shift() removes the first (oldest) element
  }
  gameState.lastShot = projectile;
  gameState.projectile = null;
  if (gameState.online) {
    const targetsKnockedDown = Math.max(0, (projectile.targetsBeforeShot || 0) - countTargetsLeft());
    onlineReportShot(projectile, targetsKnockedDown); // js/5-online/host-and-player.js
  }
  if (countTargetsLeft() === 0) {
    winLevel();
  } else if (gameState.shotsLeft <= 0) {
    loseLevel();
  } else {
    gameState.mode = 'aiming';
  }
  updateHud();
  updateTelemetry();
  updateLaunchPanel();
}

// setNextButton(text, action): shows the "Next" button of the end card with a text and
// what it does when pressed. Without an action the button is hidden.
function setNextButton(text, action) {
  const nextButton = getElement('levelEndNextButton');
  nextButton.hidden = !action;
  nextButton.textContent = text || '';
  gameState.nextButtonAction = action;
}

// buildStarsHtml(starCount): three stars, the first starCount of them filled.
function buildStarsHtml(starCount) {
  let html = '';
  for (let index = 0; index < 3; index++) {
    if (index < starCount) {
      html += '<span>★</span>';
    } else {
      html += '<span class="star-empty">★</span>';
    }
  }
  return html;
}

// saveStarsAndPrepareNext(level, stars): saves the stars, unlocks the next level and
// prepares the "Next" button. Returns the campaign place of the level (or null).
function saveStarsAndPrepareNext(level, stars) {
  progress.starsByLevel[level.id] = Math.max(progress.starsByLevel[level.id] || 0, stars);
  const campaignPlace = findCampaignOfLevel(level);
  if (campaignPlace) {
    const campaign = campaignPlace.campaign;
    const unlockField = campaign.unlockField;
    progress[unlockField] = Math.min(campaign.levels.length, Math.max(progress[unlockField], campaignPlace.index + 2));
  }
  saveProgress();

  if (campaignPlace) {
    const campaign = campaignPlace.campaign;
    const isLastLevel = campaignPlace.index === campaign.levels.length - 1;
    // after the last level, the button goes back to the first one
    const nextIndex = (campaignPlace.index + 1) % campaign.levels.length;
    let text = translate('Siguiente nivel', 'Next level');
    if (isLastLevel) {
      text = translate('Volver al primero', 'Back to the first');
    }
    setNextButton(text, function () {
      loadLevel(campaign.levels[nextIndex]);
    });
  } else {
    // one of the player's levels: the next one of the list, if there is one
    let customIndex = -1;
    for (let index = 0; index < customLevels.length; index++) {
      if (customLevels[index].id === level.id) {
        customIndex = index;
      }
    }
    const hasNext = customIndex >= 0 && customIndex < customLevels.length - 1;
    if (hasNext) {
      setNextButton(translate('Siguiente de mis niveles', 'Next of my levels'), function () {
        loadLevel(customLevels[customIndex + 1]);
      });
    } else {
      setNextButton(null, null);
    }
  }
  return campaignPlace;
}

// isLastLevelOfCampaign(campaignPlace): true for the last level of a campaign.
function isLastLevelOfCampaign(campaignPlace) {
  return campaignPlace && campaignPlace.index === campaignPlace.campaign.levels.length - 1;
}

// updateRetryButtonText(): "Retry level" or "Test again" (when testing from the editor).
function updateRetryButtonText() {
  if (gameState.testingFromEditor) {
    getElement('levelEndRetryButton').textContent = translate('Repetir prueba', 'Test again');
  } else {
    getElement('levelEndRetryButton').textContent = translate('Repetir nivel', 'Retry level');
  }
}

// setBackToEditorButton(): when testing from the editor, "Next" becomes "Back to editor".
function setBackToEditorButton() {
  if (gameState.testingFromEditor) {
    setNextButton(translate('Volver al editor', 'Back to editor'), function () {
      backToEditor();
    });
  } else {
    setNextButton(null, null);
  }
}

// pluralAttempts(count): "1 intento", "2 intentos" / "1 attempt", "2 attempts"
function pluralAttempts(count) {
  if (count > 1) {
    return translate(`${count} intentos`, `${count} attempts`);
  }
  return translate(`${count} intento`, `${count} attempt`);
}

// endDisplacementLevel(): end of a displacement level (only vectors).
function endDisplacementLevel() {
  const level = gameState.level;
  const answer = gameState.answer;
  gameState.mode = 'ended';
  if (gameState.online) {
    if (answer.failed) {
      onlineReportLevelEnd('failed', 0);
    } else {
      onlineReportLevelEnd('won', answer.stars);
    }
    return;
  }
  updateRetryButtonText();
  if (answer.failed) {
    getElement('levelEndTitle').textContent = translate('Sin intentos', 'Out of attempts');
    getElement('levelEndStars').innerHTML = '';
    getElement('levelEndText').textContent = translate(
      'Revisa la solución paso a paso debajo de la escena y vuelve a intentarlo.',
      'Check the step-by-step solution below the scene and try again.',
    );
    setBackToEditorButton();
    playWrongSound();
  } else {
    let stars = answer.stars;
    if (gameState.testingFromEditor) {
      stars = 0;
    }
    getElement('levelEndStars').innerHTML = buildStarsHtml(stars);
    const attemptsText = pluralAttempts(answer.attemptsUsed);
    if (gameState.testingFromEditor) {
      getElement('levelEndTitle').textContent = translate('Prueba superada', 'Test passed');
      getElement('levelEndText').textContent = translate(`Lo resolviste en ${attemptsText}.`, `You solved it in ${attemptsText}.`);
      setBackToEditorButton();
    } else {
      const campaignPlace = saveStarsAndPrepareNext(level, stars);
      if (isLastLevelOfCampaign(campaignPlace)) {
        getElement('levelEndTitle').textContent = translate('¡Campaña completada!', 'Campaign complete!');
      } else {
        getElement('levelEndTitle').textContent = translate('¡Resuelto!', 'Solved!');
      }
      getElement('levelEndText').textContent = translate(
        `Lo resolviste en ${attemptsText}: +${answer.bonusPoints} puntos. La solución completa está debajo de la escena.`,
        `You solved it in ${attemptsText}: +${answer.bonusPoints} points. The full solution is below the scene.`,
      );
    }
    playWinSound();
  }
  getElement('levelEndOverlay').hidden = false;
  updateGameBar();
}

// winLevel(): every piglet was knocked down.
function winLevel() {
  const level = gameState.level;
  gameState.mode = 'ended';
  const shotsUsed = level.shotCount - gameState.shotsLeft;
  // bonus: 1000 points for each unused shot (none when the shots are unlimited)
  let bonus = gameState.shotsLeft * 1000;
  if (level.shotCount >= 900) {
    bonus = 0;
  }
  gameState.score += bonus;

  // stars: 1 shot = 3 stars, 2 shots = 2 stars, more = 1 star
  let stars = 1;
  if (shotsUsed === 1) {
    stars = 3;
  } else if (shotsUsed === 2) {
    stars = 2;
  }
  // in mixed levels the vector phase also limits the stars
  if (level.type === 'mixed') {
    if (gameState.answer.failed) {
      stars = Math.min(stars, 1);
    } else {
      stars = Math.min(stars, gameState.answer.stars);
    }
  }
  if (gameState.practiceModeUsed || gameState.testingFromEditor) {
    stars = 0;
  }
  if (gameState.online) {
    onlineReportLevelEnd('won', stars);
    return;
  }
  getElement('levelEndStars').innerHTML = buildStarsHtml(stars);

  // extra sentence about the vectors (mixed levels)
  let vectorNote = '';
  if (level.type === 'mixed') {
    if (gameState.answer.solved) {
      const attemptsText = pluralAttempts(gameState.answer.attemptsUsed);
      vectorNote = translate(` Resolviste los vectores en ${attemptsText}.`, ` You solved the vectors in ${attemptsText}.`);
    } else {
      vectorNote = translate(
        ' No resolviste los vectores, así que el máximo es una estrella.',
        ' You didn’t solve the vectors, so the most you can get is one star.',
      );
    }
  }
  if (gameState.testingFromEditor) {
    getElement('levelEndTitle').textContent = translate('Prueba superada', 'Test passed');
    getElement('levelEndText').textContent = translate(
      `El nivel se puede ganar: lo resolviste con ${shotsUsed} de ${level.shotCount} tiros.${vectorNote}`,
      `The level can be won: you beat it with ${shotsUsed} of ${level.shotCount} shots.${vectorNote}`,
    );
    setBackToEditorButton();
  } else {
    const campaignPlace = saveStarsAndPrepareNext(level, stars);
    if (isLastLevelOfCampaign(campaignPlace)) {
      getElement('levelEndTitle').textContent = translate('¡Campaña completada!', 'Campaign complete!');
    } else {
      getElement('levelEndTitle').textContent = translate('¡Nivel superado!', 'Level complete!');
    }
    let text = translate(
      `Tiros usados: ${shotsUsed} de ${level.shotCount}. Bonus por tiros sobrantes: +${bonus}.`,
      `Shots used: ${shotsUsed} of ${level.shotCount}. Bonus for unused shots: +${bonus}.`,
    );
    text += vectorNote;
    if (gameState.practiceModeUsed) {
      text += translate(' Usaste el modo práctica, así que este intento no suma estrellas.', ' You used practice mode, so this attempt earns no stars.');
    }
    getElement('levelEndText').textContent = text;
  }
  updateRetryButtonText();
  playWinSound();
  getElement('levelEndOverlay').hidden = false;
  updateGameBar();
}

// loseLevel(): no shots left and some piglets are still standing.
function loseLevel() {
  if (gameState.online) {
    onlineReportLevelEnd('failed', 0);
    return;
  }
  gameState.mode = 'ended';
  getElement('levelEndTitle').textContent = translate('Sin tiros', 'Out of shots');
  getElement('levelEndStars').innerHTML = '';
  const targetsLeft = countTargetsLeft();
  if (targetsLeft > 1) {
    getElement('levelEndText').textContent = translate(
      `Quedan ${targetsLeft} objetivos. Ajusta v₀, θ o h₀ y vuelve a intentarlo.`,
      `${targetsLeft} targets left. Adjust v₀, θ or h₀ and try again.`,
    );
  } else {
    getElement('levelEndText').textContent = translate(
      `Quedan ${targetsLeft} objetivo. Ajusta v₀, θ o h₀ y vuelve a intentarlo.`,
      `${targetsLeft} target left. Adjust v₀, θ or h₀ and try again.`,
    );
  }
  updateRetryButtonText();
  setBackToEditorButton();
  playWrongSound();
  getElement('levelEndOverlay').hidden = false;
}

// telemetryCell(label, value): one small box of the telemetry panel.
function telemetryCell(label, value) {
  return `<div><span>${label}</span><b>${value}</b></div>`;
}

// updateTelemetry(): the "Telemetry" panel. While the projectile flies it shows its
// time, position and speed; after the shot, the data of the impact.
function updateTelemetry() {
  const panel = getElement('telemetry');
  const projectile = gameState.projectile;
  if (projectile && !projectile.finished) {
    const speedY = projectile.initialSpeedY - projectile.gravity * projectile.time;
    panel.innerHTML =
      telemetryCell('t', formatFixed(projectile.time) + ' s') +
      telemetryCell('x', formatFixed(projectile.x) + ' m') +
      telemetryCell('y', formatFixed(projectile.y) + ' m') +
      telemetryCell('vₓ', formatFixed(projectile.speedX) + ' m/s') +
      telemetryCell('vᵧ', formatFixed(speedY) + ' m/s') +
      telemetryCell('|v|', formatFixed(Math.hypot(projectile.speedX, speedY)) + ' m/s');
    return;
  }
  // the shot that just finished, or else the last one
  let shot = gameState.lastShot;
  if (projectile && projectile.finished) {
    shot = projectile;
  }
  if (shot) {
    let whatWasHit = translate('suelo', 'ground');
    if (shot.hitWhat === 'terrain') {
      whatWasHit = translate('terreno', 'terrain');
    } else if (shot.hitWhat === 'piece') {
      whatWasHit = translate('estructura', 'structure');
    } else if (shot.hitWhat === 'outside') {
      whatWasHit = translate('fuera del mapa', 'off the map');
    }
    panel.innerHTML =
      telemetryCell(translate('Impacto en', 'Hit'), whatWasHit) +
      telemetryCell(translate('t impacto', 'impact t'), formatFixed(shot.time) + ' s') +
      telemetryCell(translate('x impacto', 'impact x'), formatFixed(shot.x) + ' m') +
      telemetryCell(translate('y impacto', 'impact y'), formatFixed(shot.y) + ' m') +
      telemetryCell(translate('h máx', 'max h'), formatFixed(shot.highestY) + ' m') +
      telemetryCell(translate('|v| impacto', 'impact |v|'), formatFixed(shot.impactSpeed) + ' m/s') +
      `<div class="telemetry-message">${translate('Último tiro', 'Last shot')}: v₀ = ${formatFixed(shot.launchSpeed, 1)} m/s, θ = ${shot.launchAngle}°, h₀ = ${formatFixed(shot.launchHeight, 1)} m, g = ${shot.gravity} m/s².</div>`;
    return;
  }
  panel.innerHTML = `<div class="telemetry-message">${translate(
    'Lanza para ver tiempo, posición y velocidad del proyectil en cada instante.',
    'Launch to see the projectile’s time, position and velocity at every moment.',
  )}</div>`;
}
