# travel-agent

DeepSeek Harness 插件：旅行助手，支持 macOS 和 Windows。旅行目录（默认 `~/travel`）里的每个会话就是一个行程文件夹。

- **主页**（左侧栏「旅行助手」）：列出旅行目录里的会话，每个一张卡片，显示行程标题、路线、方案数、最低价、最少请假天数和是否正在查询。点卡片进入这个会话；底部输入框发一条消息就在后台新建一个会话（新卡片），页面留在主页。卡片上的「归档」用 DSH 的会话归档，主页底部「已归档」可以恢复。
- **会话里的「机票方案」视图**：这个会话的文件夹、推荐方案、方案详情。推荐方案按价格、请假天数、转机次数逐层取不被支配的方案（`model.js` 的 `rankOptions`），整层加入，直到至少 5 个；第 1 层带最便宜 / 最省假 / 最好飞标签，之后的标「备选」。回程的到家日期和时间用绿色「到家」标出。「‹ 全部行程」回主页；「在侧边栏看运行过程」用 DSH 右侧栏打开这个会话的聊天过程。方案详情里的「归档」只在这台电脑的浏览器里隐藏单个方案（localStorage `dsh-travel-agent.archived`）。
- 输入框、ask_user_question 提问卡片、对话 / 轨迹视图、右侧栏都是 DSH 自带的。其他会话的标题栏也会出现「机票方案」，没有行程数据时只有一个回旅行助手的按钮。

## 配置

`cordis.patch.yml` 里这一行的 `config.tripsDir` 是旅行目录，默认 `~/travel`；`~/` 在两个系统上都展开成用户主目录（Windows 上是 `C:\Users\<用户名>\travel`）。插件启动时会创建这个目录，没有 `AGENTS.md` 时从 `workspace/AGENTS.md` 复制一份。改了 `~/travel/AGENTS.md` 之后，想让别的机器也用上，记得同步回 `workspace/AGENTS.md`。

## 助手的说明

- `~/travel/AGENTS.md`：调查目标、你的偏好、查票流程，两个系统通用。
- `find-flights` skill：插件只在旅行目录的会话里提供，由 `skills/find-flights.md`（各平台怎么查、怎么录入）加上当前系统的浏览器操作说明拼成：macOS 用 `skills/browser-macos.md`（全程后台，`open -g` 打开网页），Windows 用 `skills/browser-windows.md`（Windows 上点击会动真实鼠标、键盘要求前台，所以先只读，需要操作的平台攒起来问过你再一次做完）。

## 文件

- `model.js`：纯逻辑。参数校验、机场时区、飞行与转机时长、请假天数、推荐分层。
- `index.js`：Host 端。`tripsDir` 配置、`flight_*` 工具（只对旅行目录的会话开放）、`find-flights` skill、投影 `flightBoard`（完整方案）和 `flightTrip`（主页卡片摘要）。
- `client.js`：主页、机票方案视图、左侧栏入口。旅行目录从 Host 配置同步过来，Windows 路径比较时忽略大小写和分隔符差异。

## 安装

插件管理 → 添加插件 → 选择本目录（或让助手用 `plugin_manager install_bundle` 安装这个目录）。修改后在插件管理里重新启用 `travel-agent` 即可重新加载。Windows 上助手用 PowerShell 的 `Start-Process` 打开网页，需要浏览器（Chrome 或 Edge）已经打开。

## 已知限制

- Windows 版没有在真机上跑过；浏览器操作说明依据 DSH 的 Windows computer use 文档编写。
- 旅行目录如果是软链接，页面按 DSH 工作区的真实路径匹配，可能找不到；请用真实路径配置。
