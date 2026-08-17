"use client";

import { useEffect, useRef, useCallback } from "react";
import { useCallStore } from "@/store/useCallStore";
import { useFriendsStore } from "@/store/useFriendsStore";
import { wsClient } from "@/lib/wsClient";
import { WebRTCManager } from "@/features/webrtc/WebRTCManager";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users } from "lucide-react";
import { toast } from "sonner";

interface FriendCallScreenProps {
  callId: string;
  role: "offerer" | "answerer";
}

export function FriendCallScreen({ callId, role }: FriendCallScreenProps) {
  const localStream = useCallStore((s) => s.localStream);
  const remoteStream = useCallStore((s) => s.remoteStream);
  const isMicMuted = useCallStore((s) => s.isMicMuted);
  const isCameraDisabled = useCallStore((s) => s.isCameraDisabled);
  const clearActiveFriendCall = useFriendsStore((s) => s.clearActiveFriendCall);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const rtcManagerRef = useRef<WebRTCManager | null>(null);

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
        console.warn("Friend call autoplay error:", err);
      });
    }
  }, [remoteStream]);

  // Set up WebRTC manager for the friend call, listen for friend-scoped signaling
  useEffect(() => {
    const manager = new WebRTCManager(wsClient, {
      onLocalStream: (stream) => useCallStore.getState().setLocalStream(stream),
      onRemoteStream: (stream) => useCallStore.getState().setRemoteStream(stream),
      onStatusChange: () => {},
      onMatchFound: () => {},
      onMatchSkipped: () => {},
    });
    rtcManagerRef.current = manager;

    manager.initMedia().then(() => {
      // Handle friend WebRTC signaling from server
      const origListeners = wsClient["listeners"];
      const prevOnServerMessage = origListeners.onServerMessage;
      origListeners.onServerMessage = (msg: any) => {
        if (msg.type === "friend:webrtc:offer" && msg.callId === callId) {
          void manager.handleServerMessage({ type: "webrtc:offer", matchId: callId, sdp: msg.sdp });
        } else if (msg.type === "friend:webrtc:answer" && msg.callId === callId) {
          void manager.handleServerMessage({ type: "webrtc:answer", matchId: callId, sdp: msg.sdp });
        } else if (msg.type === "friend:webrtc:ice-candidate" && msg.callId === callId) {
          void manager.handleServerMessage({
            type: "webrtc:ice-candidate",
            matchId: callId,
            candidate: msg.candidate,
            sdpMid: msg.sdpMid,
            sdpMLineIndex: msg.sdpMLineIndex,
          });
        } else if (msg.type === "friend:call-ended" && msg.callId === callId) {
          clearActiveFriendCall();
          useCallStore.getState().setRemoteStream(null);
        } else {
          prevOnServerMessage?.(msg);
        }
      };

      // If we're the offerer, initiate the offer once media is ready
      if (role === "offerer") {
        void manager.startOfferForFriendCall(callId);
      }
    }).catch((err) => {
      toast.error(err.message || "Failed to access camera/microphone for friend call.");
      clearActiveFriendCall();
    });

    return () => {
      manager.destroy();
      rtcManagerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, role]);

  const handleHangUp = useCallback(() => {
    wsClient.send({ type: "friend:call-end", callId, requestId: crypto.randomUUID() });
    rtcManagerRef.current?.destroy();
    rtcManagerRef.current = null;
    useCallStore.getState().setRemoteStream(null);
    clearActiveFriendCall();
  }, [callId, clearActiveFriendCall]);

  const toggleMic = useCallback(() => {
    if (rtcManagerRef.current) {
      const active = rtcManagerRef.current.mediaManager.toggleMic();
      useCallStore.getState().setMicMuted(!active);
    }
  }, []);

  const toggleCamera = useCallback(() => {
    if (rtcManagerRef.current) {
      const active = rtcManagerRef.current.mediaManager.toggleCamera();
      useCallStore.getState().setCameraDisabled(!active);
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-slate-950 flex flex-col"
    >
      {/* Header badge */}
      <div className="absolute top-0 w-full h-20 bg-gradient-to-b from-black/70 to-transparent z-10 flex items-center px-6 space-x-3">
        <div className="w-8 h-8 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
          <Users className="w-4 h-4 text-emerald-400" />
        </div>
        <span className="text-white font-semibold text-sm tracking-wide drop-shadow-md">Friend Call</span>
        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/30 animate-pulse">
          LIVE
        </span>
      </div>

      {/* Remote video — full screen */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
          remoteStream ? "opacity-100 blur-0" : "opacity-20 blur-3xl"
        }`}
      />

      {/* Waiting overlay */}
      <AnimatePresence>
        {!remoteStream && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/40 backdrop-blur-md space-y-4"
          >
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full" />
              <div className="absolute inset-0 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-white text-xl font-light tracking-widest">CONNECTING</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Local PiP */}
      {localStream && (
        <div className="absolute top-24 right-6 w-32 h-44 sm:w-40 sm:h-56 rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] bg-black z-20 ring-1 ring-white/10">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover -scale-x-100"
          />
          <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] pointer-events-none rounded-3xl" />
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center space-x-4 px-6 py-3 rounded-3xl bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl">
          <button
            onClick={toggleMic}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all active:scale-95 ${
              isMicMuted
                ? "bg-red-600/80 hover:bg-red-500 border border-red-500/50"
                : "bg-white/10 hover:bg-white/20 border border-white/10"
            }`}
          >
            {isMicMuted ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
          </button>

          <button
            onClick={handleHangUp}
            className="w-16 h-16 rounded-2xl bg-red-600 hover:bg-red-500 flex items-center justify-center shadow-xl border border-red-500/50 transition-all active:scale-95 shadow-red-600/30"
          >
            <PhoneOff className="w-6 h-6 text-white" />
          </button>

          <button
            onClick={toggleCamera}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all active:scale-95 ${
              isCameraDisabled
                ? "bg-red-600/80 hover:bg-red-500 border border-red-500/50"
                : "bg-white/10 hover:bg-white/20 border border-white/10"
            }`}
          >
            {isCameraDisabled ? <VideoOff className="w-5 h-5 text-white" /> : <Video className="w-5 h-5 text-white" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
