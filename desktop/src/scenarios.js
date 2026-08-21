'use strict'

/**
 * Scenario catalog for dsh-desktop.
 *
 * Each scenario composes a cordis.patch.yml overlay that the shell passes to
 * `dsh web --patch <file>`. A patch replaces a row's whole `config` by id, or
 * inserts new rows (`- insert:`). The loader evaluates `!!js` expressions,
 * exactly like the shipped bundle patches.
 */

const yamlString = (value) => JSON.stringify(value)

const blocks = {
  // Enable durable full-text session search (base/web-app default: `never`).
  sessionSearch: (indexPath) => `- id: session-query-sqlite
  config:
    path: ${yamlString(indexPath)}
    openAt: startup`,

  // Session-scoped durable reminders (schedule_create/list/delete).
  schedule: `- insert:
    - id: time-context
      name: '@deepseek-ai/dsh-time-context'

    - id: schedule
      name: '@deepseek-ai/dsh-schedule'`,

  // Persistent PTY terminals; bash backend only exists on POSIX.
  terminals: `- insert:
    - id: terminal
      name: '@deepseek-ai/dsh-terminal'

    - id: terminal-bash
      name: '@deepseek-ai/dsh-terminal-bash'
      disabled: !!js process.platform === 'win32'

    - id: tool-bash-persistent
      name: '@deepseek-ai/dsh-tool-bash-persistent'
      disabled: !!js process.platform === 'win32'`,

  // MCP wiring examples, shipped commented so the tree boots unchanged.
  mcpExamples: `# ---- MCP 服务器接入示例（启用：删除行首 # 并按需修改，每条一个实例） ----
# - id: mcp-filesystem
#   name: '@deepseek-ai/dsh-mcp-client'
#   config:
#     serverName: filesystem
#     transport: stdio
#     command: npx
#     args: ['-y', '@modelcontextprotocol/server-filesystem', 'C:\\work']
#
# - id: mcp-remote
#   name: '@deepseek-ai/dsh-mcp-client'
#   config:
#     serverName: remote
#     transport: streamable-http
#     url: http://127.0.0.1:8080/mcp`,

  // Let the model keep more tool output inline (default 50 KB).
  spillBump: `- id: spill-policy
  config:
    maxInlineBytes: 80000`,

  personaWriting: `- id: system-prompt
  config:
    persona: >-
      You are a thoughtful writing, research, and knowledge assistant running as
      the {{model}} model, working in {{cwd}}. You prefer precise, well-structured
      prose over code. Ground claims in sources the user can check; when asked to
      research, propose a short plan first, then summarize findings with concrete
      references to files or pages you actually consulted. Ask before making
      large changes to the user's documents.`,
}

const SCENARIOS = [
  {
    id: 'standard',
    label: '通用开发',
    labelEn: 'General Development',
    description: '日常编程与通用任务：预装会话全文搜索和定时提醒，保持默认人设。',
    descriptionEn: 'Everyday coding and general tasks: preinstalls full-text session search and scheduled reminders, keeping the default persona.',
    features: [
      '会话全文搜索（侧栏可检索历史会话内容）',
      '定时提醒工具 schedule_create / schedule_list / schedule_delete',
      'MCP 服务器接入示例（注释形式，可随时启用）',
    ],
    featuresEn: [
      'Full-text session search (browse past sessions in the sidebar)',
      'Scheduled reminder tools schedule_create / schedule_list / schedule_delete',
      'MCP server wiring examples (commented, enable anytime)',
    ],
    build: (ctx) => [
      header('standard'),
      blocks.sessionSearch(ctx.indexPath),
      blocks.schedule,
      blocks.mcpExamples,
    ].join('\n\n'),
  },
  {
    id: 'web-dev',
    label: 'Web 开发',
    labelEn: 'Web Development',
    description: '前端/全栈开发：在通用能力之上预装持久终端，方便跑 dev server 和长任务。',
    descriptionEn: 'Frontend/full-stack development: adds persistent terminals on top of the general capabilities for dev servers and long-running tasks.',
    features: [
      '会话全文搜索',
      '持久终端（同一 shell 跨多轮复用；Windows 上自动停用）',
      '定时提醒 + MCP 接入示例',
    ],
    featuresEn: [
      'Full-text session search',
      'Persistent terminals (one shell reused across turns; auto-disabled on Windows)',
      'Scheduled reminders + MCP wiring examples',
    ],
    build: (ctx) => [
      header('web-dev'),
      blocks.sessionSearch(ctx.indexPath),
      blocks.schedule,
      blocks.terminals,
      blocks.mcpExamples,
    ].join('\n\n'),
  },
  {
    id: 'data',
    label: '数据分析',
    labelEn: 'Data Analysis',
    description: '数据处理与脚本任务：放宽工具输出上限，便于查看大段结果。',
    descriptionEn: 'Data processing and scripting: raises the tool output limit so large results are easier to inspect.',
    features: [
      '会话全文搜索',
      '工具结果内联上限提升（50 KB -> 80 KB）',
      '定时提醒 + MCP 接入示例',
    ],
    featuresEn: [
      'Full-text session search',
      'Raised inline tool output limit (50 KB -> 80 KB)',
      'Scheduled reminders + MCP wiring examples',
    ],
    build: (ctx) => [
      header('data'),
      blocks.sessionSearch(ctx.indexPath),
      blocks.spillBump,
      blocks.schedule,
      blocks.mcpExamples,
    ].join('\n\n'),
  },
  {
    id: 'writing',
    label: '写作与研究',
    labelEn: 'Writing & Research',
    description: '写作、调研、知识整理：预装写作向人设和定时提醒。',
    descriptionEn: 'Writing, research, and knowledge management: preinstalls a writing persona and scheduled reminders.',
    features: [
      '写作/研究人设（可编辑生成的 patch 文件修改）',
      '会话全文搜索',
      '定时提醒 + MCP 接入示例',
    ],
    featuresEn: [
      'Writing/research persona (edit the generated patch file to adjust)',
      'Full-text session search',
      'Scheduled reminders + MCP wiring examples',
    ],
    build: (ctx) => [
      header('writing'),
      blocks.personaWriting,
      blocks.sessionSearch(ctx.indexPath),
      blocks.schedule,
      blocks.mcpExamples,
    ].join('\n\n'),
  },
]

function header(id) {
  const scenario = SCENARIOS.find((entry) => entry.id === id)
  const label = scenario ? scenario.label : id
  return `# dsh-desktop scenario overlay: ${label}
# Generated automatically by dsh-desktop; re-selecting a scenario overwrites this
# file. You may edit it freely between selections.
`
}

module.exports = { SCENARIOS }
