import SwiftUI
import WidgetKit

/// "Tap to capture" home-screen widget. Tapping opens the app on the capture screen and starts
/// listening immediately (deep link handled by src/app/capture.tsx).
struct BrainVoiceCaptureEntry: TimelineEntry {
  let date: Date
}

struct BrainVoiceCaptureProvider: TimelineProvider {
  func placeholder(in context: Context) -> BrainVoiceCaptureEntry { BrainVoiceCaptureEntry(date: .now) }
  func getSnapshot(in context: Context, completion: @escaping (BrainVoiceCaptureEntry) -> Void) { completion(BrainVoiceCaptureEntry(date: .now)) }
  func getTimeline(in context: Context, completion: @escaping (Timeline<BrainVoiceCaptureEntry>) -> Void) {
    completion(Timeline(entries: [BrainVoiceCaptureEntry(date: .now)], policy: .never))
  }
}

struct BrainVoiceCaptureWidgetView: View {
  var body: some View {
    VStack(spacing: 8) {
      Image(systemName: "mic.fill")
        .font(.system(size: 34, weight: .bold))
        .foregroundStyle(.white)
      Text("Tap to capture")
        .font(.headline)
        .foregroundStyle(.white)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .containerBackground(for: .widget) {
      Color(red: 0.49, green: 0.36, blue: 1.0)
    }
    .widgetURL(URL(string: "brainvoice://capture?source=widget"))
  }
}

struct BrainVoiceCaptureWidget: Widget {
  let kind = "BrainVoiceCaptureWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: BrainVoiceCaptureProvider()) { _ in
      BrainVoiceCaptureWidgetView()
    }
    .configurationDisplayName("Capture")
    .description("Say what is on your mind with one tap.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct BrainVoiceWidgetBundle: WidgetBundle {
  var body: some Widget {
    BrainVoiceCaptureWidget()
    #if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      BrainVoiceAlarmLiveActivity()
    }
    #endif
  }
}
