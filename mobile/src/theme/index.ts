import { Easing, type TextStyle } from 'react-native';
import type { Tone } from '../lib/display';

// The app's design tokens, taken from raktkhoj.org's stylesheet: its crimson (#E8394C) and coral (#FF7A4D), a white page with warm-ink
// hairlines, 7/10/14 radii, soft warm shadows, Inter for text and Inter Tight for headings.
// Crimson marks what to tap and where you are; status colours stay separate and every status also shows an icon and words. No
// screen writes a raw hex value or a magic number; everything goes through `theme`. Every text colour reads at 4.5:1 or more (WCAG AA).

const color = {
  // RaktKhoj's #E8394C reads 4.1:1 with white, so buttons and text links use this step darker (4.9:1).
  primary: '#D42E45',
  primaryPressed: '#B8243A',
  primaryTint: '#FFD7DB',
  primarySoft: '#FDEEF0',
  onPrimary: '#FFFFFF',

  // The page is RaktKhoj's warm grey; cards, bars and chips are white on it.
  background: '#F6F4F2',
  surface: '#FFFFFF',
  surfaceMuted: '#F6F4F5',
  border: '#EAE8EA',
  borderStrong: '#DBD8DB',

  textPrimary: '#18181B',
  textSecondary: '#52525B',
  textTertiary: '#696971',
  textOnDark: '#FFFFFF',

  required: '#B91C1C',
  scrim: 'rgba(9, 9, 11, 0.45)',
  toastErrorIcon: '#FCA5A5',

  status: {
    verifiedFg: '#166534',
    verifiedBg: '#F0FDF4',
    pendingFg: '#713F12',
    pendingBg: '#FEFCE8',
    rejectedFg: '#B91C1C',
    rejectedBg: '#FEF2F2',
    neutralFg: '#52525B',
    neutralBg: '#F4F4F5',
  },

  alert: { fg: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
} as const;

// Inks and papers beyond the main colours.
const tint = {
  paper: '#FFFFFF',
  ink: '#18181B',
  heading: '#18181B',
  muted: '#696971',
  hairline: '#EAE8EA',
  tile: '#F6F2F3',
  halo: '#F6F4F2',
  notice: '#F4F4F5',
  // The hero on Home: RaktKhoj's crimson deepened until white text on it passes AA (5.6:1), with lighter rose rings and stats.
  hero: '#C42A40',
  heroSoft: 'rgba(255, 255, 255, 0.16)',
  heroText: '#FFE9EC',
} as const;

// Inter for text and Inter Tight for headings. Each weight is its own loaded family: a custom font ignores fontWeight on Android and fakes it on iOS, so
// text picks a weight by family, never by fontWeight.
const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  // Headings and big figures, as on RaktKhoj.
  displaySemiBold: 'InterTight_600SemiBold',
  displayBold: 'InterTight_700Bold',
} as const;

// The bottom bar: white with a hairline on top; the open tab sits in a rose pill with a crimson icon.
const tabBar = {
  fill: '#FFFFFF',
  edge: '#EAE8EA',
  active: '#FDEEF0',
  icon: '#696971',
  activeIcon: '#D42E45',
  label: '#696971',
  activeLabel: '#B8243A',
} as const;

// What a hospital's answer looks like on the board, as on the web: `fg` on `bg` is the status pill, `accent` the rule down the
// side of a hospital card and `pin` the rank badge. Every status also shows an icon and words, so colour never carries meaning alone.
export type ToneStyle = { fg: string; bg: string; accent: string; pin: string };
const tone: Record<Tone, ToneStyle> = {
  grey: { fg: '#71717A', bg: '#FAFAFA', accent: '#E4E4E7', pin: '#A1A1AA' },
  // Ringing: sky blue, the colour of a call going out.
  blue: { fg: '#0369A1', bg: '#F0F9FF', accent: '#38BDF8', pin: '#0284C7' },
  // On a call, confirming a bed: amber, the colour of waiting on someone.
  amber: { fg: '#92400E', bg: '#FFFBEB', accent: '#F59E0B', pin: '#D97706' },
  green: { fg: '#166534', bg: '#F0FDF4', accent: '#22C55E', pin: '#15803D' },
  // Accepted with a condition: teal, a green with a caution in it.
  'green-cond': { fg: '#0F766E', bg: '#F0FDFA', accent: '#2DD4BF', pin: '#0D9488' },
  red: { fg: '#B91C1C', bg: '#FEF2F2', accent: '#F87171', pin: '#B91C1C' },
  // Wants to talk to you: violet, so it stands out from every other state.
  purple: { fg: '#6D28D9', bg: '#F5F3FF', accent: '#8B5CF6', pin: '#7C3AED' },
  // Calling back or redirected: indigo, a state that is moving on.
  slate: { fg: '#4338CA', bg: '#EEF2FF', accent: '#818CF8', pin: '#4F46E5' },
  // No answer, busy, failed, cancelled: stone, quiet.
  dark: { fg: '#57534E', bg: '#F5F5F4', accent: '#D6D3D1', pin: '#78716C' },
  // Check the recording: orange, an alert that is not an error.
  orange: { fg: '#C2410C', bg: '#FFF7ED', accent: '#FB923C', pin: '#EA580C' },
  held: { fg: '#FFFFFF', bg: '#15803D', accent: '#15803D', pin: '#166534' },
};

