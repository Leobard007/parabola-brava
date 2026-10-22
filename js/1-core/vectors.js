/* ======================================================================
   FILE: js/1-core/vectors.js

   VECTORS: data, calculations and the "can it be solved?" check
   Used by the Displacement and Mixed levels. In those levels the piglet walks
   from point A following one or more vectors (V₁, V₂, ...) and the player must
   find some of the values (the "unknowns").

   A VECTOR is saved like this:
     {
       kind: 'distance' | 'velocity' | 'acceleration',
             'distance'     → the length is given directly
             'velocity'     → length = speed × time            (constant speed)
             'acceleration' → length = v₀t + ½at²              (constant acceleration)
       distance, speed, time, acceleration, initialSpeed:  the numbers
       angle:      angle with the horizontal (0° to 90°)
       direction:  'upRight', 'upLeft', 'downLeft', 'downRight', 'right', 'left', 'up', 'down'
       stretchChanges: which value changes when the vector is stretched with the
                       mouse in the editor ('speed', 'time', 'acceleration' or null)
       visibility: for every quantity, what the player sees:
                     'given'   → the value is shown (a known datum)
                     'unknown' → the player must find it (shown as "?")
                     'hidden'  → it is not shown at all
     }

   QUANTITIES (the names used for the values of a vector):
     distance, speed, time, acceleration, initialSpeed, angle, direction,
     dx (horizontal component), dy (vertical component)

   A "quantity key" is a text that says which vector and which quantity, for
   example "0.distance" (the length of V₁), "1.angle" (the angle of V₂) or
   "R.dx" (the horizontal component of the resultant R).
   ====================================================================== */

// DIRECTION_SIGNS: for each direction, the sign of its horizontal and vertical part.
//   [1, 1] means "to the right and up";  [0, -1] means "straight down".
const DIRECTION_SIGNS = {
  upRight: [1, 1],
  upLeft: [-1, 1],
  downLeft: [-1, -1],
  downRight: [1, -1],
  right: [1, 0],
  left: [-1, 0],
  up: [0, 1],
  down: [0, -1],
};

// DIRECTION_NAMES: the name of each direction in Spanish and English.
const DIRECTION_NAMES = {
  upRight: { spanish: 'Arriba y a la derecha', english: 'Up and to the right' },
  upLeft: { spanish: 'Arriba y a la izquierda', english: 'Up and to the left' },
  downLeft: { spanish: 'Abajo y a la izquierda', english: 'Down and to the left' },
  downRight: { spanish: 'Abajo y a la derecha', english: 'Down and to the right' },
  right: { spanish: 'Derecha', english: 'Right' },
  left: { spanish: 'Izquierda', english: 'Left' },
  up: { spanish: 'Arriba', english: 'Up' },
  down: { spanish: 'Abajo', english: 'Down' },
};

// getDirectionName(direction): "Arriba y a la derecha" / "Up and to the right"...
function getDirectionName(direction) {
  const names = DIRECTION_NAMES[direction];
  return translate(names.spanish, names.english);
}

// getDirectionNameLowercase(direction): the same name in lower case (used inside sentences).
function getDirectionNameLowercase(direction) {
  return getDirectionName(direction).toLowerCase();
}

// DIRECTION_ORDER: the order in which the directions are listed in menus.
const DIRECTION_ORDER = ['upRight', 'upLeft', 'downLeft', 'downRight', 'right', 'left', 'up', 'down'];

// DIRECTION_ARROWS: a small arrow for each direction (used in the labels of the scene).
const DIRECTION_ARROWS = {
  upRight: '↗',
  upLeft: '↖',
  downLeft: '↙',
  downRight: '↘',
  right: '→',
  left: '←',
  up: '↑',
  down: '↓',
};

// isStraightDirection(direction): true for right, left, up and down
// (the directions where the angle is fixed: 0° or 90°).
function isStraightDirection(direction) {
  const signs = DIRECTION_SIGNS[direction];
  return signs[0] === 0 || signs[1] === 0;
}

// VECTOR_KINDS: the three kinds of vector.
const VECTOR_KINDS = ['distance', 'velocity', 'acceleration'];

// getVectorKindName(kind): the name of a kind of vector, for the menus.
function getVectorKindName(kind) {
  if (kind === 'velocity') {
    return translate('Velocidad y tiempo', 'Speed and time');
  }
  if (kind === 'acceleration') {
    return translate('Aceleración y tiempo', 'Acceleration and time');
  }
  return translate('Distancia', 'Distance');
}

