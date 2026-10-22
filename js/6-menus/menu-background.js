/* ======================================================================
   FILE: js/6-menus/menu-background.js

   THE ANIMATED BACKGROUND OF THE MENUS (an engineering blueprint)
   A launch repeats every 7 seconds: the dotted path grows, the projectile flies,
   the piglet jumps when it is hit; in the top right corner three vectors and
   their resultant are drawn one after another.
   The animation can be turned off in Settings (then a still frame is drawn).
   ====================================================================== */

// menuBackgroundCanvas: the canvas behind the menus; menuBackgroundContext: its "pen".
const menuBackgroundCanvas = getElement('menuBackgroundCanvas');
const menuBackgroundContext = menuBackgroundCanvas.getContext('2d');
// menuBackgroundNeedsRedraw: true when the still background must be drawn again.
let menuBackgroundNeedsRedraw = true;
let menuBackgroundWidth = 0;
let menuBackgroundHeight = 0;
let menuBackgroundPixelRatio = 1;
// menuBackgroundTime: seconds of animation shown so far.
let menuBackgroundTime = 0;

// resizeMenuBackground(): adapts the canvas to the size of the window.
function resizeMenuBackground() {
  menuBackgroundPixelRatio = Math.min(2, window.devicePixelRatio || 1);
  menuBackgroundWidth = window.innerWidth;
  menuBackgroundHeight = window.innerHeight;
  menuBackgroundCanvas.width = Math.round(menuBackgroundWidth * menuBackgroundPixelRatio);
  menuBackgroundCanvas.height = Math.round(menuBackgroundHeight * menuBackgroundPixelRatio);
  menuBackgroundNeedsRedraw = true;
}
window.addEventListener('resize', function () {
  resizeMenuBackground();
});
resizeMenuBackground();

