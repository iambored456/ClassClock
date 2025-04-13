/** js/main.js */
// This is the main entry point for the application via Vite

import { App } from './app.js'; // Import the main App module

// Wait for the DOM to be fully loaded before initializing the application
// This ensures all HTML elements are available for the scripts to interact with
document.addEventListener('DOMContentLoaded', App.init);