/**********************************
 * Clock & Schedule Functionality
 **********************************/
// Default schedule (Add showCircles property)
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

// Default preferences - Added display elements and new features
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
  showSandBars: false, // Sand Bars (alternative progress)
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
let sandBarState = { // State for sand bars
    particlesDropped: 0,
    lastUpdateTime: 0,
    segmentContainers: [],
    particleIntervalId: null
};
const SAND_DROP_INTERVAL_MS = 10000; // Drop sand every 10 seconds
const SAND_COLORS = ["#fba1bd", "#dfb37a", "#8aca91", "#54cce2", "#b6b6fd"];

// --- DOM Elements Cache ---
const clockDisplayArea = document.getElementById("clock-display-area"); // Main container
const timeEl = document.getElementById("time");
const dateEl = document.getElementById("date");
const scheduleCirclesDisplayEl = document.getElementById("schedule-circles-display");
const periodContainerEl = document.getElementById("period-container");
const periodLabelEl = document.getElementById("period-label");
const progressBarEl = document.getElementById("progress-bar");
const progressEl = document.getElementById("progress");
const timeLeftEl = document.getElementById("time-left");
const sandBarsContainerEl = document.getElementById("sand-bars-container");
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
  // Fallback to scheme 1 if not found, then the first in the list, then error state
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
        // Handle overnight periods (e.g., ending at 01:00 after starting at 22:00)
        if (endTime.getTime() <= startTime.getTime()) {
             isOvernight = true;
             // If end time is exactly 00:00, treat it as 24:00 of the start day
             if (endTime.getHours() === 0 && endTime.getMinutes() === 0 && endTime.getSeconds() === 0) {
                  adjustedEndTime = getTodayTime(period.start); // Use start day
                  adjustedEndTime.setHours(24, 0, 0, 0); // Set to midnight *next* day relative to start
             } else {
                  adjustedEndTime.setDate(adjustedEndTime.getDate() + 1); // End time is on the next calendar day
             }
        }
        let isActive = false;
        if (isOvernight) {
             // Check if now is between start and midnight OR between midnight and end of next day
             const midnightAfterStart = new Date(startTime);
             midnightAfterStart.setHours(24, 0, 0, 0);
             if ((now >= startTime && now < midnightAfterStart) || (now >= getTodayTime("00:00") && now < adjustedEndTime)) {
                 isActive = true;
                 // Use the adjusted end time which could be > 24hrs from start
             }
        } else {
            // Normal period within the same day
            if (now >= startTime && now < adjustedEndTime) {
                 isActive = true;
            }
        }
        // Handle exact end time of 23:59 as including the whole minute
        if (!isActive && (period.end === "23:59" || period.end === "23:59:59")) {
            const endOfDay = new Date(now);
            endOfDay.setHours(23, 59, 59, 999);
             if (now >= startTime && now <= endOfDay) {
                  isActive = true;
                  adjustedEndTime = endOfDay; // Make sure end time includes the full minute
             }
        }

        if (isActive) {
             return { label: period.label, start: startTime, end: adjustedEndTime, index: i };
        }
    } catch (e) { console.error("Error processing period:", period.label, period.start, period.end, e); }
  }
  return null; // No period found
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
    const elements = {
        date: dateEl,
        scheduleCircles: scheduleCirclesDisplayEl,
        time: timeEl,
        periodContainer: periodContainerEl, // Controls label + progress/sand visibility
        scheduleLabel: periodLabelEl, // Controlled via periodContainer
        progressBar: progressBarEl, // Specific progress bar
        sandBars: sandBarsContainerEl // Specific sand bars
    };

    // Toggle main elements based on preferences
    elements.date.classList.toggle('element-hidden', !preferences.showDate);
    elements.scheduleCircles.classList.toggle('element-hidden', !preferences.showScheduleCircles);
    elements.time.classList.toggle('element-hidden', !preferences.showTime);

    // Toggle period container (which holds label and progress/sand)
    const showPeriodInfo = preferences.showScheduleLabel || preferences.showProgressBar || preferences.showSandBars;
    elements.periodContainer.classList.toggle('element-hidden', !showPeriodInfo);

    // If period container is visible, toggle label visibility
    if (showPeriodInfo) {
        elements.scheduleLabel.classList.toggle('element-hidden', !preferences.showScheduleLabel);
    }

    // Handle mutually exclusive Progress Bar vs Sand Bars
    const showProgress = preferences.showProgressBar && !preferences.showSandBars;
    const showSand = preferences.showSandBars; // Sand bars override progress bar

    elements.progressBar.classList.toggle('element-hidden', !showProgress);
    elements.sandBars.classList.toggle('element-hidden', !showSand);

    // Apply font sizes dynamically (only if element is visible)
    applyFontAndSizePreferences(); // Ensures sizes are reapplied if elements become visible
}


// --- Schedule Circles Rendering ---
function renderScheduleCircles() {
    if (!preferences.showScheduleCircles || !scheduleCirclesDisplayEl) {
        if(scheduleCirclesDisplayEl) scheduleCirclesDisplayEl.innerHTML = ''; // Clear if disabled
        return;
    }

    const now = getCurrentOffsetTime();
    const currentPeriodInfo = getCurrentPeriod(now);
    const activeScheme = getActiveColourScheme();

    // Filter schedule items that are enabled for circles
    const circlePeriods = schedule.map((item, index) => ({ ...item, originalIndex: index }))
                                .filter(item => item.showCircles);

    if (circlePeriods.length === 0) {
        scheduleCirclesDisplayEl.innerHTML = ''; // No periods configured
        return;
    }

    let currentCircleIndex = -1;
    if (currentPeriodInfo) {
        // Find the position of the current period within the *filtered* list
        currentCircleIndex = circlePeriods.findIndex(p => p.originalIndex === currentPeriodInfo.index);
    }

    let html = '';
    const totalCircles = circlePeriods.length;

    // Unicode symbols: ○◔◑◕● (Empty, Quarter, Half, Three-Quarter, Full)
    // We can map progress based on index completion
    for (let i = 0; i < totalCircles; i++) {
        let symbol = '○'; // Default: empty circle
        let cssClass = 'schedule-circle-symbol';

        if (currentCircleIndex >= i) {
            // This circle represents a period that has started or finished
            cssClass += ' active';
            symbol = '●'; // Full circle for simplicity, as it represents a *completed or current* block
            // More granular symbols (◔◑◕) could represent progress *within* the current circle period,
            // but the request implies filling circles *as periods pass*. Let's stick to ● for now.
        } else {
             cssClass += ' inactive';
             symbol = '○'; // Or maybe a grey filled circle like '●' but grey? Using outline for now.
        }

        html += `<span class="${cssClass}" style="color: ${cssClass.includes('active') ? activeScheme.text : '#555'};">${symbol}</span>`;
    }

    scheduleCirclesDisplayEl.innerHTML = html;
}


