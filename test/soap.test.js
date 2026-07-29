import test from 'node:test';
import assert from 'node:assert/strict';

import { extractTag, parseDescription, toAbsoluteUrl } from '../src/upnp/soap.js';
import { BOX_FRIENDLY_NAME, BOX_UDN, SERVICE_TYPES, buildDescriptionXml } from './fixtures.js';

test('extractTag reads inner text and tolerates namespace prefixes', () => {
  assert.equal(extractTag('<NewUptime>42</NewUptime>', 'NewUptime'), '42');
  assert.equal(extractTag('<u:NewUptime>42</u:NewUptime>', 'NewUptime'), '42');
  assert.equal(extractTag('<a><NewX> spaced </NewX></a>', 'NewX'), 'spaced');
  assert.equal(extractTag('<other>x</other>', 'NewUptime'), undefined);
});

test('toAbsoluteUrl resolves relative control URLs against a base', () => {
  const base = 'http://192.168.1.1:5000/rootDesc.xml';
  assert.equal(toAbsoluteUrl(base, '/ctl/common'), 'http://192.168.1.1:5000/ctl/common');
  assert.equal(toAbsoluteUrl(base, 'http://1.2.3.4/x'), 'http://1.2.3.4/x');
});

test('parseDescription walks the nested device tree and finds the WAN services', () => {
  const url = 'http://192.168.1.1:5000/rootDesc.xml';
  const desc = parseDescription(buildDescriptionXml(), url);

  assert.equal(desc.friendlyName, BOX_FRIENDLY_NAME);
  assert.equal(desc.udn, BOX_UDN);

  const common = desc.services.find((s) => s.serviceType === SERVICE_TYPES.COMMON);
  const ip = desc.services.find((s) => s.serviceType === SERVICE_TYPES.IP);
  assert.ok(common, 'WANCommonInterfaceConfig found despite nesting');
  assert.ok(ip, 'WANIPConnection found despite deeper nesting');
  assert.equal(common.controlURL, 'http://192.168.1.1:5000/ctl/common');
  assert.equal(ip.controlURL, 'http://192.168.1.1:5000/ctl/ipconn');
});
