/**
 * Pure travel-agent model: argument normalization, the deterministic reducer shared by tool execution and the
 * Session projection, and the derived board (trip folders, durations, leave days, Pareto front).
 * No imports, no I/O; every function is synchronous.
 */

/** Model-facing tool names. */
export const TOOL = {
  trip: 'flight_set_trip',
  holidays: 'flight_set_holidays',
  add: 'flight_add_option',
  quote: 'flight_add_quote',
  search: 'flight_log_search',
  remove: 'flight_remove_option',
  removeTrip: 'flight_remove_trip',
  summary: 'flight_summary',
}

/** Tools whose successful calls change the board. */
export const MUTATING = new Set([TOOL.trip, TOOL.holidays, TOOL.add, TOOL.quote, TOOL.search, TOOL.remove, TOOL.removeTrip])

/** Prefix of the deletion messages the 机票方案 view sends; the projection applies them. */
export const PANEL_PREFIX = '【机票方案】'

/** A departure at or after this local time on a workday does not cost that day as leave. */
export const AFTER_WORK = '19:00'

/** Platforms the panel always lists, so unsearched ones stay visible. */
export const DEFAULT_PLATFORMS = ['Trip.com', '携程', '飞猪', 'Google Flights', 'Skyscanner']

/** Invalid model input; the message tells the model exactly what to fix. */
export class InputError extends Error {
  constructor(message) {
    super(message)
    this.name = 'InputError'
  }
}
const TZ_GROUPS = {
  'Asia/Shanghai': 'PEK PKX PVG SHA CAN SZX CTU TFU CKG HGH XMN KMG XIY WUH CSX NKG TSN TAO DLC SHE HRB CGO HFE FOC NNG HAK SYX KWE LHW TYN SJW KWL NGB WNZ JJN URC',
  'Asia/Hong_Kong': 'HKG', 'Asia/Macau': 'MFM', 'Asia/Taipei': 'TPE TSA KHH',
  'Asia/Tokyo': 'NRT HND KIX ITM NGO FUK CTS OKA', 'Asia/Seoul': 'ICN GMP PUS CJU',
  'Asia/Singapore': 'SIN', 'Asia/Kuala_Lumpur': 'KUL', 'Asia/Bangkok': 'BKK DMK HKT CNX',
  'Asia/Ho_Chi_Minh': 'SGN HAN DAD CXR PQC', 'Asia/Manila': 'MNL CEB', 'Asia/Jakarta': 'CGK', 'Asia/Makassar': 'DPS',
  'Asia/Kolkata': 'DEL BOM BLR MAA CCU HYD', 'Asia/Colombo': 'CMB', 'Indian/Maldives': 'MLE', 'Asia/Kathmandu': 'KTM',
  'Asia/Dubai': 'DXB AUH DWC SHJ', 'Asia/Qatar': 'DOH', 'Asia/Riyadh': 'RUH JED', 'Asia/Muscat': 'MCT',
  'Asia/Bahrain': 'BAH', 'Asia/Kuwait': 'KWI', 'Asia/Tehran': 'IKA', 'Europe/Istanbul': 'IST SAW',
  'Asia/Jerusalem': 'TLV', 'Asia/Amman': 'AMM', 'Asia/Almaty': 'ALA', 'Asia/Tashkent': 'TAS', 'Asia/Ulaanbaatar': 'UBN',
  'Africa/Cairo': 'CAI', 'Africa/Addis_Ababa': 'ADD', 'Africa/Nairobi': 'NBO', 'Africa/Johannesburg': 'JNB CPT',
  'Africa/Casablanca': 'CMN', 'Africa/Lagos': 'LOS', 'Africa/Accra': 'ACC', 'Indian/Mauritius': 'MRU',
  'Europe/London': 'LHR LGW STN LCY MAN EDI', 'Europe/Dublin': 'DUB', 'Europe/Paris': 'CDG ORY NCE LYS',
  'Europe/Amsterdam': 'AMS', 'Europe/Brussels': 'BRU', 'Europe/Berlin': 'FRA MUC BER DUS HAM', 'Europe/Zurich': 'ZRH GVA',
  'Europe/Vienna': 'VIE', 'Europe/Copenhagen': 'CPH', 'Europe/Stockholm': 'ARN', 'Europe/Oslo': 'OSL',
  'Europe/Helsinki': 'HEL', 'Atlantic/Reykjavik': 'KEF', 'Europe/Madrid': 'MAD BCN', 'Europe/Lisbon': 'LIS OPO',
  'Europe/Rome': 'FCO MXP LIN VCE', 'Europe/Athens': 'ATH', 'Europe/Warsaw': 'WAW', 'Europe/Prague': 'PRG',
  'Europe/Budapest': 'BUD', 'Europe/Moscow': 'SVO DME LED', 'Europe/Belgrade': 'BEG',
  'America/New_York': 'JFK EWR LGA BOS IAD DCA ATL MIA MCO PHL CLT DTW', 'America/Chicago': 'ORD DFW IAH MSP',
  'America/Denver': 'DEN', 'America/Phoenix': 'PHX', 'America/Los_Angeles': 'LAX SFO SEA SAN LAS',
  'Pacific/Honolulu': 'HNL', 'America/Vancouver': 'YVR', 'America/Toronto': 'YYZ YUL',
  'America/Mexico_City': 'MEX', 'America/Cancun': 'CUN', 'America/Panama': 'PTY', 'America/Bogota': 'BOG',
  'America/Lima': 'LIM', 'America/Santiago': 'SCL', 'America/Argentina/Buenos_Aires': 'EZE AEP',
  'America/Argentina/Cordoba': 'COR IGR', 'America/Argentina/Mendoza': 'MDZ', 'America/Argentina/Salta': 'SLA BRC',
  'America/Argentina/Ushuaia': 'USH', 'America/Argentina/Rio_Gallegos': 'FTE', 'America/Sao_Paulo': 'GRU GIG IGU',
  'America/Montevideo': 'MVD', 'America/Asuncion': 'ASU', 'America/Guayaquil': 'GYE UIO',
  'America/Havana': 'HAV', 'America/Costa_Rica': 'SJO', 'America/Caracas': 'CCS', 'America/La_Paz': 'LPB VVI',
  'Australia/Sydney': 'SYD', 'Australia/Melbourne': 'MEL', 'Australia/Brisbane': 'BNE', 'Australia/Perth': 'PER',
  'Pacific/Auckland': 'AKL CHC',
}

