// California view: the 11 configured races, driven by config/california.js.
//
// California counts for days, so "% expected vote in" appears on every race
// and a partial count has to look normal rather than broken. A measure is
// "passing"/"failing" on the numbers but only "PASSES"/"FAILS" once called.

import { CALIFORNIA_RACES } from '../../../config/california.js'
import { propStatus, statusOf } from '../../model/race.js'
import { freshness } from '../../shell/ticker.js'

// Two pages alternate within the view's slot if more races are configured
// than fit comfortably. Eleven fits on one.
const PER_PAGE = 12

export default {
  id: 'california',
  title: 'California',

  ready (store) { return CALIFORNIA_RACES.some(c => store.getRace(c.key)) },

  mount (root, store) {
    this.store = store
    this.page = 0
    root.innerHTML = `
      <section class="v-ca">
        <header class="v-head">
          <h1>California</h1>
          <span class="v-fresh" data-field="ca.freshness"></span>
        </header>
        <div class="ca-note" data-field="ca.note">California counts for days — figures are partial</div>
        <div class="ca-grid" data-field="ca.races"></div>
        <div class="ca-pager" data-field="ca.pager"></div>
      </section>`
    this.el = {
      grid: root.querySelector('[data-field="ca.races"]'),
      pager: root.querySelector('[data-field="ca.pager"]'),
      fresh: root.querySelector('[data-field="ca.freshness"]'),
    }
    this.update()
  },

  show () {
    // Alternate pages each time the view comes round, if there are two.
    const pages = Math.ceil(CALIFORNIA_RACES.length / PER_PAGE)
    if (pages > 1) { this.page = (this.page + 1) % pages; this.update() }
  },

  cardProp (cfg, r) {
    const yes = r.candidates.find(c => c.id === 'yes')
    const no = r.candidates.find(c => c.id === 'no')
    const total = (yes ? yes.votes : 0) + (no ? no.votes : 0)
    const yPct = total ? (100 * yes.votes) / total : 0
    const st = propStatus(r)
    const verdict = { passes: 'PASSES', fails: 'FAILS', passing: 'Passing', failing: 'Failing', none: '' }[st]
    return `
      <article class="ca-card ca-prop" data-template="ca.prop" data-key="${r.key}"
               data-status="${statusOf(r)}" data-prop-status="${st}">
        <div class="ca-label">${cfg.label}</div>
        <div class="ca-title">${cfg.title || ''}</div>
        <div class="ca-yn">
          <div class="yn yn-yes" data-leading="${yPct > 50 ? '1' : ''}">
            <span class="yn-k">YES</span>
            <span class="yn-p" data-field="${r.key}.yes.pct">${yPct.toFixed(1)}%</span>
            <span class="yn-v">${yes ? yes.votes.toLocaleString() : '0'}</span>
          </div>
          <div class="yn yn-no" data-leading="${yPct < 50 && total ? '1' : ''}">
            <span class="yn-k">NO</span>
            <span class="yn-p" data-field="${r.key}.no.pct">${(total ? 100 - yPct : 0).toFixed(1)}%</span>
            <span class="yn-v">${no ? no.votes.toLocaleString() : '0'}</span>
          </div>
        </div>
        <div class="ca-bar" style="--yes:${yPct}"></div>
        <div class="ca-meta">
          <span class="ca-in">${r.pctIn.toFixed(0)}% expected vote in</span>
          <span class="ca-verdict">${verdict}${r.call ? ` · ${r.call.source}` : ''}</span>
          ${r.singleSourced ? '<span class="ca-single" title="single source">NYT only</span>' : ''}
        </div>
      </article>`
  },

  cardRace (cfg, r) {
    // Top-two means two candidates can share a party, so the two rows must be
    // told apart by name, not colour alone.
    const cands = r.candidates.slice(0, 2)
    const rows = cands.map(c => `
      <div class="ca-cand" data-party="${c.party || 'O'}"
           data-winner="${r.call && r.call.winner === c.id ? '1' : ''}"
           data-leading="${r.leader === c.id ? '1' : ''}">
        <span class="ca-name">${c.name}</span>
        <span class="ca-party">${c.party && c.party !== 'O' ? c.party : ''}</span>
        <span class="ca-pct">${c.pct.toFixed(1)}%</span>
        <span class="ca-votes">${c.votes.toLocaleString()}</span>
      </div>`).join('')
    return `
      <article class="ca-card ca-race" data-template="ca.race" data-key="${r.key}"
               data-status="${statusOf(r)}">
        <div class="ca-label">${cfg.label}</div>
        <div class="ca-cands">${rows}</div>
        <div class="ca-meta">
          <span class="ca-in">${r.pctIn.toFixed(0)}% expected vote in</span>
          <span class="ca-verdict">${r.call ? `PROJECTED WINNER · ${r.call.source}` : ''}</span>
          ${r.singleSourced ? '<span class="ca-single" title="single source">NYT only</span>' : ''}
        </div>
      </article>`
  },

  update () {
    if (!this.el) return
    const store = this.store
    const pages = Math.ceil(CALIFORNIA_RACES.length / PER_PAGE)
    const slice = CALIFORNIA_RACES.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE)

    this.el.grid.innerHTML = slice.map(cfg => {
      const r = store.getRace(cfg.key)
      if (!r || !r.candidates.length) {
        return `<article class="ca-card is-waiting" data-key="${cfg.key}">
                  <div class="ca-label">${cfg.label}</div>
                  <div class="ca-waiting">Waiting for first results</div>
                </article>`
      }
      return cfg.kind === 'prop' ? this.cardProp(cfg, r) : this.cardRace(cfg, r)
    }).join('')

    this.el.pager.textContent = pages > 1 ? `${this.page + 1} / ${pages}` : ''

    const f = freshness(store, 'civicCA')
    this.el.fresh.textContent = f.text
    this.el.fresh.dataset.state = f.state
  },
}
