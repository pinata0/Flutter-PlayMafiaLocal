/*
roomCode, playerUid 입력을 정리합니다.
방 존재 여부를 확인합니다
참가 가능한 방인지 검사합니다
playerUids, alivePlayerUids에 플레이어를 추가합니다
갱신된 room 문서를 다시 읽어서 반환합니다
*/

import {Timestamp} from "firebase-admin/firestore";

import {
  addPlayerUidToRoom,
  getRoomByCode,
  getRoomById,
} from "../../../repositories/roomRepository";
import {
  createPlayer,
  getPlayerByUid,
} from "../../../repositories/playerRepository";
import type {JoinRoomInput, RoomDocument} from "../../../models/room";
import {
  createInitialPlayerPresenceState,
  createInitialPlayerRoleState,
  createInitialPlayerTaskState,
  type PlayerDocument,
} from "../../../models/player";

export async function joinRoom(input: JoinRoomInput): Promise<RoomDocument> {
  const roomCode = input.roomCode.trim().toUpperCase();
  const playerUid = input.playerUid.trim();
  const nickname = input.nickname.trim();
  const color = input.color.trim();

  if (!roomCode) {
    throw new Error("Room code is required.");
  }

  if (!playerUid) {
    throw new Error("Player UID is required.");
  }

  if (!nickname) {
    throw new Error("Nickname is required.");
  }

  if (!color) {
    throw new Error("Color is required.");
  }

  const room = await getRoomByCode(roomCode);

  if (!room) {
    throw new Error("Room not found.");
  }

  validateJoinableRoom(room, playerUid);

    const existingPlayer = await getPlayerByUid(playerUid);

  if (existingPlayer) {
    throw new Error("Player already exists.");
  }

  await addPlayerUidToRoom(room.roomId, playerUid);
  await createPlayer(buildPlayerDocument(room.roomId, playerUid, nickname, color));

  const updatedRoom = await getRoomById(room.roomId);

  if (!updatedRoom) {
    throw new Error("Room was updated but could not be reloaded.");
  }

  return updatedRoom;
}

function validateJoinableRoom(room: RoomDocument, playerUid: string): void {
  if (room.status !== "waiting") {
    throw new Error("This room is no longer accepting new players.");
  }

  if (room.playerUids.includes(playerUid)) {
    throw new Error("Player is already in this room.");
  }

  if (room.playerUids.length >= room.settings.maxPlayers) {
    throw new Error("Room is full.");
  }
}

function buildPlayerDocument(
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