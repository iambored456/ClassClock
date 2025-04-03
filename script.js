/**********************************
 * Clock & Schedule Functionality
 **********************************/
// Default schedule
let schedule = [
  { label: "Before", start: "00:00", end: "08:50", colourSchemeId: 1 },
  { label: "Period 1", start: "08:50", end: "10:05", colourSchemeId: 1 },
  { label: "Break", start: "10:05", end: "10:15", colourSchemeId: 2 },
  { label: "Period 2", start: "10:15", end: "11:30", colourSchemeId: 1 },
  { label: "Lunch", start: "11:30", end: "12:20", colourSchemeId: 2 },
  { label: "Period 3", start: "12:20", end: "13:35", colourSchemeId: 1 },
  { label: "Break", start: "13:35", end: "13:45", colourSchemeId: 2 },
  { label: "Period 4", start: "13:45", end: "15:00", colourSchemeId: 1 },
  { label: "After", start: "15:00", end: "23:59", colourSchemeId: 1 }
];

// Default preferences - Updated font, simplified colours
const defaultPreferences = {
fontFamily: "Atkinson Hyperlegible", // Use custom font by default
dateFontSize: 64,
timeFontSize: 200,
scheduleLabelFontSize: 48,
timeLeftFontSize: 40,
progressBarHeight: 120,
timeOffsetMs: 0,
// Simplified Colour Schemes
colourSchemes: [
  { id: 1, name: "Default Dark", background: "#000000", text: "#FFFFFF" },
  { id: 2, name: "Default Light", background: "#F0F0F0", text: "#000000" }
],
// Default visual alert settings
defaultAlertSettings: {
    colour: {
        enabled: false,
        background: "#ff0000", text: "#ffffff",
        durationMs: 1500,
        intervalMs: 500
    }
}
};
let preferences = JSON.parse(JSON.stringify(defaultPreferences)); // Deep copy

// Alerts settings (Visual only)
let alertsSettings = {};

// State variables
let currentPeriodLabel = null;
let activeVisualAlertInterval = null;
let activeVisualAlertTimeout = null;
let originalBodyStyles = {};

// --- DOM Elements Cache ---
const timeEl = document.getElementById("time");
const dateEl = document.getElementById("date");
const periodLabelEl = document.getElementById("period-label");
const progressEl = document.getElementById("progress");
const progressBarEl = document.getElementById("progress-bar");
const timeLeftEl = document.getElementById("time-left");
const alertModal = document.getElementById('alert-modal');
const alertModalTitle = document.getElementById('modal-title');
const alertModalBody = document.getElementById('modal-body');
const closeModalBtn = alertModal.querySelector('.close-modal-btn');


// Helper: Create a Date for today's date at a given HH:MM.
function getTodayTime(timeStr) {
if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) { const now = new Date(); now.setSeconds(0, 0); return now; }
const [hours, minutes] = timeStr.split(":").map(Number);
const now = new Date(); now.setHours(hours, minutes, 0, 0); return now;
}

// Get current time with offset
function getCurrentOffsetTime() {
  const systemNow = new Date(); const offset = Number(preferences.timeOffsetMs) || 0; return new Date(systemNow.getTime() + offset);
}

// Find the active colour scheme based on the current period
function getActiveColourScheme() {
  const now = getCurrentOffsetTime(); const currentPeriod = getCurrentPeriod(now);
  let schemeId = 1;
  if (currentPeriod) {
      const scheduleItem = schedule.find(item => item.label === currentPeriod.label);
      if (scheduleItem && scheduleItem.colourSchemeId) { schemeId = scheduleItem.colourSchemeId; }
  }
  return preferences.colourSchemes.find(s => s.id === schemeId) || preferences.colourSchemes[0] || { id: 0, name: "Error", background: "#ff00ff", text: "#000000" };
}

// Determine the current period
function getCurrentPeriod(now) {
for (let i = 0; i < schedule.length; i++) {
  const period = schedule[i];
  try {
      const startTime = getTodayTime(period.start); const endTime = getTodayTime(period.end);
      let adjustedEndTime = new Date(endTime.getTime()); let isOvernight = false;
      if (endTime < startTime) { isOvernight = true; adjustedEndTime.setDate(adjustedEndTime.getDate() + 1); }
      let isActive = false;
      if (isOvernight) { if (now >= startTime || now <= endTime) { isActive = true; endTime.setTime(adjustedEndTime.getTime()); } }
      else {
           if (now >= startTime && now < adjustedEndTime) { isActive = true; }
           else if (period.end === "23:59:59" || (period.end === "23:59" && now.getHours() === 23 && now.getMinutes() === 59)) {
               const endWithSeconds = getTodayTime(period.end); endWithSeconds.setSeconds(59, 999);
               if (now >= startTime && now <= endWithSeconds) { isActive = true; }
           }
      }
      if (isActive) { return { label: period.label, start: startTime, end: adjustedEndTime, index: i }; }
  } catch (e) { console.error("Error processing period:", period.label, e); }
}
return null;
}


function formatTime(date) {
let hours = date.getHours(); const minutes = date.getMinutes(); const ampm = hours >= 12 ? 'PM' : 'AM';
hours = hours % 12 || 12; return `${hours}:${minutes < 10 ? "0" + minutes : minutes} ${ampm}`;
}

function formatDate(date) {
const options = { weekday: 'long', month: 'long', day: 'numeric' }; return date.toLocaleDateString(undefined, options);
}