// --- Sand Bars Functions ---
function setupSandBars(periodDurationMs) {
    if (!sandBarsContainerEl || !preferences.showSandBars) return;

    // Clear previous state
    sandBarsContainerEl.innerHTML = '';
    sandBarState.particlesDropped = 0;
    sandBarState.segmentContainers = [];
    clearInterval(sandBarState.particleIntervalId);
    sandBarState.particleIntervalId = null;

    if (periodDurationMs <= 0) return; // Cannot set up for zero duration

    const segmentDuration = periodDurationMs / SAND_COLORS.length;

    for (let i = 0; i < SAND_COLORS.length; i++) {
        const segment = document.createElement('div');
        segment.className = 'sand-bar-segment';
        segment.style.backgroundColor = lightenColor(SAND_COLORS[i], 60); // Lighter background for contrast
        segment.dataset.color = SAND_COLORS[i]; // Store original color
        sandBarsContainerEl.appendChild(segment);
        sandBarState.segmentContainers.push(segment);
    }

    // Start the interval timer for dropping particles
    // Note: This interval purely triggers *potential* drops.
    // The *actual* drop logic happens in updateSandBars based on time elapsed.
    sandBarState.lastUpdateTime = performance.now();
    sandBarState.particleIntervalId = setInterval(() => {
         // We don't *drop* here, just ensure updateSandBars is called regularly
         // This could be removed if updateClock reliably calls updateSandBars often enough
    }, SAND_DROP_INTERVAL_MS / 2); // Check more frequently than drop interval

}

function updateSandBars(timeElapsedMs, periodDurationMs) {
    if (!preferences.showSandBars || !sandBarsContainerEl || periodDurationMs <= 0 || sandBarState.segmentContainers.length !== SAND_COLORS.length) {
         clearInterval(sandBarState.particleIntervalId);
         sandBarState.particleIntervalId = null;
         return;
    }

    const segmentDuration = periodDurationMs / SAND_COLORS.length;
    // Total particles that *should* have dropped by now
    const expectedParticles = Math.floor(timeElapsedMs / SAND_DROP_INTERVAL_MS);

    // How many particles need to be created in this update cycle?
    const particlesToCreate = expectedParticles - sandBarState.particlesDropped;

    if (particlesToCreate > 0) {
        for (let i = 0; i < particlesToCreate; i++) {
            // Calculate the time at which this *specific* particle should have dropped
            const particleDropTime = (sandBarState.particlesDropped + i + 1) * SAND_DROP_INTERVAL_MS;
            // Determine which segment this particle belongs to
            const segmentIndex = Math.min(Math.floor(particleDropTime / segmentDuration), SAND_COLORS.length - 1);

            if (segmentIndex >= 0 && segmentIndex < sandBarState.segmentContainers.length) {
                 createSandParticle(segmentIndex, SAND_COLORS[segmentIndex]);
            }
        }
        sandBarState.particlesDropped = expectedParticles; // Update the count
    }
}

function createSandParticle(segmentIndex, color) {
    if (!sandBarState.segmentContainers[segmentIndex]) return;

    const particle = document.createElement('div');
    particle.className = 'sand-particle';
    particle.style.backgroundColor = color;

    // Basic stacking: calculate approximate bottom position based on number of particles already in the segment
    const existingParticles = sandBarState.segmentContainers[segmentIndex].querySelectorAll('.sand-particle').length;
    const particleHeight = 10; // Matches CSS height
    const bottomOffset = 5 + (existingParticles * (particleHeight * 0.8)); // Simple stacking, 80% height overlap
    const maxBottom = sandBarState.segmentContainers[segmentIndex].offsetHeight - particleHeight - 5; // Don't overflow top
    particle.style.bottom = `${Math.min(bottomOffset, maxBottom)}px`;

    // Add slight random horizontal offset for jostle effect
    const randomOffset = (Math.random() - 0.5) * 15; // Adjust range as needed
    particle.style.left = `calc(50% + ${randomOffset}px)`;


    sandBarState.segmentContainers[segmentIndex].appendChild(particle);

    // Optional: Remove particle from DOM after animation to prevent buildup
    // particle.addEventListener('animationend', () => {
    //     // Maybe change style instead of removing? Or just leave them.
    //     // particle.remove(); // Be careful with performance if many particles
    // });
}

