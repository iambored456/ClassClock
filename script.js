/**********************************
 * Clock & Schedule Functionality
 **********************************/
// Default schedule
let schedule = [
  { label: "Before", start: "00:00", end: "08:50", colourSchemeId: 1, showCircles: false },
  { label: "Period 1", start: "08:50", end: "10:05", colourSchemeId: 1, showCircles: true },
  { label: "Break", start: "10:05", end: "10:15", colourSchemeId: 2, showCircles: false },
  { label: "Period 2", start: "10:15", end: "11:30", colourSchemeId: 1, showCircles: true },
  { label: "Lunch", start: "11:30", end: "12:20", colourSchemeId: 2, showCircles: false },
  { label: "Period 3", start: "12:20", end: "13:35", colourSchemeId: 1, showCircles: true },
  { label: "Break", start: "13:35", end: "13:45", colourSchemeId: 2, showCircles: false },
  { label: "Period 4", start: "13:45", end: "15:00", colourSchemeId: 1, showCircles: true },
  { label: "After", start: "15:00", end: "23:59", colourSchemeId: 1, showCircles: false }
];

// Default preferences - Removed sand bar preferences
const defaultPreferences = {
  fontFamily: "Atkinson Hyperlegible",
  dateFontSize: 64,
  timeFontSize: 200,
  scheduleLabelFontSize: 48,
  timeLeftFontSize: 40,
  progressBarHeight: 120,
  timeOffsetMs: 0,
  // Display Element Toggles
  showDate: true,
  showTime: true,
  showScheduleLabel: true,
  showProgressBar: true, // Standard progress bar
  showScheduleCircles: false,
  // showSandBars: false, // REMOVED
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
let currentPeriodIndex = null; // Keep track of the period index
let activeVisualAlertInterval = null;
let activeVisualAlertTimeout = null;
let originalBodyStyles = {};
// sandBarState REMOVED

// --- DOM Elements Cache ---
const clockDisplayArea = document.getElementById("clock-display-area");
const timeEl = document.getElementById("time");
const dateEl = document.getElementById("date");
const scheduleCirclesDisplayEl = document.getElementById("schedule-circles-display");
const periodContainerEl = document.getElementById("period-container");
const periodLabelEl = document.getElementById("period-label");
const progressBarEl = document.getElementById("progress-bar");
const progressEl = document.getElementById("progress");
const timeLeftEl = document.getElementById("time-left");
// sandBarsContainerEl REMOVED
const alertModal = document.getElementById('alert-modal');
const alertModalTitle = document.getElementById('modal-title');
const alertModalBody = document.getElementById('modal-body');
const closeModalBtn = alertModal.querySelector('.close-modal-btn');
const menuToggle = document.getElementById("menu-toggle");
const settingsMenu = document.getElementById("settings-menu");


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
  let foundScheme = preferences.colourSchemes.find(s => s.id === schemeId);
  if (!foundScheme) foundScheme = preferences.colourSchemes.find(s => s.id === 1);
  if (!foundScheme) foundScheme = preferences.colourSchemes[0];
  return foundScheme || { id: 0, name: "Error", background: "#ff00ff", text: "#000000" };
}