/** IATA code → IANA time zone for common airports. */
export const AIRPORT_TZ = (() => {
  const table = {}
  for (const [tz, codes] of Object.entries(TZ_GROUPS)) {
    for (const code of codes.split(' ')) if (code !== '') table[code] = tz
  }
  return Object.freeze(table)
})()

const PLATFORM_ALIASES = [
  [/^(trip(\.com)?|tripcom|trip ?com)$/i, 'Trip.com'],
  [/^(携程|携程旅行|ctrip)$/i, '携程'],
  [/^(飞猪|飞猪旅行|fliggy|alitrip)$/i, '飞猪'],
  [/^(google ?flights?|google|谷歌机票|谷歌航班)$/i, 'Google Flights'],
  [/^(skyscanner|天巡)$/i, 'Skyscanner'],
  [/^(去哪儿|去哪儿网|qunar)$/i, '去哪儿'],
  [/^kayak$/i, 'Kayak'],
]

/** Canonical platform name, folding common spellings. */
export function canonicalPlatform(value) {
  const text = String(value).trim()
  for (const [pattern, name] of PLATFORM_ALIASES) if (pattern.test(text)) return name
  return text
}

// ---- time helpers -------------------------------------------------------

const formatters = new Map()
function formatter(tz) {
  let format = formatters.get(tz)
  if (format === undefined) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    formatters.set(tz, format)
  }
  return format
}

function validTz(tz) {
  try {
    formatter(tz)
    return true
  } catch (error) {
    // RangeError: the name is not an IANA time zone.
    if (error instanceof RangeError) return false
    throw error
  }
}

function offsetMinutes(tz, utc) {
  const parts = {}
  for (const part of formatter(tz).formatToParts(new Date(utc))) parts[part.type] = part.value
  const hour = Number(parts.hour) === 24 ? 0 : Number(parts.hour)
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, Number(parts.minute), Number(parts.second))
  return (asUtc - utc) / 60000
}

/** UTC milliseconds of a local wall-clock time in a zone. */
function toUtc(tz, date, time) {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const wall = Date.UTC(y, m - 1, d, hh, mm)
  const first = wall - offsetMinutes(tz, wall) * 60000
  return wall - offsetMinutes(tz, first) * 60000
}

function addDays(date, days) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

function weekday(date) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** `31h15m` style duration. */
export function formatMinutes(minutes) {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h === 0 ? `${m}m` : `${h}h${String(m).padStart(2, '0')}m`
}

function shortDate(date) {
  const [, m, d] = date.split('-').map(Number)
  return `${m}/${d}`
}

// ---- input normalization ------------------------------------------------

function text(value, path, { required = true, max = 200 } = {}) {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    if (required) throw new InputError(`${path} 不能为空`)
    return undefined
  }
  if (typeof value !== 'string') throw new InputError(`${path} 必须是字符串，收到 ${JSON.stringify(value)}`)
  const trimmed = value.trim()
  if (trimmed.length > max) throw new InputError(`${path} 过长（最多 ${max} 个字符）`)
  return trimmed
}

