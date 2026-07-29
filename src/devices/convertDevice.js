// -----------------------------------------------------------------------------
// Convert a loaded IGD gateway (see src/upnp/client.js#loadGateway) into a
// Gladys discovered-device payload.
//
// External id scheme (built with gladys.externalIds(), mandatory prefix
// `ext:<selector>:`):
//   device  -> ext:<selector>:box:<udn>
//   feature -> ext:<selector>:box:<udn>:<connection-status|external-ip|…>
//
// The device-description URL is stored as a device param: Gladys sends the
// params back with every poll, and that URL is how we reach the box over SOAP.
// -----------------------------------------------------------------------------

import { BOX_SLUG, DESCRIPTION_URL_PARAM, POLL_FREQUENCY, UDN_PARAM } from '../constants.js';
import { buildBoxFeatures } from './box.js';

/**
 * A Gladys platformId must not contain ':' (the external_id delimiter). Reduce
 * a UPnP UDN (`uuid:2f402f80-…` or already-bare) to an id-safe token, falling
 * back to the description URL host when no UDN is available.
 * @param {{ udn: string|null, descriptionUrl: string }} gateway
 * @returns {string}
 */
export function gatewayPlatformId(gateway) {
  const raw = (gateway.udn || '').replace(/^uuid:/i, '').trim();
  if (raw) {
    return raw.replace(/[^a-zA-Z0-9-]/g, '-');
  }
  // No UDN (e.g. manual URL and the box did not report one): derive a stable id
  // from the host of the description URL.
  try {
    return `host-${new URL(gateway.descriptionUrl).host}`.replace(/[^a-zA-Z0-9-]/g, '-');
  } catch {
    return 'box';
  }
}

/**
 * Build the external ids (device + feature factory) of a box.
 * @param {import('@gladysassistant/integration-sdk').GladysIntegration} gladys
 * @param {string} platformId id-safe box id (from gatewayPlatformId)
 * @returns {{ device: string, feature: (code: string) => string }}
 */
export function boxExternalIds(gladys, platformId) {
  return gladys.externalIds(BOX_SLUG, String(platformId));
}

/**
 * Stamp a globally-unique selector on each feature (based on its already-unique
 * external_id) so Gladys does not derive a name-based, collision-prone one.
 * @param {Array} features
 * @returns {Array}
 */
function withFeatureSelectors(features) {
  return features.map((feature) => ({ ...feature, selector: feature.external_id }));
}

/**
 * @param {import('@gladysassistant/integration-sdk').GladysIntegration} gladys
 * @param {{ descriptionUrl: string, friendlyName: string|null, udn: string|null }} gateway
 * @returns {object} Gladys discovered device
 */
export function convertDevice(gladys, gateway) {
  const platformId = gatewayPlatformId(gateway);
  const ids = boxExternalIds(gladys, platformId);

  return {
    name: gateway.friendlyName || 'Internet box',
    external_id: ids.device,
    should_poll: true,
    poll_frequency: POLL_FREQUENCY,
    features: withFeatureSelectors(buildBoxFeatures(ids)),
    params: [
      { name: DESCRIPTION_URL_PARAM, value: gateway.descriptionUrl },
      { name: UDN_PARAM, value: gateway.udn || '' },
    ],
  };
}

/**
 * Read the description URL stored in the device params.
 * @param {object} device Gladys device (sent with poll commands)
 * @returns {string} the description URL
 */
export function getDescriptionUrl(device) {
  const param = (device.params || []).find(({ name }) => name === DESCRIPTION_URL_PARAM);
  if (!param || !param.value) {
    throw new Error(`Box device "${device.external_id}" has no "${DESCRIPTION_URL_PARAM}" param`);
  }
  return param.value;
}
