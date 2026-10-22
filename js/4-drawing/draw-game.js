/* ======================================================================
   FILE: js/4-drawing/draw-game.js

   DRAWING THE SCENE WHILE PLAYING
   The world is measured in METERS, but the canvas is measured in PIXELS.
   toScreenX(x) and toScreenY(y) convert meters into pixels:
     - sceneView.scale = how many pixels one meter takes
     - the y axis of the canvas grows DOWNWARDS, the y of the world grows upwards,
       so toScreenY turns it around.

   Everything is drawn again on every frame (about 60 times per second) by the
   main loop in js/7-start.js, which calls drawPlayScene() or drawEditorScene().

   gameContext is the "pen" of the canvas (defined in utilities.js). The most used
   commands are:
     fillRect(x, y, width, height)      a filled rectangle
     beginPath(), moveTo(), lineTo(), arc(), stroke(), fill()   lines and circles
     fillText(text, x, y)               text
     fillStyle / strokeStyle            the colors used to fill and to draw lines
     globalAlpha                        transparency (1 = solid, 0 = invisible)
   ====================================================================== */

// pixelRatio: real pixels for each CSS pixel (2 on most phones). The canvas uses it so
// the drawing is sharp. canvasWidth and canvasHeight are measured in CSS pixels.
let pixelRatio = 1;
let canvasWidth = 0;
let canvasHeight = 0;

// resizeGameCanvas(): adapts the canvas to its size on the page.
function resizeGameCanvas() {
  pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  canvasWidth = gameCanvas.clientWidth;
  canvasHeight = gameCanvas.clientHeight;
  gameCanvas.width = Math.round(canvasWidth * pixelRatio);
  gameCanvas.height = Math.round(canvasHeight * pixelRatio);
  if (currentView === 'game' && gameState.screen === 'edit') {
    // requestAnimationFrame runs the function just before the next frame is drawn
    requestAnimationFrame(function () {
      positionPropertyCard();
    });
  }
}
// ResizeObserver calls resizeGameCanvas every time the size of the canvas changes
const canvasResizeObserver = new ResizeObserver(function () {
  resizeGameCanvas();
});
canvasResizeObserver.observe(gameCanvas);
resizeGameCanvas();

// sceneView: which part of the world is visible.
//   scale:   pixels per meter
//   leftX:   the world x (m) at the left edge of the canvas
//   bottomY: the world y (m) at the bottom edge of the canvas
let sceneView = { scale: 10, leftX: -4, bottomY: -2 };

// setSceneView(worldWidth, topHeight, compact): chooses the zoom so the whole world
// (from a bit left of the launcher to the end of the world, and up to topHeight) fits.
//   compact: true for displacement levels (there is no launcher on the left)
function setSceneView(worldWidth, topHeight, compact) {
  let leftEdge = -5;
  let topMargin = 6;
  if (compact) {
    leftEdge = 0;
    topMargin = 3;
  }
  const rightEdge = worldWidth + 2;
  const bottomEdge = -2.2;
  const topEdge = topHeight + topMargin;
  const scale = Math.min(canvasWidth / (rightEdge - leftEdge), canvasHeight / (topEdge - bottomEdge));
  // center the world horizontally if there is extra space
  const extraWidth = canvasWidth / scale - (rightEdge - leftEdge);
  sceneView = { scale: scale, leftX: leftEdge - extraWidth / 2, bottomY: bottomEdge };
}

// toScreenX(x): world x (meters) → canvas x (pixels)
function toScreenX(x) {
  return (x - sceneView.leftX) * sceneView.scale;
}
// toScreenY(y): world y (meters) → canvas y (pixels). The canvas y grows downwards.
function toScreenY(y) {
  return canvasHeight - (y - sceneView.bottomY) * sceneView.scale;
}

// handwritingFont(sizeFactor): the handwritten font (Kalam), bigger when zoomed in.
function handwritingFont(sizeFactor) {
  if (sizeFactor === undefined) {
    sizeFactor = 1;
  }
  return `${Math.round(Math.max(12, Math.min(19, sceneView.scale * 0.75)) * sizeFactor)}px Kalam, 'Comic Sans MS', cursive`;
}

// scaleVisibility: which scale references are drawn in this frame.
//   gridLines: the lines of the grid;  numbers: the numbers of the axes
// (vector levels can hide them until the puzzle is solved)
let scaleVisibility = { gridLines: true, numbers: true };

