'use client';

import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { KeyRound, LogOut } from 'lucide-react';

// Shown instead of the app while the account still carries a default password.
// Seeded demo accounts ship with published credentials, so the first sign-in
// must replace them before any compliance or maintenance data is reachable.
export default function ChangePasswordScreen() {
  const { user, logout, refreshSession } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 12) { setError('New password must be at least 12 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('The two new passwords do not match.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Could not change the password.');
        return;
      }
      // The route re-issues the session cookie; reloading the session clears
      // the gate without asking the user to sign in again.
      await refreshSession();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const input = (label: string, id: string, value: string, setter: (v: string) => void, autoFocus = false) => (
    <div>
      <label htmlFor={id} className="block text-xs text-slate-500 mb-1">{label}</label>
      <input id={id} type="password" value={value} onChange={e => setter(e.target.value)} autoFocus={autoFocus} required
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/20"><KeyRound className="w-5 h-5 text-amber-400" /></div>
          <div>
            <h2 className="text-lg font-bold text-white">Set a new password</h2>
            <p className="text-xs text-slate-500">Signed in as {user?.username}</p>
          </div>
        </div>

        <p className="text-sm text-slate-400">
          This account is still using its initial password. Choose a new one to continue.
        </p>

        <div className="space-y-3">
          {input('Current password', 'current-password', currentPassword, setCurrentPassword, true)}
          {input('New password (min 12 characters)', 'new-password', newPassword, setNewPassword)}
          {input('Confirm new password', 'confirm-password', confirmPassword, setConfirmPassword)}
        </div>

        {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex items-center justify-between pt-2">
          <button type="button" onClick={logout} className="flex items-center gap-2 text-sm text-slate-400 hover:text-red-400 transition-colors">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
          <button type="submit" disabled={saving || !currentPassword || !newPassword}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
            {saving ? 'Saving...' : 'Update password'}
          </button>
        </div>
      </form>
    </div>
  );
}