// Helper to lighten a hex color (for sand bar background)
function lightenColor(hex, percent) {
    hex = hex.replace(/^#/, '');
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    r = Math.min(255, Math.floor(r * (1 + percent / 100)));
    g = Math.min(255, Math.floor(g * (1 + percent / 100)));
    b = Math.min(255, Math.floor(b * (1 + percent / 100)));

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}


// --- Alert Triggering Functions ---
function triggerVisualAlert(settings) {
  clearTimeout(activeVisualAlertTimeout); clearInterval(activeVisualAlertInterval); restoreOriginalStyles();
  const { background: alertBg, text: alertText, durationMs, intervalMs } = settings;
  const activeScheme = getActiveColourScheme();
  // Store original styles more comprehensively
  originalBodyStyles = {
      background: document.body.style.backgroundColor,
      color: document.body.style.color,
      timeColor: timeEl.style.color,
      dateColor: dateEl.style.color,
      labelColor: periodLabelEl.style.color,
      progressColor: progressEl.style.backgroundColor, // Standard progress
      timeLeftColor: timeLeftEl.style.color,
      scheduleCircleColor: scheduleCirclesDisplayEl ? scheduleCirclesDisplayEl.style.color : '', // Add schedule circles
      // Add sand bar elements if needed, though they might follow body color
  };

  let isAlertState = false;
  const toggleColors = () => {
      isAlertState = !isAlertState;
      const currentBg = isAlertState ? alertBg : activeScheme.background;
      const currentText = isAlertState ? alertText : activeScheme.text;
      document.body.style.backgroundColor = currentBg;
      document.body.style.color = currentText; // Affects default text color
      if (timeEl && preferences.showTime) timeEl.style.color = currentText;
      if (dateEl && preferences.showDate) dateEl.style.color = currentText;
      if (periodLabelEl && preferences.showScheduleLabel) periodLabelEl.style.color = currentText;
      if (progressEl && preferences.showProgressBar && !preferences.showSandBars) progressEl.style.backgroundColor = currentText; // Only standard progress bar fill
      if (timeLeftEl && preferences.showProgressBar && !preferences.showSandBars) timeLeftEl.style.color = currentText;
      if (scheduleCirclesDisplayEl && preferences.showScheduleCircles) {
           scheduleCirclesDisplayEl.querySelectorAll('.schedule-circle-symbol.active').forEach(span => span.style.color = currentText);
      }
      // Sand bars elements generally derive color from their definition, maybe don't flash them?
  };
  toggleColors(); // Initial flash state
  activeVisualAlertInterval = setInterval(toggleColors, intervalMs);
  activeVisualAlertTimeout = setTimeout(() => {
      clearInterval(activeVisualAlertInterval); activeVisualAlertInterval = null; activeVisualAlertTimeout = null;
      restoreOriginalStyles(activeScheme); // Restore to the scheme that should be active
  }, durationMs);
}

function restoreOriginalStyles(schemeToRestoreTo = null) {
  const scheme = schemeToRestoreTo || getActiveColourScheme(); // Get the correct current scheme
  document.body.style.backgroundColor = scheme.background;
  document.body.style.color = scheme.text; // Base text color

  // Restore specific elements only if they are supposed to be visible
  if (timeEl && preferences.showTime) timeEl.style.color = scheme.text;
  if (dateEl && preferences.showDate) dateEl.style.color = scheme.text;
  if (periodLabelEl && preferences.showScheduleLabel) periodLabelEl.style.color = scheme.text;
  if (progressEl && preferences.showProgressBar && !preferences.showSandBars) progressEl.style.backgroundColor = scheme.text;
  if (timeLeftEl && preferences.showProgressBar && !preferences.showSandBars) timeLeftEl.style.color = scheme.text;
  if (scheduleCirclesDisplayEl && preferences.showScheduleCircles) {
      // Re-render circles to ensure correct active/inactive colors based on scheme
       renderScheduleCircles();
  }
   // Sand bars styling is generally static based on SAND_COLORS
}


// --- Main Clock Update Loop ---
function updateClock() {
  const now = getCurrentOffsetTime();
  const activeScheme = getActiveColourScheme();

  // Apply layout first (show/hide elements)
  updateLayout();

  // Restore colors *unless* an alert is actively flashing
  if (!activeVisualAlertInterval) {
       restoreOriginalStyles(activeScheme); // Pass the current scheme
  }

  // Update Date and Time (if visible)
  if (preferences.showTime && timeEl) timeEl.textContent = formatTime(now);
  if (preferences.showDate && dateEl) dateEl.textContent = formatDate(now);

  // Update Schedule Circles (if visible)
  if (preferences.showScheduleCircles && scheduleCirclesDisplayEl) {
      renderScheduleCircles();
  }

  const periodInfo = getCurrentPeriod(now);

  // --- Period Change Detection & Alert Triggering ---
  const newPeriodLabel = periodInfo ? periodInfo.label : null;
  const newPeriodIndex = periodInfo ? periodInfo.index : null; // Get index too

  if (newPeriodIndex !== currentPeriodIndex) { // Check index change, more robust
      console.log("Period changed to:", newPeriodLabel, "(Index:", newPeriodIndex, ")");
      currentPeriodLabel = newPeriodLabel;
      currentPeriodIndex = newPeriodIndex; // Update the tracked index

      // Trigger alert if configured for the new period
      if (periodInfo && periodInfo.index !== undefined) {
          const alertSetting = alertsSettings[periodInfo.index];
          if (alertSetting?.colour?.enabled) {
              triggerVisualAlert(alertSetting.colour);
          }
      } else {
          // Clear any lingering alert if entering a gap between periods
          clearTimeout(activeVisualAlertTimeout); clearInterval(activeVisualAlertInterval);
          restoreOriginalStyles(); // Restore to default for the gap (usually scheme 1)
      }

      // Reset Sand Bars if they are enabled when period changes
      if (preferences.showSandBars && periodInfo) {
          const periodStartMs = periodInfo.start.getTime();
          const periodEndMs = periodInfo.end.getTime();
          const periodDuration = periodEndMs - periodStartMs;
          setupSandBars(periodDuration); // Re-setup for the new period
      } else if (!periodInfo && preferences.showSandBars) {
          setupSandBars(0); // Clear sand bars if no period active
      }
  }


  // Update Period Label, Progress Bar OR Sand Bars, Time Left
  if (periodInfo) {
       if (preferences.showScheduleLabel && periodLabelEl) periodLabelEl.textContent = periodInfo.label;

      const periodStartMs = periodInfo.start.getTime();
      const periodEndMs = periodInfo.end.getTime();
      const nowMs = now.getTime();
      const periodDuration = periodEndMs - periodStartMs;
      const timeElapsed = Math.max(0, nowMs - periodStartMs); // Ensure non-negative

      // --- Standard Progress Bar Logic ---
      if (preferences.showProgressBar && !preferences.showSandBars && progressBarEl && progressEl && timeLeftEl) {
          if (periodDuration > 0) {
              let progressPercent = Math.min(Math.max((timeElapsed / periodDuration) * 100, 0), 100);
              progressEl.style.width = progressPercent + "%";

              // Position Time Left indicator
              const progressBarWidth = progressBarEl.offsetWidth;
              let desiredLeft = (progressPercent / 100) * progressBarWidth;
              const timeLeftWidth = timeLeftEl.offsetWidth || 60; // Estimate width if not rendered yet
              let finalLeft = desiredLeft - (timeLeftWidth / 2);
              // Clamp position within bounds
              finalLeft = Math.max(0, finalLeft); // Allow start edge
              finalLeft = Math.min(progressBarWidth - timeLeftWidth, finalLeft); // Allow end edge

              timeLeftEl.style.left = finalLeft + "px";

              const timeLeftMs = periodEndMs - nowMs;
              const timeLeftSec = Math.max(0, Math.floor(timeLeftMs / 1000));
              const minutes = Math.floor(timeLeftSec / 60);
              const seconds = timeLeftSec % 60;
              timeLeftEl.textContent = `${minutes}:${seconds < 10 ? "0" + seconds : seconds}`;
          } else {
              // Handle zero or negative duration periods
              progressEl.style.width = (nowMs >= periodStartMs) ? "100%" : "0%";
              timeLeftEl.textContent = "0:00";
              timeLeftEl.style.left = (progressBarEl.offsetWidth - (timeLeftEl.offsetWidth || 60)) + "px"; // Position at end
          }
      }

      // --- Sand Bars Logic ---
      if (preferences.showSandBars && sandBarsContainerEl) {
          updateSandBars(timeElapsed, periodDuration);
          // Could optionally display numerical time left somewhere else if needed
      }

  } else {
       // No active period
       if (preferences.showScheduleLabel && periodLabelEl) periodLabelEl.textContent = "";
       if (preferences.showProgressBar && !preferences.showSandBars && progressEl) progressEl.style.width = "0%";
       if (preferences.showProgressBar && !preferences.showSandBars && timeLeftEl) timeLeftEl.textContent = "";
       if (preferences.showSandBars && sandBarsContainerEl) {
            // Clear sand bars if feature is enabled but no period is active
            if (sandBarState.segmentContainers.length > 0) {
                 setupSandBars(0); // Clear content
            }
       }
  }

  // Apply general font/size (redundant if done in updateLayout, but safe)
  // applyFontAndSizePreferences(); // Called by updateLayout already
}

// Apply only font/size preferences
function applyFontAndSizePreferences() {
   // Apply sizes only if the element is intended to be visible
   if (preferences.showDate && dateEl) dateEl.style.fontSize = preferences.dateFontSize + "px";
   if (preferences.showTime && timeEl) timeEl.style.fontSize = preferences.timeFontSize + "px";
   // Apply to container, let label inherit or set specific size
   //if (periodContainerEl) document.body.style.setProperty('--schedule-label-font-size', preferences.scheduleLabelFontSize + "px");
   if (preferences.showScheduleLabel && periodLabelEl) periodLabelEl.style.fontSize = preferences.scheduleLabelFontSize + "px";
   if (preferences.showProgressBar && !preferences.showSandBars && timeLeftEl) timeLeftEl.style.fontSize = preferences.timeLeftFontSize + "px";
   if (preferences.showProgressBar && !preferences.showSandBars && progressBarEl) progressBarEl.style.height = preferences.progressBarHeight + "px";
   // Apply global font
   document.body.style.fontFamily = preferences.fontFamily;

   // Apply active text color to schedule circles (active ones) if visible
   if (preferences.showScheduleCircles && scheduleCirclesDisplayEl) {
        const activeScheme = getActiveColourScheme();
        scheduleCirclesDisplayEl.querySelectorAll('.schedule-circle-symbol.active').forEach(span => span.style.color = activeScheme.text);
        scheduleCirclesDisplayEl.querySelectorAll('.schedule-circle-symbol.inactive').forEach(span => span.style.color = '#555'); // Ensure inactive stays grey
   }
}

setInterval(updateClock, 1000); // Keep 1-second interval for clock time update

/**********************************
* Settings Menu Functionality
**********************************/
// Menu Toggle
menuToggle.addEventListener("click", () => { settingsMenu.classList.toggle("open"); menuToggle.innerHTML = settingsMenu.classList.contains("open") ? "▲" : "▼"; });
// Draggable resizer
const menuResizer = document.getElementById("menu-resizer"); let isResizing = false;
menuResizer.addEventListener("mousedown", function(e) { isResizing = true; document.body.style.cursor = "ew-resize"; });
document.addEventListener("mousemove", function(e) { if (!isResizing) return; const newWidth = window.innerWidth - e.clientX; const minWidth = 400; const maxWidth = Math.min(900, window.innerWidth - 50); if (newWidth >= minWidth && newWidth <= maxWidth) settingsMenu.style.width = newWidth + "px"; }); // Increased max width
document.addEventListener("mouseup", function(e) { if (isResizing) { isResizing = false; document.body.style.cursor = "default"; } });

// --- Feedback Message Helpers ---
function showFeedback(element, message, isSuccess = true) { element.textContent = message; element.classList.remove('success', 'error'); element.classList.add(isSuccess ? 'success' : 'error'); element.style.display = 'block'; setTimeout(() => { if (element) element.style.display = 'none'; }, 3000); }
function showButtonFeedback(button, message = "Saved!", duration = 1500) { const originalText = button.textContent; button.textContent = message; button.classList.add('button-success'); button.disabled = true; setTimeout(() => { button.textContent = originalText; button.classList.remove('button-success'); button.disabled = false; }, duration); }

// --- LocalStorage Helpers ---
function loadSettings() {
    // Load Schedule
    const savedSchedule = localStorage.getItem("clockSchedule");
    if (savedSchedule) {
        try {
            const parsedSchedule = JSON.parse(savedSchedule);
            if (Array.isArray(parsedSchedule)) {
                // Ensure all items have necessary properties (backward compatibility)
                schedule = parsedSchedule.map(item => ({
                    label: item.label || "Unnamed",
                    start: item.start || "00:00",
                    end: item.end || "00:00",
                    colourSchemeId: item.colourSchemeId || 1,
                    showCircles: typeof item.showCircles === 'boolean' ? item.showCircles : false // Add default for showCircles
                }));
            }
        } catch (e) { console.error("Error parsing saved schedule.", e); }
    } else {
         // Ensure default schedule has showCircles
         schedule = schedule.map(item => ({ ...item, showCircles: typeof item.showCircles === 'boolean' ? item.showCircles : false }));
    }

    // Load Preferences
    const savedPrefs = localStorage.getItem("clockPreferences");
    if (savedPrefs) {
        try {
            const loadedPreferences = JSON.parse(savedPrefs);
            if (typeof loadedPreferences === 'object' && loadedPreferences !== null) {
                 // Merge loaded prefs with defaults, ensuring all keys exist
                 preferences = {
                      ...JSON.parse(JSON.stringify(defaultPreferences)), // Start with fresh defaults
                      ...loadedPreferences, // Override with loaded values
                      // Deep merge nested objects if needed (only defaultAlertSettings here)
                      defaultAlertSettings: {
                          colour: {
                              ...defaultPreferences.defaultAlertSettings.colour,
                              ...(loadedPreferences.defaultAlertSettings?.colour || {})
                          }
                      },
                      // Ensure colour schemes are valid
                      colourSchemes: (loadedPreferences.colourSchemes && Array.isArray(loadedPreferences.colourSchemes) && loadedPreferences.colourSchemes.length > 0
                          ? loadedPreferences.colourSchemes.map(s => ({
                              id: s.id || Date.now(), // Ensure ID exists
                              name: s.name || "Unnamed Scheme",
                              background: s.background || "#000000",
                              text: s.text || "#FFFFFF"
                            }))
                          : [...defaultPreferences.colourSchemes] // Fallback to defaults if empty/invalid
                      )
                 };
                 // Ensure boolean display preferences are correctly typed
                 preferences.showDate = typeof preferences.showDate === 'boolean' ? preferences.showDate : defaultPreferences.showDate;
                 preferences.showTime = typeof preferences.showTime === 'boolean' ? preferences.showTime : defaultPreferences.showTime;
                 preferences.showScheduleLabel = typeof preferences.showScheduleLabel === 'boolean' ? preferences.showScheduleLabel : defaultPreferences.showScheduleLabel;
                 preferences.showProgressBar = typeof preferences.showProgressBar === 'boolean' ? preferences.showProgressBar : defaultPreferences.showProgressBar;
                 preferences.showScheduleCircles = typeof preferences.showScheduleCircles === 'boolean' ? preferences.showScheduleCircles : defaultPreferences.showScheduleCircles;
                 preferences.showSandBars = typeof preferences.showSandBars === 'boolean' ? preferences.showSandBars : defaultPreferences.showSandBars;
                 // Clean up old properties if they exist
                 delete preferences.backgroundColor; // Old property
                 preferences.colourSchemes.forEach(s => { delete s.accent; }); // Old property
                 if (preferences.defaultAlertSettings.noise) delete preferences.defaultAlertSettings.noise; // Old property

            } else { preferences = JSON.parse(JSON.stringify(defaultPreferences)); }
        } catch (e) { console.error("Error parsing saved preferences.", e); preferences = JSON.parse(JSON.stringify(defaultPreferences)); }
    } else { preferences = JSON.parse(JSON.stringify(defaultPreferences)); }

    // Load Alerts
    const savedAlerts = localStorage.getItem("clockAlerts");
    if (savedAlerts) {
        try {
            alertsSettings = JSON.parse(savedAlerts) || {};
            if (typeof alertsSettings !== 'object' || alertsSettings === null) alertsSettings = {};
            // Clean up old alert types (noise)
            Object.keys(alertsSettings).forEach(key => {
                if (alertsSettings[key]?.noise) { delete alertsSettings[key].noise; }
                // Remove empty alert entries
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


    updatePreferenceInputs(); // Update sidebar inputs
    renderScheduleTable();    // Render schedule with new column/data
    renderColourSchemeTabs(); // Render color schemes
    updateOffsetDisplay();    // Show current time offset
    updateLayout();           // Apply initial layout based on prefs
    updateClock();            // Start the clock cycle
}

function saveSettings() {
    // Clean empty alert settings before saving
    Object.keys(alertsSettings).forEach(key => {
        if (alertsSettings[key] && typeof alertsSettings[key] === 'object' && Object.keys(alertsSettings[key]).length === 0) {
             delete alertsSettings[key];
        }
    });
    // Clean schedule items (e.g., remove temporary properties if any)
    const scheduleToSave = schedule.map(item => ({
         label: item.label,
         start: item.start,
         end: item.end,
         colourSchemeId: item.colourSchemeId,
         showCircles: item.showCircles
         // Don't save temporary things like 'originalIndex' if added elsewhere
    }));

    localStorage.setItem("clockSchedule", JSON.stringify(scheduleToSave));
    localStorage.setItem("clockPreferences", JSON.stringify(preferences));
    localStorage.setItem("clockAlerts", JSON.stringify(alertsSettings));
    console.log("Settings saved.");
}

// Update Appearance tab inputs (including new checkboxes)
function updatePreferenceInputs() {
  // Font & Size
  document.getElementById("pref-font").value = preferences.fontFamily;
  document.getElementById("pref-date-font").value = preferences.dateFontSize;
  document.getElementById("pref-time-font").value = preferences.timeFontSize;
  document.getElementById("pref-schedule-label-font").value = preferences.scheduleLabelFontSize;
  document.getElementById("pref-time-left-font").value = preferences.timeLeftFontSize;
  document.getElementById("pref-progress-height").value = preferences.progressBarHeight;

  // Display Element Checkboxes
  document.getElementById("pref-show-date").checked = preferences.showDate;
  document.getElementById("pref-show-time").checked = preferences.showTime;
  document.getElementById("pref-show-schedule-label").checked = preferences.showScheduleLabel;
  document.getElementById("pref-show-progress-bar").checked = preferences.showProgressBar;
  document.getElementById("pref-show-schedule-circles").checked = preferences.showScheduleCircles;
  document.getElementById("pref-show-sand-bars").checked = preferences.showSandBars;
}

// --- Preference Input Listeners (Appearance Tab) ---
function attachPreferenceListeners() {
    // Font Select
    document.getElementById("pref-font").addEventListener("input", function() { preferences.fontFamily = this.value; applyFontAndSizePreferences(); saveSettings(); });

    // Number Inputs with Custom Buttons + Hold Functionality (Existing Logic - ensure it works)
    document.querySelectorAll('.number-input-wrapper').forEach(wrapper => {
        const input = wrapper.querySelector('input[type="number"]');
        const minusBtn = wrapper.querySelector('.num-btn.minus');
        const plusBtn = wrapper.querySelector('.num-btn.plus');
        // Make sure input.id exists before processing
        if (!input || !input.id) {
            console.warn("Skipping number input wrapper with missing input or ID.");
            return;
        }
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
                const min = input.min ? parseInt(input.min, 10) : -Infinity;
                const max = input.max ? parseInt(input.max, 10) : Infinity;
                let parsedValue = parseInt(newValue, 10);
                // Use default value if parsing fails or is NaN
                 parsedValue = isNaN(parsedValue) ? defaultPreferences[prefName] : Math.max(min, Math.min(max, parsedValue)); // Clamp value

                preferences[prefName] = parsedValue;
                input.value = parsedValue; // Update input visually
                applyFontAndSizePreferences(); // Apply change visually
                saveSettings(); // Save on each programmatic change too
            } else {
                 console.warn(`No preference mapping found for key: ${prefKey}`);
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
        input.addEventListener("input", () => { /* Could add live update here if needed, but change is usually sufficient */ });


        // Button listeners with hold support
        minusBtn.addEventListener("mousedown", () => startRepeating(-(parseInt(input.step) || 1)));
        plusBtn.addEventListener("mousedown", () => startRepeating(parseInt(input.step) || 1));

        // Stop repeating on mouseup or leaving the button area
        const stopEvents = ["mouseup", "mouseleave", "blur", "touchend", "touchcancel"];
        stopEvents.forEach(event => {
             minusBtn.addEventListener(event, stopRepeating);
             plusBtn.addEventListener(event, stopRepeating);
        });
    });

    // Display Element Checkbox Listeners
    document.querySelectorAll('#display-elements-checklist input[type="checkbox"]').forEach(checkbox => {
         checkbox.addEventListener('change', function() {
             const prefName = this.dataset.pref;
             if (prefName && preferences.hasOwnProperty(prefName)) {
                 preferences[prefName] = this.checked;

                 // Special handling: If Sand Bars are turned on, turn off Progress Bar
                 if (prefName === 'showSandBars' && this.checked) {
                      if (preferences.showProgressBar) {
                           preferences.showProgressBar = false;
                           document.getElementById('pref-show-progress-bar').checked = false;
                      }
                 }
                 // If Progress Bar is turned on, turn off Sand Bars
                 if (prefName === 'showProgressBar' && this.checked) {
                      if (preferences.showSandBars) {
                           preferences.showSandBars = false;
                           document.getElementById('pref-show-sand-bars').checked = false;
                      }
                 }

                 updateLayout(); // Apply layout changes immediately
                 // Re-setup sandbars if toggled on/off during an active period
                  const periodInfo = getCurrentPeriod(getCurrentOffsetTime());
                  if (periodInfo && prefName === 'showSandBars') {
                      const periodDuration = periodInfo.end.getTime() - periodInfo.start.getTime();
                      if(this.checked) {
                          setupSandBars(periodDuration);
                          updateSandBars(getCurrentOffsetTime().getTime() - periodInfo.start.getTime(), periodDuration); // Update immediately
                      } else {
                           setupSandBars(0); // Clear sand bars if turned off
                      }
                  } else if (!periodInfo && prefName === 'showSandBars' && this.checked) {
                      setupSandBars(0); // Ensure cleared if toggled on outside a period
                  }

                 saveSettings();
             }
         });
    });


    // Reset Buttons
    const resetAppearanceBtn = document.getElementById('reset-appearance-defaults'); if (resetAppearanceBtn) { resetAppearanceBtn.addEventListener('click', () => { if (confirm("Reset Font & Size settings to defaults?")) { preferences.fontFamily = defaultPreferences.fontFamily; preferences.dateFontSize = defaultPreferences.dateFontSize; preferences.timeFontSize = defaultPreferences.timeFontSize; preferences.scheduleLabelFontSize = defaultPreferences.scheduleLabelFontSize; preferences.timeLeftFontSize = defaultPreferences.timeLeftFontSize; preferences.progressBarHeight = defaultPreferences.progressBarHeight; updatePreferenceInputs(); applyFontAndSizePreferences(); saveSettings(); showButtonFeedback(resetAppearanceBtn, "Reset!"); } }); }
    const resetSchemesBtn = document.getElementById('reset-schemes-defaults'); if (resetSchemesBtn) { resetSchemesBtn.addEventListener('click', () => { if (confirm("Reset ALL Colour Schemes to the defaults? This cannot be undone.")) { preferences.colourSchemes = JSON.parse(JSON.stringify(defaultPreferences.colourSchemes)); schedule.forEach(item => item.colourSchemeId = 1); renderScheduleTable(); renderColourSchemeTabs(); updateLayout(); updateClock(); saveSettings(); showButtonFeedback(resetSchemesBtn, "Reset!"); } }); }
}
attachPreferenceListeners(); // Call the function

// --- Colour Scheme Management (Simplified - unchanged functionally) ---
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
    <label>Main Text Colour (Date, Time, Label, Progress, Active Circles): <input type="color" id="scheme-text-color" value="${scheme.text || '#ffffff'}"></label>
    <button id="save-scheme-settings" data-index="${index}">Save Scheme</button>
    ${preferences.colourSchemes.length > 1 ? `<button id="delete-scheme" data-index="${index}" ${scheme.id === 1 || scheme.id === 2 ? 'disabled title="Cannot delete default schemes"' : ''}>Delete Scheme</button>` : ''}
     <div class="feedback-message" style="display: none;"></div></div>`; // Prevent deleting last scheme, disable for defaults
// Re-attach listener after innerHTML change
contentContainer.removeEventListener('input', handleSchemeFormInput); // Use input for live updates
contentContainer.addEventListener('input', handleSchemeFormInput); // Live update name/color
contentContainer.removeEventListener('click', handleSchemeFormClick);
contentContainer.addEventListener('click', handleSchemeFormClick);
}
// Separate handler for input changes (live update)
function handleSchemeFormInput(e) {
    const target = e.target;
    const form = target.closest('.colour-scheme-form');
    const saveButton = form?.querySelector('#save-scheme-settings');
    if (!saveButton) return;
    const index = saveButton.getAttribute('data-index');

    if (index !== null && (target.id === 'scheme-name' || target.id === 'scheme-bg-color' || target.id === 'scheme-text-color')) {
        const idx = parseInt(index, 10);
        if (idx >= 0 && idx < preferences.colourSchemes.length) {
            if (target.id === 'scheme-name') preferences.colourSchemes[idx].name = target.value;
            if (target.id === 'scheme-bg-color') preferences.colourSchemes[idx].background = target.value;
            if (target.id === 'scheme-text-color') preferences.colourSchemes[idx].text = target.value;

            // Update tab button text live
            const tabButton = document.querySelector(`#colour-scheme-tabs .colour-tab[data-index="${idx}"]`);
            if (tabButton && target.id === 'scheme-name') {
                tabButton.textContent = target.value || `Scheme ${preferences.colourSchemes[idx].id}`;
            }
            // Apply changes live to the clock background/text if this scheme is active
            updateClock();
            // Note: Save still happens on button click
        }
    }
}

function handleSchemeFormClick(e) {
  const target = e.target; const index = target.getAttribute('data-index'); const feedbackEl = target.closest('.colour-scheme-form')?.querySelector('.feedback-message');
  if (target.id === 'save-scheme-settings' && index !== null) {
      const idx = parseInt(index, 10);
      // Data already updated by handleSchemeFormInput, just save
      saveSettings();
      // No need to re-render tabs, name updated live
      // renderColourSchemeTabs(); // Re-rendering clears input focus, avoid if possible
      updateClock(); // Ensure final state applied
      const currentTabButton = document.querySelector(`#colour-scheme-tabs .colour-tab[data-index="${idx}"]`); if(currentTabButton){ document.querySelectorAll(".colour-tab").forEach(btn => btn.classList.remove("active")); currentTabButton.classList.add("active"); }
      showButtonFeedback(target, "Saved!");
  } else if (target.id === 'delete-scheme' && index !== null) {
      const idx = parseInt(index, 10);
      const schemeToDelete = preferences.colourSchemes[idx];
      if (schemeToDelete && schemeToDelete.id !== 1 && schemeToDelete.id !== 2 && preferences.colourSchemes.length > 1) { // Check default IDs and ensure not last scheme
           if (confirm(`Delete scheme "${schemeToDelete.name || `Scheme ${idx + 1}`}"? Periods using it will revert to Scheme 1.`)) {
                const deletedSchemeId = schemeToDelete.id;
                preferences.colourSchemes.splice(idx, 1);
                schedule.forEach(item => { if (item.colourSchemeId === deletedSchemeId) item.colourSchemeId = 1; });
                saveSettings(); renderScheduleTable(); renderColourSchemeTabs(); updateClock();
           }
      } else {
           alert("Cannot delete default schemes or the last remaining scheme.");
      }
  }
}


/**********************************
* Schedule Table (Schedule & Alerts Tab)
**********************************/
const scheduleTableBody = document.querySelector("#schedule-table tbody");
let selectedRowIndex = null;

function renderScheduleTable() { // Added Schedule Circles Checkbox
    if (!scheduleTableBody) return;
    scheduleTableBody.innerHTML = "";
    const activeScheme = getActiveColourScheme(); // For styling swatches

    schedule.forEach((item, index) => {
        const tr = document.createElement("tr"); tr.dataset.index = index; tr.setAttribute("draggable", "true");
        if (index === selectedRowIndex) { tr.classList.add("selected"); } // Restore selection visually

        // Drag Handle
        const dragTd = document.createElement("td"); dragTd.innerHTML = "☰"; dragTd.className = "drag-handle"; tr.appendChild(dragTd);

        // Label
        const labelTd = document.createElement("td"); const labelInput = document.createElement("input"); labelInput.type = "text"; labelInput.value = item.label || ""; labelInput.addEventListener("change", function() { schedule[index].label = this.value; saveSettings(); updateClock(); /* Update label live */ }); labelTd.appendChild(labelInput); tr.appendChild(labelTd);

        // Start Time
        const startTd = document.createElement("td"); const startInput = document.createElement("input"); startInput.type = "time"; startInput.value = item.start || "00:00"; startInput.addEventListener("change", function() { schedule[index].start = this.value; saveSettings(); updateClock(); /* Recalculate period */ }); startTd.appendChild(startInput); tr.appendChild(startTd);

        // End Time
        const endTd = document.createElement("td"); const endInput = document.createElement("input"); endInput.type = "time"; endInput.value = item.end || "00:00"; endInput.addEventListener("change", function() { schedule[index].end = this.value; saveSettings(); updateClock(); /* Recalculate period */ }); endTd.appendChild(endInput); tr.appendChild(endTd);

        // Colour Scheme Swatch
        const schemeTd = document.createElement("td"); const swatch = document.createElement("div"); swatch.className = "scheme-swatch"; const scheme = preferences.colourSchemes.find(s => s.id === item.colourSchemeId) || preferences.colourSchemes.find(s=>s.id===1) || preferences.colourSchemes[0]; swatch.style.backgroundColor = scheme ? scheme.background : '#ff00ff'; swatch.style.borderColor = scheme ? scheme.text : '#ffffff'; // Use text color for border
        swatch.title = `Scheme: ${scheme ? scheme.name : 'Unknown'} (ID: ${item.colourSchemeId}). Click to cycle.`; swatch.addEventListener("click", (e) => { e.stopPropagation(); cycleSchemeForRow(index); }); schemeTd.appendChild(swatch);
        // const schemeIdSpan = document.createElement('span'); schemeIdSpan.textContent = `(${item.colourSchemeId})`; schemeIdSpan.style.fontSize = '0.8em'; schemeIdSpan.style.marginLeft = '3px'; schemeTd.appendChild(schemeIdSpan); // ID display optional
        tr.appendChild(schemeTd);

        // Visual Alert Button
        const alertTd = document.createElement("td"); const visualAlertBtn = document.createElement("button"); const isAlertEnabled = alertsSettings[index]?.colour?.enabled; visualAlertBtn.innerHTML = isAlertEnabled ? '🔴' : '🟢'; visualAlertBtn.title = `Visual Alert: ${isAlertEnabled ? 'Enabled' : 'Disabled'}. Click to edit.`; visualAlertBtn.className = "alert-edit-btn"; visualAlertBtn.addEventListener('click', (e) => { e.stopPropagation(); openAlertModal(index, 'colour'); }); alertTd.appendChild(visualAlertBtn); tr.appendChild(alertTd);

        // NEW: Schedule Circles Checkbox
        const circlesTd = document.createElement("td");
        const circlesCheckbox = document.createElement("input");
        circlesCheckbox.type = "checkbox";
        circlesCheckbox.checked = item.showCircles || false;
        circlesCheckbox.title = "Enable Schedule Circles display for this period";
        circlesCheckbox.addEventListener("change", function(e) {
            e.stopPropagation(); // Prevent row selection change
            schedule[index].showCircles = this.checked;
            saveSettings();
            renderScheduleCircles(); // Update display immediately
        });
        circlesTd.appendChild(circlesCheckbox);
        tr.appendChild(circlesTd);


        // Row Click for Selection
        tr.addEventListener("click", function(e) {
             // Allow clicks on interactive elements without deselecting/selecting row
             if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON" || e.target.classList.contains('scheme-swatch') || e.target.classList.contains('drag-handle')) {
                  // If clicking the currently selected row's controls, keep it selected
                 if(this.classList.contains('selected')) {
                     selectedRowIndex = index; // Ensure index is set correctly
                     return;
                 }
                 // Allow interaction but don't change row selection state here
                 // Let the specific element handler manage its state (like checkbox)
             } else {
                 // Clicked on non-interactive part of the row, handle selection
                 const prevSelected = scheduleTableBody.querySelector("tr.selected");
                 if (prevSelected) prevSelected.classList.remove("selected");
                 tr.classList.add("selected");
                 selectedRowIndex = index;
                 console.log("Selected row index:", selectedRowIndex);
             }
        });

        // Drag and Drop listeners
        tr.addEventListener("dragstart", dragStart); tr.addEventListener("dragover", dragOver); tr.addEventListener("dragleave", dragLeave); tr.addEventListener("drop", dragDrop); tr.addEventListener("dragend", dragEnd);

        scheduleTableBody.appendChild(tr);
    });
}


function cycleSchemeForRow(index) {
    const currentSchemeId = schedule[index].colourSchemeId || 1;
    const currentSchemeIndexInPrefs = preferences.colourSchemes.findIndex(s => s.id === currentSchemeId);
    let nextSchemeIndexInPrefs = (currentSchemeIndexInPrefs + 1) % preferences.colourSchemes.length;
    schedule[index].colourSchemeId = preferences.colourSchemes[nextSchemeIndexInPrefs]?.id || 1; // Fallback to scheme 1 if something goes wrong
    saveSettings();
    renderScheduleTable(); // Re-render to show new swatch
    updateClock(); // Apply new scheme if it's the active period
}

// --- Schedule Drag/Drop Handlers ---
let dragStartIndex;
function dragStart(e) {
    dragStartIndex = +this.dataset.index;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragStartIndex);
    this.classList.add('dragging');
    // If the dragged row wasn't selected, select it now
    if (!this.classList.contains('selected')) {
         const prevSelected = scheduleTableBody.querySelector("tr.selected");
         if (prevSelected) prevSelected.classList.remove("selected");
         this.classList.add("selected");
         selectedRowIndex = dragStartIndex;
    }
}
function dragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; this.classList.add('drag-over'); }
function dragLeave(e) { this.classList.remove('drag-over'); }
function dragDrop(e) {
    e.preventDefault();
    const dragEndIndex = +this.dataset.index;
    this.classList.remove('drag-over');

    if (dragStartIndex !== dragEndIndex) {
        // 1. Move item in schedule array
        const movedItem = schedule.splice(dragStartIndex, 1)[0];
        schedule.splice(dragEndIndex, 0, movedItem);

        // 2. Adjust alert settings keys
        const movedAlert = alertsSettings[dragStartIndex]; // Store alert from original position
        const tempAlerts = {};
        for (const key in alertsSettings) {
            const oldIdx = parseInt(key, 10);
            if (oldIdx === dragStartIndex) continue; // Skip the one we already stored

            let newIdx = oldIdx;
            if (dragStartIndex < oldIdx && dragEndIndex >= oldIdx) {
                newIdx--; // Item moved down past this one
            } else if (dragStartIndex > oldIdx && dragEndIndex <= oldIdx) {
                newIdx++; // Item moved up past this one
            }
            if (newIdx !== oldIdx) { // Only copy if index changed
                 tempAlerts[newIdx] = alertsSettings[key];
                 // Avoid copying over potentially existing index if not needed:
                 // delete alertsSettings[key]; // Careful here, might be complex if indices overlap immediately
            } else {
                 tempAlerts[oldIdx] = alertsSettings[key]; // Keep original if index didn't shift relative to move
            }
        }
         // Add the moved alert setting at the new index
        if (movedAlert) {
            tempAlerts[dragEndIndex] = movedAlert;
        }
        alertsSettings = tempAlerts; // Replace old alerts with adjusted ones


        // 3. Update selectedRowIndex
        selectedRowIndex = dragEndIndex;

        // 4. Re-render and save
        renderScheduleTable();
        saveSettings();
        updateClock(); // Update display in case period changed
    }
}

