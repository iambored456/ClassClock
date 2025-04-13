/** js/appearance.js */
import { DOM } from './dom.js';
import { Settings } from './settings.js';
import { Layout } from './layout.js';
import { Visuals } from './visuals.js';
import { ColorSchemes } from './colorSchemes.js';
import { Utils } from './utils.js';
import { Clock } from './clock.js';
import { getCurrentOffsetTime } from './utils.js';

export const Appearance = {
    attachListeners: function() {
        // Font Select
        DOM.fontSelect?.addEventListener("input", function() {
            if (!Settings.preferences) return;
            Settings.preferences.fontFamily = this.value;
            Layout.applyFontAndSizePreferences();
            Settings.save();
        });

        // Number Inputs (Generic Setup using data-pref)
        document.querySelectorAll('.number-input-wrapper').forEach(wrapper => {
            const input = wrapper.querySelector('input[type="number"]');
            const minusBtn = wrapper.querySelector('.num-btn.minus');
            const plusBtn = wrapper.querySelector('.num-btn.plus');
            // Check for input and crucially data-pref
            if (!input || !input.dataset || !input.dataset.pref || !minusBtn || !plusBtn) {
                // console.warn("Skipping number input wrapper: Missing input or data-pref.", wrapper);
                return;
            }

            const prefKey = input.dataset.pref; // Get pref key from data attribute
            let intervalId = null, timeoutId = null;
            const HOLD_DELAY = 500, HOLD_INTERVAL = 100;

            if (!Settings.preferences || !Settings.defaultPreferences || !Settings.preferences.hasOwnProperty(prefKey)) {
                console.warn(`Preference key "${prefKey}" not found in settings for input ${input.id}`);
                return;
            }

            const updatePreference = (newValue) => {
                if (!Settings.preferences.hasOwnProperty(prefKey)) return;

                const step = parseInt(input.step) || 1;
                const min = input.min ? parseInt(input.min, 10) : -Infinity;
                const max = input.max ? parseInt(input.max, 10) : Infinity;
                let parsedValue = parseInt(newValue, 10);
                parsedValue = isNaN(parsedValue) ? Settings.defaultPreferences[prefKey] : Math.max(min, Math.min(max, parsedValue));

                if (Settings.preferences[prefKey] !== parsedValue) {
                    Settings.preferences[prefKey] = parsedValue;
                    input.value = parsedValue;
                    Layout.applyFontAndSizePreferences();

                    // If a sandbar setting changed, re-initialize visuals/physics
                    if (['sandWidth', 'sandHeight', 'sandParticleSize'].includes(prefKey)) {
                        console.log(`Sandbar pref changed (${prefKey}), triggering physics setup...`);
                        const currentPeriod = Clock.getCurrentPeriodInfo(getCurrentOffsetTime());
                        requestAnimationFrame(() => { Visuals.setupPhysicsSandBars(currentPeriod); });
                    }

                    Settings.save();
                }
            };
            const startRepeating = (step) => { updatePreference(parseInt(input.value, 10) + step); stopRepeating(); timeoutId = setTimeout(() => { intervalId = setInterval(() => { updatePreference(parseInt(input.value, 10) + step); }, HOLD_INTERVAL); }, HOLD_DELAY); };
            const stopRepeating = () => { clearTimeout(timeoutId); clearInterval(intervalId); timeoutId = intervalId = null; };
            input.addEventListener("change", () => updatePreference(input.value));
            minusBtn.addEventListener("mousedown", () => startRepeating(-(parseInt(input.step) || 1)));
            plusBtn.addEventListener("mousedown", () => startRepeating(parseInt(input.step) || 1));
            const stopEvents = ["mouseup", "mouseleave", "blur", "touchend", "touchcancel"];
            stopEvents.forEach(event => { minusBtn.addEventListener(event, stopRepeating); plusBtn.addEventListener(event, stopRepeating); });
        });

        // Display Toggles
        DOM.displayElementsChecklist?.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', Appearance.handleDisplayToggleChange);
        });

        // Reset Buttons
        DOM.resetAppearanceBtn?.addEventListener('click', Appearance.resetFontAndSizeDefaults);
        DOM.resetSchemesBtn?.addEventListener('click', ColorSchemes.resetDefaults);
        document.getElementById('reset-sandbar-defaults')?.addEventListener('click', Appearance.resetSandBarDefaults);
    },

    handleDisplayToggleChange: function() {
        const prefName = this.dataset.pref;
        if (!prefName || !Settings.preferences || !Settings.preferences.hasOwnProperty(prefName)) return;

        Settings.preferences[prefName] = this.checked;

        // Mutual exclusivity
        if (prefName === 'showSandBars' && this.checked && Settings.preferences.showProgressBar) {
            Settings.preferences.showProgressBar = false;
            const progressBarCheckbox = DOM.displayElementsChecklist?.querySelector('#pref-show-progress-bar');
            if (progressBarCheckbox) progressBarCheckbox.checked = false;
        } else if (prefName === 'showProgressBar' && this.checked && Settings.preferences.showSandBars) {
            Settings.preferences.showSandBars = false;
            const sandBarsCheckbox = DOM.displayElementsChecklist?.querySelector('#pref-show-sand-bars');
            if (sandBarsCheckbox) sandBarsCheckbox.checked = false;
        }

        // Show/Hide Sand Bar Options section
        const sandBarOptionsSection = document.getElementById('sand-bar-options');
        sandBarOptionsSection?.classList.toggle('element-hidden', !Settings.preferences.showSandBars);

        Layout.update();
        Visuals.handleDisplayToggle();
        Settings.save();
    },

    updateInputs: function() {
         if (!Settings.preferences) return;

        // Update Font & Size Inputs
        if (DOM.fontSelect) DOM.fontSelect.value = Settings.preferences.fontFamily;
        if (DOM.dateFontSizeInput) DOM.dateFontSizeInput.value = Settings.preferences.dateFontSize;
        if (DOM.timeFontSizeInput) DOM.timeFontSizeInput.value = Settings.preferences.timeFontSize;
        if (DOM.labelFontSizeInput) DOM.labelFontSizeInput.value = Settings.preferences.scheduleLabelFontSize;
        if (DOM.timeLeftFontSizeInput) DOM.timeLeftFontSizeInput.value = Settings.preferences.timeLeftFontSize;
        if (DOM.progressHeightInput) DOM.progressHeightInput.value = Settings.preferences.progressBarHeight;

        // Update Display Element Checkboxes
        DOM.displayElementsChecklist?.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            const prefName = checkbox.dataset.pref;
            if (prefName && Settings.preferences.hasOwnProperty(prefName)) {
                 checkbox.checked = Settings.preferences[prefName];
            }
        });

        // Update Sand Bar Specific Inputs
        const sandBarOptionsSection = document.getElementById('sand-bar-options');
        if (sandBarOptionsSection) {
            sandBarOptionsSection.classList.toggle('element-hidden', !Settings.preferences.showSandBars);
            const widthInput = sandBarOptionsSection.querySelector('#pref-sand-width');
            const heightInput = sandBarOptionsSection.querySelector('#pref-sand-height');
            const sizeInput = sandBarOptionsSection.querySelector('#pref-sand-particle-size');

            if(widthInput) widthInput.value = Settings.preferences.sandWidth;
            if(heightInput) heightInput.value = Settings.preferences.sandHeight;
            if(sizeInput) sizeInput.value = Settings.preferences.sandParticleSize;
        }
    },

    resetFontAndSizeDefaults: function() {
        if (confirm("Reset Font & Size settings to defaults?")) {
            if (!Settings.preferences || !Settings.defaultPreferences) return;
            Settings.preferences.fontFamily = Settings.defaultPreferences.fontFamily;
            Settings.preferences.dateFontSize = Settings.defaultPreferences.dateFontSize;
            Settings.preferences.timeFontSize = Settings.defaultPreferences.timeFontSize;
            Settings.preferences.scheduleLabelFontSize = Settings.defaultPreferences.scheduleLabelFontSize;
            Settings.preferences.timeLeftFontSize = Settings.defaultPreferences.timeLeftFontSize;
            Settings.preferences.progressBarHeight = Settings.defaultPreferences.progressBarHeight;
            Appearance.updateInputs();
            Layout.applyFontAndSizePreferences();
            Settings.save();
            Utils.showButtonFeedback(DOM.resetAppearanceBtn, "Reset!");
        }
    },

    resetSandBarDefaults: function() {
         if (confirm("Reset Sand Bar settings to defaults?")) {
             if (!Settings.preferences || !Settings.defaultPreferences) return;
             // Reset relevant prefs
             Settings.preferences.sandWidth = Settings.defaultPreferences.sandWidth;
             Settings.preferences.sandHeight = Settings.defaultPreferences.sandHeight;
             Settings.preferences.sandParticleSize = Settings.defaultPreferences.sandParticleSize;

             Appearance.updateInputs();

             if (Settings.preferences.showSandBars) {
                  const currentPeriod = Clock.getCurrentPeriodInfo(getCurrentOffsetTime());
                  requestAnimationFrame(() => { Visuals.setupPhysicsSandBars(currentPeriod); });
             }
             Settings.save();
             Utils.showButtonFeedback(document.getElementById('reset-sandbar-defaults'), "Reset!");
         }
    }
};