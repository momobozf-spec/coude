/**
 * The iOS share extension opens the app with chatjaar://dataUrl=<key>…; the share-intent provider reads the
 * shared file itself, so we just send the router to the home screen instead of an unknown route.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (path.includes("dataUrl=")) return "/";
    return path;
  } catch {
    return "/";
  }
}
