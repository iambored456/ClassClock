/** js/timeSync.js */
import { DOM } from './dom.js';
import { Settings } from './settings.js';
import { Clock } from './clock.js';
import { Utils, getCurrentOffsetTime } from './utils.js'; // Import specific offset func

export const TimeSync = {
     attachListeners: function() {
         DOM.syncToBellBtn?.addEventListener("click", TimeSync.syncToNearestBell);
         DOM.resetOffsetBtn?.addEventListener("click", TimeSync.resetOffset);
         // Attach listeners for manual offset buttons
         TimeSync.addManualOffsetListener(DOM.offsetMinDownBtn, -60000); // -1 minute
         TimeSync.addManualOffsetListener(DOM.offsetMinUpBtn, 60000);   // +1 minute
         TimeSync.addManualOffsetListener(DOM.offsetSecDownBtn, -1000);  // -1 second
         TimeSync.addManualOffsetListener(DOM.offsetSecUpBtn, 1000);   // +1 second
     },

     addManualOffsetListener: function(element, changeMs) {
          // Helper to add click listener for offset buttons
          if (element) {
              element.addEventListener("click", () => TimeSync.adjustOffset(changeMs));
          }
     },

     adjustOffset: function(changeMs) {
         // Ensure preference exists before modifying
         if (typeof Settings.preferences.timeOffsetMs !== 'number') {
             Settings.preferences.timeOffsetMs = 0;
         }
         Settings.preferences.timeOffsetMs += changeMs;
         TimeSync.updateOffsetDisplay(); // Update UI display
         Clock.update(); // Reflect time change immediately
         Settings.save(); // Persist the new offset
     },

     resetOffset: function() {
          // Reset offset to 0 if it's not already
          if (Settings.preferences.timeOffsetMs !== 0) {
              Settings.preferences.timeOffsetMs = 0;
              TimeSync.updateOffsetDisplay();
              Clock.update();
              Settings.save();
              Utils.showButtonFeedback(DOM.resetOffsetBtn, "Offset Reset!", 1500);
          } else {
              Utils.showButtonFeedback(DOM.resetOffsetBtn, "Already Zero!", 1000);
          }
     },

     syncToNearestBell: function() {
          // Sync clock to the nearest schedule start/end time
          if (!Settings.schedule || Settings.schedule.length === 0) {
              Utils.showButtonFeedback(DOM.syncToBellBtn, "Add Schedule First!", 2000);
              return;
          }

          const systemNow = new Date(); // Use actual system time for comparison base
          const systemNowMs = systemNow.getTime();
          let minDiff = Infinity;
          let nearestEventTime = null;

          Settings.schedule.forEach(period => {
              // Skip invalid periods
              if (!period || !period.start || !period.end || !/^\d{2}:\d{2}$/.test(period.start) || !/^\d{2}:\d{2}$/.test(period.end)) return;

              try {
                  const startTime = Utils.getTodayTime(period.start);
                  const endTime = Utils.getTodayTime(period.end);
                  const startTimeMs = startTime.getTime();
                  const endTimeMs = endTime.getTime();

                  // Calculate difference to start time
                  let diffStart = Math.abs(startTimeMs - systemNowMs);
                  if (diffStart < minDiff) {
                      minDiff = diffStart;
                      nearestEventTime = startTime;
                  }

                  // Calculate difference to end time, but only if it's not immediately followed by another start
                  const nextPeriodStartsAtEnd = Settings.schedule.some(p => p.start === period.end);
                  if (!nextPeriodStartsAtEnd) {
                      let diffEnd = Math.abs(endTimeMs - systemNowMs);
                      if (diffEnd < minDiff) {
                          minDiff = diffEnd;
                          nearestEventTime = endTime;
                      }
                  }
              } catch (e) {
                   // Log error but continue processing other periods
                   console.error("Sync error parsing time for period:", period.label, e);
              }
          });

          // If a nearest time was found, calculate and apply the offset
          if (nearestEventTime !== null) {
              const requiredOffsetMs = nearestEventTime.getTime() - systemNowMs;
              Settings.preferences.timeOffsetMs = requiredOffsetMs;
              TimeSync.updateOffsetDisplay();
              Clock.update(); // Update display immediately
              Settings.save();
              Utils.showButtonFeedback(DOM.syncToBellBtn, "Synced!");
          } else {
              // No suitable sync points found
              Utils.showButtonFeedback(DOM.syncToBellBtn, "No Valid Times!", 2000);
          }
     },

     updateOffsetDisplay: function() {
         // Update the offset display string in the UI
         const offsetMs = Number(Settings.preferences?.timeOffsetMs) || 0; // Safely access preference
         const totalSeconds = Math.round(offsetMs / 1000);
         const sign = totalSeconds >= 0 ? '+' : '-';
         const absSeconds = Math.abs(totalSeconds);
         const minutes = Math.floor(absSeconds / 60);
         const seconds = absSeconds % 60;
         const paddedSeconds = seconds < 10 ? '0' + seconds : seconds; // Ensure two digits for seconds
         const offsetString = `${sign}${minutes}m ${paddedSeconds}s`;
         if (DOM.currentOffsetDisplay) { // Check if element exists
             DOM.currentOffsetDisplay.textContent = offsetString;
         }
     }
};