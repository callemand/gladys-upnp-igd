// -----------------------------------------------------------------------------
// High-level UPnP/IGD box client: turn a device-description URL into a gateway
// (its services + identity), then read the WAN status over SOAP.
// -----------------------------------------------------------------------------

import { logger } from '@gladysassistant/integration-sdk';
import { ACTION, CONNECTED_STATUS, MAX_UI4, SERVICE } from '../constants.js';
import { callSoap, extractTag, fetchText, parseDescription } from './soap.js';

/**
 * Find a parsed service by serviceType substring (version-agnostic).
 * @param {Array<{ serviceType: string, controlURL: string }>} services
 * @param {string} token e.g. 'WANCommonInterfaceConfig'
 * @returns {{ serviceType: string, controlURL: string }|undefined}
 */
export function findService(services, token) {
  return (services || []).find((s) => s.serviceType.includes(token));
}

/**
 * The WAN connection service is either IP (most boxes) or PPP (xDSL/PPPoE).
 * @param {Array<{ serviceType: string, controlURL: string }>} services
 * @returns {{ serviceType: string, controlURL: string }|undefined}
 */
export function pickWanConnectionService(services) {
  return (
    findService(services, SERVICE.IP_CONNECTION) || findService(services, SERVICE.PPP_CONNECTION)
  );
}

/**
 * Fetch and parse a box description.
 * @param {string} descriptionUrl the rootDesc.xml URL
 * @returns {Promise<{ descriptionUrl: string, friendlyName: string|null, udn: string|null, services: Array }>}
 */
export async function loadGateway(descriptionUrl) {
  const xml = await fetchText(descriptionUrl);
  const { friendlyName, udn, services } = parseDescription(xml, descriptionUrl);
  return { descriptionUrl, friendlyName, udn, services };
}

/**
 * Parse an integer out of a SOAP response output, or undefined.
 * @param {string} xml SOAP response body
 * @param {string} tag output tag name (e.g. 'NewTotalBytesSent')
 * @returns {number|undefined}
 */
function readInteger(xml, tag) {
  const raw = extractTag(xml, tag);
  if (raw === undefined || raw === '') {
    return undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Read a traffic counter. Some boxes (e.g. the Orange Livebox) do not wrap a
 * full 32-bit counter back to 0: they keep it stuck at the max value. A stuck
 * counter means nothing, so it is treated as missing.
 * @param {string} xml SOAP response body
 * @param {string} tag output tag name (e.g. 'NewTotalBytesSent')
 * @returns {number|undefined}
 */
function readCounter(xml, tag) {
  const value = readInteger(xml, tag);
  return value === MAX_UI4 ? undefined : value;
}

/**
 * Call one SOAP action, tolerating a missing service or a box refusal (returns
 * undefined instead of throwing — a box may not implement every counter).
 * @param {{ services: Array }} gateway
 * @param {string} serviceToken serviceType substring
 * @param {string} action SOAP action name
 * @returns {Promise<string|undefined>} the response XML, or undefined
 */
async function tryAction(gateway, serviceToken, action) {
  const service =
    serviceToken === 'WAN_CONNECTION'
      ? pickWanConnectionService(gateway.services)
      : findService(gateway.services, serviceToken);
  if (!service) {
    return undefined;
  }
  try {
    return await callSoap(service.controlURL, service.serviceType, action);
  } catch (err) {
    logger.warn(`UPnP action ${action} failed: ${err.message}`);
    return undefined;
  }
}

/**
 * Read the full WAN status of a box. Every field is best-effort: a field is
 * left undefined when the box does not expose it, and the caller only publishes
 * the states it actually got.
 * @param {{ services: Array }} gateway a gateway from loadGateway()
 * @returns {Promise<{ connectionStatus?: number, uptime?: number, externalIp?: string,
 *   bytesSent?: number, bytesReceived?: number, packetsSent?: number, packetsReceived?: number }>}
 */
export async function getBoxStatus(gateway) {
  const [bytesSentXml, bytesReceivedXml, packetsSentXml, packetsReceivedXml, statusXml, ipXml] =
    await Promise.all([
      tryAction(gateway, SERVICE.COMMON_INTERFACE, ACTION.GET_TOTAL_BYTES_SENT),
      tryAction(gateway, SERVICE.COMMON_INTERFACE, ACTION.GET_TOTAL_BYTES_RECEIVED),
      tryAction(gateway, SERVICE.COMMON_INTERFACE, ACTION.GET_TOTAL_PACKETS_SENT),
      tryAction(gateway, SERVICE.COMMON_INTERFACE, ACTION.GET_TOTAL_PACKETS_RECEIVED),
      tryAction(gateway, 'WAN_CONNECTION', ACTION.GET_STATUS_INFO),
      tryAction(gateway, 'WAN_CONNECTION', ACTION.GET_EXTERNAL_IP),
    ]);

  const status = {};

  if (bytesSentXml !== undefined) {
    status.bytesSent = readCounter(bytesSentXml, 'NewTotalBytesSent');
  }
  if (bytesReceivedXml !== undefined) {
    status.bytesReceived = readCounter(bytesReceivedXml, 'NewTotalBytesReceived');
  }
  if (packetsSentXml !== undefined) {
    status.packetsSent = readCounter(packetsSentXml, 'NewTotalPacketsSent');
  }
  if (packetsReceivedXml !== undefined) {
    status.packetsReceived = readCounter(packetsReceivedXml, 'NewTotalPacketsReceived');
  }
  if (statusXml !== undefined) {
    const connectionStatus = extractTag(statusXml, 'NewConnectionStatus');
    if (connectionStatus !== undefined) {
      status.connectionStatus = connectionStatus === CONNECTED_STATUS ? 1 : 0;
    }
    const uptime = readInteger(statusXml, 'NewUptime');
    if (uptime !== undefined) {
      status.uptime = uptime;
    }
  }
  if (ipXml !== undefined) {
    const externalIp = extractTag(ipXml, 'NewExternalIPAddress');
    if (externalIp) {
      status.externalIp = externalIp;
    }
  }

  return status;
}