// drawGrid(): the paper background, the grid and the height numbers on the left.
function drawGrid() {
  gameContext.fillStyle = COLORS.paper;
  gameContext.fillRect(0, 0, canvasWidth, canvasHeight);
  const scale = sceneView.scale;
  // distance between lines (m): 1, 2 or 5 depending on the zoom; every "major" line is darker
  let step = 5;
  if (scale >= 14) {
    step = 1;
  } else if (scale >= 7) {
    step = 2;
  }
  let major = 5;
  if (step >= 5) {
    major = 10;
  }
  const rightX = sceneView.leftX + canvasWidth / scale;
  const topY = sceneView.bottomY + canvasHeight / scale;
  if (scaleVisibility.gridLines) {
    gameContext.lineWidth = 1;
    // vertical lines (the + 0.5 makes 1-pixel lines sharp)
    for (let x = Math.ceil(sceneView.leftX / step) * step; x <= rightX; x += step) {
      if (x % major === 0) {
        gameContext.strokeStyle = COLORS.gridMajor;
      } else {
        gameContext.strokeStyle = COLORS.grid;
      }
      gameContext.beginPath();
      gameContext.moveTo(Math.round(toScreenX(x)) + 0.5, 0);
      gameContext.lineTo(Math.round(toScreenX(x)) + 0.5, toScreenY(0));
      gameContext.stroke();
    }
    // horizontal lines
    for (let y = 0; y <= topY; y += step) {
      if (y % major === 0) {
        gameContext.strokeStyle = COLORS.gridMajor;
      } else {
        gameContext.strokeStyle = COLORS.grid;
      }
      gameContext.beginPath();
      gameContext.moveTo(0, Math.round(toScreenY(y)) + 0.5);
      gameContext.lineTo(canvasWidth, Math.round(toScreenY(y)) + 0.5);
      gameContext.stroke();
    }
  }
  if (scaleVisibility.gridLines || scaleVisibility.numbers) {
    gameContext.fillStyle = COLORS.inkSoft;
    gameContext.font = `11px 'IBM Plex Mono', monospace`;
    gameContext.textBaseline = 'middle';
    gameContext.textAlign = 'left';
    for (let y = major; y <= topY - 1; y += major) {
      // when the scale is hidden, a "?" is written instead of the number
      let text = '?';
      if (scaleVisibility.numbers) {
        text = y + ' m';
      }
      gameContext.fillText(text, 6, toScreenY(y) - 7);
    }
  }
}

// drawHatching(x, y, width, height): diagonal lines inside a rectangle (ground texture).
function drawHatching(x, y, width, height) {
  gameContext.save(); // remember the drawing settings to restore them later
  gameContext.beginPath();
  gameContext.rect(x, y, width, height);
  gameContext.clip(); // from now on, only draw inside this rectangle
  gameContext.strokeStyle = COLORS.earthDark;
  gameContext.globalAlpha = 0.35;
  gameContext.lineWidth = 1;
  for (let offset = -height; offset < width; offset += 9) {
    gameContext.beginPath();
    gameContext.moveTo(x + offset, y + height);
    gameContext.lineTo(x + offset + height, y);
    gameContext.stroke();
  }
  gameContext.restore();
}

// drawTerrainBlock(block, alpha, dashed): a terrain block (from the ground to its height).
//   dashed: true draws only a dashed outline (used in the editor for the pillar under B)
function drawTerrainBlock(block, alpha, dashed) {
  if (alpha === undefined) {
    alpha = 1;
  }
  const groundY = toScreenY(0);
  const x = toScreenX(block.x);
  const y = toScreenY(block.height);
  const width = block.width * sceneView.scale;
  const height = groundY - y;
  gameContext.globalAlpha = alpha;
  if (dashed) {
    gameContext.strokeStyle = COLORS.earthDark;
    gameContext.setLineDash([5, 4]); // dashes of 5 px with gaps of 4 px
    gameContext.lineWidth = 1.5;
    gameContext.strokeRect(x, y, width, height);
    gameContext.setLineDash([]); // back to solid lines
    gameContext.globalAlpha = 1;
    return;
  }
  gameContext.fillStyle = COLORS.earth;
  gameContext.fillRect(x, y, width, height);
  drawHatching(x, y, width, height);
  gameContext.strokeStyle = COLORS.earthDark;
  gameContext.lineWidth = 2;
  gameContext.strokeRect(x + 1, y + 1, width - 2, height);
  // green grass on top
  gameContext.fillStyle = COLORS.targetDark;
  gameContext.fillRect(x, y, width, Math.max(3, sceneView.scale * 0.2));
  gameContext.globalAlpha = 1;
}

// drawGround(terrain, worldWidth): the ground, the terrain blocks and the x axis numbers.
function drawGround(terrain, worldWidth) {
  const groundY = toScreenY(0);
  gameContext.fillStyle = COLORS.earth;
  gameContext.fillRect(0, groundY, canvasWidth, canvasHeight - groundY);
  drawHatching(0, groundY, canvasWidth, canvasHeight - groundY);
  for (const block of terrain) {
    drawTerrainBlock(block);
  }
  gameContext.fillStyle = COLORS.targetDark;
  gameContext.fillRect(0, groundY, canvasWidth, Math.max(3, sceneView.scale * 0.2));
  if (!scaleVisibility.gridLines && !scaleVisibility.numbers) {
    return;
  }
  // the numbers of the x axis, every 5 or 10 m
  let major = 10;
  if (sceneView.scale >= 7) {
    major = 5;
  }
  gameContext.fillStyle = '#f3ece2';
  gameContext.font = `11px 'IBM Plex Mono', monospace`;
  gameContext.textAlign = 'center';
  gameContext.textBaseline = 'top';
  for (let x = 0; x <= worldWidth; x += major) {
    gameContext.fillRect(toScreenX(x) - 0.5, groundY + 3, 1, 5);
    let text = '?';
    if (x === 0) {
      text = '0';
    } else if (scaleVisibility.numbers) {
      text = String(x);
    }
    gameContext.fillText(text, toScreenX(x), groundY + 10);
  }
  let axisLabel = translate('escala oculta', 'scale hidden');
  let axisLabelY = groundY + 26;
  if (scaleVisibility.numbers) {
    axisLabel = 'x (m)';
    axisLabelY = groundY + 10;
  }
  const axisLabelWidth = gameContext.measureText(axisLabel).width;
  gameContext.textAlign = 'left';
  gameContext.fillText(axisLabel, Math.min(canvasWidth - axisLabelWidth - 6, toScreenX(worldWidth) + 10), axisLabelY);
}

