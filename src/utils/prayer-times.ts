import {
  CalculationMethod,
  PrayerTimes,
  SunnahTimes,
  Coordinates as AdhanCoordinates,
  Madhab,
  Qibla,
} from 'adhan';
import { format } from 'date-fns';
import type { Coordinates } from './location';

export type CalculationMethodKey =
  | 'MWL'
  | 'ISNA'
  | 'Egypt'
  | 'Makkah'
  | 'Karachi'
  | 'Dubai'
  | 'MoonsightingCommittee'
  | 'Kuwait'
  | 'Qatar'
  | 'Singapore'
  | 'Tehran'
  | 'Turkey';

export type AsrMethod = 'Standard' | 'Hanafi';

export interface PrayerTimeEntry {
  name: string;
  time: Date;
  label: string;
  endTime: Date;
  endTimeLabel: string;
  type: 'fard' | 'sunnah' | 'time';
}

export interface PrayerTimesResult {
  fajr: Date;
  sunrise: Date;
  dhuhr: Date;
  asr: Date;
  maghrib: Date;
  isha: Date;
  sunset: Date;
  entries: PrayerTimeEntry[];
  sunnahTimes: { middleOfTheNight: Date; lastThirdOfTheNight: Date };
  nextPrayerName: string;
}

export const CALCULATION_METHODS: { value: CalculationMethodKey; label: string }[] = [
  { value: 'MWL', label: 'Muslim World League' },
  { value: 'ISNA', label: 'ISNA (North America)' },
  { value: 'Egypt', label: 'Egyptian General Authority' },
  { value: 'Makkah', label: 'Umm al-Qura, Makkah' },
  { value: 'Karachi', label: 'University of Karachi' },
  { value: 'Dubai', label: 'Dubai' },
  { value: 'MoonsightingCommittee', label: 'Moonsighting Committee' },
  { value: 'Kuwait', label: 'Kuwait' },
  { value: 'Qatar', label: 'Qatar' },
  { value: 'Singapore', label: 'Singapore' },
  { value: 'Tehran', label: 'Institute of Geophysics, Tehran' },
  { value: 'Turkey', label: 'Diyanet, Turkey' },
];

export const ASR_METHODS: { value: AsrMethod; label: string }[] = [
  { value: 'Standard', label: "Shafi'i, Maliki, Hanbali" },
  { value: 'Hanafi', label: 'Hanafi' },
];

export function getPrayerTimes(
  date: Date,
  coords: Coordinates,
  method: CalculationMethodKey = 'MWL',
  asrMethod: AsrMethod = 'Standard'
): PrayerTimesResult {
  const params = getCalculationParams(method);

  if (asrMethod === 'Hanafi') {
    params.madhab = Madhab.Hanafi;
  }

  const adhanCoords = new AdhanCoordinates(coords.latitude, coords.longitude);
  const times = new PrayerTimes(adhanCoords, date, params);
  const sunnah = new SunnahTimes(times);

  const nextName = times.nextPrayer();

  const nextFajr = new Date(times.fajr.getTime() + 24 * 60 * 60 * 1000);

  const entries: PrayerTimeEntry[] = [
    { name: 'Fajr', time: times.fajr, label: format(times.fajr, 'h:mm a'), endTime: times.sunrise, endTimeLabel: format(times.sunrise, 'h:mm a'), type: 'fard' },
    { name: 'Sunrise', time: times.sunrise, label: format(times.sunrise, 'h:mm a'), endTime: times.dhuhr, endTimeLabel: format(times.dhuhr, 'h:mm a'), type: 'time' },
    { name: 'Dhuhr', time: times.dhuhr, label: format(times.dhuhr, 'h:mm a'), endTime: times.asr, endTimeLabel: format(times.asr, 'h:mm a'), type: 'fard' },
    { name: 'Asr', time: times.asr, label: format(times.asr, 'h:mm a'), endTime: times.maghrib, endTimeLabel: format(times.maghrib, 'h:mm a'), type: 'fard' },
    { name: 'Maghrib', time: times.maghrib, label: format(times.maghrib, 'h:mm a'), endTime: times.isha, endTimeLabel: format(times.isha, 'h:mm a'), type: 'fard' },
    { name: 'Isha', time: times.isha, label: format(times.isha, 'h:mm a'), endTime: nextFajr, endTimeLabel: format(nextFajr, 'h:mm a'), type: 'fard' },
  ];

  return {
    fajr: times.fajr,
    sunrise: times.sunrise,
    dhuhr: times.dhuhr,
    asr: times.asr,
    maghrib: times.maghrib,
    isha: times.isha,
    sunset: times.sunset,
    entries,
    sunnahTimes: {
      middleOfTheNight: sunnah.middleOfTheNight,
      lastThirdOfTheNight: sunnah.lastThirdOfTheNight,
    },
    nextPrayerName: nextName,
  };
}

