/*
해당 room의 생존 플레이어 진영 수를 보고 승리 여부를 판정하는 서비스
*/

import {getRoomById} from "../../../repositories/roomRepository";
import {getPlayersByRoomId} from "../../../repositories/playerRepository";
import type {RoomDocument} from "../../../models/room";
import type {PlayerDocument, PlayerTeam} from "../../../models/player";

export type WinnerTeam = "citizen" | "mafia" | null;

export interface CheckWinConditionInput {
  roomId: string;
}

export interface CheckWinConditionResult {
  roomId: string;
  hasWinner: boolean;
  winnerTeam: WinnerTeam;
  aliveCounts: {
    citizen: number;
    mafia: number;
    neutral: number;
    total: number;
  };
}

export async function checkWinCondition(
  input: CheckWinConditionInput,
): Promise<CheckWinConditionResult> {
  const roomId = input.roomId.trim();

  if (!roomId) {
    throw new Error("Room ID is required.");
  }

  const room = await getRoomById(roomId);

  if (!room) {
    throw new Error("Room not found.");
  }

  validateCheckableRoom(room);

  const players = await getPlayersByRoomId(room.roomId);
  const alivePlayers = players.filter((player) => player.lifeState === "alive");

  const aliveCounts = countAliveTeams(alivePlayers);
  const winnerTeam = determineWinnerTeam(aliveCounts);

  return {
    roomId: room.roomId,
    hasWinner: winnerTeam !== null,
    winnerTeam,
    aliveCounts: {
      ...aliveCounts,
      total: alivePlayers.length,
    },
  };
}

function validateCheckableRoom(room: RoomDocument): void {
  if (room.status === "waiting") {
    throw new Error("Cannot check win condition before the game starts.");
  }

  if (room.phase.current === "lobby") {
    throw new Error("Cannot check win condition during lobby phase.");
  }
}

function countAliveTeams(players: PlayerDocument[]): {
  citizen: number;
  mafia: number;
  neutral: number;
} {
  let citizen = 0;
  let mafia = 0;
  let neutral = 0;

  for (const player of players) {
    switch (player.roleState.team) {
      case "citizen":
        citizen += 1;
        break;
      case "mafia":
        mafia += 1;
        break;
      case "neutral":
        neutral += 1;
        break;
      default:
        assertNever(player.roleState.team);
    }
  }

  return {citizen, mafia, neutral};
}

function determineWinnerTeam(aliveCounts: {
  citizen: number;
  mafia: number;
  neutral: number;
}): WinnerTeam {
  const citizenSideCount = aliveCounts.citizen;
  const mafiaCount = aliveCounts.mafia;

  if (mafiaCount === 0) {
    return "citizen";
  }

  if (mafiaCount >= citizenSideCount && citizenSideCount > 0) {
    return "mafia";
  }

  if (mafiaCount > 0 && citizenSideCount === 0) {
    return "mafia";
  }

  return null;
}

function assertNever(value: never): never {
  throw new Error(`Unexpected team value: ${String(value)}`);
}