// drawPiece(piece, alpha): draws a piglet or a wood / stone block.
function drawPiece(piece, alpha) {
  if (alpha === undefined) {
    alpha = 1;
  }
  const x = toScreenX(piece.x);
  const y = toScreenY(piece.y + piece.height);
  const width = piece.width * sceneView.scale;
  const height = piece.height * sceneView.scale;
  gameContext.globalAlpha = alpha;

  if (piece.kind === 'target') {
    // the piglet: a green circle with ears, eyes and a smile
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const radius = width / 2;
    gameContext.fillStyle = COLORS.target;
    gameContext.strokeStyle = COLORS.targetDark;
    gameContext.lineWidth = 2;
    gameContext.beginPath();
    gameContext.arc(centerX, centerY, radius, 0, Math.PI * 2);
    gameContext.fill();
    gameContext.stroke();
    // ears
    gameContext.beginPath();
    gameContext.arc(centerX - radius * 0.55, centerY - radius * 0.85, radius * 0.22, 0, Math.PI * 2);
    gameContext.arc(centerX + radius * 0.55, centerY - radius * 0.85, radius * 0.22, 0, Math.PI * 2);
    gameContext.fill();
    // it blinks for 0.12 s every 4 s (each piglet at a different moment)
    const isBlinking = piece.blinkOffset !== undefined && (gameState.time + piece.blinkOffset) % 4 < 0.12;
    gameContext.fillStyle = '#fff';
    const sides = [-1, 1];
    for (const side of sides) {
      let eyeHeight = radius * 0.26;
      if (isBlinking) {
        eyeHeight = radius * 0.04;
      }
      gameContext.beginPath();
      gameContext.ellipse(centerX + side * radius * 0.35, centerY - radius * 0.1, radius * 0.22, eyeHeight, 0, 0, Math.PI * 2);
      gameContext.fill();
    }
    if (!isBlinking) {
      gameContext.fillStyle = COLORS.ink;
      for (const side of sides) {
        gameContext.beginPath();
        gameContext.arc(centerX + side * radius * 0.35 - radius * 0.06, centerY - radius * 0.08, radius * 0.1, 0, Math.PI * 2);
        gameContext.fill();
      }
    }
    // smile
    gameContext.strokeStyle = COLORS.targetDark;
    gameContext.lineWidth = 1.5;
    gameContext.beginPath();
    gameContext.arc(centerX, centerY + radius * 0.3, radius * 0.25, 0.15 * Math.PI, 0.85 * Math.PI);
    gameContext.stroke();
    gameContext.globalAlpha = 1;
    return;
  }

  // a block
  const isStone = piece.kind === 'stone';
  if (isStone) {
    gameContext.fillStyle = COLORS.stone;
    gameContext.strokeStyle = COLORS.stoneDark;
  } else {
    gameContext.fillStyle = COLORS.wood;
    gameContext.strokeStyle = COLORS.woodDark;
  }
  gameContext.fillRect(x, y, width, height);
  gameContext.lineWidth = 2;
  gameContext.strokeRect(x + 1, y + 1, width - 2, height - 2);
  // texture lines: two small scratches on stone, a grain line on wood
  gameContext.lineWidth = 1;
  gameContext.globalAlpha = alpha * 0.5;
  gameContext.beginPath();
  if (isStone) {
    gameContext.moveTo(x + width * 0.2, y + height * 0.3);
    gameContext.lineTo(x + width * 0.45, y + height * 0.32);
    gameContext.moveTo(x + width * 0.6, y + height * 0.7);
    gameContext.lineTo(x + width * 0.82, y + height * 0.66);
  } else if (width > height) {
    gameContext.moveTo(x + 4, y + height * 0.5);
    gameContext.lineTo(x + width - 4, y + height * 0.5);
  } else {
    gameContext.moveTo(x + width * 0.5, y + 4);
    gameContext.lineTo(x + width * 0.5, y + height - 4);
  }
  gameContext.stroke();
  gameContext.globalAlpha = alpha;
  // a cracked stone (it already took one hit) shows a crack
  if (isStone && piece.health === 1) {
    gameContext.strokeStyle = COLORS.ink;
    gameContext.lineWidth = 1.5;
    gameContext.beginPath();
    gameContext.moveTo(x + width * 0.3, y + 2);
    gameContext.lineTo(x + width * 0.55, y + height * 0.4);
    gameContext.lineTo(x + width * 0.4, y + height * 0.65);
    gameContext.lineTo(x + width * 0.7, y + height - 2);
    gameContext.stroke();
  }
  gameContext.globalAlpha = 1;
}

// drawBall(x, y, speedX, speedY, alpha): the projectile: a red ball with an eye that looks
// in the direction it moves.
function drawBall(x, y, speedX, speedY, alpha) {
  if (alpha === undefined) {
    alpha = 1;
  }
  const pixelX = toScreenX(x);
  const pixelY = toScreenY(y);
  const radius = PROJECTILE_RADIUS * sceneView.scale;
  gameContext.globalAlpha = alpha;
  gameContext.fillStyle = COLORS.accent;
  gameContext.strokeStyle = COLORS.accentDark;
  gameContext.lineWidth = 2;
  gameContext.beginPath();
  gameContext.arc(pixelX, pixelY, radius, 0, Math.PI * 2);
  gameContext.fill();
  gameContext.stroke();
  // the direction of movement on screen (y is upside down)
  const lookAngle = Math.atan2(-speedY, speedX);
  const eyeX = pixelX + Math.cos(lookAngle) * radius * 0.35;
  const eyeY = pixelY + Math.sin(lookAngle) * radius * 0.35 - radius * 0.15;
  gameContext.fillStyle = '#fff';
  gameContext.beginPath();
  gameContext.arc(eyeX, eyeY, radius * 0.34, 0, Math.PI * 2);
  gameContext.fill();
  gameContext.fillStyle = COLORS.ink;
  gameContext.beginPath();
  gameContext.arc(eyeX + Math.cos(lookAngle) * radius * 0.12, eyeY + Math.sin(lookAngle) * radius * 0.12, radius * 0.15, 0, Math.PI * 2);
  gameContext.fill();
  // the angry eyebrow
  gameContext.strokeStyle = COLORS.ink;
  gameContext.lineWidth = Math.max(1.5, radius * 0.14);
  gameContext.beginPath();
  gameContext.moveTo(eyeX - radius * 0.35, eyeY - radius * 0.5);
  gameContext.lineTo(eyeX + radius * 0.3, eyeY - radius * 0.32);
  gameContext.stroke();
  gameContext.globalAlpha = 1;
}

