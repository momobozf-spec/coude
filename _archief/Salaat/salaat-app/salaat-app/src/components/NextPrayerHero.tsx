import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useEffect,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import { PrayerKey, PRAYER_META, formatTime, formatCountdown } from '../utils/prayerTimes';

interface Props {
  nextPrayer: PrayerKey | 'fajr_tomorrow';
  nextPrayerTime: Date;
  prevPrayerTime: Date;
  countdown: number;
  use24h: boolean;
}

function ProgressArc({ progress }: { progress: number }) {
  const R = 54;
  const CX = 64;
  const CY = 64;
  const circumference = 2 * Math.PI * R;

  const startAngle = -90;
  const endAngle = startAngle + Math.max(0.01, progress) * 360;
  const rad = (a: number) => (a * Math.PI) / 180;
  const x1 = CX + R * Math.cos(rad(startAngle));
  const y1 = CY + R * Math.sin(rad(startAngle));
  const x2 = CX + R * Math.cos(rad(endAngle));
  const y2 = CY + R * Math.sin(rad(endAngle));
  const large = progress > 0.5 ? 1 : 0;
  const arcD = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`;

  return (
    <Svg width={128} height={68} viewBox="0 0 128 128" style={{ marginBottom: -60 }}>
      <Circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(201,168,76,0.1)" strokeWidth={3} />
      <Path
        d={arcD}
        fill="none"
        stroke={Colors.gold}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function NextPrayerHero({ nextPrayer, nextPrayerTime, prevPrayerTime, countdown, use24h }: Props) {
  const prayerKey: PrayerKey = nextPrayer === 'fajr_tomorrow' ? 'fajr' : nextPrayer;
  const meta = PRAYER_META[prayerKey];

  const scale = useSharedValue(0.95);
  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 100 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const totalMs = nextPrayerTime.getTime() - prevPrayerTime.getTime();
  const elapsed = Date.now() - prevPrayerTime.getTime();
  const progress = Math.max(0, Math.min(1, 1 - elapsed / totalMs));

  return (
    <Animated.View style={[styles.wrapper, animStyle]}>
      <LinearGradient
        colors={['rgba(26,53,96,0.9)', 'rgba(15,32,64,0.95)']}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Top highlight line */}
        <View style={styles.topLine} />

        <Text style={styles.label}>Volgend gebed</Text>

        <Text style={styles.prayerName}>{meta.name}</Text>
        <Text style={styles.prayerArabic}>{meta.arabic}</Text>
        <Text style={styles.prayerIcon}>{meta.icon}</Text>

        <View style={styles.arcContainer}>
          <ProgressArc progress={progress} />
        </View>

        <Text style={styles.countdown}>{formatCountdown(countdown)}</Text>
        <Text style={styles.subtext}>om {formatTime(nextPrayerTime, use24h)}</Text>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
  },
  container: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  topLine: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 1,
    backgroundColor: Colors.gold,
    opacity: 0.6,
  },
  label: {
    fontFamily: Typography.lato,
    fontSize: 10,
    color: Colors.textDim,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  prayerName: {
    fontFamily: Typography.playfairBold,
    fontSize: 34,
    color: Colors.goldLight,
    marginBottom: 2,
  },
  prayerArabic: {
    fontFamily: Typography.scheherazade,
    fontSize: 20,
    color: Colors.gold,
    opacity: 0.85,
    marginBottom: 4,
  },
  prayerIcon: {
    fontSize: 28,
    marginBottom: Spacing.sm,
  },
  arcContainer: {
    alignItems: 'center',
    marginBottom: 2,
  },
  countdown: {
    fontFamily: Typography.latoLight,
    fontSize: 44,
    color: Colors.cream,
    letterSpacing: 4,
    lineHeight: 52,
  },
  subtext: {
    fontFamily: Typography.lato,
    fontSize: 12,
    color: Colors.textDim,
    letterSpacing: 2,
    marginTop: Spacing.xs,
  },
});
