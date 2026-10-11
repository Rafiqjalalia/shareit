import { NextResponse } from 'next/server';
import os from 'os';

export async function GET() {
  const interfaces = os.networkInterfaces();
  const validIps: { ip: string; name: string; priority: number }[] = [];

  for (const interfaceName of Object.keys(interfaces)) {
    const lowerName = interfaceName.toLowerCase();
    const netList = interfaces[interfaceName];
    if (!netList) continue;

    // Filter out virtual/internal adapters
    const isVirtual =
      lowerName.includes('vethernet') ||
      lowerName.includes('virtual') ||
      lowerName.includes('docker') ||
      lowerName.includes('vmware') ||
      lowerName.includes('bluetooth') ||
      lowerName.includes('wsl') ||
      lowerName.includes('loopback');

    for (const net of netList) {
      if (net.family === 'IPv4' && !net.internal) {
        // Skip 169.254.x.x (APIPA link-local)
        if (net.address.startsWith('169.254.')) continue;

        let priority = 1;
        // Prioritize Wi-Fi / WLAN / Wireless interfaces (common for mobile hotspot & local Wi-Fi)
        if (
          lowerName.includes('wi-fi') ||
          lowerName.includes('wifi') ||
          lowerName.includes('wireless') ||
          lowerName.includes('wlan')
        ) {
          priority = 10;
        } else if (lowerName.includes('ethernet') && !isVirtual) {
          priority = 8;
        } else if (isVirtual) {
          priority = 0;
        }

        // Standard private IP ranges commonly used by hotspots (192.168.x.x or 172.20.x.x)
        if (net.address.startsWith('192.168.')) {
          priority += 3;
        } else if (net.address.startsWith('10.')) {
          priority += 2;
        }

        validIps.push({ ip: net.address, name: interfaceName, priority });
      }
    }
  }

  // Sort by priority descending
  validIps.sort((a, b) => b.priority - a.priority);

  const localIp = validIps.length > 0 ? validIps[0].ip : 'localhost';

  return NextResponse.json({
    ip: localIp,
    detectedIps: validIps.map((v) => ({ name: v.name, ip: v.ip })),
  });
}

