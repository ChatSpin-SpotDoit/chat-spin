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
    <div className="relative w-full h-full bg-slate-950 flex flex-col md:flex-row items-center justify-center overflow-hidden">
      {/* Remote Video Container */}
      <div className={`w-full h-full transition-all duration-500 relative flex items-center justify-center ${
        status === "connected" ? "md:w-1/2 border-r border-white/5" : "w-full"
      }`}>
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ${
            status === "connected" ? "blur-0 scale-100 opacity-100" : "blur-3xl scale-110 opacity-30"
          }`}
        />
      </div>

      <AnimatePresence mode="wait">
        {status !== "connected" && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-4 z-10 bg-black/40 backdrop-blur-md"
          >
            {status === "searching" && (
              <div className="flex flex-col items-center space-y-6">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 animate-ping"></div>
                  </div>
                </div>
                <p className="text-2xl font-light text-white tracking-widest drop-shadow-md">
                  SEARCHING
                </p>
              </div>
            )}
            {status === "connecting" && (
              <div className="flex flex-col items-center space-y-6">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-2xl font-light text-white tracking-widest drop-shadow-md">
                  CONNECTING
                </p>
              </div>
            )}
            {status === "reconnecting" && (
              <div className="p-4 rounded-xl bg-amber-500/20 backdrop-blur-xl text-amber-300 border border-amber-500/30 shadow-2xl flex items-center space-x-3">
                <div className="w-4 h-4 rounded-full bg-amber-500 animate-ping"></div>
                <span className="font-semibold tracking-wide">Reconnecting...</span>
              </div>
            )}
            {status === "peer_disconnected" && (
              <div className="flex flex-col items-center space-y-4">
                <div className="w-20 h-20 bg-white/5 backdrop-blur-xl rounded-full flex items-center justify-center mb-2 shadow-2xl border border-white/10">
                  <span className="text-4xl">👋</span>
                </div>
                <p className="text-2xl text-white font-light tracking-wide">Partner left the chat</p>
                <p className="text-white/60 tracking-wider text-sm uppercase font-medium">Click Next to find someone new</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Local Video Preview (Pip Overlay or 50/50 Split on Desktop) */}
      <AnimatePresence>
        {localStream && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={
              status === "connected"
                ? "absolute bottom-32 right-4 w-28 h-40 rounded-2xl md:relative md:bottom-auto md:right-auto md:w-1/2 md:h-full md:rounded-none z-20 shadow-2xl md:shadow-none overflow-hidden bg-black transition-all duration-500"
                : "absolute top-24 right-4 w-28 h-40 rounded-2xl md:top-24 md:right-6 md:w-40 md:h-56 z-20 shadow-2xl overflow-hidden bg-black transition-all duration-500"
            }
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />
            {/* Inner shadow overlay for premium feel - hidden on desktop split */}
            <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] pointer-events-none md:hidden rounded-2xl ring-1 ring-white/10" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
