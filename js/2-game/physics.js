/* ======================================================================
   FILE: js/2-game/physics.js

   LAUNCH AND PHYSICS
   - launchProjectile: creates the projectile with the chosen v₀, θ and h₀.
   - updateProjectile: moves it with the EXACT projectile motion formulas
       x(t) = v₀ cos θ · t
       y(t) = h₀ + v₀ sin θ · t − ½ g t²
     (there is no air resistance, so the path is a perfect parabola).
   - Collisions with pieces, terrain and ground; breaking blocks; piglets.
   - Pieces that fall when what holds them breaks.
   - Particles: chips, rings and floating texts ("+500").
   ====================================================================== */

// STONE_BREAK_SPEED: speed (m/s) needed to break a stone block with one hit.
// Slower hits only crack it (a stone block survives one slow hit).
const STONE_BREAK_SPEED = 18;

// launchProjectile(): launches the projectile (button "Launch!", Enter or space).
function launchProjectile() {
  if (gameState.screen !== 'play' || gameState.phase !== 'launch' || gameState.mode !== 'aiming' || gameState.shotsLeft <= 0) {
    return;
  }
  // make sure the values respect the limits of the level
  const launchVariables = gameState.level.launchVariables;
  for (const key of LAUNCH_VARIABLE_KEYS) {
    const record = launchVariables[key];
    if (record.locked) {
      launcher[key] = record.start;
    } else {
      launcher[key] = clampNumber(launcher[key], record.min, record.max);
    }
  }
  if (launchVariables.gravity.locked) {
    currentGravity = launchVariables.gravity.start;
  }
  const angleInRadians = (launcher.launchAngle * Math.PI) / 180;

  // the projectile:
  //   time:          seconds since the launch
  //   speedX:        horizontal speed (constant)
  //   initialSpeedY: vertical speed at the start
  //   launchSpeed, launchAngle, launchHeight, gravity: the values used (for the telemetry)
  //   x, y:          current position (m)
  //   finished:      true once it hit something; timeSinceFinished counts the seconds after
  //   pathPoints:    points of its path (drawn as small dots), one every 0.05 s
  //   highestY, highestPointX: the highest point reached
  //   hitWhat:       what it hit: 'ground', 'terrain', 'piece' or 'outside'
  //   targetsBeforeShot: piglets alive before the shot (to count how many it knocked down)
  gameState.projectile = {
    time: 0,
    speedX: launcher.launchSpeed * Math.cos(angleInRadians),
    initialSpeedY: launcher.launchSpeed * Math.sin(angleInRadians),
    launchHeight: launcher.launchHeight,
    launchSpeed: launcher.launchSpeed,
    launchAngle: launcher.launchAngle,
    gravity: currentGravity,
    x: 0,
    y: launcher.launchHeight,
    finished: false,
    timeSinceFinished: 0,
    pathPoints: [{ x: 0, y: launcher.launchHeight }],
    lastPointTime: 0,
    highestY: launcher.launchHeight,
    highestPointX: 0,
    hitWhat: null,
    targetsBeforeShot: countTargetsLeft(),
  };
  gameState.shotsLeft--;
  gameState.mode = 'flying';
  if (getElement('practiceModeCheckbox').checked) {
    gameState.practiceModeUsed = true;
  }
  playLaunchSound();
  updateHud();
  updateLaunchPanel();
}

// circleTouchesRectangle(x, y, radius, rectangle): true if a circle touches a rectangle.
// It finds the point of the rectangle closest to the center of the circle and checks
// if that point is nearer than the radius.
function circleTouchesRectangle(x, y, radius, rectangle) {
  const closestX = Math.max(rectangle.x, Math.min(x, rectangle.x + rectangle.width));
  const closestY = Math.max(rectangle.y, Math.min(y, rectangle.y + rectangle.height));
  const distanceX = x - closestX;
  const distanceY = y - closestY;
  return distanceX * distanceX + distanceY * distanceY < radius * radius;
}

// findCollision(x, y): what does the projectile touch at the point (x, y)?
// Returns { type: 'piece', piece }, { type: 'terrain' }, { type: 'ground' },
// { type: 'outside' } or null if it touches nothing.
function findCollision(x, y) {
  for (const piece of gameState.pieces) {
    if (!piece.alive || piece.hidden) {
      continue;
    }
    if (piece.kind === 'target') {
      // piglets are circles of radius 0.6 m
      const distanceX = x - piece.x - 0.6;
      const distanceY = y - piece.y - 0.6;
      const touchDistance = PROJECTILE_RADIUS + 0.6;
      if (distanceX * distanceX + distanceY * distanceY < touchDistance * touchDistance) {
        return { type: 'piece', piece: piece };
      }
    } else if (circleTouchesRectangle(x, y, PROJECTILE_RADIUS, piece)) {
      return { type: 'piece', piece: piece };
    }
  }
  for (const block of gameState.terrain) {
    const blockRectangle = { x: block.x, y: 0, width: block.width, height: block.height };
    if (circleTouchesRectangle(x, y, PROJECTILE_RADIUS, blockRectangle)) {
      return { type: 'terrain' };
    }
  }
  if (y <= 0) {
    return { type: 'ground' };
  }
  if (x > gameState.level.worldWidth + 10 || x < -10) {
    return { type: 'outside' };
  }
  return null;
}

