import { APP_VERSION } from '../utils.js';

export function renderSettings(settings,{capyEnabled=false,capyInitialized=false,capyName='',capyBudgetName=''}={}){
  document.getElementById('appVersion').textContent=APP_VERSION;
  document.getElementById('deviceName').value=settings.deviceName||'';
  document.getElementById('themeSetting').value=settings.theme||globalThis.CapytTheme?.preference||'system';
  const status=document.getElementById('capyFeatureStatus'),name=document.getElementById('capyFeatureName'),pause=document.getElementById('capyPauseButton'),resume=document.getElementById('capyResumeButton');
  if(status)status.textContent=capyEnabled?'Aktiv':capyInitialized?'Pausiert':'Deaktiviert';
  if(name)name.textContent=capyInitialized?(capyBudgetName||globalThis.CapytCapyNaming?.budgetName(capyName||'Capy')||'Capy-Vorrat'):'Am PC unter Grundlagen aktivieren';
  pause?.classList.toggle('hidden',!capyEnabled||!capyInitialized);resume?.classList.toggle('hidden',capyEnabled||!capyInitialized);
}
export function applyTheme(theme){const value=['system','light','dark'].includes(theme)?theme:'system';if(globalThis.CapytTheme)return globalThis.CapytTheme.apply(value);const effective=value==='system'&&globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':(value==='system'?'light':value);document.documentElement.dataset.theme=effective;document.documentElement.dataset.themePreference=value;document.documentElement.style.colorScheme=effective;return effective;}
