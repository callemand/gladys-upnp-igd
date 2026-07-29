// -----------------------------------------------------------------------------
// UPnP / IGD protocol constants + the few Gladys values the SDK does not export.
//
// The standard Gladys feature categories / types / units come straight from the
// SDK (DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES, DEVICE_FEATURE_UNITS);
// only integration-specific values live here.
// -----------------------------------------------------------------------------

// The box is polled every 60 seconds (must be one of the Gladys
// DEVICE_POLL_FREQUENCIES values, in milliseconds). WAN counters change slowly
// and the box answers over SOAP, so there is no point polling faster.
export const POLL_FREQUENCY = 60 * 1000;

// HTTP timeout (ms) for every SOAP / description request to the box.
export const REQUEST_TIMEOUT = 10 * 1000;

// UPnP service types we talk to. Matched by substring so the profile version
// (`:1`, `:2`, …) does not matter.
export const SERVICE = {
  // Traffic counters (bytes / packets sent & received).
  COMMON_INTERFACE: 'WANCommonInterfaceConfig',
  // Link status, external IP and uptime. A box exposes exactly one of the two
  // depending on its WAN type (PPPoE/xDSL -> PPP, everything else -> IP).
  IP_CONNECTION: 'WANIPConnection',
  PPP_CONNECTION: 'WANPPPConnection',
};

// SOAP actions per service.
export const ACTION = {
  GET_TOTAL_BYTES_SENT: 'GetTotalBytesSent',
  GET_TOTAL_BYTES_RECEIVED: 'GetTotalBytesReceived',
  GET_TOTAL_PACKETS_SENT: 'GetTotalPacketsSent',
  GET_TOTAL_PACKETS_RECEIVED: 'GetTotalPacketsReceived',
  GET_STATUS_INFO: 'GetStatusInfo',
  GET_EXTERNAL_IP: 'GetExternalIPAddress',
};

// SSDP: tokens (in ST / NT / USN / SERVER) that identify an Internet Gateway
// Device or one of its WAN sub-devices/services.
export const IGD_SSDP_TOKENS = [
  'InternetGatewayDevice',
  'WANConnectionDevice',
  'WANCommonInterfaceConfig',
  'WANIPConnection',
  'WANPPPConnection',
];

// Value of NewConnectionStatus that means the WAN link is up.
export const CONNECTED_STATUS = 'Connected';

// IGD counters and uptime are UPnP `ui4` (32-bit) values: they wrap at this max.
// Used as the upper bound of the counter/duration features.
export const MAX_UI4 = 4294967295;

// Feature codes (the `<featureKey>` suffix of a feature external_id).
export const FEATURE_CODES = {
  CONNECTION_STATUS: 'connection-status',
  EXTERNAL_IP: 'external-ip',
  UPTIME: 'uptime',
  BYTES_SENT: 'bytes-sent',
  BYTES_RECEIVED: 'bytes-received',
  PACKETS_SENT: 'packets-sent',
  PACKETS_RECEIVED: 'packets-received',
};

// Device type slug used to build external ids (`ext:<selector>:box:<udn>`).
export const BOX_SLUG = 'box';

// Device param names (Gladys sends them back on every poll / set-value).
export const DESCRIPTION_URL_PARAM = 'descriptionUrl';
export const UDN_PARAM = 'udn';
