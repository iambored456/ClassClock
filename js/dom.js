/** js/dom.js */
// No imports needed for this pattern

function queryElements() {
    return {
        clockDisplayArea: document.getElementById("clock-display-area"),
        timeEl: document.getElementById("time"),
        dateEl: document.getElementById("date"),
        scheduleCirclesDisplayEl: document.getElementById("schedule-circles-display"),
        periodContainerEl: document.getElementById("period-container"),
        periodLabelEl: document.getElementById("period-label"),
        progressBarEl: document.getElementById("progress-bar"),
        progressEl: document.getElementById("progress"),
        timeLeftEl: document.getElementById("time-left"),
        sandBarsContainerEl: document.getElementById("sand-bars-container"),
        sandBarsCanvas: document.getElementById('sand-bars-canvas'), // Canvas for physics
        alertModal: document.getElementById('alert-modal'),
        alertModalTitle: document.getElementById('modal-title'),
        alertModalBody: document.getElementById('modal-body'),
        closeModalBtn: document.querySelector('#alert-modal .close-modal-btn'),
        menuToggle: document.getElementById("menu-toggle"),
        settingsMenu: document.getElementById("settings-menu"),
        menuResizer: document.getElementById("menu-resizer"),
        settingsNav: document.getElementById("settings-nav"),
        tabsContainer: document.getElementById("tabs"),
        tabContentsContainer: document.getElementById("tab-contents"),
        appearanceTab: document.getElementById("appearance-tab"),
        scheduleAlertsTab: document.getElementById("schedule-alerts-tab"),
        displayElementsChecklist: document.getElementById("display-elements-checklist"),
        fontSelect: document.getElementById("pref-font"),
        dateFontSizeInput: document.getElementById("pref-date-font"),
        timeFontSizeInput: document.getElementById("pref-time-font"),
        labelFontSizeInput: document.getElementById("pref-schedule-label-font"),
        timeLeftFontSizeInput: document.getElementById("pref-time-left-font"),
        progressHeightInput: document.getElementById("pref-progress-height"),
        resetAppearanceBtn: document.getElementById('reset-appearance-defaults'),
        resetSchemesBtn: document.getElementById('reset-schemes-defaults'),
        colorSchemeTabsContainer: document.getElementById("colour-scheme-tabs"),
        colorSchemeContentContainer: document.getElementById("colour-scheme-content"),
        scheduleTableBody: document.querySelector("#schedule-table tbody"),
        addScheduleRowBtn: document.getElementById("add-schedule-row"),
        deleteScheduleRowBtn: document.getElementById("delete-schedule-row"),
        timeSyncSection: document.getElementById("time-sync-section"),
        syncToBellBtn: document.getElementById("sync-to-bell"),
        offsetMinDownBtn: document.getElementById("offset-min-down"),
        offsetMinUpBtn: document.getElementById("offset-min-up"),
        offsetSecDownBtn: document.getElementById("offset-sec-down"),
        offsetSecUpBtn: document.getElementById("offset-sec-up"),
        resetOffsetBtn: document.getElementById("reset-offset"),
        currentOffsetDisplay: document.getElementById("current-offset"),
    };
}

// Export the cache object, initialized later
export let DOM = {};

// Export a function to populate the cache AFTER the DOM is loaded
export function updateDOMCache() {
    DOM = queryElements();
    console.log("DOM Cache Updated", DOM); // For debugging
}