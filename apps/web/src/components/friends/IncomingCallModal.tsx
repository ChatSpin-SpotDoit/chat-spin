"use client";

import { Phone, PhoneOff } from "lucide-react";

interface IncomingCallModalProps {
  isOpen: boolean;
  callerName: string;
  onAccept: () => void;
  onDecline: () => void;
}

export function IncomingCallModal({
  isOpen,
  callerName,
  onAccept,
  onDecline,
}: IncomingCallModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
        <div className="relative inline-block">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border-2 border-emerald-500/40 animate-pulse">
            <Phone className="w-10 h-10" />
          </div>
        </div>

        <div>
          <h3 className="text-xl font-bold text-slate-100">{callerName}</h3>
          <p className="text-sm text-emerald-400 font-medium mt-1">Incoming Video Call...</p>
        </div>

        <div className="flex items-center justify-center space-x-6 pt-2">
          {/* Decline Button */}
          <button
            onClick={onDecline}
            className="p-5 bg-red-600 hover:bg-red-500 text-white rounded-full transition-all shadow-lg shadow-red-600/30 flex items-center justify-center"
            title="Decline Call"
          >
            <PhoneOff className="w-7 h-7" />
          </button>

          {/* Accept Button */}
          <button
            onClick={onAccept}
            className="p-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center animate-bounce"
            title="Accept Call"
          >
            <Phone className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
}