// Determine the current period
function getCurrentPeriod(now) {
  for (let i = 0; i < schedule.length; i++) {
    const period = schedule[i];
    try {
        const startTime = getTodayTime(period.start); const endTime = getTodayTime(period.end);
        let adjustedEndTime = new Date(endTime.getTime()); let isOvernight = false;
        if (endTime.getTime() <= startTime.getTime()) {
             isOvernight = true;
             if (endTime.getHours() === 0 && endTime.getMinutes() === 0 && endTime.getSeconds() === 0) {
                  adjustedEndTime = getTodayTime(period.start);
                  adjustedEndTime.setHours(24, 0, 0, 0);
             } else {
                  adjustedEndTime.setDate(adjustedEndTime.getDate() + 1);
             }
        }
        let isActive = false;
        if (isOvernight) {
             const midnightAfterStart = new Date(startTime);
             midnightAfterStart.setHours(24, 0, 0, 0);
             if ((now >= startTime && now < midnightAfterStart) || (now >= getTodayTime("00:00") && now < adjustedEndTime)) {
                 isActive = true;
             }
        } else {
            if (now >= startTime && now < adjustedEndTime) {
                 isActive = true;
            }
        }
        if (!isActive && (period.end === "23:59" || period.end === "23:59:59")) {
            const endOfDay = new Date(now);
            endOfDay.setHours(23, 59, 59, 999);
             if (now >= startTime && now <= endOfDay) {
                  isActive = true;
                  adjustedEndTime = endOfDay;
             }
        }
        if (isActive) {
             return { label: period.label, start: startTime, end: adjustedEndTime, index: i };
        }
    } catch (e) { console.error("Error processing period:", period.label, period.start, period.end, e); }
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

// --- Layout Update Function ---
function updateLayout() {
    // Toggle main elements based on preferences
    dateEl.classList.toggle('element-hidden', !preferences.showDate);
    scheduleCirclesDisplayEl.classList.toggle('element-hidden', !preferences.showScheduleCircles);
    timeEl.classList.toggle('element-hidden', !preferences.showTime);

    // Toggle period container (holds label and progress bar)
    const showPeriodInfo = preferences.showScheduleLabel || preferences.showProgressBar; // Removed sandbar check
    periodContainerEl.classList.toggle('element-hidden', !showPeriodInfo);

    // If period container is visible, toggle label and progress bar
    if (showPeriodInfo) {
        periodLabelEl.classList.toggle('element-hidden', !preferences.showScheduleLabel);
        progressBarEl.classList.toggle('element-hidden', !preferences.showProgressBar);
    } else {
        // Explicitly hide children if container is hidden
        periodLabelEl.classList.add('element-hidden');
        progressBarEl.classList.add('element-hidden');
    }

    // Apply font sizes dynamically
    applyFontAndSizePreferences();
}


// --- Schedule Circles Rendering ---
function renderScheduleCircles() {
    if (!preferences.showScheduleCircles || !scheduleCirclesDisplayEl) {
        if(scheduleCirclesDisplayEl) scheduleCirclesDisplayEl.innerHTML = '';
        return;
    }
    const now = getCurrentOffsetTime();
    const currentPeriodInfo = getCurrentPeriod(now);
    const activeScheme = getActiveColourScheme();
    const circlePeriods = schedule.map((item, index) => ({ ...item, originalIndex: index }))
                                .filter(item => item.showCircles);
    if (circlePeriods.length === 0) {
        scheduleCirclesDisplayEl.innerHTML = ''; return;
    }
    let currentCircleIndex = -1;
    if (currentPeriodInfo) {
        currentCircleIndex = circlePeriods.findIndex(p => p.originalIndex === currentPeriodInfo.index);
    }
    let html = '';
    const totalCircles = circlePeriods.length;
    for (let i = 0; i < totalCircles; i++) {
        let symbol = currentCircleIndex >= i ? '●' : '○';
        let cssClass = `schedule-circle-symbol ${currentCircleIndex >= i ? 'active' : 'inactive'}`;
        let color = cssClass.includes('active') ? activeScheme.text : '#555';
        html += `<span class="${cssClass}" style="color: ${color};">${symbol}</span>`;
    }
    scheduleCirclesDisplayEl.innerHTML = html;
}

// --- Sand Bars Functions REMOVED ---
// setupSandBars, updateSandBars, createSandParticle, lightenColor

// --- Alert Triggering Functions ---
function triggerVisualAlert(settings) {
  clearTimeout(activeVisualAlertTimeout); clearInterval(activeVisualAlertInterval); restoreOriginalStyles();
  const { background: alertBg, text: alertText, durationMs, intervalMs } = settings;
  const activeScheme = getActiveColourScheme();
  originalBodyStyles = {
      background: document.body.style.backgroundColor,
      color: document.body.style.color,
      timeColor: timeEl.style.color,
      dateColor: dateEl.style.color,
      labelColor: periodLabelEl.style.color,
      progressColor: progressEl.style.backgroundColor,
      timeLeftColor: timeLeftEl.style.color,
      scheduleCircleColor: scheduleCirclesDisplayEl ? scheduleCirclesDisplayEl.style.color : '',
  };
  let isAlertState = false;
  const toggleColors = () => {
      isAlertState = !isAlertState;
      const currentBg = isAlertState ? alertBg : activeScheme.background;
      const currentText = isAlertState ? alertText : activeScheme.text;
      document.body.style.backgroundColor = currentBg;
      document.body.style.color = currentText;
      if (timeEl && preferences.showTime) timeEl.style.color = currentText;
      if (dateEl && preferences.showDate) dateEl.style.color = currentText;
      if (periodLabelEl && preferences.showScheduleLabel) periodLabelEl.style.color = currentText;
      if (progressEl && preferences.showProgressBar) progressEl.style.backgroundColor = currentText; // Simplified
      if (timeLeftEl && preferences.showProgressBar) timeLeftEl.style.color = currentText; // Simplified
      if (scheduleCirclesDisplayEl && preferences.showScheduleCircles) {
           scheduleCirclesDisplayEl.querySelectorAll('.schedule-circle-symbol.active').forEach(span => span.style.color = currentText);
      }
  };
  toggleColors();
  activeVisualAlertInterval = setInterval(toggleColors, intervalMs);
  activeVisualAlertTimeout = setTimeout(() => {
      clearInterval(activeVisualAlertInterval); activeVisualAlertInterval = null; activeVisualAlertTimeout = null;
      restoreOriginalStyles(activeScheme);
  }, durationMs);
}

function restoreOriginalStyles(schemeToRestoreTo = null) {
  const scheme = schemeToRestoreTo || getActiveColourScheme();
  document.body.style.backgroundColor = scheme.background;
  document.body.style.color = scheme.text;
  if (timeEl && preferences.showTime) timeEl.style.color = scheme.text;
  if (dateEl && preferences.showDate) dateEl.style.color = scheme.text;
  if (periodLabelEl && preferences.showScheduleLabel) periodLabelEl.style.color = scheme.text;
  if (progressEl && preferences.showProgressBar) progressEl.style.backgroundColor = scheme.text; // Simplified
  if (timeLeftEl && preferences.showProgressBar) timeLeftEl.style.color = scheme.text; // Simplified
  if (scheduleCirclesDisplayEl && preferences.showScheduleCircles) {
       renderScheduleCircles();
  }
}


// --- Main Clock Update Loop ---
function updateClock() {
  const now = getCurrentOffsetTime();
  const activeScheme = getActiveColourScheme();

  updateLayout(); // Apply layout first

  if (!activeVisualAlertInterval) {
       restoreOriginalStyles(activeScheme); // Restore colors if no alert
  }

  if (preferences.showTime && timeEl) timeEl.textContent = formatTime(now);
  if (preferences.showDate && dateEl) dateEl.textContent = formatDate(now);
  if (preferences.showScheduleCircles && scheduleCirclesDisplayEl) {
      renderScheduleCircles();
  }

  const periodInfo = getCurrentPeriod(now);
  const newPeriodIndex = periodInfo ? periodInfo.index : null;

  // --- Period Change Detection ---
  if (newPeriodIndex !== currentPeriodIndex) {
      console.log("Period changed to:", periodInfo ? periodInfo.label : 'None', "(Index:", newPeriodIndex, ")");
      currentPeriodLabel = periodInfo ? periodInfo.label : null;
      currentPeriodIndex = newPeriodIndex;

      // Trigger alert if needed
      if (periodInfo && periodInfo.index !== undefined) {
          const alertSetting = alertsSettings[periodInfo.index];
          if (alertSetting?.colour?.enabled) {
              triggerVisualAlert(alertSetting.colour);
          }
      } else {
          // Clear alert if entering gap
          clearTimeout(activeVisualAlertTimeout); clearInterval(activeVisualAlertInterval);
          restoreOriginalStyles();
      }
      // Sand bar reset REMOVED
  }

  // Update Period Label, Progress Bar, Time Left
  if (periodInfo) {
       if (preferences.showScheduleLabel && periodLabelEl) periodLabelEl.textContent = periodInfo.label;

      // --- Standard Progress Bar Logic ---
      if (preferences.showProgressBar && progressBarEl && progressEl && timeLeftEl) {
          const periodStartMs = periodInfo.start.getTime();
          const periodEndMs = periodInfo.end.getTime();
          const nowMs = now.getTime();
          const periodDuration = periodEndMs - periodStartMs;
          const timeElapsed = Math.max(0, nowMs - periodStartMs);

          if (periodDuration > 0) {
              let progressPercent = Math.min(Math.max((timeElapsed / periodDuration) * 100, 0), 100);
              progressEl.style.width = progressPercent + "%";
              const progressBarWidth = progressBarEl.offsetWidth;
              let desiredLeft = (progressPercent / 100) * progressBarWidth;
              const timeLeftWidth = timeLeftEl.offsetWidth || 60;
              let finalLeft = desiredLeft - (timeLeftWidth / 2);
              finalLeft = Math.max(0, Math.min(progressBarWidth - timeLeftWidth, finalLeft));
              timeLeftEl.style.left = finalLeft + "px";
              const timeLeftMs = periodEndMs - nowMs;
              const timeLeftSec = Math.max(0, Math.floor(timeLeftMs / 1000));
              const minutes = Math.floor(timeLeftSec / 60);
              const seconds = timeLeftSec % 60;
              timeLeftEl.textContent = `${minutes}:${seconds < 10 ? "0" + seconds : seconds}`;
          } else {
              progressEl.style.width = (nowMs >= periodStartMs) ? "100%" : "0%";
              timeLeftEl.textContent = "0:00";
              timeLeftEl.style.left = (progressBarEl.offsetWidth - (timeLeftEl.offsetWidth || 60)) + "px";
          }
      }
      // --- Sand Bars Logic REMOVED ---

  } else {
       // No active period
       if (preferences.showScheduleLabel && periodLabelEl) periodLabelEl.textContent = "";
       if (preferences.showProgressBar && progressEl) progressEl.style.width = "0%";
       if (preferences.showProgressBar && timeLeftEl) timeLeftEl.textContent = "";
       // Sand bar clear logic REMOVED
  }
}

// Apply only font/size preferences
function applyFontAndSizePreferences() {
   if (preferences.showDate && dateEl) dateEl.style.fontSize = preferences.dateFontSize + "px";
   if (preferences.showTime && timeEl) timeEl.style.fontSize = preferences.timeFontSize + "px";
   if (preferences.showScheduleLabel && periodLabelEl) periodLabelEl.style.fontSize = preferences.scheduleLabelFontSize + "px";
   if (preferences.showProgressBar && timeLeftEl) timeLeftEl.style.fontSize = preferences.timeLeftFontSize + "px"; // Simplified
   if (preferences.showProgressBar && progressBarEl) progressBarEl.style.height = preferences.progressBarHeight + "px"; // Simplified
   document.body.style.fontFamily = preferences.fontFamily;
   if (preferences.showScheduleCircles && scheduleCirclesDisplayEl) {
        const activeScheme = getActiveColourScheme();
        scheduleCirclesDisplayEl.querySelectorAll('.schedule-circle-symbol.active').forEach(span => span.style.color = activeScheme.text);
        scheduleCirclesDisplayEl.querySelectorAll('.schedule-circle-symbol.inactive').forEach(span => span.style.color = '#555');
   }
}

setInterval(updateClock, 1000);

/**********************************
* Settings Menu Functionality
**********************************/
// Menu Toggle
menuToggle.addEventListener("click", () => { settingsMenu.classList.toggle("open"); menuToggle.innerHTML = settingsMenu.classList.contains("open") ? "▲" : "▼"; });
// Draggable resizer
const menuResizer = document.getElementById("menu-resizer"); let isResizing = false;
menuResizer.addEventListener("mousedown", function(e) { isResizing = true; document.body.style.cursor = "ew-resize"; });
document.addEventListener("mousemove", function(e) { if (!isResizing) return; const newWidth = window.innerWidth - e.clientX; const minWidth = 400; const maxWidth = Math.min(900, window.innerWidth - 50); if (newWidth >= minWidth && newWidth <= maxWidth) settingsMenu.style.width = newWidth + "px"; });
document.addEventListener("mouseup", function(e) { if (isResizing) { isResizing = false; document.body.style.cursor = "default"; } });

// --- Feedback Message Helpers ---
function showFeedback(element, message, isSuccess = true) { element.textContent = message; element.classList.remove('success', 'error'); element.classList.add(isSuccess ? 'success' : 'error'); element.style.display = 'block'; setTimeout(() => { if (element) element.style.display = 'none'; }, 3000); }
function showButtonFeedback(button, message = "Saved!", duration = 1500) { const originalText = button.textContent; button.textContent = message; button.classList.add('button-success'); button.disabled = true; setTimeout(() => { if (button) { button.textContent = originalText; button.classList.remove('button-success'); button.disabled = false; } }, duration); } // Added check if button exists

// --- LocalStorage Helpers ---
function loadSettings() {
    // Load Schedule
    const savedSchedule = localStorage.getItem("clockSchedule");
    if (savedSchedule) {
        try {
            const parsedSchedule = JSON.parse(savedSchedule);
            if (Array.isArray(parsedSchedule)) {
                schedule = parsedSchedule.map(item => ({
                    label: item.label || "Unnamed", start: item.start || "00:00", end: item.end || "00:00",
                    colourSchemeId: item.colourSchemeId || 1,
                    showCircles: typeof item.showCircles === 'boolean' ? item.showCircles : false
                }));
            }
        } catch (e) { console.error("Error parsing saved schedule.", e); }
    } else {
         schedule = schedule.map(item => ({ ...item, showCircles: typeof item.showCircles === 'boolean' ? item.showCircles : false }));
    }

    // Load Preferences
    const savedPrefs = localStorage.getItem("clockPreferences");
    if (savedPrefs) {
        try {
            const loadedPreferences = JSON.parse(savedPrefs);
            if (typeof loadedPreferences === 'object' && loadedPreferences !== null) {
                 preferences = {
                      ...JSON.parse(JSON.stringify(defaultPreferences)),
                      ...loadedPreferences,
                      defaultAlertSettings: { colour: { ...defaultPreferences.defaultAlertSettings.colour, ...(loadedPreferences.defaultAlertSettings?.colour || {}) } },
                      colourSchemes: (loadedPreferences.colourSchemes && Array.isArray(loadedPreferences.colourSchemes) && loadedPreferences.colourSchemes.length > 0
                          ? loadedPreferences.colourSchemes.map(s => ({ id: s.id || Date.now(), name: s.name || "Unnamed Scheme", background: s.background || "#000000", text: s.text || "#FFFFFF" }))
                          : [...defaultPreferences.colourSchemes]
                      )
                 };
                 // Type check preferences
                 preferences.showDate = typeof preferences.showDate === 'boolean' ? preferences.showDate : defaultPreferences.showDate;
                 preferences.showTime = typeof preferences.showTime === 'boolean' ? preferences.showTime : defaultPreferences.showTime;
                 preferences.showScheduleLabel = typeof preferences.showScheduleLabel === 'boolean' ? preferences.showScheduleLabel : defaultPreferences.showScheduleLabel;
                 preferences.showProgressBar = typeof preferences.showProgressBar === 'boolean' ? preferences.showProgressBar : defaultPreferences.showProgressBar;
                 preferences.showScheduleCircles = typeof preferences.showScheduleCircles === 'boolean' ? preferences.showScheduleCircles : defaultPreferences.showScheduleCircles;
                 // Sand bar preference loading REMOVED
                 delete preferences.showSandBars; // Remove if loaded from old storage
                 delete preferences.sandWidth;
                 delete preferences.sandHeight;
                 delete preferences.sandParticleSize;
                 delete preferences.backgroundColor;
                 preferences.colourSchemes.forEach(s => { delete s.accent; });
                 if (preferences.defaultAlertSettings.noise) delete preferences.defaultAlertSettings.noise;

            } else { preferences = JSON.parse(JSON.stringify(defaultPreferences)); }
        } catch (e) { console.error("Error parsing saved preferences.", e); preferences = JSON.parse(JSON.stringify(defaultPreferences)); }
    } else { preferences = JSON.parse(JSON.stringify(defaultPreferences)); }

    // Load Alerts
    const savedAlerts = localStorage.getItem("clockAlerts");
    if (savedAlerts) {
        try {
            alertsSettings = JSON.parse(savedAlerts) || {};
            if (typeof alertsSettings !== 'object' || alertsSettings === null) alertsSettings = {};
            Object.keys(alertsSettings).forEach(key => {
                if (alertsSettings[key]?.noise) delete alertsSettings[key].noise;
                if (alertsSettings[key] && typeof alertsSettings[key] === 'object' && Object.keys(alertsSettings[key]).length === 0) {
                    delete alertsSettings[key];
                }
            });
        } catch (e) { console.error("Error parsing saved alerts settings.", e); alertsSettings = {}; }
    }

    // Ensure numeric types
    preferences.timeOffsetMs = Number(preferences.timeOffsetMs) || 0;
    preferences.dateFontSize = Number(preferences.dateFontSize) || defaultPreferences.dateFontSize;
    preferences.timeFontSize = Number(preferences.timeFontSize) || defaultPreferences.timeFontSize;
    preferences.scheduleLabelFontSize = Number(preferences.scheduleLabelFontSize) || defaultPreferences.scheduleLabelFontSize;
    preferences.timeLeftFontSize = Number(preferences.timeLeftFontSize) || defaultPreferences.timeLeftFontSize;
    preferences.progressBarHeight = Number(preferences.progressBarHeight) || defaultPreferences.progressBarHeight;

    // --- Ensure showProgressBar is true if loaded settings might have disabled it ---
    if (!preferences.hasOwnProperty('showProgressBar')) {
        preferences.showProgressBar = true; // Explicitly enable if key missing
    }


    updatePreferenceInputs();
    renderScheduleTable();
    renderColourSchemeTabs();
    updateOffsetDisplay();
    updateLayout();
    updateClock(); // Start clock after settings are loaded
}

function saveSettings() {
    Object.keys(alertsSettings).forEach(key => {
        if (alertsSettings[key] && typeof alertsSettings[key] === 'object' && Object.keys(alertsSettings[key]).length === 0) {
             delete alertsSettings[key];
        }
    });
    const scheduleToSave = schedule.map(item => ({
         label: item.label, start: item.start, end: item.end,
         colourSchemeId: item.colourSchemeId, showCircles: item.showCircles
    }));
    // Ensure sand bar prefs are definitely not saved
    const prefsToSave = { ...preferences };
    delete prefsToSave.showSandBars;
    delete prefsToSave.sandWidth;
    delete prefsToSave.sandHeight;
    delete prefsToSave.sandParticleSize;

    localStorage.setItem("clockSchedule", JSON.stringify(scheduleToSave));
    localStorage.setItem("clockPreferences", JSON.stringify(prefsToSave));
    localStorage.setItem("clockAlerts", JSON.stringify(alertsSettings));
    // console.log("Settings saved."); // Less console noise
}

// Update Appearance tab inputs
function updatePreferenceInputs() {
  document.getElementById("pref-font").value = preferences.fontFamily;
  document.getElementById("pref-date-font").value = preferences.dateFontSize;
  document.getElementById("pref-time-font").value = preferences.timeFontSize;
  document.getElementById("pref-schedule-label-font").value = preferences.scheduleLabelFontSize;
  document.getElementById("pref-time-left-font").value = preferences.timeLeftFontSize;
  document.getElementById("pref-progress-height").value = preferences.progressBarHeight;
  document.getElementById("pref-show-date").checked = preferences.showDate;
  document.getElementById("pref-show-time").checked = preferences.showTime;
  document.getElementById("pref-show-schedule-label").checked = preferences.showScheduleLabel;
  document.getElementById("pref-show-progress-bar").checked = preferences.showProgressBar;
  document.getElementById("pref-show-schedule-circles").checked = preferences.showScheduleCircles;
  // Sand bar checkbox update REMOVED
}

// --- Preference Input Listeners (Appearance Tab) ---
function attachPreferenceListeners() {
    document.getElementById("pref-font").addEventListener("input", function() { preferences.fontFamily = this.value; applyFontAndSizePreferences(); saveSettings(); });

    document.querySelectorAll('.number-input-wrapper').forEach(wrapper => {
        const input = wrapper.querySelector('input[type="number"]');
        const minusBtn = wrapper.querySelector('.num-btn.minus');
        const plusBtn = wrapper.querySelector('.num-btn.plus');
        if (!input || !input.id || !minusBtn || !plusBtn) { // Simplified check
            return;
        }
        // Sand bar number inputs will be gone from HTML, so no listeners needed

        const prefKey = input.id.replace('pref-', '').replace(/-/g, '');
        let intervalId = null, timeoutId = null;
        const HOLD_DELAY = 500, HOLD_INTERVAL = 100;

        const updatePreference = (newValue) => {
            const keyMap = { datefont: 'dateFontSize', timefont: 'timeFontSize', schedulelabelfont: 'scheduleLabelFontSize', timeleftfont: 'timeLeftFontSize', progressheight: 'progressBarHeight' };
            const prefName = keyMap[prefKey];
            if (prefName) {
                const step = parseInt(input.step) || 1;
                const min = input.min ? parseInt(input.min, 10) : -Infinity;
                const max = input.max ? parseInt(input.max, 10) : Infinity;
                let parsedValue = parseInt(newValue, 10);
                parsedValue = isNaN(parsedValue) ? defaultPreferences[prefName] : Math.max(min, Math.min(max, parsedValue));
                preferences[prefName] = parsedValue;
                input.value = parsedValue;
                applyFontAndSizePreferences();
                saveSettings();
            }
            // Removed warning for non-mapped keys
        };
        const startRepeating = (step) => { updatePreference(parseInt(input.value, 10) + step); stopRepeating(); timeoutId = setTimeout(() => { intervalId = setInterval(() => { updatePreference(parseInt(input.value, 10) + step); }, HOLD_INTERVAL); }, HOLD_DELAY); };
        const stopRepeating = () => { clearTimeout(timeoutId); clearInterval(intervalId); timeoutId = intervalId = null; };
        input.addEventListener("change", () => updatePreference(input.value));
        minusBtn.addEventListener("mousedown", () => startRepeating(-(parseInt(input.step) || 1)));
        plusBtn.addEventListener("mousedown", () => startRepeating(parseInt(input.step) || 1));
        const stopEvents = ["mouseup", "mouseleave", "blur", "touchend", "touchcancel"];
        stopEvents.forEach(event => { minusBtn.addEventListener(event, stopRepeating); plusBtn.addEventListener(event, stopRepeating); });
    });

    // Display Element Checkbox Listeners
    document.querySelectorAll('#display-elements-checklist input[type="checkbox"]').forEach(checkbox => {
         checkbox.addEventListener('change', function() {
             const prefName = this.dataset.pref;
             // Only process if prefName exists and is a valid preference key
             if (prefName && preferences.hasOwnProperty(prefName)) {
                 preferences[prefName] = this.checked;
                 // Mutual exclusivity logic REMOVED
                 updateLayout();
                 // Sand bar setup logic REMOVED
                 saveSettings();
             }
         });
    });

    // Reset Buttons
    const resetAppearanceBtn = document.getElementById('reset-appearance-defaults'); if (resetAppearanceBtn) { resetAppearanceBtn.addEventListener('click', () => { if (confirm("Reset Font & Size settings to defaults?")) { preferences.fontFamily = defaultPreferences.fontFamily; preferences.dateFontSize = defaultPreferences.dateFontSize; preferences.timeFontSize = defaultPreferences.timeFontSize; preferences.scheduleLabelFontSize = defaultPreferences.scheduleLabelFontSize; preferences.timeLeftFontSize = defaultPreferences.timeLeftFontSize; preferences.progressBarHeight = defaultPreferences.progressBarHeight; updatePreferenceInputs(); applyFontAndSizePreferences(); saveSettings(); showButtonFeedback(resetAppearanceBtn, "Reset!"); } }); }
    const resetSchemesBtn = document.getElementById('reset-schemes-defaults'); if (resetSchemesBtn) { resetSchemesBtn.addEventListener('click', () => { if (confirm("Reset ALL Colour Schemes to the defaults? This cannot be undone.")) { preferences.colourSchemes = JSON.parse(JSON.stringify(defaultPreferences.colourSchemes)); schedule.forEach(item => item.colourSchemeId = 1); renderScheduleTable(); renderColourSchemeTabs(); updateLayout(); updateClock(); saveSettings(); showButtonFeedback(resetSchemesBtn, "Reset!"); } }); }
    // Sand bar reset button listener is now irrelevant as the button is removed
}
attachPreferenceListeners(); // Call the function

// --- Colour Scheme Management ---
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
const canDelete = preferences.colourSchemes.length > 1 && scheme.id !== 1 && scheme.id !== 2; // Simplified delete check
contentContainer.innerHTML = `
  <div class="colour-scheme-form">
    <label>Scheme Name: <input type="text" id="scheme-name" value="${scheme.name || ''}"></label>
    <label>Background Colour: <input type="color" id="scheme-bg-color" value="${scheme.background || '#000000'}"></label>
    <label>Main Text Colour (Date, Time, Label, Progress, Active Circles): <input type="color" id="scheme-text-color" value="${scheme.text || '#ffffff'}"></label>
    <button id="save-scheme-settings" data-index="${index}">Save Scheme</button>
    ${canDelete ? `<button id="delete-scheme" data-index="${index}">Delete Scheme</button>` : ''}
     <div class="feedback-message" style="display: none;"></div></div>`;
contentContainer.removeEventListener('input', handleSchemeFormInput);
contentContainer.addEventListener('input', handleSchemeFormInput);
contentContainer.removeEventListener('click', handleSchemeFormClick);
contentContainer.addEventListener('click', handleSchemeFormClick);
// Disable delete button explicitly if needed (though removing it is cleaner)
const deleteBtn = contentContainer.querySelector('#delete-scheme');
if (deleteBtn && !canDelete) {
    deleteBtn.disabled = true;
    deleteBtn.title = "Cannot delete default schemes or the last remaining scheme";
}
}
function handleSchemeFormInput(e) {
    const target = e.target; const form = target.closest('.colour-scheme-form'); const saveButton = form?.querySelector('#save-scheme-settings'); if (!saveButton) return; const index = saveButton.getAttribute('data-index');
    if (index !== null && (target.id === 'scheme-name' || target.id === 'scheme-bg-color' || target.id === 'scheme-text-color')) {
        const idx = parseInt(index, 10);
        if (idx >= 0 && idx < preferences.colourSchemes.length) {
            if (target.id === 'scheme-name') preferences.colourSchemes[idx].name = target.value;
            if (target.id === 'scheme-bg-color') preferences.colourSchemes[idx].background = target.value;
            if (target.id === 'scheme-text-color') preferences.colourSchemes[idx].text = target.value;
            const tabButton = document.querySelector(`#colour-scheme-tabs .colour-tab[data-index="${idx}"]`);
            if (tabButton && target.id === 'scheme-name') { tabButton.textContent = target.value || `Scheme ${preferences.colourSchemes[idx].id}`; }
            updateClock(); // Apply live changes
        }
    }
}
function handleSchemeFormClick(e) {
  const target = e.target; const index = target.getAttribute('data-index'); const feedbackEl = target.closest('.colour-scheme-form')?.querySelector('.feedback-message');
  if (target.id === 'save-scheme-settings' && index !== null) {
      const idx = parseInt(index, 10); saveSettings(); updateClock();
      const currentTabButton = document.querySelector(`#colour-scheme-tabs .colour-tab[data-index="${idx}"]`); if(currentTabButton){ document.querySelectorAll(".colour-tab").forEach(btn => btn.classList.remove("active")); currentTabButton.classList.add("active"); }
      showButtonFeedback(target, "Saved!");
  } else if (target.id === 'delete-scheme' && index !== null) {
      const idx = parseInt(index, 10); const schemeToDelete = preferences.colourSchemes[idx];
      if (schemeToDelete && schemeToDelete.id !== 1 && schemeToDelete.id !== 2 && preferences.colourSchemes.length > 1) {
           if (confirm(`Delete scheme "${schemeToDelete.name || `Scheme ${idx + 1}`}"? Periods using it will revert to Scheme 1.`)) {
                const deletedSchemeId = schemeToDelete.id; preferences.colourSchemes.splice(idx, 1);
                schedule.forEach(item => { if (item.colourSchemeId === deletedSchemeId) item.colourSchemeId = 1; });
                saveSettings(); renderScheduleTable(); renderColourSchemeTabs(); updateClock();
           }
      } else { alert("Cannot delete default schemes or the last remaining scheme."); }
  }
}

/**********************************
* Schedule Table (Schedule & Alerts Tab)
**********************************/
const scheduleTableBody = document.querySelector("#schedule-table tbody");
let selectedRowIndex = null;

function renderScheduleTable() {
    if (!scheduleTableBody) return; scheduleTableBody.innerHTML = "";
    const activeScheme = getActiveColourScheme();
    schedule.forEach((item, index) => {
        const tr = document.createElement("tr"); tr.dataset.index = index; tr.setAttribute("draggable", "true");
        if (index === selectedRowIndex) { tr.classList.add("selected"); }
        const dragTd = document.createElement("td"); dragTd.innerHTML = "☰"; dragTd.className = "drag-handle"; tr.appendChild(dragTd);
        const labelTd = document.createElement("td"); const labelInput = document.createElement("input"); labelInput.type = "text"; labelInput.value = item.label || ""; labelInput.addEventListener("change", function() { schedule[index].label = this.value; saveSettings(); updateClock(); }); labelTd.appendChild(labelInput); tr.appendChild(labelTd);
        const startTd = document.createElement("td"); const startInput = document.createElement("input"); startInput.type = "time"; startInput.value = item.start || "00:00"; startInput.addEventListener("change", function() { schedule[index].start = this.value; saveSettings(); updateClock(); }); startTd.appendChild(startInput); tr.appendChild(startTd);
        const endTd = document.createElement("td"); const endInput = document.createElement("input"); endInput.type = "time"; endInput.value = item.end || "00:00"; endInput.addEventListener("change", function() { schedule[index].end = this.value; saveSettings(); updateClock(); }); endTd.appendChild(endInput); tr.appendChild(endTd);
        const schemeTd = document.createElement("td"); const swatch = document.createElement("div"); swatch.className = "scheme-swatch"; const scheme = preferences.colourSchemes.find(s => s.id === item.colourSchemeId) || preferences.colourSchemes.find(s=>s.id===1) || preferences.colourSchemes[0]; swatch.style.backgroundColor = scheme ? scheme.background : '#ff00ff'; swatch.style.borderColor = scheme ? scheme.text : '#ffffff';
        swatch.title = `Scheme: ${scheme ? scheme.name : 'Unknown'} (ID: ${item.colourSchemeId}). Click to cycle.`; swatch.addEventListener("click", (e) => { e.stopPropagation(); cycleSchemeForRow(index); }); schemeTd.appendChild(swatch); tr.appendChild(schemeTd);
        const alertTd = document.createElement("td"); const visualAlertBtn = document.createElement("button"); const isAlertEnabled = alertsSettings[index]?.colour?.enabled; visualAlertBtn.innerHTML = isAlertEnabled ? '🔴' : '🟢'; visualAlertBtn.title = `Visual Alert: ${isAlertEnabled ? 'Enabled' : 'Disabled'}. Click to edit.`; visualAlertBtn.className = "alert-edit-btn"; visualAlertBtn.addEventListener('click', (e) => { e.stopPropagation(); openAlertModal(index, 'colour'); }); alertTd.appendChild(visualAlertBtn); tr.appendChild(alertTd);
        const circlesTd = document.createElement("td"); const circlesCheckbox = document.createElement("input"); circlesCheckbox.type = "checkbox"; circlesCheckbox.checked = item.showCircles || false; circlesCheckbox.title = "Enable Schedule Circles display for this period";
        circlesCheckbox.addEventListener("change", function(e) { e.stopPropagation(); schedule[index].showCircles = this.checked; saveSettings(); renderScheduleCircles(); }); circlesTd.appendChild(circlesCheckbox); tr.appendChild(circlesTd);
        tr.addEventListener("click", function(e) { if (!(e.target.tagName === "INPUT" || e.target.tagName === "BUTTON" || e.target.classList.contains('scheme-swatch') || e.target.classList.contains('drag-handle'))) { const prevSelected = scheduleTableBody.querySelector("tr.selected"); if (prevSelected) prevSelected.classList.remove("selected"); tr.classList.add("selected"); selectedRowIndex = index; } else if(this.classList.contains('selected')) { selectedRowIndex = index; } }); // Simplified click handler
        tr.addEventListener("dragstart", dragStart); tr.addEventListener("dragover", dragOver); tr.addEventListener("dragleave", dragLeave); tr.addEventListener("drop", dragDrop); tr.addEventListener("dragend", dragEnd);
        scheduleTableBody.appendChild(tr);
    });
}
function cycleSchemeForRow(index) {
    const currentSchemeId = schedule[index].colourSchemeId || 1; const currentSchemeIndexInPrefs = preferences.colourSchemes.findIndex(s => s.id === currentSchemeId); let nextSchemeIndexInPrefs = (currentSchemeIndexInPrefs + 1) % preferences.colourSchemes.length; schedule[index].colourSchemeId = preferences.colourSchemes[nextSchemeIndexInPrefs]?.id || 1; saveSettings(); renderScheduleTable(); updateClock();
}
let dragStartIndex;
function dragStart(e) { dragStartIndex = +this.dataset.index; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragStartIndex); this.classList.add('dragging'); if (!this.classList.contains('selected')) { const prevSelected = scheduleTableBody.querySelector("tr.selected"); if (prevSelected) prevSelected.classList.remove("selected"); this.classList.add("selected"); selectedRowIndex = dragStartIndex; } }
function dragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; this.classList.add('drag-over'); }
function dragLeave(e) { this.classList.remove('drag-over'); }
function dragDrop(e) {
    e.preventDefault(); const dragEndIndex = +this.dataset.index; this.classList.remove('drag-over');
    if (dragStartIndex !== dragEndIndex) {
        const movedItem = schedule.splice(dragStartIndex, 1)[0]; schedule.splice(dragEndIndex, 0, movedItem);
        const movedAlert = alertsSettings[dragStartIndex]; const tempAlerts = {};
        for (const key in alertsSettings) { const oldIdx = parseInt(key, 10); if (oldIdx === dragStartIndex) continue; let newIdx = oldIdx; if (dragStartIndex < oldIdx && dragEndIndex >= oldIdx) { newIdx--; } else if (dragStartIndex > oldIdx && dragEndIndex <= oldIdx) { newIdx++; } tempAlerts[newIdx] = alertsSettings[key]; } // Simplified alert key adjustment
        if (movedAlert) { tempAlerts[dragEndIndex] = movedAlert; } alertsSettings = tempAlerts;
        selectedRowIndex = dragEndIndex; renderScheduleTable(); saveSettings(); updateClock();
    }
}
function dragEnd(e) { this.classList.remove('dragging'); document.querySelectorAll('#schedule-table tbody tr').forEach(row => row.classList.remove('drag-over')); }
scheduleTableBody?.addEventListener('dragleave', function(e) { if (scheduleTableBody && !scheduleTableBody.contains(e.relatedTarget)) { document.querySelectorAll('#schedule-table tbody tr.drag-over').forEach(row => row.classList.remove('drag-over')); } }); // Added null check