export function getCurrentWaqt(times: PrayerTimesResult) {
  const now = new Date();
  const nextFajr = getNextDayFajr(times);

  const fardEntries = [
    { name: 'Fajr', start: times.fajr, end: times.sunrise },
    { name: 'Dhuhr', start: times.dhuhr, end: times.asr },
    { name: 'Asr', start: times.asr, end: times.maghrib },
    { name: 'Maghrib', start: times.maghrib, end: times.isha },
    { name: 'Isha', start: times.isha, end: new Date(nextFajr) },
  ];

  for (const entry of fardEntries) {
    if (now.getTime() >= entry.start.getTime() && now.getTime() < entry.end.getTime()) {
      const total = entry.end.getTime() - entry.start.getTime();
      const elapsed = now.getTime() - entry.start.getTime();
      return {
        name: entry.name,
        startLabel: format(entry.start, 'h:mm a'),
        endLabel: format(entry.end, 'h:mm a'),
        progress: Math.max(0, Math.min(1, elapsed / total)),
      };
    }
  }

  return null;
}

function getNextDayFajr(times: PrayerTimesResult): number {
  return times.fajr.getTime() + 24 * 60 * 60 * 1000;
}

export function getNextPrayer(times: PrayerTimesResult) {
  const now = new Date();
  const fardEntries = [
    { name: 'Fajr', time: times.fajr, label: format(times.fajr, 'h:mm a') },
    { name: 'Dhuhr', time: times.dhuhr, label: format(times.dhuhr, 'h:mm a') },
    { name: 'Asr', time: times.asr, label: format(times.asr, 'h:mm a') },
    { name: 'Maghrib', time: times.maghrib, label: format(times.maghrib, 'h:mm a') },
    { name: 'Isha', time: times.isha, label: format(times.isha, 'h:mm a') },
  ];

  for (const entry of fardEntries) {
    const diff = entry.time.getTime() - now.getTime();
    if (diff > 0) {
      return { ...entry, minutesLeft: Math.floor(diff / 60000) };
    }
  }

  return { ...fardEntries[0], minutesLeft: 0 };
}

export function getQiblaDirection(lat: number, lon: number): number {
  return Qibla(new AdhanCoordinates(lat, lon));
}

function getCalculationParams(method: CalculationMethodKey) {
  switch (method) {
    case 'MWL': return CalculationMethod.MuslimWorldLeague();
    case 'ISNA': return CalculationMethod.NorthAmerica();
    case 'Egypt': return CalculationMethod.Egyptian();
    case 'Makkah': return CalculationMethod.UmmAlQura();
    case 'Karachi': return CalculationMethod.Karachi();
    case 'Dubai': return CalculationMethod.Dubai();
    case 'MoonsightingCommittee': return CalculationMethod.MoonsightingCommittee();
    case 'Kuwait': return CalculationMethod.Kuwait();
    case 'Qatar': return CalculationMethod.Qatar();
    case 'Singapore': return CalculationMethod.Singapore();
    case 'Tehran': return CalculationMethod.Tehran();
    case 'Turkey': return CalculationMethod.Turkey();
    default: return CalculationMethod.MuslimWorldLeague();
  }
}
