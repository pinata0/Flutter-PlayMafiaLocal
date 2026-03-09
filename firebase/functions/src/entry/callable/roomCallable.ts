/*
Flutter가 callable function을 호출
입력값 파싱
service 호출
성공 시 { ok: true, room } 반환
실패 시 HttpsError로 변환해서 클라이언트에 전달
*/

import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import {
  getRoomState,
  type GetRoomStateInput,
} from "../../domains/room/services/getRoomState";
import {
  createRoom,
} from "../../domains/room/services/createRoom";
import {
  joinRoom,
} from "../../domains/room/services/joinRoom";
import {
  leaveRoom,
} from "../../domains/room/services/leaveRoom";
import type {
  CreateRoomInput,
  JoinRoomInput,
  LeaveRoomInput,
} from "../../models/room";



export const createRoomCallable = onCall(async (request) => {
  try {
    const input = parseCreateRoomInput(request.data);
    const room = await createRoom(input);

    return {
      ok: true,
      room,
    };
  } catch (error: unknown) {
    logger.error("createRoomCallable failed", error);
    throw toHttpsError(error);
  }
});

export const joinRoomCallable = onCall(async (request) => {
  try {
    const input = parseJoinRoomInput(request.data);
    const room = await joinRoom(input);

    return {
      ok: true,
      room,
    };
  } catch (error: unknown) {
    logger.error("joinRoomCallable failed", error);
    throw toHttpsError(error);
  }
});

export const leaveRoomCallable = onCall(async (request) => {
  try {
    const input = parseLeaveRoomInput(request.data);
    const room = await leaveRoom(input);

    return {
      ok: true,
      room,
    };
  } catch (error: unknown) {
    logger.error("leaveRoomCallable failed", error);
    throw toHttpsError(error);
  }
});

export const getRoomStateCallable = onCall(async (request) => {
  try {
    const input = parseGetRoomStateInput(request.data);
    const state = await getRoomState(input);

    return {
      ok: true,
      state,
    };
  } catch (error: unknown) {
    logger.error("getRoomStateCallable failed", error);
    throw toHttpsError(error);
  }
});

function parseCreateRoomInput(data: unknown): CreateRoomInput {
  const title = getRequiredString(data, "title");
  const hostUid = getRequiredString(data, "hostUid");
  const nickname = getRequiredString(data, "nickname");
  const color = getRequiredString(data, "color");
  const minPlayers = getOptionalNumber(data, "minPlayers");
  const maxPlayers = getOptionalNumber(data, "maxPlayers");

  return {
    title,
    hostUid,
    nickname,
    color,
    minPlayers,
    maxPlayers,
  };
}

function parseJoinRoomInput(data: unknown): JoinRoomInput {
  const roomCode = getRequiredString(data, "roomCode");
  const playerUid = getRequiredString(data, "playerUid");
  const nickname = getRequiredString(data, "nickname");
  const color = getRequiredString(data, "color");

  return {
    roomCode,
    playerUid,
    nickname,
    color,
  };
}

function parseLeaveRoomInput(data: unknown): LeaveRoomInput {
  const roomId = getRequiredString(data, "roomId");
  const playerUid = getRequiredString(data, "playerUid");

  return {
    roomId,
    playerUid,
  };
}

function parseGetRoomStateInput(data: unknown): GetRoomStateInput {
  const roomId = getRequiredString(data, "roomId");
  const playerUid = getRequiredString(data, "playerUid");

  return {
    roomId,
    playerUid,
  };
}

function getRequiredString(data: unknown, key: string): string {
  if (!isRecord(data)) {
    throw new HttpsError("invalid-argument", "Request data must be an object.");
  }

  const value = data[key];

  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `${key} must be a string.`);
  }

  if (!value.trim()) {
    throw new HttpsError("invalid-argument", `${key} is required.`);
  }

  return value;
}

function getOptionalNumber(data: unknown, key: string): number | undefined {
  if (!isRecord(data)) {
    throw new HttpsError("invalid-argument", "Request data must be an object.");
  }

  const value = data[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new HttpsError("invalid-argument", `${key} must be a number.`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toHttpsError(error: unknown): HttpsError {
  if (error instanceof HttpsError) {
    return error;
  }

  if (error instanceof Error) {
    return new HttpsError("internal", error.message);
  }

  return new HttpsError("internal", "Unknown server error.");
}