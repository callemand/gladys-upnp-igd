// -----------------------------------------------------------------------------
// Integration configuration.
//
// The configuration is filled in by the user in Gladys, from the
// `config_schema` declared in `gladys-assistant-integration.json`. The SDK
// fetches it (`gladys.getConfig()`) and notifies every change through
// `gladys.onConfigUpdated()`.
//
// The only field is an OPTIONAL device-description URL, used as a fallback when
// the SSDP auto-discovery finds nothing (or the box does not answer SSDP).
// -----------------------------------------------------------------------------

export const DEFAULT_CONFIG = {
  descriptionUrl: null,
};

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 * @returns {{ descriptionUrl: string|null }}
 */
export function normalizeConfig(raw = {}) {
  const url = typeof raw.description_url === 'string' ? raw.description_url.trim() : '';
  return {
    ...DEFAULT_CONFIG,
    descriptionUrl: url || null,
  };
}