// getVectorKindNote(kind): a short explanation (with formula) of a kind of vector.
function getVectorKindNote(kind) {
  if (kind === 'velocity') {
    return translate('velocidad constante: ', 'constant speed: ') + mathInline('|V| = v t');
  }
  if (kind === 'acceleration') {
    return translate('aceleración constante: ', 'constant acceleration: ') + mathInline(`|V| = v₀ t + ${MATH_HALF} a t${mathPower(2)}`);
  }
  return translate('desplazamiento', 'displacement');
}

// QUANTITIES_BY_KIND: which quantities each kind of vector has.
const QUANTITIES_BY_KIND = {
  distance: ['distance', 'angle', 'direction', 'dx', 'dy'],
  velocity: ['speed', 'time', 'distance', 'angle', 'direction', 'dx', 'dy'],
  acceleration: ['acceleration', 'time', 'initialSpeed', 'distance', 'angle', 'direction', 'dx', 'dy'],
};

// ALL_QUANTITIES: every quantity, in the order of the columns of the editor table.
const ALL_QUANTITIES = ['distance', 'speed', 'acceleration', 'initialSpeed', 'time', 'angle', 'direction', 'dx', 'dy'];

// RESULTANT_QUANTITIES: the quantities of the resultant R (the total displacement).
const RESULTANT_QUANTITIES = ['distance', 'angle', 'direction', 'dx', 'dy'];

// QUANTITY_UNITS: the unit of each quantity.
const QUANTITY_UNITS = {
  distance: 'm',
  speed: 'm/s',
  acceleration: 'm/s²',
  initialSpeed: 'm/s',
  time: 's',
  angle: '°',
  direction: '',
  dx: 'm',
  dy: 'm',
};

// ABSOLUTE_TOLERANCES: the smallest error that is always accepted in an answer
// (besides the percentage chosen by the level). Avoids rejecting answers like 0.31
// when the true value is 0.3.
const ABSOLUTE_TOLERANCES = {
  distance: 0.3,
  dx: 0.3,
  dy: 0.3,
  speed: 0.1,
  initialSpeed: 0.1,
  acceleration: 0.05,
  time: 0.1,
};

// SUBSCRIPT_DIGITS: small numbers used in the names V₁, V₂...
const SUBSCRIPT_DIGITS = ['₁', '₂', '₃', '₄', '₅'];

// VISIBILITY_STATES: what the player can see of a quantity.
const VISIBILITY_STATES = ['given', 'hidden', 'unknown'];

// getVectorName(owner): "V₁" for owner 0, "V₂" for owner 1..., and "R" for the resultant.
function getVectorName(owner) {
  if (owner === 'R') {
    return 'R';
  }
  return 'V' + SUBSCRIPT_DIGITS[owner];
}

// createVisibility(givenText, unknownText): builds a visibility record.
// Every quantity starts 'hidden'; the ones listed in givenText become 'given'
// and the ones in unknownText become 'unknown'.
// Example: createVisibility('distance angle direction', 'dx')
function createVisibility(givenText, unknownText) {
  const visibility = {};
  for (const quantity of ALL_QUANTITIES) {
    visibility[quantity] = 'hidden';
  }
  const givenList = (givenText || '').split(' ');
  for (const quantity of givenList) {
    if (quantity !== '') {
      visibility[quantity] = 'given';
    }
  }
  const unknownList = (unknownText || '').split(' ');
  for (const quantity of unknownList) {
    if (quantity !== '') {
      visibility[quantity] = 'unknown';
    }
  }
  return visibility;
}

// createDefaultVisibility(kind): what a new vector of this kind shows by default.
function createDefaultVisibility(kind) {
  if (kind === 'velocity') {
    return createVisibility('speed time angle direction');
  }
  if (kind === 'acceleration') {
    return createVisibility('acceleration time initialSpeed angle direction');
  }
  return createVisibility('distance angle direction');
}

