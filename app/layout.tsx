import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OpsCMMSPro - Maintenance Management System',
  description: 'Computerized Maintenance Management System for enterprise asset and work order tracking',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-white antialiased">{children}</body>
    </html>
  );
}