function dragEnd(e) {
    this.classList.remove('dragging');
    // Clear drag-over from all rows in case mouse left weirdly
    document.querySelectorAll('#schedule-table tbody tr').forEach(row => row.classList.remove('drag-over'));
}
// Add listener to table body to clear drag-over if mouse leaves the whole table body
scheduleTableBody.addEventListener('dragleave', function(e) {
    // Check if the relatedTarget (where the mouse is going) is outside the table body
    if (!scheduleTableBody.contains(e.relatedTarget)) {
         document.querySelectorAll('#schedule-table tbody tr.drag-over').forEach(row => row.classList.remove('drag-over'));
    }
});


// Add/Delete Schedule Rows
document.getElementById("add-schedule-row").addEventListener("click", () => {
    const newRow = { label: "New Period", start: "00:00", end: "00:00", colourSchemeId: 1, showCircles: false }; // Add showCircles default
    const insertIndex = (selectedRowIndex === null || selectedRowIndex < 0 || selectedRowIndex >= schedule.length)
                         ? schedule.length // Add to end if nothing selected or index invalid
                         : selectedRowIndex + 1; // Add below selected

    schedule.splice(insertIndex, 0, newRow);

    // Adjust alert settings keys for rows below the insertion point
    const newAlerts = {};
    for (const key in alertsSettings) {
        const oldIdx = parseInt(key, 10);
        newAlerts[oldIdx >= insertIndex ? oldIdx + 1 : oldIdx] = alertsSettings[key];
    }
    alertsSettings = newAlerts;

    selectedRowIndex = insertIndex; // Select the newly added row
    renderScheduleTable();
    saveSettings();
});

