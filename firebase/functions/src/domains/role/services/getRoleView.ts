/**
 * RoleView service
 *
 * - roomId, playerUid를 검증합니다.
 * - room / player를 조회합니다.
 * - 플레이어가 실제 그 room 소속인지 확인합니다.
 * - room 내 player 목록을 조회한 뒤, 역할별 UI 파생 정보를 구성해 반환합니다.
 *
 * NOTE:
 * - 현재 scanCode는 임시로 "target playerUid"로 해석합니다.
 * - 경찰/기자 조사 결과는 별도 저장이 없으므로(lastScanCode 기반) 여기서 파생합니다.
 * - 서비스 레이어는 Error를 throw하고, callable(entry)에서 HttpsError로 변환하는 패턴을 따릅니다.
 */

import {getRoomById} from "../../../repositories/roomRepository";
import {
  getPlayerByUid,
  getPlayersByRoomId,
} from "../../../repositories/playerRepository";
import type {RoomDocument} from "../../../models/room";
import type {
  PlayerDocument,
  PlayerRole,
  PlayerTeam,
} from "../../../models/player";

export interface GetRoleViewInput {
  roomId: string;
  playerUid: string;
}

export interface PlayerPublicView {
  playerUid: string;
  nickname: string;
  color: string;
  lifeState: PlayerDocument["lifeState"];
}

export interface RoleActionView {
  hasSubmittedTonight: boolean;
  lastScanCode: string | null;
  targetPlayer: PlayerPublicView | null;

  // role별로 하나만 채워지는 것을 권장 (police=team, reporter=role)
  discoveredTeam: PlayerTeam | null;
  discoveredRole: PlayerRole | null;
}

export interface MafiaTeamView {
  mafiaPlayers: PlayerPublicView[];
  vote: {
    mafiaAliveCount: number;
    submittedCount: number;
    isTied: boolean;
    majorityScanCode: string | null;
    majorityTarget: PlayerPublicView | null;
  };
}

export interface FinalRevealView {
  players: Array<
    PlayerPublicView & {
      team: PlayerTeam;
      role: PlayerRole;
    }
  >;
}

export interface RoleViewSummary {
  room: RoomDocument;
  player: PlayerDocument;

  derived: {
    isAlive: boolean;
    isNight: boolean;
    isDay: boolean;
    isWaiting: boolean;
    isFinished: boolean;

    hasRole: boolean;
    isActionRole: boolean;
    canActTonight: boolean;
  };

  action: RoleActionView;

  mafia?: MafiaTeamView;
  finalReveal?: FinalRevealView;
}

