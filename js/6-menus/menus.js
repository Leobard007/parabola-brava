/* ======================================================================
   FILE: js/6-menus/menus.js

   MENUS: HOME, LEVEL SELECT AND SETTINGS
   - showView: switches between the screens (home, level select, game, online).
   - The small pictures of the mode cards (drawn with SVG).
   - The level select screen: mode cards and the list of levels.
   - The buttons of the home screen and the Settings menu (language, animation,
     sound, reset progress, version and update).
   ====================================================================== */

// showView(view): shows one screen and hides the others.
//   view: 'home', 'levelSelect', 'game' or 'online'
function showView(view) {
  currentView = view;
  getElement('homeScreen').hidden = view !== 'home';
  getElement('levelSelectScreen').hidden = view !== 'levelSelect';
  getElement('gameScreen').hidden = view !== 'game';
  getElement('onlineScreen').hidden = view !== 'online';
  if (view !== 'home') {
    getElement('onlineMenu').hidden = true;
    getElement('onlineButton').setAttribute('aria-expanded', 'false');
  }
  // the menus use the blueprint background; the game screen uses its own colors
  document.body.classList.toggle('showing-menu', view !== 'game');
  if (view !== 'game') {
    document.documentElement.style.background = COLORS.blueprint;
  } else {
    document.documentElement.style.background = '';
  }
  menuBackgroundCanvas.hidden = view === 'game';
  if (view !== 'game') {
    getElement('editorPropertyCard').hidden = true;
    editorState.dragging = null;
  }
  if (view === 'levelSelect') {
    renderModeCards();
  }
  if (view !== 'home') {
    getElement('settingsMenu').hidden = true;
    getElement('settingsButton').setAttribute('aria-expanded', 'false');
  }
  menuBackgroundNeedsRedraw = true;
  window.scrollTo(0, 0);
}

/* ----------------------------------------------------------------------
   SMALL PICTURES (SVG) FOR THE MODE CARDS AND THE "HOW TO PLAY" GUIDE
   SVG is a way to describe a drawing with text: <line>, <rect>, <circle>,
   <path>... The browser draws it.
   ---------------------------------------------------------------------- */