document.getElementById("delete-schedule-row").addEventListener("click", (e) => {
    if (selectedRowIndex !== null && selectedRowIndex >= 0 && selectedRowIndex < schedule.length) {
        if (confirm(`Delete row "${schedule[selectedRowIndex].label}"?`)) {
            schedule.splice(selectedRowIndex, 1); // Remove from schedule array

            // Adjust alert settings keys
            delete alertsSettings[selectedRowIndex]; // Remove alert for the deleted row
            const newAlerts = {};
            for (const key in alertsSettings) {
                const oldIdx = parseInt(key, 10);
                // Shift keys down if they were after the deleted row
                newAlerts[oldIdx > selectedRowIndex ? oldIdx - 1 : oldIdx] = alertsSettings[key];
            }
            alertsSettings = newAlerts; // Update the alerts object

            selectedRowIndex = null; // Deselect
            renderScheduleTable();
            saveSettings();
            updateClock(); // Update display
        }
    } else {
        showButtonFeedback(e.target, "Select Row First!", 2000);
    }
});


/**********************************
* Alert Modal Logic (Visual Only - Unchanged Functionally)
**********************************/
function openAlertModal(index, option = 'colour') {
    if (index === null || index < 0 || index >= schedule.length) return;
    const periodLabel = schedule[index].label || `Row ${index + 1}`;
    alertModalTitle.textContent = `Visual Alert Settings for "${periodLabel}"`;
    showAlertSettingsForm(index);
    alertModal.style.display = "block";
}
function closeAlertModal() { alertModal.style.display = "none"; alertModalBody.innerHTML = ""; }
alertModal.addEventListener('click', (event) => { if (event.target === alertModal || event.target === closeModalBtn) closeAlertModal(); });
closeModalBtn.addEventListener('click', closeAlertModal);

