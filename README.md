# 雀神 · 单机麻将

浏览器端四人麻将：你与三名电脑对战，可选地方玩法，完成摸打、吃碰杠胡与计分。游戏逻辑全部在前端运行；当前玩法与累计积分保存在本机浏览器中。另含博客页面与文章预渲染。

## 功能

- **地方玩法**：大众麻将、广东推倒胡、红中赖子、武汉翻赖子；切换玩法会清零积分并重新开局
- **牌局引擎**：发牌、掷骰、摸打、吃碰杠胡、赖子处理、回合推进与结算
- **胡牌计分**：普通胡、七对；广东推倒胡支持十三幺；按玩法处理番型与自摸/点炮
- **电脑玩家**：按牌局状态与当前规则决策，会用赖子且尽量避免主动打出赖子
- **牌桌界面**：规则选择、骰子、赖子标识、手牌与操作；窄屏下手牌可换行
- **博客**：文章列表、Markdown 渲染与路由预渲染

## 技术栈

- React、TypeScript、Vite
- Tailwind CSS、PostCSS、shadcn/ui
- SVG 牌面
- ESLint、Playwright
- Cloudflare Workers（静态资源部署）

## 快速开始

```bash
pnpm i
pnpm run dev
```

构建、检查与部署：

```bash
pnpm run build      # 生产构建 → dist/
pnpm run lint       # ESLint
pnpm run preview    # 本地预览构建产物
pnpm run deploy     # 构建并部署到 Cloudflare Workers
pnpm run deploy:dry # 构建 + 部署演练（不实际上传）
```

实际脚本以根目录 `package.json` 为准。Cloudflare 配置见 `wrangler.jsonc`（产物目录 `dist`，SPA 回退）。若用 Pages 连接 Git，Root directory 留空（仓库根），Build command `pnpm install && pnpm run build`，Build output directory `dist`。

`@/` 路径别名指向 `src/`。主要业务在 `src/game/`（牌局）与 `src/pages/Index.tsx`（牌桌界面）。

## 目录结构

```text
.
├── DESIGN.md                 # 视觉设计规范
├── wrangler.jsonc            # Cloudflare Workers 静态资源配置
├── prerender/                # 博客页面与站点地图预渲染
├── plugins/                  # Vite 插件
├── public/                   # 静态资源
├── src/
│   ├── components/
│   │   ├── MjTile.tsx        # SVG 麻将牌面
│   │   ├── blog/             # 博客布局与 Markdown
│   │   └── ui/               # 通用 UI 组件
│   ├── game/
│   │   ├── ai.ts             # 电脑策略
│   │   ├── engine.ts         # 牌局引擎
│   │   ├── rules.ts          # 胡牌与番型
│   │   ├── rulesets.ts       # 地方玩法配置
│   │   ├── tiles.ts          # 牌组与牌操作
│   │   └── types.ts          # 类型定义
│   ├── pages/
│   │   ├── Index.tsx         # 麻将主页面
│   │   └── blog/             # 博客页面
│   ├── App.tsx               # 路由入口
│   └── main.tsx              # 启动入口
├── package.json
└── vite.config.ts
```

## 玩法说明

| 玩法 | 牌组 | 要点 |
|------|------|------|
| 大众麻将 | 136 张 | 可吃碰杠，可点炮/自摸，支持七对 |
| 广东推倒胡 | 136 张 | 不能吃；鸡胡可胡；支持十三幺 |
| 红中赖子 | 112 张 | 红中为赖子；不能吃，仅自摸；硬胡加番 |
| 武汉翻赖子 | 136 张 | 骰子翻赖子皮，下一张为赖子；可吃碰杠 |

## 设计

牌桌视觉见 [`DESIGN.md`](./DESIGN.md)：绿绒台面、胡桃木桌框、象牙牌面，偏茶馆实木风，不用科技/霓虹风格。
