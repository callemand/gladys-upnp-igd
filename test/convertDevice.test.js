import test from 'node:test';
import assert from 'node:assert/strict';

import {
  boxExternalIds,
  convertDevice,
  gatewayPlatformId,
  getDescriptionUrl,
} from '../src/devices/convertDevice.js';
import { POLL_FREQUENCY } from '../src/constants.js';

// Minimal fake of gladys.externalIds() (same scheme as the SDK).
const SELECTOR = 'upnp-igd-test';
const gladys = {
  externalIds(type, platformId) {
    const device = `ext:${SELECTOR}:${type}:${platformId}`;
    return { device, feature: (key) => `${device}:${key}` };
  },
};

test('gatewayPlatformId strips uuid: and colons, falls back to the host', () => {
  assert.equal(
    gatewayPlatformId({ udn: 'uuid:2f402f80-da50-11e1-9b23-001788255acc', descriptionUrl: 'x' }),
    '2f402f80-da50-11e1-9b23-001788255acc',
  );
  assert.equal(
    gatewayPlatformId({ udn: null, descriptionUrl: 'http://192.168.1.1:5000/rootDesc.xml' }),
    'host-192-168-1-1-5000',
  );
});

test('convertDevice builds a stable external_id scheme and stores the description URL', () => {
  const gateway = {
    descriptionUrl: 'http://192.168.1.1:5000/rootDesc.xml',
    friendlyName: 'My Internet Box',
    udn: 'uuid:2f402f80-da50-11e1-9b23-001788255acc',
  };
  const device = convertDevice(gladys, gateway);

  assert.equal(device.external_id, `ext:${SELECTOR}:box:2f402f80-da50-11e1-9b23-001788255acc`);
  assert.equal(device.name, 'My Internet Box');
  assert.equal(device.should_poll, true);
  assert.equal(device.poll_frequency, POLL_FREQUENCY);
  assert.deepEqual(device.params, [
    { name: 'descriptionUrl', value: gateway.descriptionUrl },
    { name: 'udn', value: gateway.udn },
  ]);
  // Every feature carries a selector equal to its external_id.
  assert.ok(device.features.every((f) => f.selector === f.external_id));
  assert.ok(device.features.every((f) => f.external_id.startsWith(`ext:${SELECTOR}:box:`)));
});

test('convertDevice falls back to a default name', () => {
  const device = convertDevice(gladys, {
    descriptionUrl: 'http://10.0.0.1/desc.xml',
    friendlyName: null,
    udn: null,
  });
  assert.equal(device.name, 'Internet box');
  assert.equal(device.external_id, `ext:${SELECTOR}:box:host-10-0-0-1`);
});

test('getDescriptionUrl reads the param, throws when missing', () => {
  const ids = boxExternalIds(gladys, 'abc');
  assert.equal(
    getDescriptionUrl({
      external_id: ids.device,
      params: [{ name: 'descriptionUrl', value: 'http://x/d.xml' }],
    }),
    'http://x/d.xml',
  );
  assert.throws(
    () => getDescriptionUrl({ external_id: ids.device, params: [] }),
    /has no "descriptionUrl" param/,
  );
});
