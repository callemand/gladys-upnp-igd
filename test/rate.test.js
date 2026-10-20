import test from 'node:test';
import assert from 'node:assert/strict';

import { computeRates } from '../src/upnp/rate.js';

test('computeRates returns nothing on the first poll', () => {
  assert.deepEqual(computeRates(undefined, { at: 1000, bytesSent: 10, bytesReceived: 20 }), {});
});

test('computeRates turns two readings into Mbit/s', () => {
  const rates = computeRates(
    { at: 0, uptime: 100, bytesSent: 1_000_000, bytesReceived: 10_000_000 },
    // 15 s later: 3.75 MB received (= 2 Mbit/s), 1.875 MB sent (= 1 Mbit/s)
    { at: 15_000, uptime: 115, bytesSent: 2_875_000, bytesReceived: 13_750_000 },
  );
  assert.deepEqual(rates, { downloadRate: 2, uploadRate: 1 });
});

test('computeRates handles a counter that wrapped back to 0 once', () => {
  const rates = computeRates(
    { at: 0, bytesReceived: 4294967295 - 999_999 },
    // 1 000 000 bytes before the wrap + 875 000 after = 1 875 000 bytes in 15 s
    { at: 15_000, bytesReceived: 875_000 },
  );
  assert.deepEqual(rates, { downloadRate: 1 });
});

test('computeRates skips a box that rebooted (uptime went down)', () => {
  const rates = computeRates(
    { at: 0, uptime: 5000, bytesSent: 900_000_000, bytesReceived: 900_000_000 },
    { at: 15_000, uptime: 10, bytesSent: 1000, bytesReceived: 1000 },
  );
  assert.deepEqual(rates, {});
});

test('computeRates drops an impossible rate (counter reset without uptime)', () => {
  const rates = computeRates(
    { at: 0, bytesReceived: 900_000_000 },
    // Looks like a wrap, but would mean ~1.8 Gbit/s... over 1 s: 3.4 Tbit/s.
    { at: 1000, bytesReceived: 1000 },
  );
  assert.deepEqual(rates, {});
});

test('computeRates skips a missing (or stuck) counter and a zero time gap', () => {
  assert.deepEqual(
    computeRates(
      { at: 0, bytesSent: 100, bytesReceived: undefined },
      { at: 15_000, bytesSent: 100, bytesReceived: undefined },
    ),
    { uploadRate: 0 },
  );
  assert.deepEqual(
    computeRates({ at: 1000, bytesSent: 1 }, { at: 1000, bytesSent: 2 }),
    {},
    'no time between the readings',
  );
});