function updateOffsetDisplay() {
  const offsetMs = Number(preferences.timeOffsetMs) || 0; const totalSeconds = Math.round(offsetMs / 1000);
  const sign = totalSeconds >= 0 ? '+' : '-'; const absSeconds = Math.abs(totalSeconds);
  const minutes = Math.floor(absSeconds / 60); const seconds = absSeconds % 60;
  const paddedSeconds = seconds < 10 ? '0' + seconds : seconds; const offsetString = `${sign}${minutes}m ${paddedSeconds}s`;
  const displayElement = document.getElementById("current-offset");
  if (displayElement) displayElement.textContent = offsetString;
}

// --- Alert Triggering Functions ---
function triggerVisualAlert(settings) {
  clearTimeout(activeVisualAlertTimeout); clearInterval(activeVisualAlertInterval); restoreOriginalStyles();
  const { background: alertBg, text: alertText, durationMs, intervalMs } = settings;
  const activeScheme = getActiveColourScheme();
  originalBodyStyles = { background: document.body.style.backgroundColor, color: document.body.style.color, timeColor: timeEl.style.color, dateColor: dateEl.style.color, labelColor: periodLabelEl.style.color, progressColor: progressEl.style.backgroundColor, timeLeftColor: timeLeftEl.style.color };

  let isAlertState = false;
  const toggleColors = () => {
      isAlertState = !isAlertState;
      const currentBg = isAlertState ? alertBg : activeScheme.background;
      const currentText = isAlertState ? alertText : activeScheme.text;
      document.body.style.backgroundColor = currentBg;
      document.body.style.color = currentText;
      if (timeEl) timeEl.style.color = currentText;
      if (dateEl) dateEl.style.color = currentText;
      if (periodLabelEl) periodLabelEl.style.color = currentText;
      if (progressEl) progressEl.style.backgroundColor = currentText;
      if (timeLeftEl) timeLeftEl.style.color = currentText;
  };
  toggleColors(); activeVisualAlertInterval = setInterval(toggleColors, intervalMs);
  activeVisualAlertTimeout = setTimeout(() => {
      clearInterval(activeVisualAlertInterval); activeVisualAlertInterval = null; activeVisualAlertTimeout = null;
      restoreOriginalStyles(activeScheme);
  }, durationMs);
}

// Updated to use scheme.text for more elements
function restoreOriginalStyles(schemeToRestoreTo = null) {
  const scheme = schemeToRestoreTo || getActiveColourScheme();
  document.body.style.backgroundColor = scheme.background;
  document.body.style.color = scheme.text;
  if (timeEl) timeEl.style.color = scheme.text;
  if (dateEl) dateEl.style.color = scheme.text;
  if (periodLabelEl) periodLabelEl.style.color = scheme.text;
  if (progressEl) progressEl.style.backgroundColor = scheme.text;
  if (timeLeftEl) timeLeftEl.style.color = scheme.text;
}


// --- Main Clock Update Loop ---
function updateClock() {
  const now = getCurrentOffsetTime(); const activeScheme = getActiveColourScheme();
  if (!activeVisualAlertInterval) { restoreOriginalStyles(activeScheme); }
  if (timeEl) timeEl.textContent = formatTime(now); if (dateEl) dateEl.textContent = formatDate(now);
  const periodInfo = getCurrentPeriod(now);
  // --- Period Change Detection & Alert Triggering ---
  const newPeriodLabel = periodInfo ? periodInfo.label : null;
  if (newPeriodLabel !== currentPeriodLabel) {
      currentPeriodLabel = newPeriodLabel;
      if (periodInfo && periodInfo.index !== undefined) {
          const alertSetting = alertsSettings[periodInfo.index];
          if (alertSetting?.colour?.enabled) { triggerVisualAlert(alertSetting.colour); }
      } else { clearTimeout(activeVisualAlertTimeout); clearInterval(activeVisualAlertInterval); restoreOriginalStyles(); }
  }

  // Update Period Label, Progress Bar, Time Left (Always show progress bar)
  if (periodInfo) {
      if (periodLabelEl) periodLabelEl.textContent = periodInfo.label;
      const periodStartMs = periodInfo.start.getTime(); const periodEndMs = periodInfo.end.getTime();
      const nowMs = now.getTime(); const periodDuration = periodEndMs - periodStartMs; const timeElapsed = nowMs - periodStartMs;

      if (progressBarEl) progressBarEl.style.display = 'block';
      if (timeLeftEl) timeLeftEl.style.display = 'block';

      if (periodDuration > 0) {
          let progressPercent = Math.min(Math.max((timeElapsed / periodDuration) * 100, 0), 100);
          if (progressEl) progressEl.style.width = progressPercent + "%";
          if (progressBarEl && timeLeftEl) {
               const progressBarWidth = progressBarEl.offsetWidth; let desiredLeft = (progressPercent / 100) * progressBarWidth;
               const timeLeftWidth = timeLeftEl.offsetWidth || 60; let finalLeft = desiredLeft - (timeLeftWidth / 2);
               finalLeft = Math.max(timeLeftWidth / 2, finalLeft); finalLeft = Math.min(progressBarWidth - (timeLeftWidth / 2), finalLeft);
               timeLeftEl.style.left = finalLeft + "px";
               const timeLeftMs = periodEndMs - nowMs; const timeLeftSec = Math.max(0, Math.floor(timeLeftMs / 1000));
               const minutes = Math.floor(timeLeftSec / 60); const seconds = timeLeftSec % 60;
               timeLeftEl.textContent = `${minutes}:${seconds < 10 ? "0" + seconds : seconds}`;
          }
      } else {
           if (progressEl) progressEl.style.width = (nowMs >= periodStartMs) ? "100%" : "0%";
           if (timeLeftEl) timeLeftEl.textContent = "0:00";
           if (progressBarEl && timeLeftEl) { const progressBarWidth = progressBarEl.offsetWidth; const timeLeftWidth = timeLeftEl.offsetWidth || 60; timeLeftEl.style.left = Math.min(progressBarWidth - (timeLeftWidth / 2), progressBarWidth) + "px"; }
      }
  } else {
      if (periodLabelEl) periodLabelEl.textContent = "";
      if (progressEl) progressEl.style.width = "0%";
      if (progressBarEl) progressBarEl.style.display = 'block';
      if (timeLeftEl) timeLeftEl.textContent = ""; timeLeftEl.style.display = 'none';
  }
  applyFontAndSizePreferences();
}

