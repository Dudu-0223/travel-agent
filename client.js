/**
 * Client half of the travel agent: a 机票方案 Conversation view that shows the trip folders and flight options from the
 * `flightBoard` projection, and a left-sidebar entry that opens the dedicated travel Session on that view. Everything
 * else — header views, composer, ask_user_question cards, the right sidebar's side chat — is the host's own.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-travel-agent',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useRef, useState } = React

    const PANEL_ID = 'travel-agent'
    const NS = 'travelAgent'
    const VIEW_ID = 'travel'
    /**
     * Comparable form of an absolute path from the Host: Windows paths (drive or UNC) compare without case and
     * separator differences; trailing separators are ignored.
     */
    const pathKey = path => {
      if (typeof path !== 'string') return undefined
      if (/^[A-Za-z]:[\\/]|^\\\\/.test(path)) return path.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()
      return path.replace(/\/+$/, '') || '/'
    }
    const samePath = (a, b) => pathKey(a) !== undefined && pathKey(a) === pathKey(b)
    /** Source for an absent synced field (a Host without `tripsDir`): always undefined. */
    const NO_VALUE = { getSnapshot: () => undefined, subscribe: () => () => {} }
    const CSS = ".ta-board{container:ta-board/inline-size;box-sizing:border-box;width:100%;max-width:760px;margin:0 auto;padding:20px 24px 32px;display:flex;flex-direction:column;gap:20px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}\n.ta-board[hidden]{display:none}\n.ta-muted{color:var(--dsw-alias-label-secondary)}\n.ta-faint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}\n.ta-p{margin:0}\n.ta-ellipsis{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.ta-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap}\n.ta-icon{flex:none;display:block}\n.ta-card{border-radius:var(--dsw-radius-lg);border:0.5px solid var(--dsw-alias-settings-card-stroke);background:var(--dsw-alias-settings-card-fill)}\n.ta-section{display:flex;flex-direction:column;gap:10px}\n.ta-section-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}\n.ta-section-title{margin:0;font-size:14px;line-height:20px;font-weight:500}\n.ta-toolbar{display:flex;align-items:center;gap:12px;min-height:28px}\n.ta-toolbar-gap{flex:1}\n.ta-back{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 8px 0 4px;margin-left:-4px;border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-secondary);font-size:13px;cursor:pointer}\n.ta-btn{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:var(--dsw-radius-sm);border:0.5px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px;white-space:nowrap;cursor:pointer}\n.ta-text-btn{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;height:24px;padding:0 8px;border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;white-space:nowrap;cursor:pointer}\n.ta-disclosure{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:6px;min-width:0;height:28px;padding:0 6px;margin-left:-6px;border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-secondary);font-size:13px;cursor:pointer}\n.ta-disclosure-icon{display:inline-flex;transition:transform 120ms ease}\n.ta-disclosure-icon[data-open=true]{transform:rotate(90deg)}\n.ta-folder-name{color:var(--dsw-alias-label-primary);font-weight:500}\n.ta-back:focus-visible,.ta-btn:focus-visible,.ta-text-btn:focus-visible,.ta-disclosure:focus-visible,.ta-opt:focus-visible,.ta-link:focus-visible,.ta-trip-open:focus-visible,.ta-send:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}\n@media (hover:hover){\n.ta-back:hover,.ta-disclosure:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}\n.ta-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}\n.ta-text-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}\n.ta-opt:hover{background:var(--dsw-alias-interactive-bg-hover)}\n.ta-opt:hover .ta-opt-chev{color:var(--dsw-alias-label-secondary)}\n.ta-link:hover{text-decoration:underline dotted;text-underline-offset:3px}\n.ta-trip-open:hover{background:var(--dsw-alias-interactive-bg-hover)}\n.ta-send:hover:enabled{background:var(--dsw-alias-button-primary-hover)}\n}\n.ta-status{display:inline-flex;align-items:center;gap:6px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);white-space:nowrap}\n.ta-status::before{content:'';width:6px;height:6px;border-radius:50%;corner-shape:round;background:var(--dsw-alias-state-business-primary);animation:ta-pulse 1.4s ease-in-out infinite}\n@keyframes ta-pulse{0%,100%{opacity:.35}50%{opacity:1}}\n@media (prefers-reduced-motion:reduce){.ta-status::before{animation:none}.ta-disclosure-icon{transition:none}}\n.ta-empty{margin:0;color:var(--dsw-alias-label-tertiary)}\n.ta-empty-state{display:flex;flex-direction:column;align-items:center;gap:12px;margin:64px auto;max-width:360px;text-align:center}\n.ta-empty-icon{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:var(--dsw-radius-md);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent);color:var(--dsw-alias-state-business-primary)}\n.ta-error{font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary)}\n.ta-folder{display:flex;flex-direction:column;gap:16px}\n.ta-trip-head{display:flex;flex-direction:column;gap:4px}\n.ta-trip-title{margin:0;font-size:20px;line-height:28px;font-weight:500}\n.ta-folder-body{display:flex;flex-direction:column;gap:20px}\n.ta-chips{display:flex;flex-wrap:wrap;gap:6px}\n.ta-chip{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:999px;corner-shape:round;border:0.5px solid var(--dsw-alias-border-l2);font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);white-space:nowrap}\n.ta-chip[data-state=done]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 10%,transparent);border-color:transparent;color:var(--dsw-alias-label-primary)}\n.ta-chip-dot{width:6px;height:6px;border-radius:50%;corner-shape:round;background:var(--dsw-alias-label-tertiary)}\n.ta-chip[data-state=blocked] .ta-chip-dot{background:var(--dsw-alias-state-warn-primary)}\n.ta-opts{display:flex;flex-direction:column;border-radius:var(--dsw-radius-lg);border:0.5px solid var(--dsw-alias-settings-card-stroke);background:var(--dsw-alias-settings-card-fill);overflow:hidden}\n.ta-opt{all:unset;box-sizing:border-box;display:grid;grid-template-columns:120px minmax(0,1fr) auto 14px;align-items:center;column-gap:16px;padding:12px 14px 12px 16px;cursor:pointer}\n.ta-opt+.ta-opt{border-top:0.5px solid var(--dsw-alias-border-l2)}\n.ta-opt-price{display:flex;flex-direction:column;align-items:flex-start;gap:4px}\n.ta-price{font-size:16px;line-height:24px;font-weight:500;font-variant-numeric:tabular-nums}\n.ta-tags{display:flex;flex-wrap:wrap;gap:4px}\n.ta-tag{display:inline-flex;align-items:center;height:18px;padding:0 6px;border-radius:999px;corner-shape:round;font-size:11px;line-height:16px;color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent);white-space:nowrap}\n.ta-tag[data-tag=leastLeave]{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 12%,transparent)}\n.ta-tag[data-tag=easiest]{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 12%,transparent)}\n.ta-opt-leave{display:flex;flex-direction:column;align-items:flex-end}\n.ta-opt-leave-n{font-size:16px;line-height:24px;font-weight:500;font-variant-numeric:tabular-nums}\n.ta-opt-chev{color:var(--dsw-alias-label-tertiary);display:inline-flex}\n.ta-hero{display:flex;flex-direction:column;gap:4px}\n.ta-hero-price{font-size:24px;line-height:32px;font-weight:500;font-variant-numeric:tabular-nums}\n.ta-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}\n.ta-stat{display:flex;flex-direction:column;gap:2px;padding:12px 16px}\n.ta-stat+.ta-stat{border-left:0.5px solid var(--dsw-alias-border-l2)}\n.ta-stat-value{font-size:16px;line-height:24px;font-weight:500;font-variant-numeric:tabular-nums}\n.ta-dir{display:flex;flex-direction:column;gap:12px;padding:14px 16px 16px}\n.ta-dir-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}\n.ta-tl{display:flex;flex-direction:column}\n.ta-tl-row{display:grid;grid-template-columns:44px 12px minmax(0,1fr);column-gap:10px;align-items:center}\n.ta-tl-time{font-size:14px;line-height:22px;font-weight:500;font-variant-numeric:tabular-nums}\n.ta-tl-dot{justify-self:center;width:7px;height:7px;border-radius:50%;corner-shape:round;border:1.5px solid var(--dsw-alias-label-secondary);box-sizing:border-box}\n.ta-tl-place{display:flex;align-items:baseline;gap:8px;font-size:14px;line-height:22px;font-weight:500}\n.ta-tl-flight,.ta-tl-layover{min-height:30px;align-items:stretch}\n.ta-tl-flight>:last-child,.ta-tl-layover>:last-child{align-self:center}\n.ta-tl-rail{justify-self:center;width:0;border-left:1.5px solid var(--dsw-alias-border-l3)}\n.ta-tl-layover .ta-tl-rail{border-left-style:dashed}\n.ta-tl-pill{justify-self:start;display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-interactive-bg-hover);font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}\n.ta-list{display:flex;flex-direction:column;overflow:hidden}\n.ta-list-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px 10px 16px}\n.ta-list-row+.ta-list-row{border-top:0.5px solid var(--dsw-alias-border-l2)}\n.ta-quote-main{display:flex;flex-direction:column;gap:2px;min-width:0}\n.ta-quote-price{font-size:14px;line-height:20px;font-weight:500;font-variant-numeric:tabular-nums}\n.ta-link{display:inline-flex;align-items:center;gap:4px;color:var(--dsw-alias-link);font-weight:500;text-decoration:none;white-space:nowrap;border-radius:4px}\n.ta-home{container:ta-home/inline-size;height:100%;min-height:0;display:flex;flex-direction:column;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;--ta-inset:clamp(20px,4vw,48px)}\n.ta-home-scroll{flex:1;min-height:0;overflow-y:auto;padding:0 var(--ta-inset)}\n.ta-home-col{box-sizing:border-box;width:100%;max-width:960px;margin:0 auto;padding:28px 0 24px;display:flex;flex-direction:column;gap:24px}\n.ta-home-head{display:flex;flex-direction:column;gap:4px}\n.ta-page-title{margin:0;font-size:20px;line-height:28px;font-weight:500}\n.ta-trip-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}\n.ta-trip-card{position:relative;display:flex;flex-direction:column;gap:14px;padding:14px 12px 14px 16px;border-radius:var(--dsw-radius-xl);border:0.5px solid var(--dsw-alias-settings-card-stroke);background:var(--dsw-alias-settings-card-fill);min-width:0}\n.ta-trip-card[data-archived]{opacity:.72}\n.ta-trip-open{all:unset;position:absolute;inset:0;border-radius:inherit;cursor:pointer}\n.ta-trip-open:disabled{cursor:default}\n.ta-trip-card-head{display:flex;align-items:center;gap:12px;min-width:0;pointer-events:none}\n.ta-trip-icon{flex:none;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:var(--dsw-radius-md);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent);color:var(--dsw-alias-state-business-primary)}\n.ta-trip-card-text{flex:1;min-width:0;display:flex;flex-direction:column}\n.ta-trip-card-title{font-size:14px;line-height:20px;font-weight:500}\n.ta-trip-actions{position:relative;z-index:1;align-self:flex-start;pointer-events:auto}\n.ta-trip-facts{display:flex;align-items:flex-end;gap:20px;flex-wrap:wrap;pointer-events:none}\n.ta-fact{display:flex;flex-direction:column}\n.ta-fact-value{font-size:14px;line-height:20px;font-weight:500;font-variant-numeric:tabular-nums}\n.ta-trip-facts .ta-status{margin-left:auto}\n@media (hover:hover){.ta-trip-card .ta-trip-actions{opacity:0;transition:opacity 120ms ease}.ta-trip-card:hover .ta-trip-actions,.ta-trip-card:focus-within .ta-trip-actions,.ta-trip-card[data-archived] .ta-trip-actions{opacity:1}}\n.ta-home-composer{flex:none;box-sizing:border-box;width:100%;max-width:calc(760px + 2 * var(--ta-inset));margin:0 auto;padding:8px var(--ta-inset) 20px;display:flex;flex-direction:column;gap:6px}\n.ta-input{display:flex;flex-direction:column;gap:4px;padding:12px 12px 10px 16px;border:0;border-radius:var(--dsw-radius-panel);background:var(--dsw-specific-input-major);box-shadow:var(--dsw-elevation-soft);--dsw-elevation-stroke-color:var(--dsw-alias-border-l2)}\n.ta-input:focus-within{--dsw-elevation-stroke-color:var(--dsw-alias-border-l4)}\n.ta-input textarea{resize:none;border:0;outline:none;background:transparent;font:inherit;font-size:14px;line-height:24px;color:inherit;max-height:160px;padding:0}\n.ta-input textarea::placeholder{color:var(--dsw-alias-label-tertiary)}\n.ta-input-bar{display:flex;align-items:center;justify-content:space-between;gap:12px}\n.ta-send{all:unset;box-sizing:border-box;flex:none;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;corner-shape:round;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-inverted);cursor:pointer}\n.ta-send:disabled{background:var(--dsw-alias-button-primary-dimmed);cursor:default}\n.ta-suggests{display:flex;flex-wrap:wrap;gap:8px;padding:0 4px}\n.ta-suggest{all:unset;box-sizing:border-box;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;height:28px;padding:0 12px;border-radius:999px;corner-shape:round;border:0.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:28px;cursor:pointer}\n.ta-suggest:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}\n@media (hover:hover){.ta-suggest:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}}\n.ta-opt-legs{display:grid;grid-template-columns:28px 136px 12px 150px minmax(0,1fr);align-items:baseline;column-gap:8px;row-gap:6px;min-width:0;font-size:13px;line-height:20px}\n.ta-journey{display:contents}\n.ta-journey-label{color:var(--dsw-alias-label-tertiary);font-size:12px}\n.ta-j-point{white-space:nowrap;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}\n.ta-j-point b{font-weight:500;color:var(--dsw-alias-label-primary)}\n.ta-j-date{color:var(--dsw-alias-label-secondary)}\n.ta-j-code{color:var(--dsw-alias-label-tertiary)}\n.ta-journey-arrow{color:var(--dsw-alias-label-tertiary)}\n.ta-journey-meta{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:12px}\n.ta-j-home{display:inline-flex;align-items:baseline;gap:4px;white-space:nowrap;font-variant-numeric:tabular-nums}\n.ta-j-home b,.ta-j-home .ta-j-date{color:var(--dsw-alias-state-success-primary);font-weight:500}\n.ta-j-home-label{display:inline-flex;align-items:center;height:18px;padding:0 6px;border-radius:999px;corner-shape:round;font-size:11px;line-height:16px;font-weight:500;color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 12%,transparent);align-self:center}\n.ta-tag[data-tag=alt]{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover)}\n.ta-hero-trip{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px;font-size:14px;line-height:22px;font-variant-numeric:tabular-nums}\n.ta-hero-trip b{font-weight:500}\n.ta-tl-home .ta-tl-time,.ta-tl-home .ta-tl-place{color:var(--dsw-alias-state-success-primary)}\n.ta-tl-home .ta-tl-dot{border-color:var(--dsw-alias-state-success-primary);background:var(--dsw-alias-state-success-primary)}\n.ta-tl-home-date{font-size:12px;line-height:18px;font-weight:400}\n@container ta-board (max-width:560px){\n.ta-opt{grid-template-columns:minmax(0,1fr) auto 14px;row-gap:8px}\n.ta-opt-price{grid-column:1;flex-direction:row;align-items:center;flex-wrap:wrap}\n.ta-opt-legs{grid-column:1/-1;grid-row:2;grid-template-columns:28px auto 12px auto}\n.ta-opt-leave{grid-column:2;grid-row:1}\n.ta-opt-chev{grid-column:3;grid-row:1}\n.ta-journey-meta{display:none}\n}"

    const zh = {
      panel: '旅行助手',
      'home.subtitle': '每张卡片是一次行程，点开看方案、和助手接着聊',
      'home.factLowest': '最低价',
      'home.factLeave': '最少请假',
      'home.factOptions': '方案',
      'home.hint': '发送后会新建一张行程卡片 · Tab 填入示例',
      'row.leaveUnit': '天假',
      'detail.lowestAt': '{platform} 最低',
      'home.empty': '还没有行程。在下面告诉助手你想什么时候去哪儿，比如「2027 春节北京往返布宜诺斯艾利斯，两周左右」，会新建一个文件夹。',
      'home.placeholder': '帮我找一下春节去阿根廷的往返机票',
      'home.suggest1': '帮我找一下春节去阿根廷的往返机票',
      'home.suggest2': '五一从上海去东京，玩 5 天，要早上到的航班',
      'home.suggest3': '国庆去冰岛看极光，转机能出去玩一天更好',
      'home.inputLabel': '新行程',
      'home.send': '新建',
      'home.starting': '新建中…',
      'home.failed': '操作失败：{reason}',
      'home.untitled': '未命名行程',
      'home.noTrip': '助手正在整理行程…',
      'home.noDir': '没有拿到旅行目录，请在插件管理里重新启用旅行助手',
      'home.created': '已新建行程卡片，助手在后台查询',
      'home.lowest': '最低 {price}',
      'home.leastLeave': '最少请假 {n} 天',
      'home.running': '查询中',
      'home.back': '全部行程',
      'session.empty': '这次行程的文件夹还没建好。在下面告诉助手你想什么时候去哪儿。',
      working: '助手正在查询…',
      'trace.show': '在侧边栏看运行过程',
      archive: '归档',
      'archive.folder': '归档这个行程文件夹',
      'archive.option': '归档这个方案',
      'archive.section': '已归档（{count}）',
      'archive.restore': '恢复',
      'archive.hint': '归档只在这台电脑上隐藏，不会删除数据，也不会通知助手。',
      'view.label': '机票方案',
      'other.hint': '这个会话不是旅行助手的会话。机票方案在左侧「旅行助手」里。',
      'other.open': '打开旅行助手',
      'folder.meta': '{count} 个方案',
      'holidays.none': '未设置假期，请假天数只按周末计算',
      'holidays.off': '放假 {ranges}',
      'holidays.work': '调休上班 {days}',
      'holidays.guess': '（推测）',
      'section.best': '推荐方案',
      'section.bestHint': '先列价格、请假、转机三项都不被超过的，再依次补上次一档的',
      'tag.alt': '备选',
      'home.arrive': '到家',
      'detail.depart': '出发',
      'section.others': '其他方案（{count}）',
      'section.noOptions': '这个文件夹里还没有方案。',
      'tag.cheapest': '最便宜',
      'tag.leastLeave': '最省假',
      'tag.easiest': '最好飞',
      'price.none': '待报价',
      back: '返回',
      'stat.leave': '请假',
      'stat.away': '出行天数',
      'stat.ground': '目的地停留',
      days: '{n} 天',
      daysHours: '{d} 天 {h} 小时',
      'dir.meta': '转 {n} 次 · {duration}',
      'dir.direct': '直飞 · {duration}',
      'leave.dates': '需请假 {dates}',
      'leave.none': '不需要请假',
      'leave.rule': '出发当天 {time} 后起飞不计请假',
      outbound: '去程',
      inbound: '回程',
      layover: '{airport} 转机 {duration}',
      quotes: '报价',
      'baggage.checked': '含托运',
      'baggage.carry_on': '仅随身',
      'baggage.unknown': '行李未注明',
      open: '打开',
      'quote.at': '查询于 {time}',
      'platform.blocked': '受阻',
      'platform.todo': '未查',
      w0: '周日', w1: '周一', w2: '周二', w3: '周三', w4: '周四', w5: '周五', w6: '周六',
    }
    const en = {
      panel: 'Travel agent',
      'home.subtitle': 'Each card is one trip; open it to see the options and keep talking with the assistant',
      'home.factLowest': 'Lowest',
      'home.factLeave': 'Least leave',
      'home.factOptions': 'Options',
      'home.hint': 'Sending starts a new trip card · Tab fills the example',
      'row.leaveUnit': 'leave days',
      'detail.lowestAt': 'Lowest on {platform}',
      'home.empty': 'No trips yet. Tell the assistant below where and when you want to go, e.g. “Beijing–Buenos Aires round trip for Spring Festival 2027, about two weeks”; it starts a new folder.',
      'home.placeholder': 'Find round-trip flights to Argentina for Spring Festival',
      'home.suggest1': 'Find round-trip flights to Argentina for Spring Festival',
      'home.suggest2': 'Shanghai to Tokyo for May Day, 5 days, landing in the morning',
      'home.suggest3': 'Iceland for the October holiday; a long layover I can explore is a plus',
      'home.inputLabel': 'New trip',
      'home.send': 'Start',
      'home.starting': 'Starting…',
      'home.failed': 'Could not complete: {reason}',
      'home.untitled': 'Untitled trip',
      'home.noTrip': 'The assistant is setting up the trip…',
      'home.noDir': 'The trips directory is unavailable; re-enable Travel agent in Plugins',
      'home.created': 'Trip card created; the assistant is searching in the background',
      'home.lowest': 'from {price}',
      'home.leastLeave': 'least leave {n} d',
      'home.running': 'Searching',
      'home.back': 'All trips',
      'session.empty': 'This trip folder is not set up yet. Tell the assistant below where and when you want to go.',
      working: 'The assistant is searching…',
      'trace.show': 'Show activity in sidebar',
      archive: 'Archive',
      'archive.folder': 'Archive this trip folder',
      'archive.option': 'Archive this option',
      'archive.section': 'Archived ({count})',
      'archive.restore': 'Restore',
      'archive.hint': 'Archiving only hides items on this computer; nothing is deleted and the assistant is not told.',
      'view.label': 'Flights',
      'other.hint': 'This is not the travel agent Session. Flight options live in Travel agent in the left sidebar.',
      'other.open': 'Open travel agent',
      'folder.meta': '{count} options',
      'holidays.none': 'No holidays set; leave days count weekends only',
      'holidays.off': 'Off {ranges}',
      'holidays.work': 'Working weekends {days}',
      'holidays.guess': ' (estimated)',
      'section.best': 'Recommended',
      'section.bestHint': 'Options not beaten on price, leave and transfers at once, then the next tier',
      'tag.alt': 'Runner-up',
      'home.arrive': 'Home',
      'detail.depart': 'Leave',
      'section.others': 'Other options ({count})',
      'section.noOptions': 'No options in this folder yet.',
      'tag.cheapest': 'Cheapest',
      'tag.leastLeave': 'Least leave',
      'tag.easiest': 'Easiest',
      'price.none': 'No price yet',
      back: 'Back',
      'stat.leave': 'Leave',
      'stat.away': 'Trip length',
      'stat.ground': 'On the ground',
      days: '{n} d',
      daysHours: '{d} d {h} h',
      'dir.meta': '{n} transfers · {duration}',
      'dir.direct': 'Nonstop · {duration}',
      'leave.dates': 'Leave needed: {dates}',
      'leave.none': 'No leave needed',
      'leave.rule': 'A departure after {time} does not count that day',
      outbound: 'Outbound',
      inbound: 'Return',
      layover: 'Transfer at {airport}, {duration}',
      quotes: 'Prices',
      'baggage.checked': 'Checked bag',
      'baggage.carry_on': 'Carry-on only',
      'baggage.unknown': 'Baggage not stated',
      open: 'Open',
      'quote.at': 'Checked {time}',
      'platform.blocked': 'blocked',
      'platform.todo': 'not searched',
      w0: 'Sun', w1: 'Mon', w2: 'Tue', w3: 'Wed', w4: 'Thu', w5: 'Fri', w6: 'Sat',
    }

    const md = date => { const [, m, d] = date.split('-').map(Number); return `${m}/${d}` }
    const wd = date => { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay() }
    const dayLabel = (t, date) => `${md(date)} ${t('w' + wd(date))}`
    const duration = minutes => { const hh = Math.floor(minutes / 60); const mm = minutes % 60; return hh === 0 ? `${mm}m` : `${hh}h${String(mm).padStart(2, '0')}m` }
    const money = price => '¥' + price.toLocaleString('en-US')
    const range = r => (r.start === r.end ? md(r.start) : `${md(r.start)}–${md(r.end)}`)
    const nextDay = date => { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10) }
    const dateRanges = dates => {
      const out = []
      for (const date of dates) {
        const last = out[out.length - 1]
        if (last !== undefined && nextDay(last.end) === date) last.end = date
        else out.push({ start: date, end: date })
      }
      return out
    }
    const stamp = at => { const d = new Date(at); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

    const svg = (size, children, extra) => h('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true, ...extra }, ...children)
    const stroke = { stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }

    function PlaneIcon({ size }) {
      return svg(size ?? 16, [
        h('path', { key: 'p', d: 'M13.6 2.4c.5-.5 1.3-.5 1.5 0 .2.45-.05 1.05-.5 1.5L12.8 5.7l1.2 5.1-1 1-2.2-3.9-2 2 .25 1.7-.8.8-1-2-2-1 .8-.8 1.7.25 2-2-3.9-2.2 1-1 5.1 1.2z', fill: 'currentColor' }),
        h('path', { key: 'g', d: 'M1.5 13.5h4', ...stroke, strokeWidth: 1.3 }),
      ])
    }

    function Chevron({ dir = 'right', size = 14 }) {
      const d = { right: 'M6 3.5 10.5 8 6 12.5', left: 'M10 3.5 5.5 8 10 12.5', down: 'M3.5 6 8 10.5 12.5 6' }[dir]
      return svg(size, [h('path', { key: 'c', d, ...stroke })], { className: 'ta-icon' })
    }

    function ExternalIcon() {
      return svg(12, [h('path', { key: 'e', d: 'M6 3.5H3.5v9h9V10M9 3h4v4M13 3 7.5 8.5', ...stroke })], { className: 'ta-icon' })
    }

    function ArrowUp() {
      return svg(16, [h('path', { key: 'a', d: 'M8 13V3.5M3.75 7.75 8 3.5l4.25 4.25', ...stroke, strokeWidth: 1.75 })])
    }

    function Tags({ card, t }) {
      return card.tags.length === 0 ? null : h('span', { className: 'ta-tags' },
        card.tags.map(tag => h('span', { key: tag, className: 'ta-tag', 'data-tag': tag }, t('tag.' + tag))))
    }

    function RowTags({ card, t }) {
      if (card.tags.length > 0) return h(Tags, { card, t })
      return card.rank > 1 ? h('span', { className: 'ta-tags' }, h('span', { className: 'ta-tag', 'data-tag': 'alt' }, t('tag.alt'))) : null
    }

    /**
     * One direction on an option row, laid out on the row's shared grid: departure and arrival each with date, local time
     * and airport, then transfers and duration. The return's arrival is the time the user is home and is emphasized.
     */
    function JourneyLine({ label, dir, home, t }) {
      const point = (date, time, code) => h('span', { className: 'ta-j-point' },
        h('span', { className: 'ta-j-date' }, dayLabel(t, date)), ' ', h('b', null, time), ' ', h('span', { className: 'ta-j-code' }, code))
      return h('span', { className: 'ta-journey' },
        h('span', { className: 'ta-journey-label' }, label),
        point(dir.departDate, dir.departTime, dir.from),
        h('span', { className: 'ta-journey-arrow', 'aria-hidden': true }, '→'),
        home
          ? h('span', { className: 'ta-j-point ta-j-home' }, h('span', { className: 'ta-j-home-label' }, t('home.arrive')), ' ', h('span', { className: 'ta-j-date' }, dayLabel(t, dir.arriveDate)), ' ', h('b', null, dir.arriveTime))
          : point(dir.arriveDate, dir.arriveTime, dir.to),
        h('span', { className: 'ta-journey-meta' },
          dir.transfers === 0 ? t('dir.direct', { duration: duration(dir.minutes) }) : t('dir.meta', { n: dir.transfers, duration: duration(dir.minutes) })))
    }

    function Row({ card, t, onOpen }) {
      return h('button', { type: 'button', className: 'ta-opt', 'data-ta-id': card.id, onClick: () => onOpen(card.id) },
        h('span', { className: 'ta-opt-price' },
          h('span', { className: 'ta-price' }, card.price === null ? t('price.none') : money(card.price)),
          h(RowTags, { card, t })),
        h('span', { className: 'ta-opt-legs' },
          h(JourneyLine, { label: t('outbound'), dir: card.outbound, t }),
          card.inbound === null ? null : h(JourneyLine, { label: t('inbound'), dir: card.inbound, home: true, t })),
        card.leaveDays === null ? h('span') : h('span', { className: 'ta-opt-leave' },
          h('span', { className: 'ta-opt-leave-n' }, card.leaveDays), h('span', { className: 'ta-faint' }, t('row.leaveUnit'))),
        h('span', { className: 'ta-opt-chev' }, h(Chevron)))
    }

    /** A direction as a vertical timeline: stops, flights between them, and transfers on a dashed rail. */
    function Direction({ label, dir, home, t }) {
      const items = []
      dir.legs.forEach((leg, i) => {
        if (leg.kind === 'layover') {
          items.push(h('div', { key: `l${i}`, className: 'ta-tl-row ta-tl-layover' }, h('span'), h('span', { className: 'ta-tl-rail' }),
            h('span', { className: 'ta-tl-pill' }, t('layover', { airport: leg.airport, duration: duration(leg.minutes) }))))
          return
        }
        const last = i === dir.legs.length - 1
        const stop = (key, time, code, date, isHome) => h('div', { key, className: isHome ? 'ta-tl-row ta-tl-stop ta-tl-home' : 'ta-tl-row ta-tl-stop' },
          h('span', { className: 'ta-tl-time' }, time), h('span', { className: 'ta-tl-dot' }),
          h('span', { className: 'ta-tl-place' }, code, date === dir.departDate && !isHome ? null : h('span', { className: isHome ? 'ta-tl-home-date' : 'ta-faint' }, dayLabel(t, date)),
            isHome ? h('span', { className: 'ta-j-home-label' }, t('home.arrive')) : null))
        items.push(stop(`d${i}`, leg.departTime, leg.from, leg.departDate))
        items.push(h('div', { key: `f${i}`, className: 'ta-tl-row ta-tl-flight' }, h('span'), h('span', { className: 'ta-tl-rail' }),
          h('span', { className: 'ta-faint' }, [leg.flight, leg.airline, duration(leg.minutes)].filter(Boolean).join(' · '))))
        items.push(stop(`a${i}`, leg.arriveTime, leg.to, leg.arriveDate, home === true && last))
      })
      return h('section', { className: 'ta-card ta-dir' },
        h('header', { className: 'ta-dir-head' },
          h('span', { className: 'ta-section-title' }, `${label} · ${dayLabel(t, dir.departDate)}`),
          h('span', { className: 'ta-muted' }, dir.transfers === 0 ? t('dir.direct', { duration: duration(dir.minutes) }) : t('dir.meta', { n: dir.transfers, duration: duration(dir.minutes) }))),
        h('div', { className: 'ta-tl' }, items))
    }

    function ArchiveButton({ label, onArchive, t }) {
      return h('button', { type: 'button', className: 'ta-text-btn', 'aria-label': label, title: label, onClick: event => { event.stopPropagation(); onArchive() } }, t('archive'))
    }

    /** Mirrors RECOMMEND_TARGET in model.js. */
    const RECOMMEND_TARGET = 5

    /**
     * Re-rank the options that are still shown, so archiving an option never leaves one it dominated stranded under
     * 其他方案. Mirrors rankOptions in model.js: whole non-dominated layers until RECOMMEND_TARGET are recommended.
     */
    function visibleTrip(trip, hidden) {
      const cards = [...trip.recommended, ...trip.others].filter(c => !hidden.has(c.id)).map(c => ({ ...c, tags: [], pareto: false, rank: null }))
      const dominates = (a, b) => a.price <= b.price && a.leaveDays <= b.leaveDays && a.transfers <= b.transfers
        && (a.price < b.price || a.leaveDays < b.leaveDays || a.transfers < b.transfers)
      const byPrice = (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || a.id.localeCompare(b.id)
      const recommended = []
      let rest = cards.filter(c => c.price !== null && c.leaveDays !== null)
      for (let rank = 1; rest.length > 0 && (rank === 1 || recommended.length < RECOMMEND_TARGET); rank++) {
        const layer = rest.filter(c => !rest.some(o => o !== c && dominates(o, c)))
        for (const c of layer) { c.rank = rank; c.pareto = rank === 1 }
        recommended.push(...layer.sort(byPrice))
        rest = rest.filter(c => c.rank === null)
      }
      const front = recommended.filter(c => c.pareto)
      const pick = cmp => front.reduce((best, c) => (best === undefined || cmp(c, best) < 0 ? c : best), undefined)
      pick((a, b) => a.price - b.price || a.leaveDays - b.leaveDays)?.tags.push('cheapest')
      pick((a, b) => a.leaveDays - b.leaveDays || a.price - b.price)?.tags.push('leastLeave')
      pick((a, b) => a.transfers - b.transfers || a.flightMinutes - b.flightMinutes || a.price - b.price)?.tags.push('easiest')
      return { ...trip, optionCount: cards.length, recommended, others: cards.filter(c => c.rank === null).sort(byPrice) }
    }

    function Disclosure({ open, onToggle, children }) {
      return h('button', { type: 'button', className: 'ta-disclosure', 'aria-expanded': open, onClick: onToggle },
        h('span', { className: 'ta-disclosure-icon', 'data-open': open }, h(Chevron, { dir: 'right', size: 12 })), children)
    }

    function ArchivedSection({ trips, hidden, t, onRestore }) {
      const [open, setOpen] = useState(false)
      const folders = trips.filter(trip => hidden.has(trip.id))
      const options = trips.filter(trip => !hidden.has(trip.id)).flatMap(trip => [...trip.recommended, ...trip.others].filter(c => hidden.has(c.id)).map(c => ({ trip, c })))
      const count = folders.length + options.length
      if (count === 0) return null
      return h('section', { className: 'ta-section' },
        h(Disclosure, { open, onToggle: () => setOpen(v => !v) }, t('archive.section', { count })),
        !open ? null : h('div', { className: 'ta-card ta-list' },
          folders.map(trip => h('div', { key: trip.id, className: 'ta-list-row' },
            h('span', { className: 'ta-ellipsis' }, trip.title),
            h('button', { type: 'button', className: 'ta-text-btn', onClick: () => onRestore(trip.id) }, t('archive.restore')))),
          options.map(({ trip, c }) => h('div', { key: c.id, className: 'ta-list-row' },
            h('span', { className: 'ta-ellipsis' }, `${c.price === null ? t('price.none') : money(c.price)} · ${dayLabel(t, c.outbound.departDate)}`),
            h('button', { type: 'button', className: 'ta-text-btn', onClick: () => onRestore(c.id) }, t('archive.restore'))))),
        !open ? null : h('p', { className: 'ta-faint ta-p' }, t('archive.hint')))
    }

    function Detail({ card, afterWork, t, onBack, onArchive }) {
      const stats = card.leaveDays === null ? [] : [
        [t('stat.leave'), t('days', { n: card.leaveDays })],
        [t('stat.away'), t('days', { n: card.awayDays })],
        [t('stat.ground'), t('daysHours', { d: Math.floor(card.groundHours / 24), h: card.groundHours % 24 })],
      ]
      return h('div', { className: 'ta-board' },
        h('div', { className: 'ta-toolbar' },
          h('button', { type: 'button', className: 'ta-back', onClick: onBack }, h(Chevron, { dir: 'left' }), t('back')),
          h('span', { className: 'ta-toolbar-gap' }),
          h(ArchiveButton, { label: t('archive.option'), t, onArchive: () => onArchive(card.id) })),
        h('header', { className: 'ta-hero' },
          h('div', { className: 'ta-line' },
            h('span', { className: 'ta-hero-price' }, card.price === null ? t('price.none') : money(card.price)),
            h(Tags, { card, t })),
          h('div', { className: 'ta-hero-trip' },
            h('span', null, h('span', { className: 'ta-muted' }, t('detail.depart') + ' '), h('b', null, `${dayLabel(t, card.outbound.departDate)} ${card.outbound.departTime}`)),
            card.inbound === null ? null : h(React.Fragment, null,
              h('span', { className: 'ta-journey-arrow', 'aria-hidden': true }, '→'),
              h('span', { className: 'ta-j-home' }, h('span', { className: 'ta-j-home-label' }, t('home.arrive')), ' ', h('b', null, `${dayLabel(t, card.inbound.arriveDate)} ${card.inbound.arriveTime}`)))),
          card.platform === null ? null : h('span', { className: 'ta-faint' }, t('detail.lowestAt', { platform: card.platform }))),
        stats.length === 0 ? null : h('div', { className: 'ta-card ta-stats' }, stats.map(([label, value]) =>
          h('div', { key: label, className: 'ta-stat' }, h('span', { className: 'ta-stat-value' }, value), h('span', { className: 'ta-faint' }, label)))),
        card.leaveDays === null ? null : h('p', { className: 'ta-muted ta-p' },
          card.leaveDates.length === 0 ? t('leave.none') : t('leave.dates', { dates: dateRanges(card.leaveDates).map(range).join('、') }),
          h('span', { className: 'ta-faint' }, ' · ' + t('leave.rule', { time: afterWork }))),
        h(Direction, { label: t('outbound'), dir: card.outbound, t }),
        card.inbound === null ? null : h(Direction, { label: t('inbound'), dir: card.inbound, home: true, t }),
        card.note ? h('p', { className: 'ta-muted ta-p' }, card.note) : null,
        card.quotes.length === 0 ? null : h('section', { className: 'ta-section' },
          h('h3', { className: 'ta-section-title' }, t('quotes')),
          h('div', { className: 'ta-card ta-list' }, card.quotes.map(q => h('div', { key: q.platform, className: 'ta-list-row ta-quote' },
            h('span', { className: 'ta-quote-main' },
              h('span', { className: 'ta-line' }, h('span', { className: 'ta-quote-price' }, money(q.price)), h('span', null, q.platform)),
              h('span', { className: 'ta-faint' }, [t('baggage.' + q.baggage), q.note, t('quote.at', { time: stamp(q.at) })].filter(Boolean).join(' · '))),
            q.url ? h('a', { className: 'ta-link', href: q.url, target: '_blank', rel: 'noopener noreferrer' }, t('open'), h(ExternalIcon)) : null)))))
    }

    function Folder({ trip, open, single, onToggle, onOpen, t }) {
      const [othersOpen, setOthersOpen] = useState(false)
      const parts = []
      if (trip.holidays === null) parts.push(t('holidays.none'))
      else {
        if (trip.holidays.off.length > 0) parts.push(t('holidays.off', { ranges: trip.holidays.off.map(range).join('、') }))
        if (trip.holidays.work.length > 0) parts.push(t('holidays.work', { days: trip.holidays.work.map(range).join('、') }))
      }
      const holidayText = parts.join(' · ') + (trip.holidays !== null && !trip.holidays.official ? t('holidays.guess') : '')
      const body = h('div', { className: 'ta-folder-body' },
        h('div', { className: 'ta-chips' }, trip.platforms.map(p => h('span', { key: p.name, className: 'ta-chip', 'data-state': p.state },
          p.state === 'done' ? null : h('span', { className: 'ta-chip-dot' }), p.name, p.state === 'done' ? null : h('span', { className: 'ta-faint' }, t('platform.' + p.state))))),
        trip.optionCount === 0 ? h('p', { className: 'ta-empty' }, t('section.noOptions')) : null,
        trip.recommended.length === 0 ? null : h('section', { className: 'ta-section' },
          h('div', { className: 'ta-section-head' },
            h('h3', { className: 'ta-section-title' }, t('section.best')),
            h('span', { className: 'ta-faint' }, t('section.bestHint'))),
          h('div', { className: 'ta-opts' }, trip.recommended.map(c => h(Row, { key: c.id, card: c, t, onOpen })))),
        trip.others.length === 0 ? null : h('section', { className: 'ta-section' },
          h(Disclosure, { open: othersOpen, onToggle: () => setOthersOpen(v => !v) }, t('section.others', { count: trip.others.length })),
          othersOpen ? h('div', { className: 'ta-opts' }, trip.others.map(c => h(Row, { key: c.id, card: c, t, onOpen }))) : null))
      if (single) {
        return h('section', { className: 'ta-folder' },
          h('header', { className: 'ta-trip-head' },
            h('h2', { className: 'ta-trip-title' }, trip.title),
            h('p', { className: 'ta-muted ta-p' }, `${trip.origins.join('/')} ⇄ ${trip.destinations.join('/')} · ${holidayText}`)),
          body)
      }
      return h('section', { className: 'ta-folder' },
        h(Disclosure, { open, onToggle },
          h('span', { className: 'ta-ellipsis ta-folder-name' }, trip.title),
          h('span', { className: 'ta-faint' }, t('folder.meta', { count: trip.optionCount }))),
        open ? h('p', { className: 'ta-muted ta-p' }, `${trip.origins.join('/')} ⇄ ${trip.destinations.join('/')} · ${holidayText}`) : null,
        open ? body : null)
    }

    /** The 机票方案 Conversation view: this Session's trip folder, a way back to the travel home, and the activity side panel. */
    function TravelView({ sessionId, useProjection, useSession, useSessions, useArchived, useTripsDir, t, openActivity, openHome, setArchived }) {
      const board = useProjection('flightBoard')
      const running = useSession(snapshot => snapshot.running === true)
      const archivedIds = useArchived(map => map[sessionId] ?? NONE)
      const cwd = useSessions(state => state.byId[sessionId]?.cwd)
      const tripsDir = useTripsDir(value => value)
      const [selected, setSelected] = useState(null)
      const [open, setOpen] = useState(() => new Set())
      const listRef = useRef(null)
      const returnTo = useRef(null)
      useEffect(() => {
        // Returning from a detail view puts focus back on the row that opened it; the list stays mounted, so its scroll position is kept.
        if (selected !== null || returnTo.current === null) return
        listRef.current?.querySelector(`[data-ta-id="${returnTo.current}"]`)?.focus()
        returnTo.current = null
      }, [selected])
      const style = h('style', null, CSS)
      // Other Sessions show their own folders when they have any (older test Sessions); otherwise point to the travel agent.
      if (cwd !== undefined && tripsDir !== undefined && !samePath(cwd, tripsDir) && (board?.trips.length ?? 0) === 0) {
        return h('div', { className: 'ta-board' }, style,
          h('div', { className: 'ta-empty-state' }, h('span', { className: 'ta-empty-icon' }, h(PlaneIcon, { size: 20 })),
            h('p', { className: 'ta-muted ta-p' }, t('other.hint')),
            h('button', { type: 'button', className: 'ta-btn', onClick: openHome }, t('other.open'))))
      }
      // A view published before the recommended list existed carries `pareto` instead; both hold the ranked options.
      const allTrips = (board?.trips ?? []).map(trip => (trip.recommended !== undefined ? trip : { ...trip, recommended: trip.pareto ?? [], others: trip.others ?? [] }))
      const hidden = new Set(archivedIds)
      const trips = allTrips.map(trip => visibleTrip(trip, hidden))
      const single = trips.length === 1
      const current = board?.current ?? null
      const isOpen = id => single || open.has(id) !== (id === current)
      const toggle = id => setOpen(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
      const card = selected === null ? undefined : trips.flatMap(trip => [...trip.recommended, ...trip.others]).find(c => c.id === selected)
      const back = () => { returnTo.current = selected; setSelected(null) }
      const archive = id => { setArchived(sessionId, id, true); if (id === selected) setSelected(null) }
      const restore = id => setArchived(sessionId, id, false)
      return h(React.Fragment, null, style,
        card === undefined ? null : h(Detail, { key: card.id, card, afterWork: board.afterWork, t, onBack: back, onArchive: archive }),
        h('div', { className: 'ta-board', ref: listRef, hidden: card !== undefined },
          h('div', { className: 'ta-toolbar' },
            h('button', { type: 'button', className: 'ta-back', onClick: openHome }, h(Chevron, { dir: 'left' }), t('home.back')),
            h('span', { className: 'ta-toolbar-gap' }),
            running ? h('span', { className: 'ta-status', role: 'status' }, t('working')) : null,
            h('button', { type: 'button', className: 'ta-btn', onClick: () => openActivity(sessionId) }, t('trace.show'))),
          trips.length === 0 ? h('div', { className: 'ta-empty-state' }, h('span', { className: 'ta-empty-icon' }, h(PlaneIcon, { size: 20 })),
            h('p', { className: 'ta-muted ta-p' }, running ? t('working') : t('session.empty'))) : null,
          [...trips].reverse().map(trip => h(Folder, { key: trip.id, trip, t, open: isOpen(trip.id), single, onToggle: () => toggle(trip.id), onOpen: setSelected })),
          h(ArchivedSection, { trips: allTrips, hidden, t, onRestore: restore })))
    }

    /** One folder card on the travel home page: one Session is one trip. */
    function FolderCard({ entry, t, onOpen, onArchive, onRestore, archived }) {
      const trip = entry.projectionValues?.flightTrip ?? null
      const title = trip?.title ?? entry.title ?? entry.firstMessage ?? t('home.untitled')
      const facts = trip === null ? [] : [
        [t('home.factLowest'), trip.lowest === null ? '—' : money(trip.lowest)],
        [t('home.factLeave'), trip.leastLeave === null ? '—' : t('days', { n: trip.leastLeave })],
        [t('home.factOptions'), String(trip.optionCount)],
      ]
      return h('article', { className: 'ta-trip-card', 'data-archived': archived || undefined },
        h('button', { type: 'button', className: 'ta-trip-open', disabled: archived, 'aria-label': title, onClick: () => onOpen(entry.id) }),
        h('div', { className: 'ta-trip-card-head' },
          h('span', { className: 'ta-trip-icon' }, h(PlaneIcon, { size: 16 })),
          h('span', { className: 'ta-trip-card-text' },
            h('span', { className: 'ta-trip-card-title ta-ellipsis', title }, title),
            h('span', { className: 'ta-faint ta-ellipsis' }, trip === null ? t('home.noTrip') : trip.route)),
          h('span', { className: 'ta-trip-actions' },
            archived
              ? h('button', { type: 'button', className: 'ta-text-btn', onClick: () => onRestore(entry.id) }, t('archive.restore'))
              : h(ArchiveButton, { label: t('archive.folder'), t, onArchive: () => onArchive(entry.id) }))),
        facts.length === 0 && !entry.running ? null : h('div', { className: 'ta-trip-facts' },
          facts.map(([label, value]) => h('span', { key: label, className: 'ta-fact' }, h('span', { className: 'ta-faint' }, label), h('span', { className: 'ta-fact-value' }, value))),
          entry.running ? h('span', { className: 'ta-status', role: 'status' }, t('home.running')) : null))
    }

    /**
     * The travel home page: every Session in the trips directory (Config `tripsDir`) is one trip folder; sending a message starts a new Session, which
     * becomes a new folder. Archiving a folder archives its Session through the Workspace, so it leaves the Session list too.
     */
    function TravelHome({ useSessions, useWorkspaces, useTripsDir, t, startTrip, openTrip, archiveTrip, restoreTrip }) {
      const sessions = useSessions(state => state.byId)
      const workspaces = useWorkspaces(state => state)
      const [draft, setDraft] = useState('')
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState(null)
      const [showArchived, setShowArchived] = useState(false)
      const inputRef = useRef(null)
      const [started, setStarted] = useState(() => ({}))
      const [justCreated, setJustCreated] = useState(false)
      useEffect(() => {
        if (!justCreated) return undefined
        const timer = setTimeout(() => setJustCreated(false), 4000)
        return () => clearTimeout(timer)
      }, [justCreated])
      const tripsDir = useTripsDir(value => value)
      const workspace = workspaces.items.find(item => samePath(item.path, tripsDir))
      const archivedSet = new Set(workspaces.archivedSessionIds)
      const entries = (workspace?.sessionIds ?? [])
        .map(id => sessions[id] === undefined ? undefined : { ...sessions[id], id })
        .filter(entry => entry !== undefined && (!entry.blank || started[entry.id] !== undefined))
        .map(entry => (started[entry.id] === undefined ? entry : { ...entry, firstMessage: started[entry.id] }))
        .sort((a, b) => b.updatedAt - a.updatedAt)
      const live = entries.filter(entry => !archivedSet.has(entry.id))
      const archived = entries.filter(entry => archivedSet.has(entry.id))
      const run = async (action) => {
        setError(null)
        try {
          await action()
          return true
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure))
          return false
        }
      }
      const submit = async () => {
        const text = draft.trim()
        if (text === '' || busy) return
        setBusy(true)
        const ok = await run(async () => {
          const sessionId = await startTrip(text)
          setStarted(prev => ({ ...prev, [sessionId]: text }))
          setJustCreated(true)
        })
        setBusy(false)
        if (ok) setDraft('')
      }
      return h('div', { className: 'ta-home' }, h('style', null, CSS),
        h('div', { className: 'ta-home-scroll' },
          h('div', { className: 'ta-home-col' },
            h('header', { className: 'ta-home-head' },
              h('h1', { className: 'ta-page-title' }, t('panel')),
              h('p', { className: 'ta-muted ta-p' }, t('home.subtitle'))),
            live.length === 0
              ? h('div', { className: 'ta-empty-state' }, h('span', { className: 'ta-empty-icon' }, h(PlaneIcon, { size: 20 })), h('p', { className: 'ta-muted ta-p' }, t('home.empty')))
              : h('div', { className: 'ta-trip-grid' }, live.map(entry => h(FolderCard, { key: entry.id, entry, t, onOpen: openTrip, onArchive: id => run(() => archiveTrip(id)) }))),
            archived.length === 0 ? null : h('section', { className: 'ta-section' },
              h(Disclosure, { open: showArchived, onToggle: () => setShowArchived(v => !v) }, t('archive.section', { count: archived.length })),
              showArchived ? h('div', { className: 'ta-trip-grid' }, archived.map(entry => h(FolderCard, { key: entry.id, entry, t, archived: true, onRestore: id => run(() => restoreTrip(id)) }))) : null))),
        h('div', { className: 'ta-home-composer' },
          error === null ? null : h('div', { className: 'ta-error', role: 'alert' }, t('home.failed', { reason: error })),
          draft !== '' || busy ? null : h('div', { className: 'ta-suggests', role: 'list' },
            ['home.suggest1', 'home.suggest2', 'home.suggest3'].map(key => h('button', {
              key, type: 'button', role: 'listitem', className: 'ta-suggest',
              onClick: () => { setDraft(t(key)); inputRef.current?.focus() },
            }, t(key)))),
          h('div', { className: 'ta-input' },
            h('textarea', {
              ref: inputRef, rows: 2, value: draft, disabled: busy, placeholder: t('home.placeholder'), 'aria-label': t('home.inputLabel'),
              onChange: event => setDraft(event.target.value),
              onKeyDown: event => {
                if (event.key === 'Tab' && !event.shiftKey && draft === '') { event.preventDefault(); setDraft(t('home.placeholder')); return }
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit() }
              },
            }),
            h('div', { className: 'ta-input-bar' },
              h('span', { className: 'ta-faint', role: 'status' }, busy ? t('home.starting') : justCreated ? t('home.created') : t('home.hint')),
              h('button', { type: 'button', className: 'ta-send', 'aria-label': t('home.send'), title: t('home.send'), disabled: busy || draft.trim() === '', onClick: () => void submit() }, h(ArrowUp))))))
    }

    /** Conversation preference key of the host's per-Session view store; seeded once so a new travel Session opens on 机票方案. */
    const seedView = sessionId => {
      try {
        const key = `dsh.conversation.${sessionId}`
        if (globalThis.localStorage?.getItem(key) === null) globalThis.localStorage.setItem(key, JSON.stringify({ draft: '', view: VIEW_ID, viewRequest: null }))
      } catch (error) {
        // Storage unavailable: the Session opens on the host's default view instead.
        console.warn('travel-agent: cannot seed view preference', error)
      }
    }

    const NONE = Object.freeze([])
    const ARCHIVE_KEY = 'dsh-travel-agent.archived'

    /**
     * Per-Session archived folder and option ids, kept in this browser's localStorage. Archiving only hides items in
     * this view; the Session log, the projection and the assistant are unaffected.
     */
    function archiveStore() {
      let snapshot
      try {
        snapshot = JSON.parse(globalThis.localStorage?.getItem(ARCHIVE_KEY) ?? '{}') ?? {}
      } catch (error) {
        // Unreadable saved state starts empty; the next change overwrites it.
        console.warn('travel-agent: archived ids unreadable', error)
        snapshot = {}
      }
      const listeners = new Set()
      return {
        source: { getSnapshot: () => snapshot, subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } } },
        set: (sessionId, id, on) => {
          const current = snapshot[sessionId] ?? NONE
          if (current.includes(id) === on) return
          snapshot = { ...snapshot, [sessionId]: on ? [...current, id] : current.filter(x => x !== id) }
          try {
            globalThis.localStorage?.setItem(ARCHIVE_KEY, JSON.stringify(snapshot))
          } catch (error) {
            // Storage full or disabled: the archive still applies until the page reloads.
            console.warn('travel-agent: cannot save archived ids', error)
          }
          for (const listener of listeners) listener()
        },
      }
    }

    return {
      inject: ['slots', 'locale', 'remote', 'remote.session', 'workspaces', 'uiWorkspace', 'sidebarRight', 'layout'],
      /**
       * @param ctx - Client plugin context.
       * @param config - synced Host Config; `tripsDir` is the absolute trips directory, or undefined from a Host without it.
       */
      apply(ctx, config) {
        const tripsDirRef = config?.tripsDir ?? { get: () => undefined, ...NO_VALUE }
        const t = ctx.locale.bind(NS)
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'travel-agent: copy')
        const archived = archiveStore()
        const openHome = () => { ctx.layout.selectPanel(PANEL_ID) }
        const openTrip = sessionId => { seedView(sessionId); ctx.uiWorkspace.openSession(sessionId) }
        /**
         * A home-page message becomes the first message of a new Session in the trips directory, which is a new trip card. The
         * user stays on the home page; the Session runs in the background and opens on 机票方案 when clicked.
         */
        const startTrip = async (text) => {
          const dir = tripsDirRef.get()
          if (typeof dir !== 'string') throw new Error(t('home.noDir'))
          const workspace = await ctx.workspaces.create({ path: dir })
          const sessionId = await ctx.uiWorkspace.connectWorkspace(workspace.workspaceId)
          seedView(sessionId)
          const result = await ctx.remote.session.prompt({
            requestId: crypto.randomUUID(), sessionId, mode: 'queue',
            content: [{ type: 'text', text }],
            clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          })
          if (!result.ok) throw new Error(result.error?.message ?? String(result.error))
          return sessionId
        }
        // The host's side chat for one Session, the same tab a Session dragged into the right sidebar opens.
        const openActivity = sessionId => {
          ctx.sidebarRight.openResource(`dsh-resource://subagentchat/session/${encodeURIComponent(sessionId)}`, { kind: 'subagentchat', destination: 'sidebar' })
        }
        ctx.effect(() => ctx.slots.inject('conversation.view', () => ctx.slots.register({
          name: 'conversation.view', id: VIEW_ID, order: 20, locale: NS, label: () => t('view.label'),
          inject: () => ({ openActivity, openHome, setArchived: archived.set, hooks: { archived: archived.source, tripsDir: tripsDirRef } }),
        }, TravelView)), 'travel-agent: conversation view')
        ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main', key: PANEL_ID, locale: NS,
          inject: () => ({
            startTrip, openTrip,
            archiveTrip: sessionId => ctx.workspaces.archiveSession(sessionId),
            restoreTrip: sessionId => ctx.workspaces.unarchiveSession(sessionId),
            hooks: { tripsDir: tripsDirRef },
          }),
        }, TravelHome)), 'travel-agent: home page')
        ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL_ID, order: 30, locale: NS, label: () => t('panel'),
        }, PlaneIcon)), 'travel-agent: sidebar entry')
      },
    }
  },
})