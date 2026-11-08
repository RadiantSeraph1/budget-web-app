# budget-web-app

2027 personal finance planner. Open `index.html` in a browser: no build step, no dependencies. Everything is saved in localStorage.

**Plan:** US$ salary -> Ghana PAYE/SSNIT take-home -> monthly budget -> investment projections -> low-risk car fund (USD + GHS) -> car loan affordability -> financial-independence roadmap.

**Tracking:** net worth snapshots vs plan, monthly actuals vs budget.

**Mobile:** sticky scrolling tab bar, tables turn into labelled cards, 16px inputs with numeric keyboard and 44px tap targets, charts drawn at screen width, a floating cash-buffer pill while editing the budget, safe-area padding for notched phones.

**Also:** multiple scenarios with side-by-side comparison, GH₵/US$ display switch, charts, light/dark theme, CSV export, print/PDF view.

## Files
- `calc.js` pure model (PAYE bands are the GRA 2026 monthly bands); `Calc.plan(scenario)` computes a whole scenario
- `charts.js` small SVG line and donut charts
- `app.js`, `style.css`, `index.html` UI
- `node test/calc.test.js` checks the model against the figures in the original planning chat

Data from an earlier single-plan version (`planner-2027-v1`) is migrated automatically into a scenario called "Base".
