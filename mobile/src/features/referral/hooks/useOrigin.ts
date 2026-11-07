import * as Location from 'expo-location';
import { useCallback, useState } from 'react';
import { t } from '../../../lib/i18n';

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
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error(t('Location permission was not given'));
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setOrigin({ lat: position.coords.latitude, lng: position.coords.longitude });
    } catch (err) {
      setOrigin(null);
      setError(err instanceof Error ? err.message : t('Couldn’t get your location'));
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
