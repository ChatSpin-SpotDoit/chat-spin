import { create } from "zustand";

export type CallStatus =
  | "idle"
  | "requesting_media"
  | "searching"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "connection_failed"
  | "peer_disconnected";

export interface CallStoreState {
  status: CallStatus;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMicMuted: boolean;
  isCameraDisabled: boolean;
  matchId: string | null;
  friendshipId: string | null;
  errorMessage: string | null;

  setStatus: (status: CallStatus) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setMicMuted: (muted: boolean) => void;
  setCameraDisabled: (disabled: boolean) => void;
  setMatchId: (matchId: string | null) => void;
  setFriendshipId: (friendshipId: string | null) => void;
  setErrorMessage: (msg: string | null) => void;
  resetCall: () => void;
}

export const useCallStore = create<CallStoreState>((set) => ({
  status: "idle",
  localStream: null,
  remoteStream: null,
  isMicMuted: false,
  isCameraDisabled: false,
  matchId: null,
  friendshipId: null,
  errorMessage: null,

  setStatus: (status) => set({ status }),
  setLocalStream: (localStream) => set({ localStream }),
  setRemoteStream: (remoteStream) => set({ remoteStream }),
  setMicMuted: (isMicMuted) => set({ isMicMuted }),
  setCameraDisabled: (isCameraDisabled) => set({ isCameraDisabled }),
  setMatchId: (matchId) => set({ matchId }),
  setFriendshipId: (friendshipId) => set({ friendshipId }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  resetCall: () =>
    set({
      status: "idle",
      remoteStream: null,
      matchId: null,
      errorMessage: null,
    }),
}));
