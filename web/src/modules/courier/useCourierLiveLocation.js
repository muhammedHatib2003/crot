import { useEffect, useRef } from "react";
import { apiRequest } from "../../api";
import { getCurrentBrowserLocation } from "../../utils/onlineLocation";

export function useCourierLiveLocation(token, enabled, onPosition) {
  const watchRef = useRef(null);
  const onPositionRef = useRef(onPosition);
  onPositionRef.current = onPosition;

  useEffect(() => {
    if (!enabled || !token) {
      return undefined;
    }

    let cancelled = false;

    async function push(lat, lng) {
      if (cancelled) {
        return;
      }
      onPositionRef.current?.({ lat, lng });
      try {
        await apiRequest("/courier/location", {
          method: "POST",
          token,
          body: { latitude: lat, longitude: lng }
        });
      } catch {
        /* ignore */
      }
    }

    (async () => {
      try {
        const { lat, lng } = await getCurrentBrowserLocation();
        await push(lat, lng);
      } catch {
        /* optional */
      }
    })();

    if (navigator.geolocation) {
      watchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          push(pos.coords.latitude, pos.coords.longitude);
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
      );
    }

    const interval = setInterval(() => {
      (async () => {
        try {
          const { lat, lng } = await getCurrentBrowserLocation();
          await push(lat, lng);
        } catch {
          /* ignore */
        }
      })();
    }, 35000);

    return () => {
      cancelled = true;
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
      clearInterval(interval);
    };
  }, [enabled, token]);
}

