'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

import { useDatabase, settings } from '@/database/sqlite';
import { Colors } from '@/constants/theme';
import { requestLocation, type Coordinates } from '@/utils/location';
import { CALCULATION_METHODS, ASR_METHODS } from '@/utils/prayer-times';
import type { CalculationMethodKey, AsrMethod } from '@/utils/prayer-times';
import Icon from '@/components/icon';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { db } = useDatabase();
  const theme = useMemo(() => Colors[isDark ? 'dark' : 'light'], [isDark]);

  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [locationStatus, setLocationStatus] = useState<string>('');
  const [calcMethod, setCalcMethod] = useState<CalculationMethodKey>('MWL');
  const [asrMethod, setAsrMethod] = useState<AsrMethod>('Standard');
  const [exportStatus, setExportStatus] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const g = await settings.get<'male' | 'female'>(db, 'gender', 'male');
        setGender(g);
        const m = await settings.get<CalculationMethodKey>(db, 'calcMethod', 'MWL');
        setCalcMethod(m);
        const a = await settings.get<AsrMethod>(db, 'asrMethod', 'Standard');
        setAsrMethod(a);
        const loc = await settings.get<Coordinates | null>(db, 'location', null);
        if (loc) setLocationStatus('Set');
      } catch {}
    };
    load();
  }, [db]);

  const handleLocateMe = useCallback(async () => {
    setLocationStatus('Locating...');
    try {
      const coords = await requestLocation();
      await settings.set(db, 'location', coords);
      setLocationStatus('Updated');
    } catch {
      setLocationStatus('Error');
    }
  }, [db]);

  const handleExport = useCallback(async () => {
    try {
      setExportStatus('Exporting...');
      const allPrayers = await db.getAllAsync('SELECT * FROM prayers');
      const allHabits = await db.getAllAsync('SELECT * FROM habits');
      const allSettings = await db.getAllAsync('SELECT * FROM settings');

      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        prayers: allPrayers,
        habits: allHabits,
        settings: allSettings,
      };

      const json = JSON.stringify(payload, null, 2);
      const file = new File(Paths.document, 'jamah-backup.json');
      await file.write(json);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: "Export Jamā'ah Journal Backup",
        });
      }
      setExportStatus('Exported');
    } catch {
      setExportStatus('Error');
    }
  }, [db]);

  const handleImport = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = new File(result.assets[0].uri);
      const content = await file.text();
      const data = JSON.parse(content);

      if (!data.version || !data.prayers || !data.habits) {
        Alert.alert('Invalid File', 'This does not appear to be a valid Jamā\'ah Journal backup.');
        return;
      }

      Alert.alert(
        'Import Data',
        'This will merge the backup data with your existing data. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            onPress: async () => {
              await db.withTransactionAsync(async () => {
                for (const row of data.prayers) {
                  await db.runAsync(
                    `INSERT INTO prayers (name, status, date) VALUES (?, ?, ?)
                     ON CONFLICT(name, date) DO UPDATE SET status = excluded.status`,
                    [row.name, row.status, row.date]
                  );
                }
                for (const row of data.habits) {
                  await db.runAsync(
                    `INSERT INTO habits (key, completed, date) VALUES (?, ?, ?)
                     ON CONFLICT(key, date) DO UPDATE SET completed = excluded.completed`,
                    [row.key, row.completed, row.date]
                  );
                }
                if (data.settings) {
                  for (const row of data.settings) {
                    await db.runAsync(
                      `INSERT INTO settings (key, value) VALUES (?, ?)
                       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
                      [row.key, row.value]
                    );
                  }
                }
              });
              Alert.alert('Success', 'Data imported successfully.');
            },
          },
        ]
      );
    } catch {
      Alert.alert('Error', 'Failed to import data.');
    }
  }, [db]);

  const handleChangeGender = useCallback(async (next: 'male' | 'female') => {
    setGender(next);
    await settings.set(db, 'gender', next);
    if (next === 'male') {
      await settings.set(db, 'excusedMode', false);
    }
  }, [db]);

  const handleChangeCalcMethod = useCallback(async (m: CalculationMethodKey) => {
    setCalcMethod(m);
    await settings.set(db, 'calcMethod', m);
  }, [db]);

  const handleChangeAsrMethod = useCallback(async (a: AsrMethod) => {
    setAsrMethod(a);
    await settings.set(db, 'asrMethod', a);
  }, [db]);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Data</Text>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <Pressable
            onPress={handleExport}
            style={({ pressed }) => [styles.dataRow, { opacity: pressed ? 0.7 : 1 }]}>
            <Icon name="square.and.arrow.up" fallback="file-upload" tint={theme.primary} size={20} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: theme.text }]}>Export Data</Text>
              <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>
                Save backup to your device
              </Text>
            </View>
            {exportStatus ? (
              <Text style={[styles.statusBadge, { color: theme.success }]}>{exportStatus}</Text>
            ) : null}
          </Pressable>

          <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />

          <Pressable
            onPress={handleImport}
            style={({ pressed }) => [styles.dataRow, { opacity: pressed ? 0.7 : 1 }]}>
            <Icon name="square.and.arrow.down" fallback="file-download" tint={theme.warning} size={20} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: theme.text }]}>Import Data</Text>
              <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>
                Restore from a backup file
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Profile</Text>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <Text style={[styles.subLabel, { color: theme.textSecondary }]}>Gender</Text>
          <View style={styles.genderRow}>
            <Pressable
              onPress={() => handleChangeGender('male')}
              style={[styles.genderBtn, { backgroundColor: gender === 'male' ? theme.primary : theme.backgroundSelected }]}>
              <Text style={[styles.genderLabel, { color: gender === 'male' ? '#fff' : theme.text }]}>Male</Text>
            </Pressable>
            <Pressable
              onPress={() => handleChangeGender('female')}
              style={[styles.genderBtn, { backgroundColor: gender === 'female' ? theme.female : theme.backgroundSelected }]}>
              <Text style={[styles.genderLabel, { color: gender === 'female' ? '#fff' : theme.text }]}>Female</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={handleLocateMe}
            style={({ pressed }) => [styles.locateBtn, { backgroundColor: theme.backgroundSelected, opacity: pressed ? 0.8 : 1 }]}>
            <Icon name="location" fallback="place" tint={theme.primary} size={16} />
            <Text style={[styles.locateLabel, { color: theme.text }]}>
              {locationStatus || 'Update Location'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Calculation</Text>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <Text style={[styles.subLabel, { color: theme.textSecondary }]}>Prayer Time Method</Text>
          {CALCULATION_METHODS.map(m => (
            <Pressable
              key={m.value}
              onPress={() => handleChangeCalcMethod(m.value)}
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

          <Text style={[styles.subLabel, { color: theme.textSecondary, marginTop: 12 }]}>Asr Calculation</Text>
          {ASR_METHODS.map(a => (
            <Pressable
              key={a.value}
              onPress={() => handleChangeAsrMethod(a.value)}
              style={({ pressed }) => [
                styles.methodRow,
                {
                   backgroundColor: asrMethod === a.value ? theme.selectedHighlight : 'transparent',
                  opacity: pressed ? 0.8 : 1,
                },
              ]}>
              <Text style={[styles.methodLabel, { color: asrMethod === a.value ? theme.primary : theme.text }]}>
                {a.label}
              </Text>
              {asrMethod === a.value && (
                <Icon name="checkmark.circle.fill" fallback="check-circle" tint={theme.primary} size={18} />


              )}
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[styles.privacyCard, { backgroundColor: theme.backgroundElement }]}>
        <Icon name="lock.shield" fallback="shield" tint={theme.textSecondary} size={20} />
        <Text style={[styles.privacyText, { color: theme.textSecondary }]}>
          Your data never leaves this device.{'\n'}100% offline. 100% yours.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 16, paddingBottom: 96 },
  section: { gap: 8 },
  sectionLabel: { fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: '600' },
  card: { borderRadius: 20, borderCurve: 'continuous', padding: 14, gap: 8 },
  settingTitle: { fontSize: 15, fontWeight: '600' },
  settingDesc: { fontSize: 12, marginTop: 1 },
  dataRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
  statusBadge: { fontSize: 12, fontWeight: '600' },
  subLabel: { fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: '600' },
  genderRow: { flexDirection: 'row', gap: 8 },
  genderBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderCurve: 'continuous', alignItems: 'center' },
  genderLabel: { fontSize: 15, fontWeight: '600' },
  locateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderCurve: 'continuous',
    marginTop: 4,
  },
  locateLabel: { fontSize: 14, fontWeight: '500' },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderCurve: 'continuous',
  },
  methodLabel: { fontSize: 14, fontWeight: '500', flex: 1 },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderCurve: 'continuous',
    marginTop: 8,
  },
  privacyText: { fontSize: 13, lineHeight: 18, flex: 1 },
});
