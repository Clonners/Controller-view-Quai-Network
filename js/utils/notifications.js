/**
 * Notifications & Loading States Module
 * Handles user notifications and loading indicators.
 *
 * Text interface: every notice is a line of text in a box (styles live in css/panel.css),
 * nothing slides or spins, and messages are written with textContent.
 */

import { Config } from '../config.js?v=f42ee70fa0';
import { el, layerRoot } from './dom.js?v=f42ee70fa0';

// Notification types
export const NotificationType = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
};

// Glyphs the page font has (the state is also said by the message itself).
const ICONS = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: '●'
};

// Active notifications container
let notificationContainer = null;

// Loading state tracking
const loadingStates = new Map();

/**
 * Initialize notification container
 */
function ensureContainer() {
    if (notificationContainer && document.body.contains(notificationContainer)) {
        return notificationContainer;
    }

    notificationContainer = el('div', {
        className: 'notification-container',
        attrs: { id: 'notificationContainer', role: 'status', 'aria-live': 'polite' }
    });
    layerRoot().appendChild(notificationContainer);

    return notificationContainer;
}

/**
 * Show a notification to the user
 * @param {string} message - Notification message
 * @param {string} type - Notification type (success, error, warning, info)
 * @param {number} duration - Duration in ms (0 = permanent)
 * @returns {HTMLElement} Notification element
 */
export function showNotification(message, type = NotificationType.INFO, duration = Config.ui.notificationDuration) {
    const container = ensureContainer();

    const notification = el('div', {
        className: `notification notification-${type} notification-show`,
        attrs: { role: type === NotificationType.ERROR ? 'alert' : null }
    }, [
        el('span', { className: 'notification-icon', text: ICONS[type] || ICONS.info, attrs: { 'aria-hidden': 'true' } }),
        el('span', { className: 'notification-message', text: message })
    ]);

    const closeBtn = el('button', {
        className: 'btn notification-close',
        text: 'x',
        attrs: { type: 'button', 'aria-label': 'Close' },
        on: { click: () => hideNotification(notification) }
    });
    notification.appendChild(closeBtn);

    // Add to container
    container.appendChild(notification);

    // Auto-hide after duration
    if (duration > 0) {
        setTimeout(() => hideNotification(notification), duration);
    }

    return notification;
}

/**
 * Hide a notification
 * @param {HTMLElement} notification - Notification element
 */
export function hideNotification(notification) {
    if (!notification) return;
    if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
    }
}

/**
 * Show success notification
 * @param {string} message - Message to show
 */
export function showSuccess(message) {
    return showNotification(message, NotificationType.SUCCESS);
}

/**
 * Show error notification
 * @param {string} message - Error message
 * @param {Error} error - Optional error object for logging
 */
export function showError(message, error = null) {
    if (error) {
        console.error(message, error);
    }
    return showNotification(message, NotificationType.ERROR, 8000);
}

/**
 * Show warning notification
 * @param {string} message - Warning message
 */
export function showWarning(message) {
    return showNotification(message, NotificationType.WARNING);
}

/**
 * Show info notification
 * @param {string} message - Info message
 */
export function showInfo(message) {
    return showNotification(message, NotificationType.INFO);
}

// =====================
// Loading States
// =====================

/** "█ message": the block blinks only where motion is allowed (see css). */
function loadingLine(message, className) {
    return el('div', { className }, [
        el('span', { className: 'loading-cursor', text: '█ ', attrs: { 'aria-hidden': 'true' } }),
        el('span', { className: 'loading-text', text: message })
    ]);
}

/**
 * Show loading state on an element
 * @param {string|HTMLElement} target - Element ID or element
 * @param {string} message - Optional loading message
 */
export function showLoading(target, message = 'Loading...') {
    const element = typeof target === 'string' ? document.getElementById(target) : target;
    if (!element) return;

    // Keep the original nodes (not their HTML) so they come back untouched
    const id = element.id || Math.random().toString(36).substr(2, 9);
    if (!loadingStates.has(id)) {
        loadingStates.set(id, {
            originalNodes: Array.from(element.childNodes),
            originalClasses: element.className
        });
    }

    // Add loading class
    element.classList.add('is-loading');

    // Replace content with loader
    element.replaceChildren(loadingLine(message, 'loading-indicator'));
}

/**
 * Hide loading state on an element
 * @param {string|HTMLElement} target - Element ID or element
 * @param {string} newContent - Optional new text to display
 */
export function hideLoading(target, newContent = null) {
    const element = typeof target === 'string' ? document.getElementById(target) : target;
    if (!element) return;

    const id = element.id || '';

    // Remove loading class
    element.classList.remove('is-loading');

    // Restore or set new content
    if (newContent !== null) {
        element.textContent = newContent;
        loadingStates.delete(id);
    } else if (loadingStates.has(id)) {
        const state = loadingStates.get(id);
        element.replaceChildren(...state.originalNodes);
        loadingStates.delete(id);
    }
}

/**
 * Show loading overlay on a section
 * @param {string|HTMLElement} target - Element ID or element
 * @param {string} message - Loading message
 */
export function showOverlayLoading(target, message = 'Loading...') {
    const element = typeof target === 'string' ? document.getElementById(target) : target;
    if (!element) return;

    // Ensure relative positioning
    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.position === 'static') {
        element.style.position = 'relative';
    }

    // Remove existing overlay
    const existing = element.querySelector('.loading-overlay');
    if (existing) existing.remove();

    // Create overlay
    const overlay = el('div', { className: 'loading-overlay loading-overlay-show' }, [
        loadingLine(message, 'loading-overlay-content')
    ]);

    element.appendChild(overlay);
}

/**
 * Hide loading overlay
 * @param {string|HTMLElement} target - Element ID or element
 */
export function hideOverlayLoading(target) {
    const element = typeof target === 'string' ? document.getElementById(target) : target;
    if (!element) return;

    const overlay = element.querySelector('.loading-overlay');
    if (overlay) overlay.remove();
}

/**
 * Show placeholder rows in a table while its data is on the way
 * @param {string} tableBodyId - Table body element ID
 * @param {number} rows - Number of skeleton rows
 * @param {number} cols - Number of columns
 */
export function showTableSkeleton(tableBodyId, rows = 3, cols = 4) {
    const tbody = document.getElementById(tableBodyId);
    if (!tbody) return;

    const list = [];
    for (let i = 0; i < rows; i++) {
        const cells = [];
        for (let j = 0; j < cols; j++) {
            cells.push(el('td', { attrs: { role: 'cell' } }, [
                el('span', { className: 'skeleton-text', text: '░░░░░░░░', attrs: { 'aria-hidden': 'true' } })
            ]));
        }
        list.push(el('tr', { className: 'skeleton-row', attrs: { role: 'row' } }, cells));
    }
    // One row says it in words for screen readers.
    if (list.length > 0) {
        list[0].firstChild.appendChild(el('span', { className: 'sr', text: 'Loading...' }));
    }

    tbody.replaceChildren(...list);
}

/**
 * Initialize notifications.
 * The styles used to be injected from here; they are part of css/panel.css now.
 */
export function initNotifications() {
    // Nothing to inject. Kept so callers do not change.
}
