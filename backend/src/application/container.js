import { SceneService } from "#domain/services/SceneService.js";
import { TokenService } from "#domain/services/TokenService.js";
import { SceneRepository } from "#infra/repositories/SceneRepository.js";
import { TokenRepository } from "#infra/repositories/TokenRepository.js";
import { getDatabase } from "#storage/db.js";

import { SceneUseCases } from "./scenes/SceneUseCases.js";
import { TokenUseCases } from "./tokens/TokenUseCases.js";

export const createApplicationContainer = () => {
  const db = getDatabase();

  const sceneRepository = new SceneRepository(db);
  const tokenRepository = new TokenRepository(db);

  const sceneService = new SceneService({ sceneRepository });
  const tokenService = new TokenService({
    sceneRepository,
    tokenRepository,
  });

  const sceneUseCases = new SceneUseCases({ sceneService, tokenService });
  const tokenUseCases = new TokenUseCases({ tokenService });

  return {
    sceneUseCases,
    tokenUseCases,
  };
};