// drawLauncher(height): the tower (if h₀ > 0) with its height mark, and the slingshot.
function drawLauncher(height) {
  const top = toScreenY(height);
  const base = toScreenY(0);
  const leftX = toScreenX(-0.6);
  const width = 1.2 * sceneView.scale;
  if (height > 0.05) {
    // the tower
    gameContext.fillStyle = COLORS.inkSoft;
    gameContext.fillRect(leftX, top, width, base - top);
    gameContext.strokeStyle = COLORS.ink;
    gameContext.lineWidth = 2;
    gameContext.strokeRect(leftX + 1, top + 1, width - 2, base - top - 1);
    gameContext.strokeStyle = COLORS.paper;
    gameContext.globalAlpha = 0.35;
    gameContext.lineWidth = 1;
    for (let lineY = top + 8; lineY < base; lineY += 10) {
      gameContext.beginPath();
      gameContext.moveTo(leftX + 3, lineY);
      gameContext.lineTo(leftX + width - 3, lineY);
      gameContext.stroke();
    }
    gameContext.globalAlpha = 1;
    // the height mark "h₀ = 2.0 m" written vertically
    if (scaleVisibility.numbers) {
      const markX = toScreenX(-2.2);
      gameContext.strokeStyle = COLORS.ink;
      gameContext.lineWidth = 1.2;
      gameContext.beginPath();
      gameContext.moveTo(markX, base);
      gameContext.lineTo(markX, top);
      gameContext.moveTo(markX - 4, top);
      gameContext.lineTo(markX + 4, top);
      gameContext.moveTo(markX - 4, base);
      gameContext.lineTo(markX + 4, base);
      gameContext.stroke();
      gameContext.fillStyle = COLORS.ink;
      gameContext.font = handwritingFont();
      gameContext.save();
      gameContext.translate(markX - 6, (top + base) / 2); // move the origin to the middle of the mark
      gameContext.rotate(-Math.PI / 2); // turn 90° so the text goes upwards
      gameContext.textAlign = 'center';
      gameContext.textBaseline = 'bottom';
      gameContext.fillText(`h₀ = ${formatFixed(height, 1)} m`, 0, 0);
      gameContext.restore();
    }
  }
  // the slingshot (a "V")
  gameContext.strokeStyle = COLORS.woodDark;
  gameContext.lineWidth = Math.max(3, sceneView.scale * 0.22);
  gameContext.lineCap = 'round';
  gameContext.beginPath();
  gameContext.moveTo(toScreenX(0), top);
  gameContext.lineTo(toScreenX(-0.45), toScreenY(height + 1));
  gameContext.moveTo(toScreenX(0), top);
  gameContext.lineTo(toScreenX(0.45), toScreenY(height + 1));
  gameContext.stroke();
  gameContext.lineCap = 'butt';
}

// drawArrow(fromX, fromY, toX, toY, color, lineWidth, headSize): an arrow (in pixels).
function drawArrow(fromX, fromY, toX, toY, color, lineWidth, headSize) {
  if (lineWidth === undefined) {
    lineWidth = 2.5;
  }
  if (headSize === undefined) {
    headSize = 10;
  }
  gameContext.strokeStyle = color;
  gameContext.lineWidth = lineWidth;
  gameContext.beginPath();
  gameContext.moveTo(fromX, fromY);
  gameContext.lineTo(toX, toY);
  gameContext.stroke();
  if (headSize < 1 || Math.hypot(toX - fromX, toY - fromY) < 2) {
    return; // no head for very short arrows
  }
  // the head: a small triangle pointing in the direction of the arrow
  const angle = Math.atan2(toY - fromY, toX - fromX);
  gameContext.fillStyle = color;
  gameContext.beginPath();
  gameContext.moveTo(toX, toY);
  gameContext.lineTo(toX - headSize * Math.cos(angle - 0.4), toY - headSize * Math.sin(angle - 0.4));
  gameContext.lineTo(toX - headSize * Math.cos(angle + 0.4), toY - headSize * Math.sin(angle + 0.4));
  gameContext.fill();
}

