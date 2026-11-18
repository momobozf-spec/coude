import * as Network from 'expo-network';
import { Platform } from 'react-native';

import type { CheckResult } from './types';

function typeLabel(type: Network.NetworkStateType | undefined): string {
  switch (type) {
    case Network.NetworkStateType.WIFI:
      return 'wifi';
    case Network.NetworkStateType.CELLULAR:
      return 'mobiele data';
    case Network.NetworkStateType.ETHERNET:
      return 'kabel (ethernet)';
    case Network.NetworkStateType.VPN:
      return 'VPN';
    case Network.NetworkStateType.BLUETOOTH:
      return 'bluetooth';
    case Network.NetworkStateType.NONE:
      return 'geen verbinding';
    default:
      return 'onbekend type';
  }
}

export async function checkConnection(): Promise<CheckResult> {
  const base = {
    id: 'connection',
    module: 'network' as const,
    title: 'Verbinding en verbindingstype',
    weight: 0, // verbindingstype zegt op zich niets over veiligheid
  };

  try {
    const state = await Network.getNetworkStateAsync();
    const label = typeLabel(state.type);
    const detail =
      'Uitgelezen via expo-network. Dit telt niet mee in de score: het type verbinding zegt op zich niets over hoe veilig ze is.' +
      (Platform.OS === 'ios' ? ' iOS meldt geen VPN-type aan apps.' : '');

    if (!state.isConnected) {
      return {
        ...base,
        source: 'verified',
        outcome: 'info',
        summary: 'Je toestel heeft nu geen netwerkverbinding.',
        detail,
      };
    }

    let summary = `Je bent verbonden via ${label}.`;
    if (state.type === Network.NetworkStateType.WIFI) {
      summary += ' Op openbare wifi (station, café, hotel) doe je beter geen bankzaken.';
    }
    if (state.isInternetReachable === false) {
      summary += ' Het internet lijkt op dit moment niet bereikbaar.';
    }

    return { ...base, source: 'verified', outcome: 'info', summary, detail };
  } catch {
    return {
      ...base,
      source: 'unchecked',
      outcome: 'unknown',
      summary: 'De netwerkstatus kon niet worden uitgelezen.',
    };
  }
}

export function checkWifiSecurity(): CheckResult {
  const isIos = Platform.OS === 'ios';
  return {
    id: 'wifi_security',
    module: 'network',
    title: 'Wifi-beveiliging (WPA2/WPA3), DNS en onderschepping',
    source: 'limited',
    outcome: 'unknown',
    weight: 0,
    summary: 'Niet gecontroleerd: deze informatie is niet betrouwbaar beschikbaar voor apps.',
    detail:
      'ShieldCheck controleert niet welke wifi-versleuteling je netwerk gebruikt, of je DNS veilig is, of dat iemand je verkeer onderschept (man-in-the-middle). ' +
      'Je kunt de versleuteling van je wifi zelf bekijken in de systeeminstellingen.',
    settings: 'wifi',
    manualSteps: isIos
      ? 'Open Instellingen > Wifi en tik op het (i)-symbool naast je netwerk. Staat er "Zwakke beveiliging", pas dan de instellingen van je router aan naar WPA2 of WPA3.'
      : 'Open Instellingen > Netwerk en internet > Wifi en tik op je netwerk. Bij "Beveiliging" zie je bv. WPA2 of WPA3.',
  };
}

export async function runNetworkChecks(): Promise<CheckResult[]> {
  const connection = await checkConnection();
  return [connection, checkWifiSecurity()];
}
