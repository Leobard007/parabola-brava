/* ======================================================================
   ARCHIVO: js/6-menus/guia-como-jugar.js

   GUÍA "CÓMO JUGAR"
   Ventana con 4 pasos. Para cambiar los textos de la guía, edita la lista HOW.
   ====================================================================== */

/* =========================================================
   GUÍA «CÓMO JUGAR»
   ========================================================= */

// Paso actual de la guía "Cómo jugar".
let howI = 0,
  howReturn = null;

// Pasos de la guía "Cómo jugar": dibujo, título y texto en ambos idiomas.
const HOW = () => [
  {
    fig: 'c',
    t: L('1 · Lanzamiento', '1 · Launch'),
    p: L(
      'Elige la velocidad inicial v₀, el ángulo θ y la altura h₀, y pulsa <b>Lanzar</b>. Sin resistencia del aire, la trayectoria es una parábola exacta. Derriba a todos los cochinitos antes de quedarte sin tiros: cuantos menos uses, más estrellas.',
      'Choose the launch speed v₀, the angle θ and the height h₀, then press <b>Launch</b>. With no air resistance the path is an exact parabola. Knock down every piglet before you run out of shots: the fewer you use, the more stars you get.',
    ),
  },
  {
    fig: 'd',
    t: L('2 · Desplazamiento', '2 · Displacement'),
    p: L(
      'El cochinito se mueve siguiendo vectores. Con los datos que te dan (magnitudes, ángulos, tiempos o componentes) calcula las incógnitas y pulsa <b>Comprobar</b>. La escala del plano se revela cuando aciertas.',
      'The piglet moves along vectors. Use the given data (lengths, angles, times or components) to work out the unknowns, then press <b>Check</b>. The grid scale is revealed once you get it right.',
    ),
  },
  {
    fig: 'm',
    t: L('3 · Mixta', '3 · Mixed'),
    p: L(
      'Primero resuelve a dónde se movió el cochinito con sus vectores. Después, con su posición ya conocida, lánzale con la parábola correcta.',
      'First work out where the piglet moved using its vectors. Then, with its position known, launch at it with the right parabola.',
    ),
  },
  {
    fig: 'u',
    t: L('4 · Editor', '4 · Editor'),
    p: L(
      'Crea tus propios niveles: usa plantillas, arrastra vectores, coloca bloques y decide qué variables puede cambiar el jugador. El editor comprueba que siempre haya solución, y puedes compartir cada nivel con un código.',
      'Make your own levels: use templates, drag vectors, place blocks and decide which variables the player can change. The editor checks there is always a solution, and you can share each level with a code.',
    ),
  },
];

// Dibuja el paso actual de la guía.
function renderHow() {
  if ($('howModal').hidden) return;
  const steps = HOW(),
    s = steps[howI];
  $('howFig').innerHTML = figSVG(s.fig, true);
  $('howStep').innerHTML = `<h3>${s.t}</h3><p>${s.p}</p>`;
  $('howPrev').disabled = howI === 0;
  $('howNext').textContent =
    howI === steps.length - 1 ? L('¡A jugar!', 'Let’s play!') : L('Siguiente →', 'Next →');
  $('howDots').innerHTML = steps
    .map(
      (_, i) =>
        `<button type="button" aria-label="${L('Paso', 'Step')} ${i + 1}" ${i === howI ? 'aria-current="true"' : ''} data-i="${i}"></button>`,
    )
    .join('');
  $('howDots')
    .querySelectorAll('button')
    .forEach(
      (b) =>
        (b.onclick = () => {
          howI = +b.dataset.i;
          renderHow();
        }),
    );
}

// Abre la guía.
function openHow() {
  howReturn = document.activeElement;
  howI = 0;
  $('howModal').hidden = false;
  renderHow();
  $('howNext').focus();
}

// Cierra la guía.
function closeHow() {
  $('howModal').hidden = true;
  if (howReturn && howReturn.focus) howReturn.focus();
}
$('howClose').onclick = closeHow;
$('howPrev').onclick = () => {
  if (howI > 0) {
    howI--;
    renderHow();
  }
};
$('howNext').onclick = () => {
  if (howI < HOW().length - 1) {
    howI++;
    renderHow();
  } else {
    closeHow();
    showView('select');
  }
};
$('howModal').addEventListener('click', (e) => {
  if (e.target === $('howModal')) closeHow();
});
