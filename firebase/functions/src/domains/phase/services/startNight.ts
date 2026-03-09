/*
room을 조회합니다
night로 바꿀 수 있는 상태인지 검사합니다
방 안의 모든 플레이어의 밤 행동 상태를 초기화합니다
waiting 상태였다면 게임 시작 처리합니다
room phase를 night로 변경합니다
갱신된 room을 반환합니다
*/

import {Timestamp} from "firebase-admin/firestore";

import {
  getRoomById,
  markRoomStarted,
  updateRoomPhase,
} from "../../../repositories/roomRepository";
import {
  getPlayersByRoomId,
  resetPlayerTaskState,
} from "../../../repositories/playerRepository";
import type {RoomDocument, RoomPhaseState} from "../../../models/room";

export interface StartNightInput {
  roomId: string;
  phaseEndsAt?: Timestamp | null;
}

export async function startNight(
  input: StartNightInput,
): Promise<RoomDocument> {
  const roomId = input.roomId.trim();

  if (!roomId) {
    throw new Error("Room ID is required.");
  }

  const room = await getRoomById(roomId);

  if (!room) {
    throw new Error("Room not found.");
  }

  validateNightStartable(room);

  const players = await getPlayersByRoomId(room.roomId);

  if (players.length === 0) {
    throw new Error("Cannot start night without players.");
  }

  await resetNightTaskStates(players.map((player) => player.playerUid));

  if (room.status === "waiting") {
    await markRoomStarted(room.roomId);
  }

  const nextPhase = buildNightPhaseState(room, input.phaseEndsAt ?? null);
  await updateRoomPhase(room.roomId, nextPhase);

  const updatedRoom = await getRoomById(room.roomId);

  if (!updatedRoom) {
    throw new Error("Room was updated but could not be reloaded.");
  }

  return updatedRoom;
}

function validateNightStartable(room: RoomDocument): void {
  if (room.status === "finished") {
    throw new Error("Cannot start night for a finished room.");
  }

  if (room.phase.current === "result") {
    throw new Error("Cannot start night from result phase.");
  }

  if (room.phase.current === "night") {
    throw new Error("Room is already in night phase.");
  }

  if (room.status === "waiting" &&
      room.playerUids.length < room.settings.minPlayers) {
    throw new Error("Not enough players to start the game.");
  }

  if (room.status === "waiting" && !room.roleAllocated) {
    throw new Error("Roles must be allocated before starting night.");
  }
}

function buildNightPhaseState(
  room: RoomDocument,
  phaseEndsAt: Timestamp | null,
): RoomPhaseState {
  const now = Timestamp.now();

  return {
    current: "night",
    dayNumber: getNextNightDayNumber(room),
    phaseStartedAt: now,
    phaseEndsAt,
  };
}

function getNextNightDayNumber(room: RoomDocument): number {
  if (room.phase.current === "lobby") {
    return 1;
  }

  if (room.phase.current === "day") {
    return room.phase.dayNumber + 1;
  }

  return room.phase.dayNumber;
}

async function resetNightTaskStates(playerUids: string[]): Promise<void> {
  await Promise.all(
    playerUids.map((playerUid) => resetPlayerTaskState(playerUid)),
  );
}