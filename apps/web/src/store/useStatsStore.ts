import { create } from "zustand";

interface StatsState {
  onlineCount: number;
  setOnlineCount: (count: number) => void;
}

export const useStatsStore = create<StatsState>((set) => ({
  onlineCount: 0,
  setOnlineCount: (count) => set({ onlineCount: count }),
}));
