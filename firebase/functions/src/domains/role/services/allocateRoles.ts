import {Timestamp} from "firebase-admin/firestore";

import {getRoomById, setRoleAllocated} from "../../../repositories/roomRepository";
import {
  getPlayersByRoomId,
  updatePlayerRoleState,
} from "../../../repositories/playerRepository";
import type {RoomDocument} from "../../../models/room";
import type {
  PlayerDocument,
  PlayerRole,
  PlayerRoleState,
  PlayerTeam,
} from "../../../models/player";

export interface AllocateRolesInput {
  roomId: string;
  force?: boolean;
}

export interface RoleAssignment {
  playerUid: string;
  role: PlayerRole;
  team: PlayerTeam;
}

export interface AllocateRolesResult {
  roomId: string;
  assignedCount: number;
  assignments: RoleAssignment[];
}

export async function allocateRoles(
  input: AllocateRolesInput,
): Promise<AllocateRolesResult> {
  const roomId = input.roomId.trim();
  const force = input.force ?? false;

  if (!roomId) {
    throw new Error("Room ID is required.");
  }

  const room = await getRoomById(roomId);

  if (!room) {
    throw new Error("Room not found.");
  }

  validateRoleAllocation(room, force);

  const players = await getPlayersByRoomId(room.roomId);

  if (players.length < room.settings.minPlayers) {
    throw new Error("Not enough players to allocate roles.");
  }

  if (players.length !== room.playerUids.length) {
    throw new Error(
      "Player documents are missing. Room player list and players collection are out of sync.",
    );
  }

  const shuffledPlayers = shufflePlayers(players);
  const rolePlan = buildRolePlan(shuffledPlayers.length);
  const assignedAt = Timestamp.now();

  const assignments: RoleAssignment[] = [];

  await Promise.all(
    shuffledPlayers.map(async (player, index) => {
      const role = rolePlan[index];
      const team = getTeamFromRole(role);
      const roleState: PlayerRoleState = {
        team,
        role,
        assignedAt,
        revealedToSelf: false,
      };

      await updatePlayerRoleState(player.playerUid, roleState);

      assignments.push({
        playerUid: player.playerUid,
        role,
        team,
      });
    }),
  );

  await setRoleAllocated(room.roomId, true);

  return {
    roomId: room.roomId,
    assignedCount: assignments.length,
    assignments,
  };
}

function validateRoleAllocation(room: RoomDocument, force: boolean): void {
  if (room.status === "finished") {
    throw new Error("Cannot allocate roles for a finished room.");
  }

  if (room.status !== "waiting" && !force) {
    throw new Error("Roles can only be allocated while the room is waiting.");
  }

  if (room.phase.current !== "lobby" && !force) {
    throw new Error("Roles can only be allocated in lobby phase.");
  }

  if (room.roleAllocated && !force) {
    throw new Error("Roles have already been allocated.");
  }

  if (room.playerUids.length < room.settings.minPlayers) {
    throw new Error("Not enough players to allocate roles.");
  }
}

function buildRolePlan(playerCount: number): PlayerRole[] {
  if (playerCount < 4) {
    throw new Error("At least 4 players are required to allocate roles.");
  }

  const roles: PlayerRole[] = [];

  const mafiaCount = playerCount >= 7 ? 2 : 1;

  for (let i = 0; i < mafiaCount; i += 1) {
    roles.push("mafia");
  }

  roles.push("police");

  if (playerCount >= 6) {
    roles.push("doctor");
  }

  if (playerCount >= 8) {
    roles.push("reporter");
  }

  while (roles.length < playerCount) {
    roles.push("citizen");
  }

  return shuffleRoles(roles);
}

function getTeamFromRole(role: PlayerRole): PlayerTeam {
  switch (role) {
    case "mafia":
      return "mafia";
    case "none":
      return "neutral";
    default:
      return "citizen";
  }
}

function shufflePlayers(players: PlayerDocument[]): PlayerDocument[] {
  const copied = [...players];

  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }

  return copied;
}

function shuffleRoles(roles: PlayerRole[]): PlayerRole[] {
  const copied = [...roles];

  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }

  return copied;
}