# Deepseek Harness Plus（dsh-desktop）

DeepSeek Harness 的极简 Electron 桌面壳（方案 A：`spawn dsh web` + 本地 BrowserWindow）。

- 启动本机 `dsh web` 服务器（默认 `--port 0`，由操作系统分配空闲端口，不占用固定 3080）。
- **首次启动展示场景引导**：按使用场景预装插件与配置，之后可直接使用。
- 解析子进程 stdout 中 `dsh web: <url>` 行自动发现地址，再让窗口加载该 URL。
- 退出应用时递归结束 dsh 进程树（Windows 用 `taskkill /T /F`，POSIX 用进程组 SIGTERM→SIGKILL）。
- 系统托盘常驻：关闭窗口最小化到托盘，托盘右键菜单可快速打开应用 / 调试日志 / 外观设置 / 重启服务器 / 退出。
- 前端零改动：直接加载 `http://127.0.0.1:<port>`，不修改上游任何代码。

## 目录结构

```
package.json        # 依赖：electron + @deepseek-ai/dsh
src/main.js         # Electron 主进程：spawn、端口发现、场景状态、生命周期、安全策略
src/preload.js      # 仅给本地 loading/error/wizard 页用的最小 bridge
src/scenarios.js    # 场景目录：每个场景生成一份 cordis.patch.yml 叠加层
src/wizard.html     # 首次启动的场景选择页
src/loading.html    # 服务器就绪前的加载页
src/error.html      # 启动失败 / 进程异常退出时展示错误
src/debug.html      # 调试页：实时显示 dsh 运行日志 + 打开日志文件
src/plugins.js      # 插件目录与安装逻辑（预装脚本共用）
src/appearance.html # 外观页：换肤 / 自定义强调色 / 界面与代码字体 / 自定义 CSS
assets/tray.png     # 托盘图标（32x32，由 scripts/gen-tray-icon.js 生成）
scripts/gen-tray-icon.js # 生成托盘图标的零依赖 Node 脚本
scripts/install-wallpaper-plugin.js # 向 web profile 预装壁纸插件（dsh-wallpaper-ui）
scripts/install-all-plugins.js      # 向 web profile 预装目录中的全部 6 个插件
test/mock-dsh.js    # 无真实运行时的桩服务器（记录 argv，便于断言 --patch 拼接）
test/wizard-check.js# 无头检查引导页渲染与 IPC 往返
test/pages-check.js # 无头检查调试页 / 外观页 / 关于页 / 第三方组件页渲染与 IPC 往返
test/rm-test-userdata.js # 分离清理测试用临时 userData（等主进程退出后删除）
electron-builder.yml # 发行打包配置：仅打包 src/依赖/logo，显式排除凭据与环境文件
.gitignore           # 忽略 node_modules / 凭据 / 环境文件 / 日志 / 构建产物
```

## 场景引导（特色：预装插件）

第一次启动会先显示场景选择页：页面上方可配置 DeepSeek API Key（可填可跳过，
写入 `$HOME/.dsh/.credentials.yaml`，与 Harness「模型」设置页共用同一存储），
下方是场景选择。每个场景对应一份 `cordis.patch.yml` 叠加层，
由壳生成后通过 `dsh web --patch <file>` 传给运行时，等价于官方 `--patch`
用法：按行 id 整体覆盖 config、`- insert:` 插入新插件、支持 `!!js` 表达式。

| 场景 | 预装内容 |
| --- | --- |
| 通用开发（推荐） | 会话全文搜索（SQLite 索引持久化到 userData）、定时提醒 `schedule_create/list/delete`、MCP 接入示例（注释形式） |
| Web 开发 | 通用能力 + 持久终端（Windows 上自动停用） |
| 数据分析 | 通用能力 + 工具结果内联上限 50 KB → 80 KB |
| 写作与研究 | 通用能力 + 写作/研究向人设 |

场景状态与产物写在 `<userData>/scenarios/` 下（Windows 为
`%APPDATA%\dsh-desktop\scenarios`）：

- `state.json`：当前场景 id（`default` 表示选择了跳过，无叠加层）。
- `active.yml`：生成的 patch 叠加层，可手动编辑；重启后生效。
- 会话搜索索引位于 `<userData>/search-index.sqlite`。

想换场景：删除整个 `scenarios/` 目录再启动即可重新选择。设置
`DSH_COMMAND` 自定义启动命令时，壳会把 `--patch <active.yml>` 插在 `web`
别名（或 `--profile <name>`）之后——rc.8 的 launcher 使用 passThroughOptions，
`--patch` 放在第一个未知参数之后会被吞进 web app 自己的 argv 而失效。

