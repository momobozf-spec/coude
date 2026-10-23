import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';

// Kaaba coordinates
const KAABA_LAT = 21.4225;
const KAABA_LNG = 39.8262;

function getQiblaAngle(lat: number, lng: number): number {
  const phiK = (KAABA_LAT * Math.PI) / 180;
  const lambdaK = (KAABA_LNG * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const lambda = (lng * Math.PI) / 180;
  const deltaLambda = lambdaK - lambda;
  const x = Math.sin(deltaLambda);
  const y = Math.cos(phi) * Math.tan(phiK) - Math.sin(phi) * Math.cos(deltaLambda);
  const qibla = (Math.atan2(x, y) * 180) / Math.PI;
  return (qibla + 360) % 360;
}

export default function QiblaScreen() {
  const [qiblaAngle, setQiblaAngle] = useState<number | null>(null);
  const [compassHeading, setCompassHeading] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const rotation = useSharedValue(0);

  useEffect(() => {
    (async () => {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') { setStatus('error'); return; }

      const pos = await Location.getCurrentPositionAsync({});
      const angle = getQiblaAngle(pos.coords.latitude, pos.coords.longitude);
      setQiblaAngle(angle);
      setStatus('ready');

      // Watch heading
      const sub = await Location.watchHeadingAsync(heading => {
        const h = heading.magHeading;
        setCompassHeading(h);
        rotation.value = withTiming(-(h - angle), {
          duration: 300,
          easing: Easing.out(Easing.quad),
        });
      });

      return () => sub.remove();
    })();
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <LinearGradient colors={[Colors.midnight, Colors.deep, Colors.midnight]} style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Terug</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Qibla Richting</Text>
          <View style={{ width: 70 }} />
        </View>

        <View style={styles.content}>
          <Text style={styles.subtitle}>كعبة</Text>
          <Text style={styles.subtitleNl}>Richting van de Kaaba</Text>

          {status === 'loading' && (
            <View style={styles.center}>
              <Text style={styles.loadingText}>Kompas laden…</Text>
            </View>
          )}

          {status === 'error' && (
            <View style={styles.center}>
              <Text style={styles.errorText}>Locatietoegang vereist.</Text>
            </View>
          )}

          {status === 'ready' && qiblaAngle !== null && (
            <>
              {/* Compass */}
              <View style={styles.compassWrap}>
                <Animated.View style={[styles.compassInner, animStyle]}>
                  <Svg width={280} height={280} viewBox="0 0 280 280">
                    {/* Outer ring */}
                    <Circle cx={140} cy={140} r={130} fill="none" stroke="rgba(201,168,76,0.15)" strokeWidth={1.5} />
                    <Circle cx={140} cy={140} r={120} fill="rgba(15,32,64,0.8)" stroke="rgba(201,168,76,0.25)" strokeWidth={1} />

                    {/* Cardinal points */}
                    {['N', 'O', 'Z', 'W'].map((label, i) => {
                      const angle = (i * 90 * Math.PI) / 180;
                      const r = 105;
                      const x = 140 + r * Math.sin(angle);
                      const y = 140 - r * Math.cos(angle);
                      return (
                        <SvgText
                          key={label}
                          x={x} y={y + 5}
                          textAnchor="middle"
                          fill={label === 'N' ? '#e05c5c' : 'rgba(201,168,76,0.6)'}
                          fontSize={label === 'N' ? 16 : 13}
                          fontWeight="bold"
                        >
                          {label}
                        </SvgText>
                      );
                    })}

                    {/* Tick marks */}
                    {Array.from({ length: 36 }).map((_, i) => {
                      const angle = (i * 10 * Math.PI) / 180;
                      const r1 = i % 9 === 0 ? 112 : 117;
                      const r2 = 120;
                      const x1 = 140 + r1 * Math.sin(angle);
                      const y1 = 140 - r1 * Math.cos(angle);
                      const x2 = 140 + r2 * Math.sin(angle);
                      const y2 = 140 - r2 * Math.cos(angle);
                      return (
                        <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                          stroke="rgba(201,168,76,0.3)" strokeWidth={i % 9 === 0 ? 1.5 : 0.75} />
                      );
                    })}

                    {/* Qibla arrow */}
                    <Path
                      d="M140 35 L147 100 L140 110 L133 100 Z"
                      fill={Colors.gold}
                      opacity={0.95}
                    />
                    <Path
                      d="M140 245 L147 180 L140 170 L133 180 Z"
                      fill="rgba(201,168,76,0.2)"
                    />

                    {/* Kaaba icon at tip */}
                    <SvgText x={140} y={28} textAnchor="middle" fontSize={16}>🕋</SvgText>

                    {/* Center */}
                    <Circle cx={140} cy={140} r={8} fill={Colors.gold} opacity={0.8} />
                    <Circle cx={140} cy={140} r={3} fill={Colors.midnight} />
                  </Svg>
                </Animated.View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Qibla hoek</Text>
                  <Text style={styles.infoValue}>{Math.round(qiblaAngle)}°</Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Kompas</Text>
                  <Text style={styles.infoValue}>{Math.round(compassHeading)}°</Text>
                </View>
              </View>

              <Text style={styles.instruction}>
                Draai je telefoon totdat de gouden pijl recht omhoog wijst.
              </Text>
            </>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.md,
  },
  backBtn: { padding: 8 },
  backText: { fontFamily: Typography.lato, fontSize: 14, color: Colors.gold },
  title: { fontFamily: Typography.playfairBold, fontSize: 20, color: Colors.goldLight },
  content: { flex: 1, alignItems: 'center', padding: Spacing.md },
  subtitle: {
    fontFamily: Typography.scheherazadeBold,
    fontSize: 32, color: Colors.gold, marginBottom: 4,
  },
  subtitleNl: {
    fontFamily: Typography.lato,
    fontSize: 12, color: Colors.textDim, letterSpacing: 2,
    textTransform: 'uppercase', marginBottom: Spacing.xl,
  },
  compassWrap: {
    width: 280, height: 280,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl,
  },
  compassInner: { width: 280, height: 280 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontFamily: Typography.lato, fontSize: 14, color: Colors.textDim },
  errorText: { fontFamily: Typography.lato, fontSize: 14, color: Colors.error },
  infoRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  infoCard: {
    flex: 1, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder,
    borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center',
  },
  infoLabel: { fontFamily: Typography.lato, fontSize: 10, color: Colors.textDim, letterSpacing: 2, textTransform: 'uppercase' },
  infoValue: { fontFamily: Typography.playfairBold, fontSize: 28, color: Colors.goldLight, marginTop: 4 },
  instruction: {
    fontFamily: Typography.lato, fontSize: 13, color: Colors.textDim,
    textAlign: 'center', lineHeight: 20, paddingHorizontal: Spacing.lg,
  },
});
