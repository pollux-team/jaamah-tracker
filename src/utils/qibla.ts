import { useEffect, useRef, useState } from 'react';
import { Magnetometer } from 'expo-sensors';
import { getQiblaDirection } from './prayer-times';

export { getQiblaDirection };

export function useMagnetometerHeading() {
  const [heading, setHeading] = useState(0);
  const prevHeading = useRef(0);

  useEffect(() => {
    Magnetometer.setUpdateInterval(100);
    const subscription = Magnetometer.addListener(({ x, y }) => {
      let angle = (Math.atan2(y, x) * 180) / Math.PI;
      if (angle < 0) angle += 360;

      const diff = angle - prevHeading.current;
      const adjusted = diff > 180 ? diff - 360 : diff < -180 ? diff + 360 : diff;
      const smoothed = prevHeading.current + adjusted * 0.3;

      const normalized = ((smoothed % 360) + 360) % 360;
      prevHeading.current = normalized;
      setHeading(normalized);
    });

    return () => subscription.remove();
  }, []);

  return heading;
}