// drawDashedPath(speed, angle, height, gravity, worldWidth, color, lineWidth): the full
// parabola of a launch as a dashed line (practice mode and editor).
function drawDashedPath(speed, angle, height, gravity, worldWidth, color, lineWidth) {
  if (lineWidth === undefined) {
    lineWidth = 2;
  }
  const angleInRadians = (angle * Math.PI) / 180;
  const speedX = speed * Math.cos(angleInRadians);
  const speedY = speed * Math.sin(angleInRadians);
  gameContext.strokeStyle = color;
  gameContext.setLineDash([7, 6]);
  gameContext.lineWidth = lineWidth;
  gameContext.beginPath();
  for (let time = 0; time <= 60; time += 0.02) {
    const x = speedX * time;
    const y = height + speedY * time - 0.5 * gravity * time * time;
    if (time === 0) {
      gameContext.moveTo(toScreenX(x), toScreenY(y));
    } else {
      gameContext.lineTo(toScreenX(x), toScreenY(y));
    }
    if (y < 0 || x > worldWidth + 10) {
      break; // it reached the ground or left the world
    }
  }
  gameContext.stroke();
  gameContext.setLineDash([]);
}

// drawAim(): while aiming: the angle θ, the arrow v₀, the first dots of the path (or the
// whole path in practice mode) and the ball on the launcher.
function drawAim() {
  if (gameState.mode !== 'aiming' || gameState.phase !== 'launch') {
    return;
  }
  const angleInRadians = (launcher.launchAngle * Math.PI) / 180;
  const originX = toScreenX(0);
  const originY = toScreenY(launcher.launchHeight);
  const speedX = launcher.launchSpeed * Math.cos(angleInRadians);
  const speedY = launcher.launchSpeed * Math.sin(angleInRadians);

  // horizontal reference line and the arc of the angle
  gameContext.strokeStyle = COLORS.inkSoft;
  gameContext.setLineDash([4, 4]);
  gameContext.lineWidth = 1;
  gameContext.beginPath();
  gameContext.moveTo(originX, originY);
  gameContext.lineTo(originX + 3.2 * sceneView.scale, originY);
  gameContext.stroke();
  gameContext.setLineDash([]);
  const arcRadius = 2.2 * sceneView.scale;
  gameContext.strokeStyle = COLORS.ink;
  gameContext.lineWidth = 1.5;
  gameContext.beginPath();
  if (angleInRadians > 0) {
    gameContext.arc(originX, originY, arcRadius, -angleInRadians, 0);
  } else {
    gameContext.arc(originX, originY, arcRadius, 0, -angleInRadians);
  }
  gameContext.stroke();
  // the text "θ = 45°"
  gameContext.fillStyle = COLORS.ink;
  gameContext.font = handwritingFont();
  gameContext.textAlign = 'left';
  gameContext.textBaseline = 'middle';
  const angleText = `θ = ${launcher.launchAngle}°`;
  const angleTextY = originY - Math.sin(angleInRadians / 2) * arcRadius - 2;
  const angleTextWidth = gameContext.measureText(angleText).width;
  gameContext.fillText(angleText, originX + arcRadius + 6, angleTextY);
  addLabelObstacle(originX + arcRadius + 6, angleTextY - 10, angleTextWidth, 20); // labels must not cover this text

  if (getElement('practiceModeCheckbox').checked) {
    // practice mode: the whole path, the range and the maximum height
    drawDashedPath(launcher.launchSpeed, launcher.launchAngle, launcher.launchHeight, currentGravity, gameState.level.worldWidth, COLORS.accent);
    const prediction = calculateLaunchPrediction(launcher.launchSpeed, launcher.launchAngle, launcher.launchHeight, currentGravity);
    drawMarker(prediction.range, 0, `R = ${formatFixed(prediction.range, 1)} m`, COLORS.accent, 'below', 'practiceRange');
    if (prediction.speedY > 0) {
      drawMarker(
        prediction.speedX * prediction.timeToApex,
        prediction.maxHeight,
        `${translate('h máx', 'max h')} = ${formatFixed(prediction.maxHeight, 1)} m`,
        COLORS.accent,
        'above',
        'practiceMaxHeight',
      );
    }
  } else {
    // only the first dots of the path (the player must calculate the rest)
    gameContext.fillStyle = COLORS.accent;
    for (let time = 0.08; time <= 0.45; time += 0.06) {
      const x = speedX * time;
      const y = launcher.launchHeight + speedY * time - 0.5 * currentGravity * time * time;
      gameContext.beginPath();
      gameContext.arc(toScreenX(x), toScreenY(y), Math.max(2, sceneView.scale * 0.12), 0, Math.PI * 2);
      gameContext.fill();
    }
  }
  // the arrow of v₀ (its length grows with the speed)
  const arrowEndX = originX + speedX * LAUNCHER_ARROW_SCALE * sceneView.scale;
  const arrowEndY = originY - speedY * LAUNCHER_ARROW_SCALE * sceneView.scale;
  drawArrow(originX, originY, arrowEndX, arrowEndY, COLORS.accentDark);
  gameContext.font = handwritingFont(1.05);
  gameContext.textAlign = 'left';
  gameContext.textBaseline = 'bottom';
  gameContext.fillStyle = COLORS.accentDark;
  const speedText = `v₀ = ${formatFixed(launcher.launchSpeed, 1)} m/s`;
  gameContext.fillText(speedText, arrowEndX + 6, arrowEndY - 4);
  addLabelObstacle(arrowEndX + 6, arrowEndY - 26, gameContext.measureText(speedText).width, 22);
  drawBall(0, launcher.launchHeight, speedX, speedY);
}

