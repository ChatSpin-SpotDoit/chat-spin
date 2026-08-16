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
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim()) return;
    onSendMessage(inputContent.trim());
    setInputContent("");
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 w-80 sm:w-96 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950">
        <h3 className="font-semibold text-slate-200 text-sm">Match Chat</h3>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-xs text-slate-500">
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
                  className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-md relative ${
                    isMe
                      ? "bg-indigo-600 text-white rounded-br-none"
                      : "bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700"
                  }`}
                >
                  {isDeleted ? (
                    <span className="italic opacity-60 text-xs">This message was deleted</span>
                  ) : (
                    <span>{msg.content}</span>
                  )}

                  {/* Actions context menu button */}
                  {!isDeleted && (
                    <button
                      onClick={() => setActiveMenuId(activeMenuId === msg.id ? null : msg.id)}
                      className="opacity-0 group-hover:opacity-100 absolute -top-2 -right-2 p-1 bg-slate-950 rounded-full border border-slate-700 text-slate-400 hover:text-white transition-opacity"
                    >
                      <MoreVertical className="w-3 h-3" />
                    </button>
                  )}

                  {/* Context menu overlay */}
                  {activeMenuId === msg.id && (
                    <div className="absolute right-0 top-6 z-20 bg-slate-950 border border-slate-800 rounded-xl p-1 shadow-xl text-xs space-y-1 min-w-[120px]">
                      <button
                        onClick={() => {
                          onDeleteMessage?.(msg.id, "me");
                          setActiveMenuId(null);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-slate-800 rounded-lg text-slate-300 flex items-center space-x-1.5"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete for me</span>
                      </button>
                      {isMe && (
                        <button
                          onClick={() => {
                            onDeleteMessage?.(msg.id, "everyone");
                            setActiveMenuId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-red-950 text-red-400 rounded-lg flex items-center space-x-1.5"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete for everyone</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 px-1">
                  {new Date(msg.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Input Footer */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-slate-950 flex items-center space-x-2">
        <input
          type="text"
          value={inputContent}
          onChange={(e) => setInputContent(e.target.value)}
          placeholder="Type a message..."
          maxLength={1000}
          disabled={!matchId}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!inputContent.trim() || !matchId}
          className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
