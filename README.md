# l128.github.io

个人技术笔记站,基于 [Astro](https://astro.build/) + [Astro Paper](https://github.com/satnaing/astro-paper) 主题,部署在 GitHub Pages。

## 本地开发

需要 Node ≥ 22 和 pnpm 11。

```bash
pnpm install
pnpm dev         # 起开发服务器,默认 http://localhost:4321
pnpm build       # 构建到 dist/
pnpm preview     # 预览构建产物
```

## 内容来源

文章从我的 Obsidian 笔记库迁移过来,挑选"自己重新看一遍也想读下去"的那些。Frontmatter 至少需要 `title` / `pubDatetime` / `description` / `tags`,见 `src/content/posts/_README.md`。

## 部署

push 到 `main` 分支会触发 `.github/workflows/pages.yml`,构建后自动部署到 GitHub Pages。
PR 触发 `.github/workflows/ci.yml` 做 lint + format check + build 校验。

## 许可证

文章内容以 CC BY-NC-SA 4.0 发布,代码/配置以 MIT 发布。