// drawMarker(x, y, text, color, where, key): an "×" at a point of the world with a
// handwritten label (for example the landing point "x = 24.3 m").
//   where: 'above' or 'below' (where the label prefers to go)
function drawMarker(x, y, text, color, where, key) {
  const pixelX = toScreenX(x);
  const pixelY = toScreenY(y);
  gameContext.strokeStyle = color;
  gameContext.lineWidth = 2;
  gameContext.beginPath();
  gameContext.moveTo(pixelX - 5, pixelY - 5);
  gameContext.lineTo(pixelX + 5, pixelY + 5);
  gameContext.moveTo(pixelX + 5, pixelY - 5);
  gameContext.lineTo(pixelX - 5, pixelY + 5);
  gameContext.stroke();
  const above = where === 'above';
  const onGround = y <= 0.01;
  let textY = pixelY + 8;
  if (above || onGround) {
    textY = pixelY - 8;
  }
  let vertical = 'top';
  if (above || onGround) {
    vertical = 'bottom';
  }
  // the opposite side, as the last option
  let oppositeY = pixelY - 8;
  let oppositeVertical = 'bottom';
  if (above) {
    oppositeY = pixelY + 8;
    oppositeVertical = 'top';
  }
  // candidates: centered, to the right, to the left, and on the other side
  queueLabel({
    key: key || 'marker:' + text,
    text: text,
    color: color,
    style: 'hand',
    priority: 7,
    point: { x: pixelX, y: pixelY },
    candidates: [
      { x: pixelX, y: textY, horizontal: 'center', vertical: vertical },
      { x: pixelX + 10, y: textY, horizontal: 'left', vertical: vertical },
      { x: pixelX - 10, y: textY, horizontal: 'right', vertical: vertical },
      { x: pixelX, y: oppositeY, horizontal: 'center', vertical: oppositeVertical },
    ],
  });
}

// drawPointLabel(x, y, name, text, color): a point (A or B) with its name and coordinates.
function drawPointLabel(x, y, name, text, color) {
  const pixelX = toScreenX(x);
  const pixelY = toScreenY(y);
  gameContext.fillStyle = color;
  gameContext.strokeStyle = '#fff';
  gameContext.lineWidth = 2;
  gameContext.beginPath();
  gameContext.arc(pixelX, pixelY, 5, 0, Math.PI * 2);
  gameContext.fill();
  gameContext.stroke();
  let labelText = name;
  if (text) {
    labelText = `${name} ${text}`;
  }
  // bottom right (the usual place), top right, bottom left or top left
  queueLabel({
    key: 'point:' + name,
    text: labelText,
    color: color,
    style: 'point',
    priority: 6,
    point: { x: pixelX, y: pixelY },
    candidates: [
      { x: pixelX + 8, y: pixelY + 5, horizontal: 'left', vertical: 'top' },
      { x: pixelX + 8, y: pixelY - 7, horizontal: 'left', vertical: 'bottom' },
      { x: pixelX - 8, y: pixelY + 5, horizontal: 'right', vertical: 'top' },
      { x: pixelX - 8, y: pixelY - 7, horizontal: 'right', vertical: 'bottom' },
    ],
  });
}

// drawVectors(points, vectorsToDraw, color, labelTexts): draws the chain of vectors.
//   points:        the corners of the path (A, end of V₁, end of V₂...)
//   vectorsToDraw: how many vectors to draw (2.5 = two whole vectors and half of the third,
//                  used by the walking animation; a half vector is drawn dashed)
//   labelTexts:    the label of each vector (or null for no labels)
function drawVectors(points, vectorsToDraw, color, labelTexts) {
  for (let index = 0; index < points.length - 1; index++) {
    if (vectorsToDraw <= index) {
      break;
    }
    const fraction = Math.min(1, vectorsToDraw - index);
    const start = points[index];
    const end = points[index + 1];
    const endX = start.x + (end.x - start.x) * fraction;
    const endY = start.y + (end.y - start.y) * fraction;
    if (fraction < 1) {
      gameContext.setLineDash([6, 5]);
      drawArrow(toScreenX(start.x), toScreenY(start.y), toScreenX(endX), toScreenY(endY), color, 2.2, 0);
    } else {
      gameContext.setLineDash([]);
      drawArrow(toScreenX(start.x), toScreenY(start.y), toScreenX(endX), toScreenY(endY), color, 2.2, 10);
    }
    gameContext.setLineDash([]);
    if (fraction >= 1 && labelTexts) {
      const text = labelTexts[index];
      if (!text) {
        continue;
      }
      const segment = { startX: toScreenX(start.x), startY: toScreenY(start.y), endX: toScreenX(end.x), endY: toScreenY(end.y) };
      // the label prefers to go above the vector; if it collides, it tries other places
      queueLabel({
        key: 'vector' + index,
        text: text,
        color: color,
        style: 'box',
        priority: 4,
        segment: segment,
        candidates: createSegmentCandidates(segment.startX, segment.startY, segment.endX, segment.endY, 1, 14),
      });
    }
  }
}

