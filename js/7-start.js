/* ======================================================================
   FILE: js/7-start.js

   THE MAIN LOOP AND THE START OF THE GAME
   This file is loaded LAST, when every function of the other files exists.

   The main loop (drawFrame) runs about 60 times per second. Each time it:
     1. calculates how many seconds passed since the previous frame
     2. updates the game (projectile, falling pieces, particles, animations...)
     3. draws the scene again (or the animated background of the menus)

   DEBUGGING: every variable of the game can be read in the browser console
   (F12 → Console). For example type gameState, editorState, progress, online,
   hostState or myPlayer and press Enter.
   ====================================================================== */

// lastFrameTime: the moment of the previous frame (null before the first one).
let lastFrameTime = null;

// drawFrame(timestamp): one frame of the main loop. The browser gives the timestamp
// (milliseconds) when it calls it through requestAnimationFrame.
function drawFrame(timestamp) {
  // seconds since the previous frame (at most 0.033 s, so a slow frame does not make jumps)
  let secondsPassed = 0;
  if (lastFrameTime !== null) {
    secondsPassed = Math.min(0.033, (timestamp - lastFrameTime) / 1000);
  }
  lastFrameTime = timestamp;

  if (currentView === 'game') {
    gameState.time += secondsPassed;
    if (gameState.screen === 'play') {
      updatePathAnimation(secondsPassed);
      if (gameState.mode === 'flying') {
        updateProjectile(secondsPassed);
        updateTelemetry();
        // the shot ends 0.9 s after the impact, when nothing is falling anymore
        const projectile = gameState.projectile;
        if (projectile && projectile.finished && projectile.timeSinceFinished > 0.9 && !isAnythingFalling()) {
          finishShot();
        }
      }
      // displacement levels: the end card appears when the timer reaches 0
      if (gameState.endTimer > 0) {
        gameState.endTimer -= secondsPassed;
        if (gameState.endTimer <= 0) {
          endDisplacementLevel();
        }
      }
      updateFallingPieces(secondsPassed);
      updateParticles(secondsPassed);
    }
    if (gameState.online) {
      updateOnlineGame();
    }
    if (gameState.screen === 'edit' && editorState.propertyCardNeedsUpdate) {
      editorState.propertyCardNeedsUpdate = false;
      renderPropertyCard();
    }
    if (canvasWidth > 0) {
      // setTransform scales the drawing by the pixel ratio (sharp on phones)
      gameContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      startLabelFrame(); // the labels are collected while drawing...
      if (gameState.screen === 'edit') {
        drawEditorScene();
      } else {
        drawPlayScene();
      }
      placeAndDrawLabels(); // ...and placed at the end so they do not overlap
    }
  } else {
    const animate = settings.backgroundAnimation && !userPrefersReducedMotion;
    if (animate) {
      menuBackgroundTime += secondsPassed;
      drawMenuBackground(menuBackgroundTime);
    } else if (menuBackgroundNeedsRedraw) {
      drawMenuBackground(31.8); // a nice still moment of the animation
    }
    menuBackgroundNeedsRedraw = false;
  }
  // ask the browser to call drawFrame again before the next screen refresh
  requestAnimationFrame(drawFrame);
}

// START
applyLanguageToPage(); // write every text in the chosen language
showView('home'); // show the home screen
renderVersionInfo(); // the version in the settings menu...
checkForNewVersion(); // ...and check if there is a newer one
requestAnimationFrame(drawFrame); // start the main loop
