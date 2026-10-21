/* ======================================================================
   ARCHIVO: js/1-nucleo/utilidades.js

   UTILIDADES BÁSICAS
   Herramientas pequeñas que usan todos los demás archivos: buscar elementos del HTML,
   redondear números, darles formato, copiar objetos, etc.

   IMPORTANTE: todos los archivos .js se cargan en orden desde index.html y comparten
   las mismas variables. Algo definido aquí (por ejemplo la función r2) se puede usar
   en cualquier archivo que se cargue después.

   Para personalizar: los colores NO se cambian aquí, sino en css/base.css.
   ====================================================================== */

// Atajo para buscar un elemento del HTML por su id.
// Ejemplo: $('score') es lo mismo que document.getElementById('score').
const $ = (id) => document.getElementById(id);

// Número de versión del juego. Lo escribe automáticamente el script de empaquetado (archivo VERSION)
// y debe coincidir con version.json, que es lo que se consulta para saber si hay una versión nueva.
// Número de versión del juego (se muestra en Configuración).
const APP_VERSION = 9;

// cv = el <canvas> donde se dibuja la escena del juego; ctx = su "pincel" 2D (se usa para dibujar líneas, rectángulos, texto...).
const cv = $('cv'),
  ctx = cv.getContext('2d');

// Lee los estilos ya calculados de la página, para poder copiar los colores definidos en css/base.css.
const css = getComputedStyle(document.documentElement);

// C guarda los colores del juego leídos desde las variables CSS (--ink, --pencil, --vector...).
// Para cambiar un color, edítalo en css/base.css (sección :root) y aquí se actualiza solo.
const C = {};
[
  'paper',
  'grid',
  'grid-major',
  'ink',
  'ink-soft',
  'pencil',
  'pencil-deep',
  'vector',
  'mixed',
  'wood',
  'wood-dark',
  'stone',
  'stone-dark',
  'target',
  'target-dark',
  'earth',
  'earth-dark',
  'line',
  'bp',
  'bp-line',
  'bp-text',
  'gold',
].forEach((k) => (C[k] = css.getPropertyValue('--' + k).trim()));

// Radio del proyectil, en metros.
const R = 0.45;

// Distancia (en metros) frente al lanzador donde no se pueden colocar piezas.
const LAUNCH_CLEAR = 1.5;

// Valores actuales del lanzador: velocidad inicial (v0, m/s), ángulo (ang, grados) y altura (h0, m).
const P = { v0: 18, ang: 45, h0: 2 };

// Gravedad que se está usando ahora mismo, en m/s². Cambia según el nivel o la elección del jugador.
let g = 9.81;

// Convierte un texto a número. Si no se puede, devuelve el valor por defecto d.
// Ejemplo: num('3.5', 0) → 3.5 ; num('hola', 0) → 0
const num = (v, d) => {
  v = parseFloat(v);
  return isFinite(v) ? v : d;
};

// Limita un número para que quede entre a y b. Ejemplo: clamp(120, 0, 90) → 90
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Redondea v al múltiplo más cercano de s. Ejemplo: snap(3.7, 0.5) → 3.5
const snap = (v, s) => Math.round(v / s) * s;

// Redondea a 2 decimales. Ejemplo: r2(3.14159) → 3.14
const r2 = (v) => Math.round(v * 100) / 100;

// Hace una copia completa (independiente) de un objeto, para poder modificarla sin tocar el original.
const clone = (o) => JSON.parse(JSON.stringify(o));

// Da formato a un número con d decimales fijos, como texto. Ejemplo: f(2.5, 2) → "2.50"
const f = (n, d = 2) => (Math.abs(n) < 1e-9 ? 0 : n).toFixed(d);

// Como f(), pero siempre con signo: + o −. Ejemplo: sg(-3) → "−3.00"
const sg = (n, d = 2) => (n >= 0 ? '+' : '−') + f(Math.abs(n), d);

// Número "bonito": hasta 2 decimales, sin ceros sobrantes y con el signo menos tipográfico (−).
const fmtN = (n) => {
  const v = Math.round(n * 100) / 100;
  return (Object.is(v, -0) ? 0 : v).toString().replace('-', '−');
};

// Como fmtN(), pero añade + a los positivos.
const fmtS = (n) => (Math.round(n * 100) / 100 >= 0 ? '+' : '') + fmtN(n);

// Crea un identificador único para los niveles creados por el usuario (ej. "ulq3x9ab12").
const newId = () => 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ¿El nivel tiene vectores? Devuelve true para niveles de desplazamiento y mixtos.
const isMov = (def) => def && (def.type === 'despl' || def.type === 'mixto');

// true si el sistema del usuario pide reducir animaciones (opción de accesibilidad).
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
