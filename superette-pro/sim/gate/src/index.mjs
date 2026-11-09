/**
 * Simulator van de fysieke deurcontroller.
 *
 *   npm run dev:gate
 *
 * Draait twee dingen in één proces, zodat je zonder Docker en zonder hardware
 * de volledige keten kunt zien werken:
 *
 *   1. Een MQTT-broker (aedes) op poort 1883 — in productie is dit Mosquitto
 *      of een beheerde broker met TLS en client-certificaten.
 *   2. Een controller die subscribet op `store/+/gate/unlock` en het relais
 *      "aantrekt" — in productie een ESP32 of Raspberry Pi die een GPIO-pin
 *      hoog zet en daarmee een magneetsluiting ontgrendelt.
 *
 * ## Wat dit eerlijk simuleert
 *
 * De volledige weg van API → broker → controller, inclusief QoS 1-bevestiging.
 * Als de API hier niets ziet, gaat er in het echt ook geen deur open.
 *
 * ## Wat dit NIET simuleert
 *
 * De terugmelding van de hardware. Een echte controller publiceert na het
 * schakelen een bericht op `store/{id}/gate/state` zodat de API weet dát het
 * relais bewoog — en niet alleen dat de broker het commando aannam. Die lus
 * hoort bij de hardware-integratie en zit bewust nog niet in deze code.
 */
import { Aedes } from 'aedes';
import { createServer } from 'node:net';
import mqtt from 'mqtt';

const PORT = 1883;
const TOPIC = 'store/+/gate/unlock';

// ── Broker ───────────────────────────────────────────────────────────────────
// aedes v1 vervangt `new Aedes()` door een async factory.
const aedes = await Aedes.createBroker();
const server = createServer(aedes.handle);

await new Promise((resolve) => server.listen(PORT, resolve));
console.log(`[broker]     MQTT luistert op mqtt://localhost:${PORT}`);

aedes.on('client', (client) => console.log(`[broker]     client verbonden: ${client.id}`));

// ── Deurcontroller ───────────────────────────────────────────────────────────
const controller = mqtt.connect(`mqtt://localhost:${PORT}`, { clientId: 'deurcontroller-antwerpen-zuid' });

controller.on('connect', () => {
  // QoS 1: de broker herhaalt tot de controller bevestigt. Een gemist
  // ontgrendelcommando betekent een klant die voor een dichte deur staat.
  controller.subscribe(TOPIC, { qos: 1 }, (error) => {
    if (error) throw error;
    console.log(`[controller] geabonneerd op ${TOPIC}`);
    console.log('\nWachten op deurcommando\'s … (Ctrl+C om te stoppen)\n');
  });
});

controller.on('message', (topic, payload) => {
  const store = topic.split('/')[1];

  let command;
  try {
    command = JSON.parse(payload.toString('utf8'));
  } catch {
    console.error(`[controller] onleesbaar commando op ${topic} — genegeerd`);
    return;
  }

  // Een echte controller weigert oude commando's. Zonder deze check kan iemand
  // die verkeer opneemt het bericht later opnieuw afspelen en de deur openen.
  const ageMs = Date.now() - command.issuedAt;
  if (ageMs > 10_000) {
    console.warn(`[controller] commando is ${Math.round(ageMs / 1000)}s oud — genegeerd (replay-bescherming)`);
    return;
  }

  const hold = command.holdMilliseconds ?? 4000;
  console.log(`[controller] 🔓 RELAIS AAN  — winkel ${store}, ${hold}ms, correlatie ${command.correlationId}`);

  setTimeout(() => {
    console.log(`[controller] 🔒 relais uit — winkel ${store}, deur weer in het slot`);
  }, hold);
});

const shutdown = () => {
  console.log('\nAfsluiten …');
  controller.end(true);
  server.close();
  aedes.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
