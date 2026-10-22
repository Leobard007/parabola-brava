/* ======================================================================
   FILE: js/3-editor/editor-templates.js

   EDITOR TEMPLATES
   A template changes, in one click, what the player sees and what must be found
   (vector templates) or what the player can adjust when launching (launch templates).
   Mixed templates apply one of each.

   To add a template: add it to one of the lists below (id, names, descriptions) and
   add what it does in applyVectorTemplate or applyLaunchTemplate.
   ====================================================================== */

// PRIMARY_QUANTITIES: the basic data of each kind of vector.
const PRIMARY_QUANTITIES = {
  distance: ['distance'],
  velocity: ['speed', 'time'],
  acceleration: ['acceleration', 'time', 'initialSpeed'],
};

// createPrimaryVisibility(vector): a visibility where the basic data, the direction and
// (if it is not a straight direction) the angle are given.
function createPrimaryVisibility(vector) {
  const visibility = createVisibility('');
  for (const quantity of PRIMARY_QUANTITIES[vector.kind]) {
    visibility[quantity] = 'given';
  }
  visibility.direction = 'given';
  if (!isStraightDirection(vector.direction)) {
    visibility.angle = 'given';
  }
  return visibility;
}

// makeSureThereAreVectors(puzzle, count): adds vectors until there are at least "count".
function makeSureThereAreVectors(puzzle, count) {
  while (puzzle.vectors.length < count) {
    puzzle.vectors.push(cleanVector({ distance: 6, angle: 40, direction: 'upRight' }));
  }
}

// changeVectorKindKeepingLength(vector, kind): changes the kind of a vector
// (distance / velocity / acceleration) without changing its length.
function changeVectorKindKeepingLength(vector, kind) {
  if (vector.kind === kind) {
    return vector;
  }
  const length = calculateVectorValues(vector).distance;
  const newVector = deepCopy(vector);
  newVector.kind = kind;
  if (kind === 'distance') {
    newVector.distance = roundToTwoDecimals(length);
  }
  if (kind === 'velocity') {
    // length = speed × time  →  speed = length / time
    newVector.time = vector.time || 2;
    newVector.speed = roundToTwoDecimals(length / newVector.time);
  }
  if (kind === 'acceleration') {
    // starting from rest: length = ½ a t²  →  a = 2 · length / t²
    newVector.time = vector.time || 2;
    newVector.initialSpeed = 0;
    newVector.acceleration = roundToTwoDecimals((2 * length) / (newVector.time * newVector.time));
  }
  // the new visibility keeps what the player saw of the angle, direction and components
  const visibility = createDefaultVisibility(kind);
  visibility.angle = vector.visibility.angle;
  visibility.direction = vector.visibility.direction;
  visibility.dx = vector.visibility.dx;
  visibility.dy = vector.visibility.dy;
  if (kind !== 'distance') {
    if (vector.visibility.distance === 'given') {
      visibility.distance = 'hidden';
    } else {
      visibility.distance = vector.visibility.distance;
    }
  }
  newVector.visibility = visibility;
  newVector.stretchChanges = null;
  return cleanVector(newVector);
}

// makeDiagonal(vector): turns a straight vector (right, left, up, down) into a diagonal one,
// so it has an angle that can be asked.
function makeDiagonal(vector) {
  if (vector.direction === 'right') {
    vector.direction = 'upRight';
    vector.angle = 25;
  } else if (vector.direction === 'left') {
    vector.direction = 'upLeft';
    vector.angle = 25;
  } else if (vector.direction === 'up') {
    vector.direction = 'upRight';
    vector.angle = 65;
  } else if (vector.direction === 'down') {
    vector.direction = 'downRight';
    vector.angle = 65;
  }
}