// cleanVector(source): returns a correct copy of a vector: fills in missing values
// and keeps every number inside its limits.
function cleanVector(source) {
  if (!source) {
    source = {};
  }
  let kind = 'distance';
  if (VECTOR_KINDS.indexOf(source.kind) !== -1) {
    kind = source.kind;
  }
  let direction = 'upRight';
  if (DIRECTION_SIGNS[source.direction]) {
    direction = source.direction;
  }
  let angle = roundToTwoDecimals(clampNumber(parseNumber(source.angle, 30), 0, 90));
  // the straight directions have a fixed angle
  if (direction === 'right' || direction === 'left') {
    angle = 0;
  }
  if (direction === 'up' || direction === 'down') {
    angle = 90;
  }

  // visibility: start from the default one and copy the valid states of the source
  const visibility = createDefaultVisibility(kind);
  if (source.visibility) {
    for (const quantity of ALL_QUANTITIES) {
      if (VISIBILITY_STATES.indexOf(source.visibility[quantity]) !== -1) {
        visibility[quantity] = source.visibility[quantity];
      }
    }
  }
  // quantities that this kind of vector does not have are always hidden
  for (const quantity of ALL_QUANTITIES) {
    if (QUANTITIES_BY_KIND[kind].indexOf(quantity) === -1) {
      visibility[quantity] = 'hidden';
    }
  }
  // in straight directions the angle is obvious, so it is not shown as a datum
  if (isStraightDirection(direction) && visibility.angle !== 'unknown') {
    visibility.angle = 'hidden';
  }

  // which value changes when the vector is stretched in the editor
  let stretchChanges = null;
  if (kind === 'velocity') {
    stretchChanges = 'speed';
  }
  if (kind === 'acceleration') {
    stretchChanges = 'acceleration';
  }
  if (kind !== 'distance' && source.stretchChanges === 'time') {
    stretchChanges = 'time';
  }

  return {
    kind: kind,
    stretchChanges: stretchChanges,
    distance: roundToTwoDecimals(clampNumber(parseNumber(source.distance, 10), 0.5, 80)),
    speed: roundToTwoDecimals(clampNumber(parseNumber(source.speed, 4), 0.1, 50)),
    time: roundToTwoDecimals(clampNumber(parseNumber(source.time, 3), 0.1, 60)),
    acceleration: roundToTwoDecimals(clampNumber(parseNumber(source.acceleration, 2), 0.05, 20)),
    initialSpeed: roundToTwoDecimals(clampNumber(parseNumber(source.initialSpeed, 0), 0, 30)),
    angle: angle,
    direction: direction,
    visibility: visibility,
  };
}

// cleanVectorPuzzle(source, worldWidth): returns a correct copy of the vector puzzle
// of a level (point A, the vectors, what the player sees, tolerances...).
//   startX, startY  position of point A (where the piglet starts)
//   vectors         list of 1 to 4 vectors
//   resultant       { visibility } of the resultant R
//   adjustableVectorIndex  index of the vector the player must adjust in Mixed levels
//                          (null = none)
//   hideScale       true = the ruler/scale is hidden during the answer
//   showPath        true = the path of the piglet is drawn
//   valueTolerancePercent  error accepted in the answers, in %
//   angleTolerance  error accepted in the angles, in degrees
//   attempts        how many tries the player has
function cleanVectorPuzzle(source, worldWidth) {
  if (!source) {
    source = {};
  }
  // point A must stay away from the launcher and inside the world
  const lowestX = LAUNCH_CLEAR_ZONE + 0.6;
  const highestX = Math.max(lowestX, worldWidth - 0.6);

  let sourceVectors = source.vectors;
  if (!Array.isArray(sourceVectors) || sourceVectors.length === 0) {
    sourceVectors = [{ kind: 'distance', distance: 10, angle: 30, direction: 'upRight' }];
  }
  // at most 4 vectors
  const vectors = [];
  for (let index = 0; index < sourceVectors.length && index < 4; index++) {
    vectors.push(cleanVector(sourceVectors[index]));
  }

  // what the player sees of the resultant R (by default: find its length, angle and direction)
  const resultantVisibility = { distance: 'unknown', angle: 'unknown', direction: 'unknown', dx: 'hidden', dy: 'hidden' };
  if (source.resultant && source.resultant.visibility) {
    for (const quantity of RESULTANT_QUANTITIES) {
      const state = source.resultant.visibility[quantity];
      if (VISIBILITY_STATES.indexOf(state) !== -1) {
        resultantVisibility[quantity] = state;
      }
    }
  }

  let adjustableVectorIndex = null;
  const sourceIndex = source.adjustableVectorIndex;
  if (Number.isInteger(sourceIndex) && sourceIndex >= 0 && sourceIndex < vectors.length) {
    adjustableVectorIndex = sourceIndex;
  }

  return {
    startX: roundToTwoDecimals(clampNumber(parseNumber(source.startX, Math.round(worldWidth * 0.3)), lowestX, highestX)),
    startY: roundToTwoDecimals(clampNumber(parseNumber(source.startY, 0), 0, 30)),
    vectors: vectors,
    resultant: { visibility: resultantVisibility },
    adjustableVectorIndex: adjustableVectorIndex,
    hideScale: source.hideScale !== false,
    showPath: source.showPath !== false,
    valueTolerancePercent: roundToTwoDecimals(clampNumber(parseNumber(source.valueTolerancePercent, 5), 1, 25)),
    angleTolerance: roundToTwoDecimals(clampNumber(parseNumber(source.angleTolerance, 3), 0.5, 15)),
    attempts: Math.round(clampNumber(parseNumber(source.attempts, 3), 1, 6)),
  };
}

