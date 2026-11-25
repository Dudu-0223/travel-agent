/**
 * Host half of the travel agent: model-facing tools that record flight research, and the `flightBoard` Session
 * projection that folds those calls from the Session log and serves the derived board to the travel page.
 * The board is derived only from logged tool calls, so fork, resume and replay reproduce it. The tools and the
 * `find-flights` skill are offered only to Sessions in the trips directory (Config `tripsDir`, default `~/travel`),
 * where the travel page creates its Sessions; the skill's browser section follows the Host platform (macOS or Windows).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import z from '@deepseek-ai/schemastery'
import { computeBoard, EMPTY, InputError, MUTATING, parseState, reduce, reduceUserMessage, summaryText, TOOL } from './model.js'

export const name = 'travel-agent'
export const inject = ['tools', 'sessionProjections', 'skills']

/** `~` or a leading `~/` / `~\` names the user's home directory on every platform. */
const expandHome = value => (/^~(?=$|[\\/])/.test(value) ? join(homedir(), value.slice(1)) : value)

/**
 * `tripsDir` is volatile so the page receives it: the page lists that Workspace's Sessions and creates new ones there.
 * The value reaches both faces already expanded to an absolute path.
 */
export const Config = z.object({
  tripsDir: z.transform(z.string(), value => resolve(expandHome(value.trim())))
    .default('~/travel')
    .description('旅行助手的工作目录：每个行程是这里的一个会话，助手的 AGENTS.md 也放在这里。支持 ~/ 开头。')
    .volatile(),
})

const PACKAGE_DIR = fileURLToPath(new URL('.', import.meta.url))

const PROJECTION_KEY = 'flightBoard'

/** Comparable form of an absolute path: Windows paths compare without case, as the file system does. */
const pathKey = path => (process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path))

/**
 * Whether a working directory is the trips directory or below it.
 * @param cwd - Session working directory.
 * @param dir - absolute trips directory.
 * @returns whether the Session belongs to the travel agent.
 */
const insideTrips = (cwd, dir) => {
  if (typeof cwd !== 'string' || typeof dir !== 'string') return false
  const a = pathKey(cwd)
  const b = pathKey(dir)
  return a === b || a.startsWith(b.endsWith(sep) ? b : b + sep)
}

/** Browser-operation section of the skill for this Host platform; other platforms get the Windows-style cautious rules. */
const BROWSER_SECTION = process.platform === 'darwin' ? 'browser-macos.md' : 'browser-windows.md'

/** The `find-flights` skill: the shared research method plus the browser section for this platform, read at load time. */
const readSkill = () => [
  readFileSync(join(PACKAGE_DIR, 'skills', 'find-flights.md'), 'utf8').trimEnd(),
  readFileSync(join(PACKAGE_DIR, 'skills', BROWSER_SECTION), 'utf8').trimEnd(),
].join('\n\n') + '\n'

const SKILL_SUMMARY = {
  name: 'find-flights',
  description: '在 Trip.com、携程、飞猪、Google Flights、Skyscanner 上用浏览器调查机票价格和航班，并把结果录入旅行助手的行程文件夹。查机票、比价、补充报价时使用；只调查，不订票。',
  invocation: { modelInvocable: true, userInvocable: true },
  source: 'travel-agent',
  provider: 'travel-agent',
}

/** Create the trips directory and its AGENTS.md from the packaged template when either is missing. */
function prepareTripsDir(dir, logger) {
  try {
    mkdirSync(dir, { recursive: true })
    const agents = join(dir, 'AGENTS.md')
    if (!existsSync(agents)) writeFileSync(agents, readFileSync(join(PACKAGE_DIR, 'workspace', 'AGENTS.md')), { flag: 'wx' })
  } catch (error) {
    // A missing directory surfaces again when the page creates its Workspace there; the plugin keeps running.
    logger.warn('travel-agent: cannot prepare %s: %s', dir, error instanceof Error ? error.message : String(error))
  }
}

/** Fold one successful call; malformed or stale input leaves the state unchanged. */
function fold(state, toolName, args, at) {
  try {
    return reduce(state, toolName, args, at).state
  } catch (error) {
    // A call that succeeded at execution can only fail here on log data this version cannot read; keep the board.
    if (error instanceof InputError) return state
    throw error
  }
}

