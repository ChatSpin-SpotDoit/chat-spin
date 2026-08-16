import Link from "next/link";

export default function CommunityGuidelinesPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h1 className="text-3xl font-bold text-slate-100">Community Guidelines</h1>
          <Link href="/" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold transition-all">
            Home
          </Link>
        </div>

        <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
          <p>Help us keep ChatSpin safe and fun for everyone:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Be respectful to strangers.</li>
            <li>No nudity or sexually explicit conduct.</li>
            <li>No hate speech, threats, or harassment.</li>
            <li>Use reporting and blocking tools when encountering violators.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
