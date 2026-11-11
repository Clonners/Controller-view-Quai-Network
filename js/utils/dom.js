/**
 * DOM helpers for the text (ASCII) interface.
 * Everything that comes from the node is written with textContent, never as HTML.
 */

/**
 * Create an element.
 * @param {string} tag
 * @param {Object} props - className, text, title, attrs {name: value}, on {event: handler}
 * @param {Array<Node|string>} children
 * @returns {HTMLElement}
 */
export function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    if (props.className) node.className = props.className;
    if (props.text !== undefined && props.text !== null) node.textContent = String(props.text);
    if (props.title) node.title = props.title;
    if (props.attrs) {
        Object.keys(props.attrs).forEach((name) => {
            const value = props.attrs[name];
            if (value !== undefined && value !== null && value !== false) node.setAttribute(name, String(value));
        });
    }
    if (props.on) {
        Object.keys(props.on).forEach((name) => node.addEventListener(name, props.on[name]));
    }
    children.forEach((child) => {
        if (child === null || child === undefined) return;
        node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
}

/**
 * A table cell. On a phone each row becomes a record "label  value",
 * so every cell carries the name of its column.
 */
export function cell(label, content, className = '') {
    const td = el('td', { className, attrs: { role: 'cell', 'data-label': label } });
    const value = el('span', { className: 'v' });
    if (content instanceof Node) value.appendChild(content);
    else value.textContent = (content === null || content === undefined) ? '-' : String(content);
    td.appendChild(value);
    return td;
}

/** A table row with the right role (rows are laid out as blocks on a phone). */
export function row(cells, className = '') {
    return el('tr', { className, attrs: { role: 'row' } }, cells);
}

/**
 * Replace the content of a table body with one message row.
 * @param {HTMLElement} tbody
 * @param {number} cols - number of columns of the table
 * @param {string} text
 * @param {string} kind - '' | 'bad'
 */
export function messageRow(tbody, cols, text, kind = '') {
    if (!tbody) return;
    const td = el('td', {
        className: 'empty' + (kind ? ' ' + kind : ''),
        text,
        attrs: { role: 'cell', colspan: cols }
    });
    tbody.replaceChildren(row([td], 'message-row'));
}

/** A text button drawn as [ label ]. */
export function button(label, onClick, props = {}) {
    return el('button', {
        className: 'btn' + (props.className ? ' ' + props.className : ''),
        text: label,
        title: props.title,
        attrs: Object.assign({ type: 'button' }, props.attrs || {}),
        on: onClick ? { click: onClick } : undefined
    });
}

/** True when the page is on its 40-column (phone) grid. */
export function isNarrow() {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 59.99em)').matches;
}

/** 0x1234ab...cdef12 */
export function shortAddress(address, head = 8, tail = 6) {
    if (!address || address.length <= head + tail + 2) return address || '-';
    return address.substring(0, head) + '...' + address.substring(address.length - tail);
}

/** Where floating pieces (dialogs, notices) are attached so they inherit the grid. */
export function layerRoot() {
    return document.querySelector('.page') || document.body;
}

/**
 * Copy text and say so on the button that was pressed.
 * @returns {Promise<boolean>}
 */
export async function copyWithFeedback(text, buttonEl) {
    let ok = false;
    try {
        await navigator.clipboard.writeText(text);
        ok = true;
    } catch (e) {
        ok = false;
    }
    if (buttonEl) {
        const original = buttonEl.dataset.label || buttonEl.textContent;
        buttonEl.dataset.label = original;
        buttonEl.textContent = ok ? 'copied' : 'copy failed';
        setTimeout(() => { buttonEl.textContent = original; }, 1500);
    }
    return ok;
}

// ---------------------
// Dialogs (boxes that float over the page)
// ---------------------

const openers = new WeakMap();

/**
 * Show a dialog and remember what had the focus, so closing gives it back.
 * @param {HTMLElement} dialog
 * @param {HTMLElement|null} focusTarget - element to focus inside (default: its close button)
 */
export function showDialog(dialog, focusTarget = null) {
    if (!dialog) return;
    if (dialog.style.display !== 'flex') {
        const active = document.activeElement;
        if (active && active !== document.body) openers.set(dialog, active);
    }
    dialog.style.display = 'flex';
    const target = focusTarget || dialog.querySelector('.dialog-close');
    if (target && typeof target.focus === 'function') {
        try { target.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
}

/** Hide a dialog and return the focus to the element that opened it. */
export function hideDialog(dialog) {
    if (!dialog) return;
    const wasOpen = dialog.style.display === 'flex';
    dialog.style.display = 'none';
    if (!wasOpen) return;
    const opener = openers.get(dialog);
    openers.delete(dialog);
    if (opener && document.contains(opener) && typeof opener.focus === 'function') {
        try { opener.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
}

// While a box floats over the page, Tab stays inside it.
function topLayer() {
    const views = document.querySelectorAll('.data-view-modal');
    if (views.length > 0) return views[views.length - 1];
    const open = Array.from(document.querySelectorAll('.dialog')).filter((d) => d.style.display === 'flex');
    return open.length > 0 ? open[open.length - 1] : null;
}

function focusables(root) {
    const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
        'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(root.querySelectorAll(selector)).filter((node) => node.getClientRects().length > 0);
}

if (typeof document !== 'undefined') {
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const layer = topLayer();
        if (!layer) return;
        const items = focusables(layer);
        if (items.length === 0) { e.preventDefault(); return; }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (!layer.contains(active)) {
            e.preventDefault();
            first.focus();
        } else if (e.shiftKey && active === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
        }
    });
}

/** A one-line note inside a list (empty state, error, loading). */
export function note(text, kind = '') {
    return el('div', { className: 'note' + (kind ? ' ' + kind : ''), text });
}