function list(value, path, { min = 0, max = 50 } = {}) {
  if (value === undefined || value === null) {
    if (min > 0) throw new InputError(`${path} 至少需要 ${min} 项`)
    return []
  }
  if (!Array.isArray(value)) throw new InputError(`${path} 必须是数组`)
  if (value.length < min) throw new InputError(`${path} 至少需要 ${min} 项`)
  if (value.length > max) throw new InputError(`${path} 最多 ${max} 项`)
  return value
}

function airport(value, path) {
  const code = text(value, path, { max: 3 }).toUpperCase()
  if (!/^[A-Z]{3}$/.test(code)) throw new InputError(`${path} 必须是三字母机场代码（如 PEK、CDG），收到 ${JSON.stringify(value)}`)
  return code
}

function date(value, path) {
  const raw = text(value, path, { max: 10 })
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw)
  if (match === null) throw new InputError(`${path} 必须是 YYYY-MM-DD 格式的日期，收到 ${JSON.stringify(value)}`)
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const parsed = new Date(Date.UTC(y, m - 1, d))
  if (parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d) throw new InputError(`${path} 不是有效日期：${raw}`)
  return parsed.toISOString().slice(0, 10)
}

function clock(value, path) {
  const raw = text(value, path, { max: 5 })
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw)
  if (match === null || Number(match[1]) > 23 || Number(match[2]) > 59) {
    throw new InputError(`${path} 必须是 24 小时制 HH:MM（如 07:45），收到 ${JSON.stringify(value)}`)
  }
  return `${match[1].padStart(2, '0')}:${match[2]}`
}

function zone(value, code, path) {
  const tz = value === undefined || value === null || value === '' ? AIRPORT_TZ[code] : text(value, path, { max: 60 })
  if (tz === undefined) {
    throw new InputError(`机场 ${code} 不在内置时区表中：请在该航段补充 ${path}（IANA 时区名，如 "Europe/Paris"、"America/Argentina/Buenos_Aires"）`)
  }
  if (!validTz(tz)) throw new InputError(`${path} 不是有效的 IANA 时区名：${JSON.stringify(tz)}`)
  return tz
}

function segment(raw, path) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new InputError(`${path} 必须是对象`)
  const flight = text(raw.flight, `${path}.flight`, { max: 12 }).replace(/\s+/g, '').toUpperCase()
  const from = airport(raw.from, `${path}.from`)
  const to = airport(raw.to, `${path}.to`)
  const day = date(raw.date, `${path}.date`)
  const depart = clock(raw.depart, `${path}.depart`)
  const arrive = clock(raw.arrive, `${path}.arrive`)
  const arriveDays = raw.arriveDays === undefined || raw.arriveDays === null ? 0 : raw.arriveDays
  if (!Number.isInteger(arriveDays) || arriveDays < -1 || arriveDays > 3) {
    throw new InputError(`${path}.arriveDays 必须是 -1 到 3 的整数（网页上的 +1 填 1，当天到达填 0）`)
  }
  const result = {
    flight,
    airline: text(raw.airline, `${path}.airline`, { required: false, max: 40 }) ?? '',
    from, to, date: day, depart, arrive, arriveDays,
    fromTz: zone(raw.fromTz, from, `${path}.fromTz`),
    toTz: zone(raw.toTz, to, `${path}.toTz`),
  }
  const minutes = (arrivalUtc(result) - departureUtc(result)) / 60000
  if (minutes < 20 || minutes > 22 * 60) {
    throw new InputError(`${path}（${flight} ${from}→${to}）算出的飞行时长为 ${minutes < 0 ? '负数' : formatMinutes(minutes)}，不合理。请核对 date、depart、arrive 和 arriveDays（网页上显示的 +1/+2 天）`)
  }
  return result
}

const departureUtc = s => toUtc(s.fromTz, s.date, s.depart)
const arrivalDate = s => addDays(s.date, s.arriveDays)
const arrivalUtc = s => toUtc(s.toTz, arrivalDate(s), s.arrive)

function direction(raw, path, required) {
  if (!required && (raw === undefined || raw === null || (Array.isArray(raw) && raw.length === 0))) return []
  const segments = list(raw, path, { min: 1, max: 6 }).map((item, index) => segment(item, `${path}[${index}]`))
  for (let i = 1; i < segments.length; i++) {
    const minutes = (departureUtc(segments[i]) - arrivalUtc(segments[i - 1])) / 60000
    if (minutes < 20 || minutes > 72 * 60) {
      throw new InputError(`${path} 第 ${i} 段到第 ${i + 1} 段之间的转机时间算出为 ${minutes < 0 ? '负数' : formatMinutes(minutes)}，不合理。请核对第 ${i + 1} 段的 date 与第 ${i} 段的 arriveDays`)
    }
  }
  return segments
}

