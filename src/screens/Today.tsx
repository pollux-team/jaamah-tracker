import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';
import * as Haptics from 'expo-haptics';
import { format, subDays, addDays, startOfDay, isToday, differenceInDays } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDatabase, prayers, habits, settings } from '@/database/sqlite';
import type { PrayerRow, HabitRow } from '@/database/sqlite';
import { PRAYER_NAMES, HABIT_KEYS, STATUS_OPTIONS } from '@/logic/scorer';
import type { PrayerStatus } from '@/logic/scorer';
import { Colors, type AppTheme } from '@/constants/theme';
import type { Coordinates } from '@/utils/location';
import { getPrayerTimes, getNextPrayer } from '@/utils/prayer-times';
import type { CalculationMethodKey, AsrMethod } from '@/utils/prayer-times';
import Onboarding from '@/components/onboarding';

type DateState = {
  iso: string;
  display: string;
};

function mapStatusToOption(status: string | null) {
  const found = STATUS_OPTIONS.find(option => option.value === status);
  return found ?? STATUS_OPTIONS[3];
}

function buildDateState(base: Date): DateState {
  const iso = format(base, 'yyyy-MM-dd');
  const display = format(base, Platform.select({ ios: 'EEE, MMM d', default: 'EEE, d MMM' }) ?? 'EEE, d MMM');
  if (isToday(base)) {
    return { iso, display: `Today · ${display}` };
  }
  if (differenceInDays(new Date(), base) === 1) {
    return { iso, display: `Yesterday · ${display}` };
  }
  return { iso, display };
}

function getStreakAccent(age: number, colors: AppTheme): string {
  if (age === 0) return colors.primary;
  if (age < 3) return '#22c55e';
  if (age < 7) return '#a3e635';
  if (age < 14) return '#facc15';
  if (age < 30) return '#f97316';
  return '#ef4444';
}

function useCountdown(targetTime: Date | null) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!targetTime) return;

    const update = () => {
      const diff = targetTime.getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('Now');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  return remaining;
}