// askForQuantityOfLastVector(puzzle, kind, unknownQuantity): templates like "How long did
// it take?": the last vector becomes of this kind and one of its values is the unknown.
function askForQuantityOfLastVector(puzzle, kind, unknownQuantity) {
  makeSureThereAreVectors(puzzle, 2);
  const lastIndex = puzzle.vectors.length - 1;
  puzzle.vectors[lastIndex] = changeVectorKindKeepingLength(puzzle.vectors[lastIndex], kind);
  for (let index = 0; index < puzzle.vectors.length; index++) {
    const vector = puzzle.vectors[index];
    vector.visibility = createPrimaryVisibility(vector);
    if (index === lastIndex) {
      vector.visibility[unknownQuantity] = 'unknown';
    }
  }
  puzzle.resultant.visibility = createVisibility('distance angle direction');
  puzzle.showPath = false;
}

// VECTOR_TEMPLATES: what the player must find.
const VECTOR_TEMPLATES = [
  {
    id: 'findResultant',
    spanishName: 'Encontrar R',
    englishName: 'Find R',
    spanishDescription: 'Vectores completos; pide |R|, θ y dirección',
    englishDescription: 'Full vectors; asks for |R|, θ and direction',
  },
  {
    id: 'breakDownResultant',
    spanishName: 'Descomponer R',
    englishName: 'Break down R',
    spanishDescription: 'Da |R|, θ y dirección; pide Rₓ y Rᵧ',
    englishDescription: 'Gives |R|, θ and direction; asks for Rₓ and Rᵧ',
  },
  {
    id: 'componentsToPolar',
    spanishName: 'De componentes a polar',
    englishName: 'Components to polar',
    spanishDescription: 'Da Δx y Δy de cada vector; pide |R|, θ y dirección',
    englishDescription: 'Gives Δx and Δy of each vector; asks for |R|, θ and direction',
  },
  {
    id: 'missingVector',
    spanishName: 'Vector faltante',
    englishName: 'Missing vector',
    spanishDescription: 'Da R y los demás vectores; pide magnitud y ángulo del último',
    englishDescription: 'Gives R and the other vectors; asks for the last one’s length and angle',
  },
  {
    id: 'pythagorasInReverse',
    spanishName: 'Pitágoras inverso',
    englishName: 'Pythagoras in reverse',
    spanishDescription: 'Da |R|, Rₓ y la dirección; pide Rᵧ y θ',
    englishDescription: 'Gives |R|, Rₓ and the direction; asks for Rᵧ and θ',
  },
  {
    id: 'howLong',
    spanishName: '¿Cuánto tardó?',
    englishName: 'How long did it take?',
    spanishDescription: 'Da la velocidad y R; pide el tiempo del último vector',
    englishDescription: 'Gives the speed and R; asks for the last vector’s time',
  },
  {
    id: 'whatSpeed',
    spanishName: '¿Qué velocidad?',
    englishName: 'What speed?',
    spanishDescription: 'Da el tiempo y R; pide la velocidad del último vector',
    englishDescription: 'Gives the time and R; asks for the last vector’s speed',
  },
  {
    id: 'whatAcceleration',
    spanishName: '¿Qué aceleración?',
    englishName: 'What acceleration?',
    spanishDescription: 'Da t, v₀ y R; pide la aceleración del último vector',
    englishDescription: 'Gives t, v₀ and R; asks for the last vector’s acceleration',
  },
];