function quote(raw, path) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new InputError(`${path} 必须是对象`)
  const platform = canonicalPlatform(text(raw.platform, `${path}.platform`, { max: 40 }))
  const price = raw.price
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price > 2_000_000) {
    throw new InputError(`${path}.price 必须是正数（人民币总价，含税），收到 ${JSON.stringify(price)}`)
  }
  const url = text(raw.url, `${path}.url`, { required: false, max: 4000 })
  if (url !== undefined && !/^https?:\/\//i.test(url)) throw new InputError(`${path}.url 必须以 http:// 或 https:// 开头`)
  const baggage = raw.baggage === undefined || raw.baggage === null ? 'unknown' : raw.baggage
  if (!['checked', 'carry_on', 'unknown'].includes(baggage)) {
    throw new InputError(`${path}.baggage 只能是 checked（含托运）、carry_on（仅随身）或 unknown`)
  }
  return {
    platform, price: Math.round(price), url: url ?? '', baggage,
    note: text(raw.note, `${path}.note`, { required: false, max: 200 }) ?? '',
  }
}

/** Stable id derived from the trip and itinerary, so concurrent and replayed calls agree. */
function hashId(prefix, signature) {
  let hash = 0x811c9dc5
  for (let i = 0; i < signature.length; i++) {
    hash ^= signature.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return prefix + hash.toString(36).toUpperCase().padStart(7, '0').slice(-5)
}

/** Option id: one itinerary in one trip folder. */
export function optionId(trip, outbound, inbound) {
  return hashId('F', `${trip}~` + [...outbound, ...inbound].map(s => `${s.flight}@${s.date}`).join('|') + `#${outbound.length}`)
}

const tripId = title => hashId('T', title)

// ---- state --------------------------------------------------------------

/** Empty board state. */
export const EMPTY = Object.freeze({
  v: 3, trips: Object.freeze([]), current: null, options: Object.freeze([]), searches: Object.freeze([]),
  pending: Object.freeze({}),
})

/**
 * Validate a persisted state row.
 * @param value - candidate state.
 * @returns the state.
 */
export function parseState(value) {
  if (value === null || typeof value !== 'object' || value.v !== 3 || !Array.isArray(value.trips) || !Array.isArray(value.options)
    || !Array.isArray(value.searches) || value.pending === null || typeof value.pending !== 'object') {
    throw new Error('travel-agent: unrecognized state row')
  }
  return value
}

/** Resolve the trip a call targets: an id or title, else the current trip. */
function resolveTrip(state, value) {
  if (value === undefined || value === null || value === '') {
    const trip = state.trips.find(t => t.id === state.current)
    if (trip === undefined) throw new InputError('还没有行程：先用 flight_set_trip 建一个行程文件夹')
    return trip
  }
  const key = text(value, 'trip', { max: 80 })
  const trip = state.trips.find(t => t.id === key.toUpperCase() || t.title === key)
  if (trip === undefined) {
    throw new InputError(`没有行程 ${key}。现有行程：${state.trips.map(t => `${t.id}「${t.title}」`).join('、') || '无'}`)
  }
  return trip
}

function findOption(state, id) {
  const key = text(id, 'option', { max: 12 }).toUpperCase()
  const option = state.options.find(o => o.id === key && o.removed === undefined)
  if (option === undefined) {
    const ids = state.options.filter(o => o.removed === undefined).map(o => o.id)
    throw new InputError(`没有 id 为 ${key} 的方案。现有方案：${ids.length === 0 ? '无（先用 flight_add_option 录入）' : ids.join('、')}`)
  }
  return option
}

function upsertQuotes(quotes, incoming, at) {
  let next = quotes
  for (const q of incoming) next = [...next.filter(existing => existing.platform !== q.platform), { ...q, at }]
  return next
}

function replaceOption(state, option) {
  return { ...state, options: state.options.map(o => (o.id === option.id ? option : o)) }
}

/** Normalize one itinerary argument object (outbound, inbound, quotes, note). */
function itinerary(input, path) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new InputError(`${path} 必须是对象`)
  return {
    outbound: direction(input.outbound, `${path}outbound`, true),
    inbound: direction(input.inbound, `${path}inbound`, false),
    quotes: list(input.quotes, `${path}quotes`, { max: 12 }).map((q, i) => quote(q, `${path}quotes[${i}]`)),
    note: text(input.note, `${path}note`, { required: false, max: 300 }) ?? '',
  }
}

