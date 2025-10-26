import { DomainError } from "../errors/DomainError.js";

const ensurePositiveInteger = (value, field) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new DomainError(
      DomainError.codes.INVALID_GRID,
      `${field} must be a positive integer`
    );
  }
};

const ensurePositiveNumber = (value, field) => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new DomainError(
      DomainError.codes.INVALID_GRID,
      `${field} must be a positive number`
    );
  }
};

export class Scene {
  constructor({
    id,
    roomId,
    name,
    gridSize,
    mapImage = null,
    widthPx,
    heightPx,
  }) {
    ensurePositiveInteger(gridSize, "gridSize");
    ensurePositiveNumber(widthPx, "widthPx");
    ensurePositiveNumber(heightPx, "heightPx");

    this.id = id;
    this.roomId = roomId;
    this.name = name;
    this.gridSize = gridSize;
    this.mapImage = mapImage;
    this.widthPx = widthPx;
    this.heightPx = heightPx;
  }

  getCellDimensions() {
    const columns = Math.max(1, Math.ceil(this.widthPx / this.gridSize));
    const rows = Math.max(1, Math.ceil(this.heightPx / this.gridSize));
    return { columns, rows };
  }

  withGridSize(gridSize) {
    ensurePositiveInteger(gridSize, "gridSize");
    return new Scene({
      id: this.id,
      roomId: this.roomId,
      name: this.name,
      gridSize,
      mapImage: this.mapImage,
      widthPx: this.widthPx,
      heightPx: this.heightPx,
    });
  }

  withBackground({ mapImage, widthPx, heightPx }) {
    const nextWidth = widthPx ?? this.widthPx;
    const nextHeight = heightPx ?? this.heightPx;
    ensurePositiveNumber(nextWidth, "widthPx");
    ensurePositiveNumber(nextHeight, "heightPx");

    return new Scene({
      id: this.id,
      roomId: this.roomId,
      name: this.name,
      gridSize: this.gridSize,
      mapImage: mapImage ?? this.mapImage,
      widthPx: nextWidth,
      heightPx: nextHeight,
    });
  }
}
