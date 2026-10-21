/* ======================================================================
   ARCHIVO: js/7-inicio.js

   INICIO DEL JUEGO Y BUCLE PRINCIPAL
   Este es el ÚLTIMO archivo que se carga: cuando llega aquí, todas las funciones ya existen.
     1. Traduce los textos fijos.
     2. Muestra la pantalla de inicio.
     3. Arranca el bucle principal (frame), que se repite unas 60 veces por segundo.
   ====================================================================== */

/* ---------- bucle ---------- */
// Momento del cuadro anterior (para calcular cuánto tiempo pasó).
let lastTs = null;

// BUCLE PRINCIPAL. El navegador llama a esta función unas 60 veces por segundo.
// En cada llamada: avanza la física, revisa el tiempo online y vuelve a dibujar la escena (o el fondo de los menús).
function frame(ts) {
  const dt = lastTs == null ? 0 : Math.min(0.033, (ts - lastTs) / 1000);
  lastTs = ts;
  if (VIEW === 'game') {
    S.time += dt;
    if (S.screen === 'play') {
      updateAnim(dt);
      if (S.mode === 'fly') {
        updateProj(dt);
        tele();
        if (S.proj && S.proj.done && S.proj.doneT > 0.9 && !anyFalling()) endShot();
      }
      if (S.endTimer > 0) {
        S.endTimer -= dt;
        if (S.endTimer <= 0) endDespl();
      }
      settle(dt);
      updateParts(dt);
    }
    if (S.online) onlineTick();
    if (S.screen === 'edit' && E.dirty) {
      E.dirty = false;
      renderPop();
    }
    if (cw > 0) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (S.screen === 'edit') drawEdit();
      else drawPlay();
    }
  } else {
    const animate = SET.anim && !reduceMotion;
    if (animate) {
      bgT += dt;
      drawBG(bgT);
    } else if (bgDirty) drawBG(31.8);
    bgDirty = false;
  }
  requestAnimationFrame(frame);
}

window.__pbV = () => V;
window.__pbPts = () => (E.draft && E.draft.mov ? resultant(E.draft.mov).pts : null);
window.__pb = {
  CAMPAIGN_D,
  CAMPAIGN_M,
  solvability,
  movProblems,
  resultant,
  showView,
  get VIEW() {
    return VIEW;
  },
};
applyStaticLang();
showView('home');
requestAnimationFrame(frame);
