/* ======================================================================
   FILE: js/1-core/equations.js

   EQUATIONS WRITTEN LIKE IN A NOTEBOOK
   Small functions that build HTML text to show math the way people write it
   on paper:
     mathFraction('a', 'b')   → a fraction with a horizontal bar (a on top, b below)
     mathSquareRoot('x')      → a square root with the bar over everything inside
     mathPower('2')           → an exponent (a small number up and to the right)
     MATH_HALF                → ½ as a stacked fraction
     mathEquation(left, [step1, step2, ...])
                              → an equation in several lines with the "=" signs lined up:
                                   left = step1
                                        = step2
                                        = result
   How they look (font, size, thickness of the bars) is set in css/base.css,
   in the section "EQUATIONS WRITTEN LIKE IN A NOTEBOOK".

   Multiplication rule used in the game: between letters no sign is written
   (v₀t, ½at²); between numbers a dot is used (18 · cos 45°).
   ====================================================================== */

// mathFraction(top, bottom): HTML of a fraction. The CSS draws the bar as the
// bottom border of the top part.
function mathFraction(top, bottom) {
  return `<span class="fraction"><span class="fraction-top">${top}</span><span class="fraction-bottom">${bottom}</span></span>`;
}

// mathSquareRoot(inside): HTML of a square root.
// The root sign is a tiny SVG drawing (a "check mark" shape) that stretches to the height
// of what is inside; the bar on top is the top border of the inside part.
function mathSquareRoot(inside) {
  const rootSign =
    '<svg class="square-root-sign" viewBox="0 0 10 24" preserveAspectRatio="none" aria-hidden="true">' +
    '<path d="M0.5 14 L3 12.5 L5.5 23 L9.4 0.7 H10"/></svg>';
  return `<span class="square-root">${rootSign}<span class="square-root-inside">${inside}</span></span>`;
}

// mathPower(exponent): HTML of an exponent, for example mathPower('2') gives the small ².
function mathPower(exponent) {
  return `<sup class="exponent">${exponent}</sup>`;
}

// MATH_HALF: the fraction ½ written with a horizontal bar.
const MATH_HALF = mathFraction('1', '2');

// MATH_DOT: the multiplication dot written between two numbers.
const MATH_DOT = '<span class="multiply-dot">·</span>';

// mathTallParentheses(inside): tall parentheses around a fraction.
function mathTallParentheses(inside) {
  return `<span class="tall-parenthesis">(</span>${inside}<span class="tall-parenthesis">)</span>`;
}

// mathNumber(value, decimals): a number written inside a formula.
// Negative numbers go between parentheses, like in a notebook: (−5.66)
function mathNumber(value, decimals) {
  if (decimals === undefined) {
    decimals = 2;
  }
  if (value < 0) {
    return `(−${formatFixed(-value, decimals)})`;
  }
  return formatFixed(value, decimals);
}

// mathSquared(value, decimals): a number squared, for example 5.66² or (−5.66)²
function mathSquared(value, decimals) {
  return mathNumber(value, decimals) + mathPower(2);
}

// mathSum(values, decimals): a list of numbers added with their signs.
// Example: mathSum([8.66, -3, 2.5]) → "8.66 − 3.00 + 2.50"
function mathSum(values, decimals) {
  if (decimals === undefined) {
    decimals = 2;
  }
  let text = '';
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    const absoluteText = formatFixed(Math.abs(value), decimals);
    if (index === 0) {
      // the first number only shows its sign when it is negative
      if (value < 0) {
        text += '−' + absoluteText;
      } else {
        text += absoluteText;
      }
    } else if (value < 0) {
      text += ' − ' + absoluteText;
    } else {
      text += ' + ' + absoluteText;
    }
  }
  return text;
}

// mathResult(value, unit): the final result in bold with its unit, for example "12.73 m/s".
// &nbsp; is a space that never breaks the line between the number and the unit.
function mathResult(value, unit) {
  let unitText = '';
  if (unit) {
    unitText = '&nbsp;' + unit;
  }
  return `<b class="equation-result">${value}${unitText}</b>`;
}

// mathEquation(leftSide, steps): an equation written in several lines.
//   leftSide: what goes before the first "=" (for example "vₓ")
//   steps:    a list with each line after the "=" (formula, substitution, result)
// The CSS places the pieces in a 3-column grid so all the "=" line up.
function mathEquation(leftSide, steps) {
  let html = '<div class="equation">';
  for (let index = 0; index < steps.length; index++) {
    let leftText = '';
    if (index === 0) {
      leftText = leftSide; // only the first line shows the left side
    }
    html += `<span class="equation-left">${leftText}</span>`;
    html += '<span class="equation-equals">=</span>';
    html += `<span class="equation-right">${steps[index]}</span>`;
  }
  html += '</div>';
  return html;
}

