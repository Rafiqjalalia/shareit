/**
 * Application environment configuration and safe URL resolver.
 */

export function getAppBaseUrl(): string {
  // 1. Explicit Vercel / Environment Variable
  if (process.env.NEXT_PUBLIC_APP_URL) {
    let url = process.env.NEXT_PUBLIC_APP_URL.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    return url;
  }

  // 2. Vercel System URL (automatic on Vercel deployments)
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }

  // 3. Client Browser Window Origin
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }

  // 4. Default Localhost Fallback
  return 'http://localhost:3000';
}
