import { APP_VERSION } from '../utils.js';

export function renderSettings(settings) {
  document.getElementById('appVersion').textContent = APP_VERSION;
  document.getElementById('deviceName').value = settings.deviceName || '';
  document.getElementById('themeSetting').value = settings.theme || globalThis.CapytTheme?.preference || 'system';
}

export function applyTheme(theme) {
  const value = ['system', 'light', 'dark'].includes(theme) ? theme : 'system';
  if (globalThis.CapytTheme) return globalThis.CapytTheme.apply(value);
  const effective = value === 'system' && globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : (value === 'system' ? 'light' : value);
  document.documentElement.dataset.theme = effective;
  document.documentElement.dataset.themePreference = value;
  document.documentElement.style.colorScheme = effective;
  return effective;
}
