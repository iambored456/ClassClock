/** js/layout.js */
import { Settings } from './settings.js';
import { DOM } from './dom.js';
import { Visuals } from './visuals.js'; // Needed to update circle colors

export const Layout = {
    update: function() {
        const prefs = Settings.preferences;
        // Ensure DOM cache is populated
        if (!DOM.clockDisplayArea) {
             console.warn("DOM cache not ready in Layout.update");
             return;
        }

        const elements = [
            { el: DOM.dateEl, pref: 'showDate' },
            { el: DOM.scheduleCirclesDisplayEl, pref: 'showScheduleCircles' },
            { el: DOM.timeEl, pref: 'showTime' }
        ];

        elements.forEach(item => {
            // Toggle visibility class based on preference
            item.el?.classList.toggle('element-hidden', !prefs[item.pref]);
        });

        // Determine visibility of the period info container
        const showPeriodInfo = prefs.showScheduleLabel || prefs.showProgressBar || prefs.showSandBars;
        DOM.periodContainerEl?.classList.toggle('element-hidden', !showPeriodInfo);

        // Manage visibility of elements *within* the period container
        if (showPeriodInfo) {
            // Toggle label based on its preference
            DOM.periodLabelEl?.classList.toggle('element-hidden', !prefs.showScheduleLabel);
        } else {
            // Ensure label is hidden if parent container is hidden
            DOM.periodLabelEl?.classList.add('element-hidden');
        }

        // Handle mutually exclusive Progress Bar vs Sand Bars visibility
        const showProgress = prefs.showProgressBar && !prefs.showSandBars;
        const showSand = prefs.showSandBars;
        DOM.progressBarEl?.classList.toggle('element-hidden', !showProgress);
        DOM.sandBarsContainerEl?.classList.toggle('element-hidden', !showSand);

        // Explicitly manage canvas display style along with container
        if (DOM.sandBarsCanvas) {
             // Canvas should only be display:block (or similar) when sand bars are shown
             DOM.sandBarsCanvas.style.display = showSand ? 'block' : 'none';
        }

        // Apply font sizes after visibility is set
        Layout.applyFontAndSizePreferences();
    },

    applyFontAndSizePreferences: function() {
        const prefs = Settings.preferences;
        const activeScheme = Settings.getActiveColourScheme(); // Needed for circle colors

        // Ensure DOM cache is populated
        if (!DOM.clockDisplayArea) return;

        // Apply font sizes only to elements that are supposed to be visible
        if (prefs.showDate && DOM.dateEl) DOM.dateEl.style.fontSize = prefs.dateFontSize + "px";
        if (prefs.showTime && DOM.timeEl) DOM.timeEl.style.fontSize = prefs.timeFontSize + "px";
        if (prefs.showScheduleLabel && DOM.periodLabelEl) DOM.periodLabelEl.style.fontSize = prefs.scheduleLabelFontSize + "px";
        // Apply only if standard progress bar is active
        if (prefs.showProgressBar && !prefs.showSandBars) {
             if (DOM.timeLeftEl) DOM.timeLeftEl.style.fontSize = prefs.timeLeftFontSize + "px";
             if (DOM.progressBarEl) DOM.progressBarEl.style.height = prefs.progressBarHeight + "px";
        }


        // Apply global font family
        document.body.style.fontFamily = prefs.fontFamily;

        // Update schedule circle colors (implicitly calls render)
        if (prefs.showScheduleCircles && DOM.scheduleCirclesDisplayEl) {
             Visuals.renderScheduleCircles();
        }
    }
};