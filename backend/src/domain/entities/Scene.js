import { invalidGrid, outOfBounds } from '../errors.js';

const MIN_GRID_SIZE = 8;
const MAX_GRID_SIZE = 256;

export default class Scene {
  constructor({
    id,
    name,
    gridSize,
    widthPx,
    heightPx,
    mapImage = null,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.name = name;
    this.gridSize = gridSize;
    this.widthPx = widthPx;
    this.heightPx = heightPx;
    this.mapImage = mapImage;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;

    this.#validate();
  }

  #validate() {
    if (!Number.isInteger(this.gridSize)) {
      throw invalidGrid('Scene grid size must be an integer.');
    }

    if (this.gridSize < MIN_GRID_SIZE || this.gridSize > MAX_GRID_SIZE) {
      throw invalidGrid(
        `Scene grid size must be between ${MIN_GRID_SIZE} and ${MAX_GRID_SIZE}.`,
      );
    }

    if (!Number.isInteger(this.widthPx) || this.widthPx <= 0) {
      throw invalidGrid('Scene width must be a positive integer.');
    }

    if (!Number.isInteger(this.heightPx) || this.heightPx <= 0) {
      throw invalidGrid('Scene height must be a positive integer.');
    }

    if (this.getColumns() <= 0 || this.getRows() <= 0) {
      throw invalidGrid('Scene dimensions are too small for the selected grid size.');
    }
  }

  getColumns() {
    return Math.floor(this.widthPx / this.gridSize);
  }

  getRows() {
    return Math.floor(this.heightPx / this.gridSize);
  }

  assertWithinBounds(xCell, yCell) {
    if (!Number.isInteger(xCell) || !Number.isInteger(yCell)) {
      throw outOfBounds('Token coordinates must be integers.');
    }

    const columns = this.getColumns();
    const rows = this.getRows();

    if (xCell < 0 || xCell >= columns || yCell < 0 || yCell >= rows) {
      throw outOfBounds('Token coordinates are outside of the scene grid.');
    }
  }
}