// calculateVectorValues(vector): calculates every value of a vector.
// Returns { distance, speed, time, acceleration, initialSpeed, angle, direction, dx, dy }
// where dx and dy are the horizontal and vertical components (with their signs).
function calculateVectorValues(vector) {
  // 1) the length of the vector depends on its kind
  let distance = vector.distance;
  if (vector.kind === 'velocity') {
    distance = vector.speed * vector.time;
  }
  if (vector.kind === 'acceleration') {
    distance = vector.initialSpeed * vector.time + 0.5 * vector.acceleration * vector.time * vector.time;
  }

  // 2) the components: Δx = ±|V| cos θ and Δy = ±|V| sin θ
  const signs = DIRECTION_SIGNS[vector.direction];
  const horizontalSign = signs[0];
  const verticalSign = signs[1];
  const angleInRadians = (vector.angle * Math.PI) / 180;
  let dx;
  let dy;
  let angle = vector.angle;
  if (horizontalSign === 0) {
    // straight up or down
    dx = 0;
    dy = verticalSign * distance;
    angle = 90;
  } else if (verticalSign === 0) {
    // straight right or left
    dx = horizontalSign * distance;
    dy = 0;
    angle = 0;
  } else {
    dx = horizontalSign * distance * Math.cos(angleInRadians);
    dy = verticalSign * distance * Math.sin(angleInRadians);
  }
  return {
    distance: distance,
    speed: vector.speed,
    time: vector.time,
    acceleration: vector.acceleration,
    initialSpeed: vector.initialSpeed,
    angle: angle,
    direction: vector.direction,
    dx: dx,
    dy: dy,
  };
}

// directionFromComponents(dx, dy): the direction name that matches the signs of dx and dy.
// Very small values (less than 0.05) count as zero.
function directionFromComponents(dx, dy) {
  const margin = 0.05;
  let horizontal = '';
  if (dx > margin) {
    horizontal = 'Right';
  } else if (dx < -margin) {
    horizontal = 'Left';
  }
  let vertical = '';
  if (dy > margin) {
    vertical = 'up';
  } else if (dy < -margin) {
    vertical = 'down';
  }
  if (horizontal !== '' && vertical !== '') {
    return vertical + horizontal; // for example "up" + "Right" = "upRight"
  }
  if (horizontal !== '') {
    return horizontal.toLowerCase(); // "right" or "left"
  }
  if (vertical !== '') {
    return vertical;
  }
  return 'right'; // no movement at all
}

// calculateResultant(puzzle): follows every vector from point A and calculates the
// resultant R (the total displacement from A to the end point B).
// Returns:
//   points       the corners of the path: A, then the end of each vector
//   vectorValues the values of each vector (from calculateVectorValues)
//   endPoint     { x, y } of the end point B
//   dx, dy       components of R
//   magnitude    length of R
//   angle        angle of R with the horizontal (0° to 90°)
//   direction    direction of R
//   values       the values of R using the same names as a vector
//                { distance, angle, direction, dx, dy }
function calculateResultant(puzzle) {
  const vectorValues = [];
  const points = [{ x: puzzle.startX, y: puzzle.startY }];
  let x = puzzle.startX;
  let y = puzzle.startY;
  for (const vector of puzzle.vectors) {
    const values = calculateVectorValues(vector);
    vectorValues.push(values);
    x += values.dx;
    y += values.dy;
    points.push({ x: x, y: y });
  }
  const dx = x - puzzle.startX;
  const dy = y - puzzle.startY;
  // Math.hypot(dx, dy) = √(dx² + dy²)  (Pythagoras)
  const magnitude = Math.hypot(dx, dy);
  // the angle with the horizontal: tan⁻¹(|dy| / |dx|), converted from radians to degrees
  let angle = 0;
  if (magnitude >= 1e-9) {
    angle = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
  }
  const direction = directionFromComponents(dx, dy);
  return {
    points: points,
    vectorValues: vectorValues,
    endPoint: { x: x, y: y },
    dx: dx,
    dy: dy,
    magnitude: magnitude,
    angle: angle,
    direction: direction,
    values: { distance: magnitude, angle: angle, direction: direction, dx: dx, dy: dy },
  };
}

