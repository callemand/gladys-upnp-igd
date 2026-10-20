// Shared fixtures for the UPnP/IGD tests: a realistic (nested) IGD device
// description, SOAP response builders, and raw SSDP scan results.

export const BOX_UDN = 'uuid:2f402f80-da50-11e1-9b23-001788255acc';
export const BOX_FRIENDLY_NAME = 'My Internet Box';

// Full serviceType urns as a real box advertises them.
export const SERVICE_TYPES = {
  COMMON: 'urn:schemas-upnp-org:service:WANCommonInterfaceConfig:1',
  IP: 'urn:schemas-upnp-org:service:WANIPConnection:1',
};

/**
 * A rootDesc.xml with the WAN services nested two levels deep inside
 * <deviceList> — exactly the structure that trips up the naive UPnP libraries.
 * controlURLs are relative, to exercise toAbsoluteUrl().
 */
export function buildDescriptionXml({
  commonControl = '/ctl/common',
  ipControl = '/ctl/ipconn',
} = {}) {
  return `<?xml version="1.0"?>
<root xmlns="urn:schemas-upnp-org:device-1-0">
  <specVersion><major>1</major><minor>0</minor></specVersion>
  <device>
    <deviceType>urn:schemas-upnp-org:device:InternetGatewayDevice:1</deviceType>
    <friendlyName>${BOX_FRIENDLY_NAME}</friendlyName>
    <manufacturer>Acme</manufacturer>
    <UDN>${BOX_UDN}</UDN>
    <serviceList>
      <service>
        <serviceType>urn:schemas-upnp-org:service:Layer3Forwarding:1</serviceType>
        <serviceId>urn:upnp-org:serviceId:L3Forwarding1</serviceId>
        <controlURL>/ctl/L3F</controlURL>
        <eventSubURL>/evt/L3F</eventSubURL>
        <SCPDURL>/L3F.xml</SCPDURL>
      </service>
    </serviceList>
    <deviceList>
      <device>
        <deviceType>urn:schemas-upnp-org:device:WANDevice:1</deviceType>
        <friendlyName>WANDevice</friendlyName>
        <UDN>uuid:wandevice</UDN>
        <serviceList>
          <service>
            <serviceType>${SERVICE_TYPES.COMMON}</serviceType>
            <serviceId>urn:upnp-org:serviceId:WANCommonIFC1</serviceId>
            <controlURL>${commonControl}</controlURL>
            <eventSubURL>/evt/common</eventSubURL>
            <SCPDURL>/common.xml</SCPDURL>
          </service>
        </serviceList>
        <deviceList>
          <device>
            <deviceType>urn:schemas-upnp-org:device:WANConnectionDevice:1</deviceType>
            <friendlyName>WANConnectionDevice</friendlyName>
            <UDN>uuid:wanconn</UDN>
            <serviceList>
              <service>
                <serviceType>${SERVICE_TYPES.IP}</serviceType>
                <serviceId>urn:upnp-org:serviceId:WANIPConn1</serviceId>
                <controlURL>${ipControl}</controlURL>
                <eventSubURL>/evt/ipconn</eventSubURL>
                <SCPDURL>/ipconn.xml</SCPDURL>
              </service>
            </serviceList>
          </device>
        </deviceList>
      </device>
    </deviceList>
  </device>
</root>`;
}

/** Build a SOAP action response with one output tag. */
export function soapResponse(serviceType, action, outputTag, value) {
  return `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:${action}Response xmlns:u="${serviceType}">
      <${outputTag}>${value}</${outputTag}>
    </u:${action}Response>
  </s:Body>
</s:Envelope>`;
}

/** GetStatusInfo response (two outputs). */
export function statusInfoResponse(serviceType, connectionStatus, uptime) {
  return `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:GetStatusInfoResponse xmlns:u="${serviceType}">
      <NewConnectionStatus>${connectionStatus}</NewConnectionStatus>
      <NewLastConnectionError>ERROR_NONE</NewLastConnectionError>
      <NewUptime>${uptime}</NewUptime>
    </u:GetStatusInfoResponse>
  </s:Body>
</s:Envelope>`;
}

/** A SOAP fault body (HTTP 500). */
export function soapFault(errorCode, errorDescription) {
  return `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body><s:Fault><detail><UPnPError xmlns="urn:schemas-upnp-org:control-1-0">
    <errorCode>${errorCode}</errorCode>
    <errorDescription>${errorDescription}</errorDescription>
  </UPnPError></detail></s:Fault></s:Body>
</s:Envelope>`;
}

// Values the fake box reports.
export const BOX_STATUS_VALUES = {
  bytesSent: 123456789,
  bytesReceived: 987654321,
  packetsSent: 100000,
  packetsReceived: 200000,
  connectionStatus: 'Connected',
  uptime: 3600,
  externalIp: '203.0.113.42',
};

/**
 * Build one SSDP result in the shape the core returns it: the responder
 * address, plus the raw HTTP response text in `headers`.
 * @param {string} sourceIp responder IP
 * @param {Record<string, string>} headers header name -> value
 * @returns {{ source_ip: string, source_port: number, headers: string }}
 */
export function buildSsdpResult(sourceIp, headers) {
  const lines = Object.entries(headers).map(([name, value]) => `${name}: ${value}`);
  return {
    source_ip: sourceIp,
    source_port: 1900,
    headers: ['HTTP/1.1 200 OK', 'CACHE-CONTROL: max-age=1800', ...lines, '', ''].join('\r\n'),
  };
}

/**
 * Raw SSDP scan results as the core returns them: several responders sharing
 * one LOCATION, plus an unrelated device that must be filtered out.
 */
export function buildSsdpResults(location) {
  return [
    buildSsdpResult('192.168.1.1', {
      ST: 'urn:schemas-upnp-org:device:InternetGatewayDevice:1',
      USN: `${BOX_UDN}::urn:schemas-upnp-org:device:InternetGatewayDevice:1`,
      LOCATION: location,
      SERVER: 'Linux/3.4 UPnP/1.1 MiniUPnPd/2.1',
    }),
    buildSsdpResult('192.168.1.1', {
      ST: 'urn:schemas-upnp-org:service:WANIPConnection:1',
      USN: `${BOX_UDN}::urn:schemas-upnp-org:service:WANIPConnection:1`,
      LOCATION: location,
    }),
    buildSsdpResult('192.168.1.50', {
      ST: 'urn:dial-multiscreen-org:service:dial:1',
      USN: 'uuid:some-tv::urn:dial-multiscreen-org:service:dial:1',
      LOCATION: 'http://192.168.1.50:8008/ssdp/device-desc.xml',
    }),
  ];
}
