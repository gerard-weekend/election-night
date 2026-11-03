// The California view is held out of the rotation until its polls close.
// That is invisible until 11 PM ET, and if it is wrong the view never appears
// at all, so the gate is checked here at a range of times.
//
//   node tools/test-gate.mjs

const mem = new Map()
globalThis.localStorage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) }
globalThis.document = { querySelector: () => null, querySelectorAll: () => [], addEventListener () {} }

const { isAvailable } = await import('../src/shell/rotator.js')
const { VIEWS } = await import('../config/views.js')

let pass = 0, fail = 0
const ok = (n, c, d = '') => { c ? (pass++, console.log('  PASS  ' + n)) : (fail++, console.log(`  FAIL  ${n}   ${d}`)) }

const ca = VIEWS.find(v => v.id === 'california')
const others = VIEWS.filter(v => v.id !== 'california')
// Nov 3 2026 is EST, so ET = UTC-5.
const et = (h, m = 0, day = 3) => Date.UTC(2026, 10, day, h + 5, m)

console.log('\n--- California is held until its polls close at 11 PM ET ---')
for (const [label, t] of [
  ['mid-afternoon, 3 PM ET', et(15)],
  ['first polls close, 6 PM ET', et(18)],
  ['the 8 PM ET burst', et(20)],
  ['10:59 PM ET, one minute short', et(22, 59)],
]) ok(`hidden ${label}`, !isAvailable(ca, t))

for (const [label, t] of [
  ['exactly 11 PM ET', et(23)],
  ['11:30 PM ET', et(23, 30)],
  ['after midnight', et(25)],
  ['2 AM ET', et(26)],
]) ok(`shown at ${label}`, isAvailable(ca, t))

console.log('\n--- the other three are never gated ---')
for (const v of others) {
  ok(`${v.id} available all evening`,
    [et(15), et(18), et(23), et(26)].every(t => isAvailable(v, t)))
}

console.log('\n--- the date is pinned, not just the hour ---')
ok('not opened by 11 PM the day before', !isAvailable(ca, et(23, 0, 2)))
ok('still open at 11 PM the day after', isAvailable(ca, et(23, 0, 4)))

console.log('\n--- rotation membership ---')
const at = t => VIEWS.filter(v => isAvailable(v, t)).map(v => v.id).join(' ')
ok('before close the cycle is House, Senate, Governors',
  at(et(20)) === 'house senate governors', at(et(20)))
ok('after close California joins the end',
  at(et(23)) === 'house senate governors california', at(et(23)))

const cycle = t => VIEWS.filter(v => isAvailable(v, t)).reduce((a, v) => a + v.duration, 0) / 1000
console.log(`\n  cycle before close: ${cycle(et(20))}s   after close: ${cycle(et(23))}s`)
console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