function showAlertSettingsForm(index) { // Updated duration handling & preview
  // Ensure default structure exists if no specific setting is saved yet
  const currentPeriodAlerts = {
       colour: {
           ...preferences.defaultAlertSettings.colour, // Start with global defaults
           ...(alertsSettings[index]?.colour || {}) // Override with specific settings if they exist
       }
  };
  const settings = currentPeriodAlerts.colour;
  // Use default duration if current setting is invalid or missing
  const durationInSeconds = ((settings.durationMs || preferences.defaultAlertSettings.colour.durationMs) / 1000);
  // Use default interval if current setting is invalid or missing
  const intervalValue = settings.intervalMs || preferences.defaultAlertSettings.colour.intervalMs;

  const formHTML = `
      <div class="alert-settings-form">
      <label><input type="checkbox" id="alert-colour-enabled" ${settings.enabled ? "checked" : ""}> Enable Visual Alert</label><hr>
      <label>Flash Background Colour: <input type="color" id="alert-bg-color" value="${settings.background}" ${!settings.enabled ? 'disabled' : ''}></label>
      <label>Flash Text Colour: <input type="color" id="alert-label-color" value="${settings.text}" ${!settings.enabled ? 'disabled' : ''}></label>
      <label>Flash Duration (s): <input type="number" id="alert-flash-duration-sec" min="0.5" max="10" step="0.1" value="${durationInSeconds.toFixed(1)}" ${!settings.enabled ? 'disabled' : ''}></label>
      <label>Flash Interval (ms): <input type="number" id="alert-flash-interval" min="100" max="2000" step="50" value="${intervalValue}" ${!settings.enabled ? 'disabled' : ''}></label>
      <div class="button-group">
          <button id="save-alert" data-index="${index}" data-option="colour">Save Visual Alert</button>
          <button id="preview-alert" data-option="colour" ${!settings.enabled ? 'disabled' : ''}>Preview Flash</button>
          <button id="remove-alert" data-index="${index}" data-option="colour" ${!alertsSettings[index]?.colour}>${settings.enabled ? 'Disable Alert' : 'Remove Custom Settings'}</button> <!-- Button text changes -->
      </div>
      <div class="feedback-message" style="display: none;"></div></div>`;
  alertModalBody.innerHTML = formHTML;

  const form = alertModalBody.querySelector('.alert-settings-form');
  const enableCheckbox = form.querySelector('#alert-colour-enabled');
  const saveButton = form.querySelector('#save-alert');
  const previewButton = form.querySelector('#preview-alert');
  const removeButton = form.querySelector('#remove-alert');
  const feedbackEl = form.querySelector('.feedback-message');
  const inputs = form.querySelectorAll('input:not([type="checkbox"]), select'); // Select all input types except checkbox

  const toggleControls = (enabled) => {
       inputs.forEach(input => input.disabled = !enabled);
       if (previewButton) previewButton.disabled = !enabled;
       // Enable remove button if there *are* settings, regardless of checkbox state
       if (removeButton) removeButton.disabled = !alertsSettings[index]?.colour;
       if (removeButton) removeButton.textContent = enabled ? 'Disable Alert' : (alertsSettings[index]?.colour ? 'Remove Custom Settings' : 'Using Defaults');
  };

  if (enableCheckbox) {
       enableCheckbox.addEventListener('change', (e) => {
            toggleControls(e.target.checked);
            // Update remove button text immediately on checkbox change
            if(removeButton) removeButton.textContent = e.target.checked ? 'Disable Alert' : (alertsSettings[index]?.colour ? 'Remove Custom Settings' : 'Using Defaults');
       });
       toggleControls(enableCheckbox.checked); // Initial state
  }

  // Save Button - Convert seconds back to ms
  if (saveButton) {
      saveButton.addEventListener('click', () => {
          const idx = parseInt(saveButton.getAttribute('data-index'), 10);
          if (isNaN(idx)) return;

          // Ensure the structure exists for this index
          if (!alertsSettings[idx]) alertsSettings[idx] = {};
          if (!alertsSettings[idx].colour) alertsSettings[idx].colour = {};

          // Get values, using defaults as fallback if parsing fails
          const durationSecInput = form.querySelector("#alert-flash-duration-sec").value;
          const intervalInput = form.querySelector("#alert-flash-interval").value;
          const defaultDurationMs = preferences.defaultAlertSettings.colour.durationMs;
          const defaultIntervalMs = preferences.defaultAlertSettings.colour.intervalMs;

          let durationSec = parseFloat(durationSecInput);
          durationSec = isNaN(durationSec) ? (defaultDurationMs / 1000) : Math.max(0.5, Math.min(10, durationSec));

          let intervalMs = parseInt(intervalInput, 10);
          intervalMs = isNaN(intervalMs) ? defaultIntervalMs : Math.max(100, Math.min(2000, intervalMs));


          // Save the data
          let savedData = {
              enabled: enableCheckbox.checked,
              background: form.querySelector("#alert-bg-color").value || preferences.defaultAlertSettings.colour.background,
              text: form.querySelector("#alert-label-color").value || preferences.defaultAlertSettings.colour.text,
              durationMs: Math.round(durationSec * 1000),
              intervalMs: intervalMs
          };

          alertsSettings[idx].colour = savedData;

          // Clean up if disabled AND matches defaults (optional, saves space)
          // const isDefault = savedData.background === preferences.defaultAlertSettings.colour.background &&
          //                   savedData.text === preferences.defaultAlertSettings.colour.text &&
          //                   savedData.durationMs === preferences.defaultAlertSettings.colour.durationMs &&
          //                   savedData.intervalMs === preferences.defaultAlertSettings.colour.intervalMs;
          // if (!savedData.enabled && isDefault) {
          //     delete alertsSettings[idx].colour;
          //     if(Object.keys(alertsSettings[idx]).length === 0) delete alertsSettings[idx];
          // }

          saveSettings();
          renderScheduleTable(); // Update 🟢/🔴 icon
          showButtonFeedback(saveButton, "Saved!");
          setTimeout(closeAlertModal, 1600);
      });
  }
  // Preview Button - Don't close modal
  if (previewButton) {
      previewButton.addEventListener('click', () => {
          // Ensure controls are enabled before previewing
           if (!enableCheckbox.checked) {
               showFeedback(feedbackEl, `Enable the alert first to preview.`, false);
               return;
           }
           const durationSec = parseFloat(form.querySelector("#alert-flash-duration-sec").value);
           let previewSettings = {
                enabled: true, // Force enabled for preview
                background: form.querySelector("#alert-bg-color").value,
                text: form.querySelector("#alert-label-color").value,
                durationMs: Math.round(durationSec * 1000),
                intervalMs: parseInt(form.querySelector("#alert-flash-interval").value, 10)
            };
           triggerVisualAlert(previewSettings);
           showFeedback(feedbackEl, `Previewing flash...`, true);
      });
  }
   // Remove/Disable Button
   if (removeButton) {
        removeButton.addEventListener('click', () => {
            const idx = parseInt(removeButton.getAttribute('data-index'), 10);
            if (isNaN(idx)) return;

            if (alertsSettings[idx]?.colour) { // Check if custom settings exist
                if (enableCheckbox.checked) {
                     // If currently enabled, just disable it
                     enableCheckbox.checked = false;
                     toggleControls(false);
                     // Update button text after disabling
                     removeButton.textContent = 'Remove Custom Settings';
                     removeButton.disabled = false; // Ensure it's enabled to allow removal now
                     showFeedback(feedbackEl, `Alert disabled. Click Save.`, true);
                } else {
                     // If currently disabled, but settings exist, remove them
                     if (confirm(`Remove custom visual alert settings for "${schedule[idx].label}"? It will revert to defaults.`)) {
                          delete alertsSettings[idx].colour;
                          if (Object.keys(alertsSettings[idx]).length === 0) {
                               delete alertsSettings[idx]; // Remove index key if empty
                          }
                          saveSettings();
                          renderScheduleTable(); // Update 🟢/🔴 icon
                          closeAlertModal();
                     }
                }
            } else {
                 // No custom settings exist
                 showFeedback(feedbackEl, `No custom settings to remove. Using defaults.`, true);
                 removeButton.disabled = true;
                 removeButton.textContent = 'Using Defaults';
            }
        });
   }
}