document.getElementById("add-schedule-row")?.addEventListener("click", () => { // Added null check
    const newRow = { label: "New Period", start: "00:00", end: "00:00", colourSchemeId: 1, showCircles: false };
    const insertIndex = (selectedRowIndex === null || selectedRowIndex < 0 || selectedRowIndex >= schedule.length) ? schedule.length : selectedRowIndex + 1;
    schedule.splice(insertIndex, 0, newRow);
    const newAlerts = {}; Object.keys(alertsSettings).forEach(key => { const oldIdx = parseInt(key, 10); newAlerts[oldIdx >= insertIndex ? oldIdx + 1 : oldIdx] = alertsSettings[key]; }); alertsSettings = newAlerts; // Simplified alert key adjustment
    selectedRowIndex = insertIndex; renderScheduleTable(); saveSettings();
});
document.getElementById("delete-schedule-row")?.addEventListener("click", (e) => { // Added null check
    if (selectedRowIndex !== null && selectedRowIndex >= 0 && selectedRowIndex < schedule.length) {
        if (confirm(`Delete row "${schedule[selectedRowIndex].label}"?`)) {
            schedule.splice(selectedRowIndex, 1);
            delete alertsSettings[selectedRowIndex]; const newAlerts = {}; Object.keys(alertsSettings).forEach(key => { const oldIdx = parseInt(key, 10); newAlerts[oldIdx > selectedRowIndex ? oldIdx - 1 : oldIdx] = alertsSettings[key]; }); alertsSettings = newAlerts; // Simplified alert key adjustment
            selectedRowIndex = null; renderScheduleTable(); saveSettings(); updateClock();
        }
    } else { showButtonFeedback(e.target, "Select Row First!", 2000); }
});