// getTrueValue(resultantInfo, owner, quantity): the correct value of one quantity.
//   resultantInfo: the result of calculateResultant
//   owner: 'R' for the resultant, or the index of a vector (0, 1, 2...)
function getTrueValue(resultantInfo, owner, quantity) {
  if (owner === 'R') {
    return resultantInfo.values[quantity];
  }
  return resultantInfo.vectorValues[owner][quantity];
}

// addIfMissing(list, item): adds item to the list only if it is not there yet.
function addIfMissing(list, item) {
  if (list.indexOf(item) === -1) {
    list.push(item);
  }
}

// getAcceptedDirections(dx, dy, angle, direction, angleTolerance): the directions
// accepted as a correct answer. When the vector is almost horizontal or almost
// vertical (within the angle tolerance), the neighbor directions are accepted too.
function getAcceptedDirections(dx, dy, angle, direction, angleTolerance) {
  const accepted = [direction];
  let horizontal = 'Right';
  if (dx < 0) {
    horizontal = 'Left';
  }
  let vertical = 'up';
  if (dy < 0) {
    vertical = 'down';
  }
  if (angle <= angleTolerance) {
    // almost horizontal: "right", "upRight" and "downRight" are all fine (or the Left ones)
    addIfMissing(accepted, horizontal.toLowerCase());
    addIfMissing(accepted, 'up' + horizontal);
    addIfMissing(accepted, 'down' + horizontal);
  }
  if (angle >= 90 - angleTolerance) {
    // almost vertical: "up", "upRight" and "upLeft" are all fine (or the down ones)
    addIfMissing(accepted, vertical);
    addIfMissing(accepted, vertical + 'Right');
    addIfMissing(accepted, vertical + 'Left');
  }
  return accepted;
}

/* ----------------------------------------------------------------------
   CAN THE PUZZLE BE SOLVED?
   analyzePuzzle starts from the quantities the player is given and, again and
   again, applies the rules of physics to find out what else can be calculated
   (like a person would do on paper). When nothing new can be found, it checks
   whether every unknown was reached.
   ---------------------------------------------------------------------- */

// learnQuantity(knownQuantities, key): marks a quantity as known.
// Returns true if it was new (so the analysis knows that something changed).
//   knownQuantities is an object used as a list: knownQuantities["0.distance"] = true
function learnQuantity(knownQuantities, key) {
  if (knownQuantities[key]) {
    return false;
  }
  knownQuantities[key] = true;
  return true;
}

// applyGeometryRules(knownQuantities, owner, dx, dy): the rules that connect the
// length, angle, direction and components of one vector (or of R).
//   owner: the vector index or 'R';   dx, dy: its true components (to know if it is
//   horizontal or vertical)
// Returns true if something new was learned.
function applyGeometryRules(knownQuantities, owner, dx, dy) {
  let learnedSomething = false;
  const prefix = owner + '.';
  // isKnown('angle') checks if "owner.angle" is known
  function isKnown(quantity) {
    return knownQuantities[prefix + quantity] === true;
  }
  // learn('angle') marks "owner.angle" as known
  function learn(quantity) {
    if (learnQuantity(knownQuantities, prefix + quantity)) {
      learnedSomething = true;
    }
  }
  const isHorizontal = Math.abs(dy) < 0.05;
  const isVertical = Math.abs(dx) < 0.05;

  // a horizontal/vertical direction already tells the angle and that one component is 0
  if (isKnown('direction') && (isHorizontal || isVertical)) {
    learn('angle');
    if (isHorizontal) {
      learn('dy');
    } else {
      learn('dx');
    }
  }
  // length + angle + direction → components (Δx = |V| cos θ, Δy = |V| sin θ)
  if (isKnown('distance') && isKnown('angle') && isKnown('direction')) {
    learn('dx');
    learn('dy');
  }
  // both components → length (Pythagoras), angle (tan⁻¹) and direction (signs)
  if (isKnown('dx') && isKnown('dy')) {
    learn('distance');
    learn('angle');
    learn('direction');
  }
  // length + one component → angle (and the other component if the direction is known)
  if (isKnown('distance') && isKnown('dx')) {
    learn('angle');
    if (isKnown('direction')) {
      learn('dy');
    }
  }
  if (isKnown('distance') && isKnown('dy')) {
    learn('angle');
    if (isKnown('direction')) {
      learn('dx');
    }
  }
  // angle + direction + one component → length and the other component
  if (isKnown('angle') && isKnown('direction') && isKnown('dx') && !isVertical) {
    learn('distance');
    learn('dy');
  }
  if (isKnown('angle') && isKnown('direction') && isKnown('dy') && !isHorizontal) {
    learn('distance');
    learn('dx');
  }
  return learnedSomething;
}

