"use client";

import { useCallStore } from "@/store/useCallStore";
import { Mic, MicOff, Video, VideoOff, SkipForward } from "lucide-react";

interface CallControlsProps {
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onSkip: () => void;
}

export function CallControls({ onToggleMic, onToggleCamera, onSkip }: CallControlsProps) {
  const isMicMuted = useCallStore((s) => s.isMicMuted);
  const isCameraDisabled = useCallStore((s) => s.isCameraDisabled);
  const status = useCallStore((s) => s.status);

  const canSkip = status === "connected" || status === "searching" || status === "connecting" || status === "peer_disconnected";

  return (
    <div className="flex items-center justify-center space-x-4 py-4">
      {/* Microphone Toggle */}
      <button
        onClick={onToggleMic}
        className={`p-4 rounded-full transition-all shadow-lg ${
          isMicMuted
            ? "bg-red-600 hover:bg-red-500 text-white"
            : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
        }`}
        title={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
      >
        {isMicMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
      </button>

      {/* Camera Toggle */}
      <button
        onClick={onToggleCamera}
        className={`p-4 rounded-full transition-all shadow-lg ${
          isCameraDisabled
            ? "bg-red-600 hover:bg-red-500 text-white"
            : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
        }`}
        title={isCameraDisabled ? "Turn On Camera" : "Turn Off Camera"}
      >
        {isCameraDisabled ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
      </button>

      {/* Skip Button */}
      <button
        onClick={onSkip}
        disabled={!canSkip}
        className="px-6 py-4 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-white transition-all shadow-lg shadow-indigo-500/25 flex items-center space-x-2"
        title="Next Stranger (Skip)"
      >
        <span>Next Stranger</span>
        <SkipForward className="w-5 h-5" />
      </button>
    </div>
  );
}