> 持久终端依赖原生模块（node-pty）。npm 11 默认拦截安装脚本；需要终端时在
> 在项目根目录执行 `npm approve-scripts` 批准后重新安装依赖。

## 调试模式

打开方式：菜单「视图 → 调试日志」（`Ctrl+Shift+D` / `Cmd+Shift+D`），
托盘右键菜单也有「调试日志」入口；启动失败的错误页上同样提供「查看运行日志」
按钮。调试页实时显示 dsh 子进程的 stdout/stderr 与壳自身的系统事件（最多保留
2000 行），并展示服务器状态：PID、地址、场景、启动时间。

- **复制日志**：把完整日志（含时间戳）写入剪贴板。
- **打开日志文件**：在文件管理器中打开落盘日志（`<userData>/logs/dsh-desktop.log`，
  超 5 MB 自动轮转为 `.old`；日志同时保留在内存缓冲与磁盘文件）。
- **清空**：清空内存中的日志缓冲。
- **重启服务器**：结束当前 dsh 进程树并重新拉起（调试页保持打开，重启后
  地址与状态会刷新）。也可以通过菜单「视图 → 重启服务器」（`Ctrl+Shift+R` /
  `Cmd+Shift+R`）或托盘右键菜单触发。
- 调试页打开期间服务器就绪不会自动跳回应用，点「返回应用」即可。

## 外观设置

打开方式：菜单「视图 → 外观设置」（`Ctrl+,` / `Cmd+,`）。设置持久化在
`<userData>/appearance.json`，立即生效：

| 设置项 | 作用范围 |
| --- | --- |
| 主题（深色/浅色/跟随系统） | 桌面壳页面 + Harness 界面（覆盖其内置主题，应用内仍可单独调整） |
| 强调色（蓝/绿/紫/橙 + 自定义取色器，任意 hex） | 桌面壳页面的按钮、选中态、滚动等强调元素 |
| 界面字体（系统/微软雅黑/苹方/Noto Sans SC/等宽/衬线） | 桌面壳页面 + Harness 界面正文（覆盖其 `--dsw-font-family` 令牌） |
| 代码字体（等宽/系统/微软雅黑/苹方/Noto Sans SC/衬线） | 代码块、行内代码（覆盖其 `--ds-font-family-code` 令牌，默认等宽） |
| 字号（12-16px） | 仅桌面壳页面 |
| 自定义 CSS | 桌面壳页面 + Harness 界面（追加到注入样式末尾，可覆盖上面的主题 / 强调色变量；上限 20 KB） |

Harness 界面的字体通过覆盖根 CSS 变量实现，主题通过切换
`body[data-ds-dark-theme]` 实现，均不修改上游文件；恢复默认或直接编辑
`appearance.json` 即可还原。


## 预装插件

