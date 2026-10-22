/* ======================================================================
   FILE: js/6-menus/how-to-play.js

   THE "HOW TO PLAY" GUIDE
   A window with 4 steps (launch, displacement, mixed, editor). Each step has a
   picture (buildModePictureSvg in menus.js), a title and a text.
   ====================================================================== */

// howToPlayStep: the step shown now (0 = first).
let howToPlayStep = 0;
// elementFocusedBeforeHowToPlay: the button that opened the guide (the focus returns to it).
let elementFocusedBeforeHowToPlay = null;

// getHowToPlaySteps(): the steps of the guide in the chosen language.
//   picture: which mode picture to show;  title;  text (it can contain HTML like <b>)
function getHowToPlaySteps() {
  return [
    {
      picture: 'launch',
      title: translate('1 · Lanzamiento', '1 · Launch'),
      text: translate(
        'Elige la velocidad inicial v₀, el ángulo θ y la altura h₀, y pulsa <b>Lanzar</b>. Sin resistencia del aire, la trayectoria es una parábola exacta. Derriba a todos los cochinitos antes de quedarte sin tiros: cuantos menos uses, más estrellas.',
        'Choose the launch speed v₀, the angle θ and the height h₀, then press <b>Launch</b>. With no air resistance the path is an exact parabola. Knock down every piglet before you run out of shots: the fewer you use, the more stars you get.',
      ),
    },
    {
      picture: 'displacement',
      title: translate('2 · Desplazamiento', '2 · Displacement'),
      text: translate(
        'El cochinito se mueve siguiendo vectores. Con los datos que te dan (magnitudes, ángulos, tiempos o componentes) calcula las incógnitas y pulsa <b>Comprobar</b>. La escala del plano se revela cuando aciertas.',
        'The piglet moves along vectors. Use the given data (lengths, angles, times or components) to work out the unknowns, then press <b>Check</b>. The grid scale is revealed once you get it right.',
      ),
    },
    {
      picture: 'mixed',
      title: translate('3 · Mixta', '3 · Mixed'),
      text: translate(
        'Primero resuelve a dónde se movió el cochinito con sus vectores. Después, con su posición ya conocida, lánzale con la parábola correcta.',
        'First work out where the piglet moved using its vectors. Then, with its position known, launch at it with the right parabola.',
      ),
    },
    {
      picture: 'custom',
      title: translate('4 · Editor', '4 · Editor'),
      text: translate(
        'Crea tus propios niveles: usa plantillas, arrastra vectores, coloca bloques y decide qué variables puede cambiar el jugador. El editor comprueba que siempre haya solución, y puedes compartir cada nivel con un código.',
        'Make your own levels: use templates, drag vectors, place blocks and decide which variables the player can change. The editor checks there is always a solution, and you can share each level with a code.',
      ),
    },
  ];
}

// renderHowToPlay(): draws the current step of the guide (only if the window is open).
function renderHowToPlay() {
  if (getElement('howToPlayWindow').hidden) {
    return;
  }
  const steps = getHowToPlaySteps();
  const step = steps[howToPlayStep];
  getElement('howToPlayPicture').innerHTML = buildModePictureSvg(step.picture, true);
  getElement('howToPlayStepText').innerHTML = `<h3>${step.title}</h3><p>${step.text}</p>`;
  getElement('howToPlayBackButton').disabled = howToPlayStep === 0;
  if (howToPlayStep === steps.length - 1) {
    getElement('howToPlayNextButton').textContent = translate('¡A jugar!', 'Let’s play!');
  } else {
    getElement('howToPlayNextButton').textContent = translate('Siguiente →', 'Next →');
  }
  // the dots below: one per step (clicking a dot jumps to that step)
  let dots = '';
  for (let index = 0; index < steps.length; index++) {
    let current = '';
    if (index === howToPlayStep) {
      current = 'aria-current="true"';
    }
    dots += `<button type="button" aria-label="${translate('Paso', 'Step')} ${index + 1}" ${current} data-step="${index}"></button>`;
  }
  getElement('howToPlayDots').innerHTML = dots;
  const dotButtons = getElement('howToPlayDots').querySelectorAll('button');
  for (const dot of dotButtons) {
    dot.addEventListener('click', function () {
      howToPlayStep = Number(dot.dataset.step);
      renderHowToPlay();
    });
  }
}

// openHowToPlay(): opens the guide at the first step.
function openHowToPlay() {
  elementFocusedBeforeHowToPlay = document.activeElement;
  howToPlayStep = 0;
  getElement('howToPlayWindow').hidden = false;
  renderHowToPlay();
  getElement('howToPlayNextButton').focus();
}

// closeHowToPlay(): closes the guide and gives the focus back to the button that opened it.
function closeHowToPlay() {
  getElement('howToPlayWindow').hidden = true;
  if (elementFocusedBeforeHowToPlay && elementFocusedBeforeHowToPlay.focus) {
    elementFocusedBeforeHowToPlay.focus();
  }
}

getElement('howToPlayCloseButton').addEventListener('click', function () {
  closeHowToPlay();
});
getElement('howToPlayBackButton').addEventListener('click', function () {
  if (howToPlayStep > 0) {
    howToPlayStep--;
    renderHowToPlay();
  }
});
getElement('howToPlayNextButton').addEventListener('click', function () {
  if (howToPlayStep < getHowToPlaySteps().length - 1) {
    howToPlayStep++;
    renderHowToPlay();
  } else {
    // the last step: close and go to the level select screen
    closeHowToPlay();
    showView('levelSelect');
  }
});
// clicking outside the card closes the guide
getElement('howToPlayWindow').addEventListener('click', function (event) {
  if (event.target === getElement('howToPlayWindow')) {
    closeHowToPlay();
  }
});
