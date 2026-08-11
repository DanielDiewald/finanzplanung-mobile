import { APP_VERSION } from '../utils.js';
export function renderSettings(settings){ document.getElementById('appVersion').textContent=APP_VERSION; document.getElementById('deviceName').value=settings.deviceName||''; document.getElementById('themeSetting').value=settings.theme||'system'; applyTheme(settings.theme||'system'); }
export function applyTheme(theme){ document.documentElement.dataset.theme=theme==='system'?'':theme; document.documentElement.style.colorScheme=theme==='dark'?'dark':theme==='light'?'light':'light dark'; }
