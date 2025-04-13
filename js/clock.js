/** js/clock.js */
import { Utils, getCurrentOffsetTime } from './utils.js';
import { Settings } from './settings.js';
import { Layout } from './layout.js';
import { Alerts } from './alerts.js';
import { Visuals } from './visuals.js';
import { State } from './state.js';
import { DOM } from './dom.js';

export const Clock = {
    updateIntervalId: null,

    start: function() {
        if (Clock.updateIntervalId) clearInterval(Clock.updateIntervalId);
        Clock.updateIntervalId = setInterval(Clock.update, 1000); // Update every second
        Clock.update(); // Initial call immediately
        console.log("Clock started.");
    },

    stop: function() {
         if (Clock.updateIntervalId) {
              clearInterval(Clock.updateIntervalId);
              Clock.updateIntervalId = null;
              console.log("Clock stopped.");
         }
    },

    // This needs to be callable early, potentially before full init, handle gracefully
    getCurrentPeriodInfo: function(now) {
        // Check if Settings and its schedule are initialized
        if (!Settings.schedule || Settings.schedule.length === 0) {
            // console.warn("Schedule not ready for period check."); // Reduce noise
            return null;
        }

        for (let i = 0; i < Settings.schedule.length; i++) {
            const period = Settings.schedule[i];
            // Basic check for valid period structure
            if (!period || typeof period.start !== 'string' || typeof period.end !== 'string') continue;

            try {
                const startTime = Utils.getTodayTime(period.start);
                const endTime = Utils.getTodayTime(period.end);
                let adjustedEndTime = new Date(endTime.getTime());
                let isOvernight = false;

                // Handle overnight periods (end time is on the next day or is 00:00)
                if (endTime.getTime() <= startTime.getTime()) {
                     isOvernight = true;
                     // If end is exactly 00:00, it means the end of the start day (24:00)
                     if (endTime.getHours() === 0 && endTime.getMinutes() === 0 && endTime.getSeconds() === 0) {
                          adjustedEndTime = Utils.getTodayTime(period.start); // Base on start date
                          adjustedEndTime.setDate(adjustedEndTime.getDate() + 1); // Go to next day
                          adjustedEndTime.setHours(0, 0, 0, 0); // Set to midnight
                     } else {
                         // End time is simply on the next calendar day
                          adjustedEndTime.setDate(adjustedEndTime.getDate() + 1);
                     }
                }

                let isActive = false;
                 // Check if 'now' is within the period boundaries
                 if (isOvernight) {
                     // Check if now is between start and midnight OR between start-of-next-day and adjusted end time
                     const midnightAfterStart = new Date(startTime);
                     midnightAfterStart.setHours(24, 0, 0, 0); // Midnight ending the day `startTime` is on
                     const startOfNextDay = new Date(startTime);
                     startOfNextDay.setDate(startOfNextDay.getDate() + 1);
                     startOfNextDay.setHours(0,0,0,0);

                     if ((now >= startTime && now < midnightAfterStart) || (now >= startOfNextDay && now < adjustedEndTime)) {
                         isActive = true;
                     }
                 } else {
                     // Normal period within the same day
                     if (now >= startTime && now < adjustedEndTime) {
                         isActive = true;
                     }
                 }


                // Specific check for periods ending exactly at 23:59 - include the whole minute
                if (!isActive && (period.end === "23:59" || period.end === "23:59:59")) {
                    const endOfDay = new Date(startTime); // Base on start day
                    endOfDay.setHours(23, 59, 59, 999);
                    if (now >= startTime && now <= endOfDay) {
                         isActive = true;
                         adjustedEndTime = endOfDay; // Ensure end time covers the last second
                    }
                }

                if (isActive) {
                     // Return info for the *first* active period found
                     return { label: period.label, start: startTime, end: adjustedEndTime, index: i };
                }
            } catch (e) {
                 // Log error but continue checking other periods
                 console.error("Error processing period:", period?.label, period?.start, period?.end, e);
            }
        }
        return null; // No active period found
    },

    update: function() {
        // Ensure critical modules are available
        if (!Settings || !Layout || !Alerts || !Visuals || !State || !DOM) {
            console.error("Core modules not available in Clock.update");
            return;
        }

        const now = getCurrentOffsetTime();
        const activeScheme = Settings.getActiveColourScheme();

        Layout.update(); // Apply layout (visibility, font sizes)

        if (!State.activeVisualAlertInterval) {
             Alerts.restoreOriginalStyles(activeScheme); // Apply non-alert colors/styles
        }

        // Update Core Displays (Time, Date)
        if (Settings.preferences.showTime && DOM.timeEl) DOM.timeEl.textContent = Utils.formatTime(now);
        if (Settings.preferences.showDate && DOM.dateEl) DOM.dateEl.textContent = Utils.formatDate(now);

        // Update Visualizations (Circles)
        // Sand bar physics runs independently, particle adding is interval-based
        Visuals.update(now); // Renders circles if enabled

        const periodInfo = Clock.getCurrentPeriodInfo(now);

        // --- Detect Period Change ---
        const newPeriodIndex = periodInfo ? periodInfo.index : null;
        if (newPeriodIndex !== State.currentPeriodIndex) {
             const previousPeriodIndex = State.currentPeriodIndex; // Store for logging/debugging if needed
            // console.log(`Period changed from index ${previousPeriodIndex} to ${newPeriodIndex} (${periodInfo?.label || 'None'})`);
            State.currentPeriodLabel = periodInfo ? periodInfo.label : null;
            State.currentPeriodIndex = newPeriodIndex;

            // Trigger Alert if needed for the new period
            if (periodInfo && Settings.alerts[periodInfo.index]?.colour?.enabled) {
                Alerts.triggerVisualAlert(Settings.alerts[periodInfo.index].colour);
            } else if (State.activeVisualAlertInterval) {
                 // If entering a gap or period without alert, clear active alert
                 Alerts.clearVisualAlert();
                 Alerts.restoreOriginalStyles(); // Restore styles for the gap/new period
            }

            // Let Visuals module handle state changes related to the period change (e.g., sandbars)
            Visuals.handlePeriodChange(periodInfo);
        }

        // Update display elements related to the current period (Label, CSS Progress)
        Clock.updatePeriodDisplay(now, periodInfo);
    },

    updatePeriodDisplay: function(now, periodInfo) {
        // Ensure DOM is ready
        if (!DOM.periodLabelEl) return;

        if (periodInfo) {
            // --- Update Label ---
            if (Settings.preferences.showScheduleLabel) {
                 DOM.periodLabelEl.textContent = periodInfo.label;
            } else {
                 DOM.periodLabelEl.textContent = ''; // Clear if pref hidden
            }

            // --- Update CSS Progress Bar & Time Left ---
            // Only update if the standard progress bar is the active one
            if (Settings.preferences.showProgressBar && !Settings.preferences.showSandBars) {
                 if (DOM.progressEl && DOM.progressBarEl && DOM.timeLeftEl) {
                     const periodStartMs = periodInfo.start.getTime();
                     const periodEndMs = periodInfo.end.getTime();
                     const nowMs = now.getTime();
                     const periodDuration = periodEndMs - periodStartMs;
                     const timeElapsed = Math.max(0, nowMs - periodStartMs);

                     if (periodDuration > 0) {
                         const progressPercent = Math.min(100, Math.max(0, (timeElapsed / periodDuration) * 100));
                         DOM.progressEl.style.width = progressPercent + "%";

                         const progressBarWidth = DOM.progressBarEl.offsetWidth;
                          // Get actual width, provide fallback if not rendered yet
                         const timeLeftWidth = DOM.timeLeftEl.offsetWidth > 0 ? DOM.timeLeftEl.offsetWidth : 60;
                         let finalLeft = (progressPercent / 100) * progressBarWidth - (timeLeftWidth / 2);
                         // Clamp left position to prevent going off edges
                         finalLeft = Math.max(0, Math.min(progressBarWidth - timeLeftWidth, finalLeft));
                         DOM.timeLeftEl.style.left = finalLeft + "px";

                         const timeLeftMs = Math.max(0, periodEndMs - nowMs);
                         const timeLeftSec = Math.floor(timeLeftMs / 1000);
                         const minutes = Math.floor(timeLeftSec / 60);
                         const seconds = timeLeftSec % 60;
                         DOM.timeLeftEl.textContent = `${minutes}:${seconds < 10 ? "0" + seconds : seconds}`;
                     } else { // Handle zero/negative duration
                         DOM.progressEl.style.width = (nowMs >= periodStartMs) ? "100%" : "0%";
                         DOM.timeLeftEl.textContent = "0:00";
                         const progressBarWidth = DOM.progressBarEl.offsetWidth;
                         const timeLeftWidth = DOM.timeLeftEl.offsetWidth > 0 ? DOM.timeLeftEl.offsetWidth : 60;
                         DOM.timeLeftEl.style.left = `${progressBarWidth - timeLeftWidth}px`; // Position at end
                     }
                 }
            } else {
                 // Clear standard progress/timeleft if sandbars are active
                  if (DOM.progressEl) DOM.progressEl.style.width = "0%";
                  if (DOM.timeLeftEl) DOM.timeLeftEl.textContent = "";
            }

        } else {
             // --- No Active Period ---
             if (DOM.periodLabelEl) DOM.periodLabelEl.textContent = "";
             // Clear standard progress bar if it's enabled by preference
             if (DOM.progressEl && Settings.preferences.showProgressBar) DOM.progressEl.style.width = "0%";
             if (DOM.timeLeftEl && Settings.preferences.showProgressBar) DOM.timeLeftEl.textContent = "";
             // Physics bodies/intervals cleared via Visuals.handlePeriodChange
        }
    }
};