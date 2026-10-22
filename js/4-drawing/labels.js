/* ======================================================================
   FILE: js/4-drawing/labels.js

   LABELS THAT DO NOT OVERLAP
   Instead of drawing each label as soon as it is asked for, the labels are
   collected in a list during the frame and placed all together at the end:
     1. They are sorted by priority (the most important first).
     2. Each one tries several possible positions ("candidates") around its
        vector or point.
     3. The first position that does not overlap another label is used.
     4. If none fits, the label is hidden and a small "i" circle is drawn instead.
        Moving the mouse over the vector (or touching it on a phone) shows it.
   ====================================================================== */

// labelLayout: the labels of the current frame and the mouse / touch state.
//   queued:     labels asked for during this frame
//   obstacles:  rectangles of texts drawn directly (labels must avoid them)
//   hitAreas:   where each label's vector or point is (to detect the mouse over it)
//   hoveredKey: key of the label under the mouse
//   pinnedKey:  key of the label touched on a touch screen
//   hiddenKeys: keys of the labels that did not fit in the last frame
const labelLayout = { queued: [], obstacles: [], hitAreas: [], hoveredKey: null, pinnedKey: null, hiddenKeys: [] };

// startLabelFrame(): empties the lists at the beginning of each frame (called by the
// main loop in 7-start.js, before drawing).
function startLabelFrame() {
  labelLayout.queued = [];
  labelLayout.obstacles = [];
  labelLayout.hitAreas = [];
}

// getLabelFontSize(style): the font size (pixels) of each label style. It grows with the zoom.
//   'box'   = text in a box with a border (vectors)
//   'point' = handwritten text with a background (points A and B)
//   'hand'  = handwritten text without background (markers like "x = 12 m")
function getLabelFontSize(style) {
  if (style === 'box') {
    return Math.round(Math.max(12, Math.min(15, sceneView.scale * 0.62)));
  }
  let sizeFactor = 1;
  if (style === 'point') {
    sizeFactor = 1.05;
  }
  return Math.round(Math.max(12, Math.min(19, sceneView.scale * 0.75)) * sizeFactor);
}

// getLabelFont(style): the full CSS font of each label style.
function getLabelFont(style) {
  if (style === 'box') {
    return `600 ${getLabelFontSize(style)}px 'IBM Plex Sans', sans-serif`;
  }
  return `${getLabelFontSize(style)}px Kalam, 'Comic Sans MS', cursive`;
}

// LABEL_PADDING: empty space (pixels) between the text and the edge of its rectangle.
const LABEL_PADDING = {
  box: { x: 4, y: 3 },
  point: { x: 3, y: 2 },
  hand: { x: 2, y: 1 },
};

// queueLabel(label): asks for a label. The label object has:
//   key:        unique name (to show it on mouse over); optional
//   text, color, style ('box' | 'point' | 'hand'), priority (bigger = placed first)
//   candidates: list of possible positions { x, y, horizontal, vertical }
//               horizontal: 'left' | 'center' | 'right'  (which side of the text is at x)
//               vertical:   'top' | 'middle' | 'bottom'  (which side of the text is at y)
//   segment:    { startX, startY, endX, endY } of its vector, in pixels; or
//   point:      { x, y } of its point, in pixels (so it can be found with the mouse)
function queueLabel(label) {
  gameContext.font = getLabelFont(label.style);
  const textWidth = gameContext.measureText(label.text).width;
  const fontSize = getLabelFontSize(label.style);
  const padding = LABEL_PADDING[label.style];
  label.width = textWidth + padding.x * 2;
  label.height = fontSize + padding.y * 2;
  label.alpha = gameContext.globalAlpha; // labels keep the transparency of the moment
  // the rectangle of each candidate position, always inside the canvas
  label.rectangles = [];
  for (const candidate of label.candidates) {
    let x = candidate.x;
    if (candidate.horizontal === 'center') {
      x = candidate.x - label.width / 2;
    } else if (candidate.horizontal === 'right') {
      x = candidate.x - label.width;
    }
    let y = candidate.y;
    if (candidate.vertical === 'middle') {
      y = candidate.y - label.height / 2;
    } else if (candidate.vertical === 'bottom') {
      y = candidate.y - label.height;
    }
    x = clampNumber(x, 2, canvasWidth - label.width - 2);
    y = clampNumber(y, 2, canvasHeight - label.height - 2);
    label.rectangles.push({ x: x, y: y, width: label.width, height: label.height });
  }
  labelLayout.queued.push(label);
  if (label.segment || label.point) {
    labelLayout.hitAreas.push({ key: label.key, segment: label.segment, point: label.point });
  }
}

// addLabelObstacle(x, y, width, height): marks the space of a text drawn directly,
// so the labels avoid it.
function addLabelObstacle(x, y, width, height) {
  labelLayout.obstacles.push({ x: x, y: y, width: width, height: height });
}

