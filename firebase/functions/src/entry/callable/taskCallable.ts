import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import {
  submitQrScan,
  type SubmitQrScanInput,
} from "../../domains/task/services/submitQrScan";

export const submitQrScanCallable = onCall(async (request) => {
  try {
    const input = parseSubmitQrScanInput(request.data);
    const result = await submitQrScan(input);

    return {
      ok: true,
      result,
    };
  } catch (error: unknown) {
    logger.error("submitQrScanCallable failed", error);
    throw toHttpsError(error);
  }
});

function parseSubmitQrScanInput(data: unknown): SubmitQrScanInput {
  const roomId = getRequiredString(data, "roomId");
  const playerUid = getRequiredString(data, "playerUid");
  const scanCode = getRequiredString(data, "scanCode");

  return {
    roomId,
    playerUid,
    scanCode,
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