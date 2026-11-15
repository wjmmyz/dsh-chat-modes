# 对话模式 · Chat modes

给 DeepSeek Harness 增加两个 agent preset，共用一个还原 DeepSeek 网页端的纯对话环境：

| preset id | 显示名 | 人设 |
|---|---|---|
| `chat` | 对话 | 干净的网络对话助手，附详细看图规则 |
| `chat-whale` | 对话·鲸鱼娘 | 温柔妻子底色的鲸鱼娘，配一点傲娇（会嘟囔、被夸先嘴硬、证据面前立刻认错），交付时主动交代清楚、说话暖 |

两者的能力组成完全相同，只换 persona 的提示词。

## 安装

这是一个 DSH bundle，通过 profile 安装：

```sh
# 从本地目录安装
dsh plugin --profile <profile> add link:/path/to/chat-mode
```

或在 Web 界面：**插件（Plugins） → 添加插件 → 选择本地目录**。

安装后新会话选择器与 设置 → 通用 里会出现「对话」和「对话·鲸鱼娘」。


## 看图规则

「对话」与「对话·鲸鱼娘」都在提示词里要求：看图先 `read_image` 真看一眼，再按
「定性 → 逐项描述 → 读出文字与数据 → 代码/表格完整还原 → 看不清就直说」回答；
用户问具体问题时直接回答问题，描述服务于结论。

## 交付风格（仅鲸鱼娘）

`chat-whale` 另有一段【交付这一下最要紧】，写在性格段之前，优先级更高：

- 先给结论再给细节，第一句就让主人知道东西到了
- 交付时至少带一句人话（体贴／说明／邀功），不冷冰冰甩结果
- 不完美的地方主动说出来并给下一步
- 主人道谢要接住，不满意先接情绪不甩锅，沉默时给台阶
- 傲娇在交付、道谢、不满意、焦虑这几个场景一律收起来
- 绝不用"把不确定说成确定"来换亲和力

## 保留下来的能力

| 能力 | 组成行 |
|---|---|
| 对话身份与作答纪律 | `persona`（关闭可选运行时上下文，系统提示词保持干净） |
| 联网搜索 + 抓网页 | `tool-web`（`fetch: true`；`search` 默认开） |
| 读取文本文件、读取图片 | `tool-fs`（`read` / `readImage` 开，`write` / `edit` / `applyPatch` 关） |
| 当前时间锚点 | `time-context`（pre-step 的 user-role 消息，不进系统提示词） |
| Office 文档解析 | `skill-office` + `tool-skill` + `tool-office` |
| 长对话压缩、`/compact` | `compaction` 组 |

## 刻意去掉的能力

终端（`bash` / `pwsh` / 持久 shell）、写文件与编辑（`write` / `edit` / `apply_patch`）、
文件检索（`glob` / `grep`）、子代理与 workflow、goal / plan / todo、定时任务、
后台 job 控制、`present`、插件管理工具、`load_workspace_dependencies`。

### Shell 围栏（`shell-fence`）

只靠"preset 里不声明"是不够的：宿主平面会**全局注册** `win_bash` 这类工具，而全局注册
对每个 agent 都可见，于是一个声称"没有终端"的模式照样会把 shell 摆在模型的工具清单里，
模型就会去调用，然后撞上 `SANDBOX_UNSUPPORTED` 之类的拒绝。

`index.js` 这一行挂在两个 preset 自己的工具层里，调用 `ctx.tools.restrict({ deny })`
把这些名字从本模式的可见工具中摘掉；其它模式完全不受影响。它只 deny、不新增，
名字没注册时不会报错，并在 `tools/change` 时重试，所以上游改名只会退化成"没拦住"，
不会把模式弄坏。

也**没有**挂 `dsh-skill-filesystem`：会话里不会出现用户目录（`~/.dsh/skills`、
`~/.agents/skills`）和项目目录（`.dsh/skills`、`.agents/skills`）里的 skill，
只有自带的官方 Office 这一组。因此 `skill-office` 的 `pythonEnvironment` 取 `user`
（本组成没有 `load_workspace_dependencies`）。

## 使用

1. 新会话选择器里选「对话」或「对话·鲸鱼娘」；或在 设置 → 通用 里把默认模式改成其中一个。
2. 新 preset 只对新会话生效；已经开始的会话保持它启动时的模式。

## 依赖的宿主能力

`ctx.tools`、`ctx.fs`（只读）、`ctx.skills`、`ctx.web`、`ctx.officeKit` 与
`ctx.attachments` 都在宿主组成里，不需要本包提供。Office 解析需要宿主挂了
`@deepseek-ai/dsh-office-kit`（Web/Desktop 默认挂载）。

## 限制

- 不能写文件：`office_convert` 导出的临时文件没有 shell 可以复制到用户目录，
  只能告知用户临时文件位置或让其另存。
- 没有 `glob` / `grep`：要让模型读某个文件，需给出完整路径。
- 没有 `ask_user_question`：需求含混时靠对话澄清，不会弹出选择卡。
- skill 目录被刻意收窄，所以这两个模式里没有 `dsh-doc`、`godot-4-development` 等
  其他 skill；需要它们时请切回其他模式。
- 自定义：用 Web 的模式编辑器（或 profile 的 `cordis.patch.yml` 按行 id
  `preset-chat` / `preset-chat-whale` 覆盖 `config.plugins`），不要直接改包内文件，
  包更新会覆盖。
