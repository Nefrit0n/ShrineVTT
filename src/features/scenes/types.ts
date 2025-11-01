export type SceneMode = "theatre" | "tactical";

export type SceneStatus = "active" | "hidden" | "draft";

export type Scene = {
  id: string;
  name: string;
  thumbnail?: string;
  background?: string;
  width: number;
  height: number;
  gridSize: number;
  mode: SceneMode;
  status: SceneStatus;
  tags?: string[];
};

export type SceneCreatePayload = {
  name: string;
  background?: string;
  thumbnail?: string;
  width: number;
  height: number;
  gridSize: number;
  mode: SceneMode;
  status: SceneStatus;
  tags?: string[];
};

export type SceneUpdatePayload = Partial<SceneCreatePayload>;
