import {Timestamp} from "firebase-admin/firestore";

export type PlayerTeam = "citizen" | "mafia" | "neutral";
export type PlayerRole =
  | "citizen"
  | "mafia"
  | "police"
  | "doctor"
  | "reporter"
  | "none";

export type PlayerLifeState = "alive" | "dead";
export type PlayerConnectionState = "connected" | "disconnected";

export interface PlayerProfile {
  nickname: string;
  color: string;
}

export interface PlayerRoleState {
  team: PlayerTeam;
  role: PlayerRole;
  assignedAt: Timestamp | null;
  revealedToSelf: boolean;
}

export interface PlayerTaskState {
  hasSubmittedTonight: boolean;
  lastSubmittedAt: Timestamp | null;
  lastScanCode: string | null;
}

export interface PlayerPresenceState {
  connection: PlayerConnectionState;
  lastSeenAt: Timestamp | null;
}

export interface PlayerDocument {
  playerUid: string;
  roomId: string;

  profile: PlayerProfile;

  lifeState: PlayerLifeState;
  eliminatedAt: Timestamp | null;

  roleState: PlayerRoleState;
  taskState: PlayerTaskState;
  presence: PlayerPresenceState;

  joinedAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreatePlayerInput {
  playerUid: string;
  roomId: string;
  nickname: string;
  color: string;
}

export function createInitialPlayerRoleState(): PlayerRoleState {
  return {
    team: "citizen",
    role: "none",
    assignedAt: null,
    revealedToSelf: false,
  };
}

export function createInitialPlayerTaskState(): PlayerTaskState {
  return {
    hasSubmittedTonight: false,
    lastSubmittedAt: null,
    lastScanCode: null,
  };
}

export function createInitialPlayerPresenceState(): PlayerPresenceState {
  return {
    connection: "connected",
    lastSeenAt: null,
  };
}