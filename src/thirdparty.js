'use strict'

// Curated third-party component catalog for the About > Third-Party page.
// Versions are filled at runtime from node_modules (with these fallbacks when
// a package is not installed yet, e.g. profile plugins on a fresh machine).
// `source`: runtime = bundled into the installer; plugin = installed into
// ~/.dsh/profiles/web by `dsh plugin add` on the user's machine.

const THIRD_PARTY = [
  // ---- runtime components (bundled into the installer) ----
  { name: 'electron', version: '', license: 'MIT', link: 'https://electronjs.org/', category: 'runtime', zh: '桌面应用运行时（Chromium + Node.js）', en: 'Desktop application runtime (Chromium + Node.js)' },
  { name: 'sharp', version: '', license: 'Apache-2.0', link: 'https://sharp.pixelplumbing.com/', category: 'runtime', zh: '图像处理库（预编译二进制捆绑 libvips，LGPL-3.0-or-later）', en: 'Image processing library (prebuilt binaries bundle libvips, LGPL-3.0-or-later)' },
  { name: '@deepseek-ai/dsh', version: '', license: 'MIT', link: 'https://github.com/deepseek-ai/deepseek-harness', category: 'runtime', zh: 'Harness 核心运行时与 CLI', en: 'Harness core runtime and CLI' },
  { name: '@deepseek-ai/dsh-shell', version: '', license: 'MIT', link: 'https://github.com/deepseek-ai/deepseek-harness', category: 'runtime', zh: 'Shell 能力（命令执行）', en: 'Shell capability (command execution)' },
  { name: '@deepseek-ai/dsh-fs', version: '', license: 'MIT', link: 'https://github.com/deepseek-ai/deepseek-harness', category: 'runtime', zh: '文件系统能力', en: 'Filesystem capability' },
  { name: '@deepseek-ai/dsh-sandbox', version: '', license: 'MIT', link: 'https://github.com/deepseek-ai/deepseek-harness', category: 'runtime', zh: '沙箱隔离能力', en: 'Sandbox isolation capability' },
  { name: '@deepseek-ai/dsh-workflow', version: '', license: 'MIT', link: 'https://github.com/deepseek-ai/deepseek-harness', category: 'runtime', zh: '工作流能力', en: 'Workflow capability' },
  { name: '@deepseek-ai/dsh-bash-local', version: '', license: 'MIT', link: 'https://github.com/deepseek-ai/deepseek-harness', category: 'runtime', zh: '本地 Bash 执行', en: 'Local Bash execution' },
  { name: '@deepseek-ai/dsh-compaction', version: '', license: 'MIT', link: 'https://github.com/deepseek-ai/deepseek-harness', category: 'runtime', zh: '上下文压缩', en: 'Context compaction' },
  { name: '@deepseek-ai/dsh-session-title-llm', version: '', license: 'MIT', link: 'https://github.com/deepseek-ai/deepseek-harness', category: 'runtime', zh: '会话标题自动生成', en: 'Automatic session titles' },
  { name: '@deepseek-ai/dsh-session-telemetry', version: '', license: 'MIT', link: 'https://github.com/deepseek-ai/deepseek-harness', category: 'runtime', zh: '会话遥测', en: 'Session telemetry' },
  { name: '@deepseek-ai/dsh-timeout', version: '', license: 'MIT', link: 'https://github.com/deepseek-ai/deepseek-harness', category: 'runtime', zh: '工具超时控制', en: 'Tool timeout control' },
  { name: '@deepseek-ai/dsh-spill', version: '', license: 'MIT', link: 'https://github.com/deepseek-ai/deepseek-harness', category: 'runtime', zh: '长输出溢出策略', en: 'Long-output spill policy' },
  { name: '@deepseek-ai/dsh-scope', version: '', license: 'MIT', link: 'https://github.com/deepseek-ai/deepseek-harness', category: 'runtime', zh: '作用域策略', en: 'Scope policy' },
  { name: '@deepseek-ai/dsh-output-retention', version: '', license: 'MIT', link: 'https://github.com/deepseek-ai/deepseek-harness', category: 'runtime', zh: '输出保留策略', en: 'Output retention policy' },
  { name: '@deepseek-ai/dsh-invariants', version: '', license: 'MIT', link: 'https://github.com/deepseek-ai/deepseek-harness', category: 'runtime', zh: '运行时不变量检查', en: 'Runtime invariant checks' },
  { name: '@deepseek-ai/dsh-code-runtime', version: '', license: 'MIT', link: 'https://github.com/deepseek-ai/deepseek-harness', category: 'runtime', zh: '代码执行运行时', en: 'Code execution runtime' },
  { name: '@deepseek-ai/dsh-atomic-write', version: '', license: 'MIT', link: 'https://github.com/deepseek-ai/deepseek-harness', category: 'runtime', zh: '原子写入', en: 'Atomic writes' },
  { name: '@deepseek-ai/dsh-anonymous-user-id', version: '', license: 'MIT', link: 'https://github.com/deepseek-ai/deepseek-harness', category: 'runtime', zh: '匿名用户标识', en: 'Anonymous user identity' },
  { name: '@deepseek-ai/dsh-subagent-in-process-driver', version: '', license: 'MIT', link: 'https://github.com/deepseek-ai/deepseek-harness', category: 'runtime', zh: '子代理（进程内）驱动', en: 'Subagent (in-process) driver' },
  { name: '@deepseek-ai/cordis-plugin-group', version: '', license: 'MIT', link: 'https://github.com/deepseek-ai/deepseek-harness', category: 'runtime', zh: 'Cordis 插件分组', en: 'Cordis plugin grouping' },

  // ---- preinstalled plugins (installed into ~/.dsh/profiles/web) ----
  { name: 'dsh-wallpaper-ui', version: '', license: 'MIT', link: 'https://www.npmjs.com/package/dsh-wallpaper-ui', category: 'plugin', zh: '壁纸背景（图片 / GIF / 视频，五种铺满模式）', en: 'Wallpaper backgrounds (image / GIF / video, five fit modes)' },
  { name: '@linxin666/dsh-live-stats', version: '', license: 'Apache-2.0', link: 'https://www.npmjs.com/package/@linxin666/dsh-live-stats', category: 'plugin', zh: '实时 Token 统计与生成吞吐', en: 'Live token statistics and generation throughput' },
  { name: '@linxin666/dsh-client-ui-git-graph', version: '', license: 'Apache-2.0', link: 'https://www.npmjs.com/package/@linxin666/dsh-client-ui-git-graph', category: 'plugin', zh: 'Git 图谱与分支选择器', en: 'Git graph and branch picker' },
  { name: '@linxin666/dsh-ssh', version: '', license: 'Apache-2.0', link: 'https://www.npmjs.com/package/@linxin666/dsh-ssh', category: 'plugin', zh: '远程 SSH / SFTP / 端口转发', en: 'Remote SSH / SFTP / port forwarding' },
  { name: '@linxin666/dsh-client-ui-task-board', version: '', license: 'Apache-2.0', link: 'https://www.npmjs.com/package/@linxin666/dsh-client-ui-task-board', category: 'plugin', zh: '任务看板（定时调度与空闲保护）', en: 'Task board (scheduled runs and idle guard)' },
  { name: 'dsh-config-manager', version: '', license: 'MIT', link: 'https://www.npmjs.com/package/dsh-config-manager', category: 'plugin', zh: '配置备份 / 导出 / 迁移', en: 'Config backup / export / migration' },
]

module.exports = { THIRD_PARTY }