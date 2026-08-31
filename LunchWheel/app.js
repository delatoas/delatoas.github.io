/* ==========================================================================
   Lunch Wheel — app logic
   Vanilla JavaScript. No dependencies. No build step.
   ========================================================================== */

(function () {
    'use strict';

    // ----- Constants ------------------------------------------------------
    const STORAGE_KEYS = {
        items:   'lunchwheel.items',
        history: 'lunchwheel.history',
        address: 'lunchwheel.address'
    };

    const DEFAULT_ITEMS = [
        'Italian', 'Mexican', 'Thai', 'Japanese',
        'American', 'Indian', 'Mediterranean', 'Chinese'
    ];

    const MAX_ITEMS       = 24;
    const HISTORY_MAX     = 10;
    const SPIN_DURATION   = 8000;   // ms
    const MIN_ROTATIONS   = 20;
    const MAX_EXTRA_ROT   = 12;
    const ADDRESS_DEBOUNCE = 400;    // ms — save address after this pause
    const SVG_NS          = 'http://www.w3.org/2000/svg';

    // ----- State ----------------------------------------------------------
    /** @type {string[]} */
    let items = loadItems();
    /** @type {string[]} */
    let history = loadHistory();
    /** @type {string} */
    let address = loadAddress();
    /** @type {string|null} */
    let lastWinner = null;

    let currentRotation = 0; // degrees
    let isSpinning = false;
    let audioCtx = null;
    let addressSaveTimer = null;

    // ----- DOM refs -------------------------------------------------------
    const wheelEl         = document.getElementById('wheel');
    const spinBtn         = document.getElementById('spin-btn');
    const resultEl        = document.getElementById('result');
    const resultValueEl   = document.getElementById('result-value');
    const historyListEl   = document.getElementById('history-list');
    const clearHistoryBtn = document.getElementById('clear-history');
    const itemsListEl     = document.getElementById('items-list');
    const countEl         = document.getElementById('count');
    const resetBtn        = document.getElementById('reset-btn');
    const addressInputEl  = document.getElementById('location-input');
    const ctaBtnEl        = document.getElementById('cta-btn');
    const ctaHintEl       = document.getElementById('cta-hint');

    // ----- Persistence ----------------------------------------------------
    function loadItems() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.items);
            if (!raw) return DEFAULT_ITEMS.slice();
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return DEFAULT_ITEMS.slice();
            const cleaned = parsed
                .map(v => typeof v === 'string' ? v.trim() : '')
                .filter(v => v.length > 0)
                .slice(0, MAX_ITEMS);
            return cleaned.length > 0 ? cleaned : DEFAULT_ITEMS.slice();
        } catch (_) {
            return DEFAULT_ITEMS.slice();
        }
    }

    function saveItems() {
        try {
            localStorage.setItem(STORAGE_KEYS.items, JSON.stringify(items));
        } catch (_) { /* quota / private mode — ignore */ }
    }

    function loadHistory() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.history);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.slice(0, HISTORY_MAX) : [];
        } catch (_) {
            return [];
        }
    }

    function saveHistory() {
        try {
            localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
        } catch (_) { /* ignore */ }
    }

    function loadAddress() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.address);
            return typeof raw === 'string' ? raw : '';
        } catch (_) {
            return '';
        }
    }

    function saveAddress() {
        try {
            localStorage.setItem(STORAGE_KEYS.address, address);
        } catch (_) { /* ignore */ }
    }

    // ----- Wheel rendering (SVG) -----------------------------------------
    function renderWheel() {
        // Clear existing contents.
        while (wheelEl.firstChild) wheelEl.removeChild(wheelEl.firstChild);

        const n = items.length;
        if (n === 0) return;

        // Group we rotate.
        const group = document.createElementNS(SVG_NS, 'g');
        group.setAttribute('id', 'wheel-rot');
        wheelEl.appendChild(group);

        const R = 100;
        const sliceAngle = 360 / n;

        // Alternating neutrals with anti-adjacency fallback.
        const shades = ['var(--slice-a)', 'var(--slice-b)'];

        // Determine font size based on slice count. Radial labels care about
        // the perpendicular width of the slice at the label's mid-radius, so
        // font can stay generous even when the wheel gets crowded.
        const fontSize = n <= 10 ? 11
                       : n <= 14 ? 10
                       : n <= 18 ? 9
                       : n <= 22 ? 8
                       :           7;

        // Max characters that fit along the radial length available to the
        // label (roughly 80px of usable radius at the label's mid-radius).
        const maxChars = Math.max(10, Math.floor(80 / (fontSize * 0.55)));

        for (let i = 0; i < n; i++) {
            const startAngle = i * sliceAngle;
            const endAngle   = (i + 1) * sliceAngle;

            let colorIdx = i % 2;
            // If odd count, the last slice would touch slice 0 with the same
            // color — nudge it to break the adjacency.
            if (n % 2 === 1 && i === n - 1) colorIdx = colorIdx === 0 ? 1 : 0;

            // Slice path.
            const p1 = polar(R, startAngle);
            const p2 = polar(R, endAngle);
            const largeArc = sliceAngle > 180 ? 1 : 0;

            const path = document.createElementNS(SVG_NS, 'path');
            path.setAttribute(
                'd',
                `M 0 0 L ${p1.x.toFixed(3)} ${p1.y.toFixed(3)} ` +
                `A ${R} ${R} 0 ${largeArc} 1 ${p2.x.toFixed(3)} ${p2.y.toFixed(3)} Z`
            );
            path.setAttribute('fill', shades[colorIdx]);
            path.setAttribute('class', 'wheel__slice');
            group.appendChild(path);

            // Label — radial (runs along the slice's own radius, from just
            // inside the outer edge inward toward the hub). This keeps text
            // oriented to its slice at all times, so no label ever appears
            // upside down relative to its slice, regardless of wheel rotation.
            const mid = startAngle + sliceAngle / 2;
            const label = document.createElementNS(SVG_NS, 'text');
            label.setAttribute('class', 'wheel__label');
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('dominant-baseline', 'middle');
            label.setAttribute('font-size', String(fontSize));
            // Sit text at ~60% of the radius, then rotate -90° in the label's
            // local frame so its baseline runs along the radial direction.
            label.setAttribute(
                'transform',
                `rotate(${mid}) translate(0, ${-R * 0.6}) rotate(-90)`
            );
            label.textContent = truncate(items[i], maxChars);
            group.appendChild(label);
        }

        // Center hub.
        const hub = document.createElementNS(SVG_NS, 'circle');
        hub.setAttribute('cx', '0');
        hub.setAttribute('cy', '0');
        hub.setAttribute('r', '10');
        hub.setAttribute('class', 'wheel__hub');
        wheelEl.appendChild(hub);

        applyRotation(currentRotation);
    }

    /** Polar helper: angle in degrees, measured clockwise from 12 o'clock. */
    function polar(radius, angleDeg) {
        const a = (angleDeg - 90) * Math.PI / 180; // convert to std math
        return { x: radius * Math.cos(a), y: radius * Math.sin(a) };
    }

    function truncate(text, maxChars) {
        if (text.length <= maxChars) return text;
        if (maxChars <= 1) return text.slice(0, 1);
        return text.slice(0, maxChars - 1) + '\u2026';
    }

    function applyRotation(deg) {
        const group = document.getElementById('wheel-rot');
        if (group) group.setAttribute('transform', `rotate(${deg})`);
    }

    // ----- Spin -----------------------------------------------------------
    function spin() {
        if (isSpinning) return;
        if (items.length < 2) return;

        // Prime the audio context on user gesture.
        ensureAudio();

        isSpinning = true;
        spinBtn.disabled = true;
        resultEl.hidden = true;

        const n = items.length;
        const sliceAngle = 360 / n;
        const winIndex = Math.floor(Math.random() * n);

        // Target absolute rotation: winning slice center at pointer (top).
        // Slice i's center is at wheel-local angle (i * sliceAngle + sliceAngle/2)
        // measured clockwise from top. To land it at the pointer, rotation
        // (mod 360) must equal 360 - that angle. Add extra full rotations
        // for the visual spin.
        const targetMod = mod360(-(winIndex * sliceAngle + sliceAngle / 2));
        const currentMod = mod360(currentRotation);
        let delta = targetMod - currentMod;
        if (delta <= 0) delta += 360;
        const extraRotations = MIN_ROTATIONS + Math.floor(Math.random() * (MAX_EXTRA_ROT + 1));
        const finalRotation = currentRotation + extraRotations * 360 + delta;

        const startRotation = currentRotation;
        const startTime = performance.now();
        let lastSliceUnder = getSliceUnderPointer(startRotation, n);

        function frame(now) {
            const t = Math.min(1, (now - startTime) / SPIN_DURATION);
            const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
            const rotation = startRotation + (finalRotation - startRotation) * eased;
            applyRotation(rotation);

            const under = getSliceUnderPointer(rotation, n);
            if (under !== lastSliceUnder) {
                playTick();
                lastSliceUnder = under;
            }

            if (t < 1) {
                requestAnimationFrame(frame);
            } else {
                currentRotation = finalRotation;
                isSpinning = false;
                spinBtn.disabled = false;
                announceWinner(items[winIndex]);
            }
        }

        requestAnimationFrame(frame);
    }

    function getSliceUnderPointer(rotation, n) {
        const sliceAngle = 360 / n;
        const localAngle = mod360(-rotation);
        return Math.floor(localAngle / sliceAngle) % n;
    }

    function mod360(x) {
        return ((x % 360) + 360) % 360;
    }

    // ----- Result & history ----------------------------------------------
    function announceWinner(name) {
        lastWinner = name;
        resultValueEl.textContent = name;
        resultEl.hidden = false;
        updateCta();

        history.unshift(name);
        if (history.length > HISTORY_MAX) history.length = HISTORY_MAX;
        saveHistory();
        renderHistory();
    }

    function renderHistory() {
        while (historyListEl.firstChild) historyListEl.removeChild(historyListEl.firstChild);
        history.forEach((name, i) => {
            const li = document.createElement('li');
            li.className = 'history__item' + (i === 0 ? ' history__item--latest' : '');
            li.textContent = name;
            historyListEl.appendChild(li);
        });
    }

    // ----- Nearby-places CTA (Google Maps deep-link) ----------------------
    function updateCta() {
        if (!lastWinner) {
            ctaBtnEl.hidden = true;
            ctaHintEl.hidden = true;
            return;
        }

        const trimmed = (address || '').trim();
        if (trimmed.length === 0) {
            ctaBtnEl.hidden = true;
            ctaHintEl.hidden = false;
            return;
        }

        ctaHintEl.hidden = true;
        ctaBtnEl.hidden = false;
        ctaBtnEl.href = buildMapsUrl(lastWinner, trimmed);
        ctaBtnEl.textContent = `Find ${lastWinner} places near you \u2192`;
        ctaBtnEl.setAttribute(
            'aria-label',
            `Find ${lastWinner} places near ${trimmed} on Google Maps`
        );
    }

    function buildMapsUrl(cuisine, addr) {
        const query = `${cuisine} restaurants near ${addr}`;
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    }

    // ----- Audio (subtle tick) -------------------------------------------
    function ensureAudio() {
        if (audioCtx) return;
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) audioCtx = new Ctx();
        } catch (_) { /* audio unavailable — silent fallback */ }
    }

    function playTick() {
        if (!audioCtx) return;
        try {
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(720, now);
            gain.gain.setValueAtTime(0.04, now);
            gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.04);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.05);
        } catch (_) { /* ignore */ }
    }

    // ----- Editor (auto-spawning rows) -----------------------------------
    function renderEditor() {
        while (itemsListEl.firstChild) itemsListEl.removeChild(itemsListEl.firstChild);

        items.forEach((val, idx) => {
            itemsListEl.appendChild(buildRow(val, idx, /*isTrailing*/ false));
        });

        if (items.length < MAX_ITEMS) {
            itemsListEl.appendChild(buildRow('', items.length, /*isTrailing*/ true));
        }

        updateCount();
        updateSpinAvailability();
    }

    function buildRow(value, index, isTrailing) {
        const li = document.createElement('li');
        li.className = 'item';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'item__input';
        input.value = value;
        input.placeholder = isTrailing ? 'Add another cuisine…' : 'Cuisine name';
        input.setAttribute('aria-label',
            isTrailing ? 'Add a new cuisine' : `Cuisine ${index + 1}`);
        input.maxLength = 40;
        input.dataset.index = String(index);
        input.dataset.trailing = isTrailing ? '1' : '0';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'item__remove' + (isTrailing ? ' item__remove--hidden' : '');
        removeBtn.innerHTML = '&times;';
        removeBtn.setAttribute('aria-label',
            isTrailing ? 'Add row' : `Remove ${value || 'item'}`);
        removeBtn.tabIndex = isTrailing ? -1 : 0;

        // ----- Input handlers -----
        input.addEventListener('input', () => onRowInput(input));
        input.addEventListener('blur',  () => onRowBlur(input));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                focusNextRow(input);
            }
        });

        removeBtn.addEventListener('click', () => {
            if (isTrailing) return;
            const i = Number(input.dataset.index);
            items.splice(i, 1);
            saveItems();
            renderEditor();
            renderWheel();
        });

        li.appendChild(input);
        li.appendChild(removeBtn);
        return li;
    }

    function onRowInput(input) {
        const index = Number(input.dataset.index);
        const trailing = input.dataset.trailing === '1';
        const value = input.value;
        const trimmed = value.trim();

        if (trailing) {
            // Promote to a real item as soon as the user types anything meaningful.
            if (trimmed.length === 0) return;

            // Duplicate check against existing items.
            if (isDuplicate(trimmed, -1)) {
                markDuplicate(input, true);
                return;
            }
            markDuplicate(input, false);

            if (items.length >= MAX_ITEMS) return;

            items.push(value);
            saveItems();

            // Rebuild rows so a new trailing row appears, then restore focus and caret.
            const caretPos = input.selectionStart;
            renderEditor();
            renderWheel();

            const rows = itemsListEl.querySelectorAll('.item__input');
            const promoted = rows[index]; // same visual position
            if (promoted) {
                promoted.focus();
                try { promoted.setSelectionRange(caretPos, caretPos); } catch (_) { /* ignore */ }
            }
            return;
        }

        // Non-trailing: live-update, mark duplicate hints but don't rewrite value.
        items[index] = value;
        saveItems();
        renderWheel();

        markDuplicate(input, trimmed.length > 0 && isDuplicate(trimmed, index));
    }

    function onRowBlur(input) {
        const index = Number(input.dataset.index);
        const trailing = input.dataset.trailing === '1';
        if (trailing) {
            markDuplicate(input, false);
            return;
        }

        const trimmed = input.value.trim();

        // Empty after edit → remove row.
        if (trimmed.length === 0) {
            items.splice(index, 1);
            saveItems();
            renderEditor();
            renderWheel();
            return;
        }

        // Duplicate on blur → revert to last non-conflicting or drop the row.
        if (isDuplicate(trimmed, index)) {
            items.splice(index, 1);
            saveItems();
            renderEditor();
            renderWheel();
            return;
        }

        // Commit trimmed value.
        if (items[index] !== trimmed) {
            items[index] = trimmed;
            saveItems();
            renderWheel();
        }
        markDuplicate(input, false);
    }

    function markDuplicate(input, isDupe) {
        const li = input.parentElement;
        if (!li) return;
        input.classList.toggle('item__input--duplicate', isDupe);
        li.classList.toggle('item--duplicate', isDupe);

        let hint = li.querySelector('.item__hint');
        if (isDupe && !hint) {
            hint = document.createElement('span');
            hint.className = 'item__hint';
            hint.textContent = 'Already on the wheel';
            li.appendChild(hint);
        } else if (!isDupe && hint) {
            hint.remove();
        }
    }

    function isDuplicate(candidate, ignoreIndex) {
        const c = candidate.toLowerCase();
        for (let i = 0; i < items.length; i++) {
            if (i === ignoreIndex) continue;
            if (items[i].trim().toLowerCase() === c) return true;
        }
        return false;
    }

    function focusNextRow(currentInput) {
        const rows = Array.from(itemsListEl.querySelectorAll('.item__input'));
        const idx = rows.indexOf(currentInput);
        if (idx < 0) return;
        const next = rows[idx + 1];
        if (next) next.focus();
    }

    function updateCount() {
        const n = items.length;
        countEl.textContent = `${n} / ${MAX_ITEMS} items`;
        countEl.classList.toggle('count--limit', n >= MAX_ITEMS);
    }

    function updateSpinAvailability() {
        spinBtn.disabled = items.length < 2 || isSpinning;
        spinBtn.title = items.length < 2 ? 'Add at least 2 items to spin' : '';
    }

    // ----- Event wiring ---------------------------------------------------
    spinBtn.addEventListener('click', spin);

    clearHistoryBtn.addEventListener('click', () => {
        if (history.length === 0) return;
        if (!confirm('Clear the recent picks history?')) return;
        history = [];
        saveHistory();
        renderHistory();
    });

    resetBtn.addEventListener('click', () => {
        if (!confirm('Reset the wheel to the default cuisines? Your custom items will be removed.')) return;
        items = DEFAULT_ITEMS.slice();
        saveItems();
        renderEditor();
        renderWheel();
    });

    // Address input: debounced save while typing, trim + commit on blur.
    addressInputEl.value = address;
    addressInputEl.addEventListener('input', () => {
        address = addressInputEl.value;
        clearTimeout(addressSaveTimer);
        addressSaveTimer = setTimeout(saveAddress, ADDRESS_DEBOUNCE);
        updateCta();
    });
    addressInputEl.addEventListener('blur', () => {
        clearTimeout(addressSaveTimer);
        const trimmed = addressInputEl.value.trim();
        if (trimmed !== addressInputEl.value) addressInputEl.value = trimmed;
        address = trimmed;
        saveAddress();
        updateCta();
    });

    // ----- Initial render -------------------------------------------------
    renderWheel();
    renderHistory();
    renderEditor();
})();
