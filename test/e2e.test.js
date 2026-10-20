// End-to-end test: boots the REAL integration process (index.js) against a
// fake Gladys host (WebSocket + REST, same contract as the SDK) and a fake IGD
// box (HTTP serving the description + SOAP), then exercises discovery (via a
// mediated SSDP scan), poll and the read-only set-value rejection.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

import {
  BOX_STATUS_VALUES,
  SERVICE_TYPES,
  buildDescriptionXml,
  buildSsdpResults,
  soapResponse,
  statusInfoResponse,
} from './fixtures.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SELECTOR = 'upnp-igd-test';
const TOKEN = 'test-token';
const BOX_PLATFORM_ID = '2f402f80-da50-11e1-9b23-001788255acc';

async function waitUntil(predicate, what, timeoutMs = 10000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for ${what}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

// --- Fake IGD box (description + SOAP) ---------------------------------------
function startFakeBox() {
  const server = createServer((req, res) => {
    req.on('data', () => {});
    req.on('end', () => {
      if (req.method === 'GET' && req.url === '/rootDesc.xml') {
        res.writeHead(200, { 'Content-Type': 'text/xml' });
        res.end(buildDescriptionXml());
        return;
      }
      if (req.method === 'POST') {
        const action = /#(\w+)"/.exec(req.headers.soapaction)[1];
        const responses = {
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
        res.writeHead(200, { 'Content-Type': 'text/xml' });
        res.end(responses[action] || '<?xml version="1.0"?><empty/>');
        return;
      }
      res.writeHead(404);
      res.end();
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

// --- Fake Gladys host (REST + WebSocket) -------------------------------------
function startFakeGladys(ssdpLocation) {
  const state = { discoveredDevicePosts: [], statePosts: [], commandResults: [], ws: null };
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      const respond = (json) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(json));
      };
      if (req.method === 'GET' && req.url === '/api/integration/v1/device') {
        respond([]);
      } else if (req.method === 'GET' && req.url === '/api/integration/v1/config') {
        respond({ config: { description_url: '' } });
      } else if (
        req.method === 'POST' &&
        req.url === '/api/integration/v1/network_discovery/scan'
      ) {
        respond(buildSsdpResults(ssdpLocation));
      } else if (req.method === 'POST' && req.url === '/api/integration/v1/discovered_device') {
        const parsed = JSON.parse(body);
        state.discoveredDevicePosts.push(parsed.devices);
        respond({ success: true, count: parsed.devices.length });
      } else if (req.method === 'POST' && req.url === '/api/integration/v1/state') {
        state.statePosts.push(JSON.parse(body).states);
        respond({ success: true });
      } else {
        res.writeHead(404);
        res.end();
      }
    });
  });
  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws) => {
    state.ws = ws;
    ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === 'authenticate.integration-request' && message.payload.token === TOKEN) {
        ws.send(JSON.stringify({ type: 'authentication.connected', payload: {} }));
      }
      if (message.type === 'external-integration.command-result') {
        state.commandResults.push(message.payload);
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, state, port: server.address().port }));
  });
}

