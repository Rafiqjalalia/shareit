/**
 * Application environment configuration and safe URL resolver.
 */

export function getAppBaseUrl(): string {
  // 1. Explicit App URL Override
  if (process.env.NEXT_PUBLIC_APP_URL) {
    let url = process.env.NEXT_PUBLIC_APP_URL.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    return url;
  }

  // 2. Client Browser Window Origin (always matches actual domain/IP user is accessing)
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }

  // 3. Vercel System URL (for SSR server-side rendering fallback)
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }

  // 4. Default Localhost Fallback
  return 'http://localhost:3000';
}