// applyVectorTemplate(templateId, puzzle): changes the puzzle according to a vector template.
function applyVectorTemplate(templateId, puzzle) {
  if (templateId === 'findResultant') {
    for (const vector of puzzle.vectors) {
      vector.visibility = createPrimaryVisibility(vector);
    }
    puzzle.resultant.visibility = createVisibility('', 'distance angle direction');
    puzzle.showPath = true;
  } else if (templateId === 'breakDownResultant') {
    for (const vector of puzzle.vectors) {
      vector.visibility = createVisibility('');
    }
    puzzle.resultant.visibility = createVisibility('distance angle direction', 'dx dy');
    puzzle.showPath = true;
  } else if (templateId === 'componentsToPolar') {
    for (const vector of puzzle.vectors) {
      vector.visibility = createVisibility('dx dy');
    }
    puzzle.resultant.visibility = createVisibility('', 'distance angle direction');
    puzzle.showPath = true;
  } else if (templateId === 'missingVector') {
    makeSureThereAreVectors(puzzle, 2);
    const lastIndex = puzzle.vectors.length - 1;
    puzzle.vectors[lastIndex] = changeVectorKindKeepingLength(puzzle.vectors[lastIndex], 'distance');
    makeDiagonal(puzzle.vectors[lastIndex]);
    for (let index = 0; index < puzzle.vectors.length; index++) {
      const vector = puzzle.vectors[index];
      if (index < lastIndex) {
        vector.visibility = createPrimaryVisibility(vector);
      } else {
        vector.visibility = createVisibility('direction', 'distance angle');
      }
    }
    puzzle.resultant.visibility = createVisibility('distance angle direction');
    puzzle.showPath = false;
  } else if (templateId === 'pythagorasInReverse') {
    for (const vector of puzzle.vectors) {
      vector.visibility = createVisibility('');
    }
    puzzle.resultant.visibility = createVisibility('distance dx direction', 'dy angle');
    puzzle.showPath = true;
  } else if (templateId === 'howLong') {
    askForQuantityOfLastVector(puzzle, 'velocity', 'time');
  } else if (templateId === 'whatSpeed') {
    askForQuantityOfLastVector(puzzle, 'velocity', 'speed');
  } else if (templateId === 'whatAcceleration') {
    askForQuantityOfLastVector(puzzle, 'acceleration', 'acceleration');
  }
}

// LAUNCH_TEMPLATES: what the player can adjust when launching.
const LAUNCH_TEMPLATES = [
  {
    id: 'freeLaunch',
    spanishName: 'Lanzamiento libre',
    englishName: 'Free launch',
    spanishDescription: 'v₀, θ y h₀ libres en rangos amplios',
    englishDescription: 'v₀, θ and h₀ free across wide ranges',
  },
  {
    id: 'angleOnly',
    spanishName: 'Solo el ángulo',
    englishName: 'Angle only',
    spanishDescription: 'v₀ y h₀ fijas; el jugador elige θ',
    englishDescription: 'v₀ and h₀ fixed; the player picks θ',
  },
  {
    id: 'speedOnly',
    spanishName: 'Solo la velocidad',
    englishName: 'Speed only',
    spanishDescription: 'θ y h₀ fijos; el jugador elige v₀',
    englishDescription: 'θ and h₀ fixed; the player picks v₀',
  },
  {
    id: 'heightOnly',
    spanishName: 'Solo la altura',
    englishName: 'Height only',
    spanishDescription: 'v₀ y θ fijos; el jugador elige h₀',
    englishDescription: 'v₀ and θ fixed; the player picks h₀',
  },
  {
    id: 'horizontalLaunch',
    spanishName: 'Tiro horizontal',
    englishName: 'Horizontal launch',
    spanishDescription: 'θ = 0° desde una altura fija; el jugador elige v₀',
    englishDescription: 'θ = 0° from a fixed height; the player picks v₀',
  },
  {
    id: 'fromTheGround',
    spanishName: 'Desde el suelo',
    englishName: 'From the ground',
    spanishDescription: 'h₀ = 0 fija; el jugador elige v₀ y θ',
    englishDescription: 'h₀ = 0 fixed; the player picks v₀ and θ',
  },
  {
    id: 'precision',
    spanishName: 'Precisión',
    englishName: 'Precision',
    spanishDescription: 'Rangos estrechos y pasos finos alrededor de los valores actuales',
    englishDescription: 'Narrow ranges and fine steps around the current values',
  },
];

