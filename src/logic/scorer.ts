import { format, startOfDay, subDays, isToday } from 'date-fns';
import { prayers, habits } from '../database/sqlite';
import type { PrayerRow, HabitRow } from '../database/sqlite';
import { SQLiteDatabase } from 'expo-sqlite';

export type PrayerStatus = 'Jamāʾah' | 'On-Time' | 'Late' | 'Missed';

export const PRAYER_STATUS_LABELS = ['Jamāʾah', 'On-Time', 'Late', 'Missed'] as const;

export const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

export const HABIT_KEYS = [
  { value: 'sunnah-fajr', label: 'Sunnah (2) Fajr' },
  { value: 'sunnah-dhuhr', label: 'Sunnah (4) Dhuhr' },
  { value: 'sunnah-asr', label: 'Sunnah (2) Asr' },
  { value: 'sunnah-maghrib', label: 'Sunnah (2) Maghrib' },
  { value: 'sunnah-isha', label: 'Sunnah (2) Isha' },
  { value: 'tahajjud', label: 'Tahajjud' },
  { value: 'adhkar-morning', label: 'Morning Adhkar' },
  { value: 'adhkar-evening', label: 'Evening Adhkar' },
] as const;

export interface StatusOption {
  label: string;
  value: PrayerStatus;
  color: string;
  points: number;
}

export const STATUS_OPTIONS: StatusOption[] = [
  { label: 'Jamāʾah', value: 'Jamāʾah', color: '#3b82f6', points: 3 },
  { label: 'On-Time', value: 'On-Time', color: '#22c55e', points: 2 },
  { label: 'Late / Qadha', value: 'Late', color: '#f59e0b', points: 1 },
  { label: 'Missed', value: 'Missed', color: '#ef4444', points: 0 },
];

export function pointsFor(status: PrayerStatus): number {
  return STATUS_OPTIONS.find(option => option.value === status)?.points ?? 0;
}

export interface DailyMetrics {
  date: string;
  score: number;
  maxScore: number;
  statuses: Map<string, PrayerStatus>;
  habits: HabitRow[];
  isPerfect: boolean;
  hasLateOrMissed: boolean;
  isExcused: boolean;
  loggedCount: number;
}

export class StreakEngine {
  constructor(private maxAgeDays = 730) {}

  async computeDay(
    db: SQLiteDatabase,
    date: string,
    excusedMode: boolean
  ): Promise<DailyMetrics> {
    if (excusedMode) {
      const dayHabits: HabitRow[] = await habits.listByDate(db, date);
      return {
        date,
        score: 0,
        maxScore: PRAYER_NAMES.length * 3,
        statuses: new Map(),
        habits: dayHabits,
        isPerfect: false,
        hasLateOrMissed: false,
        isExcused: true,
        loggedCount: 0,
      };
    }

    const dayPrayers: PrayerRow[] = await prayers.byDate(db, date);
    const dayHabits: HabitRow[] = await habits.listByDate(db, date);

    let score = 0;
    const statuses = new Map<string, PrayerStatus>();
    let hasLateOrMissed = false;
    let hasAllOnTimeOrJamah = true;
    let loggedCount = 0;

    for (const prayer of dayPrayers) {
      const status = (prayer.status as PrayerStatus) ?? 'Missed';
      statuses.set(prayer.name, status);
      loggedCount++;

      score += pointsFor(status);

      if (status === 'Late' || status === 'Missed') {
        hasLateOrMissed = true;
      }
      if (status !== 'Jamāʾah' && status !== 'On-Time') {
        hasAllOnTimeOrJamah = false;
      }
    }

    const isPastDay = !isToday(new Date(date + 'T00:00:00'));

    for (const name of PRAYER_NAMES) {
      if (!statuses.has(name)) {
        if (isPastDay) {
          hasAllOnTimeOrJamah = false;
          statuses.set(name, 'Missed');
          hasLateOrMissed = true;
        } else {
          hasAllOnTimeOrJamah = false;
        }
      }
    }

    const isPerfect = loggedCount === PRAYER_NAMES.length && hasAllOnTimeOrJamah;

    return {
      date,
      score,
      maxScore: PRAYER_NAMES.length * 3,
      statuses,
      habits: dayHabits,
      isPerfect,
      hasLateOrMissed,
      isExcused: false,
      loggedCount,
    };
  }

  async computeStreak(
    db: SQLiteDatabase,
    excusedMode: boolean,
    todayIso: string
  ): Promise<{ current: number; best: number }> {
    const calendar = buildCalendarAround(todayIso, this.maxAgeDays);
    let best = 0;
    let streak = 0;

    for (const day of calendar) {
      const metrics = await this.computeDay(db, day, excusedMode);

      if (metrics.isExcused) {
        continue;
      }

      if (metrics.isPerfect) {
        streak += 1;
        best = Math.max(best, streak);
      } else if (metrics.hasLateOrMissed) {
        streak = 0;
      } else {
        continue;
      }
    }

    return { current: streak, best };
  }