function parseArguments(raw) {
  try {
    return JSON.parse(raw)
  } catch (error) {
    // Native tool calls carry their arguments as JSON text; unparsable text never executed successfully.
    if (error instanceof SyntaxError) return undefined
    throw error
  }
}

function apply_(state, event) {
  switch (event.type) {
    case 'tool/call': {
      const call = event.data
      if (!MUTATING.has(call.name)) return state
      const args = parseArguments(call.arguments)
      if (args === undefined) return state
      return { ...state, pending: { ...state.pending, [call.callId]: { name: call.name, args } } }
    }
    case 'tool/result': {
      const callId = event.data.message.toolCallId
      const pending = state.pending[callId]
      if (pending === undefined) return state
      const { [callId]: _settled, ...rest } = state.pending
      const settled = { ...state, pending: rest }
      if (event.data.message.isError === true) return settled
      return fold(settled, pending.name, pending.args, event.time)
    }
    case 'tool/ptc-dispatch': {
      const dispatch = event.data
      if (!MUTATING.has(dispatch.name) || dispatch.isError) return state
      return fold(state, dispatch.name, dispatch.arguments, event.time)
    }
    case 'user/message': {
      // Older Sessions recorded deletions as 【机票方案】 user messages; keep applying them so those Sessions replay unchanged.
      const message = event.data
      if (message.source?.kind !== 'user' || !Array.isArray(message.content)) return state
      const body = message.content.filter(part => part.type === 'text').map(part => part.text).join('\n').trim()
      return reduceUserMessage(state, body)
    }
    case 'turn/end':
      return Object.keys(state.pending).length === 0 ? state : { ...state, pending: {} }
    default:
      return state
  }
}

const views = new WeakMap()
function view(state) {
  let board = views.get(state)
  if (board === undefined) views.set(state, board = computeBoard(state))
  return board
}

const passthrough = { parse: value => value }

/**
 * The folder card on the travel home page: one Session is one trip folder, so its summary is the current trip. Carried
 * in the Session list summary, which every client reads without opening the Session.
 */
const summaries = new WeakMap()
function tripSummary(state) {
  const board = view(state)
  let summary = summaries.get(board)
  if (summary !== undefined) return summary
  const trip = board.trips.find(t => t.id === board.current) ?? board.trips[board.trips.length - 1]
  if (trip === undefined) summary = null
  else {
    const priced = [...trip.recommended, ...trip.others].filter(c => c.price !== null)
    summary = {
      title: trip.title,
      route: `${trip.origins.join('/')} ⇄ ${trip.destinations.join('/')}`,
      optionCount: trip.optionCount,
      lowest: priced.length === 0 ? null : Math.min(...priced.map(c => c.price)),
      leastLeave: trip.recommended.reduce((n, c) => (c.leaveDays !== null && (n === null || c.leaveDays < n) ? c.leaveDays : n), null),
    }
  }
  summaries.set(board, summary)
  return summary
}

const segmentSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['flight', 'from', 'to', 'date', 'depart', 'arrive'],
  properties: {
    flight: { type: 'string', description: '航班号，如 AF381' },
    airline: { type: 'string', description: '航司，如 法航' },
    from: { type: 'string', description: '出发机场三字码，如 PEK' },
    to: { type: 'string', description: '到达机场三字码，如 CDG' },
    date: { type: 'string', description: '本航段起飞的当地日期 YYYY-MM-DD' },
    depart: { type: 'string', description: '起飞当地时间 HH:MM' },
    arrive: { type: 'string', description: '到达当地时间 HH:MM' },
    arriveDays: { type: 'integer', description: '照抄网页上到达时间旁的 +1/+2；当天到达填 0（默认）' },
    fromTz: { type: 'string', description: '只在工具报错说出发机场不在时区表时填写，IANA 时区名' },
    toTz: { type: 'string', description: '只在工具报错说到达机场不在时区表时填写，IANA 时区名' },
  },
}

const quoteProperties = {
  platform: { type: 'string', description: '平台：Trip.com、携程、飞猪、Google Flights、Skyscanner、去哪儿、航司官网等' },
  price: { type: 'number', description: '人民币总价（全部乘客、往返、含税），只填数字' },
  url: { type: 'string', description: '能直接打开该行程或该搜索结果的链接' },
  baggage: { type: 'string', enum: ['checked', 'carry_on', 'unknown'], description: 'checked=含托运；carry_on=仅随身；unknown=页面没写' },
  note: { type: 'string', description: '可选备注，如 自行转机、需过境签' },
}

