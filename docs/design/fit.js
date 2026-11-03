// Scales the fixed 1920×1080 .stage to fill the window, letterboxing if the
// screen is not 16:9. Include once per page, after the .stage element.
(function () {
  function fit() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    document.querySelectorAll('.stage').forEach(function (el) {
      el.style.setProperty('--scale', s);
    });
  }
  window.addEventListener('resize', fit);
  fit();
})();
