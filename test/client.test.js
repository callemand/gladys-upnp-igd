import test from 'node:test';
import assert from 'node:assert/strict';

import { findService, getBoxStatus, pickWanConnectionService } from '../src/upnp/client.js';
import {
  BOX_STATUS_VALUES,
  SERVICE_TYPES,
  soapFault,
  soapResponse,
  statusInfoResponse,
} from './fixtures.js';

const GATEWAY = {
  services: [
    { serviceType: SERVICE_TYPES.COMMON, controlURL: 'http://box/ctl/common' },
    { serviceType: SERVICE_TYPES.IP, controlURL: 'http://box/ctl/ipconn' },
  ],
};

test('findService / pickWanConnectionService match by substring', () => {
  assert.equal(
    findService(GATEWAY.services, 'WANCommonInterfaceConfig').controlURL,
    'http://box/ctl/common',
  );
  assert.equal(pickWanConnectionService(GATEWAY.services).controlURL, 'http://box/ctl/ipconn');
  assert.equal(pickWanConnectionService([]), undefined);
});

// Route a fake SOAP request by its SOAPACTION header to the right response.
function fakeFetch(overrides = {}) {
  return async (url, options) => {
    const action = /#(\w+)"/.exec(options.headers.SOAPACTION)[1];
    if (overrides[action]) {
      return overrides[action];
    }
    const map = {
      GetTotalBytesSent: soapResponse(
        SERVICE_TYPES.COMMON,
        'GetTotalBytesSent',
        'NewTotalBytesSent',
        BOX_STATUS_VALUES.bytesSent,
      ),
      GetTotalBytesReceived: soapResponse(
        SERVICE_TYPES.COMMON,
        'GetTotalBytesReceived',
        'NewTotalBytesReceived',
        BOX_STATUS_VALUES.bytesReceived,
      ),
      GetTotalPacketsSent: soapResponse(
        SERVICE_TYPES.COMMON,
        'GetTotalPacketsSent',
        'NewTotalPacketsSent',
        BOX_STATUS_VALUES.packetsSent,
      ),
      GetTotalPacketsReceived: soapResponse(
        SERVICE_TYPES.COMMON,
        'GetTotalPacketsReceived',
        'NewTotalPacketsReceived',
        BOX_STATUS_VALUES.packetsReceived,
      ),
      GetStatusInfo: statusInfoResponse(
        SERVICE_TYPES.IP,
        BOX_STATUS_VALUES.connectionStatus,
        BOX_STATUS_VALUES.uptime,
      ),
      GetExternalIPAddress: soapResponse(
        SERVICE_TYPES.IP,
        'GetExternalIPAddress',
        'NewExternalIPAddress',
        BOX_STATUS_VALUES.externalIp,
      ),
    };
    return { ok: true, status: 200, text: async () => map[action] };
  };
}

test('getBoxStatus reads and maps every WAN field', async (t) => {
  const original = global.fetch;
  global.fetch = fakeFetch();
  t.after(() => {
    global.fetch = original;
  });

  const status = await getBoxStatus(GATEWAY);
  assert.deepEqual(status, {
    bytesSent: 123456789,
    bytesReceived: 987654321,
    packetsSent: 100000,
    packetsReceived: 200000,
    connectionStatus: 1, // "Connected" -> 1
    uptime: 3600,
    externalIp: '203.0.113.42',
  });
});

test('getBoxStatus maps a disconnected link to 0 and tolerates a failing action', async (t) => {
  const original = global.fetch;
  global.fetch = fakeFetch({
    GetStatusInfo: {
      ok: true,
      status: 200,
      text: async () => statusInfoResponse(SERVICE_TYPES.IP, 'Disconnected', 0),
    },
    // A box that refuses the packets counter returns a SOAP fault.
    GetTotalPacketsSent: {
      ok: false,
      status: 500,
      text: async () => soapFault(602, 'Invalid Action'),
    },
  });
  t.after(() => {
    global.fetch = original;
  });

  const status = await getBoxStatus(GATEWAY);
  assert.equal(status.connectionStatus, 0);
  assert.equal(status.uptime, 0);
  assert.equal(status.packetsSent, undefined, 'a failed action leaves its field undefined');
  assert.equal(status.bytesSent, 123456789, 'the other counters are still read');
});

test('getBoxStatus skips a service the box does not expose', async (t) => {
  const original = global.fetch;
  global.fetch = fakeFetch();
  t.after(() => {
    global.fetch = original;
  });

  // Only the common-interface service is present: no link info at all.
  const status = await getBoxStatus({
    services: [{ serviceType: SERVICE_TYPES.COMMON, controlURL: 'http://box/ctl/common' }],
  });
  assert.equal(status.connectionStatus, undefined);
  assert.equal(status.externalIp, undefined);
  assert.equal(status.bytesReceived, 987654321);
});
