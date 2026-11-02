# 雀神 · 前端

单机麻将与博客的前端工程。项目总览、玩法说明与目录说明见仓库根目录 [`README.md`](../../README.md)；视觉规范见 [`DESIGN.md`](./DESIGN.md)。

## 开发

```bash
pnpm i
pnpm run dev
```

```bash
pnpm run build   # 生产构建
pnpm run lint    # ESLint
pnpm run preview # 本地预览构建产物
```

`@/` 路径别名指向 `src/`。主要业务在 `src/game/`（牌局）与 `src/pages/Index.tsx`（牌桌界面）。
