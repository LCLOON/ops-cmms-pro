'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import Modal from './Modal';

interface Site { id: string; name: string; fercNo: string; capacityMw: string; riverMile: number; yearBuilt: number; status: string; operator: string; riverSystem: string; county: string; state: string; }

interface UserRow { id: number; username: string; display_name: string; role: string; active: number; force_password_change: number; last_login_at: string | null; }
interface UserFormState { username: string; display_name: string; role: string; active: number; password: string; force_password_change: number; }

const defaultSite: Site = { id:'', name:'', fercNo:'', capacityMw:'', riverMile:0, yearBuilt:0, status:'operational', operator:'', riverSystem:'Kennebec River', county:'', state:'ME' };
const defaultUser: UserFormState = { username: '', display_name: '', role: 'technician', active: 1, password: '', force_password_change: 1 };

export default function AdminPage() {
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [siteForm, setSiteForm] = useState<Site>(defaultSite);
  const { isAdmin } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState<UserFormState>(defaultUser);

  const fetchSites = useCallback(() =>
    fetch('/api/config?type=sites').then(r => r.json()).then(d => { if (d.sites) setSites(d.sites); }).catch(() => {}), []);

  const fetchUsers = useCallback(() =>
    fetch('/api/users').then(r => r.json()).then(d => { if (d.users) setUsers(d.users); }).catch(() => {}), []);

  useEffect(() => {
    Promise.all([fetchSites(), fetchUsers()]).finally(() => setLoading(false));
  }, [fetchSites, fetchUsers]);

  const openSiteEdit = (s: Site) => { setSiteForm({ ...s }); setEditingSite(s); setShowSiteForm(true); };
  const openSiteNew = () => { setSiteForm(defaultSite); setEditingSite(null); setShowSiteForm(true); };

  const saveSite = async () => {
    try {
      const r = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ site: siteForm }) });
      if (!r.ok) { alert((await r.json()).error); return; }
      setShowSiteForm(false); fetchSites();
    } catch { alert('Save failed'); }
  };

  const openUserEdit = (u: UserRow) => { setUserForm({ ...u, password: '' }); setEditingUser(u); setShowUserForm(true); };
  const openUserNew = () => { setUserForm(defaultUser); setEditingUser(null); setShowUserForm(true); };

  const saveUser = async () => {
    try {
      const r = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userForm) });
      if (!r.ok) { alert((await r.json()).error); return; }
      setShowUserForm(false); fetchUsers();
    } catch { alert('Save failed'); }
  };

  const deleteUserRow = async (u: UserRow) => {
    if (!confirm(`Delete user "${u.username}"?`)) return;
    await fetch('/api/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id }) });
    fetchUsers();
  };

  const roleCol = (r: string) => {
    const cls: Record<string, string> = { admin: 'text-red-400 bg-red-500/10 border-red-500/20', manager: 'text-amber-400 bg-amber-500/10 border-amber-500/20', technician: 'text-blue-400 bg-blue-500/10 border-blue-500/20', viewer: 'text-slate-400 bg-slate-500/10 border-slate-500/20' };
    return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${cls[r] || ''}`}>{r}</span>;
  };

  if (!isAdmin) return <div className="text-slate-400 p-8">Access denied. Admin role required.</div>;
  if (loading) return <div className="text-slate-400 p-8">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Administration</h2>
        <p className="text-slate-400 text-sm mt-1">System configuration, sites, and user management</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Hydro Plants — Lower Kennebec River System</h3>
            <button onClick={openSiteNew} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors">+ Add Site</button>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-500 border-b border-slate-800"><th className="text-left py-2">Site</th><th className="text-left py-2">FERC #</th><th className="text-right py-2">Capacity</th><th className="text-right py-2">River Mile</th><th className="text-center py-2">Built</th><th className="text-center py-2">Status</th><th className="text-center py-2">Actions</th></tr></thead>
            <tbody>{sites.map(s => <tr key={s.id} className="border-b border-slate-800/50"><td className="py-2 text-slate-300 font-medium">{s.name}</td><td className="py-2 text-slate-400 font-mono text-xs">{s.fercNo}</td><td className="py-2 text-right text-slate-300">{s.capacityMw}</td><td className="py-2 text-right text-slate-400">{s.riverMile}</td><td className="py-2 text-center text-slate-400">{s.yearBuilt}</td><td className="py-2 text-center"><span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/30">{s.status}</span></td><td className="py-2 text-center"><button onClick={() => openSiteEdit(s)} className="text-xs text-blue-400 hover:text-blue-300">Edit</button></td></tr>)}</tbody>
          </table>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">System Information</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Company</span><span className="text-slate-300">Kennebec Hydro Operations (KRRT)</span></div>
            <div className="flex justify-between"><span className="text-slate-500">River System</span><span className="text-slate-300">Kennebec River, Maine</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Plants</span><span className="text-slate-300">4 (Lockwood, Hydro-Kennebec, Shawmut, Weston)</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Total Capacity</span><span className="text-slate-300">~46.9 MW</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Database</span><span className="text-slate-300">SQLite (WAL mode)</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Auth</span><span className="text-slate-300">JWT (HS256, 8hr sessions)</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Users</span><span className="text-slate-300">{users.length} active</span></div>
          </div>
          <h3 className="text-sm font-semibold text-white mt-6 mb-3">Role-Based Access</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between px-3 py-2 bg-slate-800/50 rounded"><span className="text-red-400 font-medium">Admin</span><span className="text-slate-500">Full access, delete, force PW change</span></div>
            <div className="flex justify-between px-3 py-2 bg-slate-800/50 rounded"><span className="text-amber-400 font-medium">Manager</span><span className="text-slate-500">CRUD all entities, view analytics</span></div>
            <div className="flex justify-between px-3 py-2 bg-slate-800/50 rounded"><span className="text-blue-400 font-medium">Technician</span><span className="text-slate-500">Edit WOs, record labor, update PMs</span></div>
            <div className="flex justify-between px-3 py-2 bg-slate-800/50 rounded"><span className="text-slate-400 font-medium">Viewer</span><span className="text-slate-500">Read-only access to all data</span></div>
          </div>
        </div>
      </div>
      {showSiteForm && (
        <Modal open={showSiteForm} onClose={() => setShowSiteForm(false)} title={editingSite ? 'Edit Site' : 'Add Site'}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs text-slate-500 mb-1">Site Name</label><input value={siteForm.name} onChange={e => setSiteForm({...siteForm, name: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">Site ID</label><input value={siteForm.id} onChange={e => setSiteForm({...siteForm, id: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="SITE-XXXX" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">FERC #</label><input value={siteForm.fercNo} onChange={e => setSiteForm({...siteForm, fercNo: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">Capacity (MW)</label><input value={siteForm.capacityMw} onChange={e => setSiteForm({...siteForm, capacityMw: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">River Mile</label><input type="number" value={siteForm.riverMile} onChange={e => setSiteForm({...siteForm, riverMile: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">Year Built</label><input type="number" value={siteForm.yearBuilt} onChange={e => setSiteForm({...siteForm, yearBuilt: Number(e.target.value)})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">Operator</label><input value={siteForm.operator} onChange={e => setSiteForm({...siteForm, operator: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">Status</label><select value={siteForm.status} onChange={e => setSiteForm({...siteForm, status: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="operational">Operational</option><option value="standby">Standby</option><option value="decommissioned">Decommissioned</option><option value="construction">Construction</option></select></div>
              <div><label className="block text-xs text-slate-500 mb-1">County</label><input value={siteForm.county} onChange={e => setSiteForm({...siteForm, county: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">State</label><input value={siteForm.state} onChange={e => setSiteForm({...siteForm, state: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowSiteForm(false)} className="text-slate-400 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors">Cancel</button>
              <button onClick={saveSite} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">Save</button>
            </div>
          </div>
        </Modal>
      )}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">User Management</h3>
          <button onClick={openUserNew} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors">+ Add User</button>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-slate-500 border-b border-slate-800"><th className="text-left py-2">Username</th><th className="text-left py-2">Display Name</th><th className="text-left py-2">Role</th><th className="text-center py-2">Active</th><th className="text-left py-2">Last Login</th><th className="text-center py-2">Actions</th></tr></thead>
          <tbody>{users.map(u => <tr key={u.id} className="border-b border-slate-800/50"><td className="py-2 text-slate-300 font-mono text-xs">{u.username}</td><td className="py-2 text-slate-300">{u.display_name}</td><td className="py-2">{roleCol(u.role)}</td><td className="py-2 text-center"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${u.active ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'}`}>{u.active ? 'Yes' : 'No'}</span></td><td className="py-2 text-slate-500 text-xs">{u.last_login_at || 'Never'}</td><td className="py-2 text-center"><button onClick={() => openUserEdit(u)} className="text-xs text-blue-400 hover:text-blue-300 mr-3">Edit</button><button onClick={() => deleteUserRow(u)} className="text-xs text-red-400 hover:text-red-300">Del</button></td></tr>)}</tbody>
        </table>
      </div>
      {showUserForm && (
        <Modal open={showUserForm} onClose={() => setShowUserForm(false)} title={editingUser ? 'Edit User' : 'Add User'}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs text-slate-500 mb-1">Username</label><input value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">Display Name</label><input value={userForm.display_name} onChange={e => setUserForm({...userForm, display_name: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">Password</label><input type="password" value={userForm.password || ''} onChange={e => setUserForm({...userForm, password: e.target.value})} placeholder={editingUser ? 'Leave blank to keep' : 'Required'} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">Role</label><select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="admin">Admin</option><option value="manager">Manager</option><option value="technician">Technician</option><option value="viewer">Viewer</option></select></div>
              <div className="flex items-center gap-3"><label className="text-xs text-slate-500">Active</label><button onClick={() => setUserForm({...userForm, active: userForm.active ? 0 : 1})} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${userForm.active ? 'bg-green-600/20 text-green-400 border-green-500/30' : 'bg-slate-700/50 text-slate-400 border-slate-600'}`}>{userForm.active ? 'Active' : 'Inactive'}</button></div>
              <div className="flex items-center gap-3"><label className="text-xs text-slate-500">Force PW Change</label><button onClick={() => setUserForm({...userForm, force_password_change: userForm.force_password_change ? 0 : 1})} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${userForm.force_password_change ? 'bg-amber-600/20 text-amber-400 border-amber-500/30' : 'bg-slate-700/50 text-slate-400 border-slate-600'}`}>{userForm.force_password_change ? 'Yes' : 'No'}</button></div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowUserForm(false)} className="text-slate-400 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors">Cancel</button>
              <button onClick={saveUser} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">Save</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
