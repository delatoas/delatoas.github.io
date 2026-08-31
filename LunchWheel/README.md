# Lunch Wheel

A tiny standalone side project. Spin a wheel to pick what's for lunch.

Not part of the main repo's tooling or documentation — kept in its own folder on purpose.

## How to run

Double-click `index.html`, or right-click and open in your browser of choice. That's it. No install, no build, no dependencies.

If you want to use it on your phone later, you can drop these three files onto GitHub Pages, Netlify, or any static host and it will just work.

## Files

| File | Purpose |
|---|---|
| `index.html` | Markup and structure |
| `styles.css` | Neutral warm palette, sage accent, responsive layout |
| `app.js` | Wheel rendering, spin physics, editor, history, persistence |

## Features

- 8 default cuisines: Italian, Mexican, Thai, Japanese, American, Indian, Mediterranean, Chinese.
- Auto-spawning input rows — type in the empty row and a new one appears below.
- Press `Enter` in a row to jump to the next one.
- Duplicate-aware (case-insensitive), with an inline hint.
- Soft cap at 24 items.
- Delete any item with the `×` button.
- "Reset to defaults" restores the original 8 cuisines.
- Subtle tick sound while the wheel spins (Web Audio, no audio files).
- History of the last 10 picks, clearable.
- **"Your location" panel** — save an address once; after each spin, a button appears that opens Google Maps pre-filled with `[cuisine] restaurants near [your address]`. Google Maps handles the actual geocoding, distance, hours, and directions.
- All state persists in `localStorage`.

## Keys used in `localStorage`

- `lunchwheel.items`
- `lunchwheel.history`
- `lunchwheel.address`

Clear them from DevTools if you want a fresh start.

## Browser support

Any modern browser (Chrome, Edge, Firefox, Safari). Uses standard SVG, CSS Grid/Flexbox, and Web Audio.
