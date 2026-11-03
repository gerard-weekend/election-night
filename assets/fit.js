// Selector extended to .tk-fixed: the ticker was hoisted out of the stages so
// it never moves between views, and it needs the same scale.
// Scales the fixed 1920×1080 .stage to fill the window, letterboxing if the
// screen is not 16:9. Include once per page, after the .stage element.
(function () {
  function fit() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    document.querySelectorAll('.stage, .tk-fixed').forEach(function (el) {
      el.style.setProperty('--scale', s);
    });
  }
  window.addEventListener('resize', fit);
  fit();
})();