  async computeHeatmap(db: SQLiteDatabase, excusedMode: boolean, todayIso: string) {
    const yearAgo = subDays(new Date(todayIso), 365).toISOString().slice(0, 10);
    const days = eachDayOfInterval(startOfDay(new Date(yearAgo)), startOfDay(new Date(todayIso)));

    const results = await Promise.all(
      days.map(async day => {
        const iso = format(day, 'yyyy-MM-dd');
        const metrics = await this.computeDay(db, iso, excusedMode);
        if (metrics.isExcused) {
          return { date: iso, metadata: 'excused' as const };
        }
        if (metrics.isPerfect) {
          return { date: iso, metadata: 'perfect' as const };
        }
        if (metrics.hasLateOrMissed) {
          return { date: iso, metadata: 'missed' as const };
        }
        if (metrics.loggedCount === 0) {
          return { date: iso, metadata: 'unknown' as const };
        }
        return { date: iso, metadata: 'partial' as const };
      })
    );

    return results;
  }

  async computePieDistribution(db: SQLiteDatabase, excusedMode: boolean) {
    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const thirtyDays = eachDayOfInterval(
      startOfDay(new Date(thirtyDaysAgo)),
      startOfDay(new Date())
    );

    let jamah = 0;
    let onTime = 0;
    let late = 0;
    let missed = 0;
    let totalPrayers = 0;

    for (const day of thirtyDays) {
      const iso = format(day, 'yyyy-MM-dd');
      const metrics = await this.computeDay(db, iso, excusedMode);
      for (const [, status] of metrics.statuses) {
        if (status === 'Jamāʾah') jamah += 1;
        else if (status === 'On-Time') onTime += 1;
        else if (status === 'Late') late += 1;
        else if (status === 'Missed') missed += 1;

        totalPrayers += 1;
      }
    }

    const denominator = excusedMode ? totalPrayers : (jamah + onTime + late + missed);

    return {
      jamah,
      onTime,
      late,
      missed,
      denominator,
      jamahPct: denominator ? Math.round((jamah / denominator) * 100) : 0,
      onTimePct: denominator ? Math.round((onTime / denominator) * 100) : 0,
      latePct: denominator ? Math.round((late / denominator) * 100) : 0,
      missedPct: denominator ? Math.round((missed / denominator) * 100) : 0,
    };
  }

  async computePrayerBarChart(db: SQLiteDatabase, excusedMode: boolean) {
    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const thirtyDays = eachDayOfInterval(
      startOfDay(new Date(thirtyDaysAgo)),
      startOfDay(new Date())
    );

    const sums = new Map<string, { score: number; maxScore: number }>();
    for (const prayer of PRAYER_NAMES) {
      sums.set(prayer, { score: 0, maxScore: 0 });
    }

    for (const day of thirtyDays) {
      const iso = format(day, 'yyyy-MM-dd');
      const dayPrayers = await prayers.byDate(db, iso);

      for (const prayer of PRAYER_NAMES) {
        const row = dayPrayers.find(p => p.name === prayer);
        if (!row) continue;

        const status = (row.status as PrayerStatus) ?? 'Missed';

        const data = sums.get(prayer)!;
        data.score += pointsFor(status);
        data.maxScore += 3;
      }
    }

    return PRAYER_NAMES.map(name => {
      const data = sums.get(name) ?? { score: 0, maxScore: 0 };
      return {
        name,
        score: data.score,
        maxScore: data.maxScore,
        pct: data.maxScore ? Math.round((data.score / data.maxScore) * 100) : 0,
      };
    });
  }

  async computeTrendLine(db: SQLiteDatabase, excusedMode: boolean) {
    const today = startOfDay(new Date());
    const days = eachDayOfInterval(subDays(today, 179), today);

    const scores: number[] = [];
    for (const day of days) {
      const iso = format(day, 'yyyy-MM-dd');
      const metrics = await this.computeDay(db, iso, excusedMode);
      const maxScore = PRAYER_NAMES.length * 3;
      scores.push(maxScore > 0 ? (metrics.score / maxScore) * 100 : 0);
    }

    const windowSize = 7;
    const smoothed: number[] = [];
    for (let i = 0; i < scores.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const window = scores.slice(start, i + 1);
      smoothed.push(window.reduce((a, b) => a + b, 0) / window.length);
    }

    return smoothed;
  }
}

function eachDayOfInterval(start: Date, end: Date) {
  const days: Date[] = [];
  let current = new Date(start);
  while (current <= end) {
    days.push(new Date(current));
    current = subDays(current, -1);
  }
  return days;
}

function buildCalendarAround(seed: string, maxAgeDays: number): string[] {
  const calendar: string[] = [];
  let cursor = new Date(seed);
  const oldest = subDays(cursor, maxAgeDays);
  while (cursor >= oldest) {
    calendar.push(format(cursor, 'yyyy-MM-dd'));
    cursor = subDays(cursor, 1);
  }
  return calendar;
}
