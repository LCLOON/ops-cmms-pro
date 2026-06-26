import Link from 'next/link';
import { Wrench, ShieldCheck, ClipboardList } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-6 h-6 text-blue-400" />
          <span className="text-xl font-bold text-white">OpsCMMSPro</span>
        </div>
        <Link href="/app"
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
          Sign In
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-bold text-white mb-4">Maintenance Management,<br /><span className="text-blue-400">Simplified</span></h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-12">
          Track assets, manage work orders, schedule preventive maintenance, and control inventory — all in one place.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            { icon: <Wrench className="w-8 h-8" />, title: 'Asset Tracking', desc: 'Complete asset registry with location, warranty, and status tracking' },
            { icon: <ClipboardList className="w-8 h-8" />, title: 'Work Orders', desc: 'Create, assign, and track corrective and preventive work orders' },
            { icon: <ShieldCheck className="w-8 h-8" />, title: 'PM Scheduling', desc: 'Automated preventive maintenance schedules with due date tracking' },
          ].map(f => (
            <div key={f.title} className="bg-slate-800/30 border border-slate-700 rounded-xl p-6 text-left">
              <div className="text-blue-400 mb-3">{f.icon}</div>
              <h3 className="text-white font-semibold mb-1">{f.title}</h3>
              <p className="text-slate-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-4 justify-center">
          <Link href="/app" className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-lg font-medium transition-colors">Get Started</Link>
        </div>
      </main>
    </div>
  );
}
