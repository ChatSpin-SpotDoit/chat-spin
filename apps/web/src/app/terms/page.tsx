import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h1 className="text-3xl font-bold text-slate-100">Terms of Service</h1>
          <Link href="/" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold transition-all">
            Home
          </Link>
        </div>

        <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
          <p>By using ChatSpin, you agree to these terms:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>You must be at least 18 years old to use ChatSpin.</li>
            <li>Inappropriate sexual content, nudity, harassment, and hate speech are strictly prohibited.</li>
            <li>Violations will result in automated or manual IP and account bans.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