const quoteSchema = { type: 'object', additionalProperties: false, required: ['platform', 'price'], properties: quoteProperties }

const tripProperty = { type: 'string', description: '行程文件夹 id 或标题；不填就是当前文件夹（最近一次 flight_set_trip 的那个）' }

const itineraryProperties = {
  outbound: { type: 'array', items: segmentSchema, description: '去程航段，按顺序' },
  inbound: { type: 'array', items: segmentSchema, description: '回程航段，按顺序；单程不填' },
  quotes: { type: 'array', items: quoteSchema, description: '看到的报价，可多个平台' },
  note: { type: 'string', description: '可选备注' },
}

const object = (required, properties) => ({ type: 'object', additionalProperties: false, required, properties })

const TOOLS = [
  {
    name: TOOL.trip,
    description: '新建或更新一个行程文件夹（同一标题就是同一个文件夹），并设为当前文件夹；用户在「旅行助手」页面按文件夹看方案。'
      + '这个页面不显示你的文字回复：需要问用户、请用户选择或确认时，一律用 ask_user_question。流程：'
      + '1) 用本工具建文件夹；2) 用 flight_set_holidays 填写官方放假与调休日期；'
      + '3) 在 Trip.com、携程、飞猪、Google Flights、Skyscanner 逐个搜索，每次搜索后用 flight_log_search 记录；'
      + '4) 把找到的候选行程整理好后，用 ask_user_question（multi_select）问用户要加入哪些，选项写清价格、日期、转机；'
      + '只把用户选中的用 flight_add_option 录入，同一行程在别的平台的价格用 flight_add_quote 补充；'
      + '5) 用 flight_summary 读取插件算好的最优方案，再用 ask_user_question 问用户下一步。'
      + '飞行时长、转机时长、请假天数和最优方案都由插件计算，不要自己算。',
    parameters: object(['title', 'origins', 'destinations'], {
      title: { type: 'string', description: '简短标题，如 2027 春节 北京⇄布宜诺斯艾利斯' },
      origins: { type: 'array', items: { type: 'string' }, description: '出发/回程机场三字码，如 ["PEK", "PKX"]' },
      destinations: { type: 'array', items: { type: 'string' }, description: '目的地机场三字码，如 ["EZE"]' },
      notes: { type: 'string', description: '用户的其他要求，如 出发不晚于初二、可以办申根签' },
    }),
  },
  {
    name: TOOL.holidays,
    description: '设置行程出发地的放假与调休安排，用来计算每个方案要请几天假。只列特殊日期：法定放假日填 holiday，'
      + '调休要上班的周末填 workday；没列出的周一至周五按工作日、周六周日按休息日计算。再次调用会整体替换。',
    parameters: object(['days', 'official'], {
      trip: tripProperty,
      days: {
        type: 'array',
        description: '特殊日期列表',
        items: object(['date', 'type'], {
          date: { type: 'string', description: 'YYYY-MM-DD' },
          type: { type: 'string', enum: ['holiday', 'workday'], description: 'holiday=放假；workday=调休上班' },
        }),
      },
      official: { type: 'boolean', description: '已由国务院正式公布填 true；按往年惯例推测填 false' },
      source: { type: 'string', description: '来源链接' },
    }),
  },
  {
    name: TOOL.add,
    description: '把一个完整行程直接放进文件夹（去程必填，往返或开口程再填回程），按网页照抄每个航段的航班号、机场三字码、当地日期和时间。'
      + '同一行程重复录入会合并到原方案。返回方案 id，供 flight_add_quote 使用。',
    parameters: object(['outbound'], { trip: tripProperty, ...itineraryProperties }),
  },
  {
    name: TOOL.quote,
    description: '为已录入的方案补充或更新某个平台的报价；同一平台只保留最新一条。',
    parameters: object(['option', 'platform', 'price'], { option: { type: 'string', description: '方案 id，如 F1A2B' }, ...quoteProperties }),
  },
  {
    name: TOOL.search,
    description: '记录一次平台搜索（包括没结果或被验证码挡住的），面板据此显示哪些平台还没查。',
    parameters: object(['platform', 'query', 'status'], {
      trip: tripProperty,
      platform: { type: 'string', description: '平台名' },
      query: { type: 'string', description: '搜索条件，如 PEK-EZE 2027-02-02 去 2027-02-18 回' },
      status: { type: 'string', enum: ['done', 'no_results', 'blocked'], description: 'done=查到结果；no_results=没有航班；blocked=验证码/需登录/打不开' },
      note: { type: 'string', description: '可选备注' },
    }),
  },
  {
    name: TOOL.remove,
    description: '移除录错或已失效的方案。',
    parameters: object(['option', 'reason'], { option: { type: 'string', description: '方案 id' }, reason: { type: 'string', description: '原因' } }),
  },
  {
    name: TOOL.removeTrip,
    description: '删除整个行程文件夹及其中的方案和搜索记录。只在用户明确要删除时使用。',
    parameters: object(['trip'], { trip: { type: 'string', description: '行程文件夹 id 或标题' } }),
  },
  {
    name: TOOL.summary,
    description: '读取插件算好的结果：行程文件夹列表，以及某个文件夹里每个方案的价格、请假天数、转机与时长、最优方案、待用户确认的方案、平台覆盖和面板最近对话。回答用户前调用。',
    parameters: object([], { trip: tripProperty }),
  },
]

