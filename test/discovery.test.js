import test from 'node:test';
import assert from 'node:assert/strict';

import { parseSsdpResults } from '../src/upnp/discovery.js';
import { BOX_UDN, buildSsdpResults } from './fixtures.js';

test('parseSsdpResults keeps only IGD responders and dedupes by LOCATION', () => {
  const location = 'http://192.168.1.1:5000/rootDesc.xml';
  const gateways = parseSsdpResults(buildSsdpResults(location));

  assert.equal(gateways.length, 1, 'the two IGD responders collapse to one, the TV is dropped');
  assert.equal(gateways[0].location, location);
  assert.equal(gateways[0].udn, BOX_UDN.replace('uuid:', ''));
});

test('parseSsdpResults matches headers case-insensitively', () => {
  const gateways = parseSsdpResults([
    {
      st: 'urn:schemas-upnp-org:device:InternetGatewayDevice:1',
      location: 'http://10.0.0.1/desc.xml',
    },
  ]);
  assert.deepEqual(gateways, [{ location: 'http://10.0.0.1/desc.xml', udn: null }]);
});

test('parseSsdpResults returns nothing when no IGD is present', () => {
  assert.deepEqual(parseSsdpResults([{ ST: 'urn:foo:bar', LOCATION: 'http://x/y' }]), []);
  assert.deepEqual(parseSsdpResults([]), []);
  assert.deepEqual(parseSsdpResults(), []);
});
