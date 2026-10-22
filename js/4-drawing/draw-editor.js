/* ======================================================================
   FILE: js/4-drawing/draw-editor.js

   DRAWING THE SCENE IN THE EDITOR
   Like draw-game.js, but it also draws the handles that can be dragged:
     ● circles at the tips of the vectors and of the launcher arrow
     ◆ a diamond to rotate the selected vector
     ■ squares for point B and for the height of the launcher
   It uses the drawing functions of draw-game.js (drawGrid, drawPiece, drawArrow...).
   ====================================================================== */

// getEditorViewTop(): how high the editor scene must be to show everything.
function getEditorViewTop() {
  const draft = editorState.levelDraft;
  const launchVariables = draft.launchVariables;
  let top = 16;
  if (draft.type === 'displacement') {
    top = 5;
  }
  for (const block of draft.terrain) {
    top = Math.max(top, block.height + 3);
  }
  for (const piece of draft.pieces) {
    top = Math.max(top, piece.y + piece.height + 3);
  }
  if (draft.type !== 'displacement') {
    // the tallest possible launcher
    let launcherTop = launchVariables.launchHeight.max;
    if (launchVariables.launchHeight.locked) {
      launcherTop = launchVariables.launchHeight.start;
    }
    top = Math.max(top, launcherTop + 3);
  }
  if (levelHasVectors(draft)) {
    const points = calculateResultant(draft.vectorPuzzle).points;
    for (const point of points) {
      top = Math.max(top, point.y + 3);
    }
  }
  return top;
}

// drawHandle(pixelX, pixelY, shape, color): a handle that can be dragged.
//   shape: 'square', 'diamond' or 'circle'
function drawHandle(pixelX, pixelY, shape, color) {
  gameContext.lineWidth = 2;
  if (shape === 'square') {
    gameContext.fillStyle = color;
    gameContext.strokeStyle = '#fff';
    gameContext.beginPath();
    gameContext.rect(pixelX - 6.5, pixelY - 6.5, 13, 13);
    gameContext.fill();
    gameContext.stroke();
    return;
  }
  gameContext.fillStyle = '#fff';
  gameContext.strokeStyle = color;
  gameContext.beginPath();
  if (shape === 'diamond') {
    gameContext.moveTo(pixelX, pixelY - 8);
    gameContext.lineTo(pixelX + 8, pixelY);
    gameContext.lineTo(pixelX, pixelY + 8);
    gameContext.lineTo(pixelX - 8, pixelY);
    gameContext.closePath();
  } else {
    gameContext.arc(pixelX, pixelY, 6, 0, Math.PI * 2);
  }
  gameContext.fill();
  gameContext.stroke();
}

// drawGlowLine(startX, startY, endX, endY, color): a wide, faint line behind the selected
// vector (positions in meters).
function drawGlowLine(startX, startY, endX, endY, color) {
  gameContext.save();
  gameContext.strokeStyle = color;
  gameContext.globalAlpha = 0.2;
  gameContext.lineWidth = 12;
  gameContext.lineCap = 'round';
  gameContext.beginPath();
  gameContext.moveTo(toScreenX(startX), toScreenY(startY));
  gameContext.lineTo(toScreenX(endX), toScreenY(endY));
  gameContext.stroke();
  gameContext.restore();
}

