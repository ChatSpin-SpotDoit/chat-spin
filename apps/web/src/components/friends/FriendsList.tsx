"use client";

import { Phone, UserMinus, MessageCircle } from "lucide-react";
import { PresenceState } from "@chatspin/shared";

export interface FriendItem {
  friendshipId: string;
  friendSessionId: string;
  presence: PresenceState | "online" | "busy" | "offline";
}

interface FriendsListProps {
  friends: FriendItem[];
  onCallFriend: (friendshipId: string) => void;
  onUnfriend: (friendshipId: string) => void;
  onMessage: (friendshipId: string) => void;
}

export function FriendsList({ friends, onCallFriend, onUnfriend, onMessage }: FriendsListProps) {
  return (
    <div className="w-full space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
        Friends ({friends.length})
      </h3>

      {friends.length === 0 ? (
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl text-center text-xs text-slate-500">
          No friends yet. Talk for 5 minutes during a video chat to become friends automatically!
        </div>
      ) : (
        <div className="space-y-2">
          {friends.map((friend) => {
            const isOnline = friend.presence === PresenceState.ONLINE;
            const isBusy = friend.presence === PresenceState.BUSY;

            return (
              <div
                key={friend.friendshipId}
                className="p-3 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-between shadow-sm hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-sm border border-indigo-500/30">
                      F
                    </div>
                    {/* Presence Dot Indicator */}
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-950 ${
                        isOnline
                          ? "bg-emerald-500"
                          : isBusy
                          ? "bg-amber-500"
                          : "bg-slate-600"
                      }`}
                    />
                  </div>

                  <div>
                    <span className="text-sm font-semibold text-slate-200 block">
                      Friend ({friend.friendSessionId.slice(0, 6)})
                    </span>
                    <span className="text-xs text-slate-500 capitalize">
                      {friend.presence}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onMessage(friend.friendshipId)}
                    className="p-2.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 rounded-xl transition-all border border-indigo-500/20"
                    title="Send Message"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onCallFriend(friend.friendshipId)}
                    disabled={!isOnline}
                    className="p-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-md"
                    title={isOnline ? "Call Friend" : isBusy ? "Friend in another call" : "Friend offline"}
                  >
                    <Phone className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onUnfriend(friend.friendshipId)}
                    className="p-2.5 bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 rounded-xl transition-all border border-slate-700"
                    title="Unfriend"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
