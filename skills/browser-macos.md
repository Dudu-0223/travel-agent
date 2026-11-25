## 操作浏览器（macOS）

用户在用电脑时你在查票，浏览器始终留在后台：

- 用 computer use 操作用户已经打开的 Chrome。不要调用 `app.activate()`、`window.show()`，不要传 `useSystemInput: true`，不要用 `osascript` / System Events 发按键，也不要切桌面。
- 不要改浏览器或系统设置（例如 Safari 的「允许 Apple 事件中的 JavaScript」、开远程调试端口），不要启动用户没开着的浏览器。
- 打开网址用 `open -g -a "Google Chrome" "<网址>"`（`-g` 表示不把浏览器切到前台），各平台尽量直接拼出带参数的搜索网址，少填表单。
- 读页面用窗口级的 `getAccessibilityTree` 和 `getScreenshot`，它们不需要前台。
- 必须交互时，先用元素操作 `invoke` / `setValue` / `performAction` / `selectText`，不行再用不带 `useSystemInput` 的窗口 `click`、`scroll`。
- 报 `FOREGROUND_REQUIRED`，或在后台点了没反应：不要改用 activate，把这个平台记成 `flight_log_search` 的 `blocked`（note 写「需要前台」），换下一个平台。
- 所有平台都查完后，如果有平台因为「需要前台」没查成，用 `ask_user_question` 问用户要不要允许把浏览器切到前台补查；用户同意后才可以 activate。
