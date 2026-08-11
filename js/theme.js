/* Shared Capyt theme bootstrap. Loaded synchronously in <head> to avoid theme flashes. */
(() => {
  'use strict';

  const STORAGE_KEY = 'capyt-theme';
  const VALID = new Set(['system', 'light', 'dark']);
  const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
  let preference = 'system';

  function normalize(value) {
    return VALID.has(value) ? value : 'system';
  }

  function readPreference() {
    try { return normalize(localStorage.getItem(STORAGE_KEY) || 'system'); }
    catch { return 'system'; }
  }

  function effectiveTheme(value = preference) {
    return value === 'system' ? (media?.matches ? 'dark' : 'light') : normalize(value);
  }

  function syncThemeColor() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const value = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim();
    if (value) meta.setAttribute('content', value);
  }

  function apply(value, { persist = true, notify = true } = {}) {
    preference = normalize(value);
    const effective = effectiveTheme(preference);
    const root = document.documentElement;
    root.dataset.themePreference = preference;
    root.dataset.theme = effective;
    root.style.colorScheme = effective;
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, preference); } catch {}
    }
    const updateMeta = () => syncThemeColor();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', updateMeta, { once: true });
    else requestAnimationFrame(updateMeta);
    if (notify) globalThis.dispatchEvent?.(new CustomEvent('capyt-themechange', { detail: { preference, effective } }));
    return effective;
  }

  function bindSelect(select, onPreferenceChange) {
    if (!select) return () => {};
    select.value = preference;
    const listener = () => {
      const value = normalize(select.value);
      apply(value);
      onPreferenceChange?.(value);
    };
    select.addEventListener('change', listener);
    return () => select.removeEventListener('change', listener);
  }

  function onSystemChange() {
    if (preference === 'system') apply('system', { persist: false });
  }
  media?.addEventListener?.('change', onSystemChange);
  media?.addListener?.(onSystemChange);

  preference = readPreference();
  apply(preference, { persist: false, notify: false });

  globalThis.CapytTheme = Object.freeze({
    storageKey: STORAGE_KEY,
    apply,
    bindSelect,
    effectiveTheme,
    get preference() { return preference; },
    readPreference,
    syncThemeColor
  });
})();
