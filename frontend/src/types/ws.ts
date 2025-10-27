export type TokenDTO = {
  id: string;
  sceneId: string;
  ownerUserId: string | null;
  name: string;
  xCell: number;
  yCell: number;
  sprite: string | null;
  visibility: string;
  meta: Record<string, unknown>;
  version: number;
  updatedAt: string;
};

export type SceneDTO = {
  id: string;
  name: string;
  gridSize: number;
  mapImage: string | null;
  widthPx: number;
  heightPx: number;
};

export type SceneSnapshotMessage = {
  scene: SceneDTO | null;
  tokens?: TokenDTO[];
};

export type WsError = {
  code: string;
  message: string;
  context: unknown | null;
};

export type TokenCreateIn = {
  sceneId: string;
  name: string;
  xCell: number;
  yCell: number;
  ownerUserId?: string | null;
  sprite?: string | null;
};

export type TokenCreateOut = {
  token: TokenDTO;
};

export type TokenMoveIn = {
  tokenId: string;
  xCell: number;
  yCell: number;
  version?: number;
  updatedAt?: string;
};

export type TokenMoveOut = {
  token: TokenDTO;
};

export type TokenCreateAck = { ok: true; token: TokenDTO } | { ok: false; error: WsError };

export type TokenMoveAck = { ok: true; token: TokenDTO } | { ok: false; error: WsError };

export type ConnectedMessage = {
  message: string;
  role?: "MASTER" | "PLAYER" | null;
  sessionId?: string;
  roomId?: string;
  user?: {
    id?: string;
    username?: string;
  };
};
