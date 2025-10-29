export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;

export function clampZoom(value, min = MIN_ZOOM, max = MAX_ZOOM) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function ensurePositiveNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function normalizeGridSize(value, fallback = 50) {
  const parsed = ensurePositiveNumber(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

export function getSceneDimensions(scene) {
  if (!scene || typeof scene !== 'object') {
    return { width: 0, height: 0 };
  }
  const width = ensurePositiveNumber(scene.widthPx, 0);
  const height = ensurePositiveNumber(scene.heightPx, 0);
  return { width, height };
}

export function cellToCanvas(cell, gridSize) {
  const size = normalizeGridSize(gridSize, 1);
  return cell * size;
}

export function cellCenterToCanvas(cell, gridSize) {
  const size = normalizeGridSize(gridSize, 1);
  return (cell + 0.5) * size;
}

export function cellFromWorld(x, y, gridSize) {
  const size = normalizeGridSize(gridSize, 1);
  const safeX = Number.isFinite(x) ? x : 0;
  const safeY = Number.isFinite(y) ? y : 0;
  const xCell = Math.floor(safeX / size);
  const yCell = Math.floor(safeY / size);
  return { xCell, yCell };
}

export function gridColsRows(scene = {}) {
  const gridSize = normalizeGridSize(scene.gridSize ?? scene.grid ?? scene.cellSize ?? 0, 0);
  if (!gridSize) {
    return { cols: 0, rows: 0 };
  }

  const widthPx = Number.isFinite(scene.widthPx) ? scene.widthPx : ensurePositiveNumber(scene.width, 0);
  const heightPx = Number.isFinite(scene.heightPx) ? scene.heightPx : ensurePositiveNumber(scene.height, 0);

  const cols = Math.max(0, Math.floor(widthPx / gridSize));
  const rows = Math.max(0, Math.floor(heightPx / gridSize));

  return { cols, rows };
}

export function clampCell(cell, scene = {}) {
  const { cols, rows } = gridColsRows(scene);
  const normalized = {
    xCell: Math.floor(cell?.xCell ?? cell?.x ?? 0),
    yCell: Math.floor(cell?.yCell ?? cell?.y ?? 0),
  };

  let { xCell, yCell } = normalized;

  if (xCell < 0) {
    xCell = 0;
  }

  if (yCell < 0) {
    yCell = 0;
  }

  if (cols > 0 && xCell >= cols) {
    xCell = cols - 1;
  }

  if (rows > 0 && yCell >= rows) {
    yCell = rows - 1;
  }

  return { xCell, yCell };
}

export function worldFromCell(cell, gridSize) {
  const size = normalizeGridSize(gridSize, 1);
  const xCell = Number.isFinite(cell?.xCell) ? cell.xCell : Number.isFinite(cell?.x) ? cell.x : 0;
  const yCell = Number.isFinite(cell?.yCell) ? cell.yCell : Number.isFinite(cell?.y) ? cell.y : 0;
  const x = xCell * size + size / 2;
  const y = yCell * size + size / 2;
  return { x, y };
}

export function sceneToViewScale({ sceneWidth, sceneHeight, viewWidth, viewHeight }) {
  if (!sceneWidth || !sceneHeight || !viewWidth || !viewHeight) {
    return 1;
  }

  const scaleX = viewWidth / sceneWidth;
  const scaleY = viewHeight / sceneHeight;
  const scale = Math.min(scaleX, scaleY, 1);
  if (!Number.isFinite(scale) || scale <= 0) {
    return 1;
  }
  return clampZoom(scale);
}
