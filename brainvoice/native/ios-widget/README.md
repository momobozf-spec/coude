# BrainVoice iOS widget & AlarmKit Live Activity (optional extension target)

These sources add:

* a small/medium **home-screen widget** with a "Tap to capture" button that deep-links to
  `brainvoice://capture?source=widget`;
* a **Live Activity** that renders the AlarmKit countdown for timers created by the app on the
  Lock Screen and in the Dynamic Island (without it, AlarmKit timers still fire as an alert but
  show no live countdown).

They are not wired by a config plugin because an app extension target cannot be compiled or
verified on the Windows machine this project was built on. Steps in Xcode (after
`npx expo prebuild`):

1. File → New → Target → **Widget Extension**. Product name `BrainVoiceWidgets`, tick
   *Include Live Activity*, untick *Include Configuration App Intent*.
2. Delete the generated Swift files in the new target and add:
   * `BrainVoiceWidgets.swift` (widget)
   * `BrainVoiceAlarmLiveActivity.swift` (Live Activity)
   * `BrainVoiceAlarmMetadata.swift` – add this file to **both** the app target and the
     extension target (the metadata type must be identical on both sides), and delete the
     duplicate `BrainVoiceAlarmMetadata` struct from
     `modules/brainvoice-native/ios/BrainVoiceNativeModule.swift`.
3. Signing & Capabilities on the extension: add **App Groups** → `group.com.brainvoice.app`.
4. Set the extension's deployment target to iOS 17 (the Live Activity file is `@available(iOS 26, *)`).
5. Build & run on a device with iOS 26 to see the countdown.

Keeping the target across `npx expo prebuild --clean` requires a config plugin that adds
extension targets, e.g. `@bacons/apple-targets`; until then run prebuild without `--clean`.
