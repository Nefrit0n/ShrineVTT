export class SceneUseCases {
  constructor({ sceneService, tokenService }) {
    this.sceneService = sceneService;
    this.tokenService = tokenService;
  }

  async createScene(payload) {
    return this.sceneService.createScene(payload);
  }

  async getScene(sceneId) {
    return this.sceneService.getScene(sceneId);
  }

  async getSceneWithTokens(sceneId, pagination) {
    const scene = await this.sceneService.getScene(sceneId);
    const tokens = await this.tokenService.listByScene(sceneId, pagination);
    return { scene, tokens };
  }

  async updateScene(sceneId, updates) {
    let scene = await this.sceneService.getScene(sceneId);

    if (updates.gridSize !== undefined) {
      scene = await this.sceneService.changeGridSize(scene.id, updates.gridSize);
    }

    if (
      updates.mapImage !== undefined ||
      updates.widthPx !== undefined ||
      updates.heightPx !== undefined
    ) {
      scene = await this.sceneService.setBackground(scene.id, {
        mapImage: updates.mapImage,
        widthPx: updates.widthPx ?? scene.widthPx,
        heightPx: updates.heightPx ?? scene.heightPx,
      });
    }

    return scene;
  }

  async getActiveSceneSnapshot(roomId) {
    const scene = await this.sceneService.getActiveSceneForRoom(roomId);
    if (!scene) {
      return { scene: null, tokens: [] };
    }

    const tokens = await this.tokenService.listByScene(scene.id, {
      offset: 0,
      limit: null,
    });

    return { scene, tokens };
  }
}
