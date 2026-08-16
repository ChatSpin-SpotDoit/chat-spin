"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { wsClient } from "@/lib/wsClient";
import { useCallStore } from "@/store/useCallStore";
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="relative z-10 flex-1 h-full flex flex-col items-center justify-center p-6 text-center max-w-4xl mx-auto space-y-8"
          >
            <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="w-4 h-4 animate-spin-slow" />
              <span>Real-time Anonymous Video Matching</span>
            </div>

            <div className="space-y-4 max-w-2xl">
              <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
                Connect Instantly with Strangers Worldwide
              </h1>
              <p className="text-base sm:text-lg text-slate-400 leading-relaxed">
                Safe, fast, and encrypted peer-to-peer video chat. Meet new people, chat in real-time, or automatically become friends after 5 minutes!
              </p>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md">
              <button
                onClick={() => setIsStarted(true)}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-base shadow-xl shadow-indigo-600/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                Start Chatting Anonymously
              </button>
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
                  initial={{ opacity: 0, x: 50, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 50, scale: 0.95 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="absolute top-24 right-4 bottom-32 w-80 sm:w-96 pointer-events-auto shadow-2xl rounded-3xl overflow-hidden"
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
