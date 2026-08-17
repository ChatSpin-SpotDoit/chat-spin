"use client";

import { useEffect, useState } from "react";
import { Clock, ShieldAlert, MessageSquare, RefreshCw } from "lucide-react";
import Link from "next/link";

interface HistoryItem {
  id: string;
  matchId: string;
  peerFingerprint: string | null;
  startedAt: string;
  durationMs: number | null;
  endReason: string | null;
}

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

const END_REASON_LABEL: Record<string, string> = {
  skip: "Skipped",
  disconnect: "Disconnected",
  ban: "Banned",
  error: "Error",
  timeout: "Timed out",
};

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = () => {
    setLoading(true);
    setError(null);

    const sessionId =
      typeof window !== "undefined" ? localStorage.getItem("chatspin_session_id") : null;

    if (!sessionId) {
      setLoading(false);
      setError("No active session found. Start a chat first to build your history.");
      return;
    }

    fetch("/api/chat/history", { headers: { "x-session-id": sessionId } })
      .then((r) => {
        if (!r.ok) throw new Error(`Server responded ${r.status}`);
        return r.json() as Promise<{ history: HistoryItem[] }>;
      })
      .then((data) => {
        setHistory(data.history ?? []);
      })
      .catch(() => {
        setError("Failed to load history. Make sure the server is running.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">Meet History</h1>
            <p className="text-sm text-slate-400 mt-1">
              Past chats from your browser (30-day retention for anonymous users)
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={loadHistory}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all text-slate-300"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link
              href="/"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold transition-all"
            >
              Back to Chat
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-400">Loading history...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12 space-y-3">
            <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
            <p className="text-slate-400 font-medium">{error}</p>
            <Link href="/" className="text-indigo-400 hover:text-indigo-300 text-sm underline">
              Start a chat
            </Link>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <Clock className="w-12 h-12 text-slate-600 mx-auto" />
            <p className="text-slate-400 font-medium">No recent meets found.</p>
            <p className="text-xs text-slate-500">Start a chat to build your history!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={item.id}
                className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between hover:border-slate-700 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-200">
                      Stranger ({item.peerFingerprint?.slice(0, 8) || "Anonymous"})
                    </span>
                    {item.endReason && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-400 font-medium">
                        {END_REASON_LABEL[item.endReason] ?? item.endReason}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {new Date(item.startedAt).toLocaleString()} &bull; Duration:{" "}
                    <span className="text-slate-400 font-medium">
                      {formatDuration(item.durationMs)}
                    </span>
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition-all"
                    title="View Chat"
                  >
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
