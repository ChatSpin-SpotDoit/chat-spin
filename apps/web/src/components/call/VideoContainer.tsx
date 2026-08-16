"use client";

import { useEffect, useRef } from "react";
import { useCallStore } from "@/store/useCallStore";
import { motion, AnimatePresence } from "framer-motion";

export function VideoContainer() {
  const localStream = useCallStore((s) => s.localStream);
  const remoteStream = useCallStore((s) => s.remoteStream);
  const status = useCallStore((s) => s.status);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Attach local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch((err) => {
        console.warn("Autoplay playback error:", err);
      });
    }
  }, [remoteStream, status]);

  return (
    <div className="relative w-full h-full min-h-[480px] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center">
      {/* Remote Video (Always rendered but blurred if not connected) */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
          status === "connected" ? "blur-0 scale-100 opacity-100" : "blur-2xl scale-105 opacity-40"
        }`}
      />

      <AnimatePresence mode="wait">
        {status !== "connected" && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-4 z-10 bg-slate-950/40 backdrop-blur-sm"
          >
            {status === "searching" && (
              <div className="flex flex-col items-center space-y-4">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-xl font-medium text-white tracking-wide">Searching for someone...</p>
              </div>
            )}
            {status === "connecting" && (
              <div className="flex flex-col items-center space-y-4">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-xl font-medium text-white tracking-wide">Connecting video call...</p>
              </div>
            )}
            {status === "reconnecting" && (
              <div className="p-4 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-lg shadow-amber-500/10 flex items-center space-x-3">
                <div className="w-4 h-4 rounded-full bg-amber-500 animate-ping"></div>
                <span className="font-semibold">Connection interrupted. Reconnecting...</span>
              </div>
            )}
            {status === "peer_disconnected" && (
              <div className="flex flex-col items-center space-y-2">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-2">
                  <span className="text-2xl">👋</span>
                </div>
                <p className="text-xl text-white font-medium">Partner left the call.</p>
                <p className="text-slate-400">Click Skip to find someone new.</p>
              </div>
            )}
            {status === "idle" && (
              <p className="text-slate-500 font-medium">Click "Start Chatting" to begin.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Local Video Preview (Pip Overlay) */}
      <AnimatePresence>
        {localStream && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute bottom-6 right-6 w-32 h-44 sm:w-48 sm:h-64 rounded-2xl overflow-hidden border-2 border-indigo-500/50 shadow-2xl bg-slate-950 z-20"
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100" // Mirrored local video
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
