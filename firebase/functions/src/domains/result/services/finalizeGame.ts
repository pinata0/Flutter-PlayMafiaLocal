/*
방 상태를 finished로 바꾸고 phase를 result로 넘기는 마무리 서비스

room을 조회합니다
이미 끝난 게임이면 같은 승자일 때 그대로 반환합니다
아직 끝나지 않았으면 종료 가능한 상태인지 검사합니다
phase.current = "result"로 전환합니다
status = "finished", winnerTeam, endedAt을 반영합니다
갱신된 room을 반환합니다
*/

import {Timestamp} from "firebase-admin/firestore";

import {
  getRoomById,
  markRoomFinished,
  updateRoomPhase,
} from "../../../repositories/roomRepository";
import type {RoomDocument, RoomPhaseState} from "../../../models/room";
import type {WinnerTeam} from "./checkWinCondition";

export interface FinalizeGameInput {
  roomId: string;
  winnerTeam: Exclude<WinnerTeam, null>;
}

export async function finalizeGame(
  input: FinalizeGameInput,
): Promise<RoomDocument> {
  const roomId = input.roomId.trim();
  const winnerTeam = input.winnerTeam;

  if (!roomId) {
    throw new Error("Room ID is required.");
  }

  if (!winnerTeam) {
    throw new Error("Winner team is required.");
  }

  const room = await getRoomById(roomId);

  if (!room) {
    throw new Error("Room not found.");
  }

  const alreadyFinishedRoom = handleAlreadyFinishedRoom(room, winnerTeam);
  if (alreadyFinishedRoom) {
    return alreadyFinishedRoom;
  }

  validateFinalizableRoom(room);

  const resultPhase = buildResultPhaseState(room);
  await updateRoomPhase(room.roomId, resultPhase);
  await markRoomFinished(room.roomId, winnerTeam);

  const updatedRoom = await getRoomById(room.roomId);

  if (!updatedRoom) {
    throw new Error("Room was finalized but could not be reloaded.");
  }

  return updatedRoom;
}

function handleAlreadyFinishedRoom(
  room: RoomDocument,
  winnerTeam: Exclude<WinnerTeam, null>,
): RoomDocument | null {
  if (room.status !== "finished") {
    return null;
  }

  if (room.winnerTeam !== winnerTeam) {
    throw new Error("Room is already finished with a different winner.");
  }

  if (room.phase.current !== "result") {
    throw new Error("Finished room is not in result phase.");
  }

  return room;
}

function validateFinalizableRoom(room: RoomDocument): void {
  if (room.status === "waiting") {
    throw new Error("Cannot finalize a game that has not started.");
  }

  if (room.phase.current === "lobby") {
    throw new Error("Cannot finalize a game during lobby phase.");
  }
}

function buildResultPhaseState(room: RoomDocument): RoomPhaseState {
  const now = Timestamp.now();

  return {
    current: "result",
    dayNumber: room.phase.dayNumber,
    phaseStartedAt: now,
    phaseEndsAt: null,
  };
}