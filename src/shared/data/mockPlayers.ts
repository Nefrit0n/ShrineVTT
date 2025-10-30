import type { PlayerPresence } from "@/features/players/components/PlayersOnline";

export const MOCK_PLAYERS: PlayerPresence[] = [
  {
    id: "player-1",
    name: "Liora",
    character: "Liora Valen",
    role: "GM",
    color: "#60a5fa"
  },
  {
    id: "player-2",
    name: "Thorne",
    character: "Thorne Ironsong",
    role: "Player",
    color: "#a855f7"
  },
  {
    id: "player-3",
    name: "Mira",
    character: "Mira Nightriver",
    role: "Player",
    color: "#34d399"
  }
];