/**
 * Prepare the trips directory, then register the projections, the flight tools and the `find-flights` skill, the last
 * two offered only in the trips directory.
 * @param ctx - plugin context with the tool, skill and Session projection registries.
 * @param config - plugin configuration; `tripsDir` is an absolute path.
 */
export async function apply(ctx, config) {
  const tripsDir = () => config.tripsDir.get()
  prepareTripsDir(tripsDir(), ctx.logger)
  const inTrips = agent => insideTrips(agent.session?.header?.cwd, tripsDir())
  ctx.effect(() => ctx.skills.registerProvider(() => ({
    name: 'travel-agent',
    list: async ({ cwd }) => (insideTrips(cwd, tripsDir()) ? [{ ...SKILL_SUMMARY, rank: 50, locator: BROWSER_SECTION }] : []),
    get: async () => ({ ...SKILL_SUMMARY, content: readSkill() }),
  })), 'travel-agent: find-flights skill')
  const handle = await ctx.sessionProjections.register({
    key: PROJECTION_KEY,
    stateSchema: { parse: parseState },
    stateVersion: 7,
    init: () => EMPTY,
    apply: apply_,
    wire: { viewSchema: passthrough, view, summary: false },
  })
  await ctx.sessionProjections.register({
    key: 'flightTrip',
    stateSchema: { parse: parseState },
    stateVersion: 1,
    init: () => EMPTY,
    apply: apply_,
    wire: { viewSchema: passthrough, view: tripSummary },
  })
  for (const definition of TOOLS) {
    ctx.tools.register({
      ...definition,
      output: {
        schema: { type: 'object', required: ['message'], properties: { message: { type: 'string' } } },
        render: (_args, value) => [{ type: 'text', text: value.message }],
      },
      async execute(args, exec) {
        const session = exec.agent?.session
        if (session === undefined) throw new Error(`${definition.name} 需要在会话中由助手调用`)
        const state = handle.stateOf(session)
        let result
        try {
          if (definition.name === TOOL.summary) {
            const trip = args?.trip ? state.trips.find(t => t.id === String(args.trip).toUpperCase() || t.title === args.trip) : undefined
            if (args?.trip && trip === undefined) throw new InputError(`没有行程 ${args.trip}`)
            return { message: summaryText(view(state), trip?.id) }
          }
          result = reduce(state, definition.name, args, Date.now())
        } catch (error) {
          if (error instanceof InputError) throw new Error(`参数有误：${error.message}`)
          throw error
        }
        let message = result.message
        if (definition.name === TOOL.add || definition.name === TOOL.quote) {
          const board = computeBoard(result.state)
          const trip = board.trips.find(t => [...t.recommended, ...t.others].some(c => c.id === result.id))
          if (trip !== undefined) {
            const isFront = trip.recommended.some(c => c.id === result.id && c.rank === 1)
            message += ` 「${trip.title}」共 ${trip.optionCount} 个方案，${trip.recommended.filter(c => c.rank === 1).length} 个最优、${trip.recommended.length} 个推荐${isFront ? '，此方案目前是最优之一' : ''}。`
          }
        }
        return { message }
      },
    }, { when: ({ agent }) => inTrips(agent) })
  }
}
