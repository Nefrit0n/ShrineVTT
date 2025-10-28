import { Container, Graphics } from 'https://cdn.jsdelivr.net/npm/pixi.js@7.4.0/+esm';
import { ensurePositiveNumber, normalizeGridSize } from './coords.js';

export default class GridLayer {
  constructor({ color = 0xffffff, alpha = 0.18 } = {}) {
    this.container = new Container();
    this.container.eventMode = 'none';
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
    this.color = color;
    this.alpha = alpha;
  }

  clear() {
    this.graphics?.clear();
  }

  draw({ widthPx = 0, heightPx = 0, gridSize = 0 } = {}) {
    const width = ensurePositiveNumber(widthPx, 0);
    const height = ensurePositiveNumber(heightPx, 0);
    const size = normalizeGridSize(gridSize, 1);

    this.graphics.clear();

    if (!width || !height || !size) {
      return;
    }

    this.graphics.lineStyle({ width: 1, color: this.color, alpha: this.alpha });

    const cols = Math.ceil(width / size);
    const rows = Math.ceil(height / size);

    for (let x = 0; x <= cols; x += 1) {
      const posX = Math.round(x * size) + 0.5;
      this.graphics.moveTo(posX, 0);
      this.graphics.lineTo(posX, height);
    }

    for (let y = 0; y <= rows; y += 1) {
      const posY = Math.round(y * size) + 0.5;
      this.graphics.moveTo(0, posY);
      this.graphics.lineTo(width, posY);
    }
  }
}
