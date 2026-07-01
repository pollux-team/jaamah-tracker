import * as Location from 'expo-location';
import { settings } from '../database/sqlite';
import { SQLiteDatabase } from 'expo-sqlite';

export type Coordinates = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  capturedAt: string;
};

export async function requestLocation(): Promise<Coordinates> {
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== 'granted') {
    throw new Error('Location permission denied');
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const coords: Coordinates = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    altitude: position.coords.altitude ?? null,
    accuracy: position.coords.accuracy ?? null,
    capturedAt: new Date().toISOString(),
  };

  return coords;
}

export async function getOrRequestLocation(db: SQLiteDatabase): Promise<Coordinates | null> {
  try {
    const saved = await settings.get<Coordinates>(db, 'location');
    if (saved && saved.capturedAt) {
      return saved;
    }
    return null;
  } catch {
    return null;
  }
}

export async function updateLocation(db: SQLiteDatabase, coords: Coordinates) {
  await settings.set(db, 'location', coords);
}

export async function getLocation(db: SQLiteDatabase): Promise<Coordinates | null> {
  try {
    return await settings.get<Coordinates>(db, 'location');
  } catch {
    return null;
  }
}