// analyzePuzzle(puzzle): finds out which unknowns can be calculated.
// Returns:
//   resultant   the result of calculateResultant
//   unknowns    list of the quantity keys marked as unknown ("?")
//   unsolvable  list of the unknowns that can NOT be calculated with the given data
function analyzePuzzle(puzzle) {
  const resultant = calculateResultant(puzzle);
  const knownQuantities = {};
  const unknowns = [];

  // 1) start with the given data, and collect the unknowns
  for (let index = 0; index < puzzle.vectors.length; index++) {
    const vector = puzzle.vectors[index];
    for (const quantity of QUANTITIES_BY_KIND[vector.kind]) {
      if (vector.visibility[quantity] === 'given') {
        knownQuantities[index + '.' + quantity] = true;
      }
      if (vector.visibility[quantity] === 'unknown') {
        unknowns.push(index + '.' + quantity);
      }
    }
  }
  for (const quantity of RESULTANT_QUANTITIES) {
    if (puzzle.resultant.visibility[quantity] === 'given') {
      knownQuantities['R.' + quantity] = true;
    }
    if (puzzle.resultant.visibility[quantity] === 'unknown') {
      unknowns.push('R.' + quantity);
    }
  }

  // 2) apply the rules again and again while something new is learned (at most 60 rounds)
  let somethingChanged = true;
  let round = 0;
  while (somethingChanged && round < 60) {
    round++;
    somethingChanged = false;

    for (let index = 0; index < puzzle.vectors.length; index++) {
      const vector = puzzle.vectors[index];
      const prefix = index + '.';

      // constant speed: distance = speed × time. Knowing any 2 gives the third.
      if (vector.kind === 'velocity') {
        let knownCount = 0;
        if (knownQuantities[prefix + 'distance']) knownCount++;
        if (knownQuantities[prefix + 'speed']) knownCount++;
        if (knownQuantities[prefix + 'time']) knownCount++;
        if (knownCount >= 2) {
          if (learnQuantity(knownQuantities, prefix + 'distance')) somethingChanged = true;
          if (learnQuantity(knownQuantities, prefix + 'speed')) somethingChanged = true;
          if (learnQuantity(knownQuantities, prefix + 'time')) somethingChanged = true;
        }
      }
      // constant acceleration: distance = v₀t + ½at². Knowing any 3 gives the fourth.
      if (vector.kind === 'acceleration') {
        let knownCount = 0;
        if (knownQuantities[prefix + 'distance']) knownCount++;
        if (knownQuantities[prefix + 'acceleration']) knownCount++;
        if (knownQuantities[prefix + 'time']) knownCount++;
        if (knownQuantities[prefix + 'initialSpeed']) knownCount++;
        if (knownCount >= 3) {
          if (learnQuantity(knownQuantities, prefix + 'distance')) somethingChanged = true;
          if (learnQuantity(knownQuantities, prefix + 'acceleration')) somethingChanged = true;
          if (learnQuantity(knownQuantities, prefix + 'time')) somethingChanged = true;
          if (learnQuantity(knownQuantities, prefix + 'initialSpeed')) somethingChanged = true;
        }
      }
      const values = resultant.vectorValues[index];
      if (applyGeometryRules(knownQuantities, index, values.dx, values.dy)) {
        somethingChanged = true;
      }
    }
    if (applyGeometryRules(knownQuantities, 'R', resultant.dx, resultant.dy)) {
      somethingChanged = true;
    }

    // sum of components: Rₓ = Δx₁ + Δx₂ + ...  If only one of them is missing, it can be found.
    const axes = ['dx', 'dy'];
    for (const axis of axes) {
      const keys = ['R.' + axis];
      for (let index = 0; index < puzzle.vectors.length; index++) {
        keys.push(index + '.' + axis);
      }
      const missingKeys = [];
      for (const key of keys) {
        if (!knownQuantities[key]) {
          missingKeys.push(key);
        }
      }
      if (missingKeys.length === 1) {
        knownQuantities[missingKeys[0]] = true;
        somethingChanged = true;
      }
    }
  }

  // 3) which unknowns were never reached?
  const unsolvable = [];
  for (const key of unknowns) {
    if (!knownQuantities[key]) {
      unsolvable.push(key);
    }
  }
  return { resultant: resultant, unknowns: unknowns, unsolvable: unsolvable };
}

