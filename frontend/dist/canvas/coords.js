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

export function cellFromWorld(point, gridSize) {
  const size = normalizeGridSize(gridSize, 1);
  const x = Number.isFinite(point?.x) ? point.x : 0;
  const y = Number.isFinite(point?.y) ? point.y : 0;
  const xCell = Math.floor(x / size);
  const yCell = Math.floor(y / size);
  return { xCell, yCell };
}

export function clampCell(cell, { columns, rows } = {}) {
  const normalized = {
    xCell: Math.floor(cell?.xCell ?? cell?.x ?? 0),
    yCell: Math.floor(cell?.yCell ?? cell?.y ?? 0),
  };

  let { xCell, yCell } = normalized;
  let outOfBounds = false;

  if (xCell < 0) {
    xCell = 0;
    outOfBounds = true;
  }

  if (yCell < 0) {
    yCell = 0;
    outOfBounds = true;
  }

  const hasColumns = Number.isInteger(columns) && columns > 0;
  const hasRows = Number.isInteger(rows) && rows > 0;

  if (hasColumns && xCell >= columns) {
    xCell = columns - 1;
    outOfBounds = true;
  }

  if (hasRows && yCell >= rows) {
    yCell = rows - 1;
    outOfBounds = true;
  }

  return { xCell, yCell, outOfBounds };
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
