// -----------------------------------------------------------------------------
// SSDP result parsing.
//
// The integration container is on a bridge network, so it never receives SSDP
// multicast directly: the Gladys core runs the scan on the host network and
// returns the RAW responses (`gladys.scanNetwork('ssdp')`). Each result is
// `{ source_ip, source_port, source_mac?, headers }`, where `headers` is the
// raw HTTP response text (status line + `Name: value` lines). A single
// M-SEARCH surfaces many responders per box (root device, each embedded
// sub-device, each service), all sharing the same LOCATION. Our job is to keep
// only the Internet Gateway Device responders and reduce them to their unique
// LOCATIONs (the description URLs we will fetch afterwards).
// -----------------------------------------------------------------------------

import { IGD_SSDP_TOKENS } from '../constants.js';

/**
 * Parse the raw text of an SSDP response into its headers.
 * @param {string} text raw response, e.g. 'HTTP/1.1 200 OK\r\nST: …\r\nLOCATION: …\r\n\r\n'
 * @returns {Record<string, string>} headers, keyed by lower-case name
 */
export function parseRawHeaders(text) {
  const headers = {};
  if (typeof text !== 'string') {
    return headers;
  }
  // The first line is the status line; it has no header.
  for (const line of text.split(/\r?\n/).slice(1)) {
    const separator = line.indexOf(':');
    if (separator <= 0) {
      continue;
    }
    const name = line.slice(0, separator).trim().toLowerCase();
    headers[name] = line.slice(separator + 1).trim();
  }
  return headers;
}

/**
 * Does this responder advertise an Internet Gateway Device (or one of its WAN
 * sub-devices/services)?
 * @param {Record<string, string>} headers lower-case keyed headers
 * @returns {boolean}
 */
function isIgdResponder(headers) {
  const haystack = [headers.st, headers.nt, headers.usn, headers.server].filter(Boolean).join(' ');
  return IGD_SSDP_TOKENS.some((token) => haystack.includes(token));
}

/**
 * Parse raw SSDP scan results into the unique IGD gateways found.
 * @param {Array<{ headers: string }>} results raw responders from scanNetwork('ssdp')
 * @returns {Array<{ location: string, udn: string|null }>} one entry per unique LOCATION
 */
export function parseSsdpResults(results = []) {
  const byLocation = new Map();
  for (const result of results) {
    const headers = parseRawHeaders(result && result.headers);
    if (!isIgdResponder(headers)) {
      continue;
    }
    const { location } = headers;
    if (!location || byLocation.has(location)) {
      continue;
    }
    // USN looks like `uuid:<id>::urn:…`; keep the uuid part when present.
    const udnMatch = /uuid:([^:]+)/i.exec(headers.usn || '');
    byLocation.set(location, { location, udn: udnMatch ? udnMatch[1] : null });
  }
  return [...byLocation.values()];
}
