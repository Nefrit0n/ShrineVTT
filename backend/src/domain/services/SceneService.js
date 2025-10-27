import { nanoid } from "nanoid";

import { Scene } from "../entities/Scene.js";
import { DomainError } from "../errors/DomainError.js";

export class SceneService {
  constructor({ sceneRepository }) {
    this.sceneRepository = sceneRepository;
  }

  async createScene({ roomId, name, gridSize, mapImage = null, widthPx, heightPx }) {
    const scene = new Scene({
      id: nanoid(),
      roomId,
      name,
      gridSize,
      mapImage,
      widthPx,
      heightPx,
    });

    await this.sceneRepository.create(scene);
    return scene;
  }

  async getScene(sceneId) {
    const scene = await this.sceneRepository.findById(sceneId);
    if (!scene) {
      throw new DomainError(
        DomainError.codes.NOT_FOUND,
        `Scene with id ${sceneId} was not found`
      );
    }

    return scene;
  }

  async changeGridSize(sceneId, gridSize) {
    const scene = await this.getScene(sceneId);
    const updated = scene.withGridSize(gridSize);
    await this.sceneRepository.update(updated);
    return updated;
  }

  async setBackground(sceneId, { mapImage, widthPx, heightPx }) {
    const scene = await this.getScene(sceneId);
    const updated = scene.withBackground({ mapImage, widthPx, heightPx });
    await this.sceneRepository.update(updated);
    return updated;
  }

  async listScenesByRoom(roomId, pagination = {}) {
    return this.sceneRepository.listByRoom(roomId, pagination);
  }

  async getActiveSceneForRoom(roomId) {
    const [scene] = await this.sceneRepository.listByRoom(roomId, {
      offset: 0,
      limit: 1,
    });
    return scene ?? null;
  }
}
