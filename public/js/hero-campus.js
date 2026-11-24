/* ==========================================================================
   hero-campus.js — pick one of the five campus photos for the home hero.

   Runs on <html> with `defer`, so the class is in place before first paint and
   the CSS can swap the background image instantly. No markup is generated.
   ========================================================================== */
(() => {
  const pick = 1 + Math.floor(Math.random() * 5);
  document.documentElement.classList.add(`hero-campus-${pick}`);
})();
