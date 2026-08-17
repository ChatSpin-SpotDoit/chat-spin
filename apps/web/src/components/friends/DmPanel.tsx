"use client";

import { useEffect, useRef, useState } from "react";
import { wsClient } from "@/lib/wsClient";
import { useFriendsStore, type DmMessage } from "@/store/useFriendsStore";
import { ArrowLeft, Send, Loader2 } from "lucide-react";

interface DmPanelProps {
  friendshipId: string;
  friendLabel: string;
  onClose: () => void;
}

export function DmPanel({ friendshipId, friendLabel, onClose }: DmPanelProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = useFriendsStore((s) => s.dmConversations[friendshipId] ?? []);
  const addDmMessage = useFriendsStore((s) => s.addDmMessage);
  const setDmMessages = useFriendsStore((s) => s.setDmMessages);

  // Load DM history from REST API
  useEffect(() => {
    if (messages.length > 0) return; // already loaded
    setLoading(true);
    const sessionId =
      typeof window !== "undefined" ? localStorage.getItem("chatspin_session_id") : null;

    fetch(`/api/friends/${friendshipId}/messages`, {
      headers: sessionId ? { "x-session-id": sessionId } : {},
    })
      .then((r) => r.json())
      .then((data: { messages: DmMessage[] }) => {
        setDmMessages(friendshipId, data.messages ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendshipId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const content = input.trim();
    if (!content) return;
    const messageId = crypto.randomUUID();
    const sessionId =
      typeof window !== "undefined" ? localStorage.getItem("chatspin_session_id") ?? "me" : "me";

    // Optimistic add
    addDmMessage(friendshipId, {
      id: messageId,
      friendshipId,
      senderSessionId: sessionId,
      content,
      sentAt: new Date().toISOString(),
    });

    wsClient.send({
      type: "dm:message",
      friendshipId,
      messageId,
      content,
      requestId: crypto.randomUUID(),
    });

    setInput("");
  };

  const mySessionId =
    typeof window !== "undefined" ? localStorage.getItem("chatspin_session_id") : null;

  return (
    <div className="flex flex-col h-full bg-slate-950/95 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center space-x-3 px-4 py-3 border-b border-white/10 bg-slate-900/60">
        <button
          onClick={onClose}
          className="p-1.5 rounded-xl hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-sm">
          {friendLabel[0]?.toUpperCase() ?? "F"}
        </div>
        <span className="text-sm font-semibold text-slate-200 truncate">{friendLabel}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {loading ? (
          <div className="flex justify-center items-center h-full text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-2 text-center">
            <span className="text-3xl">💬</span>
            <p className="text-xs text-slate-500">No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderSessionId === mySessionId || msg.senderSessionId === "me";
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm break-words shadow-sm ${
                    isMe
                      ? "bg-indigo-600 text-white rounded-br-sm"
                      : "bg-slate-800 text-slate-200 rounded-bl-sm border border-slate-700"
                  }`}
                >
                  {msg.content}
                  <div className={`text-[10px] mt-1 ${isMe ? "text-indigo-200" : "text-slate-500"}`}>
                    {new Date(msg.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center space-x-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Message..."
            maxLength={2000}
            className="flex-1 bg-slate-800/80 border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white shadow-md transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
