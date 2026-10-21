/* ======================================================================
   ARCHIVO: js/2-juego/controles.js

   CONTROLES DEL JUGADOR
   Conecta los deslizadores y casillas (v₀, θ, h₀, gravedad), el botón Lanzar y el teclado
   (Enter o Espacio para lanzar). También muestra las ecuaciones del tiro con los valores actuales.
   ====================================================================== */

/* ---------- controles del jugador ---------- */
// Conecta un deslizador con su casilla numérica para que siempre muestren el mismo valor.
function bind(rid, nid, key) {
  const r = $(rid),
    n = $(nid);
  r.addEventListener('input', () => {
    P[key] = +r.value;
    n.value = r.value;
    syncUI();
  });
  n.addEventListener('change', () => {
    let v = parseFloat(String(n.value).replace(',', '.'));
    if (isNaN(v)) v = P[key];
    v = clamp(v, +n.min, +n.max);
    P[key] = v;
    n.value = v;
    r.value = v;
    syncUI();
  });
}
bind('v0', 'v0n', 'v0');
bind('ang', 'angn', 'ang');
bind('h0', 'h0n', 'h0');
$('grav').addEventListener('change', (e) => {
  g = +e.target.value;
  $('gLabel').textContent = g.toFixed(2);
  syncUI();
});
$('practice').addEventListener('change', syncUI);
// () => fire() en lugar de solo fire: la función fire está en fisica.js, que se carga DESPUÉS de este archivo.
$('fire').addEventListener('click', () => fire());
document.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  if (!$('howModal').hidden) {
    if (e.key === 'Escape') closeHow();
    return;
  }
  if (VIEW !== 'game') {
    if (e.key === 'Escape') {
      $('setMenu').hidden = true;
      $('btnSettings').setAttribute('aria-expanded', 'false');
    }
    return;
  }
  if (S.screen === 'edit') {
    editorKey(e);
    return;
  }
  if (S.phase !== 'shoot') {
    if (
      S.phase === 'find' &&
      e.key === 'Enter' &&
      /INPUT|SELECT/.test(tag) &&
      $('findUI').contains(e.target)
    ) {
      e.preventDefault();
      checkAnswer();
    }
    return;
  }
  if (e.key === 'Enter' || (e.key === ' ' && !/INPUT|SELECT|BUTTON|TEXTAREA/.test(tag))) {
    if (tag === 'INPUT' && e.target.type === 'number') e.target.dispatchEvent(new Event('change'));
    if (tag === 'BUTTON' || tag === 'TEXTAREA') return;
    e.preventDefault();
    fire();
  }
});
$('ovRetry').onclick = () => {
  S.score = S.levelStart;
  loadLevel(S.def, { testing: S.testing });
};
$('ovNext').onclick = () => {
  if (S.next) S.next();
};

// Fórmulas del tiro parabólico (sin aire). Devuelve vx, vy, tiempo de vuelo, alcance y altura máxima.
//   vx = v0·cos θ ;  vy = v0·sin θ ;  y(t) = h0 + vy·t − ½·g·t²
function theory(v0, ang, h0, gg) {
  const th = (ang * Math.PI) / 180,
    vx = v0 * Math.cos(th),
    vy = v0 * Math.sin(th);
  const tf = (vy + Math.sqrt(vy * vy + 2 * gg * h0)) / gg;
  const hmax = vy > 0 ? h0 + (vy * vy) / (2 * gg) : h0;
  return { vx, vy, tf, range: vx * tf, hmax, tApex: vy > 0 ? vy / gg : 0 };
}

// Actualiza el panel de ecuaciones con los valores actuales y activa o desactiva el botón Lanzar.
function syncUI() {
  if (!S.def) return;
  const th = theory(P.v0, P.ang, P.h0, g);
  const practice = $('practice').checked;
  let h = `
    <div><span class="k">vₓ</span> = v₀·cos θ = ${f(P.v0, 1)}·cos ${P.ang}° = <b>${f(th.vx)} m/s</b></div>
    <div><span class="k">vᵧ₀</span> = v₀·sin θ = ${f(P.v0, 1)}·sin ${P.ang}° = <b>${f(th.vy)} m/s</b></div>
    <div><span class="k">x(t)</span> = ${f(th.vx)}·t</div>
    <div><span class="k">y(t)</span> = ${f(P.h0, 1)} ${th.vy < 0 ? '−' : '+'} ${f(Math.abs(th.vy))}·t − ${f(g / 2, 3)}·t²</div>
    <div><span class="k">vᵧ(t)</span> = ${f(th.vy)} − ${f(g)}·t</div>`;
  if (practice) {
    h += `<div class="pred">
      <div>${L('h máx', 'max h')} = h₀ + vᵧ₀²/(2g) = <b>${f(th.hmax)} m</b>${th.vy > 0 ? ` (t = ${f(th.tApex)} s)` : ''}</div>
      <div>${L('t vuelo', 'flight t')} (y = 0) = <b>${f(th.tf)} s</b></div>
      <div>${L('Alcance', 'Range')} (y = 0) = vₓ·t = <b>${f(th.range)} m</b></div></div>`;
  } else {
    h += `<div class="note">${L(
      'Calcula tú el alcance y la altura máxima, o activa el modo práctica para verlos (ese nivel no dará estrellas).',
      'Work out the range and maximum height yourself, or turn on practice mode to see them (that level won’t award stars).',
    )}</div>`;
  }
  $('eq').innerHTML = h;
  $('fire').disabled = S.mode !== 'aim' || S.phase !== 'shoot';
  $('grav').disabled = S.def.vars.g.locked || S.mode === 'fly';
}
