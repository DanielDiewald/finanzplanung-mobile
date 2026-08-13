import { APP_VERSION } from '../utils.js';

export function renderSettings(settings, {capyEnabled=false,capyName=''}={}) {
  document.getElementById('appVersion').textContent = APP_VERSION;
  document.getElementById('deviceName').value = settings.deviceName || '';
  document.getElementById('themeSetting').value = settings.theme || globalThis.CapytTheme?.preference || 'system';
  const status=document.getElementById('capyFeatureStatus');
  const name=document.getElementById('capyFeatureName');
  if(status) status.textContent=capyEnabled?'Aktiv':'Deaktiviert';
  if(name) name.textContent=capyEnabled?(capyName?`${capyName} Vorrat`:'Capy Vorrat'):'Am PC unter Grundlagen aktivieren';
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
