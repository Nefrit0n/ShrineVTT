import { DomainError } from "../errors/DomainError.js";

const ensureInteger = (value, field) => {
  if (!Number.isInteger(value)) {
    throw new DomainError(
      DomainError.codes.OUT_OF_BOUNDS,
      `${field} must be an integer`
    );
  }
};

const ensureBounds = (value, max, field) => {
  if (value < 0 || value >= max) {
    throw new DomainError(
      DomainError.codes.OUT_OF_BOUNDS,
      `${field} must be between 0 and ${max - 1}`
    );
  }
};

const normalizeCoordinate = (value) => {
  if (!Number.isFinite(value)) {
    throw new DomainError(
      DomainError.codes.OUT_OF_BOUNDS,
      "Coordinate must be a finite number"
    );
  }
  return Math.round(value);
};

export class Token {
  constructor({
    id,
    sceneId,
    ownerUserId,
    name,
    xCell,
    yCell,
    sprite = null,
    visibility = "PUBLIC",
    meta = {},
  }) {
    ensureInteger(xCell, "xCell");
    ensureInteger(yCell, "yCell");

    this.id = id;
    this.sceneId = sceneId;
    this.ownerUserId = ownerUserId;
    this.name = name;
    this.xCell = xCell;
    this.yCell = yCell;
    this.sprite = sprite;
    this.visibility = visibility;
    this.meta = meta;
  }

  static create(props, scene) {
    const { xCell, yCell } = Token.normalisePosition(scene, props);
    return new Token({ ...props, xCell, yCell });
  }

  withPosition({ xCell, yCell }, scene) {
    const { xCell: normalisedX, yCell: normalisedY } =
      Token.normalisePosition(scene, { xCell, yCell });

    return new Token({
      id: this.id,
      sceneId: this.sceneId,
      ownerUserId: this.ownerUserId,
      name: this.name,
      xCell: normalisedX,
      yCell: normalisedY,
      sprite: this.sprite,
      visibility: this.visibility,
      meta: this.meta,
    });
  }

  static normalisePosition(scene, { xCell, yCell }) {
    if (!scene) {
      throw new DomainError(
        DomainError.codes.NOT_FOUND,
        "Scene context is required to position a token"
      );
    }

    const { columns, rows } = scene.getCellDimensions();
    if (columns <= 0 || rows <= 0) {
      throw new DomainError(
        DomainError.codes.OUT_OF_BOUNDS,
        "Scene dimensions do not allow token placement"
      );
    }

    const normalisedX = normalizeCoordinate(xCell);
    const normalisedY = normalizeCoordinate(yCell);

    ensureBounds(normalisedX, columns, "xCell");
    ensureBounds(normalisedY, rows, "yCell");

    return { xCell: normalisedX, yCell: normalisedY };
  }
}