export default function TodayScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { db } = useDatabase();
  const insets = useSafeAreaInsets();

  const [cursor, setCursor] = useState<Date>(startOfDay(new Date()));
  const [dateState, setDateState] = useState<DateState>(() => buildDateState(startOfDay(new Date())));
  const [prayersDay, setPrayersDay] = useState<PrayerRow[]>([]);
  const [habitsDay, setHabitsDay] = useState<HabitRow[]>([]);
  const [excusedMode, setExcusedMode] = useState(false);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [streak, setStreak] = useState({ current: 0, best: 0 });
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(true);
  const [selectedPrayer, setSelectedPrayer] = useState<string | null>(null);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [calcMethod, setCalcMethod] = useState<CalculationMethodKey>('MWL');
  const [asrMethod, setAsrMethod] = useState<AsrMethod>('Standard');

  const prayerPickerOpacity = useSharedValue(0);

  const theme = useMemo(
    () => Colors[isDark ? 'dark' : 'light'],
    [isDark]
  );

  const prayerTimes = useMemo(() => {
    if (!location) return null;
    return getPrayerTimes(cursor, location, calcMethod, asrMethod);
  }, [cursor, location, calcMethod, asrMethod]);

  const nextPrayer = useMemo(() => {
    if (!prayerTimes || !isToday(cursor)) return null;
    return getNextPrayer(prayerTimes);
  }, [prayerTimes, cursor]);

  const countdown = useCountdown(nextPrayer?.time ?? null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const onboardingDone = await settings.get<boolean>(db, 'onboardingDone', false);
      if (!onboardingDone) {
        setNeedsOnboarding(true);
        setLoading(false);
        return;
      }
      setNeedsOnboarding(false);
      setPrayersDay(await prayers.byDate(db, dateState.iso));
      setHabitsDay(await habits.listByDate(db, dateState.iso));
      try {
        const storedGender = await settings.get<'male' | 'female'>(db, 'gender', 'male');
        setGender(storedGender);
        const storedExcused = await settings.get<boolean>(db, 'excusedMode', false);
        setExcusedMode(storedExcused);
        const storedStreak = await settings.get<{ current: number; best: number }>(
          db,
          'streak',
          { current: 0, best: 0 }
        );
        setStreak(storedStreak);
        const storedLocation = await settings.get<Coordinates | null>(db, 'location', null);
        if (storedLocation) setLocation(storedLocation);
        const storedMethod = await settings.get<CalculationMethodKey>(db, 'calcMethod', 'MWL');
        setCalcMethod(storedMethod);
        const storedAsr = await settings.get<AsrMethod>(db, 'asrMethod', 'Standard');
        setAsrMethod(storedAsr);
      } catch {}
      setLoading(false);
    };
    load();
  }, [db, dateState.iso]);

  useEffect(() => {
    if (selectedPrayer) {
      prayerPickerOpacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) });
    } else {
      prayerPickerOpacity.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) });
    }
  }, [selectedPrayer, prayerPickerOpacity]);

  const pickerAnimStyle = useAnimatedStyle(() => ({
    opacity: prayerPickerOpacity.value,
    transform: [{ scaleY: 0.8 + prayerPickerOpacity.value * 0.2 }],
  }));

  const goBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = subDays(cursor, 1);
    setCursor(next);
    setDateState(buildDateState(next));
    setSelectedPrayer(null);
  }, [cursor]);

  const goForward = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = addDays(cursor, 1);
    if (next > startOfDay(new Date())) return;
    setCursor(next);
    setDateState(buildDateState(next));
    setSelectedPrayer(null);
  }, [cursor]);

  const goToday = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = startOfDay(new Date());
    setCursor(next);
    setDateState(buildDateState(next));
    setSelectedPrayer(null);
  }, []);

  const updatePrayer = useCallback(
    async (name: string, status: PrayerStatus) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLoading(true);
      await prayers.upsert(db, name, status, dateState.iso);
      const updated = await prayers.byDate(db, dateState.iso);
      setPrayersDay(updated);
      const todaysScore = updated.reduce((sum: number, row: PrayerRow) => {
        const s = (row.status as PrayerStatus) ?? 'Missed';
        return sum + (STATUS_OPTIONS.find(o => o.value === s)?.points ?? 0);
      }, 0);
      setScore(todaysScore);
      setLoading(false);
      setSelectedPrayer(null);
    },
    [db, dateState.iso]
  );

  const toggleHabit = useCallback(
    async (habitKey: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const existing = habitsDay.find(row => row.key === habitKey);
      const next = existing ? (existing.completed ? 0 : 1) : 1;
      await habits.upsert(db, habitKey, next as 0 | 1, dateState.iso);
      setHabitsDay(await habits.listByDate(db, dateState.iso));
    },
    [db, dateState.iso, habitsDay]
  );

  const handleExcused = useCallback(
    async (value: boolean) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setExcusedMode(value);
      await settings.set(db, 'excusedMode', value);
    },
    [db]
  );

  const prayerList = useMemo(() => {
    return PRAYER_NAMES.map(name => {
      const row = prayersDay.find(p => p.name === name);
      const timeLabel = prayerTimes?.entries.find(e => e.name === name)?.label ?? '';
      return {
        name,
        status: (row?.status as PrayerStatus | null) ?? null,
        option: mapStatusToOption(row?.status ?? null),
        timeLabel,
      };
    });
  }, [prayersDay, prayerTimes]);

  const scoreAccent = useMemo(() => {
    const max = PRAYER_NAMES.length * 3;
    if (score >= max) return getStreakAccent(30, theme);
    if (score >= 10) return getStreakAccent(14, theme);
    if (score >= 5) return getStreakAccent(7, theme);
    return theme.textSecondary;
  }, [score, theme]);

  if (needsOnboarding) {
    return (
      <Onboarding onComplete={() => setNeedsOnboarding(false)} />
    );
  }

  return (
    <ScrollView
      keyboardDismissMode="interactive"
      style={[styles.root, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}>
      <View style={[styles.dateBar, { backgroundColor: theme.backgroundElement }]}>
        <Pressable onPress={goBack} hitSlop={12} style={({ pressed }) => pressed && { opacity: 0.5 }}>
          <Text style={[styles.dateNavLabel, { color: theme.text }]}>‹</Text>
        </Pressable>

        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={[styles.dateLabel, { color: theme.text }]}>{dateState.display}</Text>
        </View>

        <Pressable
          onPress={goForward}
          hitSlop={12}
          style={({ pressed }) => pressed && { opacity: 0.5 }}>
          <Text style={[styles.dateNavLabel, { color: theme.text }]}>›</Text>
        </Pressable>

        {!isToday(cursor) && (
          <Pressable
            onPress={goToday}
            hitSlop={12}
            style={({ pressed }) => pressed && { opacity: 0.5 }}>
            <Text style={[styles.nowLabel, { color: theme.primary }]}>Now</Text>
          </Pressable>
        )}
      </View>

      {nextPrayer && isToday(cursor) && (
        <Animated.View entering={FadeIn.duration(300)} style={[styles.countdownCard, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.countdownRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.countdownLabel, { color: theme.textSecondary }]}>Next Prayer</Text>
              <Text style={[styles.countdownPrayer, { color: theme.text }]}>{nextPrayer.name}</Text>
              <Text style={[styles.countdownTime, { color: theme.textSecondary }]}>at {nextPrayer.label}</Text>
            </View>
            <View style={[styles.countdownCircle, { borderColor: theme.primary }]}>
              <Text style={[styles.countdownValue, { color: theme.text }]}>{countdown}</Text>
            </View>
          </View>
        </Animated.View>
      )}

      <View style={styles.heroRow}>
        <View style={styles.heroText}>
          <Text style={[styles.heroHeading, { color: theme.textSecondary }]}>Daily Score</Text>
          <Text style={[styles.heroScore, { color: scoreAccent }]}>
            {score}/{PRAYER_NAMES.length * 3}
          </Text>
        </View>
        <View
          style={[
            styles.streakCard,
            { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
          ]}>
          <SymbolView
            name="flame.fill"
            tintColor={getStreakAccent(streak.current > 0 ? streak.current - 1 : 0, theme)}
            size={18}
          />
          <View style={{ marginLeft: 8 }}>
            <Text style={[styles.streakValue, { color: theme.text }]}>{streak.current}</Text>
            <Text style={[styles.streakLabel, { color: theme.textSecondary }]}>Best {streak.best}</Text>
          </View>
        </View>
      </View>

      {excusedMode && gender === 'female' && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[styles.excusedBanner, { backgroundColor: theme.backgroundElement, borderColor: theme.prohibited }]}>
          <SymbolView name="moon.fill" tintColor={theme.prohibited} size={14} />
          <Text style={[styles.excusedBannerText, { color: theme.textSecondary }]}>
            Prohibited Days — fard + sunnah paused
          </Text>
        </Animated.View>
      )}

      {gender === 'female' && (
        <View style={[styles.excusedControl, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <SymbolView name="moon.fill" tintColor={theme.prohibited} size={16} />
            <Text style={[styles.excusedControlLabel, { color: theme.text }]}>Prohibited Days</Text>
          </View>
          <Pressable
            onPress={() => handleExcused(!excusedMode)}
            style={[styles.pill, { backgroundColor: excusedMode ? theme.prohibited : theme.backgroundSelected }]}>
            <Text style={[styles.pillLabel, { color: excusedMode ? '#fff' : theme.textSecondary }]}>
              {excusedMode ? 'On' : 'Off'}
            </Text>
          </Pressable>
        </View>
      )}

      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Fard Tracker</Text>

      {loading ? (
        <Text style={[styles.body, { color: theme.textSecondary }]}>Saving...</Text>
      ) : (
        <View style={[styles.card, { borderColor: theme.backgroundSelected }]}>
          {prayerList.map(prayer => {
            const isExcused = excusedMode && gender === 'female';
            const isSelected = selectedPrayer === prayer.name;
            return (
              <View key={prayer.name}>
                <Pressable
                  onPress={() => {
                    if (!isExcused) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedPrayer(isSelected ? null : prayer.name);
                    }
                  }}
                  style={[styles.prayerRow, { borderBottomColor: theme.backgroundSelected }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.prayerName, { color: theme.text }]}>{prayer.name}</Text>
                    <View style={styles.prayerSubRow}>
                      <Text style={[styles.prayerPoints, { color: theme.textSecondary }]}>
                        {prayer.status ? `${prayer.option.points}p` : '--'}
                      </Text>
                      {prayer.timeLabel ? (
                        <Text style={[styles.prayerTime, { color: theme.textSecondary }]}>
                          {prayer.timeLabel}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: isExcused ? '#d8b4fe' : prayer.option.color },
                    ]}
                  />
                </Pressable>

                {isSelected && (
                  <Animated.View style={[styles.statusPickerWrap, pickerAnimStyle]}>
                    <View style={styles.statusPicker}>
                      {STATUS_OPTIONS.map(option => (
                        <Pressable
                          key={option.value}
                          onPress={() => updatePrayer(prayer.name, option.value)}
                          style={({ pressed }) => [
                            styles.statusOption,
                            {
                              backgroundColor:
                                prayer.option.value === option.value
                                  ? option.color
                                  : theme.backgroundElement,
                              opacity: pressed ? 0.8 : 1,
                            },
                          ]}>
                          <Text
                            style={[
                              styles.statusOptionLabel,
                              {
                                color:
                                  prayer.option.value === option.value ? '#fff' : theme.text,
                              },
                            ]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </Animated.View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Habit Stacking</Text>

      <View style={[styles.card, { borderColor: theme.backgroundSelected }]}>
        {HABIT_KEYS.map(habit => {
          const row = habitsDay.find(h => h.key === habit.value);
          const completed = row ? !!row.completed : false;
          return (
            <Pressable
              key={habit.value}
              onPress={() => toggleHabit(habit.value)}
              style={[styles.habitRow, { borderBottomColor: theme.backgroundSelected }]}>
              <View
                style={[
                  styles.checkbox,
                  { borderColor: theme.textSecondary },
                  completed && { backgroundColor: theme.success, borderColor: theme.success },
                ]}>
                {completed && (
                  <SymbolView name="checkmark" tintColor="#fff" size={12} />
                )}
              </View>
              <Text
                style={[
                  styles.habitLabel,
                  { color: theme.text },
                  completed && { textDecorationLine: 'line-through', opacity: 0.6 },
                ]}>
                {habit.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 16, paddingBottom: 96 },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  dateLabel: { fontSize: 16, fontWeight: '600', flex: 1, textAlign: 'center' },
  dateNavLabel: { fontSize: 22, fontWeight: '600', minWidth: 36, textAlign: 'center' },
  nowLabel: { fontSize: 14, fontWeight: '600', marginLeft: 4 },
  countdownCard: {
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: 16,
  },
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  countdownLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 },
  countdownPrayer: { fontSize: 22, fontWeight: '700', marginTop: 2 },
  countdownTime: { fontSize: 13, marginTop: 1 },
  countdownCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  countdownValue: { fontSize: 16, fontWeight: '700' },
  heroRow: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  heroText: { flex: 1 },
  heroHeading: { fontSize: 14, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.4 },
  heroScore: { fontSize: 32, fontWeight: '800', marginTop: 2 },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  streakValue: { fontSize: 20, fontWeight: '700' },
  streakLabel: { fontSize: 11 },
  excusedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  excusedBannerText: { fontSize: 13, fontWeight: '500', flex: 1 },
  sectionLabel: { fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: '600' },
  card: {
    borderRadius: 18,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  prayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  prayerName: { fontSize: 16, fontWeight: '600' },
  prayerSubRow: { flexDirection: 'row', gap: 10, marginTop: 2, alignItems: 'center' },
  prayerPoints: { fontSize: 13 },
  prayerTime: { fontSize: 12 },
  statusDot: { width: 14, height: 14, borderRadius: 7, borderCurve: 'continuous' },
  statusPickerWrap: { paddingHorizontal: 14, paddingBottom: 12, paddingTop: 4 },
  statusPicker: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  statusOption: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderCurve: 'continuous' },
  statusOptionLabel: { fontSize: 12, fontWeight: '600' },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderCurve: 'continuous',
    justifyContent: 'center',
    alignItems: 'center',
  },
  habitLabel: { fontSize: 15, fontWeight: '500', flex: 1 },
  excusedControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderCurve: 'continuous',
    marginTop: 4,
  },
  excusedControlLabel: { fontSize: 15, fontWeight: '600' },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderCurve: 'continuous',
  },
  pillLabel: { fontSize: 13, fontWeight: '600' },
  onboardingCard: {
    padding: 24,
    gap: 16,
    borderRadius: 24,
    borderCurve: 'continuous',
  },
  onboardingTitle: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  onboardingBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    borderCurve: 'continuous',
  },
  actionLabel: { fontSize: 15, fontWeight: '600' },
  body: { fontSize: 14, textAlign: 'center', paddingVertical: 8 },
});