/**********************************
* Alert Modal Logic
**********************************/
function openAlertModal(index, option = 'colour') { if (index === null || index < 0 || index >= schedule.length) return; const periodLabel = schedule[index].label || `Row ${index + 1}`; alertModalTitle.textContent = `Visual Alert Settings for "${periodLabel}"`; showAlertSettingsForm(index); alertModal.style.display = "block"; }
function closeAlertModal() { alertModal.style.display = "none"; alertModalBody.innerHTML = ""; }
alertModal?.addEventListener('click', (event) => { if (event.target === alertModal || event.target === closeModalBtn) closeAlertModal(); }); // Added null check
closeModalBtn?.addEventListener('click', closeAlertModal); // Added null check

function showAlertSettingsForm(index) {
  const currentPeriodAlerts = { colour: { ...preferences.defaultAlertSettings.colour, ...(alertsSettings[index]?.colour || {}) } }; const settings = currentPeriodAlerts.colour; const durationInSeconds = ((settings.durationMs || preferences.defaultAlertSettings.colour.durationMs) / 1000); const intervalValue = settings.intervalMs || preferences.defaultAlertSettings.colour.intervalMs;
  const formHTML = `
      <div class="alert-settings-form"> <label><input type="checkbox" id="alert-colour-enabled" ${settings.enabled ? "checked" : ""}> Enable Visual Alert</label><hr> <label>Flash Background Colour: <input type="color" id="alert-bg-color" value="${settings.background}"></label> <label>Flash Text Colour: <input type="color" id="alert-label-color" value="${settings.text}"></label> <label>Flash Duration (s): <input type="number" id="alert-flash-duration-sec" min="0.5" max="10" step="0.1" value="${durationInSeconds.toFixed(1)}"></label> <label>Flash Interval (ms): <input type="number" id="alert-flash-interval" min="100" max="2000" step="50" value="${intervalValue}"></label> <div class="button-group"> <button id="save-alert" data-index="${index}" data-option="colour">Save Visual Alert</button> <button id="preview-alert" data-option="colour">Preview Flash</button> <button id="remove-alert" data-index="${index}" data-option="colour">${settings.enabled ? 'Disable Alert' : 'Remove Custom Settings'}</button> </div> <div class="feedback-message" style="display: none;"></div></div>`; // Simplified form generation
  alertModalBody.innerHTML = formHTML;
  const form = alertModalBody.querySelector('.alert-settings-form'); const enableCheckbox = form.querySelector('#alert-colour-enabled'); const saveButton = form.querySelector('#save-alert'); const previewButton = form.querySelector('#preview-alert'); const removeButton = form.querySelector('#remove-alert'); const feedbackEl = form.querySelector('.feedback-message'); const inputs = form.querySelectorAll('input:not([type="checkbox"]), select');
  const toggleControls = (enabled) => { inputs.forEach(input => input.disabled = !enabled); if (previewButton) previewButton.disabled = !enabled; if (removeButton) { removeButton.disabled = !alertsSettings[index]?.colour; removeButton.textContent = enabled ? 'Disable Alert' : (alertsSettings[index]?.colour ? 'Remove Custom Settings' : 'Using Defaults'); } };
  if (enableCheckbox) { enableCheckbox.addEventListener('change', (e) => { toggleControls(e.target.checked); if(removeButton) removeButton.textContent = e.target.checked ? 'Disable Alert' : (alertsSettings[index]?.colour ? 'Remove Custom Settings' : 'Using Defaults'); }); toggleControls(enableCheckbox.checked); }
  if (saveButton) { saveButton.addEventListener('click', () => { const idx = parseInt(saveButton.getAttribute('data-index'), 10); if (isNaN(idx)) return; if (!alertsSettings[idx]) alertsSettings[idx] = {}; if (!alertsSettings[idx].colour) alertsSettings[idx].colour = {}; const durationSecInput = form.querySelector("#alert-flash-duration-sec").value; const intervalInput = form.querySelector("#alert-flash-interval").value; const defaultDurationMs = preferences.defaultAlertSettings.colour.durationMs; const defaultIntervalMs = preferences.defaultAlertSettings.colour.intervalMs; let durationSec = parseFloat(durationSecInput); durationSec = isNaN(durationSec) ? (defaultDurationMs / 1000) : Math.max(0.5, Math.min(10, durationSec)); let intervalMs = parseInt(intervalInput, 10); intervalMs = isNaN(intervalMs) ? defaultIntervalMs : Math.max(100, Math.min(2000, intervalMs)); let savedData = { enabled: enableCheckbox.checked, background: form.querySelector("#alert-bg-color").value || preferences.defaultAlertSettings.colour.background, text: form.querySelector("#alert-label-color").value || preferences.defaultAlertSettings.colour.text, durationMs: Math.round(durationSec * 1000), intervalMs: intervalMs }; alertsSettings[idx].colour = savedData; saveSettings(); renderScheduleTable(); showButtonFeedback(saveButton, "Saved!"); setTimeout(closeAlertModal, 1600); }); }
  if (previewButton) { previewButton.addEventListener('click', () => { if (!enableCheckbox.checked) { showFeedback(feedbackEl, `Enable the alert first to preview.`, false); return; } const durationSec = parseFloat(form.querySelector("#alert-flash-duration-sec").value); let previewSettings = { enabled: true, background: form.querySelector("#alert-bg-color").value, text: form.querySelector("#alert-label-color").value, durationMs: Math.round(durationSec * 1000), intervalMs: parseInt(form.querySelector("#alert-flash-interval").value, 10) }; triggerVisualAlert(previewSettings); showFeedback(feedbackEl, `Previewing flash...`, true); }); }
  if (removeButton) { removeButton.addEventListener('click', () => { const idx = parseInt(removeButton.getAttribute('data-index'), 10); if (isNaN(idx)) return; if (alertsSettings[idx]?.colour) { if (enableCheckbox.checked) { enableCheckbox.checked = false; toggleControls(false); removeButton.textContent = 'Remove Custom Settings'; removeButton.disabled = false; showFeedback(feedbackEl, `Alert disabled. Click Save.`, true); } else { if (confirm(`Remove custom visual alert settings for "${schedule[idx].label}"? It will revert to defaults.`)) { delete alertsSettings[idx].colour; if (Object.keys(alertsSettings[idx]).length === 0) { delete alertsSettings[idx]; } saveSettings(); renderScheduleTable(); closeAlertModal(); } } } else { showFeedback(feedbackEl, `No custom settings to remove. Using defaults.`, true); removeButton.disabled = true; removeButton.textContent = 'Using Defaults'; } }); }
}

// --- Tabs ---
document.querySelectorAll('#tabs .tab-button').forEach(button => {
    button.addEventListener('click', function() {
        document.querySelectorAll('#tabs .tab-button.active').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('#tab-contents .tab-content.active').forEach(content => content.classList.remove('active'));
        this.classList.add('active');
        const tabId = this.getAttribute('data-tab');
        const targetContent = document.getElementById(tabId);
        if(targetContent) targetContent.classList.add('active');
    });
});


// Initialize
document.addEventListener('DOMContentLoaded', () => {
     loadSettings();
     // Initial population of tabs (if needed, e.g., first colour scheme)
     if (document.querySelector('#colour-scheme-tabs .colour-tab')) {
          renderColourSchemeContent(0); // Render first scheme's content
     }
});