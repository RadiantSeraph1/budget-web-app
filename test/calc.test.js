// Run: node test/calc.test.js  — checks calc.js against the figures in the planning chat.
const assert = require('assert');
const C = require('../calc.js');
const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg}: got ${a}, want ${b}`);

const s = C.salary({ grossUsd: 5000, fx: 11.64 });
near(s.gross, 58200, 0.5, 'gross');
near(s.ssnit, 3201, 0.5, 'ssnit');
near(s.paye, 15371, 1, 'paye');
near(s.net, 39628, 1, 'net');
near(s.employerCost, 65766, 1, 'employer cost');

near(C.fv(2500, 0.08, 12), 31085, 1, 'car fund 12m @8%');
near(C.fv(2500, 0.08, 24), 64656, 1, 'car fund 24m @8%');
near(C.fv(9000, 0.10, 60), 689000, 1000, 'invest 5y @10%');
near(C.fv(9000, 0.10, 240), 6460000, 10000, 'invest 20y @10%');

// chat scenarios: 3000 GHS + 2000 GHS-equivalent USD at 11.785, 12 months
const cf = r => C.carFund({ monthly: 5000, months: 12, ghsPct: 60, fxBuy: 11.785, fxExit: 11.785,
  ghsRatePct: r[0], ghsFeePct: 0, frontLoadPct: 0, usdRatePct: r[1], existing: 0 }).total;
near(cf([4.6, 0]), 60753, 5, 'conservative');
near(cf([6, 1]), 61089, 5, 'middle');
near(cf([8, 2]), 61521, 5, 'better');

near(C.pmt(200000, 0.20, 60), 5298, 10, 'loan pmt');
near(C.maxLoan(C.pmt(200000, 0.2, 60), 0.2, 60), 200000, 0.01, 'maxLoan roundtrip');

// FI path with no raises should match the 10%-return table (no inflation)
const fi = C.fiPath({ baseInvest: 9000, emergencyContrib: 3500, emergencyTarget: 100000, returnPct: 10,
  inflationPct: 0, swrPct: 4, annualSpend: 272400, salaries: [5000], investShare: 0.7, netFor: () => 39628 });
assert(fi.emergencyMonth === 29, 'emergency month ' + fi.emergencyMonth);
assert(fi.years[19].port > 6e6, 'fi 20y');
console.log('all calc checks passed; FI reached month', fi.fiMonth);

// plan(): whole-scenario model on the defaults (kept in sync with app.js DEFAULTS)
const S = { gross: 5000, fx: 11.64, ssnit: 5.5, employer: 13, returnPct: 10, inflation: 0, swr: 4,
  emergencyTarget: 100000, emergencyStart: 0, startPortfolio: 0, investShare: 70, raises: [5000, 6000, 7000, 8000],
  cf: { months: 12, ghsPct: 60, fxBuy: 11.785, fxExit: 11.785, ghsRate: 7.82, ghsFee: 0, front: 0, usdRate: 0, existing: 0 },
  car: { cif: 110000, duty: 45000, other: 5000, depositPct: 20, rate: 20, months: 60, fuel: 1000, insMaint: 1000, instCeiling: 3500, ownCeiling: 5500 },
  items: [['rent', 4500, 'spend'], ['util', 1500, 'spend'], ['food', 3500, 'spend'], ['transport', 1800, 'spend'], ['care', 1200, 'spend'],
    ['ent', 1200, 'spend'], ['family', 4000, 'spend'], ['travel', 4000, 'spend'], ['emergency', 3500, 'save'], ['invest', 9000, 'save'],
    ['car', 5000, 'save'], ['medical', 1000, 'spend']].map(([id, amt, kind]) => ({ id, amt, kind })) };
const p = C.plan(S);
near(p.left, -572, 1, 'buffer');
near(p.fi.annualSpend, 272400, 0.5, 'annual spend');
near(p.fi.target0, 6810000, 1, 'FI target');
near(p.car.instalment, 3391, 5, 'instalment');
assert(p.fi.flat.monthly.length === 600, 'monthly series');
console.log('plan checks passed');
