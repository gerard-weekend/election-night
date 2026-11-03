// Scale a fixed 1920x1080 design canvas to whatever the TV gives us and
// letterbox the rest. The canvas never reflows — it is a TV, not a webpage,
// so the designer's mockups map 1:1 onto it.

export const CANVAS_W = 1920
export const CANVAS_H = 1080

export function mountStage (stageEl) {
  function fit () {
    const scale = Math.min(window.innerWidth / CANVAS_W, window.innerHeight / CANVAS_H)
    stageEl.style.transform = `translate(-50%, -50%) scale(${scale})`
  }
  fit()
  window.addEventListener('resize', fit)
  // Some TVs report a stale size for a moment after the HDMI mode settles.
  setTimeout(fit, 1000)
  setTimeout(fit, 5000)
  return fit
}

// Chrome allows this on localhost. It stops the display dimming mid-evening.
// The lock is dropped whenever the tab is hidden, so re-request on return.
export async function keepAwake () {
  if (!('wakeLock' in navigator)) return null
  let lock = null
  const request = async () => {
    try { lock = await navigator.wakeLock.request('screen') } catch (e) { /* not fatal */ }
  }
  await request()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') request()
  })
  return () => lock && lock.release()
}
