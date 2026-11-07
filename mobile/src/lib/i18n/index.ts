import { useSyncExternalStore } from 'react';
import { HINDI } from './hindi';

/** The languages the app's screens can show. */
export type UiLanguage = 'en' | 'hi';

export type TextValues = Record<string, string | number>;

declare const PHRASE: unique symbol;

/**
 * English text kept in a constant, made at module load. It is not a string on purpose: it has to go through t() to be
 * shown, so it shows in the language of the moment rather than the one at load.
 */
export type Phrase = { readonly [PHRASE]: string };

const TABLES: Record<UiLanguage, Readonly<Record<string, string>>> = { en: {}, hi: HINDI };

let current: UiLanguage = 'en';
const listeners = new Set<() => void>();

const fill = (text: string, values?: TextValues) =>
  values ? text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole)) : text;

/** The text in a language: the English text is the key, and English stands in where no translation is recorded yet. */
export function translate(text: string, language: UiLanguage, values?: TextValues): string {
  return fill(TABLES[language][text] || text, values);
}

/**
 * The English text in the language the screens show now, with {name} placeholders filled. Called while drawing or
 * handling an action, never at module load (use phrase() there): a change of language redraws every screen.
 */
export function t(text: string | Phrase, values?: TextValues): string {
  return translate(english(text), current, values);
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A template like 'Calling {count} hospitals' as a pattern that captures what each {name} stood for. */
const patternOf = (template: string) => new RegExp(`^${escape(template).replace(/\\\{(\w+)\\\}/g, '(?<$1>.+?)')}$`);

/**
 * Text that was built in English around a changing part ('On call · 1:05') shown in the current language: the first template
 * it fits is translated with the part put back. Text that fits none is translated whole, or left as it is.
 */
export function tFitted(text: string, templates: readonly (string | Phrase)[]): string {
  if (current === 'en') return text;
  const whole = TABLES[current][text];
  if (whole) return whole;
  for (const template of templates) {
    const key = english(template);
    const found = patternOf(key).exec(text);
    if (!found) continue;
    // The changing parts that are words ('sent', 'hospital') are translated too; names and times pass through.
    const parts = Object.fromEntries(Object.entries(found.groups ?? {}).map(([name, part]) => [name, TABLES[current][part] || part]));
    return translate(key, current, parts);
  }
  return text;
}

/** Marks English text kept in a constant; the list for translators finds it, and t() shows it. */
export const phrase = (text: string): Phrase => text as unknown as Phrase;

/** The English behind a phrase, for keys and comparisons that must not change with the language. */
export const english = (text: string | Phrase): string => text as unknown as string;

/** The language the screens show now. */
export const uiLanguage = (): UiLanguage => current;

// While held, a change of language waits, so a sheet can close before every screen is drawn afresh under it.
let held = false;
let waiting: UiLanguage | null = null;

/** Switches the language and redraws every screen that shows words; nothing happens when it is already that one. */
export function setUiLanguage(language: UiLanguage) {
  if (held) {
    waiting = language;
    return;
  }
  if (language === current) return;
  current = language;
  listeners.forEach((listener) => listener());
}

/** Holds back any change of language until the returned release is called; a change made meanwhile applies then. */
export function holdLanguageChange(): () => void {
  held = true;
  waiting = null;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    held = false;
    const next = waiting;
    waiting = null;
    if (next) setUiLanguage(next);
  };
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The language the screens show, and a redraw when it changes. */
export function useUiLanguage(): UiLanguage {
  return useSyncExternalStore(subscribe, uiLanguage, uiLanguage);
}

/** Whether any Hindi wording has been recorded yet. */
export const hasHindiWording = () => Object.keys(HINDI).length > 0;
