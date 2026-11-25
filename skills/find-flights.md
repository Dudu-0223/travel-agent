# 查机票并录入旅行助手

这是调查任务：目标是查清航班、价格和行程信息，供用户比较，不是帮用户订票。

- 停在搜索结果页或行程详情页，看到航班和含税总价就够了。不要点「预订 / 选择 / 下一步」进入下单流程，不要登录，不要填乘客或支付信息。
- 只有搜索结果页看不到含税总价时，才可以点进一层详情页查看价格；页面开始要求填乘客信息就退回。
- 不用研究退改规则、会员价、优惠券、积分或订票步骤，除非用户明确问到。
- `url` 记能重新打开这个行程或搜索结果的链接，方便用户自己去看，不是订票链接。

## 开始之前

- 操作浏览器的具体做法见文末「操作浏览器」一节；不要另开无痕窗口，不要输入用户的账号密码。
- 先 `flight_summary`，看当前文件夹、已有方案和还没查的平台，不要重复录入。
- 没有文件夹就先 `flight_set_trip`；没有假期就先查好再 `flight_set_holidays`。

## 各平台怎么查

每个平台查完都要 `flight_log_search`：查到结果填 `done`，没有航班填 `no_results`，验证码、要求登录或页面打不开填 `blocked` 并在 note 里写原因，然后换下一个平台，不要卡住。

| 平台 | 怎么打开 | 注意 |
|---|---|---|
| Skyscanner | `https://www.skyscanner.net/transport/flights/<出发三字码小写>/<到达三字码小写>/<YYMMDD 去>/<YYMMDD 回>/?adultsv2=1&cabinclass=economy&currency=CNY&locale=zh-CN` | 结果页点进具体行程能拿到可直接打开的详情链接；用这个链接作为 url |
| Google Flights | `https://www.google.com/travel/flights?q=Flights%20from%20<出发>%20to%20<到达>%20on%20<YYYY-MM-DD>%20through%20<YYYY-MM-DD>&curr=CNY&hl=zh-CN` | 价格是往返总价；点开行程能看到每段航班号和时间 |
| Trip.com | `https://www.trip.com/flights/showfarefirst?dcity=<出发三字码小写>&acity=<到达三字码小写>&ddate=<YYYY-MM-DD>&rdate=<YYYY-MM-DD>&triptype=rt&class=y&quantity=1&curr=CNY&locale=zh-CN`；网址不生效再用表单 | 币种用人民币 |
| 携程 | 打开 `https://flights.ctrip.com/`，选国际·往返，填城市和日期 | 经常要求登录，挡住就记 `blocked`，不要登录 |
| 飞猪 | 打开 `https://www.fliggy.com/`，进机票，选国际往返 | 经常要求登录，挡住就记 `blocked`，不要登录 |

日期范围较宽时，先用 Google Flights 的日历或 Skyscanner 的按月视图找便宜的日期，再对那几天细查。

## 从结果里挑候选

- 每个平台挑几类：最便宜的、转机最少的、请假最少的（年前出发或节后回来，尽量贴合放假日期）。
- 自行转机（分开的两张票、行李不直挂）要在 note 里写明。
- 同一个行程在多个平台都出现时，它是同一个方案，只录入一次，其他平台的价格用 `flight_add_quote` 补。

## 录入时怎么填

- 每个航段照抄网页：航班号、出发和到达机场三字码、起飞当地日期、起飞和到达当地时间、到达时间旁的 `+1`/`+2`（填 `arriveDays`）。
- 只照抄，不要换算时区，不要自己算时长。工具报错时按错误提示改，比如核对 `arriveDays` 或补 `toTz`。
- 价格填人民币含税总价，`url` 填能直接打开这个行程的链接，`baggage` 按页面写的填。

## 问用户要哪些

录入前用一个 `ask_user_question` 让用户挑（卡片会占住用户的输入框，要短）：

- `multi_select: true`，`question` 一句话，写清是哪个文件夹、共找到几个；
- 每个选项的 `label` 写「¥价格 · 去程日期→到家日期 · 航司 · 转N次」，`description` 只写起降时间、转机地点和时长；
- 用户选中的用 `flight_add_option` 录入，没选的不录。

录入完用 `flight_summary` 核对，然后结束这一轮，不再弹卡片汇报；推荐方案、请假天数和到家时间页面上都看得到。
