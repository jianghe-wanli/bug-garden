import Phaser from 'phaser';
import { TEX_SCALE, allArtFiles } from '../art/manifest';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    for (const { key, url } of allArtFiles()) this.load.svg(key, url, { scale: TEX_SCALE });
  }

  create(): void {
    this.scene.start('garden');
  }
}
