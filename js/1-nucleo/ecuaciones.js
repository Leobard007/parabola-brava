/* ======================================================================
   ARCHIVO: js/1-nucleo/ecuaciones.js

   ECUACIONES CON FORMATO DE CUADERNO
   Funciones que convierten las fórmulas en HTML con fracciones apiladas, raíces con barra,
   exponentes y pasos alineados en el signo =. Las usan el panel de ecuaciones del tiro,
   las soluciones paso a paso, el Escondite y las notas del editor.
   Para cambiar el aspecto (tipografía, tamaño, grosor de las barras) edita la sección
   "ecuaciones" al final de css/base.css.
   ====================================================================== */

/* =========================================================
   ECUACIONES CON FORMATO "DE CUADERNO"
   Pequeñas funciones que devuelven HTML para escribir matemáticas como en papel:
     M.frac('a', 'b')   → fracción con barra horizontal (a arriba, b abajo)
     M.sqrt('x')        → raíz cuadrada con la barra sobre todo el radicando
     M.sup('2')         → exponente
     M.half             → ½ como fracción apilada
     M.eq(izq, p1, p2…) → ecuación en varias líneas con los signos = alineados:
                            izq = p1
                                = p2
                                = resultado
   El aspecto (tamaño, tipografía, grosor de las barras) está en css/base.css,
   en la sección "ecuaciones".
   Regla de multiplicación: entre letras no se escribe signo (v₀t, ½at²);
   entre números se usa un punto (18 · cos 45°).
   ========================================================= */

// Funciones para escribir ecuaciones como en el cuaderno (fracciones, raíces, exponentes, pasos alineados). Ver el encabezado del archivo.
const M = {
  frac: (n, d) => `<span class="mfrac"><span class="mnum">${n}</span><span class="mden">${d}</span></span>`,
  // la "palomita" de la raíz es un pequeño dibujo SVG que se estira a la altura de lo que hay adentro
  sqrt: (x) =>
    `<span class="msqrt"><svg class="mroot" viewBox="0 0 10 24" preserveAspectRatio="none" aria-hidden="true"><path d="M0.5 14 L3 12.5 L5.5 23 L9.4 0.7 H10"/></svg><span class="mrad">${x}</span></span>`,
  sup: (x) => `<sup class="msup">${x}</sup>`,
  get half() {
    return M.frac('1', '2');
  },
  dot: '<span class="mdot">·</span>',
  // paréntesis altos, para encerrar una fracción
  par: (x) => `<span class="mpar">(</span>${x}<span class="mpar">)</span>`,
  // número para sustituir en una fórmula: los negativos van entre paréntesis, como en el cuaderno
  n: (v, d = 2) => (v < 0 ? `(−${f(-v, d)})` : f(v, d)),
  // número al cuadrado: 5.66² o (−5.66)²
  sq: (v, d = 2) => M.n(v, d) + M.sup(2),
  // suma de números con sus signos: 8.66 − 3.00 + 2.50
  sum: (vals, d = 2) =>
    vals
      .map((v, i) =>
        i === 0 ? (v < 0 ? '−' : '') + f(Math.abs(v), d) : (v < 0 ? ' − ' : ' + ') + f(Math.abs(v), d),
      )
      .join(''),
  // resultado final, en negrita y con su unidad
  res: (v, unit) => `<b class="mres">${v}${unit ? '&nbsp;' + unit : ''}</b>`,
  // ecuación en varias líneas, con el = alineado; lhs puede llevar color (clase k)
  eq: (lhs, ...steps) =>
    `<div class="meq">${steps
      .map(
        (s, i) =>
          `<span class="ml">${i ? '' : lhs}</span><span class="mo">=</span><span class="mr">${s}</span>`,
      )
      .join('')}</div>`,
  // matemáticas dentro de una frase
  inl: (x) => `<span class="mi">${x}</span>`,
};

/* Ecuaciones de las componentes de un vector (se usan en la solución y en el Escondite).
   i = número de vector (0 = V₁), v = sus valores (de vecVals o resultant().vals) */

// Ecuaciones de las componentes Δx y Δy de un vector: fórmula, sustitución y resultado.
function compEqs(i, v) {
  const s = vname(i).slice(1),
    [sx, sy] = DIRV[v.dir],
    sign = (k) => (k < 0 ? '−' : '');
  const k = (t) => `<span class="k">${t}</span>`;
  let ex, ey;
  if (sx === 0)
    ex = M.eq(
      k(`Δx${s}`),
      M.res('0', 'm') + ` <span class="mnote">(${L('va en vertical', 'vertical')})</span>`,
    );
  else if (sy === 0) ex = M.eq(k(`Δx${s}`), `${sign(sx)}|V${s}|`, M.res(sg(v.x), 'm'));
  else
    ex = M.eq(
      k(`Δx${s}`),
      `${sign(sx)}|V${s}| cos θ${s}`,
      `${sign(sx)}${f(v.d)} ${M.dot} cos ${fmtN(v.ang)}°`,
      M.res(sg(v.x), 'm'),
    );
  if (sy === 0)
    ey = M.eq(
      k(`Δy${s}`),
      M.res('0', 'm') + ` <span class="mnote">(${L('va en horizontal', 'horizontal')})</span>`,
    );
  else if (sx === 0) ey = M.eq(k(`Δy${s}`), `${sign(sy)}|V${s}|`, M.res(sg(v.y), 'm'));
  else
    ey = M.eq(
      k(`Δy${s}`),
      `${sign(sy)}|V${s}| sin θ${s}`,
      `${sign(sy)}${f(v.d)} ${M.dot} sin ${fmtN(v.ang)}°`,
      M.res(sg(v.y), 'm'),
    );
  return `<div class="mpair">${ex}${ey}</div>`;
}
/* Suma de componentes: Rₓ = Δx₁ + Δx₂ + … = 8.66 − 3.00 = 5.66 m  (lhs = 'Rₓ' o 'x', axis = 'x' o 'y') */
// Ecuación de la suma de componentes (Rₓ = Δx₁ + Δx₂ + … = valores = resultado).
function sumEq(lhs, axis, vals, total) {
  const names = vals.map((_, i) => `Δ${axis}${vname(i).slice(1)}`).join(' + ');
  const nums = vals.map((v) => v[axis]);
  return vals.length > 1
    ? M.eq(lhs, names, M.sum(nums), M.res(sg(total), 'm'))
    : M.eq(lhs, names, M.res(sg(total), 'm'));
}
