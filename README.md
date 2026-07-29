# Gladys UPnP / IGD integration

External [Gladys Assistant](https://gladysassistant.com) integration that reads
your internet box statistics over **UPnP-IGD** (Internet Gateway Device) and
exposes them as a read-only Gladys device: WAN connection status, external IP,
connection uptime, and byte/packet traffic counters.

It is a standalone repository packaged as a Docker image that talks to Gladys
via the [`@gladysassistant/integration-sdk`](https://www.npmjs.com/package/@gladysassistant/integration-sdk).

## How it works

- **Discovery** — the box is found through a mediated **SSDP** scan run by the
  Gladys core (the container is on a bridge network and never sees SSDP
  multicast itself). An optional `description_url` config field is a manual
  fallback when auto-discovery finds nothing.
- **Polling** — the integration fetches the box's UPnP device description, walks
  the (nested) device tree to locate the `WANCommonInterfaceConfig` and
  `WANIPConnection`/`WANPPPConnection` services, and reads their status over SOAP.
- Every feature is **read-only** — a box exposes only statistics over IGD.

## Development

```bash
npm install
npm run lint
npm run format:check
npm test          # unit tests + an end-to-end test booting index.js
```

The end-to-end test (`test/e2e.test.js`) boots the real `index.js` against a
fake Gladys host (WebSocket + REST, including the mediated SSDP scan endpoint)
and a fake IGD box (HTTP serving the description + SOAP), with no network access.

## Requirements

- Gladys Assistant **>= 4.84** (the external-integrations system with mediated
  network discovery).
- UPnP/IGD enabled on your box.

## License

Apache-2.0
