// Config plugin: iOS native additions that Expo does not manage out of the box.
//  1. App Intents source (Siri / Shortcuts / Action Button) added to the app target
//  2. App Group entitlement shared by the app and its intents
//  3. Info.plist keys for AlarmKit and Live Activities
// Runs during `npx expo prebuild`; ios/ stays generated (ARCHITECTURE.md ADR-016).
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withEntitlementsPlist, withInfoPlist, withXcodeProject, IOSConfig } = require('expo/config-plugins');

const APP_GROUP = 'group.com.brainvoice.app';
const SWIFT_FILE = 'BrainVoiceAppIntents.swift';

/** @param {import('expo/config').ExpoConfig} config */
function withAppIntentsSource(config) {
  config = withDangerousMod(config, [
    'ios',
    async (c) => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(c.modRequest.projectRoot);
      const source = path.join(c.modRequest.projectRoot, 'plugins', 'ios', SWIFT_FILE);
      const target = path.join(c.modRequest.platformProjectRoot, projectName, SWIFT_FILE);
      fs.copyFileSync(source, target);
      return c;
    },
  ]);
  config = withXcodeProject(config, (c) => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(c.modRequest.projectRoot);
    const relativePath = `${projectName}/${SWIFT_FILE}`;
    if (!c.modResults.hasFile(relativePath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath: relativePath, groupName: projectName, project: c.modResults });
    }
    return c;
  });
  return config;
}

/** @param {import('expo/config').ExpoConfig} config */
function withAppGroup(config) {
  return withEntitlementsPlist(config, (c) => {
    const key = 'com.apple.security.application-groups';
    const existing = Array.isArray(c.modResults[key]) ? c.modResults[key] : [];
    if (!existing.includes(APP_GROUP)) c.modResults[key] = [...existing, APP_GROUP];
    return c;
  });
}

/** @param {import('expo/config').ExpoConfig} config */
function withAlarmKitPlist(config) {
  return withInfoPlist(config, (c) => {
    if (!c.modResults.NSAlarmKitUsageDescription) {
      c.modResults.NSAlarmKitUsageDescription = 'BrainVoice creates the alarms and timers you ask for by voice.';
    }
    // Required for AlarmKit countdown UI once the Live Activity extension is added (native/ios-widget).
    c.modResults.NSSupportsLiveActivities = true;
    return c;
  });
}

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withBrainVoiceIOS = (config) => withAlarmKitPlist(withAppGroup(withAppIntentsSource(config)));

module.exports = withBrainVoiceIOS;
