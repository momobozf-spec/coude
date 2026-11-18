import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Keyboard, Text, TextInput, View } from 'react-native';

import { SourceBadge } from '../../components/SourceBadge';
import { Body, Button, Card, Notice, Screen, SectionTitle, Title, type IconName } from '../../components/ui';
import { analyzeText, isValidEmail, type AnalysisResult, type SignalSeverity, type Verdict } from '../../scan/heuristics';
import { useColors } from '../../theme/colors';

const VERDICT: Record<Exclude<Verdict, 'empty'>, { title: string; body: string; icon: IconName; box: string }> = {
  no_signals: {
    title: 'Geen bekende signalen gevonden',
    body: 'Dat betekent niet dat het bericht veilig is. Twijfel je? Ga dan zelf naar de officiële website of app, in plaats van op de link te tikken.',
    icon: 'checkmark-circle',
    box: 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/40 dark:border-emerald-800',
  },
  caution: {
    title: 'Wees voorzichtig',
    body: 'We zien enkele signalen die vaker bij oplichting voorkomen. Tik niet op de link en geef geen gegevens door voor je het via een andere weg hebt nagekeken.',
    icon: 'alert-circle',
    box: 'bg-sun-50 border-sun-200 dark:bg-sun-900/40 dark:border-sun-800',
  },
  suspicious: {
    title: 'Dit lijkt verdacht',
    body: 'Meerdere signalen wijzen op een mogelijke oplichtingspoging. Tik niet op de link, antwoord niet en geef geen codes of betaalgegevens door.',
    icon: 'alert-circle',
    box: 'bg-sun-50 border-sun-300 dark:bg-sun-900/40 dark:border-sun-700',
  },
};

const SEVERITY_LABEL: Record<SignalSeverity, string> = { low: 'licht signaal', medium: 'signaal', high: 'sterk signaal' };

function EmailCheck() {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [demoShown, setDemoShown] = useState(false);
  const valid = isValidEmail(email);
  const colors = useColors();

  return (
    <Card>
      <View className="flex-row items-center gap-2">
        <Ionicons name="mail-outline" size={22} color={colors.primary} />
        <Text className="text-lg font-semibold text-navy-900 dark:text-navy-50">E-mailadrescheck</Text>
      </View>
      <SourceBadge source="demo" />
      <Body muted>
        We controleren je e-mailadres alleen op de juiste vorm, op je toestel. Er wordt niets verstuurd en er gebeurt geen echte
        datalekopzoeking. We vragen nooit om je wachtwoord.
      </Body>
      <TextInput
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          setDemoShown(false);
        }}
        onBlur={() => setTouched(true)}
        placeholder="naam@voorbeeld.be"
        placeholderTextColor={colors.neutral}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        textContentType="none"
        accessibilityLabel="E-mailadres"
        className="min-h-12 rounded-xl border border-navy-200 bg-white px-4 text-base text-navy-900 dark:border-navy-700 dark:bg-navy-950 dark:text-navy-50"
      />
      {touched && email.length > 0 && !valid ? (
        <Text className="text-base text-sun-800 dark:text-sun-200">Dit lijkt geen geldig e-mailadres.</Text>
      ) : null}
      <Button
        label="Toon demo-uitkomst"
        icon="flask-outline"
        disabled={!valid}
        onPress={() => {
          Keyboard.dismiss();
          setDemoShown(true);
        }}
      />
      {demoShown ? (
        <Notice tone="demo">
          <Text className="text-base font-semibold text-sun-900 dark:text-sun-100">Demo — geen echte datalekcontrole uitgevoerd</Text>
          <Body>
            Je e-mailadres is niet verzonden en niet opgeslagen. In een latere versie zou je hier, na expliciete toestemming, zien of
            dit adres in bekende datalekken voorkomt.
          </Body>
        </Notice>
      ) : null}
      <Body muted>
        Wil je het nu al echt nakijken? Dat kan zelf op de website Have I Been Pwned. Daar vul je je adres in, buiten ShieldCheck om.
      </Body>
      <Button
        variant="ghost"
        icon="open-outline"
        label="Open haveibeenpwned.com in je browser"
        onPress={() => void Linking.openURL('https://haveibeenpwned.com/')}
      />
    </Card>
  );
}

