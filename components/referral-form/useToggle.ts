import { useState } from "react";

/** A boolean and a function that flips it. */
export function useToggle(initial = false): [boolean, () => void] {
  const [on, setOn] = useState(initial);
  return [on, () => setOn((v) => !v)];
}
