/* ======================================================================
   FILE: js/5-online/match-levels.js

   THE LEVELS OF AN ONLINE GAME
   The host chooses levels. Each level is sent as a "level reference":
     - a text with the id of a campaign level, for example 'c3' (everyone has
       the campaigns, so only the id is sent), or
     - the whole level object, for the host's own levels made in the editor.
   With the rules, each player builds their own list of levels: the same for
   everyone or different, and with the same values or slightly different ones.
   ====================================================================== */

// getAllCampaignLevels(): one list with the levels of the three campaigns.
function getAllCampaignLevels() {
  const allLevels = [];
  for (const campaign of CAMPAIGNS) {
    for (const level of campaign.levels) {
      allLevels.push(level);
    }
  }
  return allLevels;
}

// findCampaignLevel(id): a campaign level by its id, or null.
function findCampaignLevel(id) {
  for (const level of getAllCampaignLevels()) {
    if (level.id === id) {
      return level;
    }
  }
  return null;
}

// levelReferenceToLevel(reference, index): builds the playable level of a reference.
//   index: position of the level in the host list (used to give it a unique id)
function levelReferenceToLevel(reference, index) {
  if (typeof reference === 'string') {
    const level = findCampaignLevel(reference);
    if (level) {
      return deepCopy(level);
    }
    return null;
  }
  if (reference && typeof reference === 'object') {
    const level = cleanLevel(reference);
    level.id = '__online' + index;
    return level;
  }
  return null;
}

// getLevelReferenceLabel(reference): how to show a reference in the lists:
// { tag: 'D3', name: 'Descomponer', typeName: 'displacement' }
//   typeName ('launch', 'displacement', 'mixed') chooses the color of the label.
function getLevelReferenceLabel(reference) {
  if (typeof reference === 'string') {
    for (const campaign of CAMPAIGNS) {
      for (let index = 0; index < campaign.levels.length; index++) {
        const level = campaign.levels[index];
        if (level.id === reference) {
          // launch levels have no prefix in the menus; here they show "L"
          const prefix = campaign.prefix || 'L';
          return { tag: `${prefix}${index + 1}`, name: getLevelName(level), typeName: campaign.key };
        }
      }
    }
    return { tag: '?', name: reference, typeName: '' };
  }
  let typeName = 'launch';
  if (reference && (reference.type === 'displacement' || reference.type === 'mixed')) {
    typeName = reference.type;
  }
  let name = translate('Nivel', 'Level');
  if (reference && reference.name) {
    name = reference.name;
  }
  return { tag: '★', name: String(name).slice(0, 40), typeName: typeName };
}

// compactLevelForSending(level): a clean copy of one of the host's levels, without its id
// (and without vector puzzle if it is a launch level), ready to be sent.
function compactLevelForSending(level) {
  const copy = cleanLevel(deepCopy(level));
  delete copy.id;
  if (copy.type === 'launch') {
    copy.vectorPuzzle = null;
  }
  return copy;
}

// itemFitsAfterShift(item, shift, worldWidth): true if a piece or terrain block moved
// "shift" meters still fits inside the world (and outside the launcher zone).
function itemFitsAfterShift(item, shift, worldWidth) {
  return item.x + shift >= LAUNCH_CLEAR_ZONE && item.x + shift + item.width <= worldWidth;
}

// isNearPoint(item, x): true if x is on the item or less than 1.2 m away from it.
function isNearPoint(item, x) {
  return x > item.x - 1.2 && x < item.x + item.width + 1.2;
}

