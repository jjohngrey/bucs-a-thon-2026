import { randomInt } from "node:crypto";
import { ROOM_CODE_LENGTH } from "@bucs/shared";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeRoomCode(roomCode: string): string {
  return roomCode.trim().toUpperCase();
}

export function generateRoomCode(hasRoomCode: (roomCode: string) => boolean): string {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    let roomCode = "";

    for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
      roomCode += ROOM_CODE_ALPHABET[randomInt(0, ROOM_CODE_ALPHABET.length)];
    }

    if (!hasRoomCode(roomCode)) {
      return roomCode;
    }
  }

  throw new Error("Unable to allocate a unique room code.");
}
