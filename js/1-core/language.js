/* ======================================================================
   FILE: js/1-core/language.js

   LANGUAGE AND SETTINGS
   Keeps the player's settings (language, background animation, sound) and
   translates texts.

   How translation works:
     - In JavaScript: translate('Hola', 'Hello') gives one or the other depending
       on the chosen language. Every text shown on screen uses it.
     - In the HTML: <span data-text="Hola|Hello"></span> is filled in automatically
       by applyLanguageToPage().
   To change a text, search for the Spanish sentence in the files and edit it
   (and its English version).
   ====================================================================== */

// SETTINGS_STORAGE_KEY: name under which the settings are saved in the browser.
const SETTINGS_STORAGE_KEY = 'parabola-brava-settings';

// browserLanguageIsEnglish: true when the browser is set to English.
// navigator.language is the language of the browser, for example "en-US" or "es-MX".
const browserLanguageIsEnglish = /^en\b/i.test(navigator.language || '');

// settings: the player's choices.
//   language            'es' (Spanish) or 'en' (English)
//   backgroundAnimation true = the menu background moves
//   soundEffects        true = sound effects are on
const settings = {
  language: 'es',
  backgroundAnimation: !userPrefersReducedMotion,
  soundEffects: true,
};
if (browserLanguageIsEnglish) {
  settings.language = 'en';
}

// loadSavedSettings(): reads the settings saved in the browser (localStorage).
// localStorage is a small storage area of the browser that keeps text even after the
// page is closed. "try { ... } catch" avoids errors in browsers that block it.
function loadSavedSettings() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || 'null');
  } catch (error) {
    saved = null;
  }
  if (!saved) {
    return;
  }
  // Older versions of the game saved the settings with short names (lang, anim, sound).
  if (saved.lang !== undefined) {
    settings.language = saved.lang;
  }
  if (saved.anim !== undefined) {
    settings.backgroundAnimation = saved.anim;
  }
  if (saved.sound !== undefined) {
    settings.soundEffects = saved.sound;
  }
  // Current names
  if (saved.language !== undefined) {
    settings.language = saved.language;
  }
  if (saved.backgroundAnimation !== undefined) {
    settings.backgroundAnimation = saved.backgroundAnimation;
  }
  if (saved.soundEffects !== undefined) {
    settings.soundEffects = saved.soundEffects;
  }
}
loadSavedSettings();

// saveSettings(): saves the settings in the browser.
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    // the browser does not allow saving: the game keeps working without it
  }
}

// translate(spanishText, englishText): returns the text in the chosen language.
function translate(spanishText, englishText) {
  if (settings.language === 'en') {
    return englishText;
  }
  return spanishText;
}

// pickLanguagePart(bothTexts): takes a text like "Hola|Hello" and returns the part of
// the chosen language (the part before "|" is Spanish, the part after it is English).
function pickLanguagePart(bothTexts) {
  const parts = bothTexts.split('|');
  if (settings.language === 'en') {
    return parts[1];
  }
  return parts[0];
}

// applyLanguageToPage(): translates the fixed texts of the HTML.
// document.querySelectorAll('[data-text]') finds every element that has a data-text attribute;
// element.dataset.text reads the value of that attribute.
function applyLanguageToPage() {
  document.documentElement.lang = settings.language;

  const textElements = document.querySelectorAll('[data-text]');
  for (const element of textElements) {
    element.textContent = pickLanguagePart(element.dataset.text);
  }
  // aria-label = name read by screen readers for people who cannot see the screen
  const labelElements = document.querySelectorAll('[data-aria-text]');
  for (const element of labelElements) {
    element.setAttribute('aria-label', pickLanguagePart(element.dataset.ariaText));
  }
  // title = small tooltip shown when the mouse stays over the element
  const titleElements = document.querySelectorAll('[data-title-text]');
  for (const element of titleElements) {
    element.title = pickLanguagePart(element.dataset.titleText);
  }
  // placeholder = grey hint text inside an empty text box
  const placeholderElements = document.querySelectorAll('[data-placeholder-text]');
  for (const element of placeholderElements) {
    element.placeholder = pickLanguagePart(element.dataset.placeholderText);
  }
  // mark which language button (Español / English) is pressed
  const languageButtons = document.querySelectorAll('[data-language]');
  for (const button of languageButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.language === settings.language));
  }
}
