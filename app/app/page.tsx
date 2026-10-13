'use client';

import { AuthProvider } from '@/components/AuthContext';
import { ToastProvider } from '@/components/Toast';
import ErrorBoundary from '@/components/ErrorBoundary';
import AppShell from './AppShell';

export default function AppPage() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
