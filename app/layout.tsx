import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ShaeIt - Instant QR File Transfer & Temp Cloud Share',
  description: 'Transfer files from Mobile to PC instantly via QR scan on same Wi-Fi (P2P), or share temporary expiring links without VPS.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased text-slate-100 min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
