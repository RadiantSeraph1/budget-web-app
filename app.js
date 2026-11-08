(function () {
  const STORE = 'planner-2027-v2', OLD_STORE = 'planner-2027-v1';
  const COLORS = { Housing: '#4c8dff', Living: '#a371f7', Family: '#d29922', Travel: '#2da44e', Savings: '#e5534b', Other: '#8b949e', Unallocated: '#c9d1d9' };
  const BLUE = '#4c8dff', GREEN = '#2da44e', ORANGE = '#d29922', GREY = '#8b949e';

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

  // ---- storage ---------------------------------------------------------------
  const clone = o => JSON.parse(JSON.stringify(o));
  const today = () => new Date().toISOString().slice(0, 10);
  const freshTracker = () => ({
    start: '2027-01', snaps: [], actuals: {}, actualMonth: '2027-01',
    draft: { date: today(), emergency: 0, invest: 0, car: 0, other: 0, debt: 0 },
  });

  // Overlay saved values onto defaults so fields added in later versions still get defaults.
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
  const read = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };

  function loadDb() {
    let saved = read(STORE);
    if (!saved) saved = { active: 'Base', scenarios: { Base: read(OLD_STORE) || {} } }; // migrate v1 single plan
    const db = { active: saved.active, scenarios: {}, tracker: merge(freshTracker(), saved.tracker || {}),
      theme: saved.theme || 'auto', currency: saved.currency || 'GHS' };
    for (const name in saved.scenarios) db.scenarios[name] = merge(clone(DEFAULTS), saved.scenarios[name]);
    if (!db.scenarios[db.active]) db.active = Object.keys(db.scenarios)[0];
    return db;
  }

  let db = loadDb();
  let s = db.scenarios[db.active];
  const persist = () => localStorage.setItem(STORE, JSON.stringify(db));

  const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function setPath(o, p, v) {
    const ks = p.split('.'), last = ks.pop();
    ks.reduce((a, k) => (a[k] = a[k] || {}), o)[last] = v;
  }
  // data-k="@x.y" binds to the whole db (tracker, ...); otherwise to the active scenario.
  const rootFor = k => k[0] === '@' ? [db, k.slice(1)] : [s, k];

  // ---- formatting ------------------------------------------------------------
  const $ = id => document.getElementById(id);
  const num = (n, d = 0) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const ghs = n => (n < 0 ? '-' : '') + 'GH₵' + num(Math.abs(n));
  const usd = (n, d = 0) => (n < 0 ? '-' : '') + 'US$' + num(Math.abs(n), d);
  const isUsd = () => db.currency === 'USD';
  const money = n => isUsd() ? usd(n / s.fx) : ghs(n);        // results follow the currency switch
  const cv = n => isUsd() ? n / s.fx : n;                     // convert a GHS value for charting
  // Charts are drawn at the real column width so their text stays readable on phones.
  const chartSize = () => {
    const w = Math.max(260, Math.min(720, document.querySelector('main').clientWidth - 48));
    return { w, h: w < 480 ? 210 : 250 };
  };
  const cfmt = v => Charts.compact(v, isUsd() ? 'US$' : 'GH₵');
  const pct = (n, d = 1) => num(n, d) + '%';
  const esc = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const rows2 = rows => rows.map(r => `<tr${r.cls ? ` class="${r.cls}"` : ''}>${r.cells.map((c, i) => `<td${i ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`).join('');
  const years = n => n >= 12 ? `${num(n / 12, 1)} years` : `${n} months`;
  const tone = (good, text) => `<span class="${good ? 'ok' : 'bad'}">${text}</span>`;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const ymAdd = (ym, k) => { const [y, m] = ym.split('-').map(Number); const t = y * 12 + (m - 1) + k; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`; };
  const ymLabel = ym => { const [y, m] = ym.split('-'); return `${MONTHS[+m - 1]} ${y.slice(2)}`; };
  const monthsBetween = (startYm, date) => { const [sy, sm] = startYm.split('-').map(Number); const [y, m] = date.split('-').map(Number); return (y - sy) * 12 + (m - sm); };
  const dateLabel = d => { const [y, m, day] = d.split('-'); return `${+day} ${MONTHS[+m - 1]} ${y}`; };

  // ---- sections --------------------------------------------------------------
  function renderIncome(p) {
    const pay = p.pay;
    $('payslip').innerHTML = `<tbody>${rows2([
      { cells: ['Gross (US$' + num(s.gross) + ' × ' + s.fx + ')', money(pay.gross)] },
      { cells: ['Employee SSNIT', money(-pay.ssnit)] },
      { cells: ['PAYE', money(-pay.paye)] },
      { cls: 'total', cells: ['Take-home', money(pay.net)] },
      { cells: ['Take-home in US$', usd(pay.net / s.fx)] },
      { cells: ['Effective tax + SSNIT', pct((pay.ssnit + pay.paye) / pay.gross * 100)] },
    ])}</tbody>`;
    $('employerCost').innerHTML = `<tbody>${rows2([
      { cells: ['Gross salary', money(pay.gross)] },
      { cells: ['Employer SSNIT (' + s.employer + '%)', money(pay.employerSsnit)] },
      { cls: 'total', cells: ['Cost to Radiant / month', money(pay.employerCost)] },
      { cells: ['In US$', usd(pay.employerCost / s.fx)] },
      { cells: ['Per year in US$', usd(pay.employerCost / s.fx * 12)] },
    ])}</tbody>`;
  }

  function renderBudget(p) {
    const { net, total, left } = p;
    s.items.forEach((it, idx) => {
      $('ba' + idx).textContent = money(it.amt * 12);
      $('bp' + idx).textContent = net > 0 ? pct(it.amt / net * 100) : '–';
    });
    $('budgetFoot').innerHTML = rows2([
      { cls: 'total', cells: ['Total allocated', money(total), money(total * 12), net > 0 ? pct(total / net * 100) : '–'] },
      { cls: 'total', cells: ['Cash buffer (take-home minus total)', tone(left >= 0, money(left)), money(left * 12), net > 0 ? pct(left / net * 100) : '–'] },
    ]);
    $('budgetAlert').innerHTML = left < 0
      ? `<div class="banner">Over budget by ${money(-left)} a month: your rows add up to more than your take-home of ${money(net)}. Trim a row.</div>`
      : `<div class="banner ok">Take-home of ${money(net)}: ${money(left)} a month is unallocated.</div>`;
    $('stickySum').innerHTML = `<span class="pill">Cash buffer: ${tone(left >= 0, money(left))} / month</span>`;
    const groups = {};
    s.items.forEach(i => groups[i.group] = (groups[i.group] || 0) + i.amt);
    if (left > 0) groups.Unallocated = left;
    const slices = Object.entries(groups).map(([name, value]) => ({ name, value, color: COLORS[name] }));
    $('budgetViz').innerHTML = Charts.donut(slices, cfmt(cv(Math.max(net, total)))) +
      `<div class="legend">${slices.map(x => `<span><i style="background:${x.color}"></i>${x.name} ${money(x.value)}</span>`).join('')}</div>`;
  }

  function renderInvest(p) {
    const inv = p.inv, a = s.alloc, aSum = a.global + a.local + a.bonds + a.usd;
    const part = k => inv * a[k] / 100;
    $('allocOut').innerHTML = `<table><tbody>${rows2([
      { cells: ['Global equity funds', money(part('global')) + ' / month'] },
      { cells: ['Ghanaian equities', money(part('local')) + ' / month'] },
      { cells: ['Bonds & fixed income', money(part('bonds')) + ' / month'] },
      { cells: ['USD money market', money(part('usd')) + ' / month'] },
      { cls: 'total', cells: ['Total', `${money(inv)} / month`] },
    ])}</tbody></table>` + (Math.abs(aSum - 100) > 0.01
      ? `<div class="banner">Allocation adds up to ${num(aSum, 1)}%, not 100%.</div>`
      : `<p class="note">Equities are ${num(a.global + a.local)}% of this portfolio, so expect large swings. Keep the emergency and car funds out of it.</p>`);
    const pts = [], paid = [];
    for (let y = 0; y <= 20; y++) { pts.push([y, cv(Calc.fv(inv, s.returnPct / 100, y * 12))]); paid.push([y, cv(inv * y * 12)]); }
    $('investChart').innerHTML = Charts.line([
      { name: 'Projected value', color: BLUE, points: pts },
      { name: 'Contributed', color: GREY, dashed: true, points: paid },
    ], { ...chartSize(), fmtY: cfmt, fmtX: x => x + 'y', label: 'Investment growth' });
    $('investOut').innerHTML = `<table><thead><tr><th>After</th><th class="n">Contributed</th><th class="n">Projected value</th><th class="n">Growth</th></tr></thead><tbody>${
      [1, 3, 5, 10, 15, 20].map(y => {
        const v = Calc.fv(inv, s.returnPct / 100, y * 12), c = inv * y * 12;
        return `<tr><td>${y} year${y > 1 ? 's' : ''}</td><td class="n">${money(c)}</td><td class="n">${money(v)}</td><td class="n">${money(v - c)}</td></tr>`;
      }).join('')}</tbody></table>`;
  }

  function renderCarFund(p) {
    const cf = p.cf;
    const show = cf.rows.filter(r => r.month % 3 === 0 || r.month === s.cf.months);
    $('cfOut').innerHTML = `<div class="stats">
        <div class="stat"><b>${money(cf.total)}</b><span>Fund value after ${s.cf.months} months</span></div>
        <div class="stat"><b>${money(cf.paidIn)}</b><span>Paid in</span></div>
        <div class="stat"><b class="${cf.growth < 0 ? 'bad' : ''}">${money(cf.growth)}</b><span>Growth net of fees</span></div>
        <div class="stat"><b>${usd(cf.usdMonthly, 2)}</b><span>Moved to USD each month</span></div>
      </div>
      <table><thead><tr><th>Month</th><th class="n">GHS fund</th><th class="n">USD balance</th><th class="n">Total</th></tr></thead><tbody>${
        show.map(r => `<tr><td>${r.month}</td><td class="n">${money(r.ghs)}</td><td class="n">${usd(r.usd, 2)}</td><td class="n">${money(r.total)}</td></tr>`).join('')}</tbody></table>`;
    $('cfChart').innerHTML = Charts.line([
      { name: 'Car fund value', color: GREEN, points: [[0, cv(s.cf.existing)], ...cf.rows.map(r => [r.month, cv(r.total)])] },
      { name: 'Paid in', color: GREY, dashed: true, points: [[0, cv(s.cf.existing)], ...cf.rows.map(r => [r.month, cv(r.paidIn)])] },
    ], { ...chartSize(), fmtY: cfmt, fmtX: x => 'M' + Math.round(x), hline: { y: cv(p.car.deposit), label: 'Deposit needed (section 5)' }, label: 'Car fund growth' });
    const scen = [['Conservative', 4.6, 0], ['Middle', 6, 1], ['Better outcome', 8, 2], ['Your inputs', s.cf.ghsRate, s.cf.usdRate]];
    $('cfScen').innerHTML = `<thead><tr><th>Scenario</th><th class="n">GHS return</th><th class="n">USD return</th><th class="n">Value</th><th></th></tr></thead><tbody>${
      scen.map(([n, g, u], i) => `<tr><td>${n}</td><td class="n">${g}%</td><td class="n">${u}%</td><td class="n">${money(p.cfFor([g, u]).total)}</td><td class="n">${
        i < 3 ? `<button class="small" data-set='{"cf.ghsRate":${g},"cf.usdRate":${u}}'>Use</button>` : ''}</td></tr>`).join('')}</tbody>`;
  }

  function renderCar(p) {
    const c = s.car, k = p.car;
    $('carOut').innerHTML = `<div class="stats">
        <div class="stat"><b>${money(k.price)}</b><span>Landed cost (${usd(k.price / s.fx)})</span></div>
        <div class="stat"><b>${money(k.deposit)}</b><span>Deposit (${c.depositPct}%)</span></div>
        <div class="stat"><b>${money(k.instalment)}</b><span>Monthly instalment on ${money(k.loan)}</span></div>
        <div class="stat"><b>${money(k.own)}</b><span>Monthly cost to own</span></div>
      </div>
      <table><tbody>${rows2([
        { cells: ['Total interest over the loan', money(k.interest)] },
        { cells: ['Total paid including deposit', money(k.instalment * c.months + k.deposit)] },
        { cells: ['Instalment vs your limit of ' + money(c.instCeiling), tone(k.instalment <= c.instCeiling, k.instalment > c.instCeiling ? 'over by ' + money(k.instalment - c.instCeiling) : 'within limit')] },
        { cells: ['Ownership cost vs your limit of ' + money(c.ownCeiling), tone(k.own <= c.ownCeiling, k.own > c.ownCeiling ? 'over by ' + money(k.own - c.ownCeiling) : 'within limit')] },
        { cells: ['Most you could buy at the instalment limit', money(k.maxPrice)] },
        { cells: ['Car fund at purchase vs deposit needed', tone(k.gap >= 0, k.gap < 0 ? 'short by ' + money(-k.gap) : 'covered, ' + money(k.gap) + ' to spare')] },
        { cells: ['Budget room once you own it (no car fund, transport row replaced)', tone(k.roomAfter >= 0, money(k.roomAfter) + ' / month')] },
      ])}</tbody></table>`;
  }

  function renderFi(p) {
    const fi = p.fi, when = x => x.fiMonth === null ? 'not within 50 years' : years(x.fiMonth);
    const at = (x, y) => x.years[y - 1];
    $('fiOut').innerHTML = `<div class="stats">
        <div class="stat"><b>${money(fi.annualSpend)}</b><span>Annual spending (non-saving rows)</span></div>
        <div class="stat"><b>${money(fi.target0)}</b><span>Independence target today (${num(100 / s.swr, 1)}× spending)</span></div>
        <div class="stat"><b>${fi.flat.emergencyMonth === null ? 'never' : years(fi.flat.emergencyMonth)}</b><span>To reach the emergency target</span></div>
      </div>
      <table><tbody>${rows2([
        { cls: 'total', cells: ['Independent after (salary stays at ' + usd(s.raises[0]) + ')', when(fi.flat)] },
        { cls: 'total', cells: ['Independent after (with the raises below)', when(fi.raises)] },
      ])}</tbody></table>
      <table><thead><tr><th>After</th><th class="n">Portfolio (flat)</th><th class="n">Portfolio (raises)</th><th class="n">Target (raises)</th></tr></thead><tbody>${
        [1, 3, 5, 10, 15, 20, 30].map(y => `<tr><td>${y} year${y > 1 ? 's' : ''}</td><td class="n">${money(at(fi.flat, y).port)}</td><td class="n">${money(at(fi.raises, y).port)}</td><td class="n">${money(at(fi.raises, y).target)}</td></tr>`).join('')}</tbody></table>`;
    const upto = Math.min(30, fi.raises.years.length);
    const line = (x, key, y0) => [[0, cv(y0)], ...x.years.slice(0, upto).map(r => [r.year, cv(r[key])])];
    $('fiChart').innerHTML = Charts.line([
      { name: 'Portfolio (flat salary)', color: GREY, dashed: true, points: line(fi.flat, 'port', s.startPortfolio) },
      { name: 'Portfolio (with raises)', color: BLUE, points: line(fi.raises, 'port', s.startPortfolio) },
      { name: 'Target (with raises)', color: ORANGE, points: line(fi.raises, 'target', fi.target0) },
    ], { ...chartSize(), fmtY: cfmt, fmtX: x => Math.round(x) + 'y', label: 'Path to financial independence, in today\'s money' });
  }

  function renderNetWorth(p) {
    const t = db.tracker;
    const nominal = Calc.fiPath({ ...p.fiBase, inflationPct: 0, salaries: s.raises }).monthly;
    const expected = m => {
      const em = Math.min(s.emergencyTarget, s.emergencyStart + p.item('emergency').amt * Math.max(0, m));
      const invest = m <= 0 ? s.startPortfolio : nominal[Math.min(m, nominal.length) - 1];
      const car = m <= 0 || !p.cf.rows.length ? s.cf.existing : p.cf.rows[Math.min(m, p.cf.rows.length) - 1].total;
      return em + invest + car;
    };
    const snaps = t.snaps.map((x, i) => ({ ...x, i })).sort((a, b) => a.date.localeCompare(b.date));
    if (!snaps.length) {
      $('nwOut').innerHTML = '<p class="note">No snapshots yet. Add your first one above to start comparing with the plan.</p>';
      return;
    }
    const rows = snaps.map(x => {
      const m = monthsBetween(t.start, x.date);
      const pots = x.emergency + x.invest + x.car, plan = expected(m);
      return { ...x, m, pots, nw: pots + x.other - x.debt, plan, diff: pots - plan };
    });
    const maxM = Math.max(...rows.map(r => r.m), 1), step = Math.max(1, Math.ceil(maxM / 36));
    const planPts = [];
    for (let m = Math.min(0, ...rows.map(r => r.m)); m <= maxM; m += step) planPts.push([m, cv(expected(m))]);
    const last = rows[rows.length - 1];
    $('nwOut').innerHTML = `<div class="stats">
        <div class="stat"><b>${money(last.nw)}</b><span>Net worth on ${dateLabel(last.date)}</span></div>
        <div class="stat"><b class="${last.diff < 0 ? 'bad' : 'ok'}">${money(last.diff)}</b><span>Pots vs plan (${last.diff < 0 ? 'behind' : 'ahead'})</span></div>
        <div class="stat"><b>${money(last.plan)}</b><span>Plan for emergency + investments + car fund</span></div>
      </div>` +
      Charts.line([
        { name: 'Your net worth', color: BLUE, points: rows.map(r => [r.m, cv(r.nw)]) },
        { name: 'Plan (three pots)', color: GREY, dashed: true, points: planPts },
      ], { ...chartSize(), fmtY: cfmt, fmtX: x => ymLabel(ymAdd(t.start, Math.round(x))), label: 'Net worth against plan' }) +
      `<table><thead><tr><th>Date</th><th class="n">Three pots</th><th class="n">Other</th><th class="n">Debts</th><th class="n">Net worth</th><th class="n">Plan (pots)</th><th class="n">Pots vs plan</th><th></th></tr></thead><tbody>${
        rows.map(r => `<tr><td>${dateLabel(r.date)}</td><td class="n">${money(r.pots)}</td><td class="n">${money(r.other)}</td><td class="n">${money(-r.debt)}</td><td class="n"><b>${money(r.nw)}</b></td><td class="n">${money(r.plan)}</td><td class="n">${tone(r.diff >= 0, money(r.diff))}</td><td class="n"><button class="small" data-delsnap="${r.i}">Delete</button></td></tr>`).join('')}</tbody></table>`;
  }

  function renderActuals(p) {
    const month = db.tracker.actualMonth, act = db.tracker.actuals[month] || {};
    const isLogged = v => v !== undefined && v !== '';
    const signed = d => tone(d >= 0, (d >= 0 ? '+' : '') + money(d));
    // Totals compare only the rows you filled in, so a half-entered month isn't shown as "under budget".
    const tally = a => {
      const t = { spend: 0, save: 0, bSpend: 0, bSave: 0, n: 0 };
      s.items.forEach(it => {
        if (!isLogged(a[it.id])) return;
        t.n++;
        t[it.kind] += a[it.id];
        t[it.kind === 'spend' ? 'bSpend' : 'bSave'] += it.amt;
      });
      return t;
    };
    s.items.forEach((it, idx) => {
      const v = act[it.id];
      $('av' + idx).innerHTML = !isLogged(v) ? '–' : signed(it.kind === 'spend' ? it.amt - v : v - it.amt); // positive is good
    });
    const t = tally(act);
    const rest = t.n === s.items.length ? rows2([{ cls: 'total', cells: ['Take-home minus spent minus saved', money(p.net), money(p.net - t.spend - t.save), ''] }]) : '';
    $('actualFoot').innerHTML = !t.n ? '' : rows2([
      { cls: 'total', cells: ['Spent (rows entered)', money(t.bSpend), money(t.spend), signed(t.bSpend - t.spend)] },
      { cls: 'total', cells: ['Saved (rows entered)', money(t.bSave), money(t.save), signed(t.save - t.bSave)] },
    ]) + rest;
    const months = Object.keys(db.tracker.actuals).sort().filter(m => tally(db.tracker.actuals[m]).n);
    $('actualHistory').innerHTML = !months.length ? '<p class="note">No months logged yet.</p>' :
      `<table><thead><tr><th>Month</th><th class="n">Rows</th><th class="n">Spent</th><th class="n">Budget</th><th class="n">Saved</th><th class="n">Target</th></tr></thead><tbody>${months.map(m => {
        const x = tally(db.tracker.actuals[m]);
        return `<tr><td>${ymLabel(m)}</td><td class="n">${x.n}/${s.items.length}</td><td class="n">${tone(x.spend <= x.bSpend, money(x.spend))}</td><td class="n">${money(x.bSpend)}</td><td class="n">${tone(x.save >= x.bSave, money(x.save))}</td><td class="n">${money(x.bSave)}</td></tr>`;
      }).join('')}</tbody></table>`;
    s.items.forEach(it => {
      const el = document.querySelector(`[data-act="${it.id}"]`);
      if (el !== document.activeElement) el.value = act[it.id] ?? '';
    });
    s.items.forEach((it, idx) => $('ab' + idx).textContent = money(it.amt));
  }

  // Key figures for one scenario, used by the comparison table.
  function metrics(sc) {
    const p = Calc.plan(sc);
    const fi = x => x.fiMonth === null ? '50+ years' : years(x.fiMonth);
    const at10 = p.fi.raises.years[9].port;
    return [
      ['Gross salary', usd(sc.gross) + ' / month'],
      ['Take-home', money(p.net)],
      ['Cash buffer', tone(p.left >= 0, money(p.left))],
      ['Saved per month', money(p.saveTotal) + ' (' + pct(p.saveTotal / p.net * 100, 0) + ')'],
      ['Annual spending', money(p.fi.annualSpend)],
      ['Car fund at purchase', money(p.cf.total)],
      ['Car landed cost', money(p.car.price)],
      ['Loan instalment', tone(p.car.instalment <= sc.car.instCeiling, money(p.car.instalment))],
      ['Room once car is owned', tone(p.car.roomAfter >= 0, money(p.car.roomAfter))],
      ['Portfolio after 10 years (raises)', money(at10)],
      ['Independent after (flat salary)', fi(p.fi.flat)],
      ['Independent after (with raises)', fi(p.fi.raises)],
    ];
  }

  function renderScenarios() {
    const names = Object.keys(db.scenarios);
    $('scenarioSel').innerHTML = names.map(n => `<option${n === db.active ? ' selected' : ''}>${esc(n)}</option>`).join('');
    $('scenarioLine').innerHTML = `Active scenario: <b>${esc(db.active)}</b>`;
    $('scenarioList').innerHTML = `<table><tbody>${names.map(n => `<tr><td>${esc(n)}${n === db.active ? ' <span class="tag">active</span>' : ''}</td><td class="n">${
      n === db.active ? '' : `<button class="small" data-load="${esc(n)}">Open</button> `}${
      names.length > 1 ? `<button class="small" data-delscn="${esc(n)}">Delete</button>` : ''}</td></tr>`).join('')}</tbody></table>`;
    const cols = names.map(n => metrics(db.scenarios[n]));
    $('scenarioCompare').innerHTML = `<table><thead><tr><th></th>${names.map(n => `<th class="n">${esc(n)}</th>`).join('')}</tr></thead><tbody>${
      cols[0].map((row, i) => `<tr><td>${row[0]}</td>${cols.map(c => `<td class="n">${c[i][1]}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  // Label each cell with its column heading so tables can turn into cards on phones.
  function labelTables() {
    document.querySelectorAll('main table').forEach(t => {
      const heads = [...t.querySelectorAll('thead th')].map(th => th.textContent.trim());
      if (!heads.length) return;
      t.classList.add('stack');
      t.querySelectorAll('tr').forEach(tr => {
        if (tr.parentNode.tagName === 'THEAD') return;
        [...tr.children].forEach((td, i) => { if (heads[i]) td.dataset.label = heads[i]; });
      });
    });
  }

  function render() {
    const p = Calc.plan(s);
    renderIncome(p); renderBudget(p); renderInvest(p); renderCarFund(p); renderCar(p);
    renderFi(p); renderNetWorth(p); renderActuals(p); renderScenarios();
    labelTables();
    $('currency').value = db.currency;
    $('theme').textContent = 'Theme: ' + db.theme;
    document.querySelectorAll('[data-k]').forEach(el => {
      if (el === document.activeElement) return;
      const [root, path] = rootFor(el.dataset.k);
      el.value = getPath(root, path) ?? '';
    });
  }

  // ---- one-time DOM construction --------------------------------------------
  function build() {
    let last = '';
    $('budgetRows').innerHTML = s.items.map((it, idx) => {
      const head = it.group !== last ? `<tr class="group"><td colspan="4">${it.group}</td></tr>` : '';
      last = it.group;
      return head + `<tr><td>${it.name}${it.kind === 'save' ? '<span class="tag">save</span>' : ''}</td>` +
        `<td><input type="number" min="0" step="100" data-k="items.${idx}.amt"></td><td class="n" id="ba${idx}"></td><td class="n" id="bp${idx}"></td></tr>`;
    }).join('');
    last = '';
    $('actualRows').innerHTML = s.items.map((it, idx) => {
      const head = it.group !== last ? `<tr class="group"><td colspan="4">${it.group}</td></tr>` : '';
      last = it.group;
      return head + `<tr><td>${it.name}${it.kind === 'save' ? '<span class="tag">save</span>' : ''}</td><td class="n" id="ab${idx}"></td>` +
        `<td><input type="number" min="0" step="100" data-act="${it.id}"></td><td class="n" id="av${idx}"></td></tr>`;
    }).join('');
    $('raises').innerHTML = s.raises.map((_, i) =>
      `<label>${i === s.raises.length - 1 ? `Year ${i + 1} onwards` : `Year ${i + 1}`}<input type="number" min="0" step="500" data-k="raises.${i}"></label>`).join('');
  }

  // ---- tabs, theme -----------------------------------------------------------
  function showTab(id) {
    if (!$(id)) id = 'income';
    document.querySelectorAll('main section').forEach(sec => sec.classList.toggle('on', sec.id === id));
    document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === id));
    $('moreBtn').classList.toggle('on', !!$('moreSheet').querySelector(`[data-tab="${id}"]`));
    setSheet(false);
    history.replaceState(null, '', '#' + id);
    const nav = $('tabs'), on = nav.querySelector('.on');
    if (on) nav.scrollTo({ left: on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2, behavior: 'smooth' });
  }
  function setSheet(open) {
    $('moreSheet').hidden = !open;
    $('sheetBackdrop').hidden = !open;
    $('moreBtn').setAttribute('aria-expanded', open);
  }
  function applyTheme() {
    if (db.theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', db.theme);
  }

  // ---- export ----------------------------------------------------------------
  function exportCsv() {
    const p = Calc.plan(s), r = n => Math.round(n * 100) / 100, t = db.tracker;
    const out = [
      ['Scenario', db.active], [],
      ['INCOME (GHS / month)'], ['Gross salary US$', s.gross], ['Exchange rate', s.fx], ['Gross GHS', r(p.pay.gross)],
      ['Employee SSNIT', r(p.pay.ssnit)], ['PAYE', r(p.pay.paye)], ['Take-home', r(p.net)], ['Cost to employer', r(p.pay.employerCost)], [],
      ['BUDGET', 'Type', 'Monthly', 'Annual'],
      ...s.items.map(i => [i.name, i.kind, i.amt, i.amt * 12]),
      ['Total allocated', '', p.total, p.total * 12], ['Cash buffer', '', r(p.left), r(p.left * 12)], [],
      ['INVESTMENT PROJECTION', 'Contributed', 'Value'],
      ...[1, 3, 5, 10, 15, 20].map(y => [y + ' years', p.inv * y * 12, r(Calc.fv(p.inv, s.returnPct / 100, y * 12))]), [],
      ['CAR FUND', 'GHS fund', 'USD balance', 'Total GHS'],
      ...p.cf.rows.map(x => ['Month ' + x.month, r(x.ghs), r(x.usd), r(x.total)]), [],
      ['CAR', 'GHS'], ['Landed cost', p.car.price], ['Deposit', r(p.car.deposit)], ['Loan', r(p.car.loan)],
      ['Monthly instalment', r(p.car.instalment)], ['Total interest', r(p.car.interest)], ['Monthly cost to own', r(p.car.own)], [],
      ['FINANCIAL INDEPENDENCE', 'Portfolio (flat)', 'Portfolio (raises)', 'Target (raises)'],
      ...[1, 3, 5, 10, 15, 20, 30].map(y => [y + ' years', r(p.fi.flat.years[y - 1].port), r(p.fi.raises.years[y - 1].port), r(p.fi.raises.years[y - 1].target)]),
      ['Months to independence (flat)', p.fi.flat.fiMonth ?? 'n/a'], ['Months to independence (raises)', p.fi.raises.fiMonth ?? 'n/a'], [],
      ['NET WORTH SNAPSHOTS', 'Emergency', 'Investments', 'Car fund', 'Other', 'Debts'],
      ...t.snaps.map(x => [x.date, x.emergency, x.invest, x.car, x.other, x.debt]), [],
      ['ACTUALS', ...s.items.map(i => i.name)],
      ...Object.keys(t.actuals).sort().map(m => [m, ...s.items.map(i => t.actuals[m][i.id] ?? '')]),
    ];
    const csv = out.map(row => row.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'finance-plan-' + db.active.replace(/[^\w-]+/g, '_') + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---- events ----------------------------------------------------------------
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.act) {
      const m = db.tracker.actuals[db.tracker.actualMonth] = db.tracker.actuals[db.tracker.actualMonth] || {};
      if (el.value === '') delete m[el.dataset.act]; else m[el.dataset.act] = parseFloat(el.value) || 0;
    } else if (el.dataset.k) {
      const [root, path] = rootFor(el.dataset.k);
      setPath(root, path, el.type === 'number' ? (parseFloat(el.value) || 0) : el.value);
    } else return;
    persist(); render();
  });

  document.addEventListener('click', e => {
    const hit = e.target.closest && e.target.closest('[data-tab],[data-set],[data-load],[data-delscn],[data-delsnap]');
    const d = hit ? hit.dataset : {};
    if (d.tab) { showTab(d.tab); window.scrollTo(0, 0); return; }
    if (d.set) { for (const [k, v] of Object.entries(JSON.parse(d.set))) setPath(s, k, v); persist(); render(); }
    else if (d.load) { db.active = d.load; s = db.scenarios[d.load]; persist(); render(); }
    else if (d.delscn) {
      if (confirm(`Delete scenario "${d.delscn}"?`)) {
        delete db.scenarios[d.delscn];
        if (db.active === d.delscn) { db.active = Object.keys(db.scenarios)[0]; s = db.scenarios[db.active]; }
        persist(); render();
      }
    } else if (d.delsnap !== undefined) { db.tracker.snaps.splice(+d.delsnap, 1); persist(); render(); }
  });

  $('addSnap').addEventListener('click', () => {
    const d = db.tracker.draft;
    if (!d.date) return alert('Pick a date for the snapshot.');
    db.tracker.snaps.push({ date: d.date, emergency: d.emergency, invest: d.invest, car: d.car, other: d.other, debt: d.debt });
    persist(); render();
  });
  $('saveScenario').addEventListener('click', () => {
    let name = $('scenarioName').value.trim();
    if (!name) { let n = Object.keys(db.scenarios).length + 1; while (db.scenarios['Scenario ' + n]) n++; name = 'Scenario ' + n; }
    if (db.scenarios[name]) return alert(`A scenario called "${name}" already exists.`);
    db.scenarios[name] = clone(s);
    db.active = name; s = db.scenarios[name];
    $('scenarioName').value = '';
    persist(); render();
  });
  $('scenarioSel').addEventListener('change', e => { db.active = e.target.value; s = db.scenarios[db.active]; persist(); render(); });
  $('currency').addEventListener('change', e => { db.currency = e.target.value; persist(); render(); });
  $('theme').addEventListener('click', () => {
    db.theme = { auto: 'light', light: 'dark', dark: 'auto' }[db.theme];
    applyTheme(); persist(); render();
  });
  $('exportCsv').addEventListener('click', exportCsv);
  $('print').addEventListener('click', () => window.print());
  $('reset').addEventListener('click', () => {
    if (confirm(`Reset every input in "${db.active}" to its default? Your tracker data is kept.`)) {
      db.scenarios[db.active] = clone(DEFAULTS); s = db.scenarios[db.active]; persist(); render();
    }
  });

  $('moreBtn').addEventListener('click', () => setSheet($('moreSheet').hidden));
  $('sheetBackdrop').addEventListener('click', () => setSheet(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setSheet(false); });
  $('menuBtn').addEventListener('click', () => {
    const open = $('tools').classList.toggle('open');
    $('menuBtn').setAttribute('aria-expanded', open);
  });
  // tap a number field and the whole value is selected, so typing replaces it
  document.addEventListener('focusin', e => { if (e.target.type === 'number') e.target.select(); });
  let lastW = chartSize().w, timer;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { const w = chartSize().w; if (w !== lastW) { lastW = w; render(); } }, 150);
  });

  build();
  document.querySelectorAll('input[type=number]').forEach(i => i.inputMode = 'decimal');
  applyTheme();
  render();
  showTab(location.hash.slice(1));
})();