// drawResultant(puzzle, resultant, color, labelText, showComponents): the dashed arrow R
// from A to B, with its label and (optionally) its components as dashed lines.
function drawResultant(puzzle, resultant, color, labelText, showComponents) {
  const startX = puzzle.startX;
  const startY = puzzle.startY;
  const endPoint = resultant.endPoint;
  if (showComponents) {
    gameContext.setLineDash([4, 4]);
    gameContext.strokeStyle = color;
    gameContext.lineWidth = 1.2;
    gameContext.globalAlpha = gameContext.globalAlpha * 0.7;
    gameContext.beginPath();
    gameContext.moveTo(toScreenX(startX), toScreenY(startY));
    gameContext.lineTo(toScreenX(endPoint.x), toScreenY(startY));
    gameContext.lineTo(toScreenX(endPoint.x), toScreenY(endPoint.y));
    gameContext.stroke();
    gameContext.setLineDash([]);
    gameContext.globalAlpha = Math.min(1, gameContext.globalAlpha / 0.7);
  }
  gameContext.setLineDash([9, 5]);
  drawArrow(toScreenX(startX), toScreenY(startY), toScreenX(endPoint.x), toScreenY(endPoint.y), color, 3, 12);
  gameContext.setLineDash([]);
  if (labelText) {
    const segment = { startX: toScreenX(startX), startY: toScreenY(startY), endX: toScreenX(endPoint.x), endY: toScreenY(endPoint.y) };
    // the label of R prefers to go below, so it does not collide with the vectors
    queueLabel({
      key: 'R',
      text: labelText,
      color: color,
      style: 'box',
      priority: 5,
      segment: segment,
      candidates: createSegmentCandidates(segment.startX, segment.startY, segment.endX, segment.endY, -1, 16),
    });
  }
}

// drawShotPath(projectile, kind): the dots of a shot path.
//   kind: 'live' (flying now), 'last' (previous shot) or 'old' (older shots, very faint)
function drawShotPath(projectile, kind) {
  if (kind === 'live') {
    gameContext.fillStyle = COLORS.accent;
  } else {
    gameContext.fillStyle = COLORS.inkSoft;
  }
  gameContext.globalAlpha = 1;
  if (kind === 'old') {
    gameContext.globalAlpha = 0.28;
  } else if (kind === 'last') {
    gameContext.globalAlpha = 0.75;
  }
  const dotRadius = Math.max(1.8, sceneView.scale * 0.1);
  for (const point of projectile.pathPoints) {
    gameContext.beginPath();
    gameContext.arc(toScreenX(point.x), toScreenY(point.y), dotRadius, 0, Math.PI * 2);
    gameContext.fill();
  }
  gameContext.globalAlpha = 1;
}

// drawParticles(): chips, rings and floating texts. They fade out as their life ends.
function drawParticles() {
  for (const particle of gameState.particles) {
    const fade = Math.max(0, particle.life / particle.maxLife);
    gameContext.globalAlpha = fade;
    if (particle.kind === 'chip') {
      const size = particle.size * sceneView.scale;
      gameContext.fillStyle = particle.color;
      gameContext.save();
      gameContext.translate(toScreenX(particle.x), toScreenY(particle.y));
      gameContext.rotate(particle.rotation || 0);
      gameContext.fillRect(-size / 2, -size / 2, size, size);
      gameContext.restore();
    } else if (particle.kind === 'ring') {
      // a ring that grows while it fades
      gameContext.strokeStyle = COLORS.target;
      gameContext.lineWidth = 3;
      gameContext.beginPath();
      gameContext.arc(toScreenX(particle.x), toScreenY(particle.y), (1 - fade) * 2.4 * sceneView.scale + 4, 0, Math.PI * 2);
      gameContext.stroke();
    } else if (particle.kind === 'text') {
      gameContext.fillStyle = particle.color;
      gameContext.font = handwritingFont(1.15);
      gameContext.textAlign = 'center';
      gameContext.textBaseline = 'middle';
      gameContext.fillText(particle.text, toScreenX(particle.x), toScreenY(particle.y));
    }
  }
  gameContext.globalAlpha = 1;
}

// hasAnyShown(visibility, quantities): true if at least one quantity is not hidden.
function hasAnyShown(visibility, quantities) {
  for (const quantity of quantities) {
    if (visibility[quantity] !== 'hidden') {
      return true;
    }
  }
  return false;
}

// buildFullResultantLabel(resultant): "R: 12.5 m · 30° · ↗"
function buildFullResultantLabel(resultant) {
  return `R: ${formatNice(resultant.magnitude)} m · ${formatNice(resultant.angle)}° · ${DIRECTION_ARROWS[resultant.direction]}`;
}

// drawLastShotMarkers(shot, color): the marks of a finished shot: highest point and landing x.
function drawLastShotMarkers(shot, color) {
  if (shot.highestY > shot.launchHeight + 0.3) {
    drawMarker(shot.highestPointX, shot.highestY, `${translate('h máx', 'max h')} = ${formatFixed(shot.highestY, 1)} m`, color, 'above', 'shotMaxHeight');
  }
  drawMarker(shot.x, Math.max(0, shot.y), `x = ${formatFixed(shot.x, 1)} m`, color, 'below', 'shotX');
}

