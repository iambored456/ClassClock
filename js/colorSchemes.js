/** js/colorSchemes.js */
import { DOM } from './dom.js';
import { Settings } from './settings.js';
import { Schedule } from './schedule.js';
import { Clock } from './clock.js';
import { Utils } from './utils.js';

export const ColorSchemes = {
     attachListeners: function() {
          // Use event delegation on the container for dynamically added content
          DOM.colorSchemeContentContainer?.addEventListener('click', ColorSchemes.handleContentClick);
          DOM.colorSchemeContentContainer?.addEventListener('input', ColorSchemes.handleContentInput);
          // Add button listener attached in renderTabs
          // Reset button listener attached in Appearance module
     },

    renderTabs: function() {
        const container = DOM.colorSchemeTabsContainer;
        const contentContainer = DOM.colorSchemeContentContainer;
        if (!container || !contentContainer) return;
        container.innerHTML = ""; // Clear existing tabs

        // Ensure schemes exist before iterating
        const schemes = Settings.preferences?.colourSchemes || [];

        schemes.forEach((scheme, index) => {
            const tabButton = document.createElement("button");
            tabButton.className = "colour-tab";
            tabButton.textContent = scheme.name || `Scheme ${scheme.id}`;
            tabButton.dataset.id = scheme.id;
            tabButton.dataset.index = index;
            tabButton.addEventListener("click", function() {
                 // Deactivate other tabs
                 container.querySelectorAll(".colour-tab.active").forEach(btn => btn.classList.remove("active"));
                 // Activate this tab
                 this.classList.add("active");
                 ColorSchemes.renderContent(index); // Render content for this index
            });
            container.appendChild(tabButton);
        });

        // Add '+' button to add new schemes
        const addTab = document.createElement("button");
        addTab.className = "colour-tab add-colour";
        addTab.textContent = "+";
        addTab.title = "Add New Colour Scheme";
        addTab.addEventListener("click", ColorSchemes.addScheme);
        container.appendChild(addTab);

        // Activate the first non-add tab by default, if one exists
        const firstTab = container.querySelector(".colour-tab:not(.add-colour)");
        if (firstTab) {
            firstTab.click(); // Simulate click to render its content and set active state
        } else {
            // If no schemes exist (only '+' button), show message
            contentContainer.innerHTML = "<p>No colour schemes defined. Click '+' to add one.</p>";
        }
    },

    renderContent: function(index) {
        const container = DOM.colorSchemeContentContainer;
        const schemes = Settings.preferences?.colourSchemes || [];
        if (!container || index < 0 || index >= schemes.length) return; // Validate index

        const scheme = schemes[index];
        if (!scheme) return; // Ensure scheme exists

        // Determine if delete button should be enabled
        const canDelete = schemes.length > 1 && scheme.id !== 1 && scheme.id !== 2;
        const deleteButtonHTML = `
            <button
                id="delete-scheme-${index}"
                data-index="${index}"
                ${!canDelete ? 'disabled title="Cannot delete default schemes or the last remaining scheme"' : ''}>
                Delete Scheme
            </button>`;

        container.innerHTML = `
          <div class="colour-scheme-form">
            <label>Scheme Name: <input type="text" id="scheme-name-${index}" value="${scheme.name || ''}"></label>
            <label>Background Colour: <input type="color" id="scheme-bg-color-${index}" value="${scheme.background || '#000000'}"></label>
            <label>Main Text Colour (Date, Time, Label, Progress, Active Circles): <input type="color" id="scheme-text-color-${index}" value="${scheme.text || '#ffffff'}"></label>
            <button id="save-scheme-settings-${index}" data-index="${index}">Save Scheme</button>
            ${canDelete ? deleteButtonHTML : ''}
             <div class="feedback-message" style="display: none;"></div>
           </div>`;
        // Note: Delete button only shown if canDelete is true
    },

    handleContentInput: function(e) {
         // Live update logic for name/color changes
         const target = e.target;
         const form = target.closest('.colour-scheme-form');
         // Check if the target is one of the inputs we care about
         if (!form || !target.id || !(target.id.startsWith('scheme-name') || target.id.startsWith('scheme-bg-color') || target.id.startsWith('scheme-text-color'))) return;

         const saveButton = form.querySelector('button[id^="save-scheme-settings"]');
         if (!saveButton) return; // Need save button to get index reliably

         const index = parseInt(saveButton.dataset.index, 10); // Get index from save button's data attribute

         if (!isNaN(index) && index >= 0 && index < Settings.preferences.colourSchemes.length) {
             const scheme = Settings.preferences.colourSchemes[index];
             if (target.id.startsWith('scheme-name')) scheme.name = target.value;
             if (target.id.startsWith('scheme-bg-color')) scheme.background = target.value;
             if (target.id.startsWith('scheme-text-color')) scheme.text = target.value;

             // Update tab button text live if name changed
             const tabButton = DOM.colorSchemeTabsContainer?.querySelector(`.colour-tab[data-index="${index}"]`);
             if (tabButton && target.id.startsWith('scheme-name')) {
                 tabButton.textContent = target.value || `Scheme ${scheme.id}`;
             }
             // Apply changes live to the clock display if this scheme is active
             Clock.update(); // Re-render clock which reapplies styles based on getActiveColourScheme
         }
    },

    handleContentClick: function(e) {
         // Handle clicks on Save/Delete buttons using event delegation
         const target = e.target;
         // Check if the clicked element is a button inside the form
         if (target.tagName !== 'BUTTON' || !target.id || !target.closest('.colour-scheme-form')) return;

         const index = parseInt(target.dataset.index, 10);
         const feedbackEl = target.closest('.colour-scheme-form')?.querySelector('.feedback-message');

         if (isNaN(index)) return; // Ignore if no valid index

         if (target.id.startsWith('save-scheme-settings')) {
             // Input changes handled live, just save and give feedback
             Settings.save();
             Utils.showButtonFeedback(target, "Saved!");
             // Ensure correct tab remains visually active
             const currentTabButton = DOM.colorSchemeTabsContainer?.querySelector(`.colour-tab[data-index="${index}"]`);
             if (currentTabButton && !currentTabButton.classList.contains('active')) {
                  DOM.colorSchemeTabsContainer?.querySelectorAll(".colour-tab.active").forEach(btn => btn.classList.remove("active"));
                  currentTabButton.classList.add("active");
             }
         } else if (target.id.startsWith('delete-scheme')) {
              ColorSchemes.deleteScheme(index, target); // Pass button for potential feedback
         }
    },

    addScheme: function() {
        // Calculate next available ID
        const nextId = (Settings.preferences.colourSchemes.reduce((maxId, s) => Math.max(maxId, s.id || 0), 0) || 0) + 1;
        const newScheme = { id: nextId, name: "New Scheme " + nextId, background: "#222222", text: "#EEEEEE" };
        Settings.preferences.colourSchemes.push(newScheme);
        Settings.save();
        ColorSchemes.renderTabs(); // Re-render tabs to include the new one
        // Find and click the newly added tab to make it active
        const newTabButton = DOM.colorSchemeTabsContainer?.querySelector(`.colour-tab[data-id="${nextId}"]`);
        newTabButton?.click();
    },

    deleteScheme: function(index, buttonElement) { // Accept button for feedback potentially
        const schemes = Settings.preferences.colourSchemes;
        if (index < 0 || index >= schemes.length) return; // Validate index

        const schemeToDelete = schemes[index];
        // Double-check deletability rules
        const canDelete = schemes.length > 1 && schemeToDelete.id !== 1 && schemeToDelete.id !== 2;

        if (canDelete) {
            if (confirm(`Delete scheme "${schemeToDelete.name || `Scheme ${index + 1}`}"? Periods using it will revert to Scheme 1.`)) {
                const deletedSchemeId = schemeToDelete.id;
                schemes.splice(index, 1); // Remove from array

                // Update schedule items using the deleted scheme to use default (ID 1)
                Settings.schedule.forEach(item => {
                    if (item.colourSchemeId === deletedSchemeId) {
                        item.colourSchemeId = 1;
                    }
                });

                Settings.save();          // Save changes
                Schedule.renderTable();   // Update schedule table swatches
                ColorSchemes.renderTabs(); // Re-render tabs (first one will become active)
                Clock.update();           // Update main clock display
            }
        } else {
             // Should not happen if button is correctly disabled, but provide feedback just in case
             alert("Cannot delete default schemes or the last remaining scheme.");
        }
    },

    resetDefaults: function() { // Called by Appearance module listener now
        if (confirm("Reset ALL Colour Schemes to the defaults? This cannot be undone.")) {
            // Deep copy defaults into preferences
            Settings.preferences.colourSchemes = JSON.parse(JSON.stringify(Settings.defaultPreferences.colourSchemes));
            // Reset all schedule items to use default scheme (ID 1)
            Settings.schedule.forEach(item => item.colourSchemeId = 1);
            Settings.save();          // Save changes
            Schedule.renderTable();   // Update schedule table
            ColorSchemes.renderTabs(); // Update color scheme tabs/content
            Clock.update();           // Update main display
            Utils.showButtonFeedback(DOM.resetSchemesBtn, "Reset!"); // Feedback on the correct button
        }
    }
};