/** Add or merge one itinerary. */
function addItinerary(state, trip, it, status, at) {
  const id = optionId(trip.id, it.outbound, it.inbound)
  const existing = state.options.find(o => o.id === id)
  if (existing !== undefined) {
    const { removed: _removed, ...kept } = existing
    const merged = { ...kept, status, quotes: upsertQuotes(existing.quotes, it.quotes, at), note: it.note || existing.note }
    return { state: replaceOption(state, merged), id, existed: true }
  }
  const option = { id, trip: trip.id, status, outbound: it.outbound, inbound: it.inbound, quotes: upsertQuotes([], it.quotes, at), note: it.note }
  return { state: { ...state, options: [...state.options, option] }, id, existed: false }
}

/**
 * Apply one successful tool call. Throws InputError for invalid input; otherwise returns the next state and a
 * short model-facing message.
 * @param state - the board before the call.
 * @param name - tool name.
 * @param args - model arguments.
 * @param at - timestamp (ms) recorded on quotes and searches.
 * @returns `{ state, message, id? }`.
 */
export function reduce(state, name, args, at) {
  const input = args !== null && typeof args === 'object' && !Array.isArray(args) ? args : {}
  switch (name) {
    case TOOL.trip: {
      const title = text(input.title, 'title', { max: 80 })
      const id = tripId(title)
      const existing = state.trips.find(t => t.id === id)
      const trip = {
        id, title,
        origins: list(input.origins, 'origins', { min: 1, max: 6 }).map((v, i) => airport(v, `origins[${i}]`)),
        destinations: list(input.destinations, 'destinations', { min: 1, max: 6 }).map((v, i) => airport(v, `destinations[${i}]`)),
        notes: text(input.notes, 'notes', { required: false, max: 500 }) ?? '',
        holidays: existing?.holidays ?? null,
      }
      const trips = existing === undefined ? [...state.trips, trip] : state.trips.map(t => (t.id === id ? trip : t))
      return {
        state: { ...state, trips, current: id }, id,
        message: `${existing === undefined ? '已新建' : '已更新'}行程文件夹 ${id}「${title}」，后续调用默认放进这个文件夹。${trip.holidays === null ? '下一步：用 flight_set_holidays 填写放假与调休安排。' : ''}`,
      }
    }
    case TOOL.holidays: {
      const trip = resolveTrip(state, input.trip)
      const days = {}
      list(input.days, 'days', { min: 1, max: 120 }).forEach((raw, i) => {
        if (raw === null || typeof raw !== 'object') throw new InputError(`days[${i}] 必须是对象`)
        const day = date(raw.date, `days[${i}].date`)
        if (raw.type !== 'holiday' && raw.type !== 'workday') {
          throw new InputError(`days[${i}].type 只能是 holiday（放假）或 workday（调休上班）`)
        }
        days[day] = raw.type
      })
      if (typeof input.official !== 'boolean') throw new InputError('official 必须是布尔值：已由国务院正式公布填 true，按惯例推测填 false')
      const holidays = { days, official: input.official, source: text(input.source, 'source', { required: false, max: 1000 }) ?? '' }
      const count = Object.values(days).filter(t => t === 'holiday').length
      return {
        state: { ...state, trips: state.trips.map(t => (t.id === trip.id ? { ...t, holidays } : t)) },
        message: `已为「${trip.title}」设置假期：${count} 天放假、${Object.keys(days).length - count} 天调休上班${holidays.official ? '' : '（非官方，按推测）'}。`,
      }
    }
    case TOOL.add: {
      const trip = resolveTrip(state, input.trip)
      const result = addItinerary(state, trip, itinerary(input, ''), 'added', at)
      return { ...result, message: result.existed ? `该行程已存在，id 为 ${result.id}，已合并报价。` : `已录入方案 ${result.id}。` }
    }
    case TOOL.quote: {
      const option = findOption(state, input.option)
      const q = quote(input, 'arguments')
      return { state: replaceOption(state, { ...option, quotes: upsertQuotes(option.quotes, [q], at) }), id: option.id, message: `已记录 ${option.id} 在 ${q.platform} 的价格 ¥${q.price}。` }
    }
    case TOOL.search: {
      const trip = resolveTrip(state, input.trip)
      const platform = canonicalPlatform(text(input.platform, 'platform', { max: 40 }))
      if (!['done', 'no_results', 'blocked'].includes(input.status)) {
        throw new InputError('status 只能是 done（查到了结果）、no_results（没有航班）或 blocked（验证码/需要登录/打不开）')
      }
      const entry = {
        trip: trip.id, platform, status: input.status, at,
        query: text(input.query, 'query', { max: 200 }),
        note: text(input.note, 'note', { required: false, max: 200 }) ?? '',
      }
      return { state: { ...state, searches: [...state.searches, entry].slice(-500) }, message: `已记录在 ${platform} 的搜索。` }
    }
    case TOOL.remove: {
      const option = findOption(state, input.option)
      const reason = text(input.reason, 'reason', { max: 200 })
      return { state: replaceOption(state, { ...option, removed: reason }), id: option.id, message: `已移除方案 ${option.id}。` }
    }
    case TOOL.removeTrip: {
      const trip = resolveTrip(state, input.trip)
      return { state: removeTrip(state, trip.id), id: trip.id, message: `已删除行程文件夹「${trip.title}」及其中的方案。` }
    }
    default:
      throw new InputError(`未知操作 ${name}`)
  }
}

