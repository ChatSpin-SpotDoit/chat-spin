"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { wsClient } from "@/lib/wsClient";
import { useCallStore } from "@/store/useCallStore";
import { useStatsStore } from "@/store/useStatsStore";
import { VideoContainer } from "@/components/call/VideoContainer";
import { CallControls } from "@/components/call/CallControls";
import { ChatPanel, type ChatMessageItem } from "@/components/chat/ChatPanel";
import { DeviceSettingsModal } from "@/components/call/DeviceSettingsModal";
import { useChatSession } from "@/features/webrtc/useChatSession";
import { ChatDeleteScope } from "@chatspin/shared";
import { Video, Shield, History, Settings, Sparkles, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export default function HomePage() {
  const [isStarted, setIsStarted] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const localStream = useCallStore((s) => s.localStream);
  const matchId = useCallStore((s) => s.matchId);
  const onlineCount = useStatsStore((s) => s.onlineCount);

  // We need a ref to access the latest isChatOpen state inside the callback
  const isChatOpenRef = useRef(isChatOpen);
  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
    if (isChatOpen) {
      setUnreadCount(0); // Reset when opened
    }
  }, [isChatOpen]);

  // Use the extracted hook
  const { rtcManager, toggleMic, toggleCamera, skipMatch } = useChatSession({
    isStarted,
    onChatMessageReceived: (messageId, senderSessionId, content, sentAt) => {
      setChatMessages((prev) => [
        ...prev,
        { id: messageId, senderSessionId, content, sentAt },
      ]);
      
      if (!isChatOpenRef.current) {
        setUnreadCount((prev) => prev + 1);
        toast("New Message", {
          description: content.length > 30 ? content.slice(0, 30) + "..." : content,
          position: "top-center",
        });
      }
    },
    onChatMessageDeleted: (messageId, scope) => {
      if (scope === "me") {
        setChatMessages((prev) => prev.filter((m) => m.id !== messageId));
      } else {
        setChatMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, isDeletedForEveryone: true } : m))
        );
      }
    },
  });

  const handleSendMessage = (content: string) => {
    if (!matchId) return;
    const msgId = crypto.randomUUID();
    const newMsg: ChatMessageItem = {
      id: msgId,
      senderSessionId: "me",
      content,
      sentAt: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, newMsg]);

    wsClient.send({
      type: "chat:message",
      matchId,
      messageId: msgId,
      content,
      requestId: crypto.randomUUID(),
    });
  };

  const handleDeleteMessage = (messageId: string, scope: "me" | "everyone") => {
    if (scope === "me") {
      setChatMessages((prev) => prev.filter((m) => m.id !== messageId));
    } else if (matchId) {
      setChatMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isDeletedForEveryone: true } : m))
      );
      wsClient.send({
        type: "chat:message-delete",
        matchId,
        messageId,
        scope: ChatDeleteScope.EVERYONE,
        requestId: crypto.randomUUID(),
      });
    }
  };

  return (
    <div className="h-[100dvh] w-screen overflow-hidden relative bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Absolute Full-Bleed Background Video Container (Only rendered when started) */}
      <AnimatePresence>
        {isStarted && (
          <motion.div
            key="video-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 z-0"
          >
            <VideoContainer />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Glass Header */}
      <header className="absolute top-0 w-full h-20 bg-gradient-to-b from-black/60 to-transparent z-40 px-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-black/50 backdrop-blur-md rounded-[14px] flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
            </div>
          </div>
          <span className="text-xl font-bold tracking-tight text-white drop-shadow-md">
            ChatSpin
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/history"
            className="p-2.5 rounded-xl bg-black/20 backdrop-blur-md border border-white/10 text-white/90 hover:bg-white/10 transition-all flex items-center space-x-2 text-xs font-semibold shadow-lg"
          >
            <History className="w-4 h-4 text-indigo-300" />
            <span className="hidden sm:inline">Meet History</span>
          </Link>

          <Link
            href="/safety"
            className="p-2.5 rounded-xl bg-black/20 backdrop-blur-md border border-white/10 text-white/90 hover:bg-white/10 transition-all flex items-center space-x-2 text-xs font-semibold shadow-lg"
          >
            <Shield className="w-4 h-4 text-emerald-300" />
            <span className="hidden sm:inline">Safety</span>
          </Link>

          {isStarted && (
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`relative p-2.5 rounded-xl border backdrop-blur-md transition-all flex items-center space-x-2 text-xs font-semibold shadow-lg ${
                isChatOpen
                  ? "bg-indigo-600/80 border-indigo-500 text-white shadow-indigo-500/30"
                  : "bg-black/20 border-white/10 text-white/90 hover:bg-white/10"
              }`}
              title="Toggle Chat"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Chat</span>
              {unreadCount > 0 && !isChatOpen && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full shadow-md animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          )}

          {rtcManager && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 rounded-xl bg-black/20 backdrop-blur-md border border-white/10 text-white/90 hover:bg-white/10 transition-all shadow-lg"
              title="Device Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Main Overlay Content */}
      <AnimatePresence mode="wait">
        {!isStarted ? (
          <motion.main
            key="landing"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative z-10 flex-1 h-full flex flex-col items-center justify-center p-6 text-center max-w-4xl mx-auto space-y-8"
          >
            <div className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-indigo-300 text-xs font-bold tracking-widest uppercase backdrop-blur-md shadow-2xl">
              <Sparkles className="w-4 h-4 animate-spin-slow text-indigo-400" />
              <span>Real-time Video Matching</span>
            </div>

            <div className="space-y-6 max-w-3xl relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 blur-3xl rounded-full -z-10 animate-pulse"></div>
              <h1 className="text-5xl sm:text-7xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-500 leading-tight">
                Connect Instantly.<br/>
                <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">No Boundaries.</span>
              </h1>
              <p className="text-lg sm:text-xl text-slate-400 leading-relaxed font-medium">
                Safe, fast, and encrypted peer-to-peer video chat. Meet new people in milliseconds.
              </p>
            </div>

            <div className="pt-8 flex flex-col items-center justify-center gap-6 w-full max-w-md relative z-10">
              <button
                onClick={() => setIsStarted(true)}
                className="group relative w-full sm:w-auto px-10 py-5 rounded-full bg-white text-slate-950 font-black text-lg sm:text-xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="relative z-10">Start Chatting Now</span>
              </button>
              
              <div className="flex items-center space-x-2 px-4 py-1.5 rounded-full bg-slate-900/50 border border-slate-800 shadow-inner">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                <span className="text-xs font-medium text-slate-300 tracking-wide">
                  Live: {onlineCount > 0 ? onlineCount : "..."} users online
                </span>
              </div>
            </div>
          </motion.main>
        ) : (
          <motion.div
            key="chat-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none z-30" // Pointer events none so video clicks pass through
          >
            {/* Floating Chat Panel */}
            <AnimatePresence>
              {isChatOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 40, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 30, scale: 0.95, filter: "blur(5px)" }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="absolute top-20 left-0 right-0 bottom-0 sm:top-24 sm:right-4 sm:bottom-32 sm:left-auto sm:w-96 pointer-events-auto sm:shadow-2xl sm:rounded-3xl overflow-hidden bg-slate-950 sm:bg-transparent z-50"
                >
                  <ChatPanel
                    currentSessionId="me"
                    matchId={matchId}
                    messages={chatMessages}
                    onSendMessage={handleSendMessage}
                    onDeleteMessage={handleDeleteMessage}
                    onClose={() => setIsChatOpen(false)}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Floating Call Controls */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto">
              <CallControls
                onToggleMic={toggleMic}
                onToggleCamera={toggleCamera}
                onSkip={skipMatch}
                onStop={() => setIsStarted(false)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Device Settings Modal */}
      {rtcManager && (
        <DeviceSettingsModal
          deviceManager={rtcManager.deviceManager}
          localStream={localStream}
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
}