// drawAngleArc(x, y, dx, dy, color, labelText): the arc that shows the angle of a vector
// with the horizontal, and its label "θ = 30°".
//   x, y: start of the vector (m);  dx, dy: its components (m)
function drawAngleArc(x, y, dx, dy, color, labelText) {
  if (Math.hypot(dx, dy) < 0.3) {
    return;
  }
  const centerX = toScreenX(x);
  const centerY = toScreenY(y);
  const radius = Math.max(26, Math.min(60, 1.8 * sceneView.scale));
  // the reference: the horizontal to the right (0) or to the left (π)
  let referenceAngle = Math.PI;
  if (dx >= -0.05) {
    referenceAngle = 0;
  }
  const vectorAngle = Math.atan2(-dy, dx); // on screen, y is upside down
  let difference = vectorAngle - referenceAngle;
  // keep the difference between −π and π (the short way around)
  while (difference > Math.PI) {
    difference -= 2 * Math.PI;
  }
  while (difference <= -Math.PI) {
    difference += 2 * Math.PI;
  }
  // the dashed horizontal reference line
  gameContext.strokeStyle = color;
  gameContext.lineWidth = 1.2;
  gameContext.setLineDash([4, 4]);
  gameContext.beginPath();
  gameContext.moveTo(centerX, centerY);
  gameContext.lineTo(centerX + Math.cos(referenceAngle) * radius * 1.5, centerY);
  gameContext.stroke();
  gameContext.setLineDash([]);
  // the arc
  gameContext.lineWidth = 1.8;
  gameContext.beginPath();
  gameContext.arc(centerX, centerY, radius, referenceAngle, referenceAngle + difference, difference < 0);
  gameContext.stroke();
  // label candidates along the arc (middle, further out, and towards both ends)
  const middleAngle = referenceAngle + difference / 2;
  const options = [
    { angle: middleAngle, distance: 16 },
    { angle: middleAngle, distance: 34 },
    { angle: referenceAngle + difference * 0.25, distance: 18 },
    { angle: referenceAngle + difference * 0.75, distance: 18 },
  ];
  const candidates = [];
  for (const option of options) {
    let horizontal = 'center';
    if (Math.cos(option.angle) < -0.3) {
      horizontal = 'right';
    } else if (Math.cos(option.angle) > 0.3) {
      horizontal = 'left';
    }
    candidates.push({
      x: centerX + Math.cos(option.angle) * (radius + option.distance),
      y: centerY + Math.sin(option.angle) * (radius + option.distance),
      horizontal: horizontal,
      vertical: 'middle',
    });
  }
  queueLabel({ key: 'angle', text: labelText, color: color, style: 'box', priority: 9, candidates: candidates });
}

