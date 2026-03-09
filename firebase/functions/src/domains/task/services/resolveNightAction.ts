/*
1. domitoryRoomCode 같은 필드가 아직 없고, 그때 function resolveTargetPlayerFromScanCode(...) 수정
2. 마피아 여러명이면 최다 득표 target, 동률이면 아무도 안 죽게
3. 경찰 결과 반환만 하고 저장 안함
*/

import {
  getRoomById,
  setAliveAndEliminatedPlayers,
} from "../../../repositories/roomRepository";
import {
  getPlayersByRoomId,
  markPlayerEliminated,
} from "../../../repositories/playerRepository";
import type {RoomDocument} from "../../../models/room";
import type {
  PlayerDocument,
  PlayerRole,
  PlayerTeam,
} from "../../../models/player";

export interface ResolveNightActionInput {
  roomId: string;
}

export interface InvestigationResult {
  actorUid: string;
  role: "police" | "reporter";
  scanCode: string;
  targetPlayerUid: string | null;
  discoveredTeam: PlayerTeam | null;
  discoveredRole: PlayerRole | null;
}

export interface ResolveNightActionResult {
  roomId: string;
  dayNumber: number;
  submittedCount: number;
  mafiaTargetPlayerUid: string | null;
  savedPlayerUid: string | null;
  eliminatedPlayerUid: string | null;
  investigations: InvestigationResult[];
}

export async function resolveNightAction(
  input: ResolveNightActionInput,
): Promise<ResolveNightActionResult> {
  const roomId = input.roomId.trim();

  if (!roomId) {
    throw new Error("Room ID is required.");
  }

  const room = await getRoomById(roomId);

  if (!room) {
    throw new Error("Room not found.");
  }

  validateNightResolvable(room);

  const players = await getPlayersByRoomId(room.roomId);
  const alivePlayers = players.filter((player) => player.lifeState === "alive");

  const mafiaActors = getSubmittedActorsByRole(alivePlayers, "mafia");
  const doctorActors = getSubmittedActorsByRole(alivePlayers, "doctor");
  const policeActors = getSubmittedActorsByRole(alivePlayers, "police");
  const reporterActors = getSubmittedActorsByRole(alivePlayers, "reporter");

  const mafiaTargetScanCode = selectMajorityTargetScanCode(mafiaActors);
  const mafiaTargetPlayer = resolveTargetPlayerFromScanCode(
    mafiaTargetScanCode,
    alivePlayers,
  );

  const doctorTargetPlayer = resolveTargetPlayerFromScanCode(
    getFirstSubmittedScanCode(doctorActors),
    alivePlayers,
  );

  const savedPlayerUid =
    mafiaTargetPlayer && doctorTargetPlayer &&
    mafiaTargetPlayer.playerUid === doctorTargetPlayer.playerUid ?
      doctorTargetPlayer.playerUid :
      null;

  let eliminatedPlayerUid: string | null = null;

  if (mafiaTargetPlayer && mafiaTargetPlayer.playerUid !== savedPlayerUid) {
    await markPlayerEliminated(mafiaTargetPlayer.playerUid);
    eliminatedPlayerUid = mafiaTargetPlayer.playerUid;

    const alivePlayerUids = room.alivePlayerUids.filter(
      (playerUid) => playerUid !== mafiaTargetPlayer.playerUid,
    );
    const eliminatedPlayerUids = room.eliminatedPlayerUids.includes(
      mafiaTargetPlayer.playerUid,
    ) ?
      room.eliminatedPlayerUids :
      [...room.eliminatedPlayerUids, mafiaTargetPlayer.playerUid];

    await setAliveAndEliminatedPlayers(
      room.roomId,
      alivePlayerUids,
      eliminatedPlayerUids,
    );
  }

  const investigations = [
    ...buildInvestigationResults(policeActors, alivePlayers, "police"),
    ...buildInvestigationResults(reporterActors, alivePlayers, "reporter"),
  ];

  return {
    roomId: room.roomId,
    dayNumber: room.phase.dayNumber,
    submittedCount: countSubmittedActions(alivePlayers),
    mafiaTargetPlayerUid: mafiaTargetPlayer?.playerUid ?? null,
    savedPlayerUid,
    eliminatedPlayerUid,
    investigations,
  };
}

function validateNightResolvable(room: RoomDocument): void {
  if (room.status !== "in_progress") {
    throw new Error("Night actions can only be resolved while the game is in progress.");
  }

  if (room.phase.current !== "night") {
    throw new Error("Night actions can only be resolved during night phase.");
  }

  if (!room.roleAllocated) {
    throw new Error("Roles must be allocated before resolving night actions.");
  }
}

function getSubmittedActorsByRole(
  players: PlayerDocument[],
  role: PlayerRole,
): PlayerDocument[] {
  return players.filter((player) =>
    player.roleState.role === role &&
    player.taskState.hasSubmittedTonight &&
    player.taskState.lastScanCode,
  );
}

function getFirstSubmittedScanCode(players: PlayerDocument[]): string | null {
  if (players.length === 0) {
    return null;
  }

  return players[0].taskState.lastScanCode ?? null;
}

function selectMajorityTargetScanCode(players: PlayerDocument[]): string | null {
  const votes = new Map<string, number>();

  for (const player of players) {
    const scanCode = player.taskState.lastScanCode;

    if (!scanCode) {
      continue;
    }

    votes.set(scanCode, (votes.get(scanCode) ?? 0) + 1);
  }

  if (votes.size === 0) {
    return null;
  }

  let topScanCode: string | null = null;
  let topCount = 0;
  let isTied = false;

  for (const [scanCode, count] of votes.entries()) {
    if (count > topCount) {
      topScanCode = scanCode;
      topCount = count;
      isTied = false;
      continue;
    }

    if (count === topCount) {
      isTied = true;
    }
  }

  if (isTied) {
    return null;
  }

  return topScanCode;
}

/**
 * Temporary rule:
 * - scanCode is treated as the target player's playerUid.
 * Replace this function later with dormitory-room / QR mapping logic.
 */
function resolveTargetPlayerFromScanCode(
  scanCode: string | null,
  players: PlayerDocument[],
): PlayerDocument | null {
  if (!scanCode) {
    return null;
  }

  return players.find((player) => player.playerUid === scanCode) ?? null;
}

function buildInvestigationResults(
  actors: PlayerDocument[],
  players: PlayerDocument[],
  role: "police" | "reporter",
): InvestigationResult[] {
  return actors.map((actor) => {
    const scanCode = actor.taskState.lastScanCode ?? "";
    const targetPlayer = resolveTargetPlayerFromScanCode(scanCode, players);

    return {
      actorUid: actor.playerUid,
      role,
      scanCode,
      targetPlayerUid: targetPlayer?.playerUid ?? null,
      discoveredTeam:
        role === "police" ? (targetPlayer?.roleState.team ?? null) : null,
      discoveredRole:
        role === "reporter" ? (targetPlayer?.roleState.role ?? null) : null,
    };
  });
}

function countSubmittedActions(players: PlayerDocument[]): number {
  return players.filter((player) => player.taskState.hasSubmittedTonight).length;
}