// drawMenuBackground(time): draws the whole background for that moment (seconds).
function drawMenuBackground(time) {
  const width = menuBackgroundWidth;
  const height = menuBackgroundHeight;
  const context = menuBackgroundContext;
  const lineColor = COLORS.blueprintLine;
  const gold = COLORS.gold;
  context.setTransform(menuBackgroundPixelRatio, 0, 0, menuBackgroundPixelRatio, 0, 0);
  context.fillStyle = COLORS.blueprint;
  context.fillRect(0, 0, width, height);
  // a soft light in the middle and darker corners (radial gradient)
  const gradient = context.createRadialGradient(width / 2, height * 0.45, Math.min(width, height) * 0.2, width / 2, height / 2, Math.max(width, height) * 0.75);
  gradient.addColorStop(0, 'rgba(40,80,150,.35)');
  gradient.addColorStop(1, 'rgba(0,0,0,.35)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  // the grid: small squares (24 px) and big squares (120 px)
  context.strokeStyle = lineColor;
  context.lineWidth = 1;
  const gridLevels = [
    { step: 24, alpha: 0.06 },
    { step: 120, alpha: 0.14 },
  ];
  for (const gridLevel of gridLevels) {
    context.globalAlpha = gridLevel.alpha;
    context.beginPath();
    for (let x = 0.5; x < width; x += gridLevel.step) {
      context.moveTo(x, 0);
      context.lineTo(x, height);
    }
    for (let y = 0.5; y < height; y += gridLevel.step) {
      context.moveTo(0, y);
      context.lineTo(width, y);
    }
    context.stroke();
  }
  context.globalAlpha = 1;
  // the frame of the blueprint
  context.globalAlpha = 0.35;
  context.strokeRect(10.5, 10.5, width - 21, height - 21);
  context.globalAlpha = 1;

  const unit = Math.min(width, height * 1.4) / 900; // general scale of the drawing
  const groundY = height * 0.86;
  const startX = width * 0.09;
  const endX = width * 0.86;
  // monospaceFont(size): the font of the texts, scaled
  function monospaceFont(size) {
    return `${Math.round(Math.max(10, size * unit))}px 'IBM Plex Mono', monospace`;
  }
  // the ground with diagonal lines
  context.strokeStyle = lineColor;
  context.globalAlpha = 0.55;
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(18, groundY);
  context.lineTo(width - 18, groundY);
  context.stroke();
  context.globalAlpha = 0.25;
  context.beginPath();
  for (let x = 24; x < width - 18; x += 14) {
    context.moveTo(x, groundY);
    context.lineTo(x - 9, groundY + 9);
  }
  context.stroke();
  context.globalAlpha = 1;

  // the cycle of the launch (7 s): flight (2.6 s), the piglet jumps, pause
  const cycleLength = 7;
  const timeInCycle = time % cycleLength;
  const flightLength = 2.6;
  const flightProgress = clampNumber(timeInCycle / flightLength, 0, 1);
  const apexHeight = Math.min(height * 0.52, groundY - 60);
  const launcherHeight = 34 * unit;
  // pathX(s), pathY(s): the point of the parabola at the fraction s (0 = start, 1 = end)
  function pathX(s) {
    return startX + (endX - startX) * s;
  }
  function pathY(s) {
    return groundY - launcherHeight - 4 * apexHeight * s * (1 - s) + (launcherHeight - 10 * unit) * s;
  }
  // the launcher
  context.strokeStyle = lineColor;
  context.lineWidth = 2;
  context.globalAlpha = 0.75;
  context.strokeRect(startX - 7 * unit, groundY - launcherHeight, 14 * unit, launcherHeight);
  context.beginPath();
  context.arc(startX, groundY - launcherHeight, 9 * unit, 0, Math.PI * 2);
  context.stroke();
  // the dotted path (it grows with the flight)
  context.setLineDash([3, 9 * unit + 3]);
  context.lineCap = 'round';
  context.lineWidth = 3;
  context.strokeStyle = gold;
  context.globalAlpha = 0.85;
  context.beginPath();
  for (let index = 0; index <= 80 * flightProgress; index++) {
    const s = index / 80;
    if (index === 0) {
      context.moveTo(pathX(s), pathY(s));
    } else {
      context.lineTo(pathX(s), pathY(s));
    }
  }
  context.stroke();
  context.setLineDash([]);
  context.lineCap = 'butt';
  // the projectile
  if (flightProgress < 1) {
    context.fillStyle = gold;
    context.globalAlpha = 1;
    context.beginPath();
    context.arc(pathX(flightProgress), pathY(flightProgress), 7 * unit + 2, 0, Math.PI * 2);
    context.fill();
  }
  // the vector v₀ and the angle θ
  const launchAngle = Math.atan2(pathY(0) - pathY(0.04), pathX(0.04) - pathX(0));
  context.strokeStyle = lineColor;
  context.globalAlpha = 0.8;
  context.lineWidth = 2;
  const vectorLength = 80 * unit + 20;
  const vectorEndX = startX + vectorLength * Math.cos(launchAngle);
  const vectorEndY = groundY - launcherHeight - vectorLength * Math.sin(launchAngle);
  context.beginPath();
  context.moveTo(startX, groundY - launcherHeight);
  context.lineTo(vectorEndX, vectorEndY);
  context.stroke();
  context.beginPath();
  context.moveTo(vectorEndX, vectorEndY);
  context.lineTo(vectorEndX - 10 * Math.cos(launchAngle - 0.4), vectorEndY + 10 * Math.sin(launchAngle - 0.4));
  context.lineTo(vectorEndX - 10 * Math.cos(launchAngle + 0.4), vectorEndY + 10 * Math.sin(launchAngle + 0.4));
  context.closePath();
  context.fillStyle = lineColor;
  context.fill();
  context.setLineDash([4, 4]);
  context.beginPath();
  context.moveTo(startX, groundY - launcherHeight);
  context.lineTo(startX + vectorLength * 1.1, groundY - launcherHeight);
  context.stroke();
  context.setLineDash([]);
  context.beginPath();
  context.arc(startX, groundY - launcherHeight, vectorLength * 0.55, -launchAngle, 0);
  context.stroke();
  context.font = monospaceFont(14);
  context.fillStyle = COLORS.blueprintText;
  context.globalAlpha = 0.8;
  context.fillText('θ', startX + vectorLength * 0.62, groundY - launcherHeight - vectorLength * 0.12);
  context.fillText('v₀', vectorEndX + 6, vectorEndY - 4);
  // the marks of the maximum height and of the range
  context.strokeStyle = lineColor;
  context.globalAlpha = 0.45;
  context.lineWidth = 1;
  context.setLineDash([6, 5]);
  const apexX = pathX(0.5);
  const apexY = pathY(0.5);
  context.beginPath();
  context.moveTo(apexX, apexY);
  context.lineTo(apexX, groundY);
  context.stroke();
  context.setLineDash([]);
  context.globalAlpha = 0.7;
  context.fillText(translate('h máx', 'max h'), apexX + 8, (apexY + groundY) / 2);
  const rangeY = groundY + 26 * unit + 8;
  context.globalAlpha = 0.55;
  context.beginPath();
  context.moveTo(startX, rangeY);
  context.lineTo(endX, rangeY);
  const rangeEnds = [startX, endX];
  for (const x of rangeEnds) {
    context.moveTo(x, rangeY - 6);
    context.lineTo(x, rangeY + 6);
  }
  context.stroke();
  context.globalAlpha = 0.7;
  context.textAlign = 'center';
  context.fillText('x = v₀ cos θ · t', (startX + endX) / 2, rangeY - 6);
  context.textAlign = 'left';

  // the piglet (it jumps when it is hit, and bounces a little while waiting)
  const wasHit = timeInCycle > flightLength;
  let jump;
  if (wasHit) {
    const timeSinceHit = timeInCycle - flightLength;
    jump = Math.max(0, Math.sin(Math.min(1, timeSinceHit / 0.5) * Math.PI)) * 30 * unit;
    if (timeInCycle < flightLength + 2) {
      jump += Math.abs(Math.sin(timeSinceHit * 9)) * 6 * unit * Math.max(0, 1 - timeSinceHit / 2);
    }
  } else {
    jump = Math.abs(Math.sin(time * 2.2)) * 3 * unit;
  }
  const pigletX = endX;
  const pigletY = groundY - jump;
  const pigletRadius = 15 * unit + 4;
  context.globalAlpha = 1;
  context.lineWidth = 2.5;
  context.fillStyle = 'rgba(124,196,107,.9)';
  context.strokeStyle = '#d7f5cf';
  context.beginPath();
  context.ellipse(pigletX, pigletY - pigletRadius * 0.9, pigletRadius * 1.1, pigletRadius * 0.9, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = '#10213d';
  context.beginPath();
  context.arc(pigletX - pigletRadius * 0.38, pigletY - pigletRadius * 1.05, pigletRadius * 0.16, 0, Math.PI * 2);
  context.arc(pigletX + pigletRadius * 0.38, pigletY - pigletRadius * 1.05, pigletRadius * 0.16, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#a7db97';
  context.beginPath();
  context.ellipse(pigletX, pigletY - pigletRadius * 0.62, pigletRadius * 0.36, pigletRadius * 0.24, 0, 0, Math.PI * 2);
  context.fill();
  // the flash of the impact (8 lines around the piglet)
  if (wasHit && timeInCycle < flightLength + 0.7) {
    const flashProgress = (timeInCycle - flightLength) / 0.7;
    context.strokeStyle = gold;
    context.globalAlpha = 1 - flashProgress;
    context.lineWidth = 2;
    for (let index = 0; index < 8; index++) {
      const angle = (index * Math.PI) / 4;
      const innerRadius = pigletRadius * (1.3 + flashProgress);
      const outerRadius = pigletRadius * (1.8 + flashProgress * 1.6);
      context.beginPath();
      context.moveTo(pigletX + Math.cos(angle) * innerRadius, pigletY - pigletRadius * 0.9 + Math.sin(angle) * innerRadius);
      context.lineTo(pigletX + Math.cos(angle) * outerRadius, pigletY - pigletRadius * 0.9 + Math.sin(angle) * outerRadius);
      context.stroke();
    }
  }

  // the vectors that are drawn one after another (top right), every 8 s
  const vectorScale = 40 * unit + 8;
  const vectorTime = (time % 8) / 8;
  const originX = Math.min(width * 0.72, width - 3.9 * vectorScale - 30);
  const originY = Math.max(height * 0.16, 1.9 * vectorScale + 24);
  const vectors = [
    { x: 1.6, y: -0.9 },
    { x: 1.4, y: 0.5 },
    { x: 0.7, y: -1.3 },
  ];
  const subscripts = ['₁', '₂', '₃'];
  let currentX = originX;
  let currentY = originY;
  const drawingProgress = vectorTime * 4.2; // how many vectors are drawn (with R as the 4th)
  context.lineWidth = 2.2;
  context.strokeStyle = lineColor;
  context.fillStyle = lineColor;
  context.font = monospaceFont(13);
  for (let index = 0; index < vectors.length; index++) {
    const fraction = clampNumber(drawingProgress - index, 0, 1);
    if (fraction <= 0) {
      continue;
    }
    const vectorEndPointX = currentX + vectors[index].x * vectorScale * fraction;
    const vectorEndPointY = currentY + vectors[index].y * vectorScale * fraction;
    context.globalAlpha = 0.8;
    context.beginPath();
    context.moveTo(currentX, currentY);
    context.lineTo(vectorEndPointX, vectorEndPointY);
    context.stroke();
    const angle = Math.atan2(vectorEndPointY - currentY, vectorEndPointX - currentX);
    context.beginPath();
    context.moveTo(vectorEndPointX, vectorEndPointY);
    context.lineTo(vectorEndPointX - 9 * Math.cos(angle - 0.4), vectorEndPointY - 9 * Math.sin(angle - 0.4));
    context.lineTo(vectorEndPointX - 9 * Math.cos(angle + 0.4), vectorEndPointY - 9 * Math.sin(angle + 0.4));
    context.closePath();
    context.fill();
    if (fraction === 1) {
      context.globalAlpha = 0.7;
      context.fillText('V' + subscripts[index], (currentX + vectorEndPointX) / 2 + 6, (currentY + vectorEndPointY) / 2 - 6);
    }
    currentX = vectorEndPointX;
    currentY = vectorEndPointY;
  }
  // the resultant R (dashed, gold)
  const resultantFraction = clampNumber(drawingProgress - 3, 0, 1);
  if (resultantFraction > 0) {
    const resultantEndX = originX + (currentX - originX) * resultantFraction;
    const resultantEndY = originY + (currentY - originY) * resultantFraction;
    context.strokeStyle = gold;
    context.fillStyle = gold;
    context.globalAlpha = 0.9;
    context.setLineDash([7, 5]);
    context.beginPath();
    context.moveTo(originX, originY);
    context.lineTo(resultantEndX, resultantEndY);
    context.stroke();
    context.setLineDash([]);
    if (resultantFraction === 1) {
      context.fillText('R', (originX + currentX) / 2 - 4, (originY + currentY) / 2 + 18);
      context.beginPath();
      context.arc(currentX, currentY, 4, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.globalAlpha = 0.8;
  context.fillStyle = lineColor;
  context.beginPath();
  context.arc(originX, originY, 4, 0, Math.PI * 2);
  context.fill();

  // the title block of the blueprint (bottom right, only on wide screens)
  const boxWidth = Math.min(250, width * 0.42);
  const boxHeight = 46;
  const boxX = width - boxWidth - 18;
  const boxY = height - boxHeight - 18;
  if (width > 520) {
    context.globalAlpha = 0.5;
    context.strokeStyle = lineColor;
    context.lineWidth = 1;
    context.strokeRect(boxX + 0.5, boxY + 0.5, boxWidth, boxHeight);
    context.beginPath();
    context.moveTo(boxX, boxY + 22.5);
    context.lineTo(boxX + boxWidth, boxY + 22.5);
    context.moveTo(boxX + boxWidth * 0.6 + 0.5, boxY + 22);
    context.lineTo(boxX + boxWidth * 0.6 + 0.5, boxY + boxHeight);
    context.stroke();
    context.fillStyle = COLORS.blueprintText;
    context.font = "11px 'IBM Plex Mono', monospace";
    context.globalAlpha = 0.65;
    context.fillText('PARÁBOLA BRAVA · g = 9.81 m/s²', boxX + 8, boxY + 15);
    context.fillText(translate('SIN AIRE', 'NO DRAG'), boxX + 8, boxY + 38);
    context.fillText(translate('HOJA 1/1', 'SHEET 1/1'), boxX + boxWidth * 0.6 + 8, boxY + 38);
  }
  context.globalAlpha = 1;
}
