export class TokenUseCases {
  constructor({ tokenService }) {
    this.tokenService = tokenService;
  }

  async createToken(payload) {
    return this.tokenService.createToken(payload);
  }

  async moveToken(tokenId, target, requesterId, optimistic = {}) {
    return this.tokenService.moveToken(tokenId, target, requesterId, optimistic);
  }
}
