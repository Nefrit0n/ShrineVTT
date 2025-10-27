export const clampGridSize = (gridSize: number): number => {
  if (!Number.isFinite(gridSize) || gridSize <= 0) {
    throw new Error("gridSize must be a positive finite number");
  }
  return gridSize;
};

export const cellToPixel = (cell: number, gridSize: number): number => {
  return cell * gridSize;
};

export const cellCenterToPixel = (cell: number, gridSize: number): number => {
  return cell * gridSize + gridSize / 2;
};

export const pixelToCell = (pixel: number, gridSize: number): number => {
  return Math.round(pixel / gridSize);
};

export const pixelToCellFromCenter = (pixel: number, gridSize: number): number => {
  return Math.round((pixel - gridSize / 2) / gridSize);
};

export const snapPixelToGrid = (pixel: number, gridSize: number): number => {
  return pixelToCell(pixel, gridSize) * gridSize;
};

export const snapPointToGrid = (
  point: { x: number; y: number },
  gridSize: number
): { x: number; y: number } => {
  return {
    x: snapPixelToGrid(point.x, gridSize),
    y: snapPixelToGrid(point.y, gridSize),
  };
};
