/* ======================================================================
   ARCHIVO: js/6-menus/menus.js

   MENÚS: INICIO, SELECCIÓN Y CONFIGURACIÓN
   showView() cambia de pantalla. También están las tarjetas de modo, la lista de niveles,
   la configuración (idioma, animaciones, sonido, reiniciar progreso) y los botones del inicio.
   ====================================================================== */

/* =========================================================
   MENÚS: INICIO, SELECCIÓN Y CONFIGURACIÓN
   ========================================================= */

// Canvas del fondo animado de los menús.
const bg = $('bg'),
  bgx = bg.getContext('2d');

// Variables del fondo: bgDirty = hay que redibujarlo; bgW/bgH = tamaño; bgT = tiempo de la animación.
let bgDirty = true,
  bgW = 0,
  bgH = 0,
  bgDpr = 1,
  bgT = 0;

// Ajusta el canvas del fondo al tamaño de la ventana.
function bgResize() {
  bgDpr = Math.min(2, window.devicePixelRatio || 1);
  bgW = window.innerWidth;
  bgH = window.innerHeight;
  bg.width = Math.round(bgW * bgDpr);
  bg.height = Math.round(bgH * bgDpr);
  bgDirty = true;
}
window.addEventListener('resize', bgResize);
bgResize();

// Cambia de pantalla: 'home', 'select', 'game' u 'online'. Muestra una y oculta las demás.
function showView(v) {
  VIEW = v;
  $('homeScreen').hidden = v !== 'home';
  $('selectScreen').hidden = v !== 'select';
  $('gameScreen').hidden = v !== 'game';
  $('onlineScreen').hidden = v !== 'online';
  if (v !== 'home') {
    $('onlineMenu').hidden = true;
    $('btnOnline').setAttribute('aria-expanded', 'false');
  }
  document.body.classList.toggle('menu', v !== 'game');
  document.documentElement.style.background = v !== 'game' ? C.bp : '';
  bg.hidden = v === 'game';
  if (v !== 'game') {
    $('pop').hidden = true;
    E.drag = null;
  }
  if (v === 'select') renderMenus();
  if (v !== 'home') {
    $('setMenu').hidden = true;
    $('btnSettings').setAttribute('aria-expanded', 'false');
  }
  bgDirty = true;
  window.scrollTo(0, 0);
}

