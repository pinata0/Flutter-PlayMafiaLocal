import {Timestamp} from "firebase-admin/firestore";

export type RoomPhase = "lobby" | "night" | "day" | "result";
export type RoomStatus = "waiting" | "in_progress" | "finished";

export interface RoomSettings {
  minPlayers: number;
  maxPlayers: number;
  allowReconnect: boolean;
  autoKickDisconnected: boolean;
}

export interface RoomPhaseState {
  current: RoomPhase;
  dayNumber: number;
  phaseStartedAt: Timestamp | null;
  phaseEndsAt: Timestamp | null;
}

export interface RoomDocument {
  roomId: string;
  roomCode: string;

  title: string;
  hostUid: string;

  playerUids: string[];
  alivePlayerUids: string[];
  eliminatedPlayerUids: string[];

  status: RoomStatus;
  phase: RoomPhaseState;

  settings: RoomSettings;

  roleAllocated: boolean;
  winnerTeam: string | null;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  startedAt: Timestamp | null;
  endedAt: Timestamp | null;
}

export interface CreateRoomInput {
  title: string;
  hostUid: string;
  nickname: string;
  color: string;
  minPlayers?: number;
  maxPlayers?: number;
}

export interface JoinRoomInput {
  roomCode: string;
  playerUid: string;
  nickname: string;
  color: string;
}

export interface LeaveRoomInput {
  roomId: string;
  playerUid: string;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  minPlayers: 4,
  maxPlayers: 8,
  allowReconnect: true,
  autoKickDisconnected: false,
};

export function createInitialRoomPhase(): RoomPhaseState {
  return {
    current: "lobby",
    dayNumber: 0,
    phaseStartedAt: null,
    phaseEndsAt: null,
  };
}