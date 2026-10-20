import test from 'node:test';
import assert from 'node:assert/strict';

import { parseRawHeaders, parseSsdpResults } from '../src/upnp/discovery.js';
import { BOX_UDN, buildSsdpResult, buildSsdpResults } from './fixtures.js';

test('parseSsdpResults keeps only IGD responders and dedupes by LOCATION', () => {
  const location = 'http://192.168.1.1:5000/rootDesc.xml';
  const gateways = parseSsdpResults(buildSsdpResults(location));

  assert.equal(gateways.length, 1, 'the two IGD responders collapse to one, the TV is dropped');
  assert.equal(gateways[0].location, location);
  assert.equal(gateways[0].udn, BOX_UDN.replace('uuid:', ''));
});

test('parseSsdpResults matches headers case-insensitively', () => {
  const gateways = parseSsdpResults([
    buildSsdpResult('10.0.0.1', {
      st: 'urn:schemas-upnp-org:device:InternetGatewayDevice:1',
      Location: 'http://10.0.0.1/desc.xml',
    }),
  ]);
  assert.deepEqual(gateways, [{ location: 'http://10.0.0.1/desc.xml', udn: null }]);
});

test('parseSsdpResults reads a real Livebox response (IGD:2, LF line ends)', () => {
  const gateways = parseSsdpResults([
    {
      source_ip: '192.168.1.1',
      source_port: 1900,
      headers: [
        'HTTP/1.1 200 OK',
        'LOCATION: http://192.168.1.1:60000/c2f16eca/gatedesc.xml',
        'SERVER: Unspecified, UPnP/1.0, SoftAtHome',
        'ST: urn:schemas-upnp-org:device:InternetGatewayDevice:2',
        'USN: uuid:c2f16eca-f3ef-3be8-8ea7-024b3762394c::urn:schemas-upnp-org:device:InternetGatewayDevice:2',
        '',
        '',
      ].join('\n'),
    },
  ]);
  assert.deepEqual(gateways, [
    {
      location: 'http://192.168.1.1:60000/c2f16eca/gatedesc.xml',
      udn: 'c2f16eca-f3ef-3be8-8ea7-024b3762394c',
    },
  ]);
});

test('parseSsdpResults returns nothing when no IGD is present', () => {
  assert.deepEqual(
    parseSsdpResults([buildSsdpResult('10.0.0.2', { ST: 'urn:foo:bar', LOCATION: 'http://x/y' })]),
    [],
  );
  assert.deepEqual(parseSsdpResults([{ source_ip: '10.0.0.3' }]), []);
  assert.deepEqual(parseSsdpResults([]), []);
  assert.deepEqual(parseSsdpResults(), []);
});

test('parseRawHeaders keeps the value after the first colon only', () => {
  const headers = parseRawHeaders(
    'HTTP/1.1 200 OK\r\nLOCATION: http://10.0.0.1:5000/a.xml\r\n\r\n',
  );
  assert.deepEqual(headers, { location: 'http://10.0.0.1:5000/a.xml' });
  assert.deepEqual(parseRawHeaders(undefined), {});
});