test('the integration discovers via SSDP, polls the box, and rejects writes', async (t) => {
  const box = await startFakeBox();
  const boxDescriptionUrl = `http://127.0.0.1:${box.port}/rootDesc.xml`;
  const gladys = await startFakeGladys(boxDescriptionUrl);
  t.after(() => {
    box.server.close();
    gladys.server.close();
  });

  let output = '';
  const child = spawn(process.execPath, ['index.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      GLADYS_HOST_API_URL: `http://127.0.0.1:${gladys.port}`,
      GLADYS_INTEGRATION_TOKEN: TOKEN,
      GLADYS_INTEGRATION_SELECTOR: SELECTOR,
      LOG_LEVEL: 'debug',
    },
  });
  child.stdout.on('data', (d) => {
    output += d;
  });
  child.stderr.on('data', (d) => {
    output += d;
  });
  t.after(() => child.kill('SIGKILL'));

  const send = (type, payload) => gladys.state.ws.send(JSON.stringify({ type, payload }));
  const deviceExternalId = `ext:${SELECTOR}:box:${BOX_PLATFORM_ID}`;

  await t.test('on connection: SSDP-discovers the box and publishes it', async () => {
    await waitUntil(
      () => gladys.state.discoveredDevicePosts.length >= 1,
      `initial discovery\n${output}`,
    );
    const devices = gladys.state.discoveredDevicePosts.at(-1);
    assert.equal(devices.length, 1);
    const boxDevice = devices[0];
    assert.equal(boxDevice.external_id, deviceExternalId);
    assert.equal(boxDevice.name, 'My Internet Box');
    assert.equal(boxDevice.should_poll, true);
    assert.deepEqual(
      boxDevice.features.map((f) => f.external_id.split(':').pop()),
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
    const urlParam = boxDevice.params.find((p) => p.name === 'descriptionUrl');
    assert.equal(urlParam.value, boxDescriptionUrl);
  });

  const pollDevice = {
    external_id: deviceExternalId,
    params: [{ name: 'descriptionUrl', value: boxDescriptionUrl }],
  };

  await t.test('a poll command publishes the WAN states', async () => {
    send('external-integration.device.poll', { message_id: 'poll-1', device: pollDevice });
    await waitUntil(
      () => gladys.state.commandResults.some((r) => r.message_id === 'poll-1'),
      `poll ack\n${output}`,
    );
    const ack = gladys.state.commandResults.find((r) => r.message_id === 'poll-1');
    assert.equal(ack.success, true, ack.error);

    const states = gladys.state.statePosts.at(-1);
    const byCode = Object.fromEntries(
      states.map((s) => [s.device_feature_external_id.split(':').pop(), s.state ?? s.text]),
    );
    // First poll: no previous reading yet, so no rate and never the raw bytes.
    assert.deepEqual(byCode, {
      'connection-status': 1,
      uptime: 3600,
      'packets-sent': BOX_STATUS_VALUES.packetsSent,
      'packets-received': BOX_STATUS_VALUES.packetsReceived,
      'external-ip': BOX_STATUS_VALUES.externalIp,
    });
  });

  await t.test('a second poll publishes the data rates', async () => {
    send('external-integration.device.poll', { message_id: 'poll-2', device: pollDevice });
    await waitUntil(
      () => gladys.state.commandResults.some((r) => r.message_id === 'poll-2'),
      `second poll ack\n${output}`,
    );
    const states = gladys.state.statePosts.at(-1);
    const byCode = Object.fromEntries(
      states.map((s) => [s.device_feature_external_id.split(':').pop(), s.state ?? s.text]),
    );
    // The fake box counters do not move between the two polls.
    assert.equal(byCode['download-rate'], 0);
    assert.equal(byCode['upload-rate'], 0);
  });

  await t.test('a set-value command is acked as failed (features are read-only)', async () => {
    send('external-integration.device.set-value', {
      message_id: 'set-1',
      device: pollDevice,
      device_feature: {
        external_id: `${deviceExternalId}:connection-status`,
        category: 'switch',
        type: 'binary',
      },
      value: 1,
    });
    await waitUntil(
      () => gladys.state.commandResults.some((r) => r.message_id === 'set-1'),
      `set ack\n${output}`,
    );
    const ack = gladys.state.commandResults.find((r) => r.message_id === 'set-1');
    assert.equal(ack.success, false);
    assert.match(ack.error, /read-only/);
  });

  await t.test('a scan request republishes the box', async () => {
    const before = gladys.state.discoveredDevicePosts.length;
    send('external-integration.scan-request', {});
    await waitUntil(
      () => gladys.state.discoveredDevicePosts.length > before,
      `scan republish\n${output}`,
    );
    assert.equal(gladys.state.discoveredDevicePosts.at(-1).length, 1);
  });
});