// varyLevel(level, generator): a version of the level with slightly different values
// (option "Different values for each player"). It uses a seeded random generator, so the
// host and the player build exactly the same version.
//   - launch levels: every structure moves a few meters left or right
//   - vector levels: lengths, speeds, accelerations and angles change a bit, always
//     keeping the puzzle solvable and inside the world
function varyLevel(level, generator) {
  if (level.type === 'launch') {
    for (let attempt = 0; attempt < 10; attempt++) {
      // a shift between −3 m and +3 m, in steps of 0.5 m
      const shift = (Math.floor(nextRandom(generator) * 13) - 6) * 0.5;
      let everythingFits = true;
      for (const piece of level.pieces) {
        if (!itemFitsAfterShift(piece, shift, level.worldWidth)) {
          everythingFits = false;
        }
      }
      for (const block of level.terrain) {
        if (!itemFitsAfterShift(block, shift, level.worldWidth)) {
          everythingFits = false;
        }
      }
      if (shift && everythingFits) {
        const shifted = deepCopy(level);
        for (const piece of shifted.pieces) {
          piece.x = roundToTwoDecimals(piece.x + shift);
        }
        for (const block of shifted.terrain) {
          block.x = roundToTwoDecimals(block.x + shift);
        }
        return shifted;
      }
    }
    return level;
  }

  for (let attempt = 0; attempt < 40; attempt++) {
    const varied = deepCopy(level);
    const puzzle = varied.vectorPuzzle;
    const newVectors = [];
    for (const vector of puzzle.vectors) {
      const newVector = deepCopy(vector);
      const values = calculateVectorValues(vector);
      const visibility = vector.visibility;
      // vectors given only by their components: change the components (whole numbers)
      const givenByComponents =
        vector.kind === 'distance' &&
        visibility.distance === 'hidden' &&
        visibility.angle === 'hidden' &&
        (visibility.dx !== 'hidden' || visibility.dy !== 'hidden');
      if (givenByComponents) {
        const baseX = Math.round(values.dx);
        const baseY = Math.round(values.dy);
        let x = 0;
        if (baseX) {
          x = baseX + Math.floor(nextRandom(generator) * 5) - 2;
        }
        let y = 0;
        if (baseY) {
          y = baseY + Math.floor(nextRandom(generator) * 5) - 2;
        }
        // the signs must not change
        if (baseX && Math.sign(x) !== Math.sign(baseX)) {
          x = baseX;
        }
        if (baseY && Math.sign(y) !== Math.sign(baseY)) {
          y = baseY;
        }
        newVector.distance = roundToTwoDecimals(Math.max(1, Math.hypot(x, y)));
        if (!isStraightDirection(vector.direction)) {
          newVector.angle = roundToTwoDecimals((Math.atan2(Math.abs(y), Math.abs(x)) * 180) / Math.PI);
        }
      } else {
        // the other vectors: multiply the main value by a factor between 0.75 and 1.30
        const factor = 0.75 + nextRandom(generator) * 0.55;
        if (vector.kind === 'distance') {
          newVector.distance = Math.max(1, Math.round(vector.distance * factor * 2) / 2);
        }
        if (vector.kind === 'velocity') {
          newVector.speed = Math.max(0.5, Math.round(vector.speed * factor * 2) / 2);
        }
        if (vector.kind === 'acceleration') {
          newVector.acceleration = Math.max(0.1, Math.round(vector.acceleration * factor * 10) / 10);
        }
        if (!isStraightDirection(vector.direction)) {
          newVector.angle = clampNumber(Math.round(vector.angle + nextRandom(generator) * 20 - 10), 8, 82);
        }
      }
      newVectors.push(newVector);
    }
    puzzle.vectors = newVectors;
    varied.vectorPuzzle = cleanVectorPuzzle(puzzle, varied.worldWidth);
    if (!checkPuzzleSolvability(varied.vectorPuzzle).solvable || findVectorPuzzleProblem(varied)) {
      continue; // try again
    }
    if (varied.type === 'mixed') {
      // point B must not be inside a structure
      const endX = calculateResultant(varied.vectorPuzzle).endPoint.x;
      let tooClose = false;
      for (const block of varied.terrain) {
        if (isNearPoint(block, endX)) {
          tooClose = true;
        }
      }
      for (const piece of varied.pieces) {
        if (isNearPoint(piece, endX)) {
          tooClose = true;
        }
      }
      if (tooClose) {
        continue;
      }
    }
    return varied;
  }
  return level;
}

// getPlayerLevels(rules, playerId): the list of levels of one player.
// Returns { levelOrder: positions in the host list, levels: the playable levels }.
function getPlayerLevels(rules, playerId) {
  const references = rules.levels;
  let order = [];
  for (let index = 0; index < references.length; index++) {
    order.push(index);
  }
  // "different levels per player": shuffle the list (with the player's own seed) and keep
  // only the first ones
  if (rules.differentLevels > 0) {
    const generator = createSeededRandom(`${rules.seed}|${playerId}|order`);
    // Fisher–Yates shuffle: swap each element with a random earlier one
    for (let index = order.length - 1; index > 0; index--) {
      const otherIndex = Math.floor(nextRandom(generator) * (index + 1));
      const saved = order[index];
      order[index] = order[otherIndex];
      order[otherIndex] = saved;
    }
    order = order.slice(0, Math.min(rules.differentLevels, order.length));
  }
  const levelOrder = [];
  const levels = [];
  for (const index of order) {
    let level = levelReferenceToLevel(references[index], index);
    if (!level) {
      continue;
    }
    if (rules.differentValues) {
      level = varyLevel(level, createSeededRandom(`${rules.seed}|${playerId}|${index}`));
    }
    // attempts: 0 = unlimited (999), more than 0 = that number of shots and answer attempts
    if (rules.attempts === 0) {
      level.shotCount = 999;
      if (level.vectorPuzzle) {
        level.vectorPuzzle.attempts = 999;
      }
    } else if (rules.attempts > 0) {
      level.shotCount = rules.attempts;
      if (level.vectorPuzzle) {
        level.vectorPuzzle.attempts = rules.attempts;
      }
    }
    level.id = '__online' + index;
    levelOrder.push(index);
    levels.push(level);
  }
  return { levelOrder: levelOrder, levels: levels };
}
