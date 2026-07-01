import React, { useState, useCallback, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  Platform,
} from 'react-native';
import Animated, { SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useDatabase, settings } from '@/database/sqlite';
import { Colors } from '@/constants/theme';
import { requestLocation } from '@/utils/location';
import { CALCULATION_METHODS, ASR_METHODS } from '@/utils/prayer-times';
import type { CalculationMethodKey, AsrMethod } from '@/utils/prayer-times';
import Icon from '@/components/icon';

interface OnboardingProps {
  onComplete: () => void;
}

type Gender = 'male' | 'female' | null;

const ALL_STEPS = ['welcome', 'gender', 'location', 'method', 'prohibited'] as const;
type Step = (typeof ALL_STEPS)[number];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { db } = useDatabase();
  const insets = useSafeAreaInsets();
  const theme = Colors[isDark ? 'dark' : 'light'];

  const [step, setStep] = useState<Step>('welcome');
  const [gender, setGender] = useState<Gender>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'saved' | 'error'>('idle');
  const [calcMethod, setCalcMethod] = useState<CalculationMethodKey>('MWL');
  const [asrMethod, setAsrMethod] = useState<AsrMethod>('Standard');

  const steps = useMemo(() => {
    if (gender === 'male') {
      return ALL_STEPS.filter(s => s !== 'prohibited') as readonly Step[];
    }
    return ALL_STEPS;
  }, [gender]);

  const stepIndex = steps.indexOf(step);
  const totalSteps = steps.length;
  const progressPct = ((stepIndex + 1) / totalSteps) * 100;

  const goNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const idx = steps.indexOf(step);
    if (idx < steps.length - 1) setStep(steps[idx + 1]);
  }, [step, steps]);

  const goBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const idx = steps.indexOf(step);
    if (idx > 0) setStep(steps[idx - 1]);
  }, [step, steps]);

  const handleLocate = useCallback(async () => {
    setLocationStatus('loading');
    try {
      const coords = await requestLocation();
      await settings.set(db, 'location', coords);
      setLocationStatus('saved');
    } catch {
      setLocationStatus('error');
    }
  }, [db]);

  const handleFinish = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await settings.set(db, 'gender', gender ?? 'male');
    await settings.set(db, 'calcMethod', calcMethod);
    await settings.set(db, 'asrMethod', asrMethod);
    await settings.set(db, 'onboardingDone', true);
    onComplete();
  }, [db, gender, calcMethod, asrMethod, onComplete]);

  const isLastStep = stepIndex === steps.length - 1;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Top safe area + progress bar (sits BELOW the notch) */}
      <View style={[styles.topSafe, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <View style={[styles.progressTrack, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.progressBarWrap}>
            <View style={[styles.progressBar, { flex: progressPct, backgroundColor: theme.primary }]} />
            <View style={{ flex: 100 - progressPct }} />
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: insets.bottom + 140 },
        ]}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}>

        {step === 'welcome' && (
          <Animated.View
            key="welcome"
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(200)}
            style={styles.step}>
            <View style={styles.iconWrap}>
              <Icon name="moon.stars.fill" fallback="nightlight-round" tint={theme.primary} size={56} />
            </View>
            <Text style={[styles.heading, { color: theme.text }]}>Jamā&apos;ah Journal</Text>
            <Text style={[styles.subheading, { color: theme.textSecondary }]}>
              Your private spiritual companion
            </Text>

            <View style={[styles.privacyCard, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              <Icon name="lock.shield" fallback="shield" tint={theme.success} size={22} />
              <Text style={[styles.privacyText, { color: theme.textSecondary }]}>
                Your data never leaves this device.{'\n'}100% offline. 100% yours.
              </Text>
            </View>

            <Text style={[styles.body, { color: theme.textSecondary }]}>
              Track your daily prayers, build consistent habits, and view your progress over time — all without any internet connection or accounts.
            </Text>
          </Animated.View>
        )}

        {step === 'gender' && (
          <Animated.View
            key="gender"
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(200)}
            style={styles.step}>
            <View style={styles.iconWrap}>
              <Icon name="person.fill" fallback="person" tint={theme.primary} size={40} />
            </View>
            <Text style={[styles.heading, { color: theme.text }]}>Who are you?</Text>
            <Text style={[styles.subheading, { color: theme.textSecondary }]}>
              Select your gender to personalize your experience
            </Text>

            <View style={styles.optionsWrap}>
              <Pressable
                onPress={() => { setGender('male'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
                style={({ pressed }) => [
                  styles.selectCard,
                  {
                    backgroundColor: gender === 'male' ? theme.selectedHighlight : theme.backgroundElement,
                    borderColor: gender === 'male' ? theme.primary : theme.backgroundSelected,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}>
                <Icon name="figure.stand" fallback="accessibility" tint={gender === 'male' ? theme.primary : theme.textSecondary} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: gender === 'male' ? theme.primary : theme.text }]}>Male</Text>
                  <Text style={[styles.cardDesc, { color: theme.textSecondary }]}>
                    Standard tracking for all five daily prayers
                  </Text>
                </View>
                {gender === 'male' && <Icon name="checkmark.circle.fill" fallback="check-circle" tint={theme.primary} size={22} />}
              </Pressable>

              <Pressable
                onPress={() => { setGender('female'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
                style={({ pressed }) => [
                  styles.selectCard,
                  {
                    backgroundColor: gender === 'female' ? theme.selectedHighlight : theme.backgroundElement,
                    borderColor: gender === 'female' ? theme.female : theme.backgroundSelected,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}>
                <Icon name="figure.wave" fallback="person" tint={gender === 'female' ? theme.female : theme.textSecondary} size={32} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: gender === 'female' ? theme.female : theme.text }]}>Female</Text>
                  <Text style={[styles.cardDesc, { color: theme.textSecondary }]}>
                    Includes prohibited days mode to safely pause streaks
                  </Text>
                </View>
                {gender === 'female' && <Icon name="checkmark.circle.fill" fallback="check-circle" tint={theme.female} size={22} />}
              </Pressable>
            </View>
          </Animated.View>
        )}

        {step === 'location' && (
          <Animated.View
            key="location"
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(200)}
            style={styles.step}>
            <View style={styles.iconWrap}>
              <Icon name="location.fill" fallback="place" tint={theme.primary} size={40} />
            </View>
            <Text style={[styles.heading, { color: theme.text }]}>Where are you?</Text>
            <Text style={[styles.subheading, { color: theme.textSecondary }]}>
              We need your coordinates once to calculate accurate prayer times
            </Text>

            <Pressable
              onPress={handleLocate}
              disabled={locationStatus === 'loading'}
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: locationStatus === 'saved' ? theme.success : theme.primary,
                  opacity: locationStatus === 'loading' ? 0.7 : pressed ? 0.9 : 1,
                },
              ]}>
              <Icon
                name={locationStatus === 'saved' ? 'checkmark.circle.fill' : 'location.fill'}
                fallback={locationStatus === 'saved' ? 'check-circle' : 'my-location'}
                tint="#fff"
                size={20}
              />
              <Text style={styles.primaryButtonText}>
                {locationStatus === 'loading' ? 'Locating...' :
                 locationStatus === 'saved' ? 'Location Saved' :
                 locationStatus === 'error' ? 'Try Again' : 'Locate Me'}
              </Text>
            </Pressable>

            <View style={[styles.infoBox, { backgroundColor: theme.backgroundElement }]}>
              <Icon name="info.circle" fallback="info" tint={theme.textSecondary} size={16} />
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                Your GPS coordinates are stored locally and never sent anywhere.
              </Text>
            </View>
          </Animated.View>
        )}

        {step === 'method' && (
          <Animated.View
            key="method"
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(200)}
            style={styles.step}>
            <View style={styles.iconWrap}>
              <Icon name="gearshape.fill" fallback="settings" tint={theme.primary} size={40} />
            </View>
            <Text style={[styles.heading, { color: theme.text }]}>Calculation Method</Text>
            <Text style={[styles.subheading, { color: theme.textSecondary }]}>
              Choose how prayer times are calculated for your region
            </Text>

            <Text style={[styles.subLabel, { color: theme.textSecondary, marginTop: 16 }]}>Prayer Time Method</Text>
            <View style={styles.optionsWrap}>
              {CALCULATION_METHODS.map(m => (
                <Pressable
                  key={m.value}
                  onPress={() => { setCalcMethod(m.value); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  style={({ pressed }) => [
                    styles.methodRow,
                    {
                      backgroundColor: calcMethod === m.value ? theme.selectedHighlight : theme.backgroundElement,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}>
                  <Text style={[styles.methodLabel, { color: calcMethod === m.value ? theme.primary : theme.text }]}>
                    {m.label}
                  </Text>
                  {calcMethod === m.value && <Icon name="checkmark.circle.fill" fallback="check-circle" tint={theme.primary} size={18} />}
                </Pressable>
              ))}
            </View>

            <Text style={[styles.subLabel, { color: theme.textSecondary, marginTop: 16 }]}>Asr Calculation</Text>
            <View style={styles.optionsWrap}>
              {ASR_METHODS.map(a => (
                <Pressable
                  key={a.value}
                  onPress={() => { setAsrMethod(a.value); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  style={({ pressed }) => [
                    styles.methodRow,
                    {
                      backgroundColor: asrMethod === a.value ? theme.selectedHighlight : theme.backgroundElement,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}>
                  <Text style={[styles.methodLabel, { color: asrMethod === a.value ? theme.primary : theme.text }]}>
                    {a.label}
                  </Text>
                  {asrMethod === a.value && <Icon name="checkmark.circle.fill" fallback="check-circle" tint={theme.primary} size={18} />}
                </Pressable>
              ))}
            </View>
          </Animated.View>
        )}

        {step === 'prohibited' && gender === 'female' && (
          <Animated.View
            key="prohibited"
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(200)}
            style={styles.step}>
            <View style={styles.iconWrap}>
              <Icon name="moon.stars.fill" fallback="nightlight-round" tint={theme.prohibited} size={40} />
            </View>
            <Text style={[styles.heading, { color: theme.text }]}>Prohibited Days</Text>
            <Text style={[styles.subheading, { color: theme.textSecondary }]}>
              A built-in mode designed for your natural cycle
            </Text>

            <View style={[styles.infoCard, { backgroundColor: theme.backgroundElement, borderColor: theme.prohibited }]}>
              <View style={styles.infoRow}>
                <Icon name="moon.fill" fallback="brightness-3" tint={theme.prohibited} size={18} />
                <Text style={[styles.infoTitle, { color: theme.text }]}>What it does</Text>
              </View>
              <Text style={[styles.infoBody, { color: theme.textSecondary }]}>
                When enabled, your Fard and Sunnah prayers are paused. The streak is frozen — neither increases nor resets. Adhkar tracking stays active.
              </Text>
            </View>

            <View style={[styles.infoCard, { backgroundColor: theme.backgroundElement, borderColor: theme.prohibited }]}>
              <View style={styles.infoRow}>
                <Icon name="chart.bar.fill" fallback="bar-chart" tint={theme.prohibited} size={18} />
                <Text style={[styles.infoTitle, { color: theme.text }]}>Stats stay fair</Text>
              </View>
              <Text style={[styles.infoBody, { color: theme.textSecondary }]}>
                If you use Prohibited Days for 6 days in a 30-day month, your charts only count 24 days. Your statistics perfectly reflect your actual required days without penalty.
              </Text>
            </View>

            <View style={[styles.infoCard, { backgroundColor: theme.backgroundElement, borderColor: theme.prohibited }]}>
              <View style={styles.infoRow}>
                <Icon name="hand.raised.fill" fallback="pan-tool" tint={theme.prohibited} size={18} />
                <Text style={[styles.infoTitle, { color: theme.text }]}>You stay in control</Text>
              </View>
              <Text style={[styles.infoBody, { color: theme.textSecondary }]}>
                Toggle it on or off anytime from the Today screen. No data is ever lost — you can log past days even when the mode was active.
              </Text>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Bottom toolbar — absolute, floated above the tab bar */}
      <View style={[
        styles.bottomBar,
        {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: insets.bottom + 68,
          backgroundColor: theme.background,
          borderTopColor: theme.backgroundSelected,
          paddingBottom: 32,
        },
      ]}>
        {stepIndex > 0 ? (
          <Pressable
            onPress={goBack}
            hitSlop={12}
            style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.6 : 1 }]}>
            <Icon name="chevron.left" fallback="chevron-left" tint={theme.textSecondary} size={18} />
            <Text style={[styles.backButtonText, { color: theme.textSecondary }]}>Back</Text>
          </Pressable>
        ) : (
          <View style={styles.backButtonPlaceholder} />
        )}

        <Pressable
          onPress={isLastStep ? handleFinish : goNext}
          style={({ pressed }) => [
            styles.nextButton,
            {
              backgroundColor: isLastStep ? theme.success : theme.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}>
          <Text style={styles.nextButtonText}>
            {isLastStep ? 'Start Tracking' : 'Continue'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topSafe: {
    width: '100%',
  },
  progressTrack: {
    height: 3,
    width: '100%',
  },
  progressBarWrap: { flexDirection: 'row', height: 3 },
  progressBar: { height: 3, borderRadius: 2 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 24 },
  step: { gap: 4 },
  iconWrap: { alignItems: 'center', marginBottom: 16, marginTop: 8 },
  heading: { fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  subheading: { fontSize: 15, textAlign: 'center', lineHeight: 20, marginTop: 6, marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 20,
  },
  privacyText: { fontSize: 13, lineHeight: 18, flex: 1 },
  optionsWrap: { gap: 10, marginTop: 12 },
  selectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1.5,
  },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardDesc: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    borderCurve: 'continuous',
    marginTop: 20,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderCurve: 'continuous',
    marginTop: 16,
  },
  infoText: { fontSize: 13, lineHeight: 18, flex: 1 },
  infoCard: {
    padding: 16,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    marginTop: 12,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  infoTitle: { fontSize: 15, fontWeight: '700' },
  infoBody: { fontSize: 13, lineHeight: 19 },
  subLabel: { fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: '600' },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  methodLabel: { fontSize: 14, fontWeight: '500', flex: 1 },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: -2 } },
      android: { elevation: 4 },
    }),
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 14,
    paddingRight: 20,
    minWidth: 90,
  },
  backButtonPlaceholder: { minWidth: 90 },
  backButtonText: { fontSize: 15, fontWeight: '600', marginLeft: 2 },
  nextButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    borderCurve: 'continuous',
    minWidth: 140,
    alignItems: 'center',
  },
  nextButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
