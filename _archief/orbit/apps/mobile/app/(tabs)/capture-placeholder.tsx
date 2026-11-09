import { Redirect } from 'expo-router';

/**
 * Houdt de middelste plek in de tabbar bezet.
 *
 * De knop zelf opent het quick-capture-scherm als modal; deze route wordt
 * daardoor nooit echt bezocht. Zonder dit bestand kan expo-router geen vijfde
 * tabslot maken, en dan verspringt de plus naar de rand.
 */
export default function CapturePlaceholder() {
  return <Redirect href="/capture" />;
}
