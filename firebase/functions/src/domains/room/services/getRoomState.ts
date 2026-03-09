/*
roomId, playerUid를 검증합니다
room을 조회합니다
player를 조회합니다
플레이어가 실제 그 room 소속인지 확인합니다
최신 뉴스 1개를 조회합니다
화면에서 바로 쓸 파생 상태를 반환합니다
*/
import {getRoomById} from "../../../repositories/roomRepository";
import {getPlayerByUid} from "../../../repositories/playerRepository";
import {getLatestNewsByRoomId} from "../../../repositories/newsRepository";
import type {RoomDocument} from "../../../models/room";
import type {PlayerDocument} from "../../../models/player";
import type {NewsDocument} from "../../../models/news";

export interface GetRoomStateInput {
  roomId: string;
  playerUid: string;
}

export interface RoomStateSummary {
  room: RoomDocument;
  player: PlayerDocument;
  latestNews: NewsDocument | null;
  derived: {
    isHost: boolean;
    isAlive: boolean;
    isNight: boolean;
    isDay: boolean;
    isWaiting: boolean;
    isFinished: boolean;
    canSubmitQr: boolean;
  };
}

export async function getRoomState(
  input: GetRoomStateInput,
): Promise<RoomStateSummary> {
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

  const player = await getPlayerByUid(playerUid);

  if (!player) {
    throw new Error("Player not found.");
  }

  validatePlayerRoomState(room, player, roomId);

  const latestNews = await getLatestNewsByRoomId(room.roomId);

  return {
    room,
    player,
    latestNews,
    derived: buildDerivedRoomState(room, player),
  };
}

function validatePlayerRoomState(
  room: RoomDocument,
  player: PlayerDocument,
  expectedRoomId: string,
): void {
  if (player.roomId !== expectedRoomId) {
    throw new Error("Player does not belong to this room.");
  }

  if (!room.playerUids.includes(player.playerUid)) {
    throw new Error("Player is not in this room.");
  }
}

function buildDerivedRoomState(
  room: RoomDocument,
  player: PlayerDocument,
): RoomStateSummary["derived"] {
  const isHost = room.hostUid === player.playerUid;
  const isAlive = player.lifeState === "alive";
  const isNight = room.phase.current === "night";
  const isDay = room.phase.current === "day";
  const isWaiting = room.status === "waiting";
  const isFinished = room.status === "finished";

  const canSubmitQr =
    room.status === "in_progress" &&
    room.phase.current === "night" &&
    room.roleAllocated &&
    isAlive &&
    !player.taskState.hasSubmittedTonight;

  return {
    isHost,
    isAlive,
    isNight,
    isDay,
    isWaiting,
    isFinished,
    canSubmitQr,
  };
}