function LinkCheck() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const colors = useColors();

  const analyze = () => {
    Keyboard.dismiss();
    setResult(analyzeText(text));
  };

  return (
    <Card>
      <View className="flex-row items-center gap-2">
        <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.primary} />
        <Text className="text-lg font-semibold text-navy-900 dark:text-navy-50">Link- en sms-check</Text>
      </View>
      <SourceBadge source="heuristic" />
      <Body muted>
        Plak een link of de tekst van een sms, mail of chatbericht. De analyse gebeurt op je toestel. We openen of bezoeken de link
        niet.
      </Body>
      <TextInput
        value={text}
        onChangeText={(v) => {
          setText(v);
          setResult(null);
        }}
        multiline
        textAlignVertical="top"
        placeholder="Bijvoorbeeld: Uw pakket wacht op betaling van verzendkosten via https://…"
        placeholderTextColor={colors.neutral}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Link of berichttekst om te controleren"
        className="min-h-32 rounded-xl border border-navy-200 bg-white p-4 text-base text-navy-900 dark:border-navy-700 dark:bg-navy-950 dark:text-navy-50"
      />
      <View className="gap-2">
        <Button label="Analyseer" icon="search" disabled={text.trim().length === 0} onPress={analyze} />
        {text.length > 0 ? (
          <Button
            variant="ghost"
            label="Wissen"
            icon="close"
            onPress={() => {
              setText('');
              setResult(null);
            }}
          />
        ) : null}
      </View>

      {!result ? (
        <Body muted>Nog niets geanalyseerd. Plak hierboven een bericht en tik op Analyseer.</Body>
      ) : result.verdict === 'empty' ? (
        <Body muted>Er is niets ingevuld om te analyseren.</Body>
      ) : (
        <View className="gap-3" accessibilityLiveRegion="polite">
          <View className={`gap-2 rounded-xl border p-3 ${VERDICT[result.verdict].box}`}>
            <View className="flex-row items-center gap-2">
              <Ionicons
                name={VERDICT[result.verdict].icon}
                size={22}
                color={result.verdict === 'no_signals' ? colors.good : colors.attention}
              />
              <Text className="flex-1 text-lg font-semibold text-navy-900 dark:text-navy-50">{VERDICT[result.verdict].title}</Text>
            </View>
            <Body>{VERDICT[result.verdict].body}</Body>
            <Text className="text-sm text-slate-600 dark:text-navy-200">Indicatie, geen garantie.</Text>
          </View>

          {result.signals.length > 0 ? (
            <>
              <Text className="text-base font-semibold text-navy-900 dark:text-navy-50">
                Signalen die tot dit oordeel leidden ({result.signals.length})
              </Text>
              {result.signals.map((s, i) => (
                <View key={`${s.id}-${i}`} className="gap-1 rounded-xl bg-navy-50 p-3 dark:bg-navy-800">
                  <Text className="text-base font-semibold text-navy-900 dark:text-navy-50">
                    {s.label} <Text className="text-sm font-normal text-slate-600 dark:text-navy-200">({SEVERITY_LABEL[s.severity]})</Text>
                  </Text>
                  <Body muted>{s.explanation}</Body>
                  {s.match ? (
                    <Text selectable className="text-sm text-slate-600 dark:text-navy-200">
                      Gevonden: “{s.match}”
                    </Text>
                  ) : null}
                </View>
              ))}
            </>
          ) : null}

          {result.urls.length > 0 ? (
            <View className="gap-1">
              <Text className="text-base font-semibold text-navy-900 dark:text-navy-50">Gevonden links (niet geopend)</Text>
              {result.urls.map((u) => (
                <Text key={u} selectable className="text-sm text-slate-700 dark:text-navy-100">
                  • {u}
                </Text>
              ))}
            </View>
          ) : null}

          <Notice>
            Twijfel je? België: stuur verdachte berichten door naar suspicious@safeonweb.be. Nederland: meld het bij de
            Fraudehelpdesk. Neem bij twijfel contact op met de organisatie via hun officiële nummer of app.
          </Notice>
        </View>
      )}
    </Card>
  );
}

export default function CheckScreen() {
  return (
    <Screen>
      <Title subtitle="Module D — lokaal op je toestel, zonder iets te versturen.">Datalek- en anti-scamcheck</Title>
      <SectionTitle>Verdachte link of bericht?</SectionTitle>
      <LinkCheck />
      <SectionTitle>Staat je e-mailadres in een datalek?</SectionTitle>
      <EmailCheck />
    </Screen>
  );
}