// applyLaunchTemplate(templateId, launchVariables): changes the launch variables according
// to a launch template. The result is cleaned afterwards (cleanLaunchVariables).
function applyLaunchTemplate(templateId, launchVariables) {
  const speed = launchVariables.launchSpeed;
  const angle = launchVariables.launchAngle;
  const height = launchVariables.launchHeight;
  if (templateId === 'freeLaunch') {
    // every variable back to its default range, and free
    for (const key of LAUNCH_VARIABLE_KEYS) {
      const defaults = LAUNCH_VARIABLE_INFO[key].defaults;
      const record = launchVariables[key];
      record.start = defaults.start;
      record.min = defaults.min;
      record.max = defaults.max;
      record.step = defaults.step;
      record.locked = false;
    }
  } else if (templateId === 'angleOnly') {
    speed.locked = true;
    height.locked = true;
    angle.min = 0;
    angle.max = 85;
    angle.step = 1;
    angle.locked = false;
  } else if (templateId === 'speedOnly') {
    angle.locked = true;
    height.locked = true;
    speed.min = 5;
    speed.max = 45;
    speed.step = 0.5;
    speed.locked = false;
  } else if (templateId === 'heightOnly') {
    speed.locked = true;
    angle.locked = true;
    height.min = 0;
    height.max = 20;
    height.step = 0.5;
    height.locked = false;
  } else if (templateId === 'horizontalLaunch') {
    angle.start = 0;
    angle.locked = true;
    height.start = Math.max(8, height.start);
    height.locked = true;
    speed.min = 2;
    speed.max = 40;
    speed.step = 0.5;
    speed.locked = false;
  } else if (templateId === 'fromTheGround') {
    height.start = 0;
    height.locked = true;
    speed.locked = false;
    angle.min = 5;
    angle.max = 85;
    angle.locked = false;
  } else if (templateId === 'precision') {
    speed.locked = false;
    speed.min = roundToTwoDecimals(speed.start - 4);
    speed.max = roundToTwoDecimals(speed.start + 4);
    speed.step = 0.1;
    angle.locked = false;
    angle.min = roundToTwoDecimals(angle.start - 8);
    angle.max = roundToTwoDecimals(angle.start + 8);
    angle.step = 0.5;
    height.locked = true;
  }
}

// MIXED_TEMPLATES: one vector template plus one launch template.
const MIXED_TEMPLATES = [
  {
    id: 'findAndKnockDown',
    spanishName: 'Encuentra y derriba',
    englishName: 'Find and knock down',
    spanishDescription: 'Encontrar R y lanzamiento libre',
    englishDescription: 'Find R and free launch',
    vectorTemplate: 'findResultant',
    launchTemplate: 'freeLaunch',
  },
  {
    id: 'componentsAndAim',
    spanishName: 'Componentes y puntería',
    englishName: 'Components and aim',
    spanishDescription: 'De componentes a polar; solo el ángulo al lanzar',
    englishDescription: 'Components to polar; angle only when launching',
    vectorTemplate: 'componentsToPolar',
    launchTemplate: 'angleOnly',
  },
  {
    id: 'breakDownAndFire',
    spanishName: 'Descompón y dispara',
    englishName: 'Break down and fire',
    spanishDescription: 'Descomponer R; solo la velocidad al lanzar',
    englishDescription: 'Break down R; speed only when launching',
    vectorTemplate: 'breakDownResultant',
    launchTemplate: 'speedOnly',
  },
  {
    id: 'fromTheTower',
    spanishName: 'Desde la torre',
    englishName: 'From the tower',
    spanishDescription: 'Encontrar R; tiro horizontal desde una altura',
    englishDescription: 'Find R; horizontal launch from a height',
    vectorTemplate: 'findResultant',
    launchTemplate: 'horizontalLaunch',
  },
  {
    id: 'stopwatch',
    spanishName: 'Cronómetro',
    englishName: 'Stopwatch',
    spanishDescription: '¿Cuánto tardó?; lanzamiento desde el suelo',
    englishDescription: 'How long did it take?; launch from the ground',
    vectorTemplate: 'howLong',
    launchTemplate: 'fromTheGround',
  },
];

