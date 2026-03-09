// players 컬렉션에 대한 Firestore 읽기/쓰기 전용 파일

/*
플레이어 문서를 생성합니다
UID로 플레이어를 조회합니다
roomId 기준 플레이어 목록을 조회합니다
역할/행동/접속/생존 상태를 갱신합니다
플레이어를 삭제합니다
*/

import {
  Timestamp,
  type CollectionReference,
  type WriteBatch,
} from "firebase-admin/firestore";

import {db} from "../shared/admin/firebaseAdmin";
import type {
  PlayerConnectionState,
  PlayerDocument,
  PlayerLifeState,
  PlayerPresenceState,
  PlayerRoleState,
  PlayerTaskState,
} from "../models/player";

const PLAYERS_COLLECTION = "players";

function playersCollection(): CollectionReference {
  return db.collection(PLAYERS_COLLECTION);
}

export async function createPlayer(player: PlayerDocument): Promise<void> {
  await playersCollection().doc(player.playerUid).set(player);
}

export async function getPlayerByUid(
  playerUid: string,
): Promise<PlayerDocument | null> {
  const snapshot = await playersCollection().doc(playerUid).get();

  if (!snapshot.exists) {
    return null;
  }

  return snapshot.data() as PlayerDocument;
}

export async function getPlayersByRoomId(
  roomId: string,
): Promise<PlayerDocument[]> {
  const snapshot = await playersCollection()
    .where("roomId", "==", roomId)
    .get();

  return snapshot.docs.map((doc) => doc.data() as PlayerDocument);
}

export async function updatePlayer(
  playerUid: string,
  updates: Partial<PlayerDocument>,
): Promise<void> {
  await playersCollection().doc(playerUid).update({
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

export async function updatePlayerProfile(
  playerUid: string,
  profile: PlayerDocument["profile"],
): Promise<void> {
  await playersCollection().doc(playerUid).update({
    profile,
    updatedAt: Timestamp.now(),
  });
}

export async function updatePlayerRoleState(
  playerUid: string,
  roleState: PlayerRoleState,
): Promise<void> {
  await playersCollection().doc(playerUid).update({
    roleState,
    updatedAt: Timestamp.now(),
  });
}

export async function updatePlayerTaskState(
  playerUid: string,
  taskState: PlayerTaskState,
): Promise<void> {
  await playersCollection().doc(playerUid).update({
    taskState,
    updatedAt: Timestamp.now(),
  });
}

export async function updatePlayerPresence(
  playerUid: string,
  presence: PlayerPresenceState,
): Promise<void> {
  await playersCollection().doc(playerUid).update({
    presence,
    updatedAt: Timestamp.now(),
  });
}

export async function setPlayerConnectionState(
  playerUid: string,
  connection: PlayerConnectionState,
): Promise<void> {
  await playersCollection().doc(playerUid).update({
    presence: {
      connection,
      lastSeenAt: Timestamp.now(),
    },
    updatedAt: Timestamp.now(),
  });
}

export async function touchPlayerPresence(playerUid: string): Promise<void> {
  const player = await getPlayerByUid(playerUid);

  if (!player) {
    throw new Error("Player not found.");
  }

  await playersCollection().doc(playerUid).update({
    presence: {
      ...player.presence,
      lastSeenAt: Timestamp.now(),
    },
    updatedAt: Timestamp.now(),
  });
}

export async function setPlayerLifeState(
  playerUid: string,
  lifeState: PlayerLifeState,
): Promise<void> {
  await playersCollection().doc(playerUid).update({
    lifeState,
    eliminatedAt: lifeState === "dead" ? Timestamp.now() : null,
    updatedAt: Timestamp.now(),
  });
}

export async function markPlayerEliminated(playerUid: string): Promise<void> {
  const now = Timestamp.now();

  await playersCollection().doc(playerUid).update({
    lifeState: "dead",
    eliminatedAt: now,
    updatedAt: now,
  });
}

export async function resetPlayerTaskState(playerUid: string): Promise<void> {
  await playersCollection().doc(playerUid).update({
    taskState: {
      hasSubmittedTonight: false,
      lastSubmittedAt: null,
      lastScanCode: null,
    },
    updatedAt: Timestamp.now(),
  });
}

export async function deletePlayer(playerUid: string): Promise<void> {
  await playersCollection().doc(playerUid).delete();
}

export async function deletePlayersByRoomId(roomId: string): Promise<void> {
  const players = await getPlayersByRoomId(roomId);

  if (players.length === 0) {
    return;
  }

  const batch = db.batch();
  applyPlayerDeletes(batch, players);

  await batch.commit();
}

function applyPlayerDeletes(
  batch: WriteBatch,
  players: PlayerDocument[],
): void {
  for (const player of players) {
    batch.delete(playersCollection().doc(player.playerUid));
  }
}