'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';
import { format, startOfDay } from 'date-fns';

import { useDatabase, settings } from '@/database/sqlite';
import { StreakEngine } from '@/logic/scorer';
import { Colors } from '@/constants/theme';

const HEATMAP_CELL = 10;
const HEATMAP_GAP = 2;
const HEATMAP_COLS = 53;

const engine = new StreakEngine(366);

function getHeatmapColor(metadata: string): string {
  switch (metadata) {
    case 'perfect': return '#2d9d64';
    case 'partial': return '#d97706';
    case 'missed': return '#dc2626';
    case 'excused': return '#9333ea';
    default: return '#27272a';
  }
}

export default function StatsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { db } = useDatabase();
  const theme = useMemo(() => Colors[isDark ? 'dark' : 'light'], [isDark]);

  const [refreshing, setRefreshing] = useState(false);
  const [streak, setStreak] = useState({ current: 0, best: 0 });
  const [heatmap, setHeatmap] = useState<{ date: string; metadata: string }[]>([]);
  const [pie, setPie] = useState({
    jamah: 0, onTime: 0, late: 0, missed: 0,
    denominator: 0, jamahPct: 0, onTimePct: 0, latePct: 0, missedPct: 0,
  });
  const [barChart, setBarChart] = useState<{ name: string; score: number; maxScore: number; pct: number }[]>([]);
  const [trend, setTrend] = useState<number[]>([]);
  const [excusedMode, setExcusedMode] = useState(false);

  const streakPulse = useSharedValue(0);
  const initialized = useRef(false);

  useEffect(() => {
    streakPulse.value = withTiming(1, { duration: 1200 });
  }, [streakPulse]);

  const streakBadgeAnim = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + streakPulse.value * 0.06 }],
    opacity: 0.8 + streakPulse.value * 0.2,
  }));

  const loadData = useCallback(async () => {
    const todayIso = format(startOfDay(new Date()), 'yyyy-MM-dd');
    const storedExcused = await settings.get<boolean>(db, 'excusedMode', false);
    setExcusedMode(storedExcused);

    const [s, h, p, b, t] = await Promise.all([
      engine.computeStreak(db, storedExcused, todayIso),
      engine.computeHeatmap(db, storedExcused, todayIso),
      engine.computePieDistribution(db, storedExcused),
      engine.computePrayerBarChart(db, storedExcused),
      engine.computeTrendLine(db, storedExcused),
    ]);

    setStreak(s);
    setHeatmap(h);
    setPie(p);
    setBarChart(b);
    setTrend(t);
    await settings.set(db, 'streak', s);
  }, [db]);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      loadData();
    }
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const trendMax = Math.max(...(trend.length ? trend : [100]), 1);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />}>
      <View style={[styles.banner, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
        <View style={{ gap: 4, flex: 1 }}>
          <Text style={[styles.bannerLabel, { color: theme.textSecondary }]}>Current Streak</Text>
          <View style={styles.bannerRow}>
            <SymbolView name="flame.fill" tintColor={streak.current > 0 ? '#f97316' : theme.textSecondary} size={20} />
            <Text style={[styles.bannerValue, { color: theme.text }]}>{streak.current}</Text>
          </View>
          <Text style={[styles.bannerHint, { color: theme.textSecondary }]}>
            Best streak: {streak.best}
          </Text>
        </View>

        <Animated.View style={[styles.streakBadge, streakBadgeAnim, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}>
          <SymbolView name="star.fill" tintColor="#d97706" size={22} />
          <Text style={[styles.streakBadgeValue, { color: theme.text }]}>{streak.best}</Text>
          <Text style={[styles.streakBadgeLabel, { color: theme.textSecondary }]}>Best</Text>
        </Animated.View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Yearly Heatmap</Text>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.heatmapGrid}>
              {Array.from({ length: HEATMAP_COLS }).map((_, col) => (
                <View key={col} style={styles.heatmapCol}>
                  {Array.from({ length: 7 }).map((_, row) => {
                    const idx = col * 7 + row;
                    const cell = heatmap[idx];
                    return (
                      <View
                        key={row}
                        style={[
                          styles.heatmapCell,
                          { backgroundColor: cell ? getHeatmapColor(cell.metadata) : (isDark ? '#18181b' : '#e4e4e7') },
                        ]}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
          <View style={styles.heatmapLegend}>
            <LegendItem color="#2d9d64" label="Perfect" theme={theme} />
            <LegendItem color="#d97706" label="Partial" theme={theme} />
            <LegendItem color="#dc2626" label="Missed" theme={theme} />
            <LegendItem color="#c4b5fd" label="Prohibited" theme={theme} />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Quality Breakdown (30 days)</Text>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          {[
            { label: "Jamā'ah", pct: pie.jamahPct, color: '#1a7a4c' },
            { label: 'On-Time', pct: pie.onTimePct, color: '#2d9d64' },
            { label: 'Late', pct: pie.latePct, color: '#d97706' },
            { label: 'Missed', pct: pie.missedPct, color: '#dc2626' },
          ].map(item => (
            <View key={item.label} style={styles.pieRow}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <Text style={[styles.pieLabel, { color: theme.text }]}>{item.label}</Text>
              <Text style={[styles.pieValue, { color: theme.textSecondary }]}>{item.pct}%</Text>
              <View style={[styles.pieBarTrack, { backgroundColor: isDark ? '#27272a' : '#e4e4e7' }]}>
                <View style={[styles.pieBarFill, { width: `${item.pct}%`, backgroundColor: item.color }]} />
              </View>
            </View>
          ))}
          {excusedMode && (
            <Text style={[styles.cardHint, { color: theme.textSecondary }]}>
              Denominator auto-adjusted for Prohibited Days.
            </Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Prayer Focus (30 days)</Text>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          {barChart.map(item => (
            <View key={item.name} style={styles.barRow}>
              <Text style={[styles.barName, { color: theme.text }]}>{item.name}</Text>
              <View style={[styles.barTrack, { backgroundColor: isDark ? '#27272a' : '#e4e4e7' }]}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${item.pct}%`, backgroundColor: item.pct > 70 ? '#2d9d64' : item.pct > 40 ? '#d97706' : '#dc2626' },
                  ]}
                />
              </View>
              <Text style={[styles.barPct, { color: theme.textSecondary }]}>{item.pct}%</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>6 Month Trend</Text>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          {trend.length > 0 ? (
            <View style={styles.trendChart}>
              <View style={styles.trendRow}>
                {trend.map((val, i) => {
                  const h = Math.max(2, (val / trendMax) * 80);
                  return (
                    <View
                      key={i}
                      style={[
                        styles.trendBar,
                        {
                          height: h,
                          backgroundColor: val > 70 ? '#2d9d64' : val > 40 ? '#d97706' : '#dc2626',
                          opacity: i === trend.length - 1 ? 1 : 0.6 + (i / trend.length) * 0.4,
                        },
                      ]}
                    />
                  );
                })}
              </View>
              <View style={styles.trendLabels}>
                <Text style={[styles.trendLabel, { color: theme.textSecondary }]}>6mo ago</Text>
                <Text style={[styles.trendLabel, { color: theme.textSecondary }]}>Today</Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.cardBody, { color: theme.textSecondary }]}>
              Start logging to see your trend line.
            </Text>
          )}
          <Text style={[styles.cardHint, { color: theme.textSecondary }]}>
            7-day moving average of daily Fard score.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function LegendItem({ color, label, theme }: { color: string; label: string; theme: Record<string, string> }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 16, paddingBottom: 96 },
  banner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  bannerLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '600' },
  bannerValue: { fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  bannerHint: { fontSize: 12, marginTop: 4 },
  streakBadge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakBadgeValue: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  streakBadgeLabel: { fontSize: 9, fontWeight: '500' },
  section: { gap: 8 },
  sectionLabel: { fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: '600' },
  card: { padding: 14, borderRadius: 20, borderCurve: 'continuous', gap: 8 },
  cardBody: { fontSize: 14, lineHeight: 18 },
  cardHint: { fontSize: 12, marginTop: 4 },
  heatmapGrid: { flexDirection: 'row', gap: HEATMAP_GAP },
  heatmapCol: { flexDirection: 'column', gap: HEATMAP_GAP },
  heatmapCell: {
    width: HEATMAP_CELL,
    height: HEATMAP_CELL,
    borderRadius: 2,
    borderCurve: 'continuous',
  },
  heatmapLegend: { flexDirection: 'row', gap: 16, marginTop: 12, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 3, borderCurve: 'continuous' },
  legendLabel: { fontSize: 11 },
  pieRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  dot: { width: 10, height: 10, borderRadius: 999, borderCurve: 'continuous' },
  pieLabel: { fontSize: 14, fontWeight: '500', width: 80 },
  pieValue: { fontSize: 14, fontWeight: '600', width: 40, textAlign: 'right' },
  pieBarTrack: { flex: 1, height: 8, borderRadius: 4, borderCurve: 'continuous', overflow: 'hidden' },
  pieBarFill: { height: '100%', borderRadius: 4, borderCurve: 'continuous' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  barName: { width: 64, fontSize: 13, fontWeight: '600' },
  barTrack: { flex: 1, height: 10, borderRadius: 6, borderCurve: 'continuous', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6, borderCurve: 'continuous' },
  barPct: { fontSize: 12, fontWeight: '600', width: 36, textAlign: 'right' },
  trendChart: { gap: 4 },
  trendRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 1, height: 84 },
  trendBar: { flex: 1, borderRadius: 1, borderCurve: 'continuous', minHeight: 2 },
  trendLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  trendLabel: { fontSize: 10 },
});
