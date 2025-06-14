/** js/visuals.js */
import { Settings } from './settings.js';
import { DOM } from './dom.js';
import { Clock } from './clock.js';
import { Utils, getCurrentOffsetTime } from './utils.js';
import { State } from './state.js';
import { Physics } from './physics.js';

export const Visuals = {
    update: function(now) {
        // ... (rest of the update function remains the same)
        if (Settings.preferences.showScheduleCircles) {
            Visuals.renderScheduleCircles();
        } else if (DOM.scheduleCirclesDisplayEl) {
            DOM.scheduleCirclesDisplayEl.innerHTML = '';
        }
    },

    renderScheduleCircles: function() {
       // ... (renderScheduleCircles remains the same)
       if (!Settings.preferences.showScheduleCircles || !DOM.scheduleCirclesDisplayEl) {
           if(DOM.scheduleCirclesDisplayEl) DOM.scheduleCirclesDisplayEl.innerHTML = ''; return;
       }
       const now = getCurrentOffsetTime();
       const currentPeriodInfo = Clock.getCurrentPeriodInfo(now);
       const activeScheme = Settings.getActiveColourScheme();
       const circlePeriods = (Settings.schedule || [])
           .map((item, index) => ({ ...item, originalIndex: index }))
           .filter(item => item.showCircles);
       if (circlePeriods.length === 0) { DOM.scheduleCirclesDisplayEl.innerHTML = ''; return; }
       let currentCircleIndex = -1;
       if (currentPeriodInfo) {
           currentCircleIndex = circlePeriods.findIndex(p => p.originalIndex === currentPeriodInfo.index);
       }
       let html = '';
       for (let i = 0; i < circlePeriods.length; i++) {
           const isActive = currentCircleIndex >= i;
           const symbol = isActive ? '●' : '○';
           const cssClass = `schedule-circle-symbol ${isActive ? 'active' : 'inactive'}`;
           const color = isActive ? activeScheme.text : '#555';
           html += `<span class="${cssClass}" style="color: ${color};">${symbol}</span>`;
       }
       DOM.scheduleCirclesDisplayEl.innerHTML = html;
    },

    setupPhysicsSandBars: function(periodInfo) {
        Visuals.stopPhysicsCheckInterval();
        Physics.clearDynamicBodies();
        State.physicsParticlesAdded = 0;
        State.totalParticlesForPeriod = 0;

        if (!Settings.preferences.showSandBars || !DOM.sandBarsCanvas || !DOM.sandBarsContainerEl) {
            Physics.stop();
            return;
        }

        const heightPref = Settings.preferences?.sandHeight || 150;
        const widthPref = Settings.preferences?.sandWidth || 80;
        DOM.sandBarsContainerEl.style.height = `${heightPref}px`;
        DOM.sandBarsContainerEl.style.width = `${widthPref}%`;

        requestAnimationFrame(() => {
            const containerWidth = DOM.sandBarsContainerEl.offsetWidth;
            const containerHeight = DOM.sandBarsContainerEl.offsetHeight;

            if (containerWidth <= 0 || containerHeight <= 0) {
                console.warn("Sand bars container has zero dimensions after rAF. Aborting physics setup.");
                Physics.stop();
                return;
            }

            // --- Revised Capacity & Total Particles Calculation for HEXAGONS ---
            const particleRadius = Settings.preferences?.sandParticleSize || 5; // Center-to-vertex distance

            // --- CHANGE: Calculate area of a regular hexagon ---
            // Area = (3 * sqrt(3) / 2) * side^2. For hexagon, side = radius (center-to-vertex).
            const particleArea = (3 * Math.sqrt(3) / 2) * particleRadius * particleRadius;
            // --- End Change ---

            const segmentWidth = containerWidth / State.SAND_COLORS.length;
            const wallThickness = 15; // Match physics wall thickness for calculation
            const usableSegmentWidth = Math.max(0, segmentWidth - wallThickness); // Ensure non-negative
            // Estimate usable height slightly more conservatively
            const usableSegmentHeight = Math.max(0, containerHeight - particleRadius); // Only need buffer at bottom
            const usableSegmentArea = usableSegmentWidth * usableSegmentHeight;

            // --- CHANGE: Adjust packing density for hexagons ---
            // Hexagons pack denser than circles. Theoretical max is ~0.907.
            // Random packing is less, simulation packing even less precise.
            // Start with a value like 0.8 or 0.85, adjust based on visual results.
            const packingDensity = 0.85; // Adjusted from 1.1 (was too high even for circles)
            // --- End Change ---

            // Calculate based on area, ensure a minimum sensible number
            State.visualMaxParticlesPerSegment = Math.max(10, Math.floor((usableSegmentArea * packingDensity) / particleArea));
            State.totalParticlesForPeriod = State.visualMaxParticlesPerSegment * State.SAND_COLORS.length;
            console.log(`Est. Max Particles Per Segment (Hex): ${State.visualMaxParticlesPerSegment}, Total Target: ${State.totalParticlesForPeriod}, Particle Area: ${particleArea.toFixed(2)}`);
            // --- End Calculation ---

            Physics.init(DOM.sandBarsCanvas, containerWidth, containerHeight);
            Physics.start();
            Visuals.handleColorSchemeChange(); // Apply colors after init

            const currentPeriod = Clock.getCurrentPeriodInfo(getCurrentOffsetTime());
            if (currentPeriod) {
                const periodStartMs = currentPeriod.start.getTime();
                const periodEndMs = currentPeriod.end.getTime();
                const periodDurationMs = periodEndMs - periodStartMs;

                if (periodDurationMs > 0) {
                    Visuals.checkAndAddParticles(); // Initial catch-up run
                    State.physicsCheckIntervalId = setInterval(Visuals.checkAndAddParticles, State.physicsCheckIntervalMs);
                } else {
                    console.log("Period duration is zero or negative, stopping physics.");
                    Physics.stop();
                }
            } else {
                console.log("No current period found, stopping physics.");
                Physics.stop();
            }
        });
    },

    checkAndAddParticles: function() {
        if (!Settings.preferences.showSandBars || !Physics.isRunning || State.totalParticlesForPeriod <= 0) {
            Visuals.stopPhysicsCheckInterval(); return;
        }
        const now = getCurrentOffsetTime();
        const periodInfo = Clock.getCurrentPeriodInfo(now);
        if (!periodInfo) {
            // console.log("Period ended, stopping particle addition.");
            Visuals.stopPhysicsCheckInterval(); return;
         }

        const periodStartMs = periodInfo.start.getTime();
        const periodEndMs = periodInfo.end.getTime();
        const periodDurationMs = periodEndMs - periodStartMs;
        if (periodDurationMs <= 0) { Visuals.stopPhysicsCheckInterval(); return; } // Should not happen if started correctly

        const timeElapsedMs = Math.max(0, now.getTime() - periodStartMs);
        const totalFillPercentage = Math.min(1, timeElapsedMs / periodDurationMs);
        const targetTotalParticles = Math.floor(totalFillPercentage * State.totalParticlesForPeriod);

        // Determine how many particles to add *this interval* to catch up
        const particlesToAdd = targetTotalParticles - State.physicsParticlesAdded;

        // Add particles one by one if needed, up to the target
        // Limit additions per interval to prevent potential frame drops if catching up a lot
        const maxToAddThisTick = 5; // Adjust as needed for performance
        for (let i = 0; i < Math.min(particlesToAdd, maxToAddThisTick); ++i) {
             if (State.physicsParticlesAdded >= State.totalParticlesForPeriod) break; // Ensure we don't exceed total

             const segmentDuration = periodDurationMs / State.SAND_COLORS.length;
             const nextParticleIndex = State.physicsParticlesAdded;
             // Estimate time this specific particle represents
             const particleRepresentsTime = (nextParticleIndex + 0.5) / State.totalParticlesForPeriod * periodDurationMs;
             // Determine segment based on the *estimated time* the particle represents
             const segmentIndex = Math.min(State.SAND_COLORS.length - 1, Math.floor(particleRepresentsTime / segmentDuration));


            if (segmentIndex >= 0) {
                Physics.addParticle(segmentIndex, State.SAND_COLORS[segmentIndex]);
                State.physicsParticlesAdded++;
            }
        }

         // Stop adding if the period is complete visually
         if (State.physicsParticlesAdded >= State.totalParticlesForPeriod) {
            // console.log("Target particle count reached.");
            Visuals.stopPhysicsCheckInterval();
         }
    },

    stopPhysicsCheckInterval: function() {
        if (State.physicsCheckIntervalId) {
            clearInterval(State.physicsCheckIntervalId);
            State.physicsCheckIntervalId = null;
            // console.log("Physics check interval stopped.");
        }
    },

    handlePeriodChange: function(periodInfo) {
        console.log("Handling period change for physics sand bars.");
        Visuals.setupPhysicsSandBars(periodInfo);
    },

    handleDisplayToggle: function() {
        console.log("Handling display toggle for physics sand bars.");
        const periodInfo = Clock.getCurrentPeriodInfo(getCurrentOffsetTime());
        Visuals.setupPhysicsSandBars(periodInfo); // Re-setup based on current state
    },

    handleColorSchemeChange: function() {
         if (DOM.sandBarsContainerEl) {
             const newColor = Settings.getActiveColourScheme().text || '#FFFFFF';
             // If you add visual outlines independent of physics, update them here
             // const outlineDivs = DOM.sandBarsContainerEl.querySelectorAll('.sand-bar-outline-segment');
             // outlineDivs.forEach(div => { div.style.borderColor = newColor; });
         }
         if(Settings.preferences.showScheduleCircles) {
              Visuals.renderScheduleCircles();
         }
     }
};