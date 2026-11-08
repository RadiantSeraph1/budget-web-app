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