// The urgency colours. The level is also written out, so they only reinforce it.
const acuity = { critical: '#BE123C', serious: '#B45309', stable: '#047857' } as const;

// Sized against a 390dp-wide phone: page titles 28, card titles 17, body 14 to 17. No text is smaller than 14 except the tab labels.
// Screens use these tokens and never write a raw fontSize.
const type = {
  display: { fontSize: 34, lineHeight: 42, fontFamily: font.displayBold },
  pageTitle: { fontSize: 28, lineHeight: 34, fontFamily: font.displaySemiBold },
  title: { fontSize: 22, lineHeight: 28, fontFamily: font.displaySemiBold },
  heading: { fontSize: 20, lineHeight: 26, fontFamily: font.displaySemiBold },
  rowTitle: { fontSize: 17, lineHeight: 23, fontFamily: font.semiBold },
  body: { fontSize: 17, lineHeight: 25, fontFamily: font.regular },
  bodyStrong: { fontSize: 17, lineHeight: 25, fontFamily: font.semiBold },
  secondary: { fontSize: 15, lineHeight: 21, fontFamily: font.regular },
  caption: { fontSize: 14, lineHeight: 19, fontFamily: font.regular },
  captionStrong: { fontSize: 14, lineHeight: 19, fontFamily: font.semiBold },
  label: { fontSize: 14, lineHeight: 18, fontFamily: font.medium },
  button: { fontSize: 17, lineHeight: 23, fontFamily: font.semiBold },
  figure: { fontSize: 28, lineHeight: 34, fontFamily: font.displaySemiBold, fontVariant: ['tabular-nums'] },
} as const satisfies Record<string, TextStyle>;

const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32, xxxl: 40 } as const;

// RaktKhoj's 7, 10 and 14 for controls, fields and cards.
const radius = { small: 7, field: 10, tile: 10, card: 14, sheet: 24, pill: 999 } as const;

const size = {
  touch: 44,
  button: 50,
  field: 50,
  iconSmall: 15,
  icon: 18,
  iconLarge: 22,
  screenPadding: 18,
  rank: 32,
  timeColumn: 48,
} as const;

const elevation = {
  card: { shadowColor: '#1E1419', shadowOpacity: 0.1, shadowRadius: 11, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  raised: { shadowColor: '#000000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  sheet: { shadowColor: '#000000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
} as const;

// tabSwitch is how long a tab takes to slide in; tabs are switched dozens of times a day, so it stays brisk.
const motion = { fast: 120, base: 180, settle: 260, tabSwitch: 300 } as const;

// A strong ease-out: quick to answer the tap, soft to settle, for anything appearing or crossfading.
const easing = { out: Easing.bezier(0.23, 1, 0.32, 1), slide: Easing.bezier(0.32, 0.72, 0, 1) } as const;

const theme = { color, tint, tone, acuity, tabBar, font, type, space, radius, size, elevation, motion, easing } as const;

export default theme;

// Metro resolves font files only through require(); an ES import would not bundle the .ttf.
/** The font files the app loads before it draws anything. */
export const fontsToLoad = {
  Inter_400Regular: require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),
  Inter_500Medium: require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf'),
  Inter_600SemiBold: require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'),
  Inter_700Bold: require('@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf'),
  InterTight_600SemiBold: require('@expo-google-fonts/inter-tight/600SemiBold/InterTight_600SemiBold.ttf'),
  InterTight_700Bold: require('@expo-google-fonts/inter-tight/700Bold/InterTight_700Bold.ttf'),
};
