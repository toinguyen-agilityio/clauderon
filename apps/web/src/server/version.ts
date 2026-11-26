/** The app's release tag (e.g. `v0.8.0`), set as APP_VERSION by deploy/deploy.sh; null when unset, so nothing shows. */
export function appVersion(env: Record<string, string | undefined>): string | null {
  return env.APP_VERSION?.trim() || null;
}