// drawEditorScene(): draws the whole scene of the editor.
function drawEditorScene() {
  const draft = editorState.levelDraft;
  const launchVariables = draft.launchVariables;
  const hasVectors = levelHasVectors(draft);
  scaleVisibility = { gridLines: editorState.showGrid, numbers: true };
  // while dragging, the zoom does not change (otherwise the scene would jump)
  if (!editorState.dragging) {
    setSceneView(draft.worldWidth, getEditorViewTop(), draft.type === 'displacement');
  }
  drawGrid();
  if (draft.type === 'displacement') {
    drawGround([], draft.worldWidth);
  } else {
    drawGround(draft.terrain, draft.worldWidth);
  }

  // the end of the world: a dashed vertical line with a text
  gameContext.strokeStyle = COLORS.accentDark;
  gameContext.setLineDash([6, 5]);
  gameContext.lineWidth = 1.5;
  gameContext.beginPath();
  gameContext.moveTo(toScreenX(draft.worldWidth), 0);
  gameContext.lineTo(toScreenX(draft.worldWidth), toScreenY(0));
  gameContext.stroke();
  gameContext.setLineDash([]);
  gameContext.save();
  gameContext.translate(toScreenX(draft.worldWidth) - 6, 40);
  gameContext.rotate(-Math.PI / 2);
  gameContext.fillStyle = COLORS.accentDark;
  gameContext.font = handwritingFont(0.9);
  gameContext.textAlign = 'right';
  gameContext.textBaseline = 'bottom';
  gameContext.fillText(`${translate('fin del mundo', 'end of world')} · ${draft.worldWidth} m`, 0, 0);
  gameContext.restore();

  // the allowed heights of the launcher (a faint band)
  const height = launchVariables.launchHeight;
  if (draft.type !== 'displacement' && !height.locked && height.max > height.min) {
    gameContext.fillStyle = COLORS.accent;
    gameContext.globalAlpha = 0.14;
    gameContext.fillRect(toScreenX(-0.9), toScreenY(height.max), 1.8 * sceneView.scale, (height.max - height.min) * sceneView.scale);
    gameContext.globalAlpha = 1;
    gameContext.strokeStyle = COLORS.accent;
    gameContext.lineWidth = 1;
    gameContext.setLineDash([3, 3]);
    gameContext.strokeRect(toScreenX(-0.9), toScreenY(height.max), 1.8 * sceneView.scale, (height.max - height.min) * sceneView.scale);
    gameContext.setLineDash([]);
  }

  if (hasVectors) {
    const puzzle = draft.vectorPuzzle;
    const resultant = calculateResultant(puzzle);
    const points = resultant.points;
    const selection = editorState.selection;
    let selectedVector = -1;
    if (selection && selection.type === 'vector' && points[selection.index + 1]) {
      selectedVector = selection.index;
    }
    const resultantSelected = selection && selection.type === 'resultant';
    // pillars under A and (dashed) under B
    if (puzzle.startY > 0.05) {
      drawTerrainBlock({ x: puzzle.startX - 0.8, width: 1.6, height: puzzle.startY });
    }
    if (resultant.endPoint.y > 0.05) {
      drawTerrainBlock({ x: resultant.endPoint.x - 0.8, width: 1.6, height: resultant.endPoint.y }, 0.8, true);
    }
    if (selectedVector >= 0) {
      drawGlowLine(points[selectedVector].x, points[selectedVector].y, points[selectedVector + 1].x, points[selectedVector + 1].y, COLORS.vector);
    }
    if (resultantSelected) {
      drawGlowLine(puzzle.startX, puzzle.startY, resultant.endPoint.x, resultant.endPoint.y, COLORS.accentDark);
    }
    const labelTexts = [];
    for (let index = 0; index < puzzle.vectors.length; index++) {
      labelTexts.push(buildVectorLabelText(index, null, resultant.vectorValues[index], true, puzzle.vectors[index].kind));
    }
    drawVectors(points, points.length - 1, COLORS.vector, labelTexts);
    drawResultant(puzzle, resultant, COLORS.accentDark, buildFullResultantLabel(resultant), false);
    // a faint piglet at B and the real one at A
    drawPiece({ kind: 'target', x: resultant.endPoint.x - 0.6, y: resultant.endPoint.y, width: 1.2, height: 1.2 }, 0.45);
    drawPiece({ kind: 'target', x: puzzle.startX - 0.6, y: puzzle.startY, width: 1.2, height: 1.2 });
    drawPointLabel(puzzle.startX, puzzle.startY, 'A', `(${formatFixed(puzzle.startX, 1)}, ${formatFixed(puzzle.startY, 1)})`, COLORS.vector);
    drawPointLabel(
      resultant.endPoint.x,
      resultant.endPoint.y,
      'B',
      `(${formatFixed(resultant.endPoint.x, 1)}, ${formatFixed(resultant.endPoint.y, 1)})`,
      COLORS.accentDark,
    );
    if (selectedVector >= 0) {
      const start = points[selectedVector];
      const end = points[selectedVector + 1];
      const values = resultant.vectorValues[selectedVector];
      drawAngleArc(start.x, start.y, values.dx, values.dy, COLORS.vector, `θ = ${formatNice(values.angle)}°`);
      drawHandle(toScreenX(start.x + (end.x - start.x) * 0.62), toScreenY(start.y + (end.y - start.y) * 0.62), 'diamond', COLORS.vector);
    }
    if (resultantSelected) {
      drawAngleArc(puzzle.startX, puzzle.startY, resultant.dx, resultant.dy, COLORS.accentDark, `θ = ${formatNice(resultant.angle)}°`);
    }
    // circles at the tips (except the last one, which is B)
    for (let index = 1; index < points.length - 1; index++) {
      drawHandle(toScreenX(points[index].x), toScreenY(points[index].y), 'circle', COLORS.vector);
    }
    drawHandle(toScreenX(resultant.endPoint.x), toScreenY(resultant.endPoint.y), 'square', COLORS.accentDark);
  }
  if (draft.type === 'displacement') {
    return;
  }

  for (const piece of draft.pieces) {
    drawPiece(piece);
  }
  drawLauncher(launchVariables.launchHeight.start);
  const originX = toScreenX(0);
  const originY = toScreenY(launchVariables.launchHeight.start);
  const fanRadius = 4.5 * sceneView.scale;
  // the allowed angles (a faint fan)
  const angle = launchVariables.launchAngle;
  if (!angle.locked) {
    const highestAngle = (-angle.max * Math.PI) / 180;
    const lowestAngle = (-angle.min * Math.PI) / 180;
    gameContext.fillStyle = COLORS.accent;
    gameContext.globalAlpha = 0.1;
    gameContext.beginPath();
    gameContext.moveTo(originX, originY);
    gameContext.arc(originX, originY, fanRadius, highestAngle, lowestAngle);
    gameContext.closePath();
    gameContext.fill();
    gameContext.globalAlpha = 1;
    gameContext.strokeStyle = COLORS.accent;
    gameContext.lineWidth = 1;
    const edgeAngles = [highestAngle, lowestAngle];
    for (const edgeAngle of edgeAngles) {
      gameContext.beginPath();
      gameContext.moveTo(originX, originY);
      gameContext.lineTo(originX + Math.cos(edgeAngle) * fanRadius, originY + Math.sin(edgeAngle) * fanRadius);
      gameContext.stroke();
    }
    gameContext.fillStyle = COLORS.accentDark;
    gameContext.font = handwritingFont(0.9);
    gameContext.textAlign = 'left';
    gameContext.textBaseline = 'bottom';
    gameContext.fillText(
      `θ: ${angle.min}° ${translate('a', 'to')} ${angle.max}°`,
      originX + Math.cos(highestAngle) * fanRadius + 4,
      originY + Math.sin(highestAngle) * fanRadius,
    );
  }
  // the path with the starting values, and the launcher arrow
  drawDashedPath(
    launchVariables.launchSpeed.start,
    launchVariables.launchAngle.start,
    launchVariables.launchHeight.start,
    launchVariables.gravity.start,
    draft.worldWidth,
    COLORS.inkSoft,
    1.5,
  );
  const arrowTip = getLauncherArrowTip(launchVariables);
  drawArrow(originX, originY, arrowTip.x, arrowTip.y, COLORS.accentDark);
  gameContext.font = handwritingFont();
  gameContext.textAlign = 'left';
  gameContext.textBaseline = 'bottom';
  gameContext.fillStyle = COLORS.accentDark;
  const arrowText = `v₀ = ${formatNice(launchVariables.launchSpeed.start)} m/s · θ = ${formatNice(launchVariables.launchAngle.start)}°`;
  gameContext.fillText(arrowText, arrowTip.x + 8, arrowTip.y - 6);
  addLabelObstacle(arrowTip.x + 8, arrowTip.y - 28, gameContext.measureText(arrowText).width, 22);
  drawBall(0, launchVariables.launchHeight.start, 1, 0);
  if (editorState.selection && editorState.selection.type === 'launcher') {
    gameContext.strokeStyle = COLORS.accentDark;
    gameContext.lineWidth = 2;
    gameContext.setLineDash([5, 4]);
    gameContext.strokeRect(
      toScreenX(-0.9),
      toScreenY(launchVariables.launchHeight.start + 1.3),
      1.8 * sceneView.scale,
      (launchVariables.launchHeight.start + 1.3) * sceneView.scale,
    );
    gameContext.setLineDash([]);
  }
  drawHandle(arrowTip.x, arrowTip.y, 'circle', COLORS.accentDark);
  drawHandle(toScreenX(-0.6), originY, 'square', COLORS.inkSoft);

  // the preview of the piece that would be placed (semi-transparent)
  const pointer = editorState.pointerPosition;
  const tool = editorState.selectedTool;
  const isPieceTool = tool !== 'select' && tool !== 'erase' && tool !== 'start';
  if (pointer && !editorState.dragging && isPieceTool) {
    const preview = createPiecePreview(pointer, tool);
    if (preview.type === 'terrain') {
      drawTerrainBlock(preview.item, 0.45);
    } else {
      drawPiece(preview.item, 0.5);
    }
  }
  // outline of the piece under the mouse
  if (pointer && !editorState.dragging && (tool === 'select' || tool === 'erase')) {
    const found = findPieceAt(pointer);
    if (found && (!editorState.selection || found.item !== editorState.selection.item)) {
      if (tool === 'erase') {
        drawSelectionOutline(found, COLORS.accent, false);
      } else {
        drawSelectionOutline(found, COLORS.ink, false);
      }
    }
  }
  if (editorState.selection && editorState.selection.item) {
    drawSelectionOutline(editorState.selection, COLORS.accent, true);
  }
}

// drawSelectionOutline(found, color, withHandle): a dashed rectangle around a piece, with
// the small square to resize it.
function drawSelectionOutline(found, color, withHandle) {
  const item = found.item;
  const isTerrain = found.type === 'terrain';
  let top = item.y + item.height;
  if (isTerrain) {
    top = item.height;
  }
  const x = toScreenX(item.x);
  const y = toScreenY(top);
  const width = item.width * sceneView.scale;
  const height = item.height * sceneView.scale;
  gameContext.strokeStyle = color;
  gameContext.lineWidth = 2;
  gameContext.setLineDash([5, 4]);
  gameContext.strokeRect(x - 3, y - 3, width + 6, height + 6);
  gameContext.setLineDash([]);
  if (withHandle && item.kind !== 'target') {
    gameContext.fillStyle = COLORS.accent;
    gameContext.strokeStyle = '#fff';
    gameContext.lineWidth = 2;
    gameContext.beginPath();
    gameContext.rect(x + width - 6, y - 6, 12, 12);
    gameContext.fill();
    gameContext.stroke();
  }
}
