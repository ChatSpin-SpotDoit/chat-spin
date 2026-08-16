import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h1 className="text-3xl font-bold text-slate-100">Privacy Policy</h1>
          <Link href="/" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold transition-all">
            Home
          </Link>
        </div>

        <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-lg font-bold text-slate-100">1. Data We Collect</h2>
          <p>
            For anonymous users, we store a persistent device token in your browser local storage. Text chat messages are retained for 7 days and automatically purged. Direct messages between friends are retained for 90 days.
          </p>

          <h2 className="text-lg font-bold text-slate-100">2. WebRTC Video Media</h2>
          <p>
            Video and audio media streams flow directly Peer-to-Peer between browsers. We do not record or store video/audio streams on our servers.
          </p>

          <h2 className="text-lg font-bold text-slate-100">3. Message Deletion</h2>
          <p>
            You can delete text messages for yourself at any time, or delete for everyone within a 5-minute window after sending.
          </p>
        </div>
      </div>
    </main>
  );
}