// Apply only font/size preferences
function applyFontAndSizePreferences() {
   if (dateEl) dateEl.style.fontSize = preferences.dateFontSize + "px";
   if (timeEl) timeEl.style.fontSize = preferences.timeFontSize + "px";
   if (periodLabelEl) periodLabelEl.style.fontSize = preferences.scheduleLabelFontSize + "px";
   if (timeLeftEl) timeLeftEl.style.fontSize = preferences.timeLeftFontSize + "px";
   if (progressBarEl) progressBarEl.style.height = preferences.progressBarHeight + "px";
   document.body.style.fontFamily = preferences.fontFamily;
}

setInterval(updateClock, 1000);

/**********************************
* Settings Menu Functionality
**********************************/
const menuToggle = document.getElementById("menu-toggle");
const settingsMenu = document.getElementById("settings-menu");
menuToggle.addEventListener("click", () => { settingsMenu.classList.toggle("open"); menuToggle.innerHTML = settingsMenu.classList.contains("open") ? "▲" : "▼"; });
// Draggable resizer
const menuResizer = document.getElementById("menu-resizer"); let isResizing = false;
menuResizer.addEventListener("mousedown", function(e) { isResizing = true; document.body.style.cursor = "ew-resize"; });
document.addEventListener("mousemove", function(e) { if (!isResizing) return; const newWidth = window.innerWidth - e.clientX; const minWidth = 400; const maxWidth = Math.min(800, window.innerWidth - 50); if (newWidth >= minWidth && newWidth <= maxWidth) settingsMenu.style.width = newWidth + "px"; });
document.addEventListener("mouseup", function(e) { if (isResizing) { isResizing = false; document.body.style.cursor = "default"; } });

// --- Feedback Message Helpers ---
function showFeedback(element, message, isSuccess = true) { element.textContent = message; element.classList.remove('success', 'error'); element.classList.add(isSuccess ? 'success' : 'error'); element.style.display = 'block'; setTimeout(() => { if (element) element.style.display = 'none'; }, 3000); }
function showButtonFeedback(button, message = "Saved!", duration = 1500) { const originalText = button.textContent; button.textContent = message; button.classList.add('button-success'); button.disabled = true; setTimeout(() => { button.textContent = originalText; button.classList.remove('button-success'); button.disabled = false; }, duration); }

// --- LocalStorage Helpers ---
function loadSettings() {
const savedSchedule = localStorage.getItem("clockSchedule"); if (savedSchedule) { try { const parsedSchedule = JSON.parse(savedSchedule); if (Array.isArray(parsedSchedule)) { schedule = parsedSchedule.map(item => ({ ...item, colourSchemeId: item.colourSchemeId || item.colour || 1 })); } } catch (e) { console.error("Error parsing saved schedule.", e); } }
const savedPrefs = localStorage.getItem("clockPreferences");
if (savedPrefs) {
  try {
    const loadedPreferences = JSON.parse(savedPrefs);
    if (typeof loadedPreferences === 'object' && loadedPreferences !== null) {
           preferences = { ...JSON.parse(JSON.stringify(defaultPreferences)), ...loadedPreferences, defaultAlertSettings: { colour: { ...defaultPreferences.defaultAlertSettings.colour, ...(loadedPreferences.defaultAlertSettings?.colour || {}) } }, colourSchemes: (loadedPreferences.colourSchemes && Array.isArray(loadedPreferences.colourSchemes) ? loadedPreferences.colourSchemes.map(s => ({ id: s.id, name: s.name, background: s.background, text: s.text })) : [...defaultPreferences.colourSchemes]) };
           if (preferences.defaultAlertSettings.noise) delete preferences.defaultAlertSettings.noise; preferences.colourSchemes.forEach(s => { if(s.accent) delete s.accent; }); delete preferences.backgroundColor;
    } else { preferences = JSON.parse(JSON.stringify(defaultPreferences)); }
  } catch (e) { console.error("Error parsing saved preferences.", e); preferences = JSON.parse(JSON.stringify(defaultPreferences)); }
} else { preferences = JSON.parse(JSON.stringify(defaultPreferences)); }
const savedAlerts = localStorage.getItem("clockAlerts"); if (savedAlerts) { try { alertsSettings = JSON.parse(savedAlerts) || {}; if (typeof alertsSettings !== 'object' || alertsSettings === null) alertsSettings = {}; Object.keys(alertsSettings).forEach(key => { if (alertsSettings[key]?.noise) { delete alertsSettings[key].noise; if (Object.keys(alertsSettings[key]).length === 0) delete alertsSettings[key]; } }); } catch (e) { console.error("Error parsing saved alerts settings.", e); alertsSettings = {}; } }
preferences.timeOffsetMs = Number(preferences.timeOffsetMs) || 0; preferences.dateFontSize = Number(preferences.dateFontSize) || defaultPreferences.dateFontSize; preferences.timeFontSize = Number(preferences.timeFontSize) || defaultPreferences.timeFontSize; preferences.scheduleLabelFontSize = Number(preferences.scheduleLabelFontSize) || defaultPreferences.scheduleLabelFontSize; preferences.timeLeftFontSize = Number(preferences.timeLeftFontSize) || defaultPreferences.timeLeftFontSize; preferences.progressBarHeight = Number(preferences.progressBarHeight) || defaultPreferences.progressBarHeight;
updatePreferenceInputs(); applyFontAndSizePreferences(); updateClock(); renderScheduleTable(); renderColourSchemeTabs(); updateOffsetDisplay();
}

