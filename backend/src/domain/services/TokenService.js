import { nanoid } from "nanoid";

import { Token } from "../entities/Token.js";
import { DomainError } from "../errors/DomainError.js";

export class TokenService {
  constructor({ sceneRepository, tokenRepository }) {
    this.sceneRepository = sceneRepository;
    this.tokenRepository = tokenRepository;
  }

  async createToken({
    sceneId,
    ownerUserId,
    name,
    xCell,
    yCell,
    sprite = null,
    visibility = "PUBLIC",
    meta = {},
  }) {
    const scene = await this.sceneRepository.findById(sceneId);
    if (!scene) {
      throw new DomainError(
        DomainError.codes.NOT_FOUND,
        `Scene with id ${sceneId} was not found`
      );
    }

    const token = Token.create(
      {
        id: nanoid(),
        sceneId,
        ownerUserId,
        name,
        xCell,
        yCell,
        sprite,
        visibility,
        meta,
      },
      scene
    );

    await this.tokenRepository.create(token);
    return token;
  }

  async deleteToken(tokenId, requesterId) {
    const token = await this.tokenRepository.findById(tokenId);
    if (!token) {
      throw new DomainError(
        DomainError.codes.NOT_FOUND,
        `Token with id ${tokenId} was not found`
      );
    }

    if (requesterId && token.ownerUserId !== requesterId) {
      throw new DomainError(
        DomainError.codes.NOT_OWNER,
        `User ${requesterId} cannot manage token ${tokenId}`
      );
    }

    await this.tokenRepository.delete(tokenId);
    return token;
  }

  async moveToken(
    tokenId,
    { xCell, yCell },
    requesterId,
    { expectedVersion, expectedUpdatedAt } = {}
  ) {
    const token = await this.tokenRepository.findById(tokenId);
    if (!token) {
      throw new DomainError(
        DomainError.codes.NOT_FOUND,
        `Token with id ${tokenId} was not found`
      );
    }

    if (requesterId && token.ownerUserId !== requesterId) {
      throw new DomainError(
        DomainError.codes.NOT_OWNER,
        `User ${requesterId} cannot manage token ${tokenId}`
      );
    }

    if (
      typeof expectedVersion === "number" &&
      Number.isFinite(expectedVersion) &&
      expectedVersion < token.version
    ) {
      throw new DomainError(
        DomainError.codes.STALE_UPDATE,
        "Token version mismatch",
        {
          expectedVersion: token.version,
          receivedVersion: expectedVersion,
        }
      );
    }

    if (expectedUpdatedAt) {
      const expectedDate = new Date(expectedUpdatedAt);
      if (Number.isNaN(expectedDate.getTime())) {
        throw new DomainError(
          DomainError.codes.INVALID_UPDATE,
          "expectedUpdatedAt must be a valid ISO date string"
        );
      }

      const currentDate = new Date(token.updatedAt);
      if (expectedDate.getTime() < currentDate.getTime()) {
        throw new DomainError(
          DomainError.codes.STALE_UPDATE,
          "Token updatedAt is more recent than requested update",
          {
            expectedUpdatedAt,
            currentUpdatedAt: token.updatedAt,
          }
        );
      }
    }

    const scene = await this.sceneRepository.findById(token.sceneId);
    if (!scene) {
      throw new DomainError(
        DomainError.codes.NOT_FOUND,
        `Scene with id ${token.sceneId} was not found`
      );
    }

    const { columns: cols, rows } = scene.getCellDimensions();

    if (!Number.isInteger(xCell) || !Number.isInteger(yCell)) {
      throw new DomainError(
        DomainError.codes.INVALID_GRID,
        "xCell and yCell must be integers",
        { xCell, yCell }
      );
    }

    if (xCell < 0 || xCell >= cols) {
      throw new DomainError(
        DomainError.codes.OUT_OF_BOUNDS,
        `xCell must be between 0 and ${cols - 1}`,
        { xCell, cols }
      );
    }

    if (yCell < 0 || yCell >= rows) {
      throw new DomainError(
        DomainError.codes.OUT_OF_BOUNDS,
        `yCell must be between 0 and ${rows - 1}`,
        { yCell, rows }
      );
    }

    const updated = token.withPosition({ xCell, yCell }, scene);
    await this.tokenRepository.update(updated);
    return updated;
  }

  async listByScene(sceneId, pagination = {}) {
    return this.tokenRepository.listByScene(sceneId, pagination);
  }
}
