import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://l128.github.io/",
    title: "L128 的技术笔记本",
    description:
      "一个硬件/电气工程师的个人笔记站,记录信号分析、Homelab、嵌入式与基础设施折腾过程。",
    author: "L128",
    profile: "https://github.com/L128",
    ogImage: "default-og.jpg",
    lang: "zh-CN",
    timezone: "Asia/Shanghai",
    dir: "ltr",
  },
  posts: {
    perPage: 6,
    perIndex: 5,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    editPost: {
      enabled: true,
      url: "https://github.com/L128/l128.github.io/edit/main/",
    },
    search: "pagefind",
  },
  socials: [
    { name: "github", url: "https://github.com/L128" },
    { name: "mail", url: "mailto:646499453@qq.com" },
  ],
  shareLinks: [
    { name: "x", url: "https://x.com/intent/post?url=" },
    { name: "telegram", url: "https://t.me/share/url?url=" },
    { name: "weibo", url: "https://service.weibo.com/share/share.php?url=" },
    { name: "mail", url: "mailto:?subject=See%20this%20post&body=" },
  ],
});
