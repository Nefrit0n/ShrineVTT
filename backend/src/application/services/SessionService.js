export default class SessionService {
  constructor({ sessionRepository, sceneRepository, sessionStateRepository }) {
    if (!sessionRepository) {
      throw new Error('sessionRepository dependency is required');
    }
    if (!sceneRepository) {
      throw new Error('sceneRepository dependency is required');
    }
    if (!sessionStateRepository) {
      throw new Error('sessionStateRepository dependency is required');
    }

    this.sessionRepository = sessionRepository;
    this.sceneRepository = sceneRepository;
    this.sessionStateRepository = sessionStateRepository;
  }

  getActiveSceneId(sessionId) {
    if (!sessionId) return null;
    const state = this.sessionStateRepository.get(sessionId);
    return state?.activeSceneId ?? null;
  }

  setActiveScene({ sessionId, sceneId = null }) {
    if (!sessionId) {
      throw new Error('sessionId is required to set active scene');
    }

    const session = this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (sceneId !== null && sceneId !== undefined) {
      const scene = this.sceneRepository.findById({ sessionId, sceneId });
      if (!scene) {
        throw new Error('Scene not found in this session');
      }
    }

    return this.sessionStateRepository.setActiveScene({
      sessionId,
      activeSceneId: sceneId ?? null,
    });
  }
}
