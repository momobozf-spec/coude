import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'react-native-linear-gradient';
import { usePrayerTimes } from '../hooks/usePrayerTimes';
import { PrayerCard } from '../components/PrayerCard';
import { CountdownHero } from '../components/CountdownHero';
import { DateHeader } from '../components/DateHeader';
import { Colors, Spacing, Radius } from '../theme';
import { PRAYER_META } from '../constants/prayers';
import { formatTime } from '../utils/prayerTimes';

const { width } = Dimensions.get('window');

interface Props {
  navigation: any;
}

export function HomeScreen({ navigation }: Props) {
  const store = usePrayerTimes();

  useEffect(() => {
    store.requestLocation();
  }, []);

  if (store.status === 'idle' || store.status === 'loading') {
    return (
      <LinearGradient colors={[Colors.midnight, Colors.navy, Colors.deep]} style={styles.fill}>
        <SafeAreaView style={styles.center}>
          <ActivityIndicator size="large" color={Colors.gold} />
          <Text style={styles.loadingText}>Locatie bepalen…</Text>
          <Text style={styles.loadingSubText}>Even geduld voor nauwkeurige gebedstijden</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (store.status === 'error') {
    return (
      <LinearGradient colors={[Colors.midnight, Colors.navy, Colors.deep]} style={styles.fill}>
        <SafeAreaView style={styles.center}>
          <Text style={{ fontSize: 56 }}>📍</Text>
          <Text style={styles.errorTitle}>Locatie fout</Text>
          <Text style={styles.errorText}>{store.error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={store.requestLocation}>
            <Text style={styles.retryBtnText}>Opnieuw proberen</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const { prayerTimes, nextPrayer, currentPrayer, countdown, cityName, use24h } = store;
  if (!prayerTimes || !nextPrayer) return null;

  const nextMeta = PRAYER_META.find(p => p.key === nextPrayer.key) || PRAYER_META[0];

  return (
    <LinearGradient
      colors={[Colors.midnight, Colors.navy, '#112244']}
      style={styles.fill}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.fill} edges={['top']}>
        {/* Top Bar */}
        <View style={styles.topbar}>
          <Text style={styles.logo}>🕌 صلاة</Text>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.settingsBtnText}>⚙️  Instellingen</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Date */}
          <DateHeader cityName={cityName} />

          {/* Hero countdown */}
          <CountdownHero
            prayerMeta={nextMeta}
            countdown={countdown}
            time={formatTime(nextPrayer.time, use24h)}
            isTomorrow={nextPrayer.isTomorrow}
          />

          {/* Prayer list */}
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderText}>VANDAAG</Text>
            <View style={styles.listHeaderLine} />
          </View>

          {PRAYER_META.map(meta => {
            const time = prayerTimes[meta.key];
            const isNext    = meta.key === nextPrayer.key;
            const isPassed  = !isNext && time < new Date();
            return (
              <PrayerCard
                key={meta.key}
                meta={meta}
                time={formatTime(time, use24h)}
                isNext={isNext}
                isPassed={isPassed}
                isCurrent={meta.key === currentPrayer}
              />
            );
          })}

          {/* Bismillah footer */}
          <Text style={styles.bismillah}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</Text>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill:            { flex: 1 },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  scroll:          { paddingHorizontal: Spacing.md, paddingBottom: 40 },

  topbar:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                     paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  logo:            { fontSize: 22, color: Colors.gold, fontWeight: '700' },
  settingsBtn:     { borderColor: Colors.cardBorder, borderWidth: 1, borderRadius: Radius.full,
                     paddingHorizontal: 14, paddingVertical: 6 },
  settingsBtnText: { fontSize: 12, color: Colors.textDim, letterSpacing: 1 },

  loadingText:     { color: Colors.goldLight, fontSize: 18, marginTop: 20, fontWeight: '600' },
  loadingSubText:  { color: Colors.textDim, fontSize: 13, marginTop: 8, textAlign: 'center' },

  errorTitle:      { color: Colors.goldLight, fontSize: 22, fontWeight: '700', marginTop: 16 },
  errorText:       { color: Colors.textDim, fontSize: 14, marginTop: 10, textAlign: 'center', lineHeight: 22 },
  retryBtn:        { marginTop: 28, backgroundColor: Colors.gold, borderRadius: Radius.md,
                     paddingHorizontal: 32, paddingVertical: 14 },
  retryBtnText:    { color: Colors.midnight, fontSize: 15, fontWeight: '700', letterSpacing: 1 },

  listHeader:      { flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 12 },
  listHeaderText:  { color: Colors.textDim, fontSize: 11, letterSpacing: 3 },
  listHeaderLine:  { flex: 1, height: 1, backgroundColor: Colors.cardBorder, marginLeft: 12 },

  bismillah:       { textAlign: 'center', fontSize: 22, color: Colors.goldDim, marginTop: 32,
                     fontFamily: 'System' },
});
