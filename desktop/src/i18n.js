'use strict'

// UI language catalog for the dsh-desktop shell (menus, tray, and local pages).
// The Harness web UI is a separate product and keeps its own language.

const LANGUAGES = [
  { id: 'zh', label: '中文' },
  { id: 'en', label: 'English' },
]

const MESSAGES = {
  zh: {
    // menus & tray
    'menu.app': '应用',
    'menu.app.back': '返回应用',
    'menu.reload': '重新加载当前页',
    'menu.quit': '退出',
    'menu.edit': '编辑',
    'menu.undo': '撤销',
    'menu.redo': '重做',
    'menu.cut': '剪切',
    'menu.copy': '复制',
    'menu.paste': '粘贴',
    'menu.selectAll': '全选',
    'menu.view': '视图',
    'menu.debug': '调试日志',
    'menu.appearance': '外观设置',
    'menu.restartServer': '重启服务器',
    'menu.language': '语言',
    'menu.language.zh': '中文',
    'menu.language.en': 'English',
    'menu.about': '关于',
    'menu.about.about': '关于本程序',
    'menu.about.thirdParty': '第三方组件与许可',
    'tray.openApp': '打开应用',
    'common.backToApp': '返回应用',

    // loading page
    'loading.title': '正在启动 DeepSeek Harness',
    'loading.main': '正在启动 DeepSeek Harness 服务器…',
    'loading.sub': '正在准备 127.0.0.1 上的本地服务器。',
    'loading.hint': 'Deepseek正在偷吃你的Tokens...',

    // error page
    'error.title': 'DeepSeek Harness 启动失败',
    'error.unknown': '未知错误。',
    'error.viewLogs': '查看运行日志',

    // wizard
    'wizard.title': '选择使用场景 — DeepSeek Harness',
    'wizard.heading': '选择你的使用场景',
    'wizard.sub': '桌面版会按场景为你预装一组插件与配置。之后随时可以编辑配置文件或重新选择场景，不影响已有会话。',
    'wizard.apiKey.heading': 'DeepSeek API Key',
    'wizard.apiKey.checking': '检测中…',
    'wizard.apiKey.configured': '已配置（{masked}）· 可在应用设置中修改',
    'wizard.apiKey.notConfigured': '尚未配置',
    'wizard.apiKey.unavailable': '无法检测凭据状态',
    'wizard.apiKey.desc': '首次使用需要 API Key 才能调用模型。可在这里填写，之后也能随时在应用设置里修改。',
    'wizard.apiKey.show': '显示',
    'wizard.apiKey.hide': '隐藏',
    'wizard.apiKey.save': '保存',
    'wizard.apiKey.required': '请输入 API Key',
    'wizard.apiKey.saved': '已保存，可以继续启动了。',
    'wizard.apiKey.saveFailed': '保存失败：',
    'wizard.continue': '继续启动',
    'wizard.skip': '先跳过，用默认配置',
    'wizard.recommended': '推荐',
    'wizard.loadFailed': '无法加载场景列表：',

    // debug page
    'debug.title': '调试日志 — DeepSeek Harness',
    'debug.heading': '调试日志',
    'debug.loading': '读取中…',
    'debug.copy': '复制日志',
    'debug.openLog': '打开日志文件',
    'debug.clear': '清空',
    'debug.restart': '重启服务器',
    'debug.running': '运行中',
    'debug.stopped': '已停止',
    'debug.notStarted': '未启动',
    'debug.unavailable': '不可用',
    'debug.empty': '暂无日志',
    'debug.autoscroll': '自动滚动到最新',
    'debug.count': '共 {count} 行',
    'debug.meta.pid': 'PID',
    'debug.meta.url': '地址',
    'debug.meta.scenario': '场景',
    'debug.meta.started': '启动时间',
    'debug.restartConfirm': '确定要重启 dsh 服务器吗？',
    'debug.defaultScenario': '默认配置',
    'debug.notSelected': '未选择',

    // appearance page
    'appearance.title': '外观设置 — DeepSeek Harness',
    'appearance.heading': '外观设置',
    'appearance.sub': '主题、强调色与字体（界面字体与代码块字体可分开设置）会同时应用到桌面壳页面和 Harness 界面；在 Harness 应用内仍可单独调整主题。字号仅作用于桌面壳页面。自定义强调色与自定义 CSS 为进阶项。',
    'appearance.lang': '语言',
    'appearance.langSub': '切换桌面壳界面语言（中文 / English），立即生效。',
    'appearance.theme': '主题',
    'appearance.theme.dark': '深色',
    'appearance.theme.light': '浅色',
    'appearance.theme.system': '跟随系统',
    'appearance.accent': '强调色',
    'appearance.accentCustom': '自定义：',
    'appearance.fontUi': '界面字体',
    'appearance.fontCode': '代码字体',
    'appearance.size': '字号',
    'appearance.css': '自定义 CSS（进阶）',
    'appearance.cssPlaceholder': '例如：:root { --dsh-border-radius: 8px; }',
    'appearance.cssSave': '保存自定义 CSS',
    'appearance.cssHint': '注入到桌面壳页面与 Harness 界面的样式末尾，保存后立即生效，可覆盖上面的主题 / 强调色变量；留空保存可清除。',
    'appearance.preview': '预览',
    'appearance.previewText': 'DeepSeek Harness 外观预览：中文排版与强调色，代码 {code}，以及 12345 数字。',
    'appearance.reset': '恢复默认',
    'appearance.font.system': '系统默认',
    'appearance.font.yahei': '微软雅黑',
    'appearance.font.pingfang': '苹方',
    'appearance.font.noto': 'Noto Sans SC',
    'appearance.font.mono': '等宽（Cascadia Mono / Consolas）',
    'appearance.font.serif': '衬线（宋体 / Georgia）',

    // about page
    'about.title': '关于 — DeepSeek Harness',
    'about.disclaimer': '本程序不隶属于Deepseek Harness和Deepseek Harness Desktop',
    'about.licenseNote': '本程序完全开源，并遵守MIT开源协议',
    'about.linkHarness': 'Deepseek Harness GitHub',
    'about.linkSite': 'Deepseek 官方网站',
    'about.authorLabel': '作者',
    'about.authorProfile': '个人主页（B站）',
    'about.authorRepo': '项目仓库（GitHub）',

    // third-party page
    'thirdparty.title': '第三方组件与许可 — DeepSeek Harness',
    'thirdparty.heading': '第三方组件与许可',
    'thirdparty.note': '本页列出 Deepseek Harness Plus 使用的主要第三方组件与预装插件；完整依赖树均为宽松许可证（MIT / Apache-2.0 / BSD / ISC 等）。点击链接可查看各项目主页与许可证原文。',
    'thirdparty.runtime': '运行时组件（随安装包分发）',
    'thirdparty.plugins': '预装插件（首次启动自动安装到用户目录）',
    'thirdparty.colName': '名称',
    'thirdparty.colVersion': '版本',
    'thirdparty.colLicense': '许可证',
    'thirdparty.colDesc': '说明',
    'thirdparty.colLink': '链接',
    'thirdparty.footnote': '* sharp 的预编译二进制捆绑 libvips（LGPL-3.0-or-later），随安装包分发时需履行 LGPL 义务（保留许可文本并提供可重链接方式或说明）。本程序在 MIT 协议下开源；各第三方组件版权归其各自作者所有。',

    // main-process errors
    'err.apiKeyFormat': 'API Key 格式不正确：应以 sk- 开头，至少 16 位字母数字。',
    'err.saveFailed': '保存失败：',
  },

  en: {
    // menus & tray
    'menu.app': 'App',
    'menu.app.back': 'Back to App',
    'menu.reload': 'Reload Page',
    'menu.quit': 'Quit',
    'menu.edit': 'Edit',
    'menu.undo': 'Undo',
    'menu.redo': 'Redo',
    'menu.cut': 'Cut',
    'menu.copy': 'Copy',
    'menu.paste': 'Paste',
    'menu.selectAll': 'Select All',
    'menu.view': 'View',
    'menu.debug': 'Debug Logs',
    'menu.appearance': 'Appearance',
    'menu.restartServer': 'Restart Server',
    'menu.language': 'Language',
    'menu.language.zh': 'Chinese',
    'menu.language.en': 'English',
    'menu.about': 'About',
    'menu.about.about': 'About This App',
    'menu.about.thirdParty': 'Third-Party Components & Licenses',
    'tray.openApp': 'Open App',
    'common.backToApp': 'Back to App',

    // loading page
    'loading.title': 'Starting DeepSeek Harness',
    'loading.main': 'Starting DeepSeek Harness server…',
    'loading.sub': 'Preparing the local server on 127.0.0.1.',
    'loading.hint': 'Deepseek is munching on your Tokens...',

    // error page
    'error.title': 'DeepSeek Harness Failed to Start',
    'error.unknown': 'Unknown error.',
    'error.viewLogs': 'View Logs',

    // wizard
    'wizard.title': 'Choose a Scenario — DeepSeek Harness',
    'wizard.heading': 'Choose Your Scenario',
    'wizard.sub': 'The desktop app preinstalls a set of plugins and configuration for each scenario. You can edit the config files or reselect a scenario at any time without affecting existing sessions.',
    'wizard.apiKey.heading': 'DeepSeek API Key',
    'wizard.apiKey.checking': 'Checking…',
    'wizard.apiKey.configured': 'Configured ({masked}) · Change in app settings',
    'wizard.apiKey.notConfigured': 'Not configured',
    'wizard.apiKey.unavailable': 'Could not detect credential status',
    'wizard.apiKey.desc': 'An API Key is required on first use to call models. You can enter it here and change it later in the app settings.',
    'wizard.apiKey.show': 'Show',
    'wizard.apiKey.hide': 'Hide',
    'wizard.apiKey.save': 'Save',
    'wizard.apiKey.required': 'Please enter an API Key',
    'wizard.apiKey.saved': 'Saved. You can continue now.',
    'wizard.apiKey.saveFailed': 'Save failed: ',
    'wizard.continue': 'Continue',
    'wizard.skip': 'Skip for Now, Use Defaults',
    'wizard.recommended': 'Recommended',
    'wizard.loadFailed': 'Could not load scenarios: ',

    // debug page
    'debug.title': 'Debug Logs — DeepSeek Harness',
    'debug.heading': 'Debug Logs',
    'debug.loading': 'Loading…',
    'debug.copy': 'Copy Logs',
    'debug.openLog': 'Open Log File',
    'debug.clear': 'Clear',
    'debug.restart': 'Restart Server',
    'debug.running': 'Running',
    'debug.stopped': 'Stopped',
    'debug.notStarted': 'Not started',
    'debug.unavailable': 'Unavailable',
    'debug.empty': 'No logs',
    'debug.autoscroll': 'Auto-scroll to latest',
    'debug.count': '{count} lines total',
    'debug.meta.pid': 'PID',
    'debug.meta.url': 'URL',
    'debug.meta.scenario': 'Scenario',
    'debug.meta.started': 'Started',
    'debug.restartConfirm': 'Restart the dsh server?',
    'debug.defaultScenario': 'Default Configuration',
    'debug.notSelected': 'Not selected',

    // appearance page
    'appearance.title': 'Appearance — DeepSeek Harness',
    'appearance.heading': 'Appearance',
    'appearance.sub': 'Theme, accent color, and fonts (UI font and code font are separate) apply to both the shell pages and the Harness UI; you can still adjust the theme inside Harness. Font size only affects the shell pages. Custom accent color and custom CSS are advanced options.',
    'appearance.lang': 'Language',
    'appearance.langSub': 'Switch the desktop shell language (Chinese / English). Takes effect immediately.',
    'appearance.theme': 'Theme',
    'appearance.theme.dark': 'Dark',
    'appearance.theme.light': 'Light',
    'appearance.theme.system': 'System',
    'appearance.accent': 'Accent Color',
    'appearance.accentCustom': 'Custom:',
    'appearance.fontUi': 'UI Font',
    'appearance.fontCode': 'Code Font',
    'appearance.size': 'Font Size',
    'appearance.css': 'Custom CSS (Advanced)',
    'appearance.cssPlaceholder': 'e.g. :root { --dsh-border-radius: 8px; }',
    'appearance.cssSave': 'Save Custom CSS',
    'appearance.cssHint': 'Injected at the end of the shell pages and the Harness UI styles; takes effect immediately after saving. Overrides the theme / accent variables above; save empty to clear.',
    'appearance.preview': 'Preview',
    'appearance.previewText': 'DeepSeek Harness appearance preview: English typography and accent color, code {code}, and 12345.',
    'appearance.reset': 'Reset to Defaults',
    'appearance.font.system': 'System Default',
    'appearance.font.yahei': 'Microsoft YaHei',
    'appearance.font.pingfang': 'PingFang SC',
    'appearance.font.noto': 'Noto Sans SC',
    'appearance.font.mono': 'Monospace (Cascadia Mono / Consolas)',
    'appearance.font.serif': 'Serif (SimSun / Georgia)',

    // about page
    'about.title': 'About — DeepSeek Harness',
    'about.disclaimer': 'This program is not affiliated with Deepseek Harness or Deepseek Harness Desktop',
    'about.licenseNote': 'This program is fully open source and is licensed under the MIT License',
    'about.linkHarness': 'Deepseek Harness GitHub',
    'about.linkSite': 'Deepseek Official Website',
    'about.authorLabel': 'Author',
    'about.authorProfile': 'Profile (Bilibili)',
    'about.authorRepo': 'Repository (GitHub)',

    // third-party page
    'thirdparty.title': 'Third-Party Components & Licenses — DeepSeek Harness',
    'thirdparty.heading': 'Third-Party Components & Licenses',
    'thirdparty.note': 'This page lists the main third-party components and preinstalled plugins used by Deepseek Harness Plus; the full dependency tree uses permissive licenses (MIT / Apache-2.0 / BSD / ISC, etc.). Click a link to view each project homepage and its license text.',
    'thirdparty.runtime': 'Runtime Components (bundled with the installer)',
    'thirdparty.plugins': 'Preinstalled Plugins (installed to the user profile on first launch)',
    'thirdparty.colName': 'Name',
    'thirdparty.colVersion': 'Version',
    'thirdparty.colLicense': 'License',
    'thirdparty.colDesc': 'Description',
    'thirdparty.colLink': 'Link',
    'thirdparty.footnote': '* sharp prebuilt binaries bundle libvips (LGPL-3.0-or-later); when distributing the installer you must comply with the LGPL obligations (keep the license text and provide a way to relink or an explanation). This program is open source under the MIT License; all third-party components remain copyrighted by their respective authors.',

    // main-process errors
    'err.apiKeyFormat': 'Invalid API Key format: must start with sk- and be at least 16 alphanumeric characters.',
    'err.saveFailed': 'Save failed: ',
  },
}

function translate(lang, key, params) {
  const table = MESSAGES[lang] || MESSAGES.zh
  let text = table[key] ?? MESSAGES.zh[key] ?? key
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value))
    }
  }
  return text
}

module.exports = { LANGUAGES, MESSAGES, translate }