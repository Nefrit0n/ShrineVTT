import { Container, Graphics, Sprite, Texture } from 'https://cdn.jsdelivr.net/npm/pixi.js@7.4.0/+esm';
import { cellToCanvas, normalizeGridSize } from './coords.js';

export default class TokensLayer {
  constructor() {
    this.container = new Container();
    this.container.eventMode = 'none';
  }

  clear() {
    this.container.removeChildren();
  }

  setTokens(tokens = [], { gridSize = 50 } = {}) {
    this.clear();
    const size = normalizeGridSize(gridSize, 50);

    if (!Array.isArray(tokens) || !tokens.length) {
      return;
    }

    tokens.forEach((token) => {
      const tokenContainer = new Container();
      tokenContainer.eventMode = 'none';

      const display = this.createTokenDisplay(token, size);
      tokenContainer.addChild(display);

      const x = cellToCanvas(token?.xCell ?? 0, size);
      const y = cellToCanvas(token?.yCell ?? 0, size);
      tokenContainer.position.set(x, y);

      this.container.addChild(tokenContainer);
    });
  }

  createTokenDisplay(token, gridSize) {
    if (token?.sprite && typeof token.sprite === 'string') {
      const texture = Texture.from(token.sprite);
      texture.baseTexture.scaleMode = 'linear';
      const sprite = new Sprite(texture);
      sprite.width = gridSize;
      sprite.height = gridSize;
      sprite.anchor.set(0);
      sprite.position.set(0, 0);
      sprite.eventMode = 'none';
      return sprite;
    }

    const radius = Math.max(gridSize * 0.38, 12);
    const graphics = new Graphics();
    graphics.lineStyle({ width: Math.max(2, gridSize * 0.06), color: 0x2d1b0d, alpha: 0.8 });
    graphics.beginFill(0xd9b98c, 0.9);
    graphics.drawCircle(gridSize / 2, gridSize / 2, radius);
    graphics.endFill();
    graphics.eventMode = 'none';
    return graphics;
  }
}
