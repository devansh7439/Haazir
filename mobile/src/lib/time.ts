import { t, uiLanguage } from './i18n';

/** "just now", "5 min ago", "3 h ago", "2 d ago" for a past time; the date itself after a week. */
export function ago(iso: string, nowMs: number): string {
  const s = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000));
  if (s < 45) return t('just now');
  if (s < 3600) return t('{count} min ago', { count: Math.max(1, Math.round(s / 60)) });
  if (s < 86_400) return t('{count} h ago', { count: Math.round(s / 3600) });
  if (s < 7 * 86_400) return t('{count} d ago', { count: Math.round(s / 86_400) });
  return new Date(iso).toLocaleDateString(uiLanguage() === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
}
