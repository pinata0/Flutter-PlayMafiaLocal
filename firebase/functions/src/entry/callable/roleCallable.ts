import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import {
  allocateRoles,
  type AllocateRolesInput,
} from "../../domains/role/services/allocateRoles";
import {
  getRoleView,
  type GetRoleViewInput,
} from "../../domains/role/services/getRoleView";

export const allocateRolesCallable = onCall(async (request) => {
  try {
    const auth = request.auth;
    ensureAuthenticated(auth);

    const input = parseAllocateRolesInput(request.data);

    // 권장:
    // allocateRoles가 호출자 권한을 검사할 수 있도록 actorUid를 넘기도록 확장
    const result = await allocateRoles({
      ...input,
      actorUid: auth.uid,
    } as AllocateRolesInput & {actorUid: string});

    return {
      ok: true,
      result,
    };
  } catch (error: unknown) {
    logger.error("allocateRolesCallable failed", {error});
    throw toHttpsError(error);
  }
});

export const getRoleViewCallable = onCall(async (request) => {
  try {
    const auth = request.auth;
    ensureAuthenticated(auth);

    const input = parseGetRoleViewInput(request.data, auth.uid);
    const view = await getRoleView(input);

    return {
      ok: true,
      view,
    };
  } catch (error: unknown) {
    logger.error("getRoleViewCallable failed", {error});
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

function parseGetRoleViewInput(
  data: unknown,
  authenticatedUid: string,
): GetRoleViewInput {
  const roomId = getRequiredString(data, "roomId");

  return {
    roomId,
    playerUid: authenticatedUid,
  };
}

function ensureAuthenticated(
  auth: {uid: string} | null | undefined,
): asserts auth is {uid: string} {
  if (!auth) {
    throw new HttpsError(
      "failed-precondition",
      "The function must be called while authenticated.",
    );
  }
}

function getRequiredString(data: unknown, key: string): string {
  if (!isRecord(data)) {
    throw new HttpsError("invalid-argument", "Request data must be an object.");
  }

  const value = data[key];

  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `${key} must be a string.`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new HttpsError("invalid-argument", `${key} is required.`);
  }

  return trimmed;
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