export async function getRoleView(
  input: GetRoleViewInput,
): Promise<RoleViewSummary> {
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

  const players = await getPlayersByRoomId(room.roomId);

  // room.playerUids와 players collection의 싱크가 깨진 경우를 조기에 감지
  if (players.length !== room.playerUids.length) {
    throw new Error(
      "Player documents are missing. Room player list and players collection are out of sync.",
    );
  }

  // 역할/페이즈 파생 상태
  const isAlive = player.lifeState === "alive";
  const isNight = room.phase.current === "night";
  const isDay = room.phase.current === "day";
  const isWaiting = room.status === "waiting";
  const isFinished = room.status === "finished";

  const role = player.roleState.role;
  const hasRole = room.roleAllocated && role !== "none";
  const actionRole = isNightActionRole(role);

  const canActTonight =
    room.status === "in_progress" &&
    room.phase.current === "night" &&
    room.roleAllocated &&
    isAlive &&
    actionRole &&
    !player.taskState.hasSubmittedTonight;

  const action = buildRoleActionView(player, players);

  const result: RoleViewSummary = {
    room,
    player,
    derived: {
      isAlive,
      isNight,
      isDay,
      isWaiting,
      isFinished,

      hasRole,
      isActionRole: actionRole,
      canActTonight,
    },
    action,
  };

  // 마피아 전용 정보 (팀원 + 투표 현황)
  if (role === "mafia" && room.roleAllocated) {
    result.mafia = buildMafiaTeamView(players);
  }

  // 게임 종료 시 전체 역할 공개(리절트 화면)
  if (shouldRevealAllRoles(room)) {
    result.finalReveal = buildFinalRevealView(players);
  }

  return result;
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

function buildRoleActionView(
  player: PlayerDocument,
  players: PlayerDocument[],
): RoleActionView {
  const lastScanCode = player.taskState.lastScanCode ?? null;
  const target = resolveTargetPlayerFromScanCode(lastScanCode, players);
  const targetPlayer = target ? toPublicPlayer(target) : null;

  const role = player.roleState.role;

  switch (role) {
    case "police":
      return {
        hasSubmittedTonight: player.taskState.hasSubmittedTonight,
        lastScanCode,
        targetPlayer,
        discoveredTeam: target?.roleState.team ?? null,
        discoveredRole: null,
      };

    case "reporter":
      return {
        hasSubmittedTonight: player.taskState.hasSubmittedTonight,
        lastScanCode,
        targetPlayer,
        discoveredTeam: null,
        discoveredRole: target?.roleState.role ?? null,
      };

    // mafia/doctor는 UI에 대상만 보여주면 충분(결과 확정은 아침 뉴스/정산)
    case "mafia":
    case "doctor":
      return {
        hasSubmittedTonight: player.taskState.hasSubmittedTonight,
        lastScanCode,
        targetPlayer,
        discoveredTeam: null,
        discoveredRole: null,
      };

    case "citizen":
    case "none":
      return {
        hasSubmittedTonight: player.taskState.hasSubmittedTonight,
        lastScanCode,
        targetPlayer,
        discoveredTeam: null,
        discoveredRole: null,
      };

    default:
      return assertNever(role);
  }
}

function buildMafiaTeamView(players: PlayerDocument[]): MafiaTeamView {
  const mafiaAlivePlayers = players.filter(
    (p) => p.lifeState === "alive" && p.roleState.role === "mafia",
  );

  const mafiaPlayers = mafiaAlivePlayers.map(toPublicPlayer);

  const voteResult = selectMajorityScanCode(mafiaAlivePlayers);
  const majorityTarget = resolveTargetPlayerFromScanCode(
    voteResult.majorityScanCode,
    players,
  );

  return {
    mafiaPlayers,
    vote: {
      mafiaAliveCount: mafiaAlivePlayers.length,
      submittedCount: voteResult.submittedCount,
      isTied: voteResult.isTied,
      majorityScanCode: voteResult.majorityScanCode,
      majorityTarget: majorityTarget ? toPublicPlayer(majorityTarget) : null,
    },
  };
}

function buildFinalRevealView(players: PlayerDocument[]): FinalRevealView {
  return {
    players: players.map((p) => ({
      ...toPublicPlayer(p),
      team: p.roleState.team,
      role: p.roleState.role,
    })),
  };
}

function toPublicPlayer(player: PlayerDocument): PlayerPublicView {
  return {
    playerUid: player.playerUid,
    nickname: player.profile.nickname,
    color: player.profile.color,
    lifeState: player.lifeState,
  };
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

  return players.find((p) => p.playerUid === scanCode) ?? null;
}

function isNightActionRole(role: PlayerRole): boolean {
  return role === "mafia" || role === "doctor" || role === "police" || role === "reporter";
}

function shouldRevealAllRoles(room: RoomDocument): boolean {
  return room.status === "finished" || room.phase.current === "result";
}

function selectMajorityScanCode(players: PlayerDocument[]): {
  majorityScanCode: string | null;
  isTied: boolean;
  submittedCount: number;
} {
  const votes = new Map<string, number>();
  let submittedCount = 0;

  for (const player of players) {
    if (!player.taskState.hasSubmittedTonight) {
      continue;
    }

    const scanCode = player.taskState.lastScanCode;
    if (!scanCode) {
      continue;
    }

    submittedCount += 1;
    votes.set(scanCode, (votes.get(scanCode) ?? 0) + 1);
  }

  if (votes.size === 0) {
    return {majorityScanCode: null, isTied: false, submittedCount};
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
    return {majorityScanCode: null, isTied: true, submittedCount};
  }

  return {majorityScanCode: topScanCode, isTied: false, submittedCount};
}

function assertNever(value: never): never {
  throw new Error(`Unexpected role value: ${String(value)}`);
}
