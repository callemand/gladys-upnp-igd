// -----------------------------------------------------------------------------
// The internet box device: its Gladys features and the mapping from a WAN
// status (see src/upnp/client.js#getBoxStatus) to Gladys states.
//
// Every feature is READ-ONLY (a box exposes no controllable action over IGD).
//   - connection-status (switch / binary)      WAN link up (1) or down (0)
//   - external-ip       (text)                 public WAN IP
//   - uptime            (duration / seconds)    connection uptime
//   - download-rate     (datarate / Mbit/s)    download rate between two polls
//   - upload-rate       (datarate / Mbit/s)    upload rate between two polls
//   - packets-sent      (counter-sensor)        total packets sent
//   - packets-received  (counter-sensor)        total packets received
//
// NOTE: IGD byte counters are 32-bit totals that wrap at ~4.29 GB, so their raw
// value is not published. The rates are computed from them (src/upnp/rate.js).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';

import { FEATURE_CODES, MAX_RATE_MBPS, MAX_UI4 } from '../constants.js';

/**
 * Build the read-only features of a box.
 * @param {{ feature: (code: string) => string }} ids external-id factory from boxExternalIds()
 * @returns {Array<object>} Gladys device features
 */
export function buildBoxFeatures(ids) {
  return [
    {
      name: 'Connection status',
      external_id: ids.feature(FEATURE_CODES.CONNECTION_STATUS),
      category: DEVICE_FEATURE_CATEGORIES.SWITCH,
      type: DEVICE_FEATURE_TYPES.SWITCH.BINARY,
      read_only: true,
      keep_history: true,
      has_feedback: false,
      min: 0,
      max: 1,
    },
    {
      name: 'External IP',
      external_id: ids.feature(FEATURE_CODES.EXTERNAL_IP),
      category: DEVICE_FEATURE_CATEGORIES.TEXT,
      type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
      read_only: true,
      keep_history: false,
      has_feedback: false,
      min: 0,
      max: 0,
    },
    {
      name: 'Uptime',
      external_id: ids.feature(FEATURE_CODES.UPTIME),
      category: DEVICE_FEATURE_CATEGORIES.DURATION,
      type: DEVICE_FEATURE_TYPES.DURATION.INTEGER,
      unit: DEVICE_FEATURE_UNITS.SECONDS,
      read_only: true,
      keep_history: true,
      has_feedback: false,
      min: 0,
      max: MAX_UI4,
    },
    {
      name: 'Download rate',
      external_id: ids.feature(FEATURE_CODES.DOWNLOAD_RATE),
      category: DEVICE_FEATURE_CATEGORIES.DATARATE,
      type: DEVICE_FEATURE_TYPES.DATARATE.RATE,
      unit: DEVICE_FEATURE_UNITS.MEGABITS_PER_SECOND,
      read_only: true,
      keep_history: true,
      has_feedback: false,
      min: 0,
      max: MAX_RATE_MBPS,
    },
    {
      name: 'Upload rate',
      external_id: ids.feature(FEATURE_CODES.UPLOAD_RATE),
      category: DEVICE_FEATURE_CATEGORIES.DATARATE,
      type: DEVICE_FEATURE_TYPES.DATARATE.RATE,
      unit: DEVICE_FEATURE_UNITS.MEGABITS_PER_SECOND,
      read_only: true,
      keep_history: true,
      has_feedback: false,
      min: 0,
      max: MAX_RATE_MBPS,
    },
    {
      name: 'Packets sent',
      external_id: ids.feature(FEATURE_CODES.PACKETS_SENT),
      category: DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
      type: DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
      read_only: true,
      keep_history: true,
      has_feedback: false,
      min: 0,
      max: MAX_UI4,
    },
    {
      name: 'Packets received',
      external_id: ids.feature(FEATURE_CODES.PACKETS_RECEIVED),
      category: DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
      type: DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
      read_only: true,
      keep_history: true,
      has_feedback: false,
      min: 0,
      max: MAX_UI4,
    },
  ];
}

/**
 * Map a WAN status to the Gladys state batch. Only the fields actually present
 * in the status produce a state (a feature we could not read is skipped).
 * @param {{ feature: (code: string) => string }} ids external-id factory
 * @param {object} status a status from getBoxStatus(), plus downloadRate / uploadRate
 * @returns {Array<{ device_feature_external_id: string, state?: number, text?: string }>}
 */
export function buildPollStates(ids, status = {}) {
  const states = [];

  const pushNumber = (code, value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      states.push({ device_feature_external_id: ids.feature(code), state: value });
    }
  };

  pushNumber(FEATURE_CODES.CONNECTION_STATUS, status.connectionStatus);
  pushNumber(FEATURE_CODES.UPTIME, status.uptime);
  pushNumber(FEATURE_CODES.DOWNLOAD_RATE, status.downloadRate);
  pushNumber(FEATURE_CODES.UPLOAD_RATE, status.uploadRate);
  pushNumber(FEATURE_CODES.PACKETS_SENT, status.packetsSent);
  pushNumber(FEATURE_CODES.PACKETS_RECEIVED, status.packetsReceived);

  if (typeof status.externalIp === 'string' && status.externalIp.length > 0) {
    states.push({
      device_feature_external_id: ids.feature(FEATURE_CODES.EXTERNAL_IP),
      text: status.externalIp,
    });
  }

  return states;
}