/* --- figuras pequeñas para las tarjetas y la guía --- */
// Dibujos pequeños (SVG) de las tarjetas de modo y de la guía "Cómo jugar".
function figSVG(kind, big) {
  const vb = big ? '0 0 300 130' : '0 0 300 90',
    gy = big ? 112 : 76,
    k = big ? 1.25 : 1;
  const ground = `<line x1="0" y1="${gy}" x2="300" y2="${gy}" stroke="#2b2b3a" stroke-width="2"/>`;
  const grid = `<pattern id="gp${kind}${big ? 'b' : ''}" width="15" height="15" patternUnits="userSpaceOnUse"><path d="M15 0H0V15" fill="none" stroke="#dfe7f4" stroke-width="1"/></pattern><rect width="300" height="${gy}" fill="url(#gp${kind}${big ? 'b' : ''})"/>`;
  const blob = (x, y, s = 1) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="-9" rx="11" ry="9.5" fill="#7cc46b" stroke="#3d7a32" stroke-width="2"/><circle cx="-4" cy="-11" r="2" fill="#1b1b29"/><circle cx="4" cy="-11" r="2" fill="#1b1b29"/><ellipse cx="0" cy="-6" rx="4" ry="2.6" fill="#a7db97" stroke="#3d7a32" stroke-width="1.2"/></g>`;
  const launcher = (x) =>
    `<rect x="${x - 4}" y="${gy - 18}" width="8" height="18" fill="#8a5a33"/><circle cx="${x}" cy="${gy - 22}" r="6" fill="#d94d3f" stroke="#a83226" stroke-width="2"/>`;
  const arc = (x0, x1, top) =>
    `<path d="M${x0} ${gy - 22} Q ${(x0 + x1) / 2} ${top} ${x1} ${gy - 10}" fill="none" stroke="#d94d3f" stroke-width="2.4" stroke-dasharray="5 5"/>`;
  const arrow = (x0, y0, x1, y1, col, dash) => {
    const a = Math.atan2(y1 - y0, x1 - x0),
      h = 8;
    return `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${col}" stroke-width="2.6" ${dash ? 'stroke-dasharray="5 4"' : ''}/><path d="M${x1} ${y1} L${x1 - h * Math.cos(a - 0.45)} ${y1 - h * Math.sin(a - 0.45)} L${x1 - h * Math.cos(a + 0.45)} ${y1 - h * Math.sin(a + 0.45)}Z" fill="${col}"/>`;
  };
  const blocks = (x) =>
    `<rect x="${x}" y="${gy - 30}" width="12" height="30" fill="#c8955c" stroke="#8a5a33" stroke-width="2"/><rect x="${x + 26}" y="${gy - 30}" width="12" height="30" fill="#9aa3b2" stroke="#5d6675" stroke-width="2"/><rect x="${x - 2}" y="${gy - 40}" width="42" height="10" fill="#c8955c" stroke="#8a5a33" stroke-width="2"/>`;
  let body = '';
  const top = big ? 0 : 4;
  if (kind === 'c') body = launcher(30) + arc(30, 240, top) + blocks(222) + blob(241, gy - 40);
  if (kind === 'd') {
    const y = gy - 14;
    body =
      blob(50, y + 14) +
      arrow(50, y, 130, y - 34 * k, '#2f5fb3') +
      arrow(130, y - 34 * k, 200, y - 34 * k, '#2f5fb3') +
      arrow(200, y - 34 * k, 240, y - 60 * k, '#2f5fb3') +
      arrow(50, y, 240, y - 60 * k, '#a83226', true) +
      `<g opacity=".45">${blob(240, y - 60 * k + 14)}</g>`;
  }
  if (kind === 'm') {
    const y = gy - 14;
    body =
      arrow(160, y, 210, y - 30 * k, '#2f5fb3') +
      arrow(210, y - 30 * k, 255, y - 30 * k, '#2f5fb3') +
      blob(255, y - 30 * k + 14) +
      `<rect x="245" y="${y - 30 * k + 14}" width="20" height="${gy - (y - 30 * k + 14)}" fill="#c9b18a" stroke="#7a6240" stroke-width="2"/>` +
      launcher(30) +
      `<path d="M30 ${gy - 22} Q 140 ${top} 250 ${y - 30 * k}" fill="none" stroke="#d94d3f" stroke-width="2.4" stroke-dasharray="5 5"/>`;
  }
  if (kind === 'u')
    body =
      blocks(120) +
      `<rect x="190" y="${gy - 20}" width="60" height="20" fill="#c9b18a" stroke="#7a6240" stroke-width="2"/>` +
      blob(220, gy - 20) +
      `<g transform="translate(60 ${gy - 50}) rotate(-35)"><rect x="0" y="-5" width="54" height="10" fill="#ffd166" stroke="#2b2b3a" stroke-width="2"/><path d="M54 -5 L66 0 L54 5Z" fill="#2b2b3a"/><rect x="-8" y="-5" width="8" height="10" fill="#e88" stroke="#2b2b3a" stroke-width="2"/></g>` +
      `<rect x="90" y="8" width="60" height="22" rx="4" fill="none" stroke="#2f5fb3" stroke-width="2" stroke-dasharray="4 3"/>`;
  return `<svg viewBox="${vb}" aria-hidden="true">${grid}${ground}${body}</svg>`;
}

// Modo seleccionado en el menú de selección (c, d, m o u).
let MSEL = (() => {
  const l = prog.last && findLevel(prog.last);
  if (!l) return 'c';
  const c = campaignOf(l);
  return c ? c.key : 'u';
})();

