// -----------------------------------------------------------------------------
// SSDP result parsing.
//
// The integration container is on a bridge network, so it never receives SSDP
// multicast directly: the Gladys core runs the scan on the host network and
// returns the RAW responder headers (`gladys.scanNetwork('ssdp')`). A single
// M-SEARCH surfaces many responders per box (root device, each embedded
// sub-device, each service), all sharing the same LOCATION. Our job is to keep
// only the Internet Gateway Device responders and reduce them to their unique
// LOCATIONs (the description URLs we will fetch afterwards).
// -----------------------------------------------------------------------------

import { IGD_SSDP_TOKENS } from '../constants.js';

/**
 * Read a header case-insensitively from a raw SSDP responder object.
 * @param {Record<string, string>} headers
 * @param {string} name header name (e.g. 'LOCATION')
 * @returns {string|undefined}
 */
function header(headers, name) {
  const target = name.toLowerCase();
  const key = Object.keys(headers || {}).find((k) => k.toLowerCase() === target);
  return key === undefined ? undefined : headers[key];
}

/**
 * Does this responder advertise an Internet Gateway Device (or one of its WAN
 * sub-devices/services)?
 * @param {Record<string, string>} headers
 * @returns {boolean}
 */
function isIgdResponder(headers) {
  const haystack = [
    header(headers, 'ST'),
    header(headers, 'NT'),
    header(headers, 'USN'),
    header(headers, 'SERVER'),
  ]
    .filter(Boolean)
    .join(' ');
  return IGD_SSDP_TOKENS.some((token) => haystack.includes(token));
}

/**
 * Parse raw SSDP scan results into the unique IGD gateways found.
 * @param {Array<Record<string, string>>} results raw responders from scanNetwork('ssdp')
 * @returns {Array<{ location: string, udn: string|null }>} one entry per unique LOCATION
 */
export function parseSsdpResults(results = []) {
  const byLocation = new Map();
  for (const headers of results) {
    if (!isIgdResponder(headers)) {
      continue;
    }
    const location = header(headers, 'LOCATION');
    if (!location || byLocation.has(location)) {
      continue;
    }
    // USN looks like `uuid:<id>::urn:…`; keep the uuid part when present.
    const usn = header(headers, 'USN') || '';
    const udnMatch = /uuid:([^:]+)/i.exec(usn);
    byLocation.set(location, { location, udn: udnMatch ? udnMatch[1] : null });
  }
  return [...byLocation.values()];
}
