# UPnP / IGD

## Overview

This integration connects Gladys Assistant to your **internet box / router**
through the **UPnP-IGD** (Internet Gateway Device) protocol that almost every
home box exposes on the local network. It turns your box into a Gladys device
whose read-only features let you graph its traffic, chart your line and trigger
scenes on the WAN link state (for example, be notified when your connection
drops).

## Discovery

The integration finds your box automatically using an **SSDP** network scan run
by the Gladys core. Open the Gladys **Discovery** screen and your box appears —
add it, and it starts reporting.

If auto-discovery finds nothing (some boxes disable UPnP, or the scan cannot
reach them), you can fill in the optional **Box description URL** setting with
your box's UPnP device description URL (something like
`http://192.168.1.1:5000/rootDesc.xml`) and run Discovery again.

## Features

Each box exposes these read-only features:

- **Connection status** — whether the WAN link is up or down;
- **External IP** — your public internet IP address;
- **Uptime** — how long the internet connection has been up (seconds);
- **Bytes sent** / **Bytes received** — total traffic counters;
- **Packets sent** / **Packets received** — total packet counters.

## Notes

- The byte and packet counters come straight from the box's IGD service. On many
  boxes these counters are **32-bit and wrap back to zero at ~4 GB** — the raw
  value is reported as-is, so expect the graph to reset periodically on those
  boxes.
- Nothing is controllable: a box exposes only statistics over IGD, so every
  feature is read-only.
- UPnP/IGD must be **enabled** on your box (it usually is by default).