// Títulos y descripciones de los modos de juego.
const MODE_INFO = () => ({
  c: {
    t: L('Lanzamiento', 'Launch'),
    p: L(
      'Ajusta velocidad, ángulo y altura para derribar a los cochinitos.',
      'Set speed, angle and height to knock down the piglets.',
    ),
  },
  d: {
    t: L('Desplazamiento', 'Displacement'),
    p: L(
      'Calcula a dónde se movió el cochinito con sus vectores.',
      'Work out where the piglet moved using its vectors.',
    ),
  },
  m: {
    t: L('Mixta', 'Mixed'),
    p: L('Primero encuentra al cochinito; después lánzale.', 'First find the piglet, then launch at it.'),
  },
  u: {
    t: L('Mis niveles', 'My levels'),
    p: L(
      'Los niveles que creaste o importaste en el editor.',
      'The levels you created or imported in the editor.',
    ),
  },
});

// Estrellas y niveles desbloqueados de una campaña.
function campStats(c) {
  const stars = c.list.reduce((s, l) => s + (prog.stars[l.id] || 0), 0);
  return { stars, max: c.list.length * 3, open: Math.min(c.list.length, prog[c.unlock]), n: c.list.length };
}

// Dibuja las tarjetas de modo del menú de selección.
function renderMenus() {
  const info = MODE_INFO();
  $('modeGrid').innerHTML = ['c', 'd', 'm', 'u']
    .map((k) => {
      let pr;
      if (k === 'u')
        pr = customs.length
          ? L(
              `${customs.length} ${customs.length === 1 ? 'nivel' : 'niveles'}`,
              `${customs.length} ${customs.length === 1 ? 'level' : 'levels'}`,
            )
          : L('Aún no tienes niveles', 'No levels yet');
      else {
        const s = campStats(CAMPAIGNS.find((c) => c.key === k));
        pr = `★ ${s.stars}/${s.max} · ${L('nivel', 'level')} ${s.open}/${s.n}`;
      }
      return `<button class="mode ${k}" type="button" data-mode="${k}" aria-pressed="${MSEL === k}">${figSVG(k)}<h3>${info[k].t}</h3><p>${info[k].p}</p><span class="prog">${pr}</span></button>`;
    })
    .join('');
  $('modeGrid')
    .querySelectorAll('.mode')
    .forEach(
      (b) =>
        (b.onclick = () => {
          SND.click();
          MSEL = b.dataset.mode;
          renderMenus();
        }),
    );
  renderLevelPanel();
}

// Dibuja la lista de niveles del modo seleccionado.
function renderLevelPanel() {
  const info = MODE_INFO()[MSEL],
    pnl = $('levelPanel');
  let cards = '';
  if (MSEL === 'u') {
    cards =
      customs
        .map((l) => {
          const st = prog.stars[l.id] || 0,
            tag = { clasico: '', despl: 'D', mixto: 'M' }[l.type],
            cls = { clasico: 'c', despl: 'd', mixto: 'm' }[l.type];
          return `<button class="lvCard ${cls}" type="button" data-id="${l.id}"><b>${tag || '★'}</b><span>${l.name.replace(/</g, '&lt;')}</span><small class="${st ? '' : 'off'}">${st ? '★'.repeat(st) : L('Sin estrellas', 'No stars yet')}</small></button>`;
        })
        .join('') +
      `<button class="lvCard new" type="button" id="lvNew"><b>+</b><span>${L('Crear nivel', 'Create level')}</span><small class="off">${L('Abre el editor', 'Opens the editor')}</small></button>`;
  } else {
    const c = CAMPAIGNS.find((x) => x.key === MSEL),
      open = prog[c.unlock];
    cards = c.list
      .map((l, i) => {
        const st = prog.stars[l.id] || 0,
          locked = i >= open;
        return `<button class="lvCard ${c.cls}" type="button" data-id="${l.id}" ${locked ? 'disabled' : ''} ${locked ? `aria-label="${c.prefix}${i + 1}. ${L('Bloqueado', 'Locked')}"` : ''}>
        <b>${c.prefix}${i + 1}</b><span>${lvName(l)}</span><small class="${locked || !st ? 'off' : ''}">${locked ? L('🔒 Bloqueado', '🔒 Locked') : st ? '★'.repeat(st) + '<span style="opacity:.25">' + '★'.repeat(3 - st) + '</span>' : L('Por jugar', 'Not played')}</small></button>`;
      })
      .join('');
  }
  pnl.innerHTML = `<h3>${info.t}</h3><p>${info.p}${MSEL !== 'u' ? ' ' + L('Supera un nivel para desbloquear el siguiente.', 'Beat a level to unlock the next one.') : ''}</p><div class="lvGrid">${cards}</div>`;
  pnl.querySelectorAll('.lvCard[data-id]').forEach(
    (b) =>
      (b.onclick = () => {
        SND.click();
        const l = findLevel(b.dataset.id);
        if (l) loadLevel(l);
      }),
  );
  const nb = $('lvNew');
  if (nb)
    nb.onclick = () => {
      SND.click();
      E.draft = null;
      openEditor(null);
    };
}

