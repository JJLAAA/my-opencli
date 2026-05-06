import packageJson from '../package.json' with { type: 'json' };

export const TAP_VERSION = packageJson.version;

export function versionText() {
  return `tap ${TAP_VERSION}`;
}