// mathInline(content): math inside a normal sentence (same font as the equations).
function mathInline(content) {
  return `<span class="inline-math">${content}</span>`;
}

// equationLabel(text): the colored name on the left of an equation (for example "Δx₁").
function equationLabel(text) {
  return `<span class="equation-label">${text}</span>`;
}

// componentEquations(vectorIndex, values): the equations for the components Δx and Δy
// of one vector, shown side by side. Used in the step by step solution and in Hide & seek.
//   vectorIndex: 0 for V₁, 1 for V₂...
//   values:      the values of that vector (from calculateVectorValues)
function componentEquations(vectorIndex, values) {
  // subscript: "₁" for V₁, "₂" for V₂...
  const subscript = getVectorName(vectorIndex).slice(1);
  const signs = DIRECTION_SIGNS[values.direction];
  const horizontalSign = signs[0];
  const verticalSign = signs[1];
  let horizontalEquation;
  let verticalEquation;

  // Δx (horizontal component)
  if (horizontalSign === 0) {
    // the vector goes straight up or down: no horizontal movement
    const note = ` <span class="equation-note">(${translate('va en vertical', 'vertical')})</span>`;
    horizontalEquation = mathEquation(equationLabel(`Δx${subscript}`), [mathResult('0', 'm') + note]);
  } else if (verticalSign === 0) {
    // the vector is horizontal: Δx is the whole length
    horizontalEquation = mathEquation(equationLabel(`Δx${subscript}`), [
      `${minusSignIfNegative(horizontalSign)}|V${subscript}|`,
      mathResult(formatSigned(values.dx), 'm'),
    ]);
  } else {
    horizontalEquation = mathEquation(equationLabel(`Δx${subscript}`), [
      `${minusSignIfNegative(horizontalSign)}|V${subscript}| cos θ${subscript}`,
      `${minusSignIfNegative(horizontalSign)}${formatFixed(values.distance)} ${MATH_DOT} cos ${formatNice(values.angle)}°`,
      mathResult(formatSigned(values.dx), 'm'),
    ]);
  }

  // Δy (vertical component)
  if (verticalSign === 0) {
    const note = ` <span class="equation-note">(${translate('va en horizontal', 'horizontal')})</span>`;
    verticalEquation = mathEquation(equationLabel(`Δy${subscript}`), [mathResult('0', 'm') + note]);
  } else if (horizontalSign === 0) {
    verticalEquation = mathEquation(equationLabel(`Δy${subscript}`), [
      `${minusSignIfNegative(verticalSign)}|V${subscript}|`,
      mathResult(formatSigned(values.dy), 'm'),
    ]);
  } else {
    verticalEquation = mathEquation(equationLabel(`Δy${subscript}`), [
      `${minusSignIfNegative(verticalSign)}|V${subscript}| sin θ${subscript}`,
      `${minusSignIfNegative(verticalSign)}${formatFixed(values.distance)} ${MATH_DOT} sin ${formatNice(values.angle)}°`,
      mathResult(formatSigned(values.dy), 'm'),
    ]);
  }
  return `<div class="equation-pair">${horizontalEquation}${verticalEquation}</div>`;
}

// minusSignIfNegative(sign): "−" when sign is negative, nothing otherwise.
function minusSignIfNegative(sign) {
  if (sign < 0) {
    return '−';
  }
  return '';
}

// sumEquation(leftSide, axis, allVectorValues, total): the sum of the components.
// Example: Rₓ = Δx₁ + Δx₂ = 8.66 − 3.00 = +5.66 m
//   leftSide: what goes before the "=" (for example "Rₓ" or "x")
//   axis:     'dx' to add the horizontal components, 'dy' for the vertical ones
//   allVectorValues: list with the values of every vector
//   total:    the result of the sum
function sumEquation(leftSide, axis, allVectorValues, total) {
  let axisLetter = 'x';
  if (axis === 'dy') {
    axisLetter = 'y';
  }
  const names = [];
  const numbers = [];
  for (let index = 0; index < allVectorValues.length; index++) {
    names.push(`Δ${axisLetter}${getVectorName(index).slice(1)}`);
    numbers.push(allVectorValues[index][axis]);
  }
  const namesText = names.join(' + ');
  if (allVectorValues.length > 1) {
    return mathEquation(leftSide, [namesText, mathSum(numbers), mathResult(formatSigned(total), 'm')]);
  }
  return mathEquation(leftSide, [namesText, mathResult(formatSigned(total), 'm')]);
}
