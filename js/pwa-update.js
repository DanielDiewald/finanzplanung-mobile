(() => {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  let registration = null;
  let waitingWorker = null;
  const hadControllerAtLoad = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  let updateAccepted = false;
  let updateDeferred = false;
  let lastCheck = 0;
  const CHECK_INTERVAL_MS = 15 * 60 * 1000;

  const $ = id => document.getElementById(id);

  function setStatus(text) {
    const el = $('pwaUpdateStatus');
    if (el) el.textContent = text;
  }

  function closeUpdateDialog() {
    const dialog = $('updateDialog');
    if (!dialog) return;
    if (typeof dialog.close === 'function') {
      if (dialog.open) dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  function showUpdate(worker, { force = false } = {}) {
    if (!worker) return;
    waitingWorker = worker;
    setStatus('Neue Version bereit');
    if (updateDeferred && !force) return;
    const dialog = $('updateDialog');
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  async function checkForUpdate({ force = false, revealDeferred = false } = {}) {
    if (!registration) return false;
    const now = Date.now();
    if (!force && now - lastCheck < CHECK_INTERVAL_MS) return false;
    lastCheck = now;
    if (!navigator.onLine) {
      setStatus('Offline – Prüfung später');
      return false;
    }
    setStatus('Prüfe …');
    try {
      await registration.update();
      if (registration.waiting) {
        showUpdate(registration.waiting, { force: revealDeferred });
        return true;
      }
      setStatus('Aktuell');
      return false;
    } catch (error) {
      console.warn('Update-Prüfung fehlgeschlagen.', error);
      setStatus('Prüfung fehlgeschlagen');
      return false;
    }
  }

  function watchInstalling(worker) {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state !== 'installed') return;
      if (navigator.serviceWorker.controller) showUpdate(registration?.waiting || worker);
      else setStatus('Installiert');
    });
  }

  async function register() {
    try {
      registration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
      window.CapytPwaUpdate = Object.freeze({
        check: () => { updateDeferred = false; return checkForUpdate({ force: true, revealDeferred: true }); },
        registration: () => registration
      });

      if (registration.waiting && navigator.serviceWorker.controller) showUpdate(registration.waiting);
      if (registration.installing) watchInstalling(registration.installing);
      registration.addEventListener('updatefound', () => watchInstalling(registration.installing));

      const checkButton = $('checkForUpdates');
      checkButton?.addEventListener('click', () => {
        updateDeferred = false;
        checkForUpdate({ force: true, revealDeferred: true });
      });

      $('updateLaterButton')?.addEventListener('click', () => {
        updateDeferred = true;
        closeUpdateDialog();
        setStatus('Update wartet');
      });
      $('updateDialog')?.addEventListener('cancel', () => {
        updateDeferred = true;
        setStatus('Update wartet');
      });

      $('updateNowButton')?.addEventListener('click', () => {
        const worker = registration?.waiting || waitingWorker;
        if (!worker) {
          closeUpdateDialog();
          updateDeferred = false;
          checkForUpdate({ force: true, revealDeferred: true });
          return;
        }
        const button = $('updateNowButton');
        if (button) { button.disabled = true; button.textContent = 'Aktualisiere …'; }
        updateAccepted = true;
        setStatus('Aktualisiere …');
        worker.postMessage({ type: 'SKIP_WAITING' });
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Bei der Erstinstallation kann clients.claim() ebenfalls controllerchange auslösen.
        // Neu laden wollen wir nur, nachdem der Nutzer ein bereitstehendes Update bestätigt hat.
        if ((!hadControllerAtLoad && !updateAccepted) || reloading) return;
        reloading = true;
        window.location.reload();
      });

      window.addEventListener('online', () => checkForUpdate({ force: true }));
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) checkForUpdate();
      });

      if (navigator.serviceWorker.controller || registration.active) {
        await checkForUpdate({ force: true });
      } else {
        setStatus('Installiert');
      }
    } catch (error) {
      console.warn('Service Worker konnte nicht registriert werden.', error);
      setStatus('Nicht verfügbar');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', register, { once: true });
  else register();
})();
