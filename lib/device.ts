export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  browser: string;
  os: string;
  lastActive?: number;
}

/**
 * Detects device info from the browser environment.
 */
export function getDeviceInfo(customName?: string): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      deviceId: 'server',
      deviceName: 'Server',
      deviceType: 'desktop',
      browser: 'Unknown',
      os: 'Unknown',
    };
  }

  const ua = navigator.userAgent;

  // 1. Detect OS
  let os = 'Unknown OS';
  if (/iPad|iPhone|iPod/.test(ua)) {
    os = 'iOS';
  } else if (/Android/.test(ua)) {
    os = 'Android';
  } else if (/Windows NT/.test(ua)) {
    os = 'Windows';
  } else if (/Macintosh|Mac OS X/.test(ua)) {
    os = 'macOS';
  } else if (/Linux/.test(ua)) {
    os = 'Linux';
  }

  // 2. Detect Browser
  let browser = 'Unknown Browser';
  if (/CriOS|Chrome/.test(ua) && !/Edg|OPR|Opera/.test(ua)) {
    browser = 'Chrome';
  } else if (/Safari/.test(ua) && !/Chrome|CriOS|Android/.test(ua)) {
    browser = 'Safari';
  } else if (/Edg/.test(ua)) {
    browser = 'Edge';
  } else if (/Firefox|FxiOS/.test(ua)) {
    browser = 'Firefox';
  } else if (/SamsungBrowser/.test(ua)) {
    browser = 'Samsung Internet';
  } else if (/Opera|OPR/.test(ua)) {
    browser = 'Opera';
  }

  // 3. Detect Device Type
  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    deviceType = 'tablet';
  } else if (
    /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(
      ua
    )
  ) {
    deviceType = 'mobile';
  }

  // 4. Stored custom name or default friendly name
  const storedName = customName || localStorage.getItem('shaeit_device_name');
  let deviceName = storedName;

  if (!deviceName) {
    if (os === 'iOS') {
      deviceName = ua.includes('iPad') ? 'Apple iPad' : 'Apple iPhone';
    } else if (os === 'Android') {
      deviceName = deviceType === 'tablet' ? 'Android Tablet' : 'Android Mobile';
    } else if (os === 'macOS') {
      deviceName = 'Apple Mac';
    } else if (os === 'Windows') {
      deviceName = 'Windows PC';
    } else {
      deviceName = `${os} Device`;
    }
    deviceName = `${deviceName} (${browser})`;
  }

  // 5. Persistent Device ID
  let deviceId = localStorage.getItem('shaeit_device_id');
  if (!deviceId) {
    deviceId = `dev-${Math.random().toString(36).substring(2, 9)}-${Date.now().toString(36)}`;
    try {
      localStorage.setItem('shaeit_device_id', deviceId);
    } catch {
      // Ignore quota errors
    }
  }

  return {
    deviceId,
    deviceName,
    deviceType,
    browser,
    os,
    lastActive: Date.now(),
  };
}

/**
 * Saves a user-defined custom device nickname.
 */
export function setCustomDeviceName(name: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('shaeit_device_name', name.trim());
  }
}
