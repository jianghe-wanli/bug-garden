import Phaser from 'phaser';
import { App } from './app';
import { sfx } from './audio/sfx';
import { BootScene } from './scenes/BootScene';
import { GardenScene } from './scenes/GardenScene';
import { mountUi } from './ui/hud';

const app = new App();
const dpr = Math.min(window.devicePixelRatio || 1, 3);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#cdeffd',
  scale: {
    mode: Phaser.Scale.NONE,
    width: Math.round(innerWidth * dpr),
    height: Math.round(innerHeight * dpr),
    zoom: 1 / dpr,
  },
  render: { antialias: true, roundPixels: false },
  input: { activePointers: 3 },
  scene: [new BootScene(), new GardenScene(app, dpr)],
});

function resize(): void {
  game.scale.resize(Math.round(innerWidth * dpr), Math.round(innerHeight * dpr));
}
addEventListener('resize', resize);
addEventListener('orientationchange', resize);

mountUi(app, document.getElementById('ui')!);
addEventListener('pointerdown', () => sfx.unlock(), { once: true });

// 供自动化测试与调试使用
Object.assign(window, { __app: app, __phaser: game });
