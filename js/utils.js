/** js/utils.js */
// No imports needed for basic utilities

// Settings needs to be globally accessible or passed around.
// For simplicity with modules, functions needing Settings might need adjustment
// Or assume Settings is populated before heavy use.
// Let's import it where needed instead of relying on global.

export const Utils = {
    getTodayTime: function(timeStr) {
        if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) {
            const now = new Date();
            now.setSeconds(0, 0);
            return now;
        }
        const [hours, minutes] = timeStr.split(":").map(Number);
        const now = new Date();
        now.setHours(hours, minutes, 0, 0);
        return now;
    },

    // getCurrentOffsetTime needs Settings. Let's import Settings where it's used.
    // We'll modify functions that use it to accept Settings or import it directly.
    // For now, keep the structure, but be aware of dependency.
    // Example: Modify calling function like Clock.update to pass Settings.preferences.timeOffsetMs

    formatTime: function(date) {
        let hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12; // Convert hour 0 to 12
        return `${hours}:${minutes < 10 ? "0" + minutes : minutes} ${ampm}`;
    },

    formatDate: function(date) {
        const options = { weekday: 'long', month: 'long', day: 'numeric' };
        return date.toLocaleDateString(undefined, options);
    },

    showFeedback: function(element, message, isSuccess = true) {
        if (!element) return;
        element.textContent = message;
        element.classList.remove('success', 'error');
        element.classList.add(isSuccess ? 'success' : 'error');
        element.style.display = 'block';
        setTimeout(() => {
            if (element) element.style.display = 'none';
        }, 3000);
    },

    showButtonFeedback: function(button, message = "Saved!", duration = 1500) {
        if (!button) return;
        const originalText = button.textContent;
        button.textContent = message;
        button.classList.add('button-success');
        button.disabled = true;
        setTimeout(() => {
             // Check if button still exists before modifying
             if (button) {
                  button.textContent = originalText;
                  button.classList.remove('button-success');
                  button.disabled = false;
             }
        }, duration);
    },

    lightenColor: function(hex, percent) {
        if (!hex) return '#cccccc'; // Basic fallback
        hex = hex.replace(/^#/, '');
         if (hex.length !== 6) return '#cccccc'; // Basic validation

        try {
            let r = parseInt(hex.substring(0, 2), 16);
            let g = parseInt(hex.substring(2, 4), 16);
            let b = parseInt(hex.substring(4, 6), 16);

            r = Math.min(255, Math.floor(r * (1 + percent / 100)));
            g = Math.min(255, Math.floor(g * (1 + percent / 100)));
            b = Math.min(255, Math.floor(b * (1 + percent / 100)));

            // Ensure 2 digits for hex representation
            const rHex = r.toString(16).padStart(2, '0');
            const gHex = g.toString(16).padStart(2, '0');
            const bHex = b.toString(16).padStart(2, '0');

            return `#${rHex}${gHex}${bHex}`;
        } catch (e) {
             console.error("Error lightening color:", hex, e);
             return '#cccccc';
        }
    }
};

// Helper specifically for getting current time with offset, importing Settings here
import { Settings } from './settings.js'; // Assuming settings.js exports Settings

export function getCurrentOffsetTime() {
    const offset = (Settings.preferences && Settings.preferences.timeOffsetMs) ? Number(Settings.preferences.timeOffsetMs) : 0;
    const systemNow = new Date();
    return new Date(systemNow.getTime() + offset);
}

// Add the function to the Utils object if preferred, but standalone export is fine too
// Utils.getCurrentOffsetTime = getCurrentOffsetTime;