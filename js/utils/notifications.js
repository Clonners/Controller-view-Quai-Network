/**
 * Notifications & Loading States Module
 * Handles user notifications and loading indicators
 */

import { Config } from '../config.js';

// Notification types
export const NotificationType = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
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
    
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notificationContainer';
    notificationContainer.className = 'notification-container';
    document.body.appendChild(notificationContainer);
    
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
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // Icon based on type
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    
    notification.innerHTML = `
        <span class="notification-icon">${icons[type] || icons.info}</span>
        <span class="notification-message">${escapeHtml(message)}</span>
        <button class="notification-close" aria-label="Close">×</button>
    `;
    
    // Close button handler
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => hideNotification(notification));
    
    // Add to container
    container.appendChild(notification);
    
    // Trigger animation
    requestAnimationFrame(() => {
        notification.classList.add('notification-show');
    });
    
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
    
    notification.classList.remove('notification-show');
    notification.classList.add('notification-hide');
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
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

/**
 * Show loading state on an element
 * @param {string|HTMLElement} target - Element ID or element
 * @param {string} message - Optional loading message
 */
export function showLoading(target, message = 'Loading...') {
    const element = typeof target === 'string' ? document.getElementById(target) : target;
    if (!element) return;
    
    // Store original content
    const id = element.id || Math.random().toString(36).substr(2, 9);
    if (!loadingStates.has(id)) {
        loadingStates.set(id, {
            originalContent: element.innerHTML,
            originalClasses: element.className
        });
    }
    
    // Add loading class
    element.classList.add('is-loading');
    
    // Create loading indicator
    const loader = document.createElement('div');
    loader.className = 'loading-indicator';
    loader.innerHTML = `
        <div class="loading-spinner"></div>
        <span class="loading-text">${escapeHtml(message)}</span>
    `;
    
    // Replace content with loader
    element.innerHTML = '';
    element.appendChild(loader);
}

/**
 * Hide loading state on an element
 * @param {string|HTMLElement} target - Element ID or element
 * @param {string} newContent - Optional new content to display
 */
