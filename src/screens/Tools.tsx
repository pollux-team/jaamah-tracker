'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDatabase, settings } from '@/database/sqlite';
import { Colors } from '@/constants/theme';
import { getPrayerTimes, getNextPrayer, CALCULATION_METHODS, getCurrentWaqt } from '@/utils/prayer-times';
import type { CalculationMethodKey, AsrMethod } from '@/utils/prayer-times';
import { getQiblaDirection, useMagnetometerHeading } from '@/utils/qibla';
import type { Coordinates } from '@/utils/location';
import Icon from '@/components/icon';
import WaqtArc from '@/components/waqt-arc';

export default function ToolsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { db } = useDatabase();
  const insets = useSafeAreaInsets();
  const theme = useMemo(() => Colors[isDark ? 'dark' : 'light'], [isDark]);

  const [location, setLocation] = useState<Coordinates | null>(null);
  const [calcMethod, setCalcMethod] = useState<CalculationMethodKey>('MWL');
  const [asrMethod, setAsrMethod] = useState<AsrMethod>('Standard');
  const [now, setNow] = useState(new Date());

  const heading = useMagnetometerHeading();

  useEffect(() => {
    const load = async () => {
      try {
        const loc = await settings.get<Coordinates | null>(db, 'location', null);
        if (loc) setLocation(loc);
        const method = await settings.get<CalculationMethodKey>(db, 'calcMethod', 'MWL');
        setCalcMethod(method);
        const asr = await settings.get<AsrMethod>(db, 'asrMethod', 'Standard');
        setAsrMethod(asr);
      } catch {}
    };
    load();
  }, [db]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const prayerTimes = useMemo(() => {
    if (!location) return null;
    return getPrayerTimes(now, location, calcMethod, asrMethod);
  }, [now, location, calcMethod, asrMethod]);

  const nextPrayer = useMemo(() => {
    if (!prayerTimes) return null;
    return getNextPrayer(prayerTimes);
  }, [prayerTimes]);

  const waqtInfo = useMemo(() => {
    if (!prayerTimes) return null;
    return getCurrentWaqt(prayerTimes);
  }, [prayerTimes]);

  const countdown = useMemo(() => {
    if (!nextPrayer) return '--';
    const diff = nextPrayer.time.getTime() - now.getTime();
    if (diff <= 0) return 'Now';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
  }, [nextPrayer, now]);

  const qiblaBearing = useMemo(() => {
    if (!location) return 0;
    return getQiblaDirection(location.latitude, location.longitude);
  }, [location]);

  const compassRotation = useSharedValue(0);

  useEffect(() => {
    compassRotation.value = withTiming(-heading, { duration: 200 });
  }, [heading, compassRotation]);

  const compassStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${compassRotation.value}deg` }],
  }));

  const qiblaArrowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${qiblaBearing + compassRotation.value}deg` }],
  }));

  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [pulseAnim]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  if (!location) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Icon name="location.slash" fallback="location-off" tint={theme.textSecondary} size={48} />
        <Text style={[styles.emptyTitle, { color: theme.text }]}>No Location Set</Text>
        <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
          Go to Today tab and set your location to use prayer times and Qibla compass.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}>

      <Animated.View style={[styles.countdownCard, { backgroundColor: theme.backgroundElement }, pulseStyle]}>
        <View style={styles.countdownInner}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.countdownLabel, { color: theme.textSecondary }]}>Next Prayer</Text>
            <Text style={[styles.countdownPrayer, { color: theme.text }]}>{nextPrayer?.name ?? '--'}</Text>
            <Text style={[styles.countdownTime, { color: theme.textSecondary }]}>
              {nextPrayer?.label ? `at ${nextPrayer.label}` : ''}
            </Text>
          </View>
          <WaqtArc
            progress={waqtInfo?.progress ?? 0}
            size={140}
            strokeWidth={9}
            label={waqtInfo?.name ?? nextPrayer?.name ?? '--'}
            sublabel={waqtInfo ? `${waqtInfo.startLabel} – ${waqtInfo.endLabel}` : ''}
            elapsed={waqtInfo ? `${Math.round((1 - waqtInfo.progress) * 100)}% left` : countdown}
          />
        </View>
      </Animated.View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Daily Schedule</Text>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          {prayerTimes?.entries.map((entry, i) => {
            const isNext = nextPrayer?.name === entry.name;
            const isSunrise = entry.type === 'time';
            return (
              <View
                key={entry.name}
                style={[
                  styles.scheduleRow,
                  i < prayerTimes.entries.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? '#333' : '#e5e5e5' },
                ]}>
                <View style={styles.scheduleNameRow}>
                  {isNext && <View style={[styles.nextDot, { backgroundColor: theme.primary }]} />}
                  <Text style={[styles.scheduleName, { color: isNext ? theme.primary : isSunrise ? theme.textSecondary : theme.text, opacity: isSunrise ? 0.6 : 1 }]}>
                    {entry.name}
                  </Text>
                  {isSunrise && (
                    <Text style={[styles.scheduleBadge, { color: theme.textSecondary }]}>No Salah</Text>
                  )}
                </View>
                <Text style={[styles.scheduleTime, { color: isNext ? theme.primary : isSunrise ? theme.textSecondary : theme.textSecondary, opacity: isSunrise ? 0.5 : 1 }]}>{entry.label}</Text>
              </View>
            );
          }) ?? (
            <Text style={[styles.cardBody, { color: theme.textSecondary }]}>Loading prayer times...</Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Qibla Compass</Text>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement, alignItems: 'center', paddingVertical: 32 }]}>
          <View style={styles.compassContainer}>
            <Animated.View style={[styles.compassDisc, compassStyle]}>
              <View style={[styles.compassRing, { borderColor: theme.textSecondary }]}>
                <Text style={[styles.compassN, { color: theme.text }]}>N</Text>
                <Text style={[styles.compassE, { color: theme.textSecondary }]}>E</Text>
                <Text style={[styles.compassS, { color: theme.textSecondary }]}>S</Text>
                <Text style={[styles.compassW, { color: theme.textSecondary }]}>W</Text>
              </View>
            </Animated.View>
            <Animated.View style={[styles.qiblaArrow, qiblaArrowStyle]}>
              <Icon name="arrow.up" fallback="navigation" tint={theme.success} size={24} />
            </Animated.View>
          </View>
          <Text style={[styles.compassLabel, { color: theme.text }]}>
            Qibla: {Math.round(qiblaBearing)}° from North
          </Text>
          <Text style={[styles.compassHint, { color: theme.textSecondary }]}>
            Point your phone north. The green arrow points to Makkah.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Calculation Method</Text>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          {CALCULATION_METHODS.map(m => (
            <Pressable
              key={m.value}
              onPress={async () => {
                setCalcMethod(m.value);
                await settings.set(db, 'calcMethod', m.value);
              }}
              style={({ pressed }) => [
                styles.methodRow,
                {
                  backgroundColor: calcMethod === m.value ? theme.selectedHighlight : 'transparent',
                  opacity: pressed ? 0.8 : 1,
                },
              ]}>
              <Text style={[styles.methodLabel, { color: calcMethod === m.value ? theme.primary : theme.text }]}>
                {m.label}
              </Text>
              {calcMethod === m.value && (
                <Icon name="checkmark.circle.fill" fallback="check-circle" tint={theme.primary} size={18} />
              )}
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 16, paddingBottom: 96 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginTop: 16 },
  emptyBody: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  section: { gap: 8 },
  sectionLabel: { fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: '600' },
  card: { borderRadius: 20, borderCurve: 'continuous', padding: 14, overflow: 'hidden' },
  cardBody: { fontSize: 14, lineHeight: 18 },
  countdownCard: {
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: 20,
  },
  countdownInner: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  countdownLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '600' },
  countdownPrayer: { fontSize: 28, fontWeight: '800', marginTop: 2 },
  countdownTime: { fontSize: 13, marginTop: 2 },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  scheduleNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nextDot: { width: 6, height: 6, borderRadius: 3 },
  scheduleName: { fontSize: 15, fontWeight: '600' },
  scheduleTime: { fontSize: 15, fontWeight: '500' },
  compassContainer: { width: 200, height: 200, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  compassDisc: { width: 200, height: 200, justifyContent: 'center', alignItems: 'center' },
  compassRing: { width: 180, height: 180, borderRadius: 90, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  compassN: { position: 'absolute', top: 8, fontSize: 16, fontWeight: '700' },
  compassE: { position: 'absolute', right: 10, fontSize: 14, fontWeight: '500' },
  compassS: { position: 'absolute', bottom: 8, fontSize: 14, fontWeight: '500' },
  compassW: { position: 'absolute', left: 10, fontSize: 14, fontWeight: '500' },
  qiblaArrow: { position: 'absolute', top: 10 },
  compassLabel: { fontSize: 16, fontWeight: '600' },
  compassHint: { fontSize: 12, marginTop: 4, textAlign: 'center' },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  methodLabel: { fontSize: 14, fontWeight: '500', flex: 1 },
  scheduleBadge: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    backgroundColor: 'rgba(128,128,128,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
});
