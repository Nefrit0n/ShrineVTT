import { SceneService } from "#domain/services/SceneService.js";
import { TokenService } from "#domain/services/TokenService.js";
import { ActorService } from "#domain/services/ActorService.js";
import { ItemService } from "#domain/services/ItemService.js";
import { SceneRepository } from "#infra/repositories/SceneRepository.js";
import { TokenRepository } from "#infra/repositories/TokenRepository.js";
import { ActorRepository } from "#infra/repositories/ActorRepository.js";
import { ItemRepository } from "#infra/repositories/ItemRepository.js";
import { SceneUseCases } from "./scenes/SceneUseCases.js";
import { TokenUseCases } from "./tokens/TokenUseCases.js";

export const createApplicationContainer = ({ db } = {}) => {
  if (!db) {
    throw new Error(
      "Database instance is required to create the application container"
    );
  }

  const sceneRepository = new SceneRepository(db);
  const tokenRepository = new TokenRepository(db);
  const itemRepository = new ItemRepository(db);
  const actorRepository = new ActorRepository(db);

  const sceneService = new SceneService({ sceneRepository });
  const tokenService = new TokenService({
    sceneRepository,
    tokenRepository,
  });
  const itemService = new ItemService({ itemRepository });
  const actorService = new ActorService({
    actorRepository,
    itemRepository,
  });

  const sceneUseCases = new SceneUseCases({ sceneService, tokenService });
  const tokenUseCases = new TokenUseCases({ tokenService });

  return {
    sceneUseCases,
    tokenUseCases,
    actorService,
    itemService,
  };
};
