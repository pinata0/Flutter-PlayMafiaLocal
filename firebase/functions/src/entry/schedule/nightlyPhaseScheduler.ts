import {Timestamp} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {onSchedule} from "firebase-functions/v2/scheduler";

import {db} from "../../shared/admin/firebaseAdmin";
import type {RoomDocument} from "../../models/room";
import {allocateRoles} from "../../domains/role/services/allocateRoles";
import {startNight} from "../../domains/phase/services/startNight";

const ROOMS_COLLECTION = "rooms";
const NIGHTLY_SCHEDULE = "0 0 * * *";
const TIME_ZONE = "Asia/Seoul";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_HOURS = 9;

export const nightlyPhaseScheduler = onSchedule(
  {
    schedule: NIGHTLY_SCHEDULE,
    timeZone: TIME_ZONE,
  },
  async () => {
    logger.info("nightlyPhaseScheduler started.");

    const rooms = await getNightlyTargetRooms();
    const phaseEndsAt = getNextKstSixAmTimestamp();

    let startedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const room of rooms) {
      try {
        const started = await processRoomForNightStart(room, phaseEndsAt);

        if (started) {
          startedCount += 1;
        } else {
          skippedCount += 1;
        }
      } catch (error: unknown) {
        failedCount += 1;
        logger.error("nightlyPhaseScheduler room processing failed", {
          roomId: room.roomId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info("nightlyPhaseScheduler finished.", {
      totalRooms: rooms.length,
      startedCount,
      skippedCount,
      failedCount,
    });
  },
);

async function getNightlyTargetRooms(): Promise<RoomDocument[]> {
  const snapshot = await db
    .collection(ROOMS_COLLECTION)
    .where("status", "in", ["waiting", "in_progress"])
    .get();

  return snapshot.docs.map((doc) => doc.data() as RoomDocument);
}

async function processRoomForNightStart(
  room: RoomDocument,
  phaseEndsAt: Timestamp,
): Promise<boolean> {
  if (room.status === "waiting") {
    if (room.playerUids.length < room.settings.minPlayers) {
      logger.info("Skipping waiting room: not enough players.", {
        roomId: room.roomId,
        playerCount: room.playerUids.length,
        minPlayers: room.settings.minPlayers,
      });
      return false;
    }

    if (room.phase.current !== "lobby") {
      logger.warn("Skipping waiting room: unexpected phase.", {
        roomId: room.roomId,
        phase: room.phase.current,
      });
      return false;
    }

    if (!room.roleAllocated) {
      await allocateRoles({
        roomId: room.roomId,
      });
    }

    await startNight({
      roomId: room.roomId,
      phaseEndsAt,
    });

    logger.info("Started first night for waiting room.", {
      roomId: room.roomId,
    });

    return true;
  }

  if (room.status === "in_progress") {
    if (room.phase.current !== "day") {
      logger.info("Skipping in-progress room: not in day phase.", {
        roomId: room.roomId,
        phase: room.phase.current,
      });
      return false;
    }

    await startNight({
      roomId: room.roomId,
      phaseEndsAt,
    });

    logger.info("Started next night for in-progress room.", {
      roomId: room.roomId,
    });

    return true;
  }

  return false;
}

function getNextKstSixAmTimestamp(): Timestamp {
  const now = new Date();
  const nowKst = new Date(now.getTime() + KST_OFFSET_HOURS * 60 * 60 * 1000);

  let targetUtcMs = Date.UTC(
    nowKst.getUTCFullYear(),
    nowKst.getUTCMonth(),
    nowKst.getUTCDate(),
    6 - KST_OFFSET_HOURS,
    0,
    0,
    0,
  );

  if (targetUtcMs <= now.getTime()) {
    targetUtcMs += ONE_DAY_MS;
  }

  return Timestamp.fromMillis(targetUtcMs);
}