// buildModePictureSvg(modeKey, big): the picture of a mode ('launch', 'displacement',
// 'mixed' or 'custom'). big = true makes the taller version used in the guide.
function buildModePictureSvg(modeKey, big) {
  let viewBox = '0 0 300 90';
  let groundY = 76;
  let stretch = 1;
  let top = 4;
  if (big) {
    viewBox = '0 0 300 130';
    groundY = 112;
    stretch = 1.25;
    top = 0;
  }
  let patternId = 'gridPattern' + modeKey;
  if (big) {
    patternId += 'Big';
  }
  const ground = `<line x1="0" y1="${groundY}" x2="300" y2="${groundY}" stroke="#2b2b3a" stroke-width="2"/>`;
  const grid = `<pattern id="${patternId}" width="15" height="15" patternUnits="userSpaceOnUse"><path d="M15 0H0V15" fill="none" stroke="#dfe7f4" stroke-width="1"/></pattern><rect width="300" height="${groundY}" fill="url(#${patternId})"/>`;

  // piglet(x, y, size): a small piglet
  function piglet(x, y, size) {
    if (size === undefined) {
      size = 1;
    }
    return `<g transform="translate(${x} ${y}) scale(${size})"><ellipse cx="0" cy="-9" rx="11" ry="9.5" fill="#7cc46b" stroke="#3d7a32" stroke-width="2"/><circle cx="-4" cy="-11" r="2" fill="#1b1b29"/><circle cx="4" cy="-11" r="2" fill="#1b1b29"/><ellipse cx="0" cy="-6" rx="4" ry="2.6" fill="#a7db97" stroke="#3d7a32" stroke-width="1.2"/></g>`;
  }
  // launcherShape(x): the launcher with the red ball
  function launcherShape(x) {
    return `<rect x="${x - 4}" y="${groundY - 18}" width="8" height="18" fill="#8a5a33"/><circle cx="${x}" cy="${groundY - 22}" r="6" fill="#d94d3f" stroke="#a83226" stroke-width="2"/>`;
  }
  // parabola(fromX, toX, topY): a dashed red curve
  function parabola(fromX, toX, topY) {
    return `<path d="M${fromX} ${groundY - 22} Q ${(fromX + toX) / 2} ${topY} ${toX} ${groundY - 10}" fill="none" stroke="#d94d3f" stroke-width="2.4" stroke-dasharray="5 5"/>`;
  }
  // arrow(fromX, fromY, toX, toY, color, dashed): an arrow with its head
  function arrow(fromX, fromY, toX, toY, color, dashed) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const head = 8;
    let dash = '';
    if (dashed) {
      dash = 'stroke-dasharray="5 4"';
    }
    return `<line x1="${fromX}" y1="${fromY}" x2="${toX}" y2="${toY}" stroke="${color}" stroke-width="2.6" ${dash}/><path d="M${toX} ${toY} L${toX - head * Math.cos(angle - 0.45)} ${toY - head * Math.sin(angle - 0.45)} L${toX - head * Math.cos(angle + 0.45)} ${toY - head * Math.sin(angle + 0.45)}Z" fill="${color}"/>`;
  }
  // blocks(x): a small structure of wood and stone
  function blocks(x) {
    return `<rect x="${x}" y="${groundY - 30}" width="12" height="30" fill="#c8955c" stroke="#8a5a33" stroke-width="2"/><rect x="${x + 26}" y="${groundY - 30}" width="12" height="30" fill="#9aa3b2" stroke="#5d6675" stroke-width="2"/><rect x="${x - 2}" y="${groundY - 40}" width="42" height="10" fill="#c8955c" stroke="#8a5a33" stroke-width="2"/>`;
  }

  let body = '';
  if (modeKey === 'launch') {
    body = launcherShape(30) + parabola(30, 240, top) + blocks(222) + piglet(241, groundY - 40);
  }
  if (modeKey === 'displacement') {
    const y = groundY - 14;
    body =
      piglet(50, y + 14) +
      arrow(50, y, 130, y - 34 * stretch, '#2f5fb3') +
      arrow(130, y - 34 * stretch, 200, y - 34 * stretch, '#2f5fb3') +
      arrow(200, y - 34 * stretch, 240, y - 60 * stretch, '#2f5fb3') +
      arrow(50, y, 240, y - 60 * stretch, '#a83226', true) +
      `<g opacity=".45">${piglet(240, y - 60 * stretch + 14)}</g>`;
  }
  if (modeKey === 'mixed') {
    const y = groundY - 14;
    body =
      arrow(160, y, 210, y - 30 * stretch, '#2f5fb3') +
      arrow(210, y - 30 * stretch, 255, y - 30 * stretch, '#2f5fb3') +
      piglet(255, y - 30 * stretch + 14) +
      `<rect x="245" y="${y - 30 * stretch + 14}" width="20" height="${groundY - (y - 30 * stretch + 14)}" fill="#c9b18a" stroke="#7a6240" stroke-width="2"/>` +
      launcherShape(30) +
      `<path d="M30 ${groundY - 22} Q 140 ${top} 250 ${y - 30 * stretch}" fill="none" stroke="#d94d3f" stroke-width="2.4" stroke-dasharray="5 5"/>`;
  }
  if (modeKey === 'custom') {
    body =
      blocks(120) +
      `<rect x="190" y="${groundY - 20}" width="60" height="20" fill="#c9b18a" stroke="#7a6240" stroke-width="2"/>` +
      piglet(220, groundY - 20) +
      `<g transform="translate(60 ${groundY - 50}) rotate(-35)"><rect x="0" y="-5" width="54" height="10" fill="#ffd166" stroke="#2b2b3a" stroke-width="2"/><path d="M54 -5 L66 0 L54 5Z" fill="#2b2b3a"/><rect x="-8" y="-5" width="8" height="10" fill="#e88" stroke="#2b2b3a" stroke-width="2"/></g>` +
      `<rect x="90" y="8" width="60" height="22" rx="4" fill="none" stroke="#2f5fb3" stroke-width="2" stroke-dasharray="4 3"/>`;
  }
  return `<svg viewBox="${viewBox}" aria-hidden="true">${grid}${ground}${body}</svg>`;
}

