import { ExpoSpeechRecognitionModule, type ExpoSpeechRecognitionErrorCode } from 'expo-speech-recognition';

import type { PermissionState } from '@core/commands/adapters';
import type { DomainErrorCode } from '@core/types/common';

/**
 * VoiceInputService – abstraction over speech-to-text so that the capture flow
 * does not depend on expo-speech-recognition. A future wake-word or Whisper
 * implementation only needs to implement this interface (ARCHITECTURE.md §8).
 */

export type VoiceEvent =
  | { type: 'start' }
  | { type: 'interim'; transcript: string }
  | { type: 'final'; transcript: string; confidence: number }
  | { type: 'volume'; value: number }
  | { type: 'end' }
  | { type: 'error'; code: DomainErrorCode; message: string };

export interface VoiceStartOptions {
  locale: string;
  interimResults: boolean;
  onDevice: boolean;
  contextualStrings?: string[];
}

export interface VoiceInputService {
  readonly id: string;
  isAvailable(): boolean;
  supportsOnDevice(): boolean;
  getPermission(): Promise<PermissionState>;
  requestPermission(): Promise<PermissionState>;
  start(options: VoiceStartOptions): Promise<void>;
  stop(): Promise<void>;
  abort(): Promise<void>;
  subscribe(listener: (event: VoiceEvent) => void): () => void;
}

function mapPermission(status: string, restricted?: boolean): PermissionState {
  if (restricted) return 'unavailable';
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

function mapError(code: ExpoSpeechRecognitionErrorCode): DomainErrorCode | null {
  switch (code) {
    case 'aborted':
      return null;
    case 'not-allowed':
      return 'MIC_PERMISSION_DENIED';
    case 'network':
      return 'NO_INTERNET';
    case 'service-not-allowed':
    case 'language-not-supported':
      return 'SPEECH_NOT_AVAILABLE';
    case 'no-speech':
    case 'speech-timeout':
    case 'audio-capture':
    case 'interrupted':
    case 'bad-grammar':
    case 'busy':
    case 'client':
    case 'unknown':
    default:
      return 'SPEECH_RECOGNITION_FAILED';
  }
}

/** expo-speech-recognition implementation (SFSpeechRecognizer / Android SpeechRecognizer). */
export class ExpoSpeechVoiceInput implements VoiceInputService {
  readonly id = 'expo-speech-recognition';
  private readonly listeners = new Set<(event: VoiceEvent) => void>();
  private readonly subscriptions: { remove(): void }[] = [];
  private finalEmitted = false;

  constructor() {
    this.subscriptions.push(
      ExpoSpeechRecognitionModule.addListener('start', () => {
        this.finalEmitted = false;
        this.emit({ type: 'start' });
      }),
      ExpoSpeechRecognitionModule.addListener('result', (event) => {
        const transcript = event.results[0]?.transcript ?? '';
        if (event.isFinal) {
          this.finalEmitted = true;
          this.emit({ type: 'final', transcript, confidence: event.results[0]?.confidence ?? -1 });
        } else {
          this.emit({ type: 'interim', transcript });
        }
      }),
      ExpoSpeechRecognitionModule.addListener('volumechange', (event) => {
        // -2 (silent) … 10 → 0 … 1
        this.emit({ type: 'volume', value: Math.max(0, Math.min(1, (event.value + 2) / 12)) });
      }),
      ExpoSpeechRecognitionModule.addListener('nomatch', () => {
        this.emit({ type: 'error', code: 'SPEECH_RECOGNITION_FAILED', message: 'No speech recognised' });
      }),
      ExpoSpeechRecognitionModule.addListener('error', (event) => {
        const code = mapError(event.error);
        if (code) this.emit({ type: 'error', code, message: event.message });
      }),
      ExpoSpeechRecognitionModule.addListener('end', () => {
        this.emit({ type: 'end' });
      }),
    );
  }

  isAvailable(): boolean {
    try {
      return ExpoSpeechRecognitionModule.isRecognitionAvailable();
    } catch {
      return false;
    }
  }

  supportsOnDevice(): boolean {
    try {
      return ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
    } catch {
      return false;
    }
  }

  async getPermission(): Promise<PermissionState> {
    const result = await ExpoSpeechRecognitionModule.getPermissionsAsync();
    return mapPermission(result.status, result.restricted);
  }

  async requestPermission(): Promise<PermissionState> {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return mapPermission(result.status, result.restricted);
  }

  async start(options: VoiceStartOptions): Promise<void> {
    this.finalEmitted = false;
    ExpoSpeechRecognitionModule.start({
      lang: options.locale,
      interimResults: options.interimResults,
      continuous: false,
      maxAlternatives: 1,
      requiresOnDeviceRecognition: options.onDevice,
      addsPunctuation: true,
      contextualStrings: options.contextualStrings,
      iosTaskHint: 'dictation',
      volumeChangeEventOptions: { enabled: true, intervalMillis: 150 },
      // Raw audio is never persisted (PRIVACY.md).
      recordingOptions: { persist: false },
      androidIntentOptions: { EXTRA_LANGUAGE_MODEL: 'free_form', EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1500 },
    });
  }

  async stop(): Promise<void> {
    ExpoSpeechRecognitionModule.stop();
  }

  async abort(): Promise<void> {
    ExpoSpeechRecognitionModule.abort();
  }

  subscribe(listener: (event: VoiceEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    for (const s of this.subscriptions) s.remove();
    this.listeners.clear();
  }

  private emit(event: VoiceEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

/** Used when speech recognition is unavailable (simulator without mic, restricted devices). */
export class NullVoiceInput implements VoiceInputService {
  readonly id = 'none';
  isAvailable(): boolean {
    return false;
  }
  supportsOnDevice(): boolean {
    return false;
  }
  async getPermission(): Promise<PermissionState> {
    return 'unavailable';
  }
  async requestPermission(): Promise<PermissionState> {
    return 'unavailable';
  }
  async start(): Promise<void> {
    throw new Error('Speech recognition is not available');
  }
  async stop(): Promise<void> {}
  async abort(): Promise<void> {}
  subscribe(): () => void {
    return () => undefined;
  }
}
