/*
roomId, playerUid를 검증합니다
방을 조회합니다
해당 플레이어가 실제로 방에 있는지 검사합니다
마지막 한 명이 나가는 경우 방 자체를 삭제합니다
아니라면 playerUids, alivePlayerUids, eliminatedPlayerUids에서 제거합니다
방장이 나간 경우 남은 첫 번째 플레이어를 새 방장으로 지정합니다
갱신된 room 문서를 반환합니다
*/

import {
  deleteRoom,
  getRoomById,
  removePlayerUidFromRoom,
  updateRoom,
} from "../../../repositories/roomRepository";
import type {LeaveRoomInput, RoomDocument} from "../../../models/room";

export async function leaveRoom(
  input: LeaveRoomInput,
): Promise<RoomDocument | null> {
  const roomId = input.roomId.trim();
  const playerUid = input.playerUid.trim();

  if (!roomId) {
    throw new Error("Room ID is required.");
  }

  if (!playerUid) {
    throw new Error("Player UID is required.");
  }

  const room = await getRoomById(roomId);

  if (!room) {
    throw new Error("Room not found.");
  }

  validateLeaveableRoom(room, playerUid);

  const remainingPlayerUids = room.playerUids.filter((uid) => uid !== playerUid);

  if (remainingPlayerUids.length === 0) {
    await deleteRoom(room.roomId);
    return null;
  }

  await removePlayerUidFromRoom(room.roomId, playerUid);

  if (room.hostUid === playerUid) {
    const nextHostUid = remainingPlayerUids[0];

    await updateRoom(room.roomId, {
      hostUid: nextHostUid,
    });
  }

  const updatedRoom = await getRoomById(room.roomId);

  if (!updatedRoom) {
    throw new Error("Room was updated but could not be reloaded.");
  }

  return updatedRoom;
}

function validateLeaveableRoom(room: RoomDocument, playerUid: string): void {
  if (!room.playerUids.includes(playerUid)) {
    throw new Error("Player is not in this room.");
  }

  if (room.status === "finished") {
    throw new Error("Cannot leave a finished room.");
  }
}