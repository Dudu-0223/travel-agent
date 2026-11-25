## 操作浏览器（Windows）

Windows 上 computer use 的点击、滚动、拖动会移动用户真实的鼠标，键盘输入要求目标窗口在前台；读界面和截图按窗口进行，不需要前台。所以：先只读，必须操作的步骤攒到一起，征得用户同意后一次做完。

- 先用 `cua.getCapabilities()` 确认能用哪些操作，以它为准。
- 操作用户已经打开的浏览器（Chrome 或 Edge）。computer use 在 Windows 上不能启动没打开的应用；浏览器没开时，用 `ask_user_question` 请用户打开。不要改浏览器或系统设置，不要开远程调试端口。
- 打开网址用 PowerShell：`Start-Process "<网址>"`（用默认浏览器打开新标签页；Windows 无法保证它留在后台，打开后不要再主动切换窗口）。各平台尽量直接拼出带参数的搜索网址，这样打开即是结果页，不用点击和输入。
- 读结果用窗口级的 `getAccessibilityTree` 和 `getScreenshot`。只读阶段不要调用 `click`、`scroll`、`drag`、`typeText`、`pressKey`、`app.activate()`，也不要传 `useSystemInput: true`。
- 结果页需要滚动、点开详情或填表单时，先不要做：把这个平台记成 `flight_log_search` 的 `blocked`（note 写「需要前台操作：<要做什么>」），换下一个平台。
- 所有平台的只读部分查完后，如果有平台需要前台操作，用一个 `ask_user_question` 问用户：「还有 N 个平台需要操作浏览器（会占用鼠标和键盘约 X 分钟），现在可以吗？」用户同意后才 `app.activate()` 并逐个补查，查完用 `flight_log_search` 更新状态；用户不同意就保持 `blocked`。
- 每次操作后都重新截图或读界面确认结果，不要在没看到效果时重复点击。
