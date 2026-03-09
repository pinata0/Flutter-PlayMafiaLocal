/*
resolveNightAction() 결과를 공개용 뉴스 데이터로 변환하는 서비스

roomId를 검증합니다
nightResult를 검증합니다
room 존재 여부를 확인합니다
사망자 유무에 따라 뉴스를 생성합니다
*/

import {Timestamp} from "firebase-admin/firestore";

import {getRoomById} from "../../../repositories/roomRepository";
import type {ResolveNightActionResult} from "../../task/services/resolveNightAction";

export interface BuildNightNewsInput {
  roomId: string;
  nightResult: ResolveNightActionResult;
}

export type NightNewsKind = "death" | "no_death";

export interface BuiltNightNews {
  roomId: string;
  kind: NightNewsKind;
  visibility: "public";
  dayNumber: number;
  headline: string;
  body: string;
  eliminatedPlayerUid: string | null;
  createdAt: Timestamp;
}

export async function buildNightNews(
  input: BuildNightNewsInput,
): Promise<BuiltNightNews> {
  const roomId = input.roomId.trim();
  const nightResult = input.nightResult;

  if (!roomId) {
    throw new Error("Room ID is required.");
  }

  if (!nightResult) {
    throw new Error("Night result is required.");
  }

  if (nightResult.roomId !== roomId) {
    throw new Error("Night result does not match the requested room.");
  }

  const room = await getRoomById(roomId);

  if (!room) {
    throw new Error("Room not found.");
  }

  const createdAt = Timestamp.now();

  if (nightResult.eliminatedPlayerUid) {
    return {
      roomId: room.roomId,
      kind: "death",
      visibility: "public",
      dayNumber: nightResult.dayNumber,
      headline: `${nightResult.eliminatedPlayerUid}가 사망하였습니다.`,
      body: buildDeathNewsBody(nightResult.dayNumber),
      eliminatedPlayerUid: nightResult.eliminatedPlayerUid,
      createdAt,
    };
  }

  return {
    roomId: room.roomId,
    kind: "no_death",
    visibility: "public",
    dayNumber: nightResult.dayNumber,
    headline: "지난 밤 아무도 사망하지 않았습니다.",
    body: buildNoDeathNewsBody(nightResult.dayNumber),
    eliminatedPlayerUid: null,
    createdAt,
  };
}

function buildDeathNewsBody(dayNumber: number): string {
  return `${dayNumber}일차 아침이 밝았습니다. 지난 밤 희생자가 발생했습니다.`;
}

function buildNoDeathNewsBody(dayNumber: number): string {
  return `${dayNumber}일차 아침이 밝았습니다. 지난 밤 눈에 띄는 희생자는 없었습니다.`;
}