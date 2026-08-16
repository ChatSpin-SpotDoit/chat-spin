import Link from "next/link";
import { ShieldCheck, AlertTriangle, EyeOff, UserCheck } from "lucide-react";

export default function SafetyPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-3xl font-bold text-indigo-400">Safety Center</h1>
            <p className="text-sm text-slate-400">Your safety and privacy are our top priorities at ChatSpin.</p>
          </div>
          <Link href="/" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold transition-all">
            Back to Home
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <ShieldCheck className="w-8 h-8 text-indigo-400" />
            <h3 className="text-xl font-bold text-slate-200">18+ Platform</h3>
            <p className="text-sm text-slate-400">
              ChatSpin is strictly for adults aged 18 and older. Minors are prohibited from using the service.
            </p>
          </div>

          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <EyeOff className="w-8 h-8 text-indigo-400" />
            <h3 className="text-xl font-bold text-slate-200">Anonymous Identity</h3>
            <p className="text-sm text-slate-400">
              Never share real names, financial info, or personal addresses with strangers during video calls.
            </p>
          </div>

          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <AlertTriangle className="w-8 h-8 text-indigo-400" />
            <h3 className="text-xl font-bold text-slate-200">Instant Reporting</h3>
            <p className="text-sm text-slate-400">
              Use the Report button on any call to report inappropriate behavior immediately. Automated bans apply after threshold.
            </p>
          </div>

          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <UserCheck className="w-8 h-8 text-indigo-400" />
            <h3 className="text-xl font-bold text-slate-200">Permanent Blocking</h3>
            <p className="text-sm text-slate-400">
              Blocking a stranger ensures you will never be matched with them again across any future session.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
