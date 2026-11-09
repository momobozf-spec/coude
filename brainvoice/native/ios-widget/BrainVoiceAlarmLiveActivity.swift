import ActivityKit
import SwiftUI
import WidgetKit

#if canImport(AlarmKit)
import AlarmKit

/// Live Activity for AlarmKit countdown timers created by BrainVoice.
/// AlarmKit drives the activity itself; we only describe the presentation.
@available(iOS 26.0, *)
struct BrainVoiceAlarmLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: AlarmAttributes<BrainVoiceAlarmMetadata>.self) { context in
      // Lock Screen / banner
      HStack(spacing: 12) {
        Image(systemName: context.attributes.metadata?.kind == "timer" ? "timer" : "alarm.fill")
          .font(.title2)
          .foregroundStyle(context.attributes.tintColor)
        VStack(alignment: .leading, spacing: 2) {
          Text(context.attributes.presentation.countdown?.title ?? "BrainVoice")
            .font(.headline)
          countdownText(for: context.state)
            .font(.system(.title, design: .rounded).monospacedDigit())
        }
        Spacer()
      }
      .padding()
      .activityBackgroundTint(Color.black.opacity(0.6))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Image(systemName: "timer").foregroundStyle(context.attributes.tintColor)
        }
        DynamicIslandExpandedRegion(.center) {
          Text(context.attributes.presentation.countdown?.title ?? "BrainVoice").font(.headline)
        }
        DynamicIslandExpandedRegion(.trailing) {
          countdownText(for: context.state).font(.title3.monospacedDigit())
        }
      } compactLeading: {
        Image(systemName: "timer").foregroundStyle(context.attributes.tintColor)
      } compactTrailing: {
        countdownText(for: context.state).font(.caption.monospacedDigit())
      } minimal: {
        Image(systemName: "timer").foregroundStyle(context.attributes.tintColor)
      }
    }
  }

  @ViewBuilder
  private func countdownText(for state: AlarmPresentationState) -> some View {
    switch state.mode {
    case .countdown(let countdown):
      Text(timerInterval: Date.now...countdown.fireDate, countsDown: true)
    case .paused(let paused):
      Text(paused.totalCountdownDuration.formatted(.time(pattern: .minuteSecond)))
    default:
      Text("—")
    }
  }
}
#endif
