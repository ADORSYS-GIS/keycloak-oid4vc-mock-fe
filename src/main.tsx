import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const renderApp = () => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
};

const clearStaleServiceWorkers = async () => {
  if (!import.meta.env.DEV || !('serviceWorker' in navigator)) return false;

  const registrations = await navigator.serviceWorker.getRegistrations();
  const cacheNames = 'caches' in window ? await caches.keys() : [];

  await Promise.all([
    ...registrations.map((registration) => registration.unregister()),
    ...cacheNames.map((cacheName) => caches.delete(cacheName)),
  ]);

  return registrations.length > 0 || cacheNames.length > 0;
};

clearStaleServiceWorkers()
  .then((cleared) => {
    if (cleared && sessionStorage.getItem('stale-service-worker-cleared') !== 'true') {
      sessionStorage.setItem('stale-service-worker-cleared', 'true');
      window.location.reload();
      return;
    }

    renderApp();
  })
  .catch((error) => {
    console.warn('Failed to clear stale service workers:', error);
    renderApp();
  });
