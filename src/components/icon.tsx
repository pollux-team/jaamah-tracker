import React from 'react';
import { Platform } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { MaterialCommunityIcons, Ionicons, MaterialIcons } from '@expo/vector-icons';

type IconLibrary = 'sf-symbols' | 'material' | 'ionicon' | 'material-community';

interface IconProps {
  name: string;
  fallback: string;
  size?: number;
  tint?: string;
  library?: IconLibrary;
}

export default function Icon({
  name,
  fallback,
  size = 18,
  tint,
  library = 'material',
}: IconProps) {
  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name={name as any}
        tintColor={tint}
        size={size}
      />
    );
  }

  const IconLib =
    library === 'ionicon'
      ? Ionicons
      : library === 'material-community'
        ? MaterialCommunityIcons
        : MaterialIcons;

  const IconComp = IconLib as unknown as React.ComponentType<{
    name: string;
    size?: number;
    color?: string;
  }>;

  return <IconComp name={fallback} size={size} color={tint} />;
}
