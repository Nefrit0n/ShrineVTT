import { outOfBounds } from '../errors.js';

export default class Token {
  constructor({
    id,
    sceneId,
    ownerUserId = null,
    name,
    xCell,
    yCell,
    sprite = null,
    visibility = 'public',
    version = 0,
    createdAt,
    updatedAt,
  }, scene = null) {
    this.id = id;
    this.sceneId = sceneId;
    this.ownerUserId = ownerUserId;
    this.name = name;
    this.xCell = xCell;
    this.yCell = yCell;
    this.sprite = sprite;
    this.visibility = visibility;
    this.version = version;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;

    this.#validate(scene);
  }

  #validate(scene) {
    if (!Number.isInteger(this.xCell) || !Number.isInteger(this.yCell)) {
      throw outOfBounds('Token coordinates must be integers.');
    }

    if (scene) {
      scene.assertWithinBounds(this.xCell, this.yCell);
    }
  }

  withScene(scene) {
    scene.assertWithinBounds(this.xCell, this.yCell);
    return this;
  }
}
