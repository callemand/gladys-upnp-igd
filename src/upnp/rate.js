// -----------------------------------------------------------------------------
// WAN data rate, computed from two readings of the byte counters.
//
// IGD byte counters are 32-bit totals. Their raw value means little: on most
// boxes it wraps back to 0 every ~4.29 GB. The useful value is the difference
// between two polls, divided by the time between them.
//
// Limits:
//   - a counter can wrap once between two polls; we handle that. If it wraps
//     twice, the result is wrong. At one poll every 15 s, this happens only
//     above ~2.29 Gbit/s on average.
//   - a box reboot also resets the counters. We detect it with the uptime, and
//     we drop any rate above MAX_RATE_MBPS as a last guard.
// -----------------------------------------------------------------------------

import { MAX_RATE_MBPS, UI4_MODULO } from '../constants.js';

/**
 * Compute one rate in Mbit/s, or undefined when it cannot be trusted.
 * @param {number|undefined} previous previous counter value (bytes)
 * @param {number|undefined} current current counter value (bytes)
 * @param {number} elapsedSeconds time between the two readings
 * @returns {number|undefined} rate in Mbit/s, rounded to 2 decimals
 */
function rateMbps(previous, current, elapsedSeconds) {
  if (typeof previous !== 'number' || typeof current !== 'number') {
    return undefined;
  }
  let delta = current - previous;
  if (delta < 0) {
    // The counter went past its max and started again from 0.
    delta += UI4_MODULO;
  }
  const rate = (delta * 8) / elapsedSeconds / 1e6;
  if (rate > MAX_RATE_MBPS) {
    return undefined;
  }
  return Math.round(rate * 100) / 100;
}

/**
 * Compute the download and upload rates between two readings.
 * @param {{ at: number, uptime?: number, bytesSent?: number, bytesReceived?: number }|undefined} previous
 *   the previous reading (`at` is a timestamp in ms), or undefined on the first poll
 * @param {{ at: number, uptime?: number, bytesSent?: number, bytesReceived?: number }} current
 *   the current reading
 * @returns {{ downloadRate?: number, uploadRate?: number }} rates in Mbit/s
 */
export function computeRates(previous, current) {
  if (!previous) {
    return {};
  }
  const elapsedSeconds = (current.at - previous.at) / 1000;
  if (!(elapsedSeconds > 0)) {
    return {};
  }
  // A lower uptime means the box reconnected or rebooted: the counters restarted.
  if (
    typeof previous.uptime === 'number' &&
    typeof current.uptime === 'number' &&
    current.uptime < previous.uptime
  ) {
    return {};
  }
  const rates = {};
  const downloadRate = rateMbps(previous.bytesReceived, current.bytesReceived, elapsedSeconds);
  if (downloadRate !== undefined) {
    rates.downloadRate = downloadRate;
  }
  const uploadRate = rateMbps(previous.bytesSent, current.bytesSent, elapsedSeconds);
  if (uploadRate !== undefined) {
    rates.uploadRate = uploadRate;
  }
  return rates;
}
