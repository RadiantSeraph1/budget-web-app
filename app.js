(function () {
  const KEY = 'planner-2027-v1';
  const COLORS = { Housing: '#1f6feb', Living: '#8957e5', Family: '#d29922', Travel: '#2da44e', Savings: '#cf222e', Other: '#6e7781' };

  const DEFAULTS = {
    gross: 5000, fx: 11.64, ssnit: 5.5, employer: 13,
    // kind: 'spend' counts toward living costs (and the FI target); 'save' builds wealth or a goal fund
    items: [
      { id: 'rent',      name: 'Rent reserve (one-year advance)', group: 'Housing', kind: 'spend', amt: 4500 },
      { id: 'util',      name: 'Electricity, water & internet',   group: 'Housing', kind: 'spend', amt: 1500 },
      { id: 'food',      name: 'Food & groceries',                group: 'Living',  kind: 'spend', amt: 3500 },
      { id: 'transport', name: 'Transport',                       group: 'Living',  kind: 'spend', amt: 1800 },
      { id: 'care',      name: 'Personal care & gym',             group: 'Living',  kind: 'spend', amt: 1200 },
      { id: 'ent',       name: 'Entertainment & dining',          group: 'Living',  kind: 'spend', amt: 1200 },
      { id: 'family',    name: 'Parents & immediate family',      group: 'Family',  kind: 'spend', amt: 4000 },
      { id: 'travel',    name: 'International travel fund',       group: 'Travel',  kind: 'spend', amt: 4000 },
      { id: 'emergency', name: 'Emergency fund',                  group: 'Savings', kind: 'save',  amt: 3500 },
      { id: 'invest',    name: 'Long-term investments',           group: 'Savings', kind: 'save',  amt: 9000 },
      { id: 'car',       name: 'Car fund',                        group: 'Savings', kind: 'save',  amt: 5000 },
      { id: 'medical',   name: 'Medical & annual expenses',       group: 'Other',   kind: 'spend', amt: 1000 },
    ],
    returnPct: 10, inflation: 0, swr: 4,
    alloc: { global: 60, local: 10, bonds: 20, usd: 10 },
    emergencyTarget: 100000, emergencyStart: 0, startPortfolio: 0, investShare: 70,
    raises: [5000, 6000, 7000, 8000],
    cf: { months: 12, ghsPct: 60, fxBuy: 11.785, fxExit: 11.785, ghsRate: 7.82, ghsFee: 0, front: 0, usdRate: 0, existing: 0 },
    car: { cif: 110000, duty: 45000, other: 5000, depositPct: 20, rate: 20, months: 60, fuel: 1000, insMaint: 1000, instCeiling: 3500, ownCeiling: 5500 },
  };

  // ---- state & path helpers -------------------------------------------------
  const clone = o => JSON.parse(JSON.stringify(o));
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      return saved ? merge(clone(DEFAULTS), saved) : clone(DEFAULTS);
    } catch { return clone(DEFAULTS); }
  }
  // Overlay saved values onto defaults so new fields added later still get defaults.
  function merge(base, over) {
    for (const k in over) {
      if (Array.isArray(base[k]) && Array.isArray(over[k])) {
        base[k] = base[k].map((b, i) => (over[k][i] && typeof b === 'object') ? merge(b, over[k][i]) : (over[k][i] ?? b));
        if (!base[k].length || typeof base[k][0] !== 'object') base[k] = over[k];
      } else if (base[k] && typeof base[k] === 'object') merge(base[k], over[k]);
      else base[k] = over[k];
    }
    return base;
  }
  const getPath = (o, p) => p.split('.').reduce((a, k) => a[k], o);
  function setPath(o, p, v) {
    const ks = p.split('.'); const last = ks.pop();
    ks.reduce((a, k) => a[k], o)[last] = v;
  }

  let s = load();
  const $ = id => document.getElementById(id);
  const num = (n, d = 0) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const ghs = n => (n < 0 ? '-' : '') + 'GH₵' + num(Math.abs(n));
  const usd = (n, d = 0) => 'US$' + num(n, d);
  const pct = (n, d = 1) => num(n, d) + '%';
  const rows2 = rows => rows.map(r => `<tr${r.cls ? ` class="${r.cls}"` : ''}>${r.cells.map((c, i) => `<td${i ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`).join('');
  const item = id => s.items.find(i => i.id === id);
  const years = n => n >= 12 ? `${num(n / 12, 1)} years` : `${n} months`;

  const salaryFor = grossUsd => Calc.salary({ grossUsd, fx: s.fx, ssnitPct: s.ssnit, employerPct: s.employer });

  // ---- rendering ------------------------------------------------------------
  function render() {
    const pay = salaryFor(s.gross);

    // 1. income
    $('payslip').innerHTML = `<tbody>${rows2([
      { cells: ['Gross (US$' + num(s.gross) + ' × ' + s.fx + ')', ghs(pay.gross)] },
      { cells: ['Employee SSNIT', ghs(-pay.ssnit)] },
      { cells: ['PAYE', ghs(-pay.paye)] },
      { cls: 'total', cells: ['Take-home', ghs(pay.net)] },
      { cells: ['Take-home in US$', usd(pay.net / s.fx)] },
      { cells: ['Effective tax + SSNIT', pct((pay.ssnit + pay.paye) / pay.gross * 100)] },
    ])}</tbody>`;
    $('employerCost').innerHTML = `<tbody>${rows2([
      { cells: ['Gross salary', ghs(pay.gross)] },
      { cells: ['Employer SSNIT (' + s.employer + '%)', ghs(pay.employerSsnit)] },
      { cls: 'total', cells: ['Cost to Radiant / month', ghs(pay.employerCost)] },
      { cells: ['In US$', usd(pay.employerCost / s.fx)] },
      { cells: ['Per year in US$', usd(pay.employerCost / s.fx * 12)] },
    ])}</tbody>`;

    // 2. budget
    const net = pay.net;
    const total = s.items.reduce((a, i) => a + i.amt, 0);
    const left = net - total;
    s.items.forEach((it, idx) => {
      $('ba' + idx).textContent = ghs(it.amt * 12);
      $('bp' + idx).textContent = net > 0 ? pct(it.amt / net * 100) : '–';
    });
    $('budgetFoot').innerHTML = rows2([
      { cls: 'total', cells: ['Total allocated', ghs(total), ghs(total * 12), net > 0 ? pct(total / net * 100) : '–'] },
      { cls: 'total', cells: ['Cash buffer (take-home minus total)', `<span class="${left < 0 ? 'bad' : 'ok'}">${ghs(left)}</span>`, ghs(left * 12), net > 0 ? pct(left / net * 100) : '–'] },
    ]);
    $('budgetAlert').innerHTML = left < 0
      ? `<div class="banner">Over budget by ${ghs(-left)} a month: your rows add up to more than your take-home of ${ghs(net)}. Trim a row.</div>`
      : `<div class="banner ok">Take-home of ${ghs(net)}: ${ghs(left)} a month is unallocated.</div>`;
    const groups = {};
    s.items.forEach(i => groups[i.group] = (groups[i.group] || 0) + i.amt);
    if (left > 0) groups.Other = (groups.Other || 0) + left;
    const denom = Math.max(net, total) || 1;
    $('bar').innerHTML = Object.entries(groups).map(([g, v]) => `<span style="width:${v / denom * 100}%;background:${COLORS[g]}" title="${g}"></span>`).join('');
    $('legend').innerHTML = Object.entries(groups).map(([g, v]) => `<span><i style="background:${COLORS[g]}"></i>${g} ${ghs(v)}</span>`).join('');

    // 3. investments
    const inv = item('invest').amt;
    const a = s.alloc, aSum = a.global + a.local + a.bonds + a.usd;
    const part = k => inv * a[k] / 100;
    $('allocOut').innerHTML = `<table><tbody>${rows2([
      { cells: ['Global equity funds', ghs(part('global')) + ' / month'] },
      { cells: ['Ghanaian equities', ghs(part('local')) + ' / month'] },
      { cells: ['Bonds & fixed income', ghs(part('bonds')) + ' / month'] },
      { cells: ['USD money market', ghs(part('usd')) + ' / month'] },
      { cls: 'total', cells: ['Total', `${ghs(inv)} / month`] },
    ])}</tbody></table>` + (Math.abs(aSum - 100) > 0.01
      ? `<div class="banner">Allocation adds up to ${num(aSum, 1)}%, not 100%.</div>`
      : `<p class="note">Equities are ${num(a.global + a.local)}% of this portfolio, so expect large swings. Keep the emergency and car funds out of it.</p>`);
    $('investOut').innerHTML = `<table><thead><tr><th>After</th><th class="n">Contributed</th><th class="n">Projected value</th><th class="n">Growth</th></tr></thead><tbody>${
      [1, 3, 5, 10, 15, 20].map(y => {
        const v = Calc.fv(inv, s.returnPct / 100, y * 12), c = inv * y * 12;
        return `<tr><td>${y} year${y > 1 ? 's' : ''}</td><td class="n">${ghs(c)}</td><td class="n">${ghs(v)}</td><td class="n">${ghs(v - c)}</td></tr>`;
      }).join('')}</tbody></table>`;

    // 4. car fund
    const cfIn = rate => ({ monthly: item('car').amt, months: s.cf.months, ghsPct: s.cf.ghsPct, fxBuy: s.cf.fxBuy, fxExit: s.cf.fxExit,
      ghsRatePct: rate[0], ghsFeePct: s.cf.ghsFee, frontLoadPct: s.cf.front, usdRatePct: rate[1], existing: s.cf.existing });
    const cf = Calc.carFund(cfIn([s.cf.ghsRate, s.cf.usdRate]));
    const show = cf.rows.filter(r => r.month % 3 === 0 || r.month === s.cf.months);
    $('cfOut').innerHTML = `<div class="stats">
        <div class="stat"><b>${ghs(cf.total)}</b><span>Fund value after ${s.cf.months} months</span></div>
        <div class="stat"><b>${ghs(cf.paidIn)}</b><span>Paid in</span></div>
        <div class="stat"><b class="${cf.growth < 0 ? 'bad' : ''}">${ghs(cf.growth)}</b><span>Growth net of fees</span></div>
        <div class="stat"><b>${usd(cf.usdMonthly, 2)}</b><span>Moved to USD each month</span></div>
      </div>
      <table><thead><tr><th>Month</th><th class="n">GHS fund</th><th class="n">USD balance</th><th class="n">Total (GH₵)</th></tr></thead><tbody>${
        show.map(r => `<tr><td>${r.month}</td><td class="n">${ghs(r.ghs)}</td><td class="n">${usd(r.usd, 2)}</td><td class="n">${ghs(r.total)}</td></tr>`).join('')}</tbody></table>`;
    const scen = [['Conservative', 4.6, 0], ['Middle', 6, 1], ['Better outcome', 8, 2], ['Your inputs', s.cf.ghsRate, s.cf.usdRate]];
    $('cfScen').innerHTML = `<thead><tr><th>Scenario</th><th class="n">GHS return</th><th class="n">USD return</th><th class="n">Value</th><th></th></tr></thead><tbody>${
      scen.map(([n, g, u], i) => `<tr><td>${n}</td><td class="n">${g}%</td><td class="n">${u}%</td><td class="n">${ghs(Calc.carFund(cfIn([g, u])).total)}</td><td class="n">${
        i < 3 ? `<button class="small" data-set='{"cf.ghsRate":${g},"cf.usdRate":${u}}'>Use</button>` : ''}</td></tr>`).join('')}</tbody>`;

    // 5. car affordability
    const c = s.car;
    const price = c.cif + c.duty + c.other;
    const deposit = price * c.depositPct / 100, loan = price - deposit;
    const pay1 = c.months > 0 ? Calc.pmt(loan, c.rate / 100, c.months) : 0;
    const own = pay1 + c.fuel + c.insMaint;
    const maxPrice = Calc.maxLoan(c.instCeiling, c.rate / 100, c.months) / (1 - c.depositPct / 100 || 1);
    const gap = cf.total - deposit;
    // after buying: the transport row is replaced by car running costs and the car-fund saving stops
    const budgetFree = left + item('transport').amt + item('car').amt;
    $('carOut').innerHTML = `<div class="stats">
        <div class="stat"><b>${ghs(price)}</b><span>Landed cost (${usd(price / s.fx)})</span></div>
        <div class="stat"><b>${ghs(deposit)}</b><span>Deposit (${c.depositPct}%)</span></div>
        <div class="stat"><b>${ghs(pay1)}</b><span>Monthly instalment on ${ghs(loan)}</span></div>
        <div class="stat"><b>${ghs(own)}</b><span>Monthly cost to own</span></div>
      </div>
      <table><tbody>${rows2([
        { cells: ['Total interest over the loan', ghs(pay1 * c.months - loan)] },
        { cells: ['Total paid including deposit', ghs(pay1 * c.months + deposit)] },
        { cells: ['Instalment vs your limit of ' + ghs(c.instCeiling), `<span class="${pay1 > c.instCeiling ? 'bad' : 'ok'}">${pay1 > c.instCeiling ? 'over by ' + ghs(pay1 - c.instCeiling) : 'within limit'}</span>`] },
        { cells: ['Ownership cost vs your limit of ' + ghs(c.ownCeiling), `<span class="${own > c.ownCeiling ? 'bad' : 'ok'}">${own > c.ownCeiling ? 'over by ' + ghs(own - c.ownCeiling) : 'within limit'}</span>`] },
        { cells: ['Most you could buy at the instalment limit', ghs(maxPrice)] },
        { cells: ['Car fund at purchase vs deposit needed', `<span class="${gap < 0 ? 'bad' : 'ok'}">${gap < 0 ? 'short by ' + ghs(-gap) : 'covered, ' + ghs(gap) + ' to spare'}</span>`] },
        { cells: ['Budget room once you own it (no car fund, transport row replaced)', `<span class="${budgetFree - own < 0 ? 'bad' : 'ok'}">${ghs(budgetFree - own)} / month</span>`] },
      ])}</tbody></table>`;

    // 6. financial independence
    const annualSpend = s.items.filter(i => i.kind === 'spend').reduce((t, i) => t + i.amt, 0) * 12;
    const base = {
      baseInvest: item('invest').amt, emergencyContrib: item('emergency').amt, emergencyTarget: s.emergencyTarget,
      emergencyStart: s.emergencyStart, startPortfolio: s.startPortfolio, returnPct: s.returnPct, inflationPct: s.inflation,
      swrPct: s.swr, annualSpend, investShare: s.investShare / 100, netFor: g => salaryFor(g).net,
    };
    const flat = Calc.fiPath({ ...base, salaries: [s.raises[0]] });
    const withRaises = Calc.fiPath({ ...base, salaries: s.raises });
    const target0 = annualSpend / (s.swr / 100);
    const when = p => p.fiMonth === null ? 'not within 50 years' : years(p.fiMonth);
    const at = (p, y) => p.years[y - 1];
    $('fiOut').innerHTML = `<div class="stats">
        <div class="stat"><b>${ghs(annualSpend)}</b><span>Annual spending (non-saving rows)</span></div>
        <div class="stat"><b>${ghs(target0)}</b><span>Independence target today (${num(100 / s.swr, 1)}× spending)</span></div>
        <div class="stat"><b>${flat.emergencyMonth === null ? 'never' : years(flat.emergencyMonth)}</b><span>To reach the emergency target</span></div>
      </div>
      <table><tbody>${rows2([
        { cls: 'total', cells: ['Independent after (salary stays at ' + usd(s.raises[0]) + ')', when(flat)] },
        { cls: 'total', cells: ['Independent after (with the raises below)', when(withRaises)] },
      ])}</tbody></table>
      <table><thead><tr><th>After</th><th class="n">Portfolio (flat)</th><th class="n">Portfolio (raises)</th><th class="n">Target (raises)</th></tr></thead><tbody>${
        [1, 3, 5, 10, 15, 20, 30].map(y => `<tr><td>${y} year${y > 1 ? 's' : ''}</td><td class="n">${ghs(at(flat, y).port)}</td><td class="n">${ghs(at(withRaises, y).port)}</td><td class="n">${ghs(at(withRaises, y).target)}</td></tr>`).join('')}</tbody></table>`;

    // keep every bound input in step with state (skip the one being typed in)
    document.querySelectorAll('[data-k]').forEach(el => {
      if (el !== document.activeElement) el.value = getPath(s, el.dataset.k);
    });
  }

  // ---- one-time DOM construction -------------------------------------------
  function build() {
    let last = '';
    $('budgetRows').innerHTML = s.items.map((it, idx) => {
      const head = it.group !== last ? `<tr class="group"><td colspan="4">${it.group}</td></tr>` : '';
      last = it.group;
      return head + `<tr><td>${it.name}${it.kind === 'save' ? '<span class="tag">save</span>' : ''}</td>` +
        `<td><input type="number" min="0" step="100" data-k="items.${idx}.amt"></td><td class="n" id="ba${idx}"></td><td class="n" id="bp${idx}"></td></tr>`;
    }).join('');
    $('raises').innerHTML = s.raises.map((_, i) =>
      `<label>${i === s.raises.length - 1 ? `Year ${i + 1} onwards` : `Year ${i + 1}`}<input type="number" min="0" step="500" data-k="raises.${i}"></label>`).join('');
  }

  document.addEventListener('input', e => {
    const k = e.target.dataset && e.target.dataset.k;
    if (!k) return;
    setPath(s, k, parseFloat(e.target.value) || 0);
    localStorage.setItem(KEY, JSON.stringify(s));
    render();
  });
  document.addEventListener('click', e => {
    const set = e.target.dataset && e.target.dataset.set;
    if (set) {
      for (const [k, v] of Object.entries(JSON.parse(set))) setPath(s, k, v);
      localStorage.setItem(KEY, JSON.stringify(s));
      render();
    }
  });
  $('reset').addEventListener('click', () => {
    if (confirm('Reset every input to its default?')) { localStorage.removeItem(KEY); s = clone(DEFAULTS); render(); }
  });

  build();
  render();
})();
