/* ======================================================================
   ARCHIVO: js/2-juego/fin-de-nivel.js

   FIN DE TIRO Y FIN DE NIVEL
   Decide qué pasa cuando el proyectil se detiene: ganar, perder o seguir lanzando.
   Calcula estrellas y bonus, desbloquea niveles y muestra la tarjeta final.
   También dibuja el panel de telemetría.
   ====================================================================== */

/* ---------- fin de tiro / nivel ---------- */
// Se llama cuando el proyectil se detuvo: decide si ganaste, perdiste o puedes seguir lanzando.
function endShot() {
  const p = S.proj;
  S.trails.push(p);
  if (S.trails.length > 4) S.trails.shift();
  S.last = p;
  S.proj = null;
  if (S.online) onlineShot(p, Math.max(0, (p.tBefore || 0) - targetsLeft()));
  if (targetsLeft() === 0) win();
  else if (S.shotsLeft <= 0) lose();
  else S.mode = 'aim';
  hud();
  tele();
  syncUI();
}

// Configura el botón principal de la tarjeta final (texto y qué hace al pulsarlo).
function setNext(label, fn) {
  $('ovNext').hidden = !fn;
  $('ovNext').textContent = label || '';
  S.next = fn;
}

// HTML de 0 a 3 estrellas.
function starsHTML(n) {
  return [0, 1, 2].map((i) => `<span class="${i < n ? '' : 'off'}">★</span>`).join('');
}

// Guarda las estrellas, desbloquea el siguiente nivel y prepara el botón "Siguiente".
function unlockAndNext(d, stars) {
  prog.stars[d.id] = Math.max(prog.stars[d.id] || 0, stars);
  const c = campaignOf(d);
  if (c) prog[c.unlock] = Math.min(c.list.length, Math.max(prog[c.unlock], c.i + 2));
  saveProg();
  if (c)
    setNext(
      c.i === c.list.length - 1
        ? L('Volver al primero', 'Back to the first')
        : L('Siguiente nivel', 'Next level'),
      () => loadLevel(c.list[(c.i + 1) % c.list.length]),
    );
  else {
    const ui = customs.findIndex((x) => x.id === d.id),
      has = ui >= 0 && ui < customs.length - 1;
    setNext(
      has ? L('Siguiente de mis niveles', 'Next of my levels') : null,
      has ? () => loadLevel(customs[ui + 1]) : null,
    );
  }
  return c;
}

// Texto del botón Repetir.
function retryLabel() {
  $('ovRetry').textContent = S.testing
    ? L('Repetir prueba', 'Test again')
    : L('Repetir nivel', 'Retry level');
}

// Final de un nivel de desplazamiento (resuelto o sin intentos).
function endDespl() {
  const d = S.def,
    a = S.ans;
  S.mode = 'end';
  if (S.online) {
    onlineLevelEnd(a.failed ? 'f' : 'w', a.failed ? 0 : a.stars);
    return;
  }
  retryLabel();
  if (a.failed) {
    $('ovTitle').textContent = L('Sin intentos', 'Out of attempts');
    $('ovStars').innerHTML = '';
    $('ovText').textContent = L(
      'Revisa la solución paso a paso debajo de la escena y vuelve a intentarlo.',
      'Check the step-by-step solution below the scene and try again.',
    );
    setNext(S.testing ? L('Volver al editor', 'Back to editor') : null, S.testing ? backToEditor : null);
    SND.bad();
  } else {
    const stars = S.testing ? 0 : a.stars;
    $('ovStars').innerHTML = starsHTML(stars);
    const tries = L(`${a.used} intento${a.used > 1 ? 's' : ''}`, `${a.used} attempt${a.used > 1 ? 's' : ''}`);
    if (S.testing) {
      $('ovTitle').textContent = L('Prueba superada', 'Test passed');
      $('ovText').textContent = L(`Lo resolviste en ${tries}.`, `You solved it in ${tries}.`);
      setNext(L('Volver al editor', 'Back to editor'), backToEditor);
    } else {
      const c = unlockAndNext(d, stars);
      $('ovTitle').textContent =
        c && c.i === c.list.length - 1
          ? L('¡Campaña completada!', 'Campaign complete!')
          : L('¡Resuelto!', 'Solved!');
      $('ovText').textContent = L(
        `Lo resolviste en ${tries}: +${a.bonus} puntos. La solución completa está debajo de la escena.`,
        `You solved it in ${tries}: +${a.bonus} points. The full solution is below the scene.`,
      );
    }
    SND.win();
  }
  $('overlay').hidden = false;
  updateGameBar();
}

