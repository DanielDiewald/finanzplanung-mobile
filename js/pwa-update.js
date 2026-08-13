(() => {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  const SW_URL = './sw.js';
  const VERSION_URL = './version.json';
  const PAGE_VERSION = document.querySelector('meta[name="capyt-version"]')?.content?.trim() || '';
  const CHECK_INTERVAL_MS = 15 * 60 * 1000;
  // Capyt verwendet Alpha-Versionen wie 2.2.5a. Diese sind absichtlich
  // zusaetzlich zu normalem SemVer mit -/+ Suffix erlaubt.
  const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[A-Za-z][0-9A-Za-z.-]*)?(?:[-+][0-9A-Za-z.-]+)?$/;

  let registration = null;
  let boundRegistration = null;
  let waitingWorker = null;
  let targetVersion = '';
  const hadControllerAtLoad = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  let updateAccepted = false;
  let updateDeferred = false;
  let lastCheck = 0;

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
    setStatus(targetVersion ? `Version ${targetVersion} bereit` : 'Neue Version bereit');
    if (updateDeferred && !force) return;
    const dialog = $('updateDialog');
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function workerVersion(worker) {
    if (!worker?.scriptURL) return '';
    try {
      return new URL(worker.scriptURL).searchParams.get('v') || '';
    } catch {
      return '';
    }
  }

  function runningVersion() {
    return workerVersion(navigator.serviceWorker.controller)
      || workerVersion(registration?.active)
      || PAGE_VERSION
      || '';
  }

  async function fetchPublishedVersion() {
    const url = new URL(VERSION_URL, window.location.href);
    // Ein einmaliger Query-Token ist absichtlich Teil der URL: auch ein alter
    // iOS-PWA-Service-Worker kann dadurch keinen zuvor gecachten Treffer liefern.
    url.searchParams.set('_', `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) throw new Error(`Versionsdatei HTTP ${response.status}`);
    const payload = await response.json();
    const version = String(payload?.version || '').trim();
    if (!VERSION_PATTERN.test(version)) {
      throw new Error('Ungueltige Versionsdatei');
    }
    return version;
  }

  function watchInstalling(worker) {
    if (!worker || worker.__capytWatched) return;
    try { worker.__capytWatched = true; } catch {}
    const onStateChange = () => {
      if (worker.state === 'installing') setStatus('Update wird geladen …');
      if (worker.state !== 'installed') return;
      if (navigator.serviceWorker.controller) showUpdate(registration?.waiting || worker);
      else setStatus('Installiert');
    };
    worker.addEventListener('statechange', onStateChange);
    onStateChange();
  }

  function bindRegistration(nextRegistration) {
    registration = nextRegistration;
    if (!registration || boundRegistration === registration) return;
    boundRegistration = registration;
    if (registration.waiting && navigator.serviceWorker.controller) showUpdate(registration.waiting);
    if (registration.installing) watchInstalling(registration.installing);
    registration.addEventListener('updatefound', () => watchInstalling(registration.installing));
  }

  async function registerVersion(version) {
    const suffix = version ? `?v=${encodeURIComponent(version)}` : '';
    const nextRegistration = await navigator.serviceWorker.register(`${SW_URL}${suffix}`, {
      scope: './',
      updateViaCache: 'none'
    });
    if (version) targetVersion = version;
    bindRegistration(nextRegistration);
    return nextRegistration;
  }

  async function checkForUpdate({ force = false, revealDeferred = false } = {}) {
    const now = Date.now();
    if (!force && now - lastCheck < CHECK_INTERVAL_MS) return false;
    lastCheck = now;

    if (!navigator.onLine) {
      setStatus('Offline – Prüfung später');
      return false;
    }

    setStatus('Prüfe …');
    try {
      const publishedVersion = await fetchPublishedVersion();
      targetVersion = publishedVersion;

      // Wichtig fuer Safari/iOS Home-Screen-Apps: Der Versionswert wird in die
      // Service-Worker-URL geschrieben. Damit ist jede Release-URL eindeutig
      // und ein festhaengender HTTP-/Web-App-Cache kann die neue sw.js nicht
      // mit der alten Script-URL verwechseln.
      await registerVersion(publishedVersion);

      if (registration?.waiting) {
        showUpdate(registration.waiting, { force: revealDeferred });
        return true;
      }
      if (registration?.installing) {
        watchInstalling(registration.installing);
        setStatus('Update wird geladen …');
        return true;
      }

      const current = runningVersion();
      setStatus(current === publishedVersion ? 'Aktuell' : `Version ${publishedVersion} geprüft`);
      return current !== publishedVersion;
    } catch (error) {
      console.warn('Update-Prüfung fehlgeschlagen.', error);
      // Fallback auf den standardisierten Browser-Update-Check, falls nur die
      // kleine version.json zeitweise nicht erreichbar ist.
      try {
        if (!registration) await registerVersion(PAGE_VERSION);
        if (registration) await registration.update();
        if (registration?.waiting) {
          showUpdate(registration.waiting, { force: revealDeferred });
          return true;
        }
      } catch (fallbackError) {
        console.warn('Service-Worker-Fallback-Prüfung fehlgeschlagen.', fallbackError);
      }
      setStatus('Prüfung fehlgeschlagen');
      return false;
    }
  }

  async function register() {
    try {
      // Erst die kleine, cache-bustende Versionsdatei laden. Das ist bewusst
      // unabhaengig vom aktuell aktiven Service Worker und rettet auch eine
      // aeltere iOS-Home-Screen-Installation aus einem festhaengenden Cache.
      let publishedVersion = '';
      try {
        publishedVersion = await fetchPublishedVersion();
      } catch (error) {
        console.warn('Online-Version beim Start nicht lesbar.', error);
      }

      await registerVersion(publishedVersion || PAGE_VERSION);

      window.CapytPwaUpdate = Object.freeze({
        check: () => {
          updateDeferred = false;
          return checkForUpdate({ force: true, revealDeferred: true });
        },
        registration: () => registration,
        runningVersion,
        targetVersion: () => targetVersion
      });

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
        if (button) {
          button.disabled = true;
          button.textContent = 'Aktualisiere …';
        }
        updateAccepted = true;
        setStatus('Aktualisiere …');
        worker.postMessage({ type: 'SKIP_WAITING' });
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Bei der Erstinstallation kann clients.claim() ebenfalls controllerchange ausloesen.
        // Neu laden wollen wir nur, nachdem der Nutzer ein bereitstehendes Update bestaetigt hat.
        if ((!hadControllerAtLoad && !updateAccepted) || reloading) return;
        reloading = true;
        window.location.reload();
      });

      window.addEventListener('online', () => checkForUpdate({ force: true }));
      window.addEventListener('pageshow', () => checkForUpdate({ force: true }));
      window.addEventListener('focus', () => checkForUpdate());
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) checkForUpdate({ force: true });
      });

      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdate(registration.waiting);
      } else if (registration.installing) {
        watchInstalling(registration.installing);
        setStatus('Update wird geladen …');
      } else if (publishedVersion && runningVersion() === publishedVersion) {
        setStatus('Aktuell');
      } else if (navigator.serviceWorker.controller || registration.active) {
        await checkForUpdate({ force: true });
      } else {
        setStatus('Installiert');
      }
    } catch (error) {
      console.warn('Service Worker konnte nicht registriert werden.', error);
      setStatus('Nicht verfügbar');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', register, { once: true });
  } else {
    register();
  }
})();