// splitQuantityKey(key): splits "1.angle" into { owner: 1, quantity: 'angle' }
// and "R.dx" into { owner: 'R', quantity: 'dx' }.
function splitQuantityKey(key) {
  const parts = key.split('.');
  let owner = 'R';
  if (parts[0] !== 'R') {
    owner = Number(parts[0]);
  }
  return { owner: owner, quantity: parts[1] };
}

// getQuantityKeyName(key): a readable name for a quantity key, for example
// "|V₁|", "V₂ₓ" or "θ de R".
function getQuantityKeyName(key) {
  const parts = splitQuantityKey(key);
  const name = getVectorName(parts.owner);
  const quantity = parts.quantity;
  if (quantity === 'distance') return `|${name}|`;
  if (quantity === 'dx') return `${name}ₓ`;
  if (quantity === 'dy') return `${name}ᵧ`;
  if (quantity === 'angle') return translate(`θ de ${name}`, `θ of ${name}`);
  if (quantity === 'direction') return translate(`dirección de ${name}`, `direction of ${name}`);
  if (quantity === 'speed') return translate(`v de ${name}`, `v of ${name}`);
  if (quantity === 'acceleration') return translate(`a de ${name}`, `a of ${name}`);
  if (quantity === 'initialSpeed') return translate(`v₀ de ${name}`, `v₀ of ${name}`);
  if (quantity === 'time') return translate(`t de ${name}`, `t of ${name}`);
  return '';
}

// formatQuantityValue(quantity, value): a value written with its unit,
// for example "12.5 m", "30°", "+4.2 m" or "arriba y a la derecha".
function formatQuantityValue(quantity, value) {
  if (quantity === 'direction') {
    return getDirectionNameLowercase(value);
  }
  if (quantity === 'angle') {
    return formatNice(value) + '°';
  }
  if (quantity === 'dx' || quantity === 'dy') {
    return formatNiceSigned(value) + ' m';
  }
  return formatNice(value) + ' ' + QUANTITY_UNITS[quantity];
}

// getQuantitySymbol(quantity, owner): the short symbol of a quantity (|V₁|, θ, Δx, Rₓ, v, t...).
function getQuantitySymbol(quantity, owner) {
  const name = getVectorName(owner);
  if (quantity === 'distance') return `|${name}|`;
  if (quantity === 'angle') return 'θ';
  if (quantity === 'direction') return translate('dirección', 'direction');
  if (quantity === 'dx') {
    if (owner === 'R') return 'Rₓ';
    return 'Δx';
  }
  if (quantity === 'dy') {
    if (owner === 'R') return 'Rᵧ';
    return 'Δy';
  }
  if (quantity === 'speed') return 'v';
  if (quantity === 'acceleration') return 'a';
  if (quantity === 'initialSpeed') return 'v₀';
  if (quantity === 'time') return 't';
  return '';
}

// getShortQuantityText(quantity, value, owner): the short text of a quantity used in
// the labels of the scene, for example "12 m", "30°", "↗", "v = 4 m/s".
// If value is null (an unknown), it shows a question mark: "θ = ?".
function getShortQuantityText(quantity, value, owner) {
  const name = getVectorName(owner);
  if (value === null || value === undefined) {
    if (quantity === 'direction') return translate('dir. ?', 'dir. ?');
    if (quantity === 'angle') return 'θ = ?';
    if (quantity === 'distance') return `|${name}| = ?`;
    return `${getQuantitySymbol(quantity, owner)} = ?`;
  }
  if (quantity === 'direction') return DIRECTION_ARROWS[value];
  if (quantity === 'angle') return formatNice(value) + '°';
  if (quantity === 'distance') return formatNice(value) + ' m';
  if (quantity === 'dx' || quantity === 'dy') {
    return `${getQuantitySymbol(quantity, owner)} = ${formatNiceSigned(value)}`;
  }
  return `${getQuantitySymbol(quantity, owner)} = ${formatNice(value)} ${QUANTITY_UNITS[quantity]}`;
}

