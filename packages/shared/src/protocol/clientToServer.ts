export type LobbyCreatePayload = {
  displayName: string;
};

export type LobbyJoinPayload = {
  roomCode: string;
  displayName: string;
};

export type LobbyLeavePayload = {
  roomCode: string;
};

export type LobbyReadyPayload = {
  roomCode: string;
  isReady: boolean;
};

export type MatchSelectCharacterPayload = {
  roomCode: string;
  characterId: string;
};

export type MatchSelectStagePayload = {
  roomCode: string;
  stageId: string;
};

export type MatchStartPayload = {
  roomCode: string;
};

export type MatchEndPayload = {
  roomCode: string;
  winnerPlayerId: string | null;
  eliminatedPlayerIds: string[];
};

export type MatchInputPayload = {
  roomCode: string;
  inputFrame: number;
  pressed: {
    left: boolean;
    right: boolean;
    jump: boolean;
    attack: boolean;
    special: boolean;
  };
};
