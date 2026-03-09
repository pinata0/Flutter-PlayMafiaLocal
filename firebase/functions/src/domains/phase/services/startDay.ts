/*
room을 조회합니다.
현재 night에서 day로 넘어갈 수 있는지 검사합니다.
phase.current = "day" 변경합니다
시작 시각/종료 예정 시각을 갱신합니다
갱신된 room을 반환합니다
*/

import {Timestamp} from "firebase-admin/firestore";

import {
  getRoomById,
  updateRoomPhase,
} from "../../../repositories/roomRepository";
import type {RoomDocument, RoomPhaseState} from "../../../models/room";

export interface StartDayInput {
  roomId: string;
  phaseEndsAt?: Timestamp | null;
}

export async function startDay(
  input: StartDayInput,
): Promise<RoomDocument> {
  const roomId = input.roomId.trim();

  if (!roomId) {
    throw new Error("Room ID is required.");
  }

  const room = await getRoomById(roomId);

  if (!room) {
    throw new Error("Room not found.");
  }

  validateDayStartable(room);

  const nextPhase = buildDayPhaseState(room, input.phaseEndsAt ?? null);
  await updateRoomPhase(room.roomId, nextPhase);

  const updatedRoom = await getRoomById(room.roomId);

  if (!updatedRoom) {
    throw new Error("Room was updated but could not be reloaded.");
  }

  return updatedRoom;
}

function validateDayStartable(room: RoomDocument): void {
  if (room.status !== "in_progress") {
    throw new Error("Day can only start while the game is in progress.");
  }

  if (room.status === "finished") {
    throw new Error("Cannot start day for a finished room.");
  }

  if (room.phase.current === "result") {
    throw new Error("Cannot start day from result phase.");
  }

  if (room.phase.current === "day") {
    throw new Error("Room is already in day phase.");
  }

  if (room.phase.current !== "night") {
    throw new Error("Day can only start after night phase.");
  }

  if (!room.roleAllocated) {
    throw new Error("Roles must be allocated before starting day.");
  }
}

function buildDayPhaseState(
  room: RoomDocument,
  phaseEndsAt: Timestamp | null,
): RoomPhaseState {
  const now = Timestamp.now();

  return {
    current: "day",
    dayNumber: room.phase.dayNumber,
    phaseStartedAt: now,
    phaseEndsAt,
  };
}