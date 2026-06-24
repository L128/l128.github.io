# Posts

这里放正式发布的文章。frontmatter 至少需要:

```yaml
---
author: L128
pubDatetime: 2026-05-16T00:00:00.000Z
title: 文章标题
slug: optional-slug  # 不写就用文件名
featured: false
draft: false
tags:
  - homelab
description: 一句话摘要(列表页和 OG 卡片都用它)
---
```

可以用子目录组织(子目录名会成为 URL 的一部分,例如 `homelab/foo.md` → `/posts/homelab/foo`)。只想用目录不想影响 URL 的,加下划线前缀。
