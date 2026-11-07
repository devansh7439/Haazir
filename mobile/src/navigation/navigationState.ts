import type { NavigationState } from '@react-navigation/native';

// The open screens, kept so a change of language can redraw every screen and land back where the person was.
let saved: NavigationState | undefined;

/** Remembers the open screens while the app redraws in a new language, and forgets them on sign-in and sign-out. */
export const navigationState = {
  get: () => saved,
  set: (state: NavigationState | undefined) => {
    saved = state;
  },
  // Signing in or out swaps the screen set, so the screens kept from before no longer exist.
  clear: () => {
    saved = undefined;
  },
};
