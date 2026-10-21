/* ======================================================================
   ARCHIVO: js/1-nucleo/idioma.js

   IDIOMA Y CONFIGURACIÓN
   Guarda la configuración del jugador (idioma, animaciones, sonido) y traduce textos.

   Cómo funciona la traducción:
     - En JavaScript: L('Hola', 'Hello') devuelve uno u otro según el idioma.
     - En el HTML: <span data-l="Hola|Hello"></span> se rellena automáticamente.
   Para cambiar un texto, busca la frase en español en los archivos y edítala (y su versión en inglés).
   ====================================================================== */

/* =========================================================
   CONFIGURACIÓN E IDIOMA
   ========================================================= */

// Configuración del jugador: idioma ('es' o 'en'), animación del fondo y sonido.
// Se guarda en el navegador (localStorage) para recordarla la próxima vez.
const SET = { lang: /^en\b/i.test(navigator.language || '') ? 'en' : 'es', anim: !reduceMotion, sound: true };
try {
  const s = JSON.parse(localStorage.getItem('parabola-brava-settings') || 'null');
  if (s) Object.assign(SET, s);
} catch (e) {}

// Guarda la configuración en el navegador.
function saveSet() {
  try {
    localStorage.setItem('parabola-brava-settings', JSON.stringify(SET));
  } catch (e) {}
}

// L('texto en español', 'text in English') devuelve el texto en el idioma elegido.
// Se usa en todo el código para cualquier texto que aparece en pantalla.
const L = (es, en) => (SET.lang === 'en' ? en : es);
/* Textos fijos del HTML: data-l="español|english" (también data-la para aria-label, data-lt para title, data-lp para placeholder) */
// Traduce los textos fijos del HTML.
// En index.html, los elementos con data-l="español|english" reciben el texto según el idioma.
// (data-la = etiqueta para lectores de pantalla, data-lt = título al pasar el ratón, data-lp = placeholder).
function applyStaticLang() {
  document.documentElement.lang = SET.lang;
  const pick = (v) => {
    const p = v.split('|');
    return SET.lang === 'en' ? p[1] : p[0];
  };
  document.querySelectorAll('[data-l]').forEach((el) => (el.textContent = pick(el.dataset.l)));
  document.querySelectorAll('[data-la]').forEach((el) => el.setAttribute('aria-label', pick(el.dataset.la)));
  document.querySelectorAll('[data-lt]').forEach((el) => (el.title = pick(el.dataset.lt)));
  document.querySelectorAll('[data-lp]').forEach((el) => (el.placeholder = pick(el.dataset.lp)));
  document
    .querySelectorAll('[data-lang]')
    .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === SET.lang)));
}