// Ganaste el nivel: calcula el bonus por tiros sobrantes (1000 por tiro) y las estrellas.
function win() {
  const d = S.def;
  S.mode = 'end';
  const used = d.shots - S.shotsLeft,
    bonus = d.shots >= 900 ? 0 : S.shotsLeft * 1000;
  S.score += bonus;
  let stars = used === 1 ? 3 : used === 2 ? 2 : 1; // 1 tiro = 3 estrellas, 2 tiros = 2, más = 1
  if (d.type === 'mixto') stars = Math.min(stars, S.ans.failed ? 1 : S.ans.stars);
  if (S.practiceUsed || S.testing) stars = 0;
  if (S.online) {
    onlineLevelEnd('w', stars);
    return;
  }
  $('ovStars').innerHTML = starsHTML(stars);
  const ansNote =
    d.type === 'mixto'
      ? S.ans.solved
        ? L(
            ` Resolviste los vectores en ${S.ans.used} intento${S.ans.used > 1 ? 's' : ''}.`,
            ` You solved the vectors in ${S.ans.used} attempt${S.ans.used > 1 ? 's' : ''}.`,
          )
        : L(
            ' No resolviste los vectores, así que el máximo es una estrella.',
            ' You didn’t solve the vectors, so the most you can get is one star.',
          )
      : '';
  if (S.testing) {
    $('ovTitle').textContent = L('Prueba superada', 'Test passed');
    $('ovText').textContent = L(
      `El nivel se puede ganar: lo resolviste con ${used} de ${d.shots} tiros.${ansNote}`,
      `The level can be won: you beat it with ${used} of ${d.shots} shots.${ansNote}`,
    );
    setNext(L('Volver al editor', 'Back to editor'), backToEditor);
  } else {
    const c = unlockAndNext(d, stars);
    $('ovTitle').textContent =
      c && c.i === c.list.length - 1
        ? L('¡Campaña completada!', 'Campaign complete!')
        : L('¡Nivel superado!', 'Level complete!');
    $('ovText').textContent =
      L(
        `Tiros usados: ${used} de ${d.shots}. Bonus por tiros sobrantes: +${bonus}.`,
        `Shots used: ${used} of ${d.shots}. Bonus for unused shots: +${bonus}.`,
      ) +
      ansNote +
      (S.practiceUsed
        ? L(
            ' Usaste el modo práctica, así que este intento no suma estrellas.',
            ' You used practice mode, so this attempt earns no stars.',
          )
        : '');
  }
  retryLabel();
  SND.win();
  $('overlay').hidden = false;
  updateGameBar();
}

// Te quedaste sin tiros.
function lose() {
  if (S.online) {
    onlineLevelEnd('f', 0);
    return;
  }
  S.mode = 'end';
  $('ovTitle').textContent = L('Sin tiros', 'Out of shots');
  $('ovStars').innerHTML = '';
  const n = targetsLeft();
  $('ovText').textContent = L(
    `Quedan ${n} objetivo${n > 1 ? 's' : ''}. Ajusta v₀, θ o h₀ y vuelve a intentarlo.`,
    `${n} target${n > 1 ? 's' : ''} left. Adjust v₀, θ or h₀ and try again.`,
  );
  retryLabel();
  setNext(S.testing ? L('Volver al editor', 'Back to editor') : null, S.testing ? backToEditor : null);
  SND.bad();
  $('overlay').hidden = false;
}

// HTML de una celda del panel de telemetría.
function cell(label, val) {
  return `<div><span>${label}</span><b>${val}</b></div>`;
}

// Panel de telemetría: tiempo, posición y velocidad del proyectil en vuelo o del último impacto.
function tele() {
  const el = $('tele');
  const p = S.proj;
  if (p && !p.done) {
    const vy = p.vy0 - p.g * p.t;
    el.innerHTML =
      cell('t', f(p.t) + ' s') +
      cell('x', f(p.x) + ' m') +
      cell('y', f(p.y) + ' m') +
      cell('vₓ', f(p.vx) + ' m/s') +
      cell('vᵧ', f(vy) + ' m/s') +
      cell('|v|', f(Math.hypot(p.vx, vy)) + ' m/s');
    return;
  }
  const q = p && p.done ? p : S.last;
  if (q) {
    const what = {
      ground: L('suelo', 'ground'),
      terrain: L('terreno', 'terrain'),
      obj: L('estructura', 'structure'),
      out: L('fuera del mapa', 'off the map'),
    }[q.hit];
    el.innerHTML =
      cell(L('Impacto en', 'Hit'), what) +
      cell(L('t impacto', 'impact t'), f(q.t) + ' s') +
      cell(L('x impacto', 'impact x'), f(q.x) + ' m') +
      cell(L('y impacto', 'impact y'), f(q.y) + ' m') +
      cell(L('h máx', 'max h'), f(q.ymax) + ' m') +
      cell(L('|v| impacto', 'impact |v|'), f(q.vImp) + ' m/s') +
      `<div class="msg">${L('Último tiro', 'Last shot')}: v₀ = ${f(q.v0, 1)} m/s, θ = ${q.ang}°, h₀ = ${f(q.h0, 1)} m, g = ${q.g} m/s².</div>`;
    return;
  }
  el.innerHTML = `<div class="msg">${L('Lanza para ver tiempo, posición y velocidad del proyectil en cada instante.', 'Launch to see the projectile’s time, position and velocity at every moment.')}</div>`;
}
