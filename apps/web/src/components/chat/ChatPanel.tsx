"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Trash2, MoreVertical, X } from "lucide-react";

export interface ChatMessageItem {
  id: string;
  senderSessionId: string;
  content: string;
  sentAt: string;
  isDeletedForEveryone?: boolean;
}

interface ChatPanelProps {
  currentSessionId: string | null;
  matchId: string | null;
  messages: ChatMessageItem[];
  onSendMessage: (content: string) => void;
  onDeleteMessage?: (messageId: string, scope: "me" | "everyone") => void;
  onClose?: () => void;
}

export function ChatPanel({
  currentSessionId,
  matchId,
  messages,
  onSendMessage,
  onDeleteMessage,
  onClose,
}: ChatPanelProps) {
  const [inputContent, setInputContent] = useState("");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim()) return;
    onSendMessage(inputContent.trim());
    setInputContent("");
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/40 backdrop-blur-xl border border-white/10 w-full sm:w-96 shadow-2xl rounded-3xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-black/20">
        <h3 className="font-semibold text-white text-sm tracking-wide">Match Chat</h3>
        {onClose && (
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-xs text-white/50 font-medium">
            No messages yet. Say hello!
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderSessionId === currentSessionId;
            const isDeleted = msg.isDeletedForEveryone;

            return (
              <div
                key={msg.id}
                className={`group relative flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-md relative ${
                    isMe
                      ? "bg-gradient-to-tr from-indigo-600 to-purple-500 text-white rounded-br-none"
                      : "bg-black/40 text-slate-100 rounded-bl-none border border-white/5 backdrop-blur-md"
                  }`}
                >
                  {isDeleted ? (
                    <span className="italic opacity-60 text-xs">This message was deleted</span>
                  ) : (
                    <span className="leading-relaxed">{msg.content}</span>
                  )}

                  {/* Actions context menu button */}
                  {!isDeleted && (
                    <button
                      onClick={() => setActiveMenuId(activeMenuId === msg.id ? null : msg.id)}
                      className="opacity-0 group-hover:opacity-100 absolute -top-2 -right-2 p-1.5 bg-slate-900 rounded-full border border-slate-700 text-slate-400 hover:text-white transition-all shadow-lg"
                    >
                      <MoreVertical className="w-3 h-3" />
                    </button>
                  )}

                  {/* Context menu overlay */}
                  {activeMenuId === msg.id && (
                    <div className="absolute right-0 top-8 z-20 bg-slate-900 border border-slate-700 rounded-xl p-1 shadow-2xl text-xs space-y-1 min-w-[140px]">
                      <button
                        onClick={() => {
                          onDeleteMessage?.(msg.id, "me");
                          setActiveMenuId(null);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-800 rounded-lg text-slate-300 flex items-center space-x-2 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete for me</span>
                      </button>
                      {isMe && (
                        <button
                          onClick={() => {
                            onDeleteMessage?.(msg.id, "everyone");
                            setActiveMenuId(null);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-red-500/20 text-red-400 rounded-lg flex items-center space-x-2 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete for everyone</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-white/40 mt-1.5 px-1 font-medium">
                  {new Date(msg.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Input Footer */}
      <form onSubmit={handleSend} className="p-4 border-t border-white/10 bg-black/20 flex items-center space-x-3">
        <input
          type="text"
          value={inputContent}
          onChange={(e) => setInputContent(e.target.value)}
          placeholder="Type a message..."
          maxLength={1000}
          disabled={!matchId}
          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 transition-all backdrop-blur-md"
        />
        <button
          type="submit"
          disabled={!inputContent.trim() || !matchId}
          className="p-3 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-30 disabled:hover:bg-indigo-500 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-lg"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
