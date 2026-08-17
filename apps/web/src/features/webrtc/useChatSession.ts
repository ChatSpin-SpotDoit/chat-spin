import { useEffect, useRef, useCallback } from "react";
import { wsClient } from "@/lib/wsClient";
import { WebRTCManager } from "./WebRTCManager";
import { useCallStore } from "@/store/useCallStore";
import { toast } from "sonner";

interface UseChatSessionOptions {
  isStarted: boolean;
  onChatMessageReceived?: (messageId: string, senderSessionId: string, content: string, sentAt: string) => void;
  onChatMessageDeleted?: (messageId: string, scope: string) => void;
}

export function useChatSession({ isStarted, onChatMessageReceived, onChatMessageDeleted }: UseChatSessionOptions) {
  const rtcManagerRef = useRef<WebRTCManager | null>(null);
  
  const callbacksRef = useRef({ onChatMessageReceived, onChatMessageDeleted });
  useEffect(() => {
    callbacksRef.current = { onChatMessageReceived, onChatMessageDeleted };
  }, [onChatMessageReceived, onChatMessageDeleted]);

  const skipMatch = useCallback(() => {
    const currentMatchId = useCallStore.getState().matchId;
    if (currentMatchId) {
      wsClient.send({
        type: "match:skip",
        matchId: currentMatchId,
        requestId: crypto.randomUUID(),
      });
    } else {
      // Rejoin queue
      wsClient.send({
        type: "queue:join",
        requestId: crypto.randomUUID(),
      });
    }
    if (rtcManagerRef.current) {
      rtcManagerRef.current.cleanupCall();
    }
    useCallStore.getState().resetCall();
    useCallStore.getState().setStatus("searching");
  }, []);

  // Create or retrieve manager
  const getManager = useCallback(() => {
    if (!rtcManagerRef.current) {
      rtcManagerRef.current = new WebRTCManager(wsClient, {
        onLocalStream: (stream) => useCallStore.getState().setLocalStream(stream),
        onRemoteStream: (stream) => useCallStore.getState().setRemoteStream(stream),
        onStatusChange: (newStatus) => {
          const statusMap = {
            searching: "searching",
            connecting: "connecting",
            connected: "connected",
            reconnecting: "reconnecting",
            failed: "connection_failed",
            peer_disconnected: "peer_disconnected",
          } as const;
          
          const mappedStatus = statusMap[newStatus];
          useCallStore.getState().setStatus(mappedStatus);

          // Show toasts for specific events
          if (mappedStatus === "reconnecting") {
            toast.warning("Connection interrupted. Reconnecting...", { id: "reconnect-toast" });
          } else if (mappedStatus === "connected") {
            toast.dismiss("reconnect-toast");
            toast.success("Connected!");
          } else if (mappedStatus === "peer_disconnected") {
            toast.info("Your partner left the chat.", { duration: 3000 });
          } else if (mappedStatus === "connection_failed") {
            toast.dismiss("reconnect-toast");
            toast.error("Connection failed. Finding a new partner...", { duration: 3000 });
            // Auto skip when connection fails
            skipMatch();
          }
        },
        onMatchFound: (mId) => useCallStore.getState().setMatchId(mId),
        onMatchSkipped: () => useCallStore.getState().resetCall(),
      });
    }
    return rtcManagerRef.current;
  }, [skipMatch]);

  useEffect(() => {
    if (!isStarted) {
      // Clean up when leaving chat mode
      if (rtcManagerRef.current) {
        rtcManagerRef.current.destroy();
        rtcManagerRef.current = null;
      }
      wsClient.disconnect();
      useCallStore.getState().resetCall();
      return;
    }

    // Starting chat
    let isCancelled = false;
    useCallStore.getState().setStatus("searching");
    
    const manager = getManager();

    // 1. Ask for media permissions first
    manager.initMedia()
      .then(() => {
        if (isCancelled) {
          manager.destroy();
          return;
        }

        // 2. Connect WebSocket
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws";
        wsClient.connect(wsUrl, {
          onSessionReady: () => {
            if (isCancelled) return;
            wsClient.send({
              type: "queue:join",
              requestId: crypto.randomUUID(),
            });

            // Load friends list once session is ready
            void loadFriends();
          },
          onServerMessage: (msg: any) => {
            if (msg.type === "chat:message") {
              callbacksRef.current.onChatMessageReceived?.(msg.messageId, msg.senderSessionId, msg.content, msg.sentAt);
            } else if (msg.type === "chat:message-delete" || msg.type === "chat:message-deleted") {
              callbacksRef.current.onChatMessageDeleted?.(msg.messageId, msg.scope);
            } else if (msg.type === "friend:auto-connected") {
              // Lazy-import store to avoid circular deps
              import("@/store/useFriendsStore").then(({ useFriendsStore }) => {
                useFriendsStore.getState().addFriend({
                  friendshipId: msg.friendshipId,
                  friendSessionId: msg.friendSessionId,
                  presence: "online",
                });
              });
              toast.success("🎉 You're now friends! Chat for 5 minutes pays off.", {
                description: "You can now message them later from your Meet History.",
                duration: 5000,
              });
            } else if (msg.type === "friend:incoming-call") {
              import("@/store/useFriendsStore").then(({ useFriendsStore }) => {
                useFriendsStore.getState().setIncomingCall({
                  callId: msg.callId,
                  friendshipId: msg.friendshipId,
                  callerSessionId: msg.callerSessionId,
                });
              });
            } else if (msg.type === "friend:call-connected") {
              import("@/store/useFriendsStore").then(({ useFriendsStore }) => {
                useFriendsStore.getState().setActiveFriendCall(msg.callId, msg.role);
                useFriendsStore.getState().setIncomingCall(null);
              });
            } else if (msg.type === "friend:call-declined") {
              import("@/store/useFriendsStore").then(({ useFriendsStore }) => {
                useFriendsStore.getState().setIncomingCall(null);
                useFriendsStore.getState().clearActiveFriendCall();
              });
              toast.info("Friend declined the call.");
            } else if (msg.type === "friend:call-ended") {
              import("@/store/useFriendsStore").then(({ useFriendsStore }) => {
                useFriendsStore.getState().clearActiveFriendCall();
              });
            } else if (msg.type === "friend:presence") {
              import("@/store/useFriendsStore").then(({ useFriendsStore }) => {
                useFriendsStore.getState().updateFriendPresence(msg.friendSessionId, msg.status);
              });
            } else if (msg.type === "friend:removed") {
              import("@/store/useFriendsStore").then(({ useFriendsStore }) => {
                useFriendsStore.getState().removeFriend(msg.friendshipId);
              });
            } else if (msg.type === "dm:message") {
              import("@/store/useFriendsStore").then(({ useFriendsStore }) => {
                useFriendsStore.getState().addDmMessage(msg.friendshipId, {
                  id: msg.messageId,
                  friendshipId: msg.friendshipId,
                  senderSessionId: msg.senderSessionId,
                  content: msg.content,
                  sentAt: msg.sentAt,
                });
              });
            } else {
              void manager.handleServerMessage(msg);
            }
          },
        });
      })
      .catch((err) => {
        if (!isCancelled) {
          toast.error(err.message || "Failed to access camera/microphone.");
          useCallStore.getState().setStatus("idle");
        }
      });

    return () => {
      isCancelled = true;
      if (rtcManagerRef.current) {
        rtcManagerRef.current.destroy();
        rtcManagerRef.current = null;
      }
      wsClient.disconnect();
      useCallStore.getState().resetCall();
    };
  }, [isStarted, getManager]);

  const toggleMic = useCallback(() => {
    if (rtcManagerRef.current) {
      const active = rtcManagerRef.current.mediaManager.toggleMic();
      useCallStore.getState().setMicMuted(!active);
      toast(active ? "Microphone unmuted" : "Microphone muted");
    }
  }, []);

  const toggleCamera = useCallback(() => {
    if (rtcManagerRef.current) {
      const active = rtcManagerRef.current.mediaManager.toggleCamera();
      useCallStore.getState().setCameraDisabled(!active);
      toast(active ? "Camera enabled" : "Camera disabled");
    }
  }, []);

  return {
    rtcManager: rtcManagerRef.current,
    toggleMic,
    toggleCamera,
    skipMatch,
  };
}

/**
 * Loads the friends list from the REST API using the persisted sessionId.
 */
async function loadFriends() {
  const sessionId =
    typeof window !== "undefined" ? localStorage.getItem("chatspin_session_id") : null;
  if (!sessionId) return;

  try {
    const res = await fetch("/api/friends", {
      headers: { "x-session-id": sessionId },
    });
    if (!res.ok) return;
    const data = await res.json() as { friends: Array<{ friendshipId: string; friendSessionId: string; presence: string }> };
    const { useFriendsStore } = await import("@/store/useFriendsStore");
    useFriendsStore.getState().setFriends(
      data.friends.map((f) => ({
        friendshipId: f.friendshipId,
        friendSessionId: f.friendSessionId,
        presence: f.presence as "online" | "busy" | "offline",
      }))
    );
  } catch {
    // Non-critical — friends list can be populated via WS events
  }
}
