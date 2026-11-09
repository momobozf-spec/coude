#if canImport(AlarmKit)
import AlarmKit

/// Shared between the app target and the widget extension: the metadata attached to every
/// AlarmKit alarm/timer BrainVoice creates. Must be byte-identical on both sides.
@available(iOS 26.0, *)
nonisolated struct BrainVoiceAlarmMetadata: AlarmMetadata {
  let localId: String
  let kind: String
}
#endif
