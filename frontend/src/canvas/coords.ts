import type { DisplayObject } from "pixi.js";

export type GridDimensions = {
  cols: number;
  rows: number;
};

export function worldFromPointer(
  displayObject: DisplayObject,
  global: { x: number; y: number }
) {
  return displayObject.toLocal(global);
}

export function cellFromWorld(
  worldX: number,
  worldY: number,
  gridSize: number,
  originX = 0,
  originY = 0
) {
  const nx = Math.floor((worldX - originX) / gridSize);
  const ny = Math.floor((worldY - originY) / gridSize);
  return { nx, ny };
}

export function clampCell(nx: number, ny: number, cols: number, rows: number) {
  const xCell = Math.max(0, Math.min(cols - 1, nx));
  const yCell = Math.max(0, Math.min(rows - 1, ny));
  return { xCell, yCell };
}

export function gridColsRows(
  widthPx: number,
  heightPx: number,
  gridSize: number
): GridDimensions {
  return {
    cols: Math.max(1, Math.floor(widthPx / gridSize)),
    rows: Math.max(1, Math.floor(heightPx / gridSize)),
  };
}
