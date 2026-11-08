# budget-web-app

2027 personal finance planner: US$ salary -> Ghana PAYE/SSNIT take-home -> monthly budget -> investment projections -> low-risk car fund (USD + GHS) -> car loan affordability -> financial-independence roadmap.

Open `index.html` in a browser. No build step or dependencies. Inputs are saved in localStorage.

- `calc.js` pure calculations (PAYE bands are the GRA 2026 monthly bands)
- `app.js` / `style.css` UI
- `node test/calc.test.js` checks the calculations against the figures in the original planning chat
