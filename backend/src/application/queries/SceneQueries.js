export default class SceneQueries {
  constructor({ sceneRepository, tokenRepository }) {
    if (!sceneRepository) {
      throw new Error('sceneRepository dependency is required');
    }
    if (!tokenRepository) {
      throw new Error('tokenRepository dependency is required');
    }

    this.sceneRepository = sceneRepository;
    this.tokenRepository = tokenRepository;
  }

  getSceneSnapshot({ sessionId, sceneId }) {
    if (!sessionId || !sceneId) {
      return null;
    }

    const scene = this.sceneRepository.findById({ sessionId, sceneId });
    if (!scene) {
      return null;
    }

    const tokens = this.tokenRepository
      .listByScene({ sessionId, sceneId })
      .map((token) => token.toObject());

    return {
      scene: scene.toObject(),
      tokens,
    };
  }
}
