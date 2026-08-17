"use client";

import { useCallStore } from "@/store/useCallStore";
import { Mic, MicOff, Video, VideoOff, SkipForward, Power } from "lucide-react";

interface CallControlsProps {
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onSkip: () => void;
  onStop: () => void;
}

export function CallControls({ onToggleMic, onToggleCamera, onSkip, onStop }: CallControlsProps) {
  const isMicMuted = useCallStore((s) => s.isMicMuted);
  const isCameraDisabled = useCallStore((s) => s.isCameraDisabled);
  const status = useCallStore((s) => s.status);

  const canSkip = status === "connected" || status === "searching" || status === "connecting" || status === "peer_disconnected";

  return (
    <div className="flex items-center justify-center space-x-4 p-4 rounded-full bg-slate-950/60 backdrop-blur-2xl border border-white/10 shadow-2xl">
      {/* Microphone Toggle */}
      <button
        onClick={onToggleMic}
        className={`p-4 rounded-full transition-all ${
          isMicMuted
            ? "bg-red-500/80 hover:bg-red-500 text-white"
            : "bg-white/10 hover:bg-white/20 text-white"
        }`}
        title={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
      >
        {isMicMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
      </button>

      {/* Camera Toggle */}
      <button
        onClick={onToggleCamera}
        className={`p-4 rounded-full transition-all ${
          isCameraDisabled
            ? "bg-red-500/80 hover:bg-red-500 text-white"
            : "bg-white/10 hover:bg-white/20 text-white"
        }`}
        title={isCameraDisabled ? "Turn On Camera" : "Turn Off Camera"}
      >
        {isCameraDisabled ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
      </button>

      {/* Stop Matching Button */}
      <button
        onClick={onStop}
        className="p-4 rounded-full bg-red-600/90 hover:bg-red-500 text-white transition-all shadow-lg shadow-red-500/30"
        title="Stop Searching / End Chat"
      >
        <Power className="w-6 h-6" />
      </button>

      {/* Skip Button */}
      <button
        onClick={onSkip}
        disabled={!canSkip}
        className="px-6 py-4 rounded-full bg-indigo-600/90 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-white transition-all shadow-lg shadow-indigo-500/30 flex items-center space-x-2"
        title="Next Stranger (Skip)"
      >
        <span>Next</span>
        <SkipForward className="w-5 h-5" />
      </button>
    </div>
  );
}
