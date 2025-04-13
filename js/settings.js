/** js/settings.js */
import { Clock } from './clock.js';
import { Utils, getCurrentOffsetTime } from './utils.js';

export const Settings = {
    schedule: [ // Default schedule
        { label: "Before", start: "00:00", end: "08:50", colourSchemeId: 1, showCircles: false },
        { label: "Period 1", start: "08:50", end: "10:05", colourSchemeId: 1, showCircles: true },
        { label: "Break", start: "10:05", end: "10:15", colourSchemeId: 2, showCircles: false },
        { label: "Period 2", start: "10:15", end: "11:30", colourSchemeId: 1, showCircles: true },
        { label: "Lunch", start: "11:30", end: "12:20", colourSchemeId: 2, showCircles: false },
        { label: "Period 3", start: "12:20", end: "13:35", colourSchemeId: 1, showCircles: true },
        { label: "Break", start: "13:35", end: "13:45", colourSchemeId: 2, showCircles: false },
        { label: "Period 4", start: "13:45", end: "15:00", colourSchemeId: 1, showCircles: true },
        { label: "After", start: "15:00", end: "23:59", colourSchemeId: 1, showCircles: false }
    ],
    preferences: {}, // Populated by load()
    alerts: {},      // Populated by load()

    defaultPreferences: {
        fontFamily: "Atkinson Hyperlegible",
        dateFontSize: 64,
        timeFontSize: 200,
        scheduleLabelFontSize: 48,
        timeLeftFontSize: 40,
        progressBarHeight: 120,
        timeOffsetMs: 0,
        showDate: true,
        showTime: true,
        showScheduleLabel: true,
        showProgressBar: true,
        showScheduleCircles: false,
        showSandBars: false,
        // --- Sand Bar Preferences ---
        sandWidth: 80, // percentage
        sandHeight: 150, // pixels
        // sandDropInterval: 1000, // REMOVED
        sandParticleSize: 5, // pixels (radius)
        // -----------------------------
        colourSchemes: [
            { id: 1, name: "Default Dark", background: "#000000", text: "#FFFFFF" },
            { id: 2, name: "Default Light", background: "#F0F0F0", text: "#000000" }
        ],
        defaultAlertSettings: {
            colour: {
                enabled: false, background: "#ff0000", text: "#ffffff",
                durationMs: 1500, intervalMs: 500
            }
        }
    },

    load: function() {
        Settings.preferences = JSON.parse(JSON.stringify(Settings.defaultPreferences));
        const defaultScheduleCopy = JSON.parse(JSON.stringify(Settings.schedule));
        Settings.alerts = {};

        // --- Load Schedule ---
        const savedSchedule = localStorage.getItem("clockSchedule");
        let scheduleLoaded = false;
        if (savedSchedule) {
            try {
                const parsedSchedule = JSON.parse(savedSchedule);
                if (Array.isArray(parsedSchedule) && parsedSchedule.length > 0) {
                    Settings.schedule = parsedSchedule.map(item => ({
                        label: item.label || "Unnamed", start: item.start || "00:00", end: item.end || "00:00",
                        colourSchemeId: item.colourSchemeId || 1,
                        showCircles: typeof item.showCircles === 'boolean' ? item.showCircles : false
                    }));
                    scheduleLoaded = true;
                }
            } catch (e) { console.error("Error parsing saved schedule.", e); }
        }
        if (!scheduleLoaded) { Settings.schedule = defaultScheduleCopy; }

        // --- Load Preferences ---
        const savedPrefs = localStorage.getItem("clockPreferences");
        if (savedPrefs) {
            try {
                const loadedPreferences = JSON.parse(savedPrefs);
                if (typeof loadedPreferences === 'object' && loadedPreferences !== null) {
                    const tempPrefs = {
                        ...JSON.parse(JSON.stringify(Settings.defaultPreferences)),
                        ...loadedPreferences,
                        defaultAlertSettings: { colour: { ...Settings.defaultPreferences.defaultAlertSettings.colour, ...(loadedPreferences.defaultAlertSettings?.colour || {}) }},
                        colourSchemes: (loadedPreferences.colourSchemes && Array.isArray(loadedPreferences.colourSchemes) && loadedPreferences.colourSchemes.length > 0)
                          ? loadedPreferences.colourSchemes.map(s => ({ id: s.id || Date.now() + Math.random(), name: s.name || "Unnamed Scheme", background: s.background || "#000000", text: s.text || "#FFFFFF" }))
                          : Settings.defaultPreferences.colourSchemes
                    };
                    // Type checking booleans
                    for (const key of ['showDate', 'showTime', 'showScheduleLabel', 'showProgressBar', 'showScheduleCircles', 'showSandBars']) {
                         if (typeof tempPrefs[key] !== 'boolean') { tempPrefs[key] = Settings.defaultPreferences[key]; }
                    }
                    // Type checking numbers (excluding removed interval)
                    for (const key of ['dateFontSize', 'timeFontSize', 'scheduleLabelFontSize', 'timeLeftFontSize', 'progressBarHeight', 'sandWidth', 'sandHeight', 'sandParticleSize']) {
                        tempPrefs[key] = Number(tempPrefs[key]) || Settings.defaultPreferences[key];
                    }
                    tempPrefs.timeOffsetMs = Number(tempPrefs.timeOffsetMs) || 0;

                    // Clamp sandbar values after loading/setting defaults
                    tempPrefs.sandWidth = Math.max(10, Math.min(100, tempPrefs.sandWidth));
                    tempPrefs.sandHeight = Math.max(50, Math.min(800, tempPrefs.sandHeight)); // Match HTML max
                    tempPrefs.sandParticleSize = Math.max(1, Math.min(20, tempPrefs.sandParticleSize));

                    Settings.preferences = tempPrefs;
                }
            } catch (e) { console.error("Error parsing saved preferences.", e); }
        }

        // --- Load Alerts ---
        const savedAlerts = localStorage.getItem("clockAlerts");
        if (savedAlerts) {
            try {
                const parsedAlerts = JSON.parse(savedAlerts);
                if (typeof parsedAlerts === 'object' && parsedAlerts !== null) {
                    Settings.alerts = parsedAlerts;
                    Object.keys(Settings.alerts).forEach(key => {
                        if (Settings.alerts[key]?.noise) delete Settings.alerts[key].noise;
                        if (Settings.alerts[key] && typeof Settings.alerts[key] === 'object' && Object.keys(Settings.alerts[key]).length === 0) {
                            delete Settings.alerts[key];
                        }
                    });
                }
            } catch (e) { console.error("Error parsing saved alerts settings.", e); }
        }
        console.log("Settings loaded");
    },

    save: function() {
        try {
             // Make sure to remove the sandDropInterval if it somehow exists before saving
             if (Settings.preferences.hasOwnProperty('sandDropInterval')) {
                 delete Settings.preferences.sandDropInterval;
             }
            const alertsToSave = {};
            Object.keys(Settings.alerts).forEach(key => {
                if (Settings.alerts[key] && typeof Settings.alerts[key] === 'object' && Object.keys(Settings.alerts[key]).length > 0) {
                    alertsToSave[key] = Settings.alerts[key];
                }
            });
            const scheduleToSave = Settings.schedule.map(item => ({
                label: item.label, start: item.start, end: item.end,
                colourSchemeId: item.colourSchemeId, showCircles: item.showCircles
            }));
            localStorage.setItem("clockSchedule", JSON.stringify(scheduleToSave));
            localStorage.setItem("clockPreferences", JSON.stringify(Settings.preferences));
            localStorage.setItem("clockAlerts", JSON.stringify(alertsToSave));
        } catch (e) { console.error("Error saving settings:", e); }
    },

    getActiveColourScheme: function() {
        const now = getCurrentOffsetTime();
        // Ensure Clock module is defined before calling its method
        const currentPeriod = typeof Clock !== 'undefined' ? Clock.getCurrentPeriodInfo(now) : null;
        let schemeId = 1;
        if (currentPeriod && currentPeriod.index !== undefined && Settings.schedule[currentPeriod.index]) {
            const scheduleItem = Settings.schedule[currentPeriod.index];
            if (scheduleItem.colourSchemeId) { schemeId = scheduleItem.colourSchemeId; }
        }
        const schemes = Settings.preferences?.colourSchemes || Settings.defaultPreferences.colourSchemes;
        let foundScheme = schemes.find(s => s.id === schemeId);
        if (!foundScheme) foundScheme = schemes.find(s => s.id === 1);
        if (!foundScheme) foundScheme = schemes[0];
        return foundScheme || { id: 0, name: "Error", background: "#ff00ff", text: "#000000" };
    }
};