/** Drop a trip folder with its options and searches; the current folder falls back to the newest remaining one. */
function removeTrip(state, tripKey) {
  const trips = state.trips.filter(t => t.id !== tripKey)
  return {
    ...state,
    trips,
    current: state.current === tripKey ? (trips[trips.length - 1]?.id ?? null) : state.current,
    options: state.options.filter(o => o.trip !== tripKey),
    searches: state.searches.filter(s => s.trip !== tripKey),
  }
}

/**
 * Fold one user message. The 机票方案 view sends `【机票方案】删除文件夹「标题」（T…）` and `【机票方案】删除方案 ¥…（F…）`;
 * any other message leaves the state unchanged.
 * @param state - the board before the message.
 * @param body - the message text.
 * @returns the next state.
 */
export function reduceUserMessage(state, body) {
  if (!body.startsWith(PANEL_PREFIX)) return state
  const trip = /^删除文件夹.*（(T[0-9A-Z]{5})）\s*$/.exec(body.slice(PANEL_PREFIX.length))
  if (trip !== null) return state.trips.some(t => t.id === trip[1]) ? removeTrip(state, trip[1]) : state
  const option = /^删除方案.*（(F[0-9A-Z]{5})）\s*$/.exec(body.slice(PANEL_PREFIX.length))
  if (option === null) return state
  const target = state.options.find(o => o.id === option[1] && o.removed === undefined)
  return target === undefined ? state : replaceOption(state, { ...target, removed: '用户在页面上删除' })
}

// ---- derived board -----------------------------------------------------

function dayType(day, holidays) {
  const declared = holidays?.days[day]
  if (declared !== undefined) return declared
  const wd = weekday(day)
  return wd === 0 || wd === 6 ? 'weekend' : 'workday'
}

function directionView(segments) {
  if (segments.length === 0) return null
  const legs = []
  segments.forEach((s, i) => {
    if (i > 0) {
      const prev = segments[i - 1]
      legs.push({
        kind: 'layover',
        airport: prev.to === s.from ? s.from : `${prev.to}→${s.from}`,
        minutes: Math.round((departureUtc(s) - arrivalUtc(prev)) / 60000),
        fromDate: arrivalDate(prev), fromTime: prev.arrive, toDate: s.date, toTime: s.depart,
      })
    }
    legs.push({
      kind: 'flight', flight: s.flight, airline: s.airline, from: s.from, to: s.to,
      departDate: s.date, departTime: s.depart, arriveDate: arrivalDate(s), arriveTime: s.arrive,
      minutes: Math.round((arrivalUtc(s) - departureUtc(s)) / 60000),
    })
  })
  const first = segments[0]
  const last = segments[segments.length - 1]
  return {
    from: first.from, to: last.to,
    departDate: first.date, departTime: first.depart, arriveDate: arrivalDate(last), arriveTime: last.arrive,
    minutes: Math.round((arrivalUtc(last) - departureUtc(first)) / 60000),
    transfers: segments.length - 1,
    legs,
  }
}

function card(option, holidays) {
  const outbound = directionView(option.outbound)
  const inbound = directionView(option.inbound)
  const quotes = [...option.quotes].sort((a, b) => a.price - b.price)
  let leaveDays = null
  const leaveDates = []
  let awayDays = null
  let groundHours = null
  if (inbound !== null) {
    const start = outbound.departDate
    const end = inbound.arriveDate
    for (let day = start, n = 0; day <= end && n < 400; day = addDays(day, 1), n++) {
      if (dayType(day, holidays) !== 'workday') continue
      if (day === start && outbound.departTime >= AFTER_WORK) continue
      leaveDates.push(day)
    }
    leaveDays = leaveDates.length
    const [sy, sm, sd] = start.split('-').map(Number)
    const [ey, em, ed] = end.split('-').map(Number)
    awayDays = Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000) + 1
    const landed = arrivalUtc(option.outbound[option.outbound.length - 1])
    groundHours = Math.round((departureUtc(option.inbound[0]) - landed) / 3600000)
  }
  return {
    id: option.id,
    status: option.status,
    price: quotes.length === 0 ? null : quotes[0].price,
    platform: quotes.length === 0 ? null : quotes[0].platform,
    tags: [],
    pareto: false,
    rank: null,
    leaveDays, leaveDates, awayDays, groundHours,
    transfers: (outbound?.transfers ?? 0) + (inbound?.transfers ?? 0),
    flightMinutes: (outbound?.minutes ?? 0) + (inbound?.minutes ?? 0),
    outbound, inbound,
    quotes,
    note: option.note,
  }
}

