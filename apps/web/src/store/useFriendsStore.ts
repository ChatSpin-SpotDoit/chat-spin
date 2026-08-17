import { create } from "zustand";
import type { FriendItem } from "@/components/friends/FriendsList";

export interface DmMessage {
  id: string;
  friendshipId: string;
  senderSessionId: string;
  content: string;
  sentAt: string;
}

export interface IncomingCall {
  callId: string;
  friendshipId: string;
  callerSessionId: string;
}

export interface FriendsStoreState {
  friends: FriendItem[];
  incomingCall: IncomingCall | null;
  activeFriendCallId: string | null;
  activeFriendCallRole: "offerer" | "answerer" | null;
  dmConversations: Record<string, DmMessage[]>; // keyed by friendshipId
  openDmFriendshipId: string | null;

  setFriends: (friends: FriendItem[]) => void;
  updateFriendPresence: (friendSessionId: string, presence: "online" | "busy" | "offline") => void;
  addFriend: (friend: FriendItem) => void;
  removeFriend: (friendshipId: string) => void;
  setIncomingCall: (call: IncomingCall | null) => void;
  setActiveFriendCall: (callId: string | null, role: "offerer" | "answerer" | null) => void;
  clearActiveFriendCall: () => void;
  addDmMessage: (friendshipId: string, msg: DmMessage) => void;
  setDmMessages: (friendshipId: string, msgs: DmMessage[]) => void;
  setOpenDmFriendshipId: (id: string | null) => void;
}

export const useFriendsStore = create<FriendsStoreState>((set) => ({
  friends: [],
  incomingCall: null,
  activeFriendCallId: null,
  activeFriendCallRole: null,
  dmConversations: {},
  openDmFriendshipId: null,

  setFriends: (friends) => set({ friends }),

  updateFriendPresence: (friendSessionId, presence) =>
    set((state) => ({
      friends: state.friends.map((f) =>
        f.friendSessionId === friendSessionId ? { ...f, presence } : f
      ),
    })),

  addFriend: (friend) =>
    set((state) => ({
      friends: state.friends.some((f) => f.friendshipId === friend.friendshipId)
        ? state.friends
        : [...state.friends, friend],
    })),

  removeFriend: (friendshipId) =>
    set((state) => ({
      friends: state.friends.filter((f) => f.friendshipId !== friendshipId),
    })),

  setIncomingCall: (incomingCall) => set({ incomingCall }),

  setActiveFriendCall: (callId, role) =>
    set({ activeFriendCallId: callId, activeFriendCallRole: role }),

  clearActiveFriendCall: () =>
    set({ activeFriendCallId: null, activeFriendCallRole: null }),

  addDmMessage: (friendshipId, msg) =>
    set((state) => ({
      dmConversations: {
        ...state.dmConversations,
        [friendshipId]: [...(state.dmConversations[friendshipId] ?? []), msg],
      },
    })),

  setDmMessages: (friendshipId, msgs) =>
    set((state) => ({
      dmConversations: {
        ...state.dmConversations,
        [friendshipId]: msgs,
      },
    })),

  setOpenDmFriendshipId: (id) => set({ openDmFriendshipId: id }),
}));