// drawPlayScene(): draws the whole scene while playing.
function drawPlayScene() {
  const level = gameState.level;
  const hasVectors = levelHasVectors(level);
  // vector levels may hide the grid and the scale until the puzzle is solved
  if (hasVectors) {
    scaleVisibility = {
      gridLines: level.showGrid || gameState.answerRevealed,
      numbers: !level.vectorPuzzle.hideScale || gameState.answerRevealed,
    };
  } else {
    scaleVisibility = { gridLines: level.showGrid, numbers: true };
  }
  setSceneView(level.worldWidth, gameState.viewTop, level.type === 'displacement');
  drawGrid();
  drawGround(gameState.terrain, level.worldWidth);

  if (hasVectors) {
    const puzzle = level.vectorPuzzle;
    const resultant = gameState.resultant;
    const startText = `(${formatFixed(puzzle.startX, 1)}, ${formatFixed(puzzle.startY, 1)})`;
    if (!gameState.answerRevealed) {
      if (puzzle.showPath) {
        // the vectors with the data the player is allowed to see
        const labelTexts = [];
        for (let index = 0; index < puzzle.vectors.length; index++) {
          const vector = puzzle.vectors[index];
          labelTexts.push(buildVectorLabelText(index, vector.visibility, resultant.vectorValues[index], false, vector.kind));
        }
        let vectorsToDraw = resultant.points.length - 1;
        if (gameState.pathAnimation) {
          vectorsToDraw = gameState.pathAnimation.progress || 0;
        }
        drawVectors(resultant.points, vectorsToDraw, COLORS.vector, labelTexts);
        // R appears when the walk ends (only if something of R is shown)
        if (!gameState.pathAnimation && hasAnyShown(puzzle.resultant.visibility, RESULTANT_QUANTITIES)) {
          drawResultant(puzzle, resultant, COLORS.accentDark, buildVectorLabelText('R', puzzle.resultant.visibility, resultant.values, false), false);
        }
      } else if (gameState.piglet.hidden) {
        // without the path: a big "?" that pulses over A
        gameContext.fillStyle = COLORS.vector;
        gameContext.font = `${Math.round(Math.max(28, sceneView.scale * 2.4))}px 'Lilita One', sans-serif`;
        gameContext.textAlign = 'center';
        gameContext.textBaseline = 'bottom';
        gameContext.globalAlpha = 0.55 + 0.2 * Math.sin(gameState.time * 3);
        gameContext.fillText('?', toScreenX(puzzle.startX), toScreenY(puzzle.startY + 1.4));
        gameContext.globalAlpha = 1;
      }
      let shownStartText = '';
      if (scaleVisibility.numbers) {
        shownStartText = startText;
      }
      drawPointLabel(puzzle.startX, puzzle.startY, 'A', shownStartText, COLORS.vector);
    } else {
      // solved: every value is shown (faint while the projectile flies)
      const aiming = gameState.phase !== 'launch' || (gameState.mode === 'aiming' && !gameState.projectile);
      let labelTexts = null;
      let resultantLabel = null;
      if (aiming) {
        gameContext.globalAlpha = 0.9;
        labelTexts = [];
        for (let index = 0; index < puzzle.vectors.length; index++) {
          labelTexts.push(buildVectorLabelText(index, null, resultant.vectorValues[index], true, puzzle.vectors[index].kind));
        }
        resultantLabel = buildFullResultantLabel(resultant);
      } else {
        gameContext.globalAlpha = 0.3;
      }
      drawVectors(resultant.points, resultant.points.length - 1, COLORS.vector, labelTexts);
      if (aiming) {
        gameContext.globalAlpha = 1;
      } else {
        gameContext.globalAlpha = 0.3;
      }
      drawResultant(puzzle, resultant, COLORS.accentDark, resultantLabel, aiming);
      gameContext.globalAlpha = 1;
      drawPointLabel(puzzle.startX, puzzle.startY, 'A', startText, COLORS.vector);
      drawPointLabel(
        resultant.endPoint.x,
        resultant.endPoint.y,
        'B',
        `(${formatFixed(resultant.endPoint.x, 1)}, ${formatFixed(resultant.endPoint.y, 1)})`,
        COLORS.vector,
      );
    }
  }

  // old shot paths (the last one darker)
  for (let index = 0; index < gameState.oldShots.length; index++) {
    let kind = 'old';
    if (index === gameState.oldShots.length - 1 && !gameState.projectile) {
      kind = 'last';
    }
    drawShotPath(gameState.oldShots[index], kind);
  }
  // pieces
  for (const piece of gameState.pieces) {
    if (piece.alive && !piece.hidden) {
      drawPiece(piece);
    }
  }
  // launcher (while flying it keeps the height of the shot)
  if (level.type !== 'displacement') {
    if (gameState.mode === 'flying' && gameState.projectile) {
      drawLauncher(gameState.projectile.launchHeight);
    } else {
      drawLauncher(launcher.launchHeight);
    }
  }
  drawAim();

  const projectile = gameState.projectile;
  if (projectile) {
    drawShotPath(projectile, 'live');
    const speedY = projectile.initialSpeedY - projectile.gravity * projectile.time;
    if (!projectile.finished) {
      drawBall(projectile.x, projectile.y, projectile.speedX, speedY);
    } else {
      // after the impact the ball fades out in one second
      drawBall(projectile.x, Math.max(projectile.y, 0), projectile.speedX, speedY, Math.max(0, 1 - projectile.timeSinceFinished));
    }
    // the ball is above the top of the canvas: a small arrow shows where it is
    if (!projectile.finished && toScreenY(projectile.y) < 0) {
      const arrowX = Math.min(canvasWidth - 14, Math.max(14, toScreenX(projectile.x)));
      gameContext.fillStyle = COLORS.accent;
      gameContext.beginPath();
      gameContext.moveTo(arrowX, 6);
      gameContext.lineTo(arrowX - 8, 20);
      gameContext.lineTo(arrowX + 8, 20);
      gameContext.fill();
      gameContext.font = handwritingFont();
      gameContext.textAlign = 'center';
      gameContext.textBaseline = 'top';
      gameContext.fillText(`y = ${formatFixed(projectile.y, 1)} m`, arrowX, 22);
    }
    if (projectile.finished && projectile.hitWhat !== 'outside') {
      drawLastShotMarkers(projectile, COLORS.ink);
    }
  } else if (gameState.lastShot && gameState.mode === 'aiming' && gameState.lastShot.hitWhat !== 'outside') {
    gameContext.globalAlpha = 0.7;
    drawLastShotMarkers(gameState.lastShot, COLORS.inkSoft);
    gameContext.globalAlpha = 1;
  }
  drawParticles();
}