/* ----------------------------------------------------------------------
   LEVEL SELECT SCREEN
   ---------------------------------------------------------------------- */

// MODE_KEYS: the four mode cards: the three campaigns and "My levels".
const MODE_KEYS = ['launch', 'displacement', 'mixed', 'custom'];

// findStartingModeKey(): the mode selected when the screen opens: the campaign of the
// last level played (or the first campaign).
function findStartingModeKey() {
  const lastLevel = progress.lastLevelId && findLevel(progress.lastLevelId);
  if (!lastLevel) {
    return 'launch';
  }
  const campaignPlace = findCampaignOfLevel(lastLevel);
  if (campaignPlace) {
    return campaignPlace.campaign.key;
  }
  return 'custom';
}
// selectedModeKey: the selected mode card.
let selectedModeKey = findStartingModeKey();

// getModeInfo(modeKey): the title and description of a mode.
function getModeInfo(modeKey) {
  if (modeKey === 'displacement') {
    return {
      title: translate('Desplazamiento', 'Displacement'),
      description: translate('Calcula a dónde se movió el cochinito con sus vectores.', 'Work out where the piglet moved using its vectors.'),
    };
  }
  if (modeKey === 'mixed') {
    return {
      title: translate('Mixta', 'Mixed'),
      description: translate('Primero encuentra al cochinito; después lánzale.', 'First find the piglet, then launch at it.'),
    };
  }
  if (modeKey === 'custom') {
    return {
      title: translate('Mis niveles', 'My levels'),
      description: translate('Los niveles que creaste o importaste en el editor.', 'The levels you created or imported in the editor.'),
    };
  }
  return {
    title: translate('Lanzamiento', 'Launch'),
    description: translate('Ajusta velocidad, ángulo y altura para derribar a los cochinitos.', 'Set speed, angle and height to knock down the piglets.'),
  };
}

// findCampaignByKey(key): the campaign with this key.
function findCampaignByKey(key) {
  for (const campaign of CAMPAIGNS) {
    if (campaign.key === key) {
      return campaign;
    }
  }
  return null;
}

// getCampaignStats(campaign): stars won, maximum stars, levels unlocked and total levels.
function getCampaignStats(campaign) {
  let stars = 0;
  for (const level of campaign.levels) {
    stars += progress.starsByLevel[level.id] || 0;
  }
  return {
    stars: stars,
    maxStars: campaign.levels.length * 3,
    unlocked: Math.min(campaign.levels.length, progress[campaign.unlockField]),
    total: campaign.levels.length,
  };
}

// renderModeCards(): draws the four mode cards and the level list of the selected one.
function renderModeCards() {
  let html = '';
  for (const modeKey of MODE_KEYS) {
    const info = getModeInfo(modeKey);
    let progressText;
    if (modeKey === 'custom') {
      if (customLevels.length === 0) {
        progressText = translate('Aún no tienes niveles', 'No levels yet');
      } else if (customLevels.length === 1) {
        progressText = translate('1 nivel', '1 level');
      } else {
        progressText = translate(`${customLevels.length} niveles`, `${customLevels.length} levels`);
      }
    } else {
      const stats = getCampaignStats(findCampaignByKey(modeKey));
      progressText = `★ ${stats.stars}/${stats.maxStars} · ${translate('nivel', 'level')} ${stats.unlocked}/${stats.total}`;
    }
    html += `<button class="mode-card mode-card-${modeKey}" type="button" data-mode="${modeKey}" aria-pressed="${selectedModeKey === modeKey}">${buildModePictureSvg(modeKey)}<h3>${info.title}</h3><p>${info.description}</p><span class="mode-progress">${progressText}</span></button>`;
  }
  getElement('modeCardGrid').innerHTML = html;
  const cards = getElement('modeCardGrid').querySelectorAll('.mode-card');
  for (const card of cards) {
    card.addEventListener('click', function () {
      playClickSound();
      selectedModeKey = card.dataset.mode;
      renderModeCards();
    });
  }
  renderLevelList();
}