function ranges(days, type) {
  const dates = Object.keys(days).filter(d => days[d] === type).sort()
  const result = []
  for (const day of dates) {
    const last = result[result.length - 1]
    if (last !== undefined && addDays(last.end, 1) === day) last.end = day
    else result.push({ start: day, end: day })
  }
  return result
}

function platforms(state, trip) {
  const rows = new Map(DEFAULT_PLATFORMS.map(name => [name, { name, searches: 0, blocked: 0, quotes: 0 }]))
  for (const s of state.searches) {
    if (s.trip !== trip) continue
    let entry = rows.get(s.platform)
    if (entry === undefined) rows.set(s.platform, entry = { name: s.platform, searches: 0, blocked: 0, quotes: 0 })
    if (s.status === 'blocked') entry.blocked++
    else entry.searches++
  }
  for (const option of state.options) {
    if (option.trip !== trip || option.removed !== undefined || option.status !== 'added') continue
    // Quotes count toward listed platforms only; a quote alone does not add a chip for an unlisted source.
    for (const q of option.quotes) {
      const entry = rows.get(q.platform)
      if (entry !== undefined) entry.quotes++
    }
  }
  return [...rows.values()].map(r => ({
    ...r, state: r.searches > 0 || r.quotes > 0 ? 'done' : r.blocked > 0 ? 'blocked' : 'todo',
  }))
}

const dominates = (a, b) => a.price <= b.price && a.leaveDays <= b.leaveDays && a.transfers <= b.transfers
  && (a.price < b.price || a.leaveDays < b.leaveDays || a.transfers < b.transfers)

function pick(cards, compare) {
  return cards.reduce((best, c) => (best === undefined || compare(c, best) < 0 ? c : best), undefined)
}

