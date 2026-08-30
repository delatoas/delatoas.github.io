# Alberto de la Torre

Personal site and small standalone tools, hosted via GitHub Pages.

## [Mortgage Affordability Calculator](./MortAfford/index.html)

A single-file, client-side calculator that estimates what home price you can
afford, given your income, debts, cash on hand, and loan assumptions.

**Live:** https://delatoas.github.io/MortAfford/

### Features

- **Max affordable price** — solved from gross income, monthly debts, and
  front-end/back-end debt-to-income ratios, with a comfort-level toggle
  (Conservative / Standard / Lender max).
- **Loan types** — Conventional, FHA, and VA, each with its own minimum down
  payment, mortgage-insurance rules, and qualifying ratios; a comparison
  table lays out the differences side by side.
- **Monthly payment breakdown** — principal & interest, property tax, home
  insurance, mortgage insurance, and HOA dues, shown as a stacked bar and
  itemized table.
- **Property tax and home insurance** can each be entered either as a
  %/yr rate of home value or as a flat $/yr dollar amount — useful once you
  know your actual county tax bill or insurance quote rather than relying on
  the national-average defaults.
- **Cash-to-close estimate** — down payment plus closing costs.
- **Check a specific listing** — enter an asking price to see whether it
  fits your selected comfort band, a looser lender-max band, or is out of
  reach.
- Light/dark theme aware, responsive layout, no build step.

### How it works

It's a single `index.html` with inline CSS/JS — no framework, no backend,
no network calls. All inputs are re-solved live as you type. Your entries
are saved to the browser's `localStorage` so they're remembered on your
next visit to that browser/device; nothing is sent anywhere.

Assumptions (current mortgage rates, conforming loan limits, standard
qualifying ratios, etc.) are documented at the bottom of the calculator
itself and are editable — it's a planning tool, not lending advice.

## Disclaimer

Everything on this site, including the Mortgage Affordability Calculator,
is provided "as is," for informational and educational purposes only, with
no warranty of any kind, express or implied — including no guarantee of
accuracy, completeness, or fitness for any particular purpose. It is not
financial, legal, tax, or lending advice, and it is not a substitute for
consulting a qualified professional (a lender, financial advisor, or
attorney) before making any financial decision.

Use of this site and its tools is entirely at your own risk. To the
fullest extent permitted by law, the author accepts no liability for any
loss, damage, or decision arising from the use of, or reliance on, this
site or its output.
