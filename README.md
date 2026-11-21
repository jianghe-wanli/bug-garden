# 虫虫花园

昆虫村庄模拟经营 H5 小游戏：盖蚁窝和蜂房，派蚂蚁、蜜蜂干活赚金币，喂食恢复体力，赶走臭虫和蚁狮，升级解锁更多建筑。玩法参考 2011 年的《虫虫部落》，代码和美术均为原创。

## 开发

```bash
npm ci
npm run dev        # 本地开发
npm run test       # 模拟逻辑单元测试
npm run build      # 类型检查 + 打包（含 PWA）
```

## 结构

- `src/core/`：与渲染无关的模拟逻辑（`sim.ts`）、存档、等距坐标、事件总线
- `src/data/`：建筑、食物、害虫、等级、任务的数值表
- `src/scenes/`：Phaser 场景（加载、花园）
- `src/ui/`：DOM 界面（顶栏、任务、商店、操作面板）
- `src/art/`：SVG 美术和清单 `manifest.ts`
- `src/audio/`：音效接口
- `tests/`：vitest 测试
