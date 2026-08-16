"use client";

import { useEffect, useState } from "react";
import { Clock, ShieldAlert, UserCheck, MessageSquare } from "lucide-react";
import Link from "next/link";

interface HistoryItem {
  id: string;
  matchId: string;
  peerFingerprint: string | null;
  startedAt: string;
  durationMs: number | null;
  endReason: string | null;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In production: fetch from /api/chat/history with x-session-id header
    setLoading(false);
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">Meet History</h1>
            <p className="text-sm text-slate-400">Past chats from your browser (30-day retention for anonymous, permanent for Google users)</p>
          </div>
          <Link href="/" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold transition-all">
            Back to Chat
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading history...</div>
        ) : history.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <Clock className="w-12 h-12 text-slate-600 mx-auto" />
            <p className="text-slate-400 font-medium">No recent meets found.</p>
            <p className="text-xs text-slate-500">Start a chat to build your history!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-200">
                      Stranger ({item.peerFingerprint?.slice(0, 8) || "Anonymous"})
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {new Date(item.startedAt).toLocaleString()} • Duration: {item.durationMs ? `${Math.round(item.durationMs / 1000)}s` : "0s"}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition-all" title="View Chat">
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
