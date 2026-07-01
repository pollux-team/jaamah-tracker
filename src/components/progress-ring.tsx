import React from 'react';
import { View, Text, useColorScheme } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors } from '@/constants/theme';

interface ProgressRingProps {
  progress: number; // 0 = empty, 1 = full
  size: number;
  strokeWidth: number;
  label: string;
  sublabel: string;
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const startRad = ((startAngle - 90) * Math.PI) / 180;
  const endRad = ((endAngle - 90) * Math.PI) / 180;

  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);

  const sweep = endAngle - startAngle;
  const largeArc = sweep > 180 ? 1 : 0;

  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

function pointOnArc(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

export default function ProgressRing({
  progress,
  size,
  strokeWidth,
  label,
  sublabel,
}: ProgressRingProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];

  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;

  const arcDeg = 240;
  const startDeg = 150;
  const endDeg = startDeg + arcDeg; // 390

  const clampedProgress = Math.max(0, Math.min(1, progress));
  const currentDeg = startDeg + arcDeg * clampedProgress;

  const trackD = describeArc(cx, cy, r, startDeg, endDeg);
  const progressD = clampedProgress > 0 ? describeArc(cx, cy, r, startDeg, Math.min(currentDeg, endDeg)) : '';

  // Small dots at the start and end of the arc
  const startDot = pointOnArc(cx, cy, r, startDeg);
  const endDot = pointOnArc(cx, cy, r, endDeg);
  const dotR = strokeWidth * 0.4;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {/* Track */}
        <Path
          d={trackD}
          fill="none"
          stroke={theme.backgroundSelected}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Progress */}
        {clampedProgress > 0 && (
          <Path
            d={progressD}
            fill="none"
            stroke={theme.primary}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}
        {/* End caps */}
        <Circle cx={startDot.x} cy={startDot.y} r={dotR} fill={theme.backgroundSelected} />
        {clampedProgress >= 1 && (
          <Circle cx={endDot.x} cy={endDot.y} r={dotR} fill={theme.primary} />
        )}
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>{label}</Text>
        <Text style={{ fontSize: 11, fontWeight: '500', color: theme.textSecondary, marginTop: 1 }}>
          {sublabel}
        </Text>
      </View>
    </View>
  );
}