/* --- botones del inicio y de la selección --- */
$('btnPlay').onclick = () => {
  SND.click();
  showView('select');
};
$('btnHow').onclick = () => {
  SND.click();
  openHow();
};
$('btnSelBack').onclick = () => {
  SND.click();
  showView('home');
};
$('btnToEditor').onclick = () => {
  SND.click();
  openEditor(null);
};
$('btnMenu').onclick = () => {
  SND.click();
  if (S.online) {
    onlineMenuBtn();
    return;
  }
  if (S.screen === 'edit') E.sel = null;
  showView('select');
};
$('btnSettings').onclick = (e) => {
  e.stopPropagation();
  SND.click();
  const m = $('setMenu'),
    open = m.hidden;
  m.hidden = !open;
  $('btnSettings').setAttribute('aria-expanded', String(open));
};
document.addEventListener('click', (e) => {
  const m = $('setMenu');
  if (!m.hidden && !m.contains(e.target) && e.target !== $('btnSettings')) {
    m.hidden = true;
    $('btnSettings').setAttribute('aria-expanded', 'false');
  }
});
document.querySelectorAll('[data-lang]').forEach(
  (b) =>
    (b.onclick = () => {
      if (SET.lang === b.dataset.lang) return;
      SET.lang = b.dataset.lang;
      saveSet();
      SND.click();
      applyStaticLang();
      renderMenus();
      renderHow();
      if (S.def) {
        updateGameBar();
        hud();
      }
      bgDirty = true;
    }),
);
$('setAnim').checked = SET.anim;
$('setSound').checked = SET.sound;
$('setAnim').onchange = (e) => {
  SET.anim = e.target.checked;
  saveSet();
  bgDirty = true;
};
$('setSound').onchange = (e) => {
  SET.sound = e.target.checked;
  saveSet();
  SND.click();
};

// true después del primer clic en "Reiniciar progreso" (pide confirmar).
let resetArmed = false;
$('btnReset').onclick = (e) => {
  e.stopPropagation();
  const b = $('btnReset'),
    note = $('resetNote');
  const restore = () => {
    resetArmed = false;
    applyStaticLang();
  };
  if (!resetArmed) {
    resetArmed = true;
    b.textContent = L('¿Seguro? Pulsa otra vez', 'Sure? Press again');
    setTimeout(() => {
      if (resetArmed) restore();
    }, 3500);
    return;
  }
  prog = freshProg();
  saveProg();
  MSEL = 'c';
  resetArmed = false;
  b.textContent = L('Reiniciar progreso', 'Reset progress');
  note.textContent = L(
    'Progreso reiniciado. Todos los niveles vuelven a empezar.',
    'Progress reset. Every campaign starts over.',
  );
  SND.puff();
  setTimeout(() => {
    if (!resetArmed) applyStaticLang();
  }, 3500);
};