function saveSettings() { Object.keys(alertsSettings).forEach(key => { if (alertsSettings[key] && typeof alertsSettings[key] === 'object' && Object.keys(alertsSettings[key]).length === 0) delete alertsSettings[key]; }); localStorage.setItem("clockSchedule", JSON.stringify(schedule)); localStorage.setItem("clockPreferences", JSON.stringify(preferences)); localStorage.setItem("clockAlerts", JSON.stringify(alertsSettings)); }

// Update Appearance tab inputs
function updatePreferenceInputs() {
  document.getElementById("pref-font").value = preferences.fontFamily;
  document.getElementById("pref-date-font").value = preferences.dateFontSize;
  document.getElementById("pref-time-font").value = preferences.timeFontSize;
  document.getElementById("pref-schedule-label-font").value = preferences.scheduleLabelFontSize;
  document.getElementById("pref-time-left-font").value = preferences.timeLeftFontSize;
  document.getElementById("pref-progress-height").value = preferences.progressBarHeight;
}

// --- Preference Input Listeners (Appearance Tab) ---
function attachPreferenceListeners() {
document.getElementById("pref-font").addEventListener("input", function() { preferences.fontFamily = this.value; applyFontAndSizePreferences(); saveSettings(); });

// Number Inputs with Custom Buttons + Hold Functionality
document.querySelectorAll('.number-input-wrapper').forEach(wrapper => {
    const input = wrapper.querySelector('input[type="number"]');
    const minusBtn = wrapper.querySelector('.num-btn.minus');
    const plusBtn = wrapper.querySelector('.num-btn.plus');
    const prefKey = input.id.replace('pref-', '').replace(/-/g, '');

    let intervalId = null;
    let timeoutId = null;
    const HOLD_DELAY = 500; // ms before repeat starts
    const HOLD_INTERVAL = 100; // ms between repeats

    const updatePreference = (newValue) => {
        const keyMap = { datefont: 'dateFontSize', timefont: 'timeFontSize', schedulelabelfont: 'scheduleLabelFontSize', timeleftfont: 'timeLeftFontSize', progressheight: 'progressBarHeight' };
        const prefName = keyMap[prefKey];
        if (prefName) {
            const step = parseInt(input.step) || 1;
            // Ensure value stays within min/max if defined on input
            const min = input.min ? parseInt(input.min, 10) : -Infinity;
            const max = input.max ? parseInt(input.max, 10) : Infinity;
            let parsedValue = parseInt(newValue, 10);
            parsedValue = isNaN(parsedValue) ? defaultPreferences[prefName] : Math.max(min, Math.min(max, parsedValue)); // Clamp value

            preferences[prefName] = parsedValue;
            input.value = parsedValue;
            applyFontAndSizePreferences();
            saveSettings(); // Save on each programmatic change too
        }
    };

    const startRepeating = (step) => {
         updatePreference(parseInt(input.value, 10) + step); // Initial action
         stopRepeating(); // Clear any existing timers
         timeoutId = setTimeout(() => {
              intervalId = setInterval(() => {
                   updatePreference(parseInt(input.value, 10) + step);
              }, HOLD_INTERVAL);
         }, HOLD_DELAY);
    };

    const stopRepeating = () => {
        clearTimeout(timeoutId);
        clearInterval(intervalId);
        timeoutId = null;
        intervalId = null;
    };

    // Update on direct input change (when user types and blurs/hits enter)
    input.addEventListener("change", () => updatePreference(input.value));

    // Button listeners with hold support
    minusBtn.addEventListener("mousedown", () => startRepeating(-(parseInt(input.step) || 1)));
    plusBtn.addEventListener("mousedown", () => startRepeating(parseInt(input.step) || 1));

    // Stop repeating on mouseup or leaving the button area
    minusBtn.addEventListener("mouseup", stopRepeating);
    minusBtn.addEventListener("mouseleave", stopRepeating);
    plusBtn.addEventListener("mouseup", stopRepeating);
    plusBtn.addEventListener("mouseleave", stopRepeating);

    // Also stop if focus is lost (e.g., tabbing away)
    minusBtn.addEventListener("blur", stopRepeating);
    plusBtn.addEventListener("blur", stopRepeating);
});


 const resetAppearanceBtn = document.getElementById('reset-appearance-defaults'); if (resetAppearanceBtn) { resetAppearanceBtn.addEventListener('click', () => { if (confirm("Reset Font & Size settings to defaults?")) { preferences.fontFamily = defaultPreferences.fontFamily; preferences.dateFontSize = defaultPreferences.dateFontSize; preferences.timeFontSize = defaultPreferences.timeFontSize; preferences.scheduleLabelFontSize = defaultPreferences.scheduleLabelFontSize; preferences.timeLeftFontSize = defaultPreferences.timeLeftFontSize; preferences.progressBarHeight = defaultPreferences.progressBarHeight; updatePreferenceInputs(); applyFontAndSizePreferences(); saveSettings(); showButtonFeedback(resetAppearanceBtn, "Reset!"); } }); }
 const resetSchemesBtn = document.getElementById('reset-schemes-defaults'); if (resetSchemesBtn) { resetSchemesBtn.addEventListener('click', () => { if (confirm("Reset ALL Colour Schemes to the defaults? This cannot be undone.")) { preferences.colourSchemes = JSON.parse(JSON.stringify(defaultPreferences.colourSchemes)); schedule.forEach(item => item.colourSchemeId = 1); renderScheduleTable(); renderColourSchemeTabs(); updateClock(); saveSettings(); showButtonFeedback(resetSchemesBtn, "Reset!"); } }); }
}
attachPreferenceListeners();

