/** js/visuals.js */
import { Settings } from './settings.js';
import { DOM } from './dom.js';
import { Clock } from './clock.js';
import { Utils, getCurrentOffsetTime } from './utils.js';
import { State } from './state.js';
import { Physics } from './physics.js';

export const Visuals = {
    update: function(now) {
        if (Settings.preferences.showScheduleCircles) {
            Visuals.renderScheduleCircles();
        } else if (DOM.scheduleCirclesDisplayEl) {
            DOM.scheduleCirclesDisplayEl.innerHTML = '';
        }
    },

    renderScheduleCircles: function() {
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

            // --- Revised Capacity & Total Particles Calculation ---
            const particleRadius = Settings.preferences?.sandParticleSize || 5;
            const particleArea = Math.PI * particleRadius * particleRadius;
            const segmentWidth = containerWidth / State.SAND_COLORS.length;
            // Usable area calculation needs to account for internal wall thickness for accuracy
            const wallThickness = 10; // Match the physics wall thickness
            const usableSegmentWidth = segmentWidth - wallThickness; // Approx width between walls
            const usableSegmentArea = usableSegmentWidth * (containerHeight - particleRadius * 2); // Area above floor level
            const packingDensity = 1; // **Adjust this factor (0.6 - 0.9) to tune 'fullness'**
            // Calculate based on area, ensure a minimum sensible number
            State.visualMaxParticlesPerSegment = Math.max(15, Math.floor((usableSegmentArea * packingDensity) / particleArea));
            State.totalParticlesForPeriod = State.visualMaxParticlesPerSegment * State.SAND_COLORS.length;
            console.log(`Est. Max Particles Per Segment: ${State.visualMaxParticlesPerSegment}, Total Target: ${State.totalParticlesForPeriod}`);
            // --- End Calculation ---

            Physics.init(DOM.sandBarsCanvas, containerWidth, containerHeight);
            Physics.start();
            Visuals.handleColorSchemeChange();

            const currentPeriod = Clock.getCurrentPeriodInfo(getCurrentOffsetTime());
            if (currentPeriod) {
                const periodStartMs = currentPeriod.start.getTime();
                const periodEndMs = currentPeriod.end.getTime();
                const periodDurationMs = periodEndMs - periodStartMs;

                if (periodDurationMs > 0) {
                    Visuals.checkAndAddParticles(); // Initial catch-up run
                    State.physicsCheckIntervalId = setInterval(Visuals.checkAndAddParticles, State.physicsCheckIntervalMs);
                } else { Physics.stop(); }
            } else { Physics.stop(); }
        });
    },

    checkAndAddParticles: function() {
        if (!Settings.preferences.showSandBars || !Physics.isRunning || State.totalParticlesForPeriod <= 0) {
            Visuals.stopPhysicsCheckInterval(); return;
        }
        const now = getCurrentOffsetTime();
        const periodInfo = Clock.getCurrentPeriodInfo(now);
        if (!periodInfo) { Visuals.stopPhysicsCheckInterval(); return; }

        const periodStartMs = periodInfo.start.getTime();
        const periodEndMs = periodInfo.end.getTime();
        const periodDurationMs = periodEndMs - periodStartMs;
        if (periodDurationMs <= 0) { Visuals.stopPhysicsCheckInterval(); return; }

        const timeElapsedMs = Math.max(0, now.getTime() - periodStartMs);
        const totalFillPercentage = Math.min(1, timeElapsedMs / periodDurationMs);
        const targetTotalParticles = Math.floor(totalFillPercentage * State.totalParticlesForPeriod);

        // Add particles one by one if needed, up to the target
        if (targetTotalParticles > State.physicsParticlesAdded) {
             const segmentDuration = periodDurationMs / State.SAND_COLORS.length;
             const nextParticleIndex = State.physicsParticlesAdded;
             // Estimate time this specific particle represents
             const particleRepresentsTime = (nextParticleIndex + 0.5) / State.totalParticlesForPeriod * periodDurationMs;
             const segmentIndex = Math.min(Math.floor(particleRepresentsTime / segmentDuration), State.SAND_COLORS.length - 1);

            if (segmentIndex >= 0) {
                Physics.addParticle(segmentIndex, State.SAND_COLORS[segmentIndex]);
                State.physicsParticlesAdded++;
            }
        }
    },

    stopPhysicsCheckInterval: function() {
        if (State.physicsCheckIntervalId) {
            clearInterval(State.physicsCheckIntervalId);
            State.physicsCheckIntervalId = null;
        }
    },

    handlePeriodChange: function(periodInfo) {
        Visuals.setupPhysicsSandBars(periodInfo);
    },

    handleDisplayToggle: function() {
        const periodInfo = Clock.getCurrentPeriodInfo(getCurrentOffsetTime());
        Visuals.setupPhysicsSandBars(periodInfo);
    },

    handleColorSchemeChange: function() {
         if (DOM.sandBarsContainerEl) {
             const newColor = Settings.getActiveColourScheme().text || '#FFFFFF';
             const outlineDivs = DOM.sandBarsContainerEl.querySelectorAll('.sand-bar-outline-segment');
             outlineDivs.forEach(div => { div.style.borderColor = newColor; });
         }
         if(Settings.preferences.showScheduleCircles) {
              Visuals.renderScheduleCircles();
         }
     }
};