// rectanglesOverlap(first, second): true if two rectangles touch (with a margin of 2 px).
function rectanglesOverlap(first, second) {
  const margin = 2;
  return (
    first.x < second.x + second.width + margin &&
    second.x < first.x + first.width + margin &&
    first.y < second.y + second.height + margin &&
    second.y < first.y + first.height + margin
  );
}

// findFreeRectangle(label, placedRectangles): the first candidate rectangle of the label
// that does not overlap any placed rectangle, or null.
function findFreeRectangle(label, placedRectangles) {
  for (const rectangle of label.rectangles) {
    let overlaps = false;
    for (const placed of placedRectangles) {
      if (rectanglesOverlap(rectangle, placed)) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) {
      return rectangle;
    }
  }
  return null;
}

// getLabelMiddle(label): the middle of the label's vector, or its point (pixels).
function getLabelMiddle(label) {
  if (label.segment) {
    return { x: (label.segment.startX + label.segment.endX) / 2, y: (label.segment.startY + label.segment.endY) / 2 };
  }
  return { x: label.point.x, y: label.point.y };
}

// placeAndDrawLabels(): places every label of the frame and draws them (called by the main
// loop after drawing the scene).
function placeAndDrawLabels() {
  const placedRectangles = labelLayout.obstacles.slice();
  // the label under the mouse (or touched) is drawn at the end, over everything
  let activeKey = labelLayout.hoveredKey;
  if (labelLayout.pinnedKey) {
    activeKey = labelLayout.pinnedKey;
  }
  // sort by priority: the biggest first (labels with the same priority keep their order)
  const sortedLabels = labelLayout.queued.slice();
  sortedLabels.sort(function (first, second) {
    return (second.priority || 0) - (first.priority || 0);
  });

  const labelsToDraw = [];
  const hiddenLabels = [];
  const activeLabels = [];
  for (const label of sortedLabels) {
    if (label.key && label.key === activeKey) {
      activeLabels.push(label);
      continue;
    }
    const rectangle = findFreeRectangle(label, placedRectangles);
    if (rectangle) {
      placedRectangles.push(rectangle);
      labelsToDraw.push({ label: label, rectangle: rectangle });
    } else {
      hiddenLabels.push(label);
    }
  }
  labelLayout.hiddenKeys = [];
  for (const label of hiddenLabels) {
    if (label.key) {
      labelLayout.hiddenKeys.push(label.key);
    }
  }

  // 1) the labels that fit
  for (const item of labelsToDraw) {
    paintLabel(item.label, item.rectangle, false);
  }
  // 2) a small "i" where a label was hidden
  for (const label of hiddenLabels) {
    if (!label.key || (!label.segment && !label.point)) {
      continue;
    }
    const middle = getLabelMiddle(label);
    gameContext.globalAlpha = label.alpha;
    gameContext.fillStyle = '#fff';
    gameContext.strokeStyle = label.color;
    gameContext.lineWidth = 1.5;
    gameContext.beginPath();
    gameContext.arc(middle.x, middle.y, 7, 0, Math.PI * 2);
    gameContext.fill();
    gameContext.stroke();
    gameContext.fillStyle = label.color;
    gameContext.font = "700 10px 'IBM Plex Sans', sans-serif";
    gameContext.textAlign = 'center';
    gameContext.textBaseline = 'middle';
    gameContext.fillText('i', middle.x, middle.y + 0.5);
    gameContext.globalAlpha = 1;
  }
  // 3) the active label: its vector glows and the label is drawn in the best free place
  for (const label of activeLabels) {
    if (label.segment) {
      gameContext.save();
      gameContext.strokeStyle = label.color;
      gameContext.globalAlpha = 0.22;
      gameContext.lineWidth = 12;
      gameContext.lineCap = 'round';
      gameContext.beginPath();
      gameContext.moveTo(label.segment.startX, label.segment.startY);
      gameContext.lineTo(label.segment.endX, label.segment.endY);
      gameContext.stroke();
      gameContext.restore();
    }
    let rectangle = findFreeRectangle(label, placedRectangles);
    if (!rectangle) {
      rectangle = label.rectangles[0];
    }
    label.alpha = 1;
    paintLabel(label, rectangle, true);
  }
}