// findTemplate(list, id): finds a template of a list by its id.
function findTemplate(list, id) {
  for (const template of list) {
    if (template.id === id) {
      return template;
    }
  }
  return null;
}

// buildTemplateButtonsHtml(list, extraClass, group): the HTML of the buttons of one list.
function buildTemplateButtonsHtml(list, extraClass, group) {
  let html = '';
  for (const template of list) {
    const name = translate(template.spanishName, template.englishName);
    const description = translate(template.spanishDescription, template.englishDescription);
    html += `<button class="template-button ${extraClass}" type="button" data-group="${group}" data-template="${template.id}">${name}<small>${description}</small></button>`;
  }
  return html;
}

// buildTemplateButtons(): creates the template buttons of the three groups.
function buildTemplateButtons() {
  getElement('vectorTemplateButtons').innerHTML = buildTemplateButtonsHtml(VECTOR_TEMPLATES, '', 'vector');
  getElement('launchTemplateButtons').innerHTML = buildTemplateButtonsHtml(LAUNCH_TEMPLATES, 'template-button-launch', 'launch');
  getElement('mixedTemplateButtons').innerHTML = buildTemplateButtonsHtml(MIXED_TEMPLATES, 'template-button-mixed', 'mixed');
  const buttons = document.querySelectorAll('.template-button');
  for (const button of buttons) {
    button.addEventListener('click', function () {
      useTemplate(button.dataset.group, button.dataset.template);
    });
  }
}

// showTemplateGroups(): shows only the template groups that fit the type of level.
function showTemplateGroups() {
  const type = editorState.levelDraft.type;
  getElement('vectorTemplatesGroup').hidden = type === 'launch';
  getElement('mixedTemplatesGroup').hidden = type !== 'mixed';
  getElement('launchTemplatesGroup').hidden = type === 'displacement';
}

// useTemplate(group, templateId): applies a template to the level being edited.
//   group: 'vector', 'launch' or 'mixed'
function useTemplate(group, templateId) {
  const draft = editorState.levelDraft;
  saveUndoPoint();
  let template = null;
  if (group === 'vector') {
    template = findTemplate(VECTOR_TEMPLATES, templateId);
    applyVectorTemplate(templateId, draft.vectorPuzzle);
  }
  if (group === 'launch') {
    template = findTemplate(LAUNCH_TEMPLATES, templateId);
    applyLaunchTemplate(templateId, draft.launchVariables);
  }
  if (group === 'mixed') {
    template = findTemplate(MIXED_TEMPLATES, templateId);
    applyVectorTemplate(template.vectorTemplate, draft.vectorPuzzle);
    applyLaunchTemplate(template.launchTemplate, draft.launchVariables);
  }
  draft.launchVariables = cleanLaunchVariables(draft.launchVariables);
  if (draft.vectorPuzzle) {
    draft.vectorPuzzle = cleanVectorPuzzle(draft.vectorPuzzle, draft.worldWidth);
  }
  editorState.selection = null;
  refreshEditor();

  // is the level still correct after the template?
  let levelIsCorrect = true;
  if (levelHasVectors(draft)) {
    levelIsCorrect = checkPuzzleSolvability(draft.vectorPuzzle).solvable && !findVectorPuzzleProblem(draft);
  }
  const templateName = translate(template.spanishName, template.englishName);
  if (levelIsCorrect) {
    showEditorMessage(
      translate(
        `Plantilla “${templateName}” aplicada. Ajusta los valores a tu gusto. Deshacer la revierte.`,
        `Template “${templateName}” applied. Adjust the values as you like. Undo reverts it.`,
      ),
      'ok',
    );
  } else {
    showEditorMessage(
      translate(
        `Plantilla “${templateName}” aplicada. Ajusta los valores a tu gusto; revisa el aviso en rojo o pulsa Arreglar. Deshacer la revierte.`,
        `Template “${templateName}” applied. Adjust the values as you like; check the red notice or press Fix. Undo reverts it.`,
      ),
      'error',
    );
  }
}
