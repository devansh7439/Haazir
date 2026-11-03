import * as Location from "expo-location";
import { useCallback, useState } from "react";

export interface Origin {
  lat: number;
  lng: number;
}

/**
 * The phone's position as the start of the search, when the doctor asks for it. Without it the server searches from
 * the referring doctor's own centre. Asked for only when the switch is turned on, never in the background.
 */
export function useOrigin() {
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) throw new Error("Location permission was not given");
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch (err) {
      setOrigin(null);
      setError(err instanceof Error ? err.message : "Couldn't get your location");
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(() => {
    setOrigin(null);
    setError(null);
  }, []);

  return { origin, busy, error, enable, disable };
}
