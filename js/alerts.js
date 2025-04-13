/** js/alerts.js */
import { DOM } from './dom.js';
import { Settings } from './settings.js';
import { State } from './state.js';
import { Visuals } from './visuals.js'; // Needed by restoreOriginalStyles
import { Utils } from './utils.js';
import { Schedule } from './schedule.js'; // Needed for table render on save/remove

export const Alerts = {
    attachListeners: function() {
        DOM.alertModal?.addEventListener('click', (event) => {
            // Ensure close button exists before checking target
            if (event.target === DOM.alertModal || (DOM.closeModalBtn && event.target === DOM.closeModalBtn)) {
                 Alerts.closeModal();
            }
        });
        // Edit buttons listeners are added dynamically in Schedule.renderTable
    },

    openModal: function(index) {
        if (index === null || index < 0 || !Settings.schedule || index >= Settings.schedule.length) return;
        const periodLabel = Settings.schedule[index]?.label || `Row ${index + 1}`; // Safer access
        if (DOM.alertModalTitle) DOM.alertModalTitle.textContent = `Visual Alert Settings for "${periodLabel}"`;
        Alerts.renderModalForm(index);
        if (DOM.alertModal) DOM.alertModal.style.display = "block";
    },

    closeModal: function() {
        if (DOM.alertModal) DOM.alertModal.style.display = "none";
        if (DOM.alertModalBody) DOM.alertModalBody.innerHTML = ""; // Clear content
    },

    renderModalForm: function(index) {
        if (!DOM.alertModalBody || !Settings.schedule || index >= Settings.schedule.length) return;

        // Merge defaults and specific settings safely
        const defaultColourSettings = Settings.defaultPreferences?.defaultAlertSettings?.colour || {};
        const periodColourSettings = Settings.alerts[index]?.colour || {};
        const settings = { ...defaultColourSettings, ...periodColourSettings };

        // Calculate derived values safely
        const durationMs = settings.durationMs || defaultColourSettings.durationMs || 1500;
        const intervalMs = settings.intervalMs || defaultColourSettings.intervalMs || 500;
        const durationInSeconds = (durationMs / 1000);
        const hasCustomSettings = !!Settings.alerts[index]?.colour; // Check if specific settings exist

        DOM.alertModalBody.innerHTML = `
            <div class="alert-settings-form" data-index="${index}">
            <label><input type="checkbox" id="alert-colour-enabled" ${settings.enabled ? "checked" : ""}> Enable Visual Alert</label><hr>
            <label>Flash Background Colour: <input type="color" id="alert-bg-color" value="${settings.background}"></label>
            <label>Flash Text Colour: <input type="color" id="alert-label-color" value="${settings.text}"></label>
            <label>Flash Duration (s): <input type="number" id="alert-flash-duration-sec" min="0.5" max="10" step="0.1" value="${durationInSeconds.toFixed(1)}"></label>
            <label>Flash Interval (ms): <input type="number" id="alert-flash-interval" min="100" max="2000" step="50" value="${intervalMs}"></label>
            <div class="button-group">
                <button id="save-alert" data-option="colour">Save Visual Alert</button>
                <button id="preview-alert" data-option="colour">Preview Flash</button>
                <button id="remove-alert" data-option="colour" ${!hasCustomSettings ? 'disabled' : ''}>${settings.enabled ? 'Disable Alert' : (hasCustomSettings ? 'Remove Custom Settings' : 'Using Defaults')}</button>
            </div>
            <div class="feedback-message" style="display: none;"></div></div>`;

        // Add specific listeners for this form instance
        const form = DOM.alertModalBody.querySelector('.alert-settings-form');
        form?.querySelector('#alert-colour-enabled')?.addEventListener('change', Alerts.handleModalEnableToggle);
        form?.querySelector('#save-alert')?.addEventListener('click', Alerts.handleModalSave);
        form?.querySelector('#preview-alert')?.addEventListener('click', Alerts.handleModalPreview);
        form?.querySelector('#remove-alert')?.addEventListener('click', Alerts.handleModalRemove);

        // Initial state update for controls
        Alerts.updateModalControlsState(form, settings.enabled, hasCustomSettings);
    },

    handleModalEnableToggle: function(e) { // 'this' is the checkbox
         const form = e.target.closest('.alert-settings-form');
         const isEnabled = e.target.checked;
         const index = parseInt(form.dataset.index, 10);
         Alerts.updateModalControlsState(form, isEnabled, !!Settings.alerts[index]?.colour);
    },

    updateModalControlsState: function(form, isEnabled, hasCustomSettings) {
         if (!form) return;
         // Select only relevant inputs within this specific form
         const inputs = form.querySelectorAll('input[type="color"], input[type="number"]');
         const previewButton = form.querySelector('#preview-alert');
         const removeButton = form.querySelector('#remove-alert');

         inputs.forEach(input => input.disabled = !isEnabled);
         if (previewButton) previewButton.disabled = !isEnabled;
         if (removeButton) {
              removeButton.disabled = !hasCustomSettings; // Can only remove if custom settings exist
              removeButton.textContent = isEnabled ? 'Disable Alert' : (hasCustomSettings ? 'Remove Custom Settings' : 'Using Defaults');
         }
    },

    handleModalSave: function() { // 'this' is the Save button
         const form = this.closest('.alert-settings-form');
         if (!form) return;
         const index = parseInt(form.dataset.index, 10);
         if (isNaN(index)) return;

          const enableCheckbox = form.querySelector('#alert-colour-enabled');
          const durationSecInput = form.querySelector("#alert-flash-duration-sec");
          const intervalInput = form.querySelector("#alert-flash-interval");
          const bgInput = form.querySelector("#alert-bg-color");
          const textInput = form.querySelector("#alert-label-color");
          const feedbackEl = form.querySelector('.feedback-message'); // Cache feedback element

          if (!enableCheckbox || !durationSecInput || !intervalInput || !bgInput || !textInput) {
              console.error("Modal form elements not found for saving.");
              return;
          }

         // Ensure the structure exists for this index
         if (!Settings.alerts[index]) Settings.alerts[index] = {};
         // No need for: if (!Settings.alerts[index].colour) Settings.alerts[index].colour = {};
         // because we create the full object below.

         const defaultColourSettings = Settings.defaultPreferences?.defaultAlertSettings?.colour || {};
         const defaultDurationMs = defaultColourSettings.durationMs || 1500;
         const defaultIntervalMs = defaultColourSettings.intervalMs || 500;

         let durationSec = parseFloat(durationSecInput.value);
         durationSec = isNaN(durationSec) ? (defaultDurationMs / 1000) : Math.max(0.5, Math.min(10, durationSec));
         let intervalMs = parseInt(intervalInput.value, 10);
         intervalMs = isNaN(intervalMs) ? defaultIntervalMs : Math.max(100, Math.min(2000, intervalMs));

         let savedData = {
             enabled: enableCheckbox.checked,
             background: bgInput.value || defaultColourSettings.background || "#ff0000",
             text: textInput.value || defaultColourSettings.text || "#ffffff",
             durationMs: Math.round(durationSec * 1000),
             intervalMs: intervalMs
         };
          Settings.alerts[index].colour = savedData; // Assign the whole object

          Settings.save();
          Schedule.renderTable(); // Update table icon
          Utils.showButtonFeedback(this, "Saved!"); // 'this' is the button
          setTimeout(Alerts.closeModal, 1600);
    },

    handleModalPreview: function() { // 'this' is the Preview button
         const form = this.closest('.alert-settings-form');
         if (!form) return;
         const enableCheckbox = form.querySelector('#alert-colour-enabled');
         const feedbackEl = form.querySelector('.feedback-message');

         if (!enableCheckbox || !enableCheckbox.checked) {
             Utils.showFeedback(feedbackEl, `Enable the alert first to preview.`, false);
             return;
         }
         const durationSec = parseFloat(form.querySelector("#alert-flash-duration-sec")?.value);
         const intervalVal = parseInt(form.querySelector("#alert-flash-interval")?.value, 10);

         if (isNaN(durationSec) || isNaN(intervalVal)) {
              Utils.showFeedback(feedbackEl, `Invalid duration or interval value.`, false);
              return;
         }

         let previewSettings = {
              enabled: true, // Force enabled for preview
              background: form.querySelector("#alert-bg-color")?.value || '#ff0000',
              text: form.querySelector("#alert-label-color")?.value || '#ffffff',
              durationMs: Math.round(durationSec * 1000),
              intervalMs: intervalVal
          };
         Alerts.triggerVisualAlert(previewSettings);
         Utils.showFeedback(feedbackEl, `Previewing flash...`, true);
    },

    handleModalRemove: function() { // 'this' is the Remove/Disable button
         const form = this.closest('.alert-settings-form');
         if (!form) return;
         const index = parseInt(form.dataset.index, 10);
         const enableCheckbox = form.querySelector('#alert-colour-enabled');
         const feedbackEl = form.querySelector('.feedback-message');

         if (isNaN(index) || index >= Settings.schedule.length) return; // Check index validity

         if (Settings.alerts[index]?.colour) { // Check if custom settings exist
             if (enableCheckbox.checked) {
                 // If currently enabled, just disable it visually in modal
                 enableCheckbox.checked = false;
                 Alerts.updateModalControlsState(form, false, true); // Still has custom settings
                 Utils.showFeedback(feedbackEl, `Alert disabled. Click Save to confirm.`, true);
             } else {
                 // If currently disabled, but settings exist, remove them entirely
                  if (confirm(`Remove custom visual alert settings for "${Settings.schedule[index].label}"? It will revert to defaults.`)) {
                       delete Settings.alerts[index].colour;
                       // If the alerts object for this index is now empty, remove the index key too
                       if (Object.keys(Settings.alerts[index]).length === 0) {
                            delete Settings.alerts[index];
                       }
                       Settings.save();
                       Schedule.renderTable(); // Update table icon
                       Alerts.closeModal(); // Close after successful removal
                  }
             }
         } else {
              // No custom settings exist (button should be disabled, but double-check)
              Utils.showFeedback(feedbackEl, `No custom settings to remove. Using defaults.`, true);
              if (this) { // 'this' refers to the button
                  this.disabled = true;
                  this.textContent = 'Using Defaults';
              }
         }
    },

    triggerVisualAlert: function(settings) {
        Alerts.clearVisualAlert(); // Clear previous before starting new
        const { background: alertBg, text: alertText, durationMs, intervalMs } = settings;
        const activeScheme = Settings.getActiveColourScheme();

        // Store original styles (ensure DOM elements exist)
        State.originalBodyStyles = {
            background: document.body.style.backgroundColor,
            color: document.body.style.color,
            timeColor: DOM.timeEl?.style.color || '',
            dateColor: DOM.dateEl?.style.color || '',
            labelColor: DOM.periodLabelEl?.style.color || '',
            progressColor: DOM.progressEl?.style.backgroundColor || '',
            timeLeftColor: DOM.timeLeftEl?.style.color || '',
            // Schedule circle color is complex, rely on restoreOriginalStyles re-rendering them
        };

        let isAlertState = false;
        const toggleColors = () => {
            isAlertState = !isAlertState;
            const currentBg = isAlertState ? alertBg : activeScheme.background;
            const currentText = isAlertState ? alertText : activeScheme.text;
            document.body.style.backgroundColor = currentBg;
            document.body.style.color = currentText; // Base text color

            // Apply to visible elements only
            if (DOM.timeEl && Settings.preferences.showTime) DOM.timeEl.style.color = currentText;
            if (DOM.dateEl && Settings.preferences.showDate) DOM.dateEl.style.color = currentText;
            if (DOM.periodLabelEl && Settings.preferences.showScheduleLabel) DOM.periodLabelEl.style.color = currentText;
            if (DOM.progressEl && Settings.preferences.showProgressBar && !Settings.preferences.showSandBars) DOM.progressEl.style.backgroundColor = currentText;
            if (DOM.timeLeftEl && Settings.preferences.showProgressBar && !Settings.preferences.showSandBars) DOM.timeLeftEl.style.color = currentText;
            if (DOM.scheduleCirclesDisplayEl && Settings.preferences.showScheduleCircles) {
                // Just update active circle colors during flash
                DOM.scheduleCirclesDisplayEl.querySelectorAll('.schedule-circle-symbol.active').forEach(span => span.style.color = currentText);
            }
        };

        toggleColors(); // Initial flash state
        State.activeVisualAlertInterval = setInterval(toggleColors, intervalMs);
        State.activeVisualAlertTimeout = setTimeout(() => {
             Alerts.clearVisualAlert(); // Stop flashing
             Alerts.restoreOriginalStyles(activeScheme); // Restore to correct scheme
        }, durationMs);
    },

    clearVisualAlert: function() {
         clearTimeout(State.activeVisualAlertTimeout);
         clearInterval(State.activeVisualAlertInterval);
         State.activeVisualAlertInterval = null;
         State.activeVisualAlertTimeout = null;
    },

    restoreOriginalStyles: function(schemeToRestoreTo = null) {
        const scheme = schemeToRestoreTo || Settings.getActiveColourScheme(); // Get the correct current scheme
        document.body.style.backgroundColor = scheme.background;
        document.body.style.color = scheme.text;

        // Restore specific elements only if they are intended to be visible
        if (DOM.timeEl && Settings.preferences.showTime) DOM.timeEl.style.color = scheme.text;
        if (DOM.dateEl && Settings.preferences.showDate) DOM.dateEl.style.color = scheme.text;
        if (DOM.periodLabelEl && Settings.preferences.showScheduleLabel) DOM.periodLabelEl.style.color = scheme.text;
        if (DOM.progressEl && Settings.preferences.showProgressBar && !Settings.preferences.showSandBars) DOM.progressEl.style.backgroundColor = scheme.text;
        if (DOM.timeLeftEl && Settings.preferences.showProgressBar && !Settings.preferences.showSandBars) DOM.timeLeftEl.style.color = scheme.text;

        // Re-render circles to ensure correct active/inactive colors based on scheme
        if (Settings.preferences.showScheduleCircles) {
             Visuals.renderScheduleCircles();
        }
    }
};