// paintLabel(label, rectangle, highlighted): draws one label in its rectangle.
//   highlighted: true for the active label (thicker border, always with background)
function paintLabel(label, rectangle, highlighted) {
  const padding = LABEL_PADDING[label.style];
  gameContext.globalAlpha = label.alpha;
  gameContext.font = getLabelFont(label.style);
  gameContext.textAlign = 'left';
  gameContext.textBaseline = 'top';
  // background (not for 'hand' labels, unless highlighted)
  if (label.style !== 'hand' || highlighted) {
    gameContext.fillStyle = COLORS.paper;
    if (label.style === 'point') {
      gameContext.globalAlpha = label.alpha * 0.85;
    } else {
      gameContext.globalAlpha = label.alpha * 0.92;
    }
    gameContext.fillRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
    gameContext.globalAlpha = label.alpha;
  }
  // border
  if (label.style === 'box' || highlighted) {
    gameContext.strokeStyle = label.color;
    gameContext.lineWidth = 1;
    if (highlighted) {
      gameContext.lineWidth = 2;
    }
    gameContext.strokeRect(rectangle.x + 0.5, rectangle.y + 0.5, rectangle.width - 1, rectangle.height - 1);
  }
  // text
  gameContext.fillStyle = label.color;
  let textOffsetY = 1;
  if (label.style === 'box') {
    textOffsetY = 0;
  }
  gameContext.fillText(label.text, rectangle.x + padding.x, rectangle.y + padding.y + textOffsetY);
  gameContext.globalAlpha = 1;
}

// createSegmentCandidates(startX, startY, endX, endY, preferredSide, gap): the candidate
// positions for the label of a vector (or R): on both sides, at two distances and at
// three points along the vector.
//   preferredSide: 1 = prefers above the vector, -1 = prefers below
//   gap:           distance in pixels from the vector
function createSegmentCandidates(startX, startY, endX, endY, preferredSide, gap) {
  // normal: a direction perpendicular to the vector, with length 1
  let normalX = -(endY - startY);
  let normalY = endX - startX;
  const normalLength = Math.hypot(normalX, normalY) || 1;
  normalX = normalX / normalLength;
  normalY = normalY / normalLength;
  // on screen, y grows downwards: "above" means a negative normalY
  if ((preferredSide > 0 && normalY > 0) || (preferredSide < 0 && normalY < 0)) {
    normalX = -normalX;
    normalY = -normalY;
  }
  const candidates = [];
  const sides = [1, -1];
  const positionsAlong = [0.5, 0.32, 0.68];
  const distances = [gap, gap + 16];
  for (const side of sides) {
    for (const along of positionsAlong) {
      for (const distance of distances) {
        const middleX = startX + (endX - startX) * along;
        const middleY = startY + (endY - startY) * along;
        const directionX = normalX * side;
        const directionY = normalY * side;
        let horizontal = 'center';
        if (directionX < -0.3) {
          horizontal = 'right';
        } else if (directionX > 0.3) {
          horizontal = 'left';
        }
        let vertical = 'middle';
        if (directionY < -0.5) {
          vertical = 'bottom';
        } else if (directionY > 0.5) {
          vertical = 'top';
        }
        candidates.push({ x: middleX + directionX * distance, y: middleY + directionY * distance, horizontal: horizontal, vertical: vertical });
      }
    }
  }
  return candidates;
}

// findLabelAt(pixelX, pixelY): the key of the label whose vector (less than 14 px away) or
// point (less than 16 px away) is under that place of the screen. null if none.
function findLabelAt(pixelX, pixelY) {
  let bestKey = null;
  let bestDistance = 1e9;
  for (const area of labelLayout.hitAreas) {
    let distance;
    let maximumDistance;
    if (area.segment) {
      distance = distanceToSegment(pixelX, pixelY, area.segment.startX, area.segment.startY, area.segment.endX, area.segment.endY);
      maximumDistance = 14;
    } else {
      distance = Math.hypot(pixelX - area.point.x, pixelY - area.point.y);
      maximumDistance = 16;
    }
    if (distance < maximumDistance && distance < bestDistance) {
      bestDistance = distance;
      bestKey = area.key;
    }
  }
  return bestKey;
}

// Mouse: the label appears while the mouse is over its vector.
gameCanvas.addEventListener('pointermove', function (event) {
  if (event.pointerType !== 'mouse') {
    return;
  }
  const canvasBox = gameCanvas.getBoundingClientRect();
  labelLayout.hoveredKey = findLabelAt(event.clientX - canvasBox.left, event.clientY - canvasBox.top);
});
gameCanvas.addEventListener('pointerleave', function () {
  labelLayout.hoveredKey = null;
});
// Touch screen: touching a vector shows its label; touching it again hides it.
gameCanvas.addEventListener('pointerdown', function (event) {
  if (event.pointerType === 'mouse') {
    return;
  }
  const canvasBox = gameCanvas.getBoundingClientRect();
  const key = findLabelAt(event.clientX - canvasBox.left, event.clientY - canvasBox.top);
  if (key && key !== labelLayout.pinnedKey) {
    labelLayout.pinnedKey = key;
  } else {
    labelLayout.pinnedKey = null;
  }
});
