import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mqtt, { type MqttClient } from 'mqtt';

/** Het commando dat over de draad gaat naar de deurcontroller. */
export interface GateUnlockCommand {
  /** Correlatie-id: hetzelfde als `AccessLog.id`, zodat je hardware-logs en audit-trail kunt koppelen. */
  readonly correlationId: string;
  /** Hoe lang het relais moet aantrekken. De deur valt daarna vanzelf in het slot. */
  readonly holdMilliseconds: number;
  /** Unix-milliseconden. De controller weigert commando's die te oud zijn. */
  readonly issuedAt: number;
}

/**
 * Publiceert deurcommando's naar de fysieke controller over MQTT.
 *
 * ## Waarom MQTT en niet HTTP
 *
 * Een deurcontroller in een winkel zit achter een consumentenrouter zonder
 * publiek IP. Hij kan niet *ontvangen*, alleen *uitbellen*. MQTT draait dat om:
 * de controller houdt een uitgaande verbinding met de broker open en krijgt
 * commando's daarover binnen. Geen port-forwarding, geen inbound firewall-gat.
 *
 * ## QoS 1, niet 0 en niet 2
 *
 * QoS 0 mag een bericht stilletjes laten vallen — dan staat de klant voor een
 * dichte deur zonder dat iemand het weet. QoS 2 (exactly-once) kost een
 * vierweg-handshake en de deur *twee keer* openen is onschuldig: hij staat al open.
 * QoS 1 (at-least-once) is hier precies goed.
 */
@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: MqttClient | null = null;
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.enabled = this.config.getOrThrow<boolean>('MQTT_ENABLED');

    if (!this.enabled) {
      this.logger.warn('MQTT_ENABLED=false — deurcommando\'s worden gelogd, niet verstuurd');
      return;
    }

    const url = this.config.getOrThrow<string>('MQTT_URL');
    this.client = mqtt.connect(url, {
      username: this.config.get<string>('MQTT_USERNAME') || undefined,
      password: this.config.get<string>('MQTT_PASSWORD') || undefined,
      reconnectPeriod: 2_000,
      connectTimeout: 5_000,
    });

    this.client.on('connect', () => this.logger.log(`Verbonden met MQTT-broker op ${url}`));
    this.client.on('error', (error) => this.logger.error(`MQTT-fout: ${error.message}`));
    this.client.on('offline', () => this.logger.warn('MQTT-broker onbereikbaar — deuren gaan niet open'));
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.endAsync();
  }

  /**
   * Stuurt het ontgrendelcommando en wacht op de PUBACK van de broker.
   *
   * Dit is het moment waarop we het verschil weten tussen "de deur gaat open" en
   * "we hebben geroepen in het niets". Werpt deze functie, dan is er geen
   * bevestiging en behandelt `GateService` het als een storing — inclusief het
   * terugdraaien van de verbruikte token.
   *
   * Let op: een PUBACK zegt dat de *broker* het bericht heeft. Of het relais ook
   * echt bewoog, weet je pas via een terugmelding op `{prefix}/gate/state`. Die
   * lus hoort bij de hardware-integratie en staat bewust nog niet in deze code.
   */
  async publishUnlock(mqttTopicPrefix: string, command: GateUnlockCommand): Promise<void> {
    const topic = `${mqttTopicPrefix}/gate/unlock`;
    const payload = JSON.stringify(command);

    if (!this.enabled || !this.client) {
      this.logger.log(`[SIMULATIE] zou publiceren naar ${topic}: ${payload}`);
      return;
    }

    if (!this.client.connected) {
      throw new Error('Geen verbinding met de MQTT-broker');
    }

    await this.client.publishAsync(topic, payload, { qos: 1 });
    this.logger.log(`Deurcommando gepubliceerd naar ${topic} (correlatie ${command.correlationId})`);
  }
}