// updateProjectile(secondsPassed): moves the projectile. Called on every frame.
// Each frame is split in 12 small steps so fast projectiles do not jump over thin blocks.
function updateProjectile(secondsPassed) {
  const projectile = gameState.projectile;
  if (!projectile) {
    return;
  }
  if (projectile.finished) {
    projectile.timeSinceFinished += secondsPassed;
    return;
  }
  const stepCount = 12;
  const stepTime = secondsPassed / stepCount;
  for (let step = 0; step < stepCount; step++) {
    projectile.time += stepTime;
    const time = projectile.time;
    // the exact formulas of projectile motion
    const x = projectile.speedX * time;
    const y = projectile.launchHeight + projectile.initialSpeedY * time - 0.5 * projectile.gravity * time * time;
    projectile.x = x;
    projectile.y = y;
    if (y > projectile.highestY) {
      projectile.highestY = y;
      projectile.highestPointX = x;
    }
    // save a point of the path every 0.05 s
    if (time - projectile.lastPointTime >= 0.05) {
      projectile.pathPoints.push({ x: x, y: y });
      projectile.lastPointTime = time;
    }
    const collision = findCollision(x, y);
    if (collision) {
      handleImpact(projectile, collision);
      break;
    }
  }
}

// handleImpact(projectile, collision): what happens when the projectile hits something.
function handleImpact(projectile, collision) {
  projectile.finished = true;
  projectile.hitWhat = collision.type;
  if (collision.type === 'ground') {
    // put it exactly on the ground: the exact time when y = 0
    const speedY = projectile.initialSpeedY;
    const landingTime = (speedY + Math.sqrt(speedY * speedY + 2 * projectile.gravity * projectile.launchHeight)) / projectile.gravity;
    projectile.time = landingTime;
    projectile.x = projectile.speedX * landingTime;
    projectile.y = 0;
  }
  // speed at the moment of the impact: |v| = √(vₓ² + vᵧ²), with vᵧ = vᵧ₀ − g t
  const finalSpeedY = projectile.initialSpeedY - projectile.gravity * projectile.time;
  projectile.impactSpeed = Math.hypot(projectile.speedX, finalSpeedY);
  projectile.pathPoints.push({ x: projectile.x, y: projectile.y });

  if (collision.type === 'piece') {
    const piece = collision.piece;
    if (piece.kind === 'target') {
      knockDownTarget(piece);
    } else if (piece.kind === 'wood' || projectile.impactSpeed >= STONE_BREAK_SPEED) {
      breakBlock(piece);
    } else {
      // a slow hit on stone: it loses one point of health (it cracks)
      piece.health--;
      if (piece.health <= 0) {
        breakBlock(piece);
      } else {
        addFloatingText(projectile.x, projectile.y + 1, translate('¡crack!', 'crack!'), COLORS.stoneDark);
        playCrackSound();
      }
    }
  } else if (collision.type !== 'outside') {
    playThudSound();
  }
  if (collision.type !== 'outside') {
    makeDust(projectile.x, Math.max(projectile.y, 0));
  }
}

// addFloatingText(x, y, text, color): a text that floats up and fades out (for example "+500").
function addFloatingText(x, y, text, color) {
  gameState.particles.push({ kind: 'text', x: x, y: y, speedY: 1.4, life: 1.6, maxLife: 1.6, text: text, color: color });
}

// makeDust(x, y): small brown chips where the projectile lands.
function makeDust(x, y) {
  for (let index = 0; index < 10; index++) {
    const direction = Math.random() * Math.PI; // only upwards (0° to 180°)
    gameState.particles.push({
      kind: 'chip',
      x: x,
      y: y,
      speedX: Math.cos(direction) * 3,
      speedY: Math.sin(direction) * 3,
      life: 0.6,
      maxLife: 0.6,
      color: COLORS.earth,
      size: 0.15,
    });
  }
}

// knockDownTarget(piece): a piglet is knocked down: +500 points, sound and particles.
function knockDownTarget(piece) {
  if (!piece.alive) {
    return;
  }
  piece.alive = false;
  gameState.score += 500;
  playPopSound();
  const centerX = piece.x + 0.6;
  const centerY = piece.y + 0.6;
  gameState.particles.push({ kind: 'ring', x: centerX, y: centerY, life: 0.5, maxLife: 0.5 });
  for (let index = 0; index < 12; index++) {
    const direction = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    gameState.particles.push({
      kind: 'chip',
      x: centerX,
      y: centerY,
      speedX: Math.cos(direction) * speed,
      speedY: Math.sin(direction) * speed + 2,
      life: 1,
      maxLife: 1,
      color: COLORS.target,
      size: 0.22,
    });
  }
  addFloatingText(centerX, centerY + 1, '+500', COLORS.accent);
  updateHud();
}

