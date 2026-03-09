/*
매일 오전 6시에 night phase인 방들을 정산하고 day phase로 넘기는 스케줄 함수
*/

import {Timestamp} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {onSchedule} from "firebase-functions/v2/scheduler";

import {db} from "../../shared/admin/firebaseAdmin";
import type {RoomDocument} from "../../models/room";
import {resolveNightAction} from "../../domains/task/services/resolveNightAction";
import {buildNightNews} from "../../domains/news/services/buildNightNews";
import {publishNews} from "../../domains/news/services/publishNews";
import {startDay} from "../../domains/phase/services/startDay";
import {checkWinCondition} from "../../domains/result/services/checkWinCondition";
import {finalizeGame} from "../../domains/result/services/finalizeGame";

const ROOMS_COLLECTION = "rooms";
const DAYTIME_SCHEDULE = "0 6 * * *";
const TIME_ZONE = "Asia/Seoul";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_HOURS = 9;

export const daytimePhaseScheduler = onSchedule(
  {
    schedule: DAYTIME_SCHEDULE,
    timeZone: TIME_ZONE,
  },
  async () => {
    logger.info("daytimePhaseScheduler started.");

    const rooms = await getDaytimeTargetRooms();
    const phaseEndsAt = getNextKstMidnightTimestamp();

    let startedCount = 0;
    let finishedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const room of rooms) {
      try {
        const result = await processRoomForDayStart(room, phaseEndsAt);

        if (result === "started") {
          startedCount += 1;
        } else if (result === "finished") {
          finishedCount += 1;
        } else {
          skippedCount += 1;
        }
      } catch (error: unknown) {
        failedCount += 1;
        logger.error("daytimePhaseScheduler room processing failed", {
          roomId: room.roomId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info("daytimePhaseScheduler finished.", {
      totalRooms: rooms.length,
      startedCount,
      finishedCount,
      skippedCount,
      failedCount,
    });
  },
);

async function getDaytimeTargetRooms(): Promise<RoomDocument[]> {
  const snapshot = await db
    .collection(ROOMS_COLLECTION)
    .where("status", "==", "in_progress")
    .get();

  return snapshot.docs
    .map((doc) => doc.data() as RoomDocument)
    .filter((room) => room.phase.current === "night");
}

type DayStartResult = "started" | "finished" | "skipped";

async function processRoomForDayStart(
  room: RoomDocument,
  phaseEndsAt: Timestamp,
): Promise<DayStartResult> {
  if (room.status !== "in_progress") {
    logger.info("Skipping room: game is not in progress.", {
      roomId: room.roomId,
      status: room.status,
    });
    return "skipped";
  }

  if (room.phase.current !== "night") {
    logger.info("Skipping room: not in night phase.", {
      roomId: room.roomId,
      phase: room.phase.current,
    });
    return "skipped";
  }

  const nightResult = await resolveNightAction({
    roomId: room.roomId,
  });

  const news = await buildNightNews({
    roomId: room.roomId,
    nightResult,
  });

  await publishNews({
    roomId: room.roomId,
    news,
  });

  const winResult = await checkWinCondition({
    roomId: room.roomId,
  });

  if (winResult.hasWinner) {
    await finalizeGame({
      roomId: room.roomId,
      winnerTeam: winResult.winnerTeam,
    });

    logger.info("Finished game instead of starting day.", {
      roomId: room.roomId,
      winnerTeam: winResult.winnerTeam,
    });

    return "finished";
  }

  await startDay({
    roomId: room.roomId,
    phaseEndsAt,
  });

  logger.info("Started day phase.", {
    roomId: room.roomId,
  });

  return "started";
}

function getNextKstMidnightTimestamp(): Timestamp {
  const now = new Date();
  const nowKst = new Date(now.getTime() + KST_OFFSET_HOURS * 60 * 60 * 1000);

  let targetUtcMs = Date.UTC(
    nowKst.getUTCFullYear(),
    nowKst.getUTCMonth(),
    nowKst.getUTCDate() + 1,
    0 - KST_OFFSET_HOURS,
    0,
    0,
    0,
  );

  if (targetUtcMs <= now.getTime()) {
    targetUtcMs += ONE_DAY_MS;
  }

  return Timestamp.fromMillis(targetUtcMs);
}