// --- Colour Scheme Management (Simplified) ---
function renderColourSchemeTabs() {
  const tabsContainer = document.getElementById("colour-scheme-tabs"); const contentContainer = document.getElementById("colour-scheme-content"); if (!tabsContainer || !contentContainer) return; tabsContainer.innerHTML = "";
  preferences.colourSchemes.forEach((scheme, index) => { const tabButton = document.createElement("button"); tabButton.className = "colour-tab"; tabButton.textContent = scheme.name || `Scheme ${scheme.id}`; tabButton.dataset.id = scheme.id; tabButton.dataset.index = index; tabButton.addEventListener("click", function() { document.querySelectorAll(".colour-tab").forEach(btn => btn.classList.remove("active")); this.classList.add("active"); renderColourSchemeContent(index); }); tabsContainer.appendChild(tabButton); });
  const addTab = document.createElement("button"); addTab.className = "colour-tab add-colour"; addTab.textContent = "+"; addTab.title = "Add New Colour Scheme";
  addTab.addEventListener("click", function() { const nextId = preferences.colourSchemes.reduce((maxId, s) => Math.max(maxId, s.id || 0), 0) + 1; const newScheme = { id: nextId, name: "Colour " + nextId, background: "#222222", text: "#EEEEEE" }; preferences.colourSchemes.push(newScheme); saveSettings(); renderColourSchemeTabs(); const newTabIndex = preferences.colourSchemes.length - 1; const newTabButton = tabsContainer.querySelector(`.colour-tab[data-index="${newTabIndex}"]`); if (newTabButton) { document.querySelectorAll(".colour-tab").forEach(btn => btn.classList.remove("active")); newTabButton.classList.add("active"); renderColourSchemeContent(newTabIndex); } });
  tabsContainer.appendChild(addTab);
  const firstTab = tabsContainer.querySelector(".colour-tab:not(.add-colour)"); if (firstTab) { firstTab.classList.add("active"); renderColourSchemeContent(firstTab.dataset.index); } else { contentContainer.innerHTML = "<p>No colour schemes defined. Click '+' to add one.</p>"; }
}
function renderColourSchemeContent(index) {
const contentContainer = document.getElementById("colour-scheme-content"); if (index < 0 || index >= preferences.colourSchemes.length) return; const scheme = preferences.colourSchemes[index]; if (!scheme) return;
contentContainer.innerHTML = `
  <div class="colour-scheme-form">
    <label>Scheme Name: <input type="text" id="scheme-name" value="${scheme.name || ''}"></label>
    <label>Background Colour: <input type="color" id="scheme-bg-color" value="${scheme.background || '#000000'}"></label>
    <label>Main Text Colour (Date, Time, Label, Progress): <input type="color" id="scheme-text-color" value="${scheme.text || '#ffffff'}"></label>
    <button id="save-scheme-settings" data-index="${index}">Save Scheme</button>
    ${index >= defaultPreferences.colourSchemes.length ? `<button id="delete-scheme" data-index="${index}">Delete Scheme</button>` : ''}
     <div class="feedback-message" style="display: none;"></div></div>`;
contentContainer.removeEventListener('click', handleSchemeFormClick); contentContainer.addEventListener('click', handleSchemeFormClick);
}
function handleSchemeFormClick(e) {
  const target = e.target; const index = target.getAttribute('data-index'); const feedbackEl = this.querySelector('.feedback-message');
  if (target.id === 'save-scheme-settings' && index !== null) {
      const idx = parseInt(index, 10);
      preferences.colourSchemes[idx].name = this.querySelector("#scheme-name").value;
      preferences.colourSchemes[idx].background = this.querySelector("#scheme-bg-color").value;
      preferences.colourSchemes[idx].text = this.querySelector("#scheme-text-color").value;
      saveSettings(); renderColourSchemeTabs(); updateClock();
      const currentTabButton = document.querySelector(`#colour-scheme-tabs .colour-tab[data-index="${idx}"]`); if(currentTabButton){ document.querySelectorAll(".colour-tab").forEach(btn => btn.classList.remove("active")); currentTabButton.classList.add("active"); }
      showButtonFeedback(target, "Saved!");
  } else if (target.id === 'delete-scheme' && index !== null) {
      const idx = parseInt(index, 10); if (confirm(`Delete scheme "${preferences.colourSchemes[idx].name || `Scheme ${idx + 1}`}"? Periods using it will revert to Scheme 1.`)) { const deletedSchemeId = preferences.colourSchemes[idx].id; preferences.colourSchemes.splice(idx, 1); schedule.forEach(item => { if (item.colourSchemeId === deletedSchemeId) item.colourSchemeId = 1; }); saveSettings(); renderScheduleTable(); renderColourSchemeTabs(); updateClock(); }
  }
}

/**********************************
* Schedule Table (Schedule & Alerts Tab)
**********************************/
const scheduleTableBody = document.querySelector("#schedule-table tbody");
let selectedRowIndex = null;

