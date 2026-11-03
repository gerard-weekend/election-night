// Helpers for filling the designer's markup.
//
// The rule from the handoff README: "Treat the first instance of each template
// as the pattern: clone it, fill it, replace the set." Nothing here creates
// markup of its own or touches styling — it only sets text, attributes and the
// CSS custom properties the design already reads.

/** All elements carrying data-field="name" inside root. */
export const fields = (root, name) => [...root.querySelectorAll(`[data-field="${name}"]`)]

/** The first element carrying data-field="name". */
export const field = (root, name) => root.querySelector(`[data-field="${name}"]`)

/** All instances of data-template="name". */
export const templates = (root, name) => [...root.querySelectorAll(`[data-template="${name}"]`)]

/**
 * Capture the first instance of a template as a reusable pattern, and
 * remember where the set lives so it can be replaced wholesale.
 */
export function capture (root, name) {
  const items = templates(root, name)
  if (!items.length) throw new Error(`template not found: ${name}`)
  const pattern = items[0].cloneNode(true)
  const parent = items[0].parentNode
  const before = items[items.length - 1].nextSibling
  return { pattern, parent, before, name }
}

/**
 * Rebuild a captured template's set to exactly `count` items, calling
 * fill(el, i) on each. Existing nodes are reused rather than thrown away, so
 * a poll that changes one number does not rebuild the DOM underneath it —
 * which also keeps CSS transitions from restarting.
 */
export function repeat (cap, count, fill) {
  const existing = templates(cap.parent, cap.name)
  for (let i = existing.length; i < count; i++) {
    cap.parent.insertBefore(cap.pattern.cloneNode(true), cap.before)
  }
  const all = templates(cap.parent, cap.name)
  for (let i = count; i < all.length; i++) all[i].remove()
  const live = templates(cap.parent, cap.name)
  live.forEach((el, i) => fill(el, i))
  return live
}

/** Set text only when it actually changed, so transitions do not restart. */
export function setText (el, value) {
  if (!el) return
  const s = value == null ? '' : String(value)
  if (el.textContent !== s) el.textContent = s
}

export function setAttr (el, name, value) {
  if (!el) return
  if (value == null || value === false || value === '') {
    if (el.hasAttribute(name)) el.removeAttribute(name)
  } else if (el.getAttribute(name) !== String(value)) {
    el.setAttribute(name, String(value))
  }
}

export function setVar (el, name, value) {
  if (!el) return
  const s = String(value)
  if (el.style.getPropertyValue(name) !== s) el.style.setProperty(name, s)
}

export function setStyle (el, prop, value) {
  if (!el) return
  const s = String(value)
  if (el.style[prop] !== s) el.style[prop] = s
}

export const show = (el, visible) => setStyle(el, 'display', visible ? '' : 'none')

/**
 * A valueless attribute the CSS tests for existence, such as [data-pending]
 * or [data-stale]. setAttr cannot do this: it reads '' as "remove".
 */
export function setFlag (el, name, on) {
  if (!el) return
  if (on) { if (!el.hasAttribute(name)) el.setAttribute(name, '') }
  else if (el.hasAttribute(name)) el.removeAttribute(name)
}

/** Display surname, keeping its original case. util.surname() lowercases for
 *  matching, which is wrong on screen. */
export const lastName = name => String(name || '').trim().split(/\s+/).pop() || ''

/** One decimal, the contract's rule for percentages. */
export const pct1 = v => (Number.isFinite(v) ? v.toFixed(1) : '—')

/** Integer, the contract's rule for % expected in. */
export const pct0 = v => `${Math.round(Number.isFinite(v) ? v : 0)}%`
