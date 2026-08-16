"use client";

import { useEffect, useRef } from "react";
import { useCallStore } from "@/store/useCallStore";

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
      // Handle iOS/Safari autoplay requirement
      remoteVideoRef.current.play().catch((err) => {
        console.warn("Autoplay playback error:", err);
      });
    }
  }, [remoteStream]);

  return (
    <div className="relative w-full h-full min-h-[480px] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center">
      {/* Remote Video (Full Screen Container) */}
      {remoteStream && status === "connected" ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
          {status === "searching" && (
            <div className="flex flex-col items-center space-y-3">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-lg font-medium text-slate-300">Searching for someone to talk to...</p>
            </div>
          )}
          {status === "connecting" && (
            <div className="flex flex-col items-center space-y-3">
              <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-lg font-medium text-slate-300">Connecting video call...</p>
            </div>
          )}
          {status === "reconnecting" && (
            <div className="p-4 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Connection interrupted. Reconnecting...
            </div>
          )}
          {status === "peer_disconnected" && (
            <p className="text-slate-400 font-medium">Partner left the call. Click Skip to find someone new.</p>
          )}
          {status === "idle" && (
            <p className="text-slate-500 font-medium">Click "Start Chatting" to begin.</p>
          )}
        </div>
      )}

      {/* Local Video Preview (Pip Overlay) */}
      {localStream && (
        <div className="absolute bottom-4 right-4 w-40 h-28 sm:w-48 sm:h-36 rounded-xl overflow-hidden border-2 border-indigo-500/50 shadow-lg bg-slate-950">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover -scale-x-100" // Mirrored local video
          />
        </div>
      )}
    </div>
  );
}
