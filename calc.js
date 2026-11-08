// Pure calculation helpers. No DOM access, so they can be tested in Node.
(function (root) {
  // GRA monthly PAYE bands for resident individuals, year of assessment 2026
  // (effective 1 Sep 2026): https://gra.gov.gh/domestic-tax/tax-types/paye/
  // Each band applies to chargeable income above `from`.
  const PAYE_BANDS = [
    { from: 0, rate: 0 },
    { from: 588, rate: 0.05 },
    { from: 668, rate: 0.10 },
    { from: 768, rate: 0.175 },
    { from: 3668, rate: 0.25 },
    { from: 19668, rate: 0.30 },
    { from: 50000, rate: 0.35 },
  ];

  const monthlyRate = annual => Math.pow(1 + annual, 1 / 12) - 1;

  function paye(chargeable, bands = PAYE_BANDS) {
    let tax = 0;
    bands.forEach((b, i) => {
      const to = i + 1 < bands.length ? bands[i + 1].from : Infinity;
      if (chargeable > b.from) tax += (Math.min(chargeable, to) - b.from) * b.rate;
    });
    return tax;
  }

  // Monthly salary in GHS from a USD gross. Employee SSNIT is deducted before PAYE.
  function salary({ grossUsd, fx, ssnitPct = 5.5, employerPct = 13, bands = PAYE_BANDS }) {
    const gross = grossUsd * fx;
    const ssnit = gross * ssnitPct / 100;
    const tax = paye(gross - ssnit, bands);
    return {
      gross, ssnit, paye: tax,
      net: gross - ssnit - tax,
      employerSsnit: gross * employerPct / 100,
      employerCost: gross * (1 + employerPct / 100),
    };
  }

  // Future value of end-of-month contributions at an annual effective rate.
  function fv(monthly, annualRate, months, start = 0) {
    const r = monthlyRate(annualRate);
    if (r === 0) return start + monthly * months;
    return start * Math.pow(1 + r, months) + monthly * (Math.pow(1 + r, months) - 1) / r;
  }

  function pmt(principal, annualRate, months) {
    const r = annualRate / 12;
    return r === 0 ? principal / months : principal * r / (1 - Math.pow(1 + r, -months));
  }

  const maxLoan = (payment, annualRate, months) => {
    const r = annualRate / 12;
    return r === 0 ? payment * months : payment * (1 - Math.pow(1 + r, -months)) / r;
  };

  // Car fund split between a GHS fund and a USD account (USD valued at fxExit).
  // Returns a month-by-month schedule.
  function carFund(o) {
    const ghsIn = o.monthly * o.ghsPct / 100 * (1 - o.frontLoadPct / 100);
    const usdIn = o.monthly * (1 - o.ghsPct / 100) / o.fxBuy;
    const rg = monthlyRate((o.ghsRatePct - o.ghsFeePct) / 100);
    const ru = monthlyRate(o.usdRatePct / 100);
    let ghs = o.existing || 0, usd = 0;
    const rows = [];
    for (let m = 1; m <= o.months; m++) {
      ghs = ghs * (1 + rg) + ghsIn;
      usd = usd * (1 + ru) + usdIn;
      rows.push({ month: m, ghs, usd, total: ghs + usd * o.fxExit, paidIn: (o.existing || 0) + o.monthly * m });
    }
    const last = rows[rows.length - 1] || { ghs: 0, usd: 0, total: 0, paidIn: 0 };
    return { rows, usdMonthly: usdIn, ...last, growth: last.total - last.paidIn };
  }

  // Month-by-month path to financial independence, in today's money.
  //  - base investment and emergency contributions are constant
  //  - once the emergency fund hits its target, that contribution is redirected to investing
  //  - a raise's extra take-home is split: `investShare` invested, the rest spent (raises the FI target)
  function fiPath(o) {
    const real = (1 + o.returnPct / 100) / (1 + o.inflationPct / 100) - 1;
    const r = monthlyRate(real);
    const net0 = o.netFor(o.salaries[0]);
    let port = o.startPortfolio || 0, emergency = o.emergencyStart || 0, emergencyMonth = null;
    if (emergency >= o.emergencyTarget) emergencyMonth = 0;
    const years = [], monthly = [], maxYears = o.maxYears || 50;
    let fiMonth = null;
    for (let m = 1; m <= maxYears * 12; m++) {
      const y = Math.floor((m - 1) / 12);
      const sal = o.salaries[Math.min(y, o.salaries.length - 1)];
      const extra = Math.max(0, o.netFor(sal) - net0);
      let c = o.baseInvest + extra * o.investShare;
      if (emergencyMonth === null) {
        emergency += o.emergencyContrib;
        if (emergency >= o.emergencyTarget) emergencyMonth = m;
      } else {
        c += o.emergencyContrib;
      }
      port = port * (1 + r) + c;
      const target = (o.annualSpend + extra * 12 * (1 - o.investShare)) / (o.swrPct / 100);
      if (fiMonth === null && port >= target) fiMonth = m;
      monthly.push(port);
      if (m % 12 === 0) years.push({ year: m / 12, port, target, contribution: c });
    }
    return { years, monthly, fiMonth, emergencyMonth };
  }

  // The whole model for one scenario `s` (the shape saved by the app).
  function plan(s) {
    const item = id => s.items.find(i => i.id === id);
    const sal = g => salary({ grossUsd: g, fx: s.fx, ssnitPct: s.ssnit, employerPct: s.employer });
    const pay = sal(s.gross), net = pay.net;
    const total = s.items.reduce((a, i) => a + i.amt, 0);
    const left = net - total;
    const saveTotal = s.items.filter(i => i.kind === 'save').reduce((a, i) => a + i.amt, 0);
    const annualSpend = s.items.filter(i => i.kind === 'spend').reduce((a, i) => a + i.amt, 0) * 12;

    const cfFor = rates => carFund({ monthly: item('car').amt, months: s.cf.months, ghsPct: s.cf.ghsPct,
      fxBuy: s.cf.fxBuy, fxExit: s.cf.fxExit, ghsRatePct: rates[0], ghsFeePct: s.cf.ghsFee,
      frontLoadPct: s.cf.front, usdRatePct: rates[1], existing: s.cf.existing });
    const cf = cfFor([s.cf.ghsRate, s.cf.usdRate]);

    const c = s.car;
    const price = c.cif + c.duty + c.other;
    const deposit = price * c.depositPct / 100, loan = price - deposit;
    const instalment = c.months > 0 ? pmt(loan, c.rate / 100, c.months) : 0;
    const own = instalment + c.fuel + c.insMaint;
    const car = {
      price, deposit, loan, instalment, own,
      interest: instalment * c.months - loan,
      maxPrice: maxLoan(c.instCeiling, c.rate / 100, c.months) / (1 - c.depositPct / 100 || 1),
      gap: cf.total - deposit,
      // after buying: the transport row is replaced by running costs and the car-fund saving stops
      roomAfter: left + item('transport').amt + item('car').amt - own,
    };

    const fiBase = {
      baseInvest: item('invest').amt, emergencyContrib: item('emergency').amt, emergencyTarget: s.emergencyTarget,
      emergencyStart: s.emergencyStart, startPortfolio: s.startPortfolio, returnPct: s.returnPct,
      inflationPct: s.inflation, swrPct: s.swr, annualSpend, investShare: s.investShare / 100,
      netFor: g => sal(g).net,
    };
    const fi = {
      annualSpend, target0: annualSpend / (s.swr / 100),
      flat: fiPath({ ...fiBase, salaries: [s.raises[0]] }),
      raises: fiPath({ ...fiBase, salaries: s.raises }),
    };
    return { item, sal, pay, net, total, left, saveTotal, inv: item('invest').amt, cf, cfFor, car, fi, fiBase };
  }

  const api = { PAYE_BANDS, paye, salary, fv, pmt, maxLoan, carFund, fiPath, monthlyRate, plan };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(this);
