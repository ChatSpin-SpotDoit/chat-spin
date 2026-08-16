"use client";

import { useState } from "react";
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

  const localStream = useCallStore((s) => s.localStream);
  const matchId = useCallStore((s) => s.matchId);

  // Use the extracted hook
  const { rtcManager, toggleMic, toggleCamera, skipMatch } = useChatSession(isStarted);

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white overflow-hidden">
      {/* Header Bar */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Video className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            ChatSpin
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/history"
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-all flex items-center space-x-2 text-xs font-semibold"
          >
            <History className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Meet History</span>
          </Link>

          <Link
            href="/safety"
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-all flex items-center space-x-2 text-xs font-semibold"
          >
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Safety</span>
          </Link>

          {isStarted && (
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`p-2.5 rounded-xl border transition-all flex items-center space-x-2 text-xs font-semibold ${
                isChatOpen
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                  : "bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
              title="Toggle Chat"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Chat</span>
            </button>
          )}

          {rtcManager && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
              title="Device Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <AnimatePresence mode="wait">
        {!isStarted ? (
          <motion.main
            key="landing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-4xl mx-auto space-y-8"
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

            <p className="text-xs text-slate-500 pt-8 max-w-md">
              By starting a chat, you confirm that you are at least 18 years old and agree to our{" "}
              <Link href="/terms" className="text-indigo-400 hover:underline">
                Terms
              </Link>{" "}
              &{" "}
              <Link href="/community-guidelines" className="text-indigo-400 hover:underline">
                Community Guidelines
              </Link>
              .
            </p>
          </motion.main>
        ) : (
          <motion.main
            key="chat"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex-1 flex flex-col p-4 md:p-6 space-y-4 max-w-7xl mx-auto w-full h-[calc(100vh-4rem)]"
          >
            <div className="flex-1 flex gap-4 min-h-0 relative">
              {/* Video Container */}
              <motion.div
                layout
                className="flex-1 h-full min-h-0 rounded-2xl overflow-hidden"
              >
                <VideoContainer />
              </motion.div>

              {/* Side Chat Panel */}
              <AnimatePresence>
                {isChatOpen && (
                  <motion.div
                    initial={{ opacity: 0, x: 50, width: 0 }}
                    animate={{ opacity: 1, x: 0, width: "380px" }}
                    exit={{ opacity: 0, x: 50, width: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="h-full bg-slate-900 border border-slate-800 rounded-3xl p-4 flex flex-col shadow-xl shrink-0"
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
            </div>

            {/* Call Control Bar */}
            <div className="shrink-0">
              <CallControls
                onToggleMic={toggleMic}
                onToggleCamera={toggleCamera}
                onSkip={skipMatch}
              />
            </div>
          </motion.main>
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
