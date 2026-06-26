'use client';

import { AuthProvider } from '@/components/AuthContext';
import AppShell from './AppShell';

export default function AppPage() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
