// -----------------------------------------------------------------------------
// Entry point of the Gladys UPnP / IGD external integration.
//
//   - discovers the internet box via a mediated SSDP scan (the Gladys core runs
//     it on the host network — the container never sees SSDP multicast), with a
//     manual device-description URL as a fallback;
//   - publishes the box as a discovered device exposing read-only WAN features
//     (connection status, external IP, uptime, byte/packet counters);
//   - answers the polls of Gladys with the current WAN status read over SOAP.
//
// Every feature is read-only, so there is no set-value path.
//
// Environment variables provided by the Gladys supervisor to the container:
//   - GLADYS_HOST_API_URL         (host API URL)
//   - GLADYS_INTEGRATION_TOKEN    (integration-scoped JWT)
//   - GLADYS_INTEGRATION_SELECTOR (integration identifier)
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './src/config.js';
import { getBoxStatus, loadGateway } from './src/upnp/client.js';
import { parseSsdpResults } from './src/upnp/discovery.js';
import { computeRates } from './src/upnp/rate.js';
import {
  boxExternalIds,
  convertDevice,
  gatewayPlatformId,
  getDescriptionUrl,
} from './src/devices/convertDevice.js';
import { buildPollStates } from './src/devices/box.js';

const gladys = new GladysIntegration();

// Current configuration (hot-reloaded via onConfigUpdated).
let config = normalizeConfig();

/**
 * Collect the candidate box description URLs: the SSDP-discovered ones, plus
 * the manual URL from the config as a fallback.
 * @returns {Promise<string[]>} unique description URLs
 */
async function collectDescriptionUrls() {
  const urls = new Set();
  try {
    const results = await gladys.scanNetwork('ssdp', { timeoutSeconds: 5 });
    for (const { location } of parseSsdpResults(results)) {
      urls.add(location);
    }
    logger.info(`SSDP scan found ${urls.size} Internet Gateway Device(s)`);
  } catch (err) {
    logger.warn(`SSDP scan failed (${err.message}) - falling back to the manual URL if set`);
  }
  if (config.descriptionUrl) {
    urls.add(config.descriptionUrl);
  }
  return [...urls];
}

/**
 * Discover the box(es) and publish them as Gladys discovered devices.
 */
async function discover() {
  const urls = await collectDescriptionUrls();
  if (urls.length === 0) {
    logger.warn(
      'No Internet Gateway Device found by SSDP and no manual URL configured - nothing to publish',
    );
    return;
  }

  const devices = [];
  for (const url of urls) {
    try {
      const gateway = await loadGateway(url);
      devices.push(convertDevice(gladys, gateway));
    } catch (err) {
      logger.warn(`Could not load box description at ${url}: ${err.message}`);
    }
  }

  if (devices.length > 0) {
    await gladys.publishDiscoveredDevices(devices);
    logger.info(`${devices.length} box(es) published to Gladys`);
  }
}

// --- Discovery: Gladys asks for the list of devices --------------------------
gladys.onScanRequest(async () => {
  logger.info('onScanRequest -> discovering the internet box');
  await discover();
});

// --- Polling: Gladys asks to refresh a device --------------------------------
// Last byte-counter reading per box, to compute the data rate on the next poll.
// Kept in memory only: after a restart, the first poll publishes no rate.
const lastReadings = new Map();

gladys.onPoll(async (device) => {
  const descriptionUrl = getDescriptionUrl(device);
  const gateway = await loadGateway(descriptionUrl);
  const platformId = gatewayPlatformId(gateway);
  const status = await getBoxStatus(gateway);
  const reading = {
    at: Date.now(),
    uptime: status.uptime,
    bytesSent: status.bytesSent,
    bytesReceived: status.bytesReceived,
  };
  const rates = computeRates(lastReadings.get(platformId), reading);
  lastReadings.set(platformId, reading);
  const states = buildPollStates(boxExternalIds(gladys, platformId), { ...status, ...rates });
  if (states.length > 0) {
    await gladys.publishStates(states);
  }
});

// --- Command: the box exposes no controllable feature ------------------------
gladys.onSetValue(async (device, feature) => {
  throw new Error(`Feature "${feature.external_id}" is read-only and not controllable`);
});

// --- Configuration updated by the user ---------------------------------------
gladys.onConfigUpdated(async (newConfig) => {
  logger.info('onConfigUpdated -> rediscovering');
  config = normalizeConfig(newConfig);
  try {
    await discover();
  } catch (err) {
    logger.error('Rediscovery failed', err);
  }
});

// --- Connection lifecycle ----------------------------------------------------
gladys.on('connected', async () => {
  logger.info('WebSocket connected to Gladys');
  try {
    config = normalizeConfig(await gladys.getConfig());
    await discover();
  } catch (err) {
    logger.error('Post-connection initialization failed', err);
  }
});

gladys.on('disconnected', () => {
  logger.warn('WebSocket disconnected - the SDK will try to reconnect');
});

// --- Graceful shutdown -------------------------------------------------------
gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
});

// --- Startup -----------------------------------------------------------------
logger.info('Starting the UPnP / IGD integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
