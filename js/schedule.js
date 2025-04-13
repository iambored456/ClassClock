/** js/schedule.js */
import { DOM } from './dom.js';
import { State } from './state.js';
import { Settings } from './settings.js';
import { Clock } from './clock.js';
import { Alerts } from './alerts.js';
import { Visuals } from './visuals.js';
import { Utils } from './utils.js';

export const Schedule = {
    attachListeners: function() {
         DOM.addScheduleRowBtn?.addEventListener("click", Schedule.addRow);
         DOM.deleteScheduleRowBtn?.addEventListener("click", Schedule.deleteRow);
         // Drag/drop listeners added during renderTable
    },

    renderTable: function() {
        const tableBody = DOM.scheduleTableBody;
        if (!tableBody) { console.error("Schedule table body not found"); return; }
        tableBody.innerHTML = ""; // Clear previous rows

        // Ensure schedule data is available
        const scheduleData = Settings.schedule || [];

        scheduleData.forEach((item, index) => {
            const tr = document.createElement("tr");
            tr.dataset.index = index;
            tr.setAttribute("draggable", "true");
            // Restore selected state if applicable
            if (index === State.selectedScheduleRowIndex) tr.classList.add("selected");

            // --- Create and Append Cells ---
            tr.appendChild(Schedule.createDragCell());
            tr.appendChild(Schedule.createLabelCell(item, index));
            tr.appendChild(Schedule.createTimeCell(item, index, 'start'));
            tr.appendChild(Schedule.createTimeCell(item, index, 'end'));
            tr.appendChild(Schedule.createSchemeCell(item, index));
            tr.appendChild(Schedule.createAlertCell(item, index));
            tr.appendChild(Schedule.createCirclesCell(item, index));

            // --- Attach Row-Level Listeners ---
            tr.addEventListener("click", Schedule.handleRowClick);
            tr.addEventListener("dragstart", Schedule.handleDragStart);
            tr.addEventListener("dragover", Schedule.handleDragOver);
            tr.addEventListener("dragleave", Schedule.handleDragLeave);
            tr.addEventListener("drop", Schedule.handleDrop);
            tr.addEventListener("dragend", Schedule.handleDragEnd);

            tableBody.appendChild(tr); // Add row to table
        });

        // Add listener to table body for better drag leave detection
        tableBody.removeEventListener('dragleave', Schedule.handleTableDragLeave); // Prevent duplicates
        tableBody.addEventListener('dragleave', Schedule.handleTableDragLeave);
    },

    // --- Cell Creation Helper Functions ---
    createDragCell: function() {
        const td = document.createElement("td");
        td.innerHTML = "☰"; // Drag handle symbol
        td.className = "drag-handle";
        td.title = "Drag to reorder";
        return td;
    },
    createLabelCell: function(item, index) {
        const td = document.createElement("td");
        const input = document.createElement("input");
        input.type = "text";
        input.value = item.label || "";
        input.placeholder = "Period Label";
        input.addEventListener("change", function() {
             // Ensure schedule array exists and index is valid
             if (Settings.schedule && Settings.schedule[index]) {
                 Settings.schedule[index].label = this.value;
                 Settings.save();
                 Clock.update(); // Update main display if current period label changes
             }
        });
        td.appendChild(input);
        return td;
    },
    createTimeCell: function(item, index, type) { // type is 'start' or 'end'
         const td = document.createElement("td");
         const input = document.createElement("input");
         input.type = "time";
         input.value = item[type] || "00:00";
         input.addEventListener("change", function() {
              if (Settings.schedule && Settings.schedule[index]) {
                  Settings.schedule[index][type] = this.value;
                  Settings.save();
                  Clock.update(); // Recalculate current period and update display
              }
         });
         td.appendChild(input);
         return td;
    },
    createSchemeCell: function(item, index) {
         const td = document.createElement("td");
         const swatch = document.createElement("div");
         swatch.className = "scheme-swatch";
         // Find scheme safely
         const schemes = Settings.preferences?.colourSchemes || [];
         const scheme = schemes.find(s => s.id === item.colourSchemeId) || schemes.find(s=>s.id===1) || schemes[0]; // Fallbacks
         swatch.style.backgroundColor = scheme ? scheme.background : '#ff00ff';
         swatch.style.borderColor = scheme ? scheme.text : '#ffffff';
         swatch.title = `Scheme: ${scheme ? scheme.name : 'Unknown'} (ID: ${item.colourSchemeId}). Click to cycle.`;
         swatch.addEventListener("click", (e) => {
             e.stopPropagation(); // Prevent row selection when clicking swatch
             Schedule.cycleSchemeForRow(index);
         });
         td.appendChild(swatch);
         return td;
    },
    createAlertCell: function(item, index) {
         const td = document.createElement("td");
         const visualAlertBtn = document.createElement("button");
         // Check Settings.alerts safely
         const isAlertEnabled = Settings.alerts[index]?.colour?.enabled || false;
         visualAlertBtn.innerHTML = isAlertEnabled ? '🔴' : '🟢'; // Icons for state
         visualAlertBtn.title = `Visual Alert: ${isAlertEnabled ? 'Enabled' : 'Disabled'}. Click to edit.`;
         visualAlertBtn.className = "alert-edit-btn";
         visualAlertBtn.addEventListener('click', (e) => {
             e.stopPropagation(); // Prevent row selection
             Alerts.openModal(index); // Open the alert settings modal
         });
         td.appendChild(visualAlertBtn);
         td.style.textAlign = 'center'; // Center the button
         return td;
    },
    createCirclesCell: function(item, index) {
         const td = document.createElement("td");
         const circlesCheckbox = document.createElement("input");
         circlesCheckbox.type = "checkbox";
         circlesCheckbox.checked = item.showCircles || false;
         circlesCheckbox.title = "Show this period in the Schedule Circles display";
         circlesCheckbox.addEventListener("change", function(e) {
             e.stopPropagation(); // Prevent row selection
              if (Settings.schedule && Settings.schedule[index]) {
                 Settings.schedule[index].showCircles = this.checked;
                 Settings.save();
                 Visuals.renderScheduleCircles(); // Update circle display immediately
             }
         });
         td.appendChild(circlesCheckbox);
         td.style.textAlign = 'center'; // Center the checkbox
         return td;
    },

    // --- Event Handlers ---
    handleRowClick: function(e) { // 'this' refers to the clicked TR element
         const clickedIndex = parseInt(this.dataset.index, 10);
         // Ignore clicks on interactive elements (let their own handlers work)
         if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON" || e.target.classList.contains('scheme-swatch') || e.target.classList.contains('drag-handle')) {
             // If clicking inside the *already selected* row's controls, keep selection
             if (this.classList.contains('selected')) {
                 State.selectedScheduleRowIndex = clickedIndex; // Ensure index is correct
                 return;
             }
             // Otherwise, don't change selection state when clicking controls on unselected rows
         } else {
             // Clicked on non-interactive part, handle selection change
             const prevSelected = DOM.scheduleTableBody?.querySelector("tr.selected");
             if (prevSelected) prevSelected.classList.remove("selected");
             this.classList.add("selected");
             State.selectedScheduleRowIndex = clickedIndex;
            // console.log("Selected row index:", State.selectedScheduleRowIndex);
         }
    },

    cycleSchemeForRow: function(index) {
        if (!Settings.schedule || index < 0 || index >= Settings.schedule.length) return; // Validate index

        const currentSchemeId = Settings.schedule[index].colourSchemeId || 1;
        const schemes = Settings.preferences?.colourSchemes || [];
        if (schemes.length === 0) return; // Cannot cycle if no schemes exist

        const currentSchemeIndexInPrefs = schemes.findIndex(s => s.id === currentSchemeId);
        // Cycle to the next scheme, wrap around using modulo
        let nextSchemeIndexInPrefs = (currentSchemeIndexInPrefs + 1) % schemes.length;
        // Assign the ID of the next scheme, fallback to first scheme's ID (or 1) if something unexpected happens
        Settings.schedule[index].colourSchemeId = schemes[nextSchemeIndexInPrefs]?.id || schemes[0]?.id || 1;

        Settings.save();
        Schedule.renderTable(); // Re-render row to show new swatch
        Clock.update(); // Apply new scheme if this period is active
    },

    addRow: function() {
        const newRow = { label: "New Period", start: "00:00", end: "00:00", colourSchemeId: 1, showCircles: false };
        // Determine insertion index: below selected or at the end
        const insertIndex = (State.selectedScheduleRowIndex === null || State.selectedScheduleRowIndex < 0 || State.selectedScheduleRowIndex >= Settings.schedule.length)
                           ? Settings.schedule.length
                           : State.selectedScheduleRowIndex + 1;

        Settings.schedule.splice(insertIndex, 0, newRow); // Insert into schedule array

        // Adjust alert indices: Shift alerts for rows below the insertion point
        const newAlerts = {};
        Object.keys(Settings.alerts).forEach(key => {
            const oldIdx = parseInt(key, 10);
            // If old index was at or after insertion point, increment it
            newAlerts[oldIdx >= insertIndex ? oldIdx + 1 : oldIdx] = Settings.alerts[key];
        });
        Settings.alerts = newAlerts; // Update the main alerts object

        State.selectedScheduleRowIndex = insertIndex; // Select the newly added row
        Schedule.renderTable(); // Re-render the table
        Settings.save(); // Save changes
    },

    deleteRow: function() {
        const indexToDelete = State.selectedScheduleRowIndex;
        // Validate selected index
        if (indexToDelete !== null && indexToDelete >= 0 && indexToDelete < Settings.schedule.length) {
            // Confirm deletion
            if (confirm(`Delete row "${Settings.schedule[indexToDelete].label}"?`)) {
                Settings.schedule.splice(indexToDelete, 1); // Remove from schedule array

                // Adjust alert indices: Remove alert for deleted row and shift subsequent ones
                delete Settings.alerts[indexToDelete]; // Remove the specific alert
                const newAlerts = {};
                Object.keys(Settings.alerts).forEach(key => {
                    const oldIdx = parseInt(key, 10);
                    // If old index was after the deleted one, decrement it
                    newAlerts[oldIdx > indexToDelete ? oldIdx - 1 : oldIdx] = Settings.alerts[key];
                });
                Settings.alerts = newAlerts; // Update the main alerts object

                State.selectedScheduleRowIndex = null; // Deselect row
                Schedule.renderTable(); // Re-render table
                Settings.save();        // Save changes
                Clock.update();         // Update display (in case active period was deleted)
            }
        } else {
            // No valid row selected
            Utils.showButtonFeedback(DOM.deleteScheduleRowBtn, "Select Row First!", 2000);
        }
    },

    // --- Drag and Drop Event Handlers ---
    handleDragStart: function(e) { // 'this' is the row being dragged (TR element)
        State.dragStartIndex = parseInt(this.dataset.index, 10);
        if (isNaN(State.dragStartIndex)) return; // Exit if index invalid

        e.dataTransfer.effectAllowed = "move";
        // Optional: Set data to transfer (though not strictly needed for this implementation)
        e.dataTransfer.setData("text/plain", State.dragStartIndex);
        // Add styling to the row being dragged
        this.classList.add('dragging');

        // Ensure the dragged row is selected
        if (!this.classList.contains('selected')) {
             const prevSelected = DOM.scheduleTableBody?.querySelector("tr.selected");
             if (prevSelected) prevSelected.classList.remove("selected");
             this.classList.add("selected");
             State.selectedScheduleRowIndex = State.dragStartIndex;
        }
    },
    handleDragOver: function(e) {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = "move";
        // Add visual indicator to the row being hovered over
        this.classList.add('drag-over');
    },
    handleDragLeave: function(e) {
        // Remove visual indicator when dragging leaves this row
        this.classList.remove('drag-over');
    },
    handleDrop: function(e) { // 'this' is the row being dropped onto (TR element)
        e.preventDefault();
        this.classList.remove('drag-over'); // Remove drop indicator
        const dragEndIndex = parseInt(this.dataset.index, 10);
        const dragStartIndex = State.dragStartIndex; // Get index of dragged row from state

        // Ensure we have valid start/end indices and they are different
        if (dragStartIndex !== null && !isNaN(dragEndIndex) && dragStartIndex !== dragEndIndex) {

            // 1. Reorder the schedule array
            const movedItem = Settings.schedule.splice(dragStartIndex, 1)[0]; // Remove item
            Settings.schedule.splice(dragEndIndex, 0, movedItem); // Insert item at new position

            // 2. Reorder the alerts object keys
            const movedAlert = Settings.alerts[dragStartIndex]; // Get alert for moved item
            const tempAlerts = {};
            Object.keys(Settings.alerts).forEach(key => {
                const oldIdx = parseInt(key, 10);
                 if (oldIdx === dragStartIndex) return; // Skip the one we're moving

                let newIdx = oldIdx;
                // Adjust index based on relative positions of start/end drag points
                if (dragStartIndex < oldIdx && dragEndIndex >= oldIdx) {
                    newIdx--; // Item moved down past this one, shift this one up
                } else if (dragStartIndex > oldIdx && dragEndIndex <= oldIdx) {
                    newIdx++; // Item moved up past this one, shift this one down
                }
                tempAlerts[newIdx] = Settings.alerts[key]; // Assign alert to new index
            });
            // Place the moved alert at the new end index
            if (movedAlert) {
                tempAlerts[dragEndIndex] = movedAlert;
            }
            Settings.alerts = tempAlerts; // Update main alerts object

            // 3. Update selected index to follow the moved item
            State.selectedScheduleRowIndex = dragEndIndex;

            // 4. Re-render the table, save changes, update clock
            Schedule.renderTable();
            Settings.save();
            Clock.update();
        }
        State.dragStartIndex = null; // Reset drag state
    },
    handleDragEnd: function(e) { // 'this' is the row that was dragged
        // Clean up styles applied during drag
        this.classList.remove('dragging');
        // Ensure any lingering drag-over styles are removed from all rows
        document.querySelectorAll('#schedule-table tbody tr.drag-over').forEach(row => {
            row.classList.remove('drag-over');
        });
        State.dragStartIndex = null; // Reset drag state
    },
     handleTableDragLeave: function(e) {
         // If the mouse leaves the entire table body, clear any hover indicators
         if (DOM.scheduleTableBody && !DOM.scheduleTableBody.contains(e.relatedTarget)) {
              document.querySelectorAll('#schedule-table tbody tr.drag-over').forEach(row => {
                  row.classList.remove('drag-over');
              });
         }
     }
};