import { useState } from 'react';
import { animateLayout } from './motion';

/** The state of a screen's search box: whether it is open and what was typed. */
export function useSearch() {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  return {
    searching,
    query,
    setQuery,
    /** Opens or closes the box with a short ease, and clears the text either way. */
    toggle: () => {
      animateLayout();
      setSearching((open) => !open);
      setQuery('');
    },
    /** Closes the box and clears the text, with no animation of its own. */
    close: () => {
      setSearching(false);
      setQuery('');
    },
  };
}
