// 방 생성 규칙을 처리하고, 최종 RoomDocument를 만들어 repository에 저장합니다.

import {randomUUID} from "node:crypto";

import {Timestamp} from "firebase-admin/firestore";

import {
  createRoom as createRoomRecord,
  getRoomByCode,
} from "../../../repositories/roomRepository";
import {
  DEFAULT_ROOM_SETTINGS,
  createInitialRoomPhase,
  type CreateRoomInput,
  type RoomDocument,
} from "../../../models/room";

import {createPlayer, getPlayerByUid} from "../../../repositories/playerRepository";import {
  createInitialPlayerPresenceState,
  createInitialPlayerRoleState,
  createInitialPlayerTaskState,
  type PlayerDocument,
} from "../../../models/player";



const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_ROOM_CODE_RETRY = 10;

export async function createRoom(input: CreateRoomInput): Promise<RoomDocument> {
  const title = input.title.trim();
  const hostUid = input.hostUid.trim();

  const nickname = input.nickname.trim();
  const color = input.color.trim();

  if (!title) {
    throw new Error("Room title is required.");
  }

  if (!hostUid) {
    throw new Error("Host UID is required.");
  }

  if (!nickname) {
    throw new Error("Nickname is required.");
  }

  if (!color) {
    throw new Error("Color is required.");
  }

  const existingHostPlayer = await getPlayerByUid(hostUid);

  if (existingHostPlayer) {
    throw new Error("Host player already exists.");
  }

  const minPlayers = input.minPlayers ?? DEFAULT_ROOM_SETTINGS.minPlayers;
  const maxPlayers = input.maxPlayers ?? DEFAULT_ROOM_SETTINGS.maxPlayers;

  validatePlayerCountRange(minPlayers, maxPlayers);

  const roomCode = await generateUniqueRoomCode();
  const now = Timestamp.now();

  const room: RoomDocument = {
    roomId: randomUUID(),
    roomCode,

    title,
    hostUid,

    playerUids: [hostUid],
    alivePlayerUids: [hostUid],
    eliminatedPlayerUids: [],

    status: "waiting",
    phase: createInitialRoomPhase(),

    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      minPlayers,
      maxPlayers,
    },

    roleAllocated: false,
    winnerTeam: null,

    createdAt: now,
    updatedAt: now,
    startedAt: null,
    endedAt: null,
  };

  await createRoomRecord(room);
  await createPlayer(buildHostPlayerDocument(room.roomId, hostUid, nickname, color));
  return room;
}

function validatePlayerCountRange(minPlayers: number, maxPlayers: number): void {
  if (!Number.isInteger(minPlayers) || !Number.isInteger(maxPlayers)) {
    throw new Error("minPlayers and maxPlayers must be integers.");
  }

  if (minPlayers < 4) {
    throw new Error("minPlayers must be at least 4.");
  }

  if (maxPlayers > 8) {
    throw new Error("maxPlayers must be at most 8.");
  }

  if (maxPlayers < minPlayers) {
    throw new Error("maxPlayers must be greater than or equal to minPlayers.");
  }
}

async function generateUniqueRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_ROOM_CODE_RETRY; attempt += 1) {
    const code = generateRoomCode();
    const existingRoom = await getRoomByCode(code);

    if (!existingRoom) {
      return code;
    }
  }

  throw new Error("Failed to generate a unique room code.");
}

function generateRoomCode(): string {
  let code = "";

  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    const index = Math.floor(Math.random() * ROOM_CODE_CHARS.length);
    code += ROOM_CODE_CHARS[index];
  }

  return code;
}

function buildHostPlayerDocument(
  roomId: string,
  playerUid: string,
  nickname: string,
  color: string,
): PlayerDocument {
  const now = Timestamp.now();

  return {
    playerUid,
    roomId,

    profile: {
      nickname,
      color,
    },

    lifeState: "alive",
    eliminatedAt: null,

    roleState: createInitialPlayerRoleState(),
    taskState: createInitialPlayerTaskState(),
    presence: {
      ...createInitialPlayerPresenceState(),
      lastSeenAt: now,
    },

    joinedAt: now,
    updatedAt: now,
  };
}