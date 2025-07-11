
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App'; // Import the App component from src/App.tsx

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}

// Global styles string (extracted from the removed local App component)
const globalStyles = `
  body { 
    margin: 0; 
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; 
    -webkit-font-smoothing: antialiased; 
    -moz-osx-font-smoothing: grayscale; 
    background-color: #f0f2f5; 
    box-sizing: border-box;
  }
  #root { 
    width: 100%; 
    height: 100vh; 
    overflow: hidden; 
  }
  body.no-padding {
      padding: 0 !important;
  }
  body:not(.no-padding) {
      display: flex; 
      justify-content: center; 
      align-items: center; 
      min-height: 100vh;
      padding: 1rem; 
  }
  
  .terms-link { color: #10B981; text-decoration: none; } .terms-link:hover { text-decoration: underline; }
  @media (max-width: 600px) { 
    body:not(.no-padding) { padding: 0 !important; } 
    #root { max-width: 100vw; max-height: 100vh; }
  }
  .leaflet-control-zoom { display: none !important; }

  .user-place-label {
    background-color: transparent;
    border: none;
    box-shadow: none;
    color: #333;
    font-weight: 500;
    font-size: 12px;
    padding: 0;
    white-space: nowrap;
    text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff;
  }
  .route-distance-label {
    background: transparent;
    border: none;
    box-shadow: none;
    color: white;
    font-weight: bold;
    font-size: 14px;
    text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.7);
  }
`;

// Inject global styles into the <style> tag in index.html
// The ID 'global-app-styles-container' matches the ID in index.html
const styleElementId = 'global-app-styles-container';
let styleTag = document.getElementById(styleElementId) as HTMLStyleElement | null;

if (!styleTag && document.head) {
    styleTag = document.createElement('style');
    styleTag.id = styleElementId;
    document.head.appendChild(styleTag);
}

if (styleTag) {
    styleTag.innerHTML = globalStyles;
} else {
    console.error(`Could not find or create style tag with ID: ${styleElementId}. Global styles not applied.`);
}


const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}