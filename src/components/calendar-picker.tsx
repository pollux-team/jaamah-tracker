import React, { useState, useCallback } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  subMonths,
  addMonths,
  isSameMonth,
  isSameDay,
  isAfter,
  startOfDay,
} from 'date-fns';
import * as Haptics from 'expo-haptics';

import { Colors } from '@/constants/theme';
import Icon from '@/components/icon';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface CalendarPickerProps {
  visible: boolean;
  selectedDate: Date;
  onClose: () => void;
  onConfirm: (date: Date) => void;
}

export default function CalendarPicker({
  visible,
  selectedDate,
  onClose,
  onConfirm,
}: CalendarPickerProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];

  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selectedDate));
  const [picked, setPicked] = useState(selectedDate);

  const today = startOfDay(new Date());
  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days: Date[] = [];
  let cursor = calendarStart;
  while (cursor <= calendarEnd) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  const handlePrev = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setViewMonth(m => subMonths(m, 1));
  }, []);

  const handleNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setViewMonth(m => addMonths(m, 1));
  }, []);

  const handlePick = useCallback(
    (day: Date) => {
      if (isAfter(day, today)) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPicked(day);
    },
    [today]
  );

  const handleConfirm = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm(picked);
  }, [picked, onConfirm]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.handleBar} />

        <Text style={[styles.title, { color: theme.text }]}>Jump to Date</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Log Qadha for any past date
        </Text>

        <View style={styles.monthRow}>
          <Pressable
            onPress={handlePrev}
            hitSlop={12}
            style={({ pressed }) => [
              styles.navBtn,
              { backgroundColor: theme.backgroundSelected },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Icon name="chevron.left" fallback="chevron-left" tint={theme.primary} size={14} />
          </Pressable>

          <View style={styles.monthGroup}>
            <Text style={[styles.monthLabel, { color: theme.text }]}>
              {format(viewMonth, 'MMMM')}
            </Text>
            <Text style={[styles.yearLabel, { color: theme.textSecondary }]}>
              {format(viewMonth, 'yyyy')}
            </Text>
          </View>

          <Pressable
            onPress={handleNext}
            hitSlop={12}
            disabled={isSameMonth(viewMonth, today)}
            style={({ pressed }) => [
              styles.navBtn,
              { backgroundColor: theme.backgroundSelected },
              pressed && { opacity: 0.6 },
              isSameMonth(viewMonth, today) && { opacity: 0.3 },
            ]}
          >
            <Icon name="chevron.right" fallback="chevron-right" tint={theme.primary} size={14} />
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((d, i) => (
            <Text
              key={i}
              style={[
                styles.weekdayLabel,
                { color: theme.textSecondary },
                i === 0 && { color: theme.danger },
                i === 6 && { color: theme.primary },
              ]}
            >
              {d}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {days.map((day, i) => {
            const inMonth = isSameMonth(day, viewMonth);
            const isSelected = isSameDay(day, picked);
            const isFuture = isAfter(day, today);
            const isTodayCell = isSameDay(day, today);
            const dayOfWeek = day.getDay();
            const dimmed = !inMonth || isFuture;

            return (
              <Pressable
                key={i}
                onPress={() => handlePick(day)}
                disabled={dimmed}
                style={({ pressed }) => [
                  styles.dayCell,
                  isSelected && { backgroundColor: theme.primary },
                  isTodayCell && !isSelected && {
                    borderWidth: 1.5,
                    borderColor: theme.primary,
                  },
                  pressed && !dimmed && { opacity: 0.5 },
                ]}
              >
                <Text
                  style={[
                    styles.dayLabel,
                    {
                      color: isSelected
                        ? '#fff'
                        : dimmed
                          ? theme.backgroundSelected
                          : dayOfWeek === 0
                            ? theme.danger
                            : dayOfWeek === 6
                              ? theme.primary
                              : theme.text,
                    },
                  ]}
                >
                  {format(day, 'd')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.preview, { backgroundColor: theme.selectedHighlight }]}>
          <Icon name="calendar.badge.clock" fallback="event" tint={theme.primary} size={16} />
          <Text style={[styles.previewText, { color: theme.text }]}>
            {format(picked, 'EEEE, MMMM d, yyyy')}
          </Text>
        </View>

        <View style={styles.footer}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancelBtn,
              { backgroundColor: theme.backgroundSelected },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text style={[styles.cancelBtnLabel, { color: theme.textSecondary }]}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            onPress={handleConfirm}
            style={({ pressed }) => [
              styles.confirmBtn,
              { backgroundColor: theme.primary },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Icon name="arrow.right" fallback="arrow-forward" tint="#fff" size={14} />
            <Text style={styles.confirmBtnLabel}>Go to Date</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderCurve: 'continuous',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 36,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.3)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 16,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderCurve: 'continuous',
  },
  monthGroup: {
    alignItems: 'center',
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  yearLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingVertical: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  dayLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  previewText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmBtnLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
