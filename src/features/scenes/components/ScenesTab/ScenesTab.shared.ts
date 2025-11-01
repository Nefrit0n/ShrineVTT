import type { SceneMode, SceneStatus } from "../../types";

export type SceneFormState = {
  id?: string;
  name: string;
  backgroundUrl: string;
  backgroundData?: string;
  width: string;
  height: string;
  gridSize: string;
  mode: SceneMode;
  status: SceneStatus;
  tags: string[];
};

export type EditorSection = "basics" | "dimensions" | "parameters";