背景图片由第三方 Cordis 插件 [dsh-wallpaper-ui](https://github.com/adydc-99/dsh-wallpaper)
提供（图片 / GIF / MP4 / WebM 壁纸，五种铺满模式、透明度 / 亮度 / 模糊 / 遮罩调节，
本地上传 + URL）。安装后进入 Harness 的「设置 → 壁纸」即可使用，桌面壳不再内置
背景图逻辑。

```sh
node scripts/install-wallpaper-plugin.js   # 需要 pnpm（corepack enable 或 npm i -g pnpm）
```

脚本做三件事（幂等，可重复执行）：

1. `dsh plugin --profile web add dsh-wallpaper-ui`：把插件装进 web profile 并加入
   `dsh.profile.bundles`，桌面应用与 `dsh web` 自动加载。
2. 安装 pnpm 别名 `dsh-wallpaper -> dsh-wallpaper-ui`：插件 0.1.3 自带的
   cordis.patch.yml 引用了模块名 `dsh-wallpaper`，与 npm 包名不一致，别名让
   Loader 的裸导入能解析。
3. 把别名从 `dsh.profile.bundles` 移除：避免同一 patch 应用两次导致
   `duplicate loader entry id`。

卸载：`dsh plugin --profile web remove dsh-wallpaper-ui` 后再手动移除别名依赖
（`dsh plugin --profile web remove dsh-wallpaper`）。

> 兼容性：插件 peerDependencies 声明为 `^0.1.0-rc.6`，在 rc.8 上已验证可加载
> （`/dsh-wallpaper/api/state` 返回 200，客户端模块注入启动清单）。

除壁纸外，还预装了实时统计、Git 图谱、远程 SSH、配置备份 / 迁移、任务看板等共 6 个
第三方插件，全部打进 dsh web profile，随桌面应用自动加载（不再需要应用内安装）：

| 插件 | 说明 |
| --- | --- |
| 壁纸背景（dsh-wallpaper-ui） | 图片 / GIF / MP4 / WebM 壁纸，五种铺满模式，透明度 / 亮度 / 模糊 / 遮罩调节 |
| 实时统计（@linxin666/dsh-live-stats） | Web 界面实时显示 token 估算与生成吞吐 |
| Git 图谱（@linxin666/dsh-client-ui-git-graph） | 空白会话的分支选择器 + Git 图谱 |
| 远程 SSH（@linxin666/dsh-ssh） | 远程主机配置、SSH 终端、SFTP 传输、本地端口转发 |
| 配置备份 / 迁移（dsh-config-manager） | DSH 配置的备份、导出、导入与迁移 |
| 任务看板（@linxin666/dsh-client-ui-task-board） | 宿主权威的任务看板，支持定时调度与空闲保护 |

一键预装全部插件：

```sh
node scripts/install-all-plugins.js   # 需要 pnpm（corepack enable 或 npm i -g pnpm）；幂等，可重复执行
```

脚本会自动放行 `ssh2` / `cpu-features` 的原生构建脚本（写入 profile 的
`pnpm-workspace.yaml` 的 `allowBuilds`），并把壁纸别名从 `dsh.profile.bundles`
中移除，避免 `duplicate loader entry id`。

## 稳定性自愈

- **服务器异常退出自动重启**：60 秒内最多自动拉起 3 次（指数退避 1.5s 起），
  仍失败才显示错误页；手动重启/服务器就绪会重置计数。
- **渲染进程崩溃自动重载**：60 秒内最多自动 reload 3 次，随后提示重启应用。
- 运行日志落盘：`<userData>/logs/dsh-desktop.log`，便于排查重启前的问题。
## 系统托盘

应用启动后常驻系统托盘（图标为品牌蓝点，32x32，见 `assets/tray.png`）。
点击托盘图标打开主窗口；右键菜单提供快捷入口：

- **打开应用** / **调试日志** / **外观设置**：打开对应页面并显示窗口。
- **重启服务器**：结束当前 dsh 进程树并重新拉起。
- **退出**：真正退出应用（会先清理 dsh 进程树）。

关闭主窗口会最小化到托盘而不是退出；再次打开应用可从托盘、任务栏或再次
启动程序进入。
## 安装与运行

```sh
npm install        # 首次会安装 Electron 与 dsh 运行时（依赖树较大）
npm start          # 启动桌面应用
```

> 国内网络可加 `--registry=https://registry.npmmirror.com` 加速安装；
> Electron 二进制下载失败时先设置镜像再重装：
> `$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"; node node_modules/electron/install.js`

## 运行方式与覆盖

启动时依次尝试：

1. `DSH_COMMAND` 环境变量：完整命令行（按空白切分），例如
   `DSH_COMMAND="node E:\path\to\apps\cli\src\bin.ts web --no-open --port 0"`（指向本地源码构建，需先 `pnpm run build`）。
2. 本地依赖 `@deepseek-ai/dsh`：用 Electron 自带 Node（`ELECTRON_RUN_AS_NODE=1`）直接运行
   `node_modules/@deepseek-ai/dsh/lib/bin.js web --no-open --port 0`，无需系统 Node、无需 npx。
3. 兜底：`npx --yes @deepseek-ai/dsh web --no-open --port 0`（首次会联网下载）。

常用环境变量：

- `DSH_COMMAND`：覆盖 dsh 启动命令（优先级最高；场景 patch 仍会注入，见上）。
- `DSH_DESKTOP_CWD`：dsh 服务器的工作目录（默认是启动目录）。
- `DSH_DESKTOP_START_TIMEOUT_MS`：等待 URL 宣告的超时毫秒数（默认 120000）。

## 自动化验证

无头验证模式（不干扰正常使用；测试使用独立临时 userData，绝不触碰真实
场景状态）：

```sh
npm run smoke       # 不创建窗口：拉起 dsh -> 发现端口 -> HTTP GET 200 且非空
# smoke ok: GET http://127.0.0.1:xxxxx -> 200, 14516 bytes

npx electron . --window-test   # 隐藏窗口真实加载 UI（自动选 standard 场景，含 --patch 全链路）
# window ok: loaded http://127.0.0.1:xxxxx/

npx electron test/wizard-check.js   # 引导页渲染 + 场景选择 IPC 往返
# wizard-check: rendered 4 cards, recommended selected
# wizard-check: selection round-trip ok (web-dev)
# wizard-check: api key onboarding ok

npx electron test/pages-check.js    # 调试页 / 外观页 / 关于页 / 第三方组件页渲染与 IPC 往返
# pages-check: debug page ok
# pages-check: appearance page ok
```

测试期间 Electron 进程会完整清理（含渲染/GPU 子进程与 dsh 服务器进程树），无残留。

## 凭据安全与发布准备

- **API Key 存放**：DeepSeek API Key 只写 `$HOME/.dsh/.credentials.yaml`
  （与 Harness「模型」设置页同一存储，dsh 进程会热重载外部编辑）；首次启动
  向导可填写，也可随时在应用内「模型」设置修改。
- **不携带测试凭据**：仓库与打包产物中没有任何 API Key；本机测试用的
  `DEEPSEEK_API_KEY` 已从配置中删除。`.gitignore` 忽略
  `.env*`、`*.credentials.yaml`、`logs/` 等，防止凭据误提交。
- **日志脱敏**：`pushLog` 会把形如 `sk-<32 位>` 的凭据字符串统一替换为
  `sk-***`，运行日志与调试页不会出现明文 Key。
- **打包范围**：`electron-builder.yml` 只打包 `src/`、运行时依赖与品牌
  图标，并显式排除测试目录、`.env*`、`*.credentials.yaml`、日志等；用户
  数据（`%APPDATA%\dsh-desktop`、`$HOME/.dsh`）位于用户机器上，从不进入
  安装包。
- **打包**：
  - 命令：`npx electron-builder --win --x64`（首次需 `npm i -D electron-builder`；
    证书受限环境加 `$env:NODE_OPTIONS="--use-system-ca"`，下载工具用
    `$env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"`）。
  - 输出到 `release/`（`win-unpacked\` 绿色目录 + NSIS 安装包）。
  - **`asar: false`**：dsh 的 cordis 插件树把所有 bundle 合成到 profile 根配置，bare 插件名
    从 profile 目录解析；Electron 的 asar 对 ESM 包目录遍历支持有限，打包成 asar 会导致插件
    加载失败（ERR_MODULE_NOT_FOUND），因此 node_modules 以真实目录随 `resources/app` 分发。
  - `scripts/gen-icon.js` 从 `assets/app-icon.png` 生成 `build/icon.ico`（electron-builder 自动使用）。

## 实现要点

- **端口**：`--port 0` 由 OS 分配；解析子进程 stdout 的 `dsh web: <url>` 行获取实际地址。
- **场景叠加层**：选择场景后生成 `<userData>/scenarios/active.yml`，下次启动
  自动带上 `--patch`；首个启动（无 `state.json`）先显示引导页，选定后才拉起服务器。
- **运行时**：本地依赖存在时用 Electron 自带 Node（`ELECTRON_RUN_AS_NODE=1` + `--expose-internals`）直接跑
  `@deepseek-ai/dsh/lib/bin.js`，无需系统 Node/npx；`--expose-internals` 是 `cordis-plugin-hmr` 的硬性要求。
- **进程清理**：Windows 用 `%SystemRoot%\System32\taskkill.exe /T /F`（必须用绝对路径，Node spawn 在此环境 PATH 找不到
  `taskkill`），POSIX 用进程组 SIGTERM→SIGKILL；退出时还会枚举并结束本进程的渲染/GPU 子进程，避免孤儿进程占住管道。

## 设计要点与限制

- **独立项目**：本仓库即桌面客户端源码，不在 deepseek-harness 的 pnpm workspace 内，不触碰上游配置与构建门禁。
- **安全**：窗口 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`；
  新窗口一律拒绝并转交系统浏览器；`will-navigate` 仅放行当前服务器 URL 来源。
- **端口**：`--port 0` 由 OS 分配，避免与既有服务冲突；dsh 本身只绑定 127.0.0.1。
- **托盘**：窗口关闭即隐藏到托盘（不退出），真正退出走菜单/托盘的「退出」；测试模式（`--smoke-test`/`--window-test`）不创建托盘。
- **Windows 原生风格标题栏**：Windows 保持系统原生窗口边框——标题栏、菜单栏、系统按钮均由系统渲染，菜单栏不会消失。窗口图标使用 `assets/app-icon.png`（显示于标题栏左上角与任务栏），标题固定为「Deepseek Harness +」，并由 `page-title-updated` 事件锁定，页面 `<title>` 不会覆盖品牌标题。
- **开发者工具不对外暴露**：菜单中已移除 DevTools 入口，避免普通用户误入调试面板。
- **局限**：dsh 为 developer preview，运行时升级需重新 `npm install`；
  macOS 进程隔离仍依赖 dsh 自身 fs 策略。