// getLevelCardType(level): the color name of a card by level type.
function getLevelCardType(level) {
  return level.type; // 'launch', 'displacement' or 'mixed'
}

// renderLevelList(): the list of levels of the selected mode.
function renderLevelList() {
  const info = getModeInfo(selectedModeKey);
  const panel = getElement('levelListPanel');
  let cards = '';
  if (selectedModeKey === 'custom') {
    for (const level of customLevels) {
      const stars = progress.starsByLevel[level.id] || 0;
      let tag = '★';
      if (level.type === 'displacement') {
        tag = 'D';
      }
      if (level.type === 'mixed') {
        tag = 'M';
      }
      let starsHtml = `<small class="level-card-status-muted">${translate('Sin estrellas', 'No stars yet')}</small>`;
      if (stars) {
        starsHtml = `<small class="">${'★'.repeat(stars)}</small>`;
      }
      // .replace(/</g, '&lt;') stops a name with "<" from being read as HTML
      cards += `<button class="level-card level-card-${getLevelCardType(level)}" type="button" data-level-id="${level.id}"><b>${tag}</b><span>${level.name.replace(/</g, '&lt;')}</span>${starsHtml}</button>`;
    }
    cards += `<button class="level-card level-card-new" type="button" id="createLevelCard"><b>+</b><span>${translate('Crear nivel', 'Create level')}</span><small class="level-card-status-muted">${translate('Abre el editor', 'Opens the editor')}</small></button>`;
  } else {
    const campaign = findCampaignByKey(selectedModeKey);
    const unlockedCount = progress[campaign.unlockField];
    for (let index = 0; index < campaign.levels.length; index++) {
      const level = campaign.levels[index];
      const stars = progress.starsByLevel[level.id] || 0;
      const locked = index >= unlockedCount;
      const number = `${campaign.prefix}${index + 1}`;
      let lockedAttributes = '';
      let statusHtml;
      if (locked) {
        lockedAttributes = `disabled aria-label="${number}. ${translate('Bloqueado', 'Locked')}"`;
        statusHtml = `<small class="level-card-status-muted">${translate('🔒 Bloqueado', '🔒 Locked')}</small>`;
      } else if (stars) {
        statusHtml = `<small class="">${'★'.repeat(stars)}<span style="opacity:.25">${'★'.repeat(3 - stars)}</span></small>`;
      } else {
        statusHtml = `<small class="level-card-status-muted">${translate('Por jugar', 'Not played')}</small>`;
      }
      cards += `<button class="level-card level-card-${campaign.key}" type="button" data-level-id="${level.id}" ${lockedAttributes}>
        <b>${number}</b><span>${getLevelName(level)}</span>${statusHtml}</button>`;
    }
  }
  let extra = '';
  if (selectedModeKey !== 'custom') {
    extra = ' ' + translate('Supera un nivel para desbloquear el siguiente.', 'Beat a level to unlock the next one.');
  }
  panel.innerHTML = `<h3>${info.title}</h3><p>${info.description}${extra}</p><div class="level-card-grid">${cards}</div>`;
  const levelCards = panel.querySelectorAll('.level-card[data-level-id]');
  for (const card of levelCards) {
    card.addEventListener('click', function () {
      playClickSound();
      const level = findLevel(card.dataset.levelId);
      if (level) {
        loadLevel(level);
      }
    });
  }
  const createCard = getElement('createLevelCard');
  if (createCard) {
    createCard.addEventListener('click', function () {
      playClickSound();
      editorState.levelDraft = null;
      openEditor(null);
    });
  }
}

/* ----------------------------------------------------------------------
   BUTTONS OF THE HOME SCREEN AND THE LEVEL SELECT SCREEN
   ---------------------------------------------------------------------- */
