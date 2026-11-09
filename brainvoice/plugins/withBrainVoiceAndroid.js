// Config plugin: Android native additions.
//  1. Static app shortcuts (long-press launcher icon): Capture, Task, Reminder, Inbox
//  2. Home-screen widget "Tap to capture" (AppWidgetProvider + layout + provider info)
//  3. Package-visibility <queries> for the clock app intents (also declared by the module)
// Runs during `npx expo prebuild`; android/ stays generated (ARCHITECTURE.md ADR-016).
const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withDangerousMod, withStringsXml } = require('expo/config-plugins');

const WIDGET_CLASS = 'BrainVoiceWidgetProvider';

const SHORTCUTS_XML = `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <shortcut
    android:shortcutId="capture"
    android:enabled="true"
    android:icon="@mipmap/ic_launcher"
    android:shortcutShortLabel="@string/bv_shortcut_capture_short"
    android:shortcutLongLabel="@string/bv_shortcut_capture_long">
    <intent
      android:action="android.intent.action.VIEW"
      android:targetPackage="__PACKAGE__"
      android:targetClass="__PACKAGE__.MainActivity"
      android:data="brainvoice://capture?source=shortcut" />
  </shortcut>
  <shortcut
    android:shortcutId="task"
    android:enabled="true"
    android:icon="@mipmap/ic_launcher"
    android:shortcutShortLabel="@string/bv_shortcut_task_short"
    android:shortcutLongLabel="@string/bv_shortcut_task_long">
    <intent
      android:action="android.intent.action.VIEW"
      android:targetPackage="__PACKAGE__"
      android:targetClass="__PACKAGE__.MainActivity"
      android:data="brainvoice://capture?source=shortcut&amp;kind=task" />
  </shortcut>
  <shortcut
    android:shortcutId="reminder"
    android:enabled="true"
    android:icon="@mipmap/ic_launcher"
    android:shortcutShortLabel="@string/bv_shortcut_reminder_short"
    android:shortcutLongLabel="@string/bv_shortcut_reminder_long">
    <intent
      android:action="android.intent.action.VIEW"
      android:targetPackage="__PACKAGE__"
      android:targetClass="__PACKAGE__.MainActivity"
      android:data="brainvoice://capture?source=shortcut&amp;kind=reminder" />
  </shortcut>
  <shortcut
    android:shortcutId="inbox"
    android:enabled="true"
    android:icon="@mipmap/ic_launcher"
    android:shortcutShortLabel="@string/bv_shortcut_inbox_short"
    android:shortcutLongLabel="@string/bv_shortcut_inbox_long">
    <intent
      android:action="android.intent.action.VIEW"
      android:targetPackage="__PACKAGE__"
      android:targetClass="__PACKAGE__.MainActivity"
      android:data="brainvoice://inbox" />
  </shortcut>
</shortcuts>
`;

const WIDGET_INFO_XML = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:minWidth="110dp"
  android:minHeight="40dp"
  android:targetCellWidth="2"
  android:targetCellHeight="1"
  android:updatePeriodMillis="0"
  android:initialLayout="@layout/brainvoice_widget"
  android:resizeMode="horizontal"
  android:widgetCategory="home_screen"
  android:description="@string/bv_widget_description" />
`;

const WIDGET_LAYOUT_XML = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/brainvoice_widget_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:background="@drawable/brainvoice_widget_bg"
  android:gravity="center"
  android:orientation="horizontal"
  android:padding="12dp">
  <TextView
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:text="@string/bv_widget_label"
    android:textColor="#FFFFFF"
    android:textSize="16sp"
    android:textStyle="bold" />
</LinearLayout>
`;

const WIDGET_BG_XML = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <solid android:color="#7C5CFF" />
  <corners android:radius="24dp" />
</shape>
`;

const STRINGS = {
  bv_shortcut_capture_short: 'Capture',
  bv_shortcut_capture_long: 'Capture a thought',
  bv_shortcut_task_short: 'Task',
  bv_shortcut_task_long: 'Create a task',
  bv_shortcut_reminder_short: 'Reminder',
  bv_shortcut_reminder_long: 'Create a reminder',
  bv_shortcut_inbox_short: 'Inbox',
  bv_shortcut_inbox_long: 'Open Brain Inbox',
  bv_widget_label: '🎤  Tap to capture',
  bv_widget_description: 'Capture a thought with one tap',
};

function writeFile(target, content) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

/** @param {import('expo/config').ExpoConfig} config */
function withResources(config) {
  return withDangerousMod(config, [
    'android',
    async (c) => {
      const pkg = c.android?.package;
      if (!pkg) throw new Error('withBrainVoiceAndroid: android.package is required');
      const res = path.join(c.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
      writeFile(path.join(res, 'xml', 'shortcuts.xml'), SHORTCUTS_XML.replace(/__PACKAGE__/g, pkg));
      writeFile(path.join(res, 'xml', 'brainvoice_widget_info.xml'), WIDGET_INFO_XML);
      writeFile(path.join(res, 'layout', 'brainvoice_widget.xml'), WIDGET_LAYOUT_XML);
      writeFile(path.join(res, 'drawable', 'brainvoice_widget_bg.xml'), WIDGET_BG_XML);
      const javaDir = path.join(c.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', ...pkg.split('.'));
      const source = fs.readFileSync(path.join(c.modRequest.projectRoot, 'plugins', 'android', `${WIDGET_CLASS}.kt`), 'utf8').replace(/^package .*$/m, `package ${pkg}`);
      writeFile(path.join(javaDir, `${WIDGET_CLASS}.kt`), source);
      return c;
    },
  ]);
}

/** @param {import('expo/config').ExpoConfig} config */
function withStrings(config) {
  return withStringsXml(config, (c) => {
    const items = Object.entries(STRINGS).map(([name, value]) => AndroidConfig.Resources.buildResourceItem({ name, value }));
    c.modResults = AndroidConfig.Strings.setStringItem(items, c.modResults);
    return c;
  });
}

/** @param {import('expo/config').ExpoConfig} config */
function withManifest(config) {
  return withAndroidManifest(config, (c) => {
    const pkg = c.android?.package ?? '';
    const manifest = c.modResults;
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);

    // Static shortcuts.
    activity['meta-data'] = (activity['meta-data'] ?? []).filter((m) => m.$['android:name'] !== 'android.app.shortcuts');
    activity['meta-data'].push({ $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' } });

    // Widget receiver.
    const receivers = (application.receiver ?? []).filter((r) => r.$['android:name'] !== `${pkg}.${WIDGET_CLASS}`);
    receivers.push({
      $: { 'android:name': `${pkg}.${WIDGET_CLASS}`, 'android:exported': 'true' },
      'intent-filter': [{ action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }] }],
      'meta-data': [{ $: { 'android:name': 'android.appwidget.provider', 'android:resource': '@xml/brainvoice_widget_info' } }],
    });
    application.receiver = receivers;

    // Package visibility for the clock app (belt and braces; the module manifest declares it too).
    const actions = ['android.intent.action.SET_ALARM', 'android.intent.action.SET_TIMER', 'android.intent.action.DISMISS_ALARM', 'android.intent.action.DISMISS_TIMER', 'android.intent.action.SHOW_ALARMS'];
    const queries = manifest.manifest.queries ?? [];
    queries.push({ intent: actions.map((name) => ({ action: [{ $: { 'android:name': name } }] })) });
    manifest.manifest.queries = queries;
    return c;
  });
}

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withBrainVoiceAndroid = (config) => withManifest(withStrings(withResources(config)));

module.exports = withBrainVoiceAndroid;
