import { Redirect } from 'expo-router';

import { LoadingBlock, Screen } from '../components/ui';
import { useScan } from '../state/ScanContext';

export default function Index() {
  const { ready, onboarded } = useScan();
  if (!ready) {
    return (
      <Screen scroll={false}>
        <LoadingBlock label="ShieldCheck wordt geladen…" />
      </Screen>
    );
  }
  return <Redirect href={onboarded ? '/dashboard' : '/onboarding'} />;
}