function renderScheduleTable() { // Uses 🟢/🔴 icons
if (!scheduleTableBody) return; scheduleTableBody.innerHTML = "";
schedule.forEach((item, index) => {
  const tr = document.createElement("tr"); tr.dataset.index = index; tr.setAttribute("draggable", "true");
  const dragTd = document.createElement("td"); dragTd.innerHTML = "☰"; dragTd.className = "drag-handle"; tr.appendChild(dragTd);
  const labelTd = document.createElement("td"); const labelInput = document.createElement("input"); labelInput.type = "text"; labelInput.value = item.label || ""; labelInput.addEventListener("change", function() { schedule[index].label = this.value; saveSettings(); }); labelTd.appendChild(labelInput); tr.appendChild(labelTd);
  const startTd = document.createElement("td"); const startInput = document.createElement("input"); startInput.type = "time"; startInput.value = item.start || "00:00"; startInput.addEventListener("change", function() { schedule[index].start = this.value; saveSettings(); }); startTd.appendChild(startInput); tr.appendChild(startTd);
  const endTd = document.createElement("td"); const endInput = document.createElement("input"); endInput.type = "time"; endInput.value = item.end || "00:00"; endInput.addEventListener("change", function() { schedule[index].end = this.value; saveSettings(); }); endTd.appendChild(endInput); tr.appendChild(endTd);
  const schemeTd = document.createElement("td"); const swatch = document.createElement("div"); swatch.className = "scheme-swatch"; const scheme = preferences.colourSchemes.find(s => s.id === item.colourSchemeId) || preferences.colourSchemes[0]; swatch.style.backgroundColor = scheme ? scheme.background : '#ff00ff'; swatch.title = `Scheme: ${scheme ? scheme.name : 'Unknown'}. Click to cycle.`; swatch.addEventListener("click", (e) => { e.stopPropagation(); cycleSchemeForRow(index); }); schemeTd.appendChild(swatch); const schemeIdSpan = document.createElement('span'); schemeIdSpan.textContent = `(${item.colourSchemeId})`; schemeIdSpan.style.fontSize = '0.8em'; schemeIdSpan.style.marginLeft = '3px'; schemeTd.appendChild(schemeIdSpan); tr.appendChild(schemeTd);
  const alertTd = document.createElement("td"); const visualAlertBtn = document.createElement("button"); const isAlertEnabled = alertsSettings[index]?.colour?.enabled; visualAlertBtn.innerHTML = isAlertEnabled ? '🔴' : '🟢'; visualAlertBtn.title = `Visual Alert: ${isAlertEnabled ? 'Enabled' : 'Disabled'}. Click to edit.`; visualAlertBtn.className = "alert-edit-btn"; visualAlertBtn.addEventListener('click', (e) => { e.stopPropagation(); openAlertModal(index, 'colour'); }); alertTd.appendChild(visualAlertBtn); tr.appendChild(alertTd);
  tr.addEventListener("click", function(e) { if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON" || e.target.classList.contains('scheme-swatch')) return; const prevSelected = scheduleTableBody.querySelector("tr.selected"); if (prevSelected) prevSelected.classList.remove("selected"); tr.classList.add("selected"); selectedRowIndex = index; });
  tr.addEventListener("dragstart", dragStart); tr.addEventListener("dragover", dragOver); tr.addEventListener("dragleave", dragLeave); tr.addEventListener("drop", dragDrop); tr.addEventListener("dragend", dragEnd);
  scheduleTableBody.appendChild(tr);
});
}

function cycleSchemeForRow(index) { const currentSchemeId = schedule[index].colourSchemeId || 1; const currentSchemeIndex = preferences.colourSchemes.findIndex(s => s.id === currentSchemeId); let nextSchemeIndex = (currentSchemeIndex + 1) % preferences.colourSchemes.length; if (nextSchemeIndex < 0) nextSchemeIndex = 0; schedule[index].colourSchemeId = preferences.colourSchemes[nextSchemeIndex]?.id || 1; saveSettings(); renderScheduleTable(); updateClock(); }

// --- Schedule Drag/Drop Handlers (remain unchanged) ---
let dragStartIndex; function dragStart(e) { dragStartIndex = +this.dataset.index; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragStartIndex); this.classList.add('dragging'); } function dragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; this.classList.add('drag-over'); } function dragLeave(e) { this.classList.remove('drag-over'); } function dragDrop(e) { e.preventDefault(); const dragEndIndex = +this.dataset.index; this.classList.remove('drag-over'); if (dragStartIndex !== dragEndIndex) { const item = schedule.splice(dragStartIndex, 1)[0]; const alertItem = alertsSettings[dragStartIndex]; delete alertsSettings[dragStartIndex]; schedule.splice(dragEndIndex, 0, item); if (alertItem) { const newAlerts = {}; for(const key in alertsSettings) { const oldIdx = parseInt(key, 10); let newIdx = oldIdx; if (dragStartIndex < oldIdx && dragEndIndex >= oldIdx) newIdx--; else if (dragStartIndex > oldIdx && dragEndIndex <= oldIdx) newIdx++; newAlerts[newIdx] = alertsSettings[key]; } newAlerts[dragEndIndex] = alertItem; alertsSettings = newAlerts; } if (selectedRowIndex === dragStartIndex) { selectedRowIndex = dragEndIndex; } else if (selectedRowIndex !== null) { if (dragStartIndex < selectedRowIndex && dragEndIndex >= selectedRowIndex) selectedRowIndex--; else if (dragStartIndex > selectedRowIndex && dragEndIndex <= selectedRowIndex) selectedRowIndex++; } renderScheduleTable(); saveSettings(); } } function dragEnd(e) { this.classList.remove('dragging'); document.querySelectorAll('#schedule-table tbody tr').forEach(row => row.classList.remove('drag-over')); } scheduleTableBody.addEventListener('dragleave', function(e) { if (e.target.tagName === 'TR') e.target.classList.remove('drag-over'); });

