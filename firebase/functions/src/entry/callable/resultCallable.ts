import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import {
  checkWinCondition,
  type CheckWinConditionInput,
} from "../../domains/result/services/checkWinCondition";
import {
  finalizeGame,
  type FinalizeGameInput,
} from "../../domains/result/services/finalizeGame";

export const checkWinConditionCallable = onCall(async (request) => {
  try {
    const input = parseCheckWinConditionInput(request.data);
    const result = await checkWinCondition(input);

    return {
      ok: true,
      result,
    };
  } catch (error: unknown) {
    logger.error("checkWinConditionCallable failed", error);
    throw toHttpsError(error);
  }
});

export const finalizeGameCallable = onCall(async (request) => {
  try {
    const input = parseFinalizeGameInput(request.data);
    const room = await finalizeGame(input);

    return {
      ok: true,
      room,
    };
  } catch (error: unknown) {
    logger.error("finalizeGameCallable failed", error);
    throw toHttpsError(error);
  }
});

function parseCheckWinConditionInput(data: unknown): CheckWinConditionInput {
  const roomId = getRequiredString(data, "roomId");

  return {
    roomId,
  };
}

function parseFinalizeGameInput(data: unknown): FinalizeGameInput {
  const roomId = getRequiredString(data, "roomId");
  const winnerTeam = getWinnerTeam(data, "winnerTeam");

  return {
    roomId,
    winnerTeam,
  };
}

function getWinnerTeam(
  data: unknown,
  key: string,
): "citizen" | "mafia" {
  const value = getRequiredString(data, key);

  if (value !== "citizen" && value !== "mafia") {
    throw new HttpsError(
      "invalid-argument",
      `${key} must be either "citizen" or "mafia".`,
    );
  }

  return value;
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