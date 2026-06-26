'use client';

import React, { useState } from 'react';
import { Lock, AlertCircle, Eye, EyeOff, Wrench } from 'lucide-react';
import { useAuth } from './AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const err = await login(username, password);
    if (err) setError(err);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 mb-4">
            <Wrench className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">OpsCMMSPro</h1>
          <p className="text-slate-400 mt-1">Computerized Maintenance Management</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-8 shadow-xl">
          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3 mb-6">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Username</label>
              <input className="w-full bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username" autoFocus />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'}
                  className="w-full bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                  value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading || !username || !password}
            className="w-full mt-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