// breakBlock(piece): a wood or stone block breaks: points (wood 50, stone 100),
// sound and chips.
function breakBlock(piece) {
  if (!piece.alive) {
    return;
  }
  piece.alive = false;
  let points = 50;
  let chipColor = COLORS.wood;
  if (piece.kind === 'stone') {
    points = 100;
    chipColor = COLORS.stone;
    playStoneBreakSound();
  } else {
    playWoodBreakSound();
  }
  gameState.score += points;
  // bigger blocks make more chips (at most 18)
  const chipCount = Math.min(18, Math.ceil(piece.width * piece.height * 4) + 6);
  for (let index = 0; index < chipCount; index++) {
    gameState.particles.push({
      kind: 'chip',
      x: piece.x + Math.random() * piece.width,
      y: piece.y + Math.random() * piece.height,
      speedX: (Math.random() - 0.5) * 6,
      speedY: Math.random() * 5,
      life: 1.2,
      maxLife: 1.2,
      color: chipColor,
      size: 0.18 + Math.random() * 0.2,
      rotation: Math.random() * 6,
    });
  }
  addFloatingText(piece.x + piece.width / 2, piece.y + piece.height + 0.6, '+' + points, COLORS.ink);
  updateHud();
}

// overlapsHorizontally(first, second): true if two rectangles share more than 5 cm
// of horizontal space (so one can stand on the other).
function overlapsHorizontally(first, second) {
  const overlap = Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x);
  return overlap > 0.05;
}

// findSupport(piece): finds what is right below a piece (the ground, terrain or another
// piece). Returns { y: height of that support, supportPiece: the piece below or null }.
function findSupport(piece) {
  let supportY = 0;
  let supportPiece = null;
  for (const block of gameState.terrain) {
    if (overlapsHorizontally(piece, block) && block.height <= piece.y + 1e-3 && block.height > supportY) {
      supportY = block.height;
      supportPiece = null;
    }
  }
  for (const other of gameState.pieces) {
    if (other === piece || !other.alive || other.hidden) {
      continue;
    }
    const otherTop = other.y + other.height;
    if (overlapsHorizontally(piece, other) && otherTop <= piece.y + 1e-3 && otherTop > supportY) {
      supportY = otherTop;
      supportPiece = other;
    }
  }
  return { y: supportY, supportPiece: supportPiece };
}

// updateFallingPieces(secondsPassed): makes pieces fall when what held them disappears.
// A piglet that falls more than 1 m is knocked down; a wood block that falls more than
// 3 m breaks; a block that lands on a piglet knocks it down.
function updateFallingPieces(secondsPassed) {
  // the pieces that can fall, from the lowest to the highest
  const fallingCandidates = [];
  for (const piece of gameState.pieces) {
    if (piece.alive && !piece.fixedInPlace && !piece.hidden) {
      fallingCandidates.push(piece);
    }
  }
  // .sort() orders the list; the small function says that a lower y goes first
  fallingCandidates.sort(function (first, second) {
    return first.y - second.y;
  });

  for (const piece of fallingCandidates) {
    if (!piece.alive) {
      continue;
    }
    const support = findSupport(piece);
    if (piece.y > support.y + 1e-3) {
      // there is empty space below: it falls with the gravity of the level
      if (!piece.falling) {
        piece.falling = true;
        piece.fallStartY = piece.y;
        piece.fallSpeed = 0;
      }
      piece.fallSpeed -= currentGravity * secondsPassed;
      const newY = piece.y + piece.fallSpeed * secondsPassed;
      if (newY <= support.y) {
        // it lands
        piece.y = support.y;
        const fallHeight = piece.fallStartY - support.y;
        piece.falling = false;
        piece.fallSpeed = 0;
        if (piece.kind === 'target' && fallHeight > 1.0) {
          knockDownTarget(piece);
        } else if (piece.kind !== 'target') {
          if (support.supportPiece && support.supportPiece.kind === 'target') {
            knockDownTarget(support.supportPiece);
          }
          if (piece.kind === 'wood' && fallHeight > 3) {
            breakBlock(piece);
          }
        }
      } else {
        piece.y = newY;
      }
    } else if (piece.falling) {
      piece.falling = false;
      piece.fallSpeed = 0;
    }
  }
}

// isAnythingFalling(): true while some piece is still falling.
function isAnythingFalling() {
  for (const piece of gameState.pieces) {
    if (piece.alive && piece.falling) {
      return true;
    }
  }
  return false;
}

// updateParticles(secondsPassed): moves the particles and removes the old ones.
function updateParticles(secondsPassed) {
  const stillAlive = [];
  for (const particle of gameState.particles) {
    particle.life -= secondsPassed;
    if (particle.kind === 'chip') {
      if (!particle.noGravity) {
        particle.speedY -= currentGravity * secondsPassed;
      }
      particle.x += particle.speedX * secondsPassed;
      particle.y += particle.speedY * secondsPassed;
      if (particle.rotation !== undefined) {
        particle.rotation += secondsPassed * 6;
      }
    } else if (particle.kind === 'text') {
      particle.y += particle.speedY * secondsPassed;
    }
    if (particle.life > 0) {
      stillAlive.push(particle);
    }
  }
  gameState.particles = stillAlive;
}
