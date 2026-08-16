"use client";

import { UserX, X } from "lucide-react";

interface BlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmBlock: () => void;
}

export function BlockModal({ isOpen, onClose, onConfirmBlock }: BlockModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative text-center">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg">
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
          <UserX className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-bold text-slate-100 mb-2">Block User?</h3>
        <p className="text-sm text-slate-400 mb-6">
          You will never be matched with this stranger again. Past chats will be hidden.
        </p>

        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirmBlock();
              onClose();
            }}
            className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-red-600/25"
          >
            Block User
          </button>
        </div>
      </div>
    </div>
  );
}