// Add/Delete Schedule Rows (remain unchanged)
document.getElementById("add-schedule-row").addEventListener("click", () => { const newRow = { label: "New Period", start: "00:00", end: "00:00", colourSchemeId: 1 }; const insertIndex = (selectedRowIndex === null) ? schedule.length : selectedRowIndex + 1; schedule.splice(insertIndex, 0, newRow); const newAlerts = {}; for(const key in alertsSettings) { const oldIdx = parseInt(key, 10); newAlerts[oldIdx >= insertIndex ? oldIdx + 1 : oldIdx] = alertsSettings[key]; } alertsSettings = newAlerts; selectedRowIndex = insertIndex; renderScheduleTable(); saveSettings(); });
document.getElementById("delete-schedule-row").addEventListener("click", (e) => { if (selectedRowIndex !== null && selectedRowIndex >= 0 && selectedRowIndex < schedule.length) { if (confirm(`Delete row "${schedule[selectedRowIndex].label}"?`)) { schedule.splice(selectedRowIndex, 1); delete alertsSettings[selectedRowIndex]; const newAlerts = {}; for(const key in alertsSettings) { const oldIdx = parseInt(key, 10); newAlerts[oldIdx > selectedRowIndex ? oldIdx - 1 : oldIdx] = alertsSettings[key]; } alertsSettings = newAlerts; selectedRowIndex = null; renderScheduleTable(); saveSettings(); } } else { showButtonFeedback(e.target, "Select Row First!", 2000); } });

/**********************************
* Alert Modal Logic (Visual Only)
**********************************/
function openAlertModal(index, option = 'colour') { if (index === null || index < 0 || index >= schedule.length) return; const periodLabel = schedule[index].label || `Row ${index + 1}`; alertModalTitle.textContent = `Visual Alert Settings for "${periodLabel}"`; showAlertSettingsForm(index); alertModal.style.display = "block"; }
function closeAlertModal() { alertModal.style.display = "none"; alertModalBody.innerHTML = ""; }
alertModal.addEventListener('click', (event) => { if (event.target === alertModal || event.target === closeModalBtn) closeAlertModal(); }); closeModalBtn.addEventListener('click', closeAlertModal);

function showAlertSettingsForm(index) { // Updated duration handling & preview
  const currentPeriodAlerts = { colour: { ...preferences.defaultAlertSettings.colour, ...(alertsSettings[index]?.colour || {}) } };
  const settings = currentPeriodAlerts.colour;
  const durationInSeconds = (settings.durationMs || 1500) / 1000;

  const formHTML = `
      <div class="alert-settings-form">
      <label><input type="checkbox" id="alert-colour-enabled" ${settings.enabled ? "checked" : ""}> Enable Visual Alert</label><hr>
      <label>Flash Background Colour: <input type="color" id="alert-bg-color" value="${settings.background}" ${!settings.enabled ? 'disabled' : ''}></label>
      <label>Flash Text Colour: <input type="color" id="alert-label-color" value="${settings.text}" ${!settings.enabled ? 'disabled' : ''}></label>
      <label>Flash Duration (s): <input type="number" id="alert-flash-duration-sec" min="0.5" max="10" step="0.1" value="${durationInSeconds.toFixed(1)}" ${!settings.enabled ? 'disabled' : ''}></label>
      <label>Flash Interval (ms): <input type="number" id="alert-flash-interval" min="100" max="2000" step="50" value="${settings.intervalMs}" ${!settings.enabled ? 'disabled' : ''}></label>
      <div class="button-group">
          <button id="save-alert" data-index="${index}" data-option="colour">Save Visual Alert</button>
          <button id="preview-alert" data-option="colour" ${!settings.enabled ? 'disabled' : ''}>Preview Flash</button>
          <button id="remove-alert" data-index="${index}" data-option="colour" ${!settings.enabled ? 'disabled' : ''}>Disable Alert</button>
      </div>
      <div class="feedback-message" style="display: none;"></div></div>`;
  alertModalBody.innerHTML = formHTML;

  const form = alertModalBody.querySelector('.alert-settings-form');
  const enableCheckbox = form.querySelector('input[type="checkbox"]');
  const saveButton = form.querySelector('#save-alert');
  const previewButton = form.querySelector('#preview-alert');
  const removeButton = form.querySelector('#remove-alert');
  const feedbackEl = form.querySelector('.feedback-message');
  const inputs = form.querySelectorAll('input:not([type="checkbox"]), select');
  const toggleControls = (enabled) => { inputs.forEach(input => input.disabled = !enabled); if (previewButton) previewButton.disabled = !enabled; if (removeButton) removeButton.disabled = !enabled; if (removeButton) removeButton.textContent = enabled ? "Disable Alert" : "Enable Alert"; };
  if (enableCheckbox) { enableCheckbox.addEventListener('change', (e) => toggleControls(e.target.checked)); toggleControls(enableCheckbox.checked); }

  // Save Button - Convert seconds back to ms
  if (saveButton) {
      saveButton.addEventListener('click', () => {
          const idx = parseInt(saveButton.getAttribute('data-index'), 10);
          if (!alertsSettings[idx]) alertsSettings[idx] = {};
          let savedData = {}; savedData.enabled = enableCheckbox.checked; savedData.background = form.querySelector("#alert-bg-color").value; savedData.text = form.querySelector("#alert-label-color").value;
          const durationSec = parseFloat(form.querySelector("#alert-flash-duration-sec").value) || (preferences.defaultAlertSettings.colour.durationMs / 1000); savedData.durationMs = Math.round(durationSec * 1000);
          savedData.intervalMs = parseInt(form.querySelector("#alert-flash-interval").value, 10) || preferences.defaultAlertSettings.colour.intervalMs; alertsSettings[idx].colour = savedData;
          if (!alertsSettings[idx].colour?.enabled) { delete alertsSettings[idx]; }
          saveSettings(); renderScheduleTable(); showButtonFeedback(saveButton, "Saved!"); setTimeout(closeAlertModal, 1600);
      });
  }
  // Preview Button - Don't close modal
  if (previewButton) {
      previewButton.addEventListener('click', () => {
          const durationSec = parseFloat(form.querySelector("#alert-flash-duration-sec").value);
           let previewSettings = { enabled: true, background: form.querySelector("#alert-bg-color").value, text: form.querySelector("#alert-label-color").value, durationMs: Math.round(durationSec * 1000), intervalMs: parseInt(form.querySelector("#alert-flash-interval").value, 10) };
           triggerVisualAlert(previewSettings); showFeedback(feedbackEl, `Previewing flash...`, true);
      });
  }
   // Remove/Disable Button
   if (removeButton) { removeButton.addEventListener('click', () => { const idx = parseInt(removeButton.getAttribute('data-index'), 10); const isCurrentlyEnabled = enableCheckbox.checked; if (alertsSettings[idx]?.colour) { const actionText = isCurrentlyEnabled ? "disable" : "enable"; if (confirm(`Are you sure you want to ${actionText} the visual alert for this period?`)) { alertsSettings[idx].colour.enabled = !isCurrentlyEnabled; if (!alertsSettings[idx].colour.enabled) { delete alertsSettings[idx]; } saveSettings(); renderScheduleTable(); closeAlertModal(); } } else { enableCheckbox.checked = !isCurrentlyEnabled; toggleControls(!isCurrentlyEnabled); showFeedback(feedbackEl, `Alert ${!isCurrentlyEnabled ? 'enabled' : 'disabled'}. Click Save to confirm.`, true); } }); }
}


