import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

// Initialise Google Analytics only when a Measurement ID is configured.
const gaMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
if (gaMeasurementId && gaMeasurementId !== 'G-XXXXXXXXXX') {
  window.dataLayer = window.dataLayer || [];
  const gtag = (...args: unknown[]) => { window.dataLayer.push(args); };
  gtag('js', new Date());
  gtag('config', gaMeasurementId);

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`;
  document.head.appendChild(script);
}

if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