export function hideLoading(target, newContent = null) {
    const element = typeof target === 'string' ? document.getElementById(target) : target;
    if (!element) return;
    
    const id = element.id || '';
    
    // Remove loading class
    element.classList.remove('is-loading');
    
    // Restore or set new content
    if (newContent !== null) {
        element.innerHTML = newContent;
    } else if (loadingStates.has(id)) {
        const state = loadingStates.get(id);
        element.innerHTML = state.originalContent;
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
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
        <div class="loading-overlay-content">
            <div class="loading-spinner large"></div>
            <span class="loading-text">${escapeHtml(message)}</span>
        </div>
    `;
    
    element.appendChild(overlay);
    
    // Trigger animation
    requestAnimationFrame(() => {
        overlay.classList.add('loading-overlay-show');
    });
}

/**
 * Hide loading overlay
 * @param {string|HTMLElement} target - Element ID or element
 */
export function hideOverlayLoading(target) {
    const element = typeof target === 'string' ? document.getElementById(target) : target;
    if (!element) return;
    
    const overlay = element.querySelector('.loading-overlay');
    if (overlay) {
        overlay.classList.remove('loading-overlay-show');
        setTimeout(() => overlay.remove(), 300);
    }
}

/**
 * Show skeleton loading for tables
 * @param {string} tableBodyId - Table body element ID
 * @param {number} rows - Number of skeleton rows
 * @param {number} cols - Number of columns
 */
export function showTableSkeleton(tableBodyId, rows = 3, cols = 4) {
    const tbody = document.getElementById(tableBodyId);
    if (!tbody) return;
    
    let html = '';
    for (let i = 0; i < rows; i++) {
        html += '<tr class="skeleton-row">';
        for (let j = 0; j < cols; j++) {
            html += '<td><div class="skeleton-text"></div></td>';
        }
        html += '</tr>';
    }
    
    tbody.innerHTML = html;
}

// =====================
// Utility Functions
// =====================

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Initialize notifications and loading CSS
 */
export function initNotifications() {
    // Check if styles already exist
    if (document.getElementById('notification-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'notification-styles';
    styles.textContent = `
        /* Notification Container */
        .notification-container {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 400px;
        }
        
        /* Notification Base */
        .notification {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px 16px;
            border-radius: 12px;
            background: rgba(15, 5, 10, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
            transform: translateX(120%);
            opacity: 0;
            transition: all 0.3s ease;
        }
        
        .notification-show {
            transform: translateX(0);
            opacity: 1;
        }
        
        .notification-hide {
            transform: translateX(120%);
            opacity: 0;
        }
        
        /* Notification Types */
        .notification-success {
            border-color: rgba(74, 222, 128, 0.4);
            background: linear-gradient(135deg, rgba(74, 222, 128, 0.15), rgba(15, 5, 10, 0.95));
        }
        .notification-success .notification-icon {
            color: #4ade80;
            background: rgba(74, 222, 128, 0.2);
        }
        
        .notification-error {
            border-color: rgba(255, 75, 75, 0.4);
            background: linear-gradient(135deg, rgba(255, 75, 75, 0.15), rgba(15, 5, 10, 0.95));
        }
        .notification-error .notification-icon {
            color: #ff4b4b;
            background: rgba(255, 75, 75, 0.2);
        }
        
        .notification-warning {
            border-color: rgba(255, 193, 7, 0.4);
            background: linear-gradient(135deg, rgba(255, 193, 7, 0.15), rgba(15, 5, 10, 0.95));
        }
        .notification-warning .notification-icon {
            color: #ffc107;
            background: rgba(255, 193, 7, 0.2);
        }
        
        .notification-info {
            border-color: rgba(100, 100, 255, 0.4);
            background: linear-gradient(135deg, rgba(100, 100, 255, 0.15), rgba(15, 5, 10, 0.95));
        }
        .notification-info .notification-icon {
            color: #a5b4fc;
            background: rgba(100, 100, 255, 0.2);
        }
        
        /* Notification Elements */
        .notification-icon {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            flex-shrink: 0;
        }
        
        .notification-message {
            flex: 1;
            color: #e5e7eb;
            font-size: 0.9rem;
            line-height: 1.4;
        }
        
        .notification-close {
            background: transparent;
            border: none;
            color: #9ca3af;
            font-size: 20px;
            cursor: pointer;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: all 0.15s;
        }
        
        .notification-close:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
        }
        
        /* Loading Indicator */
        .loading-indicator {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            padding: 20px;
        }
        
        .loading-spinner {
            width: 20px;
            height: 20px;
            border: 2px solid rgba(255, 37, 58, 0.2);
            border-top-color: #ff253a;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        
        .loading-spinner.large {
            width: 32px;
            height: 32px;
            border-width: 3px;
        }
        
        .loading-text {
            color: #9ca3af;
            font-size: 0.85rem;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        /* Loading Overlay */
        .loading-overlay {
            position: absolute;
            inset: 0;
            background: rgba(5, 3, 7, 0.85);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100;
            opacity: 0;
            transition: opacity 0.3s ease;
            border-radius: inherit;
        }
        
        .loading-overlay-show {
            opacity: 1;
        }
        
        .loading-overlay-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
        }
        
        /* Skeleton Loading */
        .skeleton-row td {
            padding: 12px !important;
        }
        
        .skeleton-text {
            height: 16px;
            background: linear-gradient(90deg, 
                rgba(255, 37, 58, 0.1) 25%, 
                rgba(255, 37, 58, 0.2) 50%, 
                rgba(255, 37, 58, 0.1) 75%
            );
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
            border-radius: 4px;
        }
        
        @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
        
        /* Is Loading State */
        .is-loading {
            pointer-events: none;
            position: relative;
        }
        
        /* Button Loading State */
        button.is-loading {
            color: transparent !important;
        }
        
        button.is-loading::after {
            content: '';
            position: absolute;
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top-color: #fff;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            left: 50%;
            top: 50%;
            margin-left: -8px;
            margin-top: -8px;
        }
    `;
    
    document.head.appendChild(styles);
}