/**********************************
* Time Sync Functionality
**********************************/
function setupTimeSyncListeners() { // Added reset button listener
  const syncButton = document.getElementById("sync-to-bell");
  const minDown = document.getElementById("offset-min-down");
  const minUp = document.getElementById("offset-min-up");
  const secDown = document.getElementById("offset-sec-down");
  const secUp = document.getElementById("offset-sec-up");
  const resetButton = document.getElementById("reset-offset");
  if (syncButton) syncButton.addEventListener("click", syncToNearestBell);
  if (resetButton) resetButton.addEventListener("click", resetOffset);
  const addManualOffsetListener = (element, changeMs) => { if (element) element.addEventListener("click", () => adjustOffset(changeMs)); };
  addManualOffsetListener(minDown, -60000); addManualOffsetListener(minUp, 60000);
  addManualOffsetListener(secDown, -1000); addManualOffsetListener(secUp, 1000);
}
function adjustOffset(changeMs) { preferences.timeOffsetMs = (Number(preferences.timeOffsetMs) || 0) + changeMs; updateOffsetDisplay(); updateClock(); saveSettings(); }
function resetOffset() { if (preferences.timeOffsetMs !== 0) { preferences.timeOffsetMs = 0; updateOffsetDisplay(); updateClock(); saveSettings(); showButtonFeedback(document.getElementById("reset-offset"), "Offset Reset!", 1500); } else { showButtonFeedback(document.getElementById("reset-offset"), "Already Zero!", 1000); } }
function syncToNearestBell() { const syncBtn = document.getElementById("sync-to-bell"); if (!schedule || schedule.length === 0) { showButtonFeedback(syncBtn, "Add Schedule First!", 2000); return; } const systemNow = new Date(); const systemNowMs = systemNow.getTime(); let minDiff = Infinity; let nearestEventTime = null; let nearestEventType = null; schedule.forEach(period => { try { if (!period.start || !period.end || !/^\d{2}:\d{2}$/.test(period.start) || !/^\d{2}:\d{2}$/.test(period.end)) return; const startTime = getTodayTime(period.start); const endTime = getTodayTime(period.end); const startTimeMs = startTime.getTime(); const endTimeMs = endTime.getTime(); let diffStart = Math.abs(startTimeMs - systemNowMs); if (diffStart < minDiff) { minDiff = diffStart; nearestEventTime = startTime; nearestEventType = 'start'; } let diffEnd = Math.abs(endTimeMs - systemNowMs); if (diffEnd < minDiff) { minDiff = diffEnd; nearestEventTime = endTime; nearestEventType = 'end'; } } catch (e) { console.error("Sync error parsing time:", e); } }); if (nearestEventTime !== null) { const requiredOffsetMs = nearestEventTime.getTime() - systemNowMs; preferences.timeOffsetMs = requiredOffsetMs; updateOffsetDisplay(); updateClock(); saveSettings(); showButtonFeedback(syncBtn, "Synced!"); } else { showButtonFeedback(syncBtn, "No Valid Times!", 2000); } }

/**********************************
* Tabs Functionality
**********************************/
const tabButtons = document.querySelectorAll("#tabs .tab-button"); const tabContents = document.querySelectorAll("#tab-contents .tab-content"); tabButtons.forEach(button => { button.addEventListener("click", () => { tabButtons.forEach(btn => btn.classList.remove("active")); tabContents.forEach(content => content.classList.remove("active")); button.classList.add("active"); const tabId = button.getAttribute("data-tab"); const targetContent = document.getElementById(tabId); if (targetContent) targetContent.classList.add("active"); }); });

/**********************************
* Initialization
**********************************/
document.addEventListener('DOMContentLoaded', () => { loadSettings(); setupTimeSyncListeners(); console.log("Classroom Clock Initialized vFinal+"); });