// buildVectorLabelText(owner, visibility, values, showEverything, kind): the text of the
// label drawn next to a vector, for example "V₁: 12 m · 30° · ↗".
//   showEverything: true after the level ends (shows every value, not only the given ones)
function buildVectorLabelText(owner, visibility, values, showEverything, kind) {
  let quantities = RESULTANT_QUANTITIES;
  if (owner !== 'R') {
    quantities = QUANTITIES_BY_KIND[kind];
  }
  const parts = [];
  for (const quantity of quantities) {
    if (showEverything) {
      // the components are not written in the label
      if (quantity === 'dx' || quantity === 'dy') {
        continue;
      }
      // the angle of a straight vector (0° or 90°) is obvious
      if (quantity === 'angle' && owner !== 'R' && (values.angle === 0 || values.angle === 90)) {
        continue;
      }
      parts.push(getShortQuantityText(quantity, values[quantity], owner));
      continue;
    }
    const state = visibility[quantity];
    if (state === 'hidden') {
      continue;
    }
    if (state === 'unknown') {
      parts.push(getShortQuantityText(quantity, null, owner));
    } else {
      parts.push(getShortQuantityText(quantity, values[quantity], owner));
    }
  }
  if (parts.length === 0) {
    return getVectorName(owner);
  }
  return getVectorName(owner) + ': ' + parts.join(' · ');
}

// findVectorPuzzleProblem(level): checks that the path of the piglet fits inside the
// world. Returns a text explaining the problem, or '' when everything is fine.
function findVectorPuzzleProblem(level) {
  const puzzle = level.vectorPuzzle;
  const resultant = calculateResultant(puzzle);
  const lowestX = LAUNCH_CLEAR_ZONE + 0.6;
  const highestX = level.worldWidth - 0.6;
  const endX = resultant.endPoint.x;
  const endY = resultant.endPoint.y;

  for (const values of resultant.vectorValues) {
    if (values.distance > 80) {
      return translate(
        'Algún vector mide más de 80 m: reduce la velocidad, la aceleración o el tiempo.',
        'A vector is longer than 80 m: reduce its speed, acceleration or time.',
      );
    }
  }
  if (resultant.magnitude < 1) {
    return translate(
      'El desplazamiento total es casi cero: el cochinito acabaría donde empezó.',
      'The total displacement is almost zero: the piglet would end where it started.',
    );
  }
  if (endX < lowestX || endX > highestX) {
    return translate(
      `El punto final B cae fuera del mundo (x = ${formatFixed(endX, 1)} m). Debe quedar entre ${formatFixed(lowestX, 1)} y ${formatFixed(highestX, 1)} m: mueve A o amplía el mundo.`,
      `End point B falls outside the world (x = ${formatFixed(endX, 1)} m). It must stay between ${formatFixed(lowestX, 1)} and ${formatFixed(highestX, 1)} m: move A or widen the world.`,
    );
  }
  if (endY < 0) {
    return translate(
      `El punto final B queda bajo el suelo (y = ${formatFixed(endY, 1)} m): sube A o cambia los vectores.`,
      `End point B is below the ground (y = ${formatFixed(endY, 1)} m): raise A or change the vectors.`,
    );
  }
  if (endY > 35) {
    return translate(
      `El punto final B queda demasiado alto (y = ${formatFixed(endY, 1)} m). El máximo es 35 m.`,
      `End point B is too high (y = ${formatFixed(endY, 1)} m). The maximum is 35 m.`,
    );
  }
  return '';
}

// checkPuzzleSolvability(puzzle): says if the player can solve the puzzle.
// Returns { solvable: true/false, message: explanation when it is not solvable,
//           analysis: the result of analyzePuzzle }
function checkPuzzleSolvability(puzzle) {
  const analysis = analyzePuzzle(puzzle);
  if (analysis.unknowns.length === 0) {
    return {
      solvable: false,
      message: translate(
        'Marca al menos una incógnita (?) para que el jugador tenga algo que encontrar.',
        'Mark at least one unknown (?) so the player has something to find.',
      ),
      analysis: analysis,
    };
  }
  if (analysis.unsolvable.length > 0) {
    const names = [];
    for (const key of analysis.unsolvable) {
      names.push(getQuantityKeyName(key));
    }
    return {
      solvable: false,
      message:
        translate('Con los datos marcados no se puede calcular: ', 'With the given data it’s impossible to work out: ') +
        names.join(', ') +
        translate('. Da más datos o quita esa incógnita.', '. Give more data or remove that unknown.'),
      analysis: analysis,
    };
  }
  return { solvable: true, message: '', analysis: analysis };
}