const byPrice = (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || a.id.localeCompare(b.id)

/** Recommend at least this many options when the folder has them: further non-dominated layers fill up to it. */
export const RECOMMEND_TARGET = 5

/**
 * Rank priced options by non-dominated layers over price, leave days and transfers: rank 1 is the Pareto front, rank 2
 * the front once rank 1 is set aside, and so on. Layers are taken whole until at least RECOMMEND_TARGET options are
 * recommended. Sets `rank`, `pareto` (rank 1) and the cheapest / least-leave / easiest tags on the front.
 * @param comparable - options with a price and leave days; mutated.
 * @returns the recommended options, by rank then price.
 */
export function rankOptions(comparable) {
  const recommended = []
  let rest = comparable
  for (let rank = 1; rest.length > 0 && (rank === 1 || recommended.length < RECOMMEND_TARGET); rank++) {
    const layer = rest.filter(c => !rest.some(other => other !== c && dominates(other, c)))
    for (const c of layer) { c.rank = rank; c.pareto = rank === 1 }
    recommended.push(...layer.sort(byPrice))
    rest = rest.filter(c => c.rank === null)
  }
  const front = recommended.filter(c => c.pareto)
  pick(front, (a, b) => a.price - b.price || a.leaveDays - b.leaveDays)?.tags.push('cheapest')
  pick(front, (a, b) => a.leaveDays - b.leaveDays || a.price - b.price)?.tags.push('leastLeave')
  pick(front, (a, b) => a.transfers - b.transfers || a.flightMinutes - b.flightMinutes || a.price - b.price)?.tags.push('easiest')
  return recommended
}

function tripView(state, trip) {
  const live = state.options.filter(o => o.trip === trip.id && o.removed === undefined)
  const cards = live.filter(o => o.status === 'added').map(o => card(o, trip.holidays))
  const recommended = rankOptions(cards.filter(c => c.price !== null && c.leaveDays !== null))
  const holidays = trip.holidays
  return {
    id: trip.id, title: trip.title, origins: trip.origins, destinations: trip.destinations, notes: trip.notes,
    holidays: holidays === null ? null : {
      official: holidays.official, source: holidays.source,
      off: ranges(holidays.days, 'holiday'), work: ranges(holidays.days, 'workday'),
    },
    optionCount: cards.length,
    recommended,
    others: cards.filter(c => c.rank === null).sort(byPrice),
    platforms: platforms(state, trip.id),
  }
}

/**
 * Derive the board the panel shows: one folder per trip with its recommended options (non-dominated layers over price,
 * leave days and transfer count; see rankOptions) and platform coverage.
 * @param state - board state.
 * @returns the client view.
 */
export function computeBoard(state) {
  const trips = state.trips.map(trip => tripView(state, trip))
  return {
    afterWork: AFTER_WORK,
    current: state.current,
    optionCount: trips.reduce((n, t) => n + t.optionCount, 0),
    trips,
  }
}

// ---- model-facing summary ------------------------------------------------

function directionLine(d) {
  const stops = d.legs.filter(l => l.kind === 'layover').map(l => `${l.airport} ${formatMinutes(l.minutes)}`)
  return `${shortDate(d.departDate)} ${d.departTime} ${d.from}→${d.to} ${shortDate(d.arriveDate)} ${d.arriveTime}，${formatMinutes(d.minutes)}，`
    + (stops.length === 0 ? '直飞' : `转 ${stops.length} 次（${stops.join('、')}）`)
}

const TAG_TEXT = { cheapest: '最便宜', leastLeave: '最省假', easiest: '最好飞' }

function cardLine(c) {
  const tags = [...c.tags.map(t => TAG_TEXT[t]), ...(c.rank > 1 ? [`第 ${c.rank} 层`] : [])].join('/')
  const parts = [
    `${c.id} ${c.price === null ? '待报价' : `¥${c.price}（${c.platform}）`}${tags ? ` [${tags}]` : ''}`,
    `去 ${directionLine(c.outbound)}`,
  ]
  if (c.inbound !== null) parts.push(`回 ${directionLine(c.inbound)}`)
  if (c.leaveDays !== null) parts.push(`请假 ${c.leaveDays} 天，出行 ${c.awayDays} 天，目的地停留 ${Math.floor(c.groundHours / 24)} 天 ${c.groundHours % 24} 小时`)
  if (c.quotes.length > 1) parts.push(`其他报价 ${c.quotes.slice(1).map(q => `${q.platform} ¥${q.price}`).join('、')}`)
  return '- ' + parts.join('；')
}

/**
 * Plain-text summary of one trip folder for the model.
 * @param board - derived board.
 * @param tripKey - trip id; the current trip when omitted.
 * @returns the summary text.
 */
export function summaryText(board, tripKey) {
  const lines = []
  if (board.trips.length === 0) return '还没有行程：先用 flight_set_trip 建一个行程文件夹。'
  lines.push('行程文件夹：' + board.trips.map(t => `${t.id}「${t.title}」${t.id === board.current ? '（当前）' : ''}`).join('、'))
  const trip = board.trips.find(t => t.id === (tripKey ?? board.current)) ?? board.trips[board.trips.length - 1]
  lines.push(`== ${trip.id}「${trip.title}」（${trip.origins.join('/')} ⇄ ${trip.destinations.join('/')}）${trip.notes ? `，要求：${trip.notes}` : ''}`)
  if (trip.holidays === null) lines.push('假期：未设置，请假天数只按周末计算（用 flight_set_holidays 设置）')
  else lines.push(`假期：放假 ${trip.holidays.off.map(r => r.start === r.end ? shortDate(r.start) : `${shortDate(r.start)}–${shortDate(r.end)}`).join('、') || '无'}；调休上班 ${trip.holidays.work.map(r => shortDate(r.start)).join('、') || '无'}${trip.holidays.official ? '' : '（非官方）'}`)
  lines.push('平台：' + trip.platforms.map(p => `${p.name} ${p.state === 'done' ? `已查 ${p.searches} 次/报价 ${p.quotes} 条` : p.state === 'blocked' ? '受阻' : '未查'}`).join('；'))
  const todo = trip.platforms.filter(p => p.state === 'todo').map(p => p.name)
  if (todo.length > 0) lines.push(`还没查的平台：${todo.join('、')}`)
  lines.push(`推荐方案（${trip.recommended.length}）：第 1 层 = 价格、请假天数、转机次数三者没有被其他方案同时超过；去掉第 1 层后同样取第 2 层，依次补到至少 ${RECOMMEND_TARGET} 个`)
  for (const c of trip.recommended) lines.push(cardLine(c))
  if (trip.others.length > 0) {
    lines.push(`其他方案（${trip.others.length}）：`)
    for (const c of trip.others.slice(0, 30)) lines.push(cardLine(c))
    if (trip.others.length > 30) lines.push(`……另有 ${trip.others.length - 30} 个`)
  }
  lines.push('用户在「旅行助手」页面按文件夹查看这些方案；页面不显示你的文字回复，要问用户或请用户确认，必须用 ask_user_question。')
  return lines.join('\n')
}
