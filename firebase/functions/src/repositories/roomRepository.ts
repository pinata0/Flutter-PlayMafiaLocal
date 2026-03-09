// rooms 컬렉션에 대한 Firestore 읽기/쓰기를 담당합니다.
import {
  FieldValue,
  Timestamp,
  type CollectionReference,
} from "firebase-admin/firestore";

import {db} from "../shared/admin/firebaseAdmin";
import type {RoomDocument, RoomPhaseState, RoomStatus} from "../models/room";

const ROOMS_COLLECTION = "rooms";

function roomsCollection(): CollectionReference {
  return db.collection(ROOMS_COLLECTION);
}

export async function createRoom(room: RoomDocument): Promise<void> {
  await roomsCollection().doc(room.roomId).set(room);
}

export async function getRoomById(roomId: string): Promise<RoomDocument | null> {
  const snapshot = await roomsCollection().doc(roomId).get();

  if (!snapshot.exists) {
    return null;
  }

  return snapshot.data() as RoomDocument;
}

export async function getRoomByCode(
  roomCode: string,
): Promise<RoomDocument | null> {
  const snapshot = await roomsCollection()
    .where("roomCode", "==", roomCode)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].data() as RoomDocument;
}

export async function updateRoom(
  roomId: string,
  updates: Partial<RoomDocument>,
): Promise<void> {
  await roomsCollection().doc(roomId).update({
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

export async function updateRoomStatus(
  roomId: string,
  status: RoomStatus,
): Promise<void> {
  await roomsCollection().doc(roomId).update({
    status,
    updatedAt: Timestamp.now(),
  });
}

export async function updateRoomPhase(
  roomId: string,
  phase: RoomPhaseState,
): Promise<void> {
  await roomsCollection().doc(roomId).update({
    phase,
    updatedAt: Timestamp.now(),
  });
}

export async function addPlayerUidToRoom(
  roomId: string,
  playerUid: string,
): Promise<void> {
  await roomsCollection().doc(roomId).update({
    playerUids: FieldValue.arrayUnion(playerUid),
    alivePlayerUids: FieldValue.arrayUnion(playerUid),
    updatedAt: Timestamp.now(),
  });
}

export async function removePlayerUidFromRoom(
  roomId: string,
  playerUid: string,
): Promise<void> {
  await roomsCollection().doc(roomId).update({
    playerUids: FieldValue.arrayRemove(playerUid),
    alivePlayerUids: FieldValue.arrayRemove(playerUid),
    eliminatedPlayerUids: FieldValue.arrayRemove(playerUid),
    updatedAt: Timestamp.now(),
  });
}

export async function setAliveAndEliminatedPlayers(
  roomId: string,
  alivePlayerUids: string[],
  eliminatedPlayerUids: string[],
): Promise<void> {
  await roomsCollection().doc(roomId).update({
    alivePlayerUids,
    eliminatedPlayerUids,
    updatedAt: Timestamp.now(),
  });
}

export async function markRoomStarted(roomId: string): Promise<void> {
  const now = Timestamp.now();

  await roomsCollection().doc(roomId).update({
    status: "in_progress",
    startedAt: now,
    updatedAt: now,
  });
}

export async function markRoomFinished(
  roomId: string,
  winnerTeam: string | null,
): Promise<void> {
  const now = Timestamp.now();

  await roomsCollection().doc(roomId).update({
    status: "finished",
    winnerTeam,
    endedAt: now,
    updatedAt: now,
  });
}

export async function setRoleAllocated(
  roomId: string,
  roleAllocated: boolean,
): Promise<void> {
  await roomsCollection().doc(roomId).update({
    roleAllocated,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteRoom(roomId: string): Promise<void> {
  await roomsCollection().doc(roomId).delete();
}