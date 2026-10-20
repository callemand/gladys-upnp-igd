import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBoxFeatures, buildPollStates } from '../src/devices/box.js';
import { FEATURE_CODES } from '../src/constants.js';

const ids = { feature: (code) => `ext:test:box:abc:${code}` };

test('buildBoxFeatures declares the seven read-only WAN features', () => {
  const features = buildBoxFeatures(ids);
  assert.deepEqual(
    features.map((f) => f.external_id.split(':').pop()),
    [
      'connection-status',
      'external-ip',
      'uptime',
      'download-rate',
      'upload-rate',
      'packets-sent',
      'packets-received',
    ],
  );
  assert.ok(features.every((f) => f.read_only === true));
  // Gladys core requires has_feedback / min / max to be non-null on every feature.
  assert.ok(
    features.every(
      (f) => f.has_feedback === false && typeof f.min === 'number' && typeof f.max === 'number',
    ),
    'every feature declares has_feedback, min and max',
  );
});

test('buildPollStates maps a full status, using text for the IP, never the raw bytes', () => {
  const states = buildPollStates(ids, {
    connectionStatus: 1,
    uptime: 3600,
    bytesSent: 10,
    bytesReceived: 20,
    downloadRate: 12.5,
    uploadRate: 3.25,
    packetsSent: 30,
    packetsReceived: 40,
    externalIp: '203.0.113.42',
  });
  assert.deepEqual(states, [
    { device_feature_external_id: 'ext:test:box:abc:connection-status', state: 1 },
    { device_feature_external_id: 'ext:test:box:abc:uptime', state: 3600 },
    { device_feature_external_id: 'ext:test:box:abc:download-rate', state: 12.5 },
    { device_feature_external_id: 'ext:test:box:abc:upload-rate', state: 3.25 },
    { device_feature_external_id: 'ext:test:box:abc:packets-sent', state: 30 },
    { device_feature_external_id: 'ext:test:box:abc:packets-received', state: 40 },
    { device_feature_external_id: 'ext:test:box:abc:external-ip', text: '203.0.113.42' },
  ]);
});

test('buildPollStates skips missing / non-finite values', () => {
  const states = buildPollStates(ids, {
    connectionStatus: 0,
    bytesSent: undefined,
    externalIp: '',
  });
  assert.deepEqual(states, [
    { device_feature_external_id: `ext:test:box:abc:${FEATURE_CODES.CONNECTION_STATUS}`, state: 0 },
  ]);
});

test('buildPollStates on an empty status yields no state', () => {
  assert.deepEqual(buildPollStates(ids, {}), []);
  assert.deepEqual(buildPollStates(ids), []);
});
