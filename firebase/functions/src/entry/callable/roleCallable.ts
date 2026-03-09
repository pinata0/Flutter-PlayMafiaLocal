import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import {
  allocateRoles,
  type AllocateRolesInput,
} from "../../domains/role/services/allocateRoles";

export const allocateRolesCallable = onCall(async (request) => {
  try {
    const input = parseAllocateRolesInput(request.data);
    const result = await allocateRoles(input);

    return {
      ok: true,
      result,
    };
  } catch (error: unknown) {
    logger.error("allocateRolesCallable failed", error);
    throw toHttpsError(error);
  }
});

function parseAllocateRolesInput(data: unknown): AllocateRolesInput {
  const roomId = getRequiredString(data, "roomId");
  const force = getOptionalBoolean(data, "force");

  return {
    roomId,
    force,
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

function getOptionalBoolean(data: unknown, key: string): boolean | undefined {
  if (!isRecord(data)) {
    throw new HttpsError("invalid-argument", "Request data must be an object.");
  }

  const value = data[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new HttpsError("invalid-argument", `${key} must be a boolean.`);
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