getElement('playButton').addEventListener('click', function () {
  playClickSound();
  showView('levelSelect');
});
getElement('howToPlayButton').addEventListener('click', function () {
  playClickSound();
  openHowToPlay();
});
getElement('levelSelectBackButton').addEventListener('click', function () {
  playClickSound();
  showView('home');
});
getElement('openEditorButton').addEventListener('click', function () {
  playClickSound();
  openEditor(null);
});
getElement('gameMenuButton').addEventListener('click', function () {
  playClickSound();
  if (gameState.online) {
    handleOnlineMenuButton();
    return;
  }
  if (gameState.screen === 'edit') {
    editorState.selection = null;
  }
  showView('levelSelect');
});

/* ----------------------------------------------------------------------
   SETTINGS MENU
   ---------------------------------------------------------------------- */
getElement('settingsButton').addEventListener('click', function (event) {
  event.stopPropagation(); // so the click does not reach the document (which closes menus)
  playClickSound();
  const menu = getElement('settingsMenu');
  const opening = menu.hidden;
  menu.hidden = !opening;
  getElement('settingsButton').setAttribute('aria-expanded', String(opening));
});
// a click anywhere else closes the settings menu
document.addEventListener('click', function (event) {
  const menu = getElement('settingsMenu');
  if (!menu.hidden && !menu.contains(event.target) && event.target !== getElement('settingsButton')) {
    menu.hidden = true;
    getElement('settingsButton').setAttribute('aria-expanded', 'false');
  }
});
// the language buttons (data-language="es" / "en")
const languageButtons = document.querySelectorAll('[data-language]');
for (const button of languageButtons) {
  button.addEventListener('click', function () {
    if (settings.language === button.dataset.language) {
      return;
    }
    settings.language = button.dataset.language;
    saveSettings();
    playClickSound();
    applyLanguageToPage();
    renderModeCards();
    renderHowToPlay();
    if (gameState.level) {
      updateGameBar();
      updateHud();
    }
    menuBackgroundNeedsRedraw = true;
  });
}
getElement('backgroundAnimationCheckbox').checked = settings.backgroundAnimation;
getElement('soundEffectsCheckbox').checked = settings.soundEffects;
getElement('backgroundAnimationCheckbox').addEventListener('change', function (event) {
  settings.backgroundAnimation = event.target.checked;
  saveSettings();
  menuBackgroundNeedsRedraw = true;
});
getElement('soundEffectsCheckbox').addEventListener('change', function (event) {
  settings.soundEffects = event.target.checked;
  saveSettings();
  playClickSound();
});

// resetIsArmed: true after the first press of "Reset progress" (the second press resets).
let resetIsArmed = false;
getElement('resetProgressButton').addEventListener('click', function (event) {
  event.stopPropagation();
  const button = getElement('resetProgressButton');
  const note = getElement('resetProgressNote');
  if (!resetIsArmed) {
    resetIsArmed = true;
    button.textContent = translate('¿Seguro? Pulsa otra vez', 'Sure? Press again');
    setTimeout(function () {
      if (resetIsArmed) {
        resetIsArmed = false;
        applyLanguageToPage(); // puts back the normal texts
      }
    }, 3500);
    return;
  }
  progress = createFreshProgress();
  saveProgress();
  selectedModeKey = 'launch';
  resetIsArmed = false;
  button.textContent = translate('Reiniciar progreso', 'Reset progress');
  note.textContent = translate('Progreso reiniciado. Todos los niveles vuelven a empezar.', 'Progress reset. Every campaign starts over.');
  playPuffSound();
  setTimeout(function () {
    if (!resetIsArmed) {
      applyLanguageToPage();
    }
  }, 3500);
});

/* ----------------------------------------------------------------------
   VERSION AND UPDATE
   The server has a small file, version.json, with the number of the published
   version. If it is bigger than APP_VERSION, there is a newer version.
   ---------------------------------------------------------------------- */

// updateCheck: the result of the last check.
//   status: 'idle', 'checking', 'latest', 'newer', 'error' or 'updating'
const updateCheck = { remoteVersion: null, status: 'idle' };

// renderVersionInfo(): the version text and the update button of the settings menu.
function renderVersionInfo() {
  const versionText = getElement('versionText');
  const updateButton = getElement('updateButton');
  if (!versionText) {
    return;
  }
  let text = translate(`Versión ${APP_VERSION}`, `Version ${APP_VERSION}`);
  if (updateCheck.status === 'latest') {
    text += translate(' · la más reciente ✓', ' · up to date ✓');
  } else if (updateCheck.status === 'newer') {
    text += translate(` · hay una nueva: v${updateCheck.remoteVersion}`, ` · a new one is out: v${updateCheck.remoteVersion}`);
  }
  versionText.textContent = text;
  if (updateCheck.status === 'newer') {
    updateButton.textContent = translate(`Actualizar a v${updateCheck.remoteVersion}`, `Update to v${updateCheck.remoteVersion}`);
  } else if (updateCheck.status === 'checking') {
    updateButton.textContent = translate('Buscando…', 'Checking…');
  } else if (updateCheck.status === 'updating') {
    updateButton.textContent = translate('Actualizando…', 'Updating…');
  } else {
    updateButton.textContent = translate('Buscar actualización', 'Check for updates');
  }
  updateButton.disabled = updateCheck.status === 'checking' || updateCheck.status === 'updating';
  updateButton.classList.toggle('button-accent', updateCheck.status === 'newer');
}

// checkForNewVersion(): asks the server which version is published (version.json),
// without using the copy saved by the browser. Returns the new status.
async function checkForNewVersion() {
  // opened as a local file (file://): there is no server to ask
  if (!/^https?:/.test(location.protocol)) {
    updateCheck.status = 'idle';
    renderVersionInfo();
    return null;
  }
  updateCheck.status = 'checking';
  renderVersionInfo();
  try {
    // "?t=..." makes every address different, so no saved copy is used
    const response = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    const data = await response.json();
    const remoteVersion = parseNumber(data.version, 0);
    updateCheck.remoteVersion = remoteVersion;
    if (remoteVersion > APP_VERSION) {
      updateCheck.status = 'newer';
    } else {
      updateCheck.status = 'latest';
    }
  } catch (error) {
    updateCheck.status = 'error';
  }
  renderVersionInfo();
  return updateCheck.status;
}

// updateToNewVersion(): downloads every file of the game again (skipping the saved copies)
// and reloads the page.
async function updateToNewVersion() {
  updateCheck.status = 'updating';
  renderVersionInfo();
  try {
    const response = await fetch('index.html', { cache: 'reload' });
    const html = await response.text();
    // find every "src=" or "href=" that points to the js/ or css/ folders
    const filePattern = /(?:src|href)="((?:js|css)\/[^"]+)"/g;
    const downloads = [];
    let match = filePattern.exec(html);
    while (match !== null) {
      // start the download now (they all download at the same time)
      downloads.push(
        fetch(match[1], { cache: 'reload' }).catch(function () {
          // ignore a file that fails
        }),
      );
      match = filePattern.exec(html);
    }
    // wait until every download finished
    for (const download of downloads) {
      await download;
    }
  } catch (error) {
    // nothing to do: reload anyway
  }
  location.reload();
}

getElement('updateButton').addEventListener('click', async function (event) {
  event.stopPropagation();
  playClickSound();
  if (updateCheck.status === 'newer') {
    updateToNewVersion();
    return;
  }
  const status = await checkForNewVersion();
  if (status === 'newer') {
    updateToNewVersion();
  } else if (status === 'latest') {
    showToast(translate('Ya tienes la versión más reciente.', 'You already have the latest version.'));
  } else if (status === 'error') {
    showToast(translate('No se pudo comprobar. ¿Hay internet?', 'Couldn’t check. Are you online?'));
  } else {
    updateToNewVersion(); // opened as a local file: just reload
  }
});
