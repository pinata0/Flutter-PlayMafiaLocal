/*
room을 조회합니다
player를 조회합니다
제출 가능한 상태인지 검사합니다
taskState를 갱신합니다
결과를 반환합니다
*/

import {Timestamp} from "firebase-admin/firestore";

import {getRoomById} from "../../../repositories/roomRepository";
import {
  getPlayerByUid,
  updatePlayerTaskState,
} from "../../../repositories/playerRepository";
import type {RoomDocument} from "../../../models/room";
import type {PlayerDocument, PlayerTaskState} from "../../../models/player";

export interface SubmitQrScanInput {
  roomId: string;
  playerUid: string;
  scanCode: string;
}

export interface SubmitQrScanResult {
  roomId: string;
  playerUid: string;
  accepted: true;
  submittedAt: Timestamp;
  scanCode: string;
}

export async function submitQrScan(
  input: SubmitQrScanInput,
): Promise<SubmitQrScanResult> {
  const roomId = input.roomId.trim();
  const playerUid = input.playerUid.trim();
  const scanCode = input.scanCode.trim();

  if (!roomId) {
    throw new Error("Room ID is required.");
  }

  if (!playerUid) {
    throw new Error("Player UID is required.");
  }

  if (!scanCode) {
    throw new Error("Scan code is required.");
  }

  const room = await getRoomById(roomId);

  if (!room) {
    throw new Error("Room not found.");
  }

  const player = await getPlayerByUid(playerUid);

  if (!player) {
    throw new Error("Player not found.");
  }

  validateQrSubmission(room, player, roomId);

  const submittedAt = Timestamp.now();
  const nextTaskState: PlayerTaskState = {
    hasSubmittedTonight: true,
    lastSubmittedAt: submittedAt,
    lastScanCode: scanCode,
  };

  await updatePlayerTaskState(player.playerUid, nextTaskState);

  return {
    roomId: room.roomId,
    playerUid: player.playerUid,
    accepted: true,
    submittedAt,
    scanCode,
  };
}

function validateQrSubmission(
  room: RoomDocument,
  player: PlayerDocument,
  expectedRoomId: string,
): void {
  if (room.status !== "in_progress") {
    throw new Error("Tasks can only be submitted while the game is in progress.");
  }

  if (room.phase.current !== "night") {
    throw new Error("QR scan can only be submitted during night phase.");
  }

  if (!room.roleAllocated) {
    throw new Error("Roles must be allocated before submitting tasks.");
  }

  if (player.roomId !== expectedRoomId) {
    throw new Error("Player does not belong to this room.");
  }

  if (!room.playerUids.includes(player.playerUid)) {
    throw new Error("Player is not in this room.");
  }

  if (player.lifeState !== "alive") {
    throw new Error("Dead players cannot submit tasks.");
  }

  if (player.taskState.hasSubmittedTonight) {
    throw new Error("Player has already submitted a QR scan tonight.");
  }
}