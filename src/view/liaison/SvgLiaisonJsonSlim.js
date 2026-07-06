/**
 * 将接口全量 JSON 裁剪为联络成图所需字段，并过滤 <35kV 站与无效通道。
 * 与 scripts/slimSvgLiaisonJson.cjs 逻辑一致，供页面加载大文件时避免内存暴涨。
 */

export function normalizeKV(value) {
  return Math.round(Number(value || 0))
}

/** 外市边界联络节点（如竹贤、祥符），不成站展示 */
export function isExternalBoundaryStation(stationName) {
  const raw = String(stationName || '').trim()
  if (!raw) return false
  return /^竹贤站(?:\.|$)/.test(raw) || /^祥符站(?:\.|$)/.test(raw)
}

/** 名称含 T+数字（如 T1站、T2站.115.10）的虚拟 T 接点 */
export function isVirtualT10Station(stationName, shortName) {
  const full = String(stationName || shortName || '')
  const short = String(shortName || '')
  if (/T\d+站/i.test(full)) return true
  if (/T\d+/i.test(full)) return true
  if (short !== full && /T\d+/i.test(short)) return true
  return false
}

/**
 * 末端 T 接点：虚拟 T 站且仅参与 1 条 ≥35kV 通道（如慈云站下的 新乡.T2站.115.10）。
 * 成图时不展示该接点及其线路。
 */
export function computeTerminalVirtualTStationIds(stationData, channelData) {
  const stations = Array.isArray(stationData) ? stationData : []
  const channels = Array.isArray(channelData) ? channelData : []
  const virtualIds = new Set()
  for (const raw of stations) {
    if (!raw?.station_id) continue
    if (isVirtualT10Station(raw.station_name)) virtualIds.add(raw.station_id)
  }
  const degree = new Map()
  for (const ch of channels) {
    if (Number(ch?.min_vn_kv || 0) < 35) continue
    const from = ch.from_station
    const to = ch.to_station
    if (virtualIds.has(from)) degree.set(from, (degree.get(from) || 0) + 1)
    if (virtualIds.has(to)) degree.set(to, (degree.get(to) || 0) + 1)
  }
  const terminal = new Set()
  virtualIds.forEach((id) => {
    if ((degree.get(id) || 0) <= 1) terminal.add(id)
  })
  return terminal
}

export function channelHasTerminalVirtualT(channel, terminalIds) {
  if (!channel || !terminalIds?.size) return false
  return terminalIds.has(channel.from_station) || terminalIds.has(channel.to_station)
}

function slimTrafoDisplayRow(row) {
  const o = {}
  if (row.p_mw != null && !Number.isNaN(Number(row.p_mw))) o.p_mw = Number(row.p_mw)
  if (row.q_mvar != null && !Number.isNaN(Number(row.q_mvar))) o.q_mvar = Number(row.q_mvar)
  return o
}

function slimStringList(list) {
  if (!Array.isArray(list) || list.length === 0) return null
  const out = list.map((n) => String(n ?? '').trim()).filter(Boolean)
  return out.length > 0 ? out : null
}

function slimStation(s) {
  const o = { station_id: s.station_id, station_name: s.station_name, vn_kv: s.vn_kv }
  if (s.lon != null && s.lon !== '') o.lon = Number(s.lon)
  if (s.lat != null && s.lat !== '') o.lat = Number(s.lat)
  const busNames = slimStringList(s.bus_name_list)
  if (busNames) o.bus_name_list = busNames
  const trafoNames = slimStringList(s.trafo_name_list)
  if (trafoNames) o.trafo_name_list = trafoNames
  if (Array.isArray(s.trafo_display_list) && s.trafo_display_list.length > 0) {
    o.trafo_display_list = s.trafo_display_list.map(slimTrafoDisplayRow).filter((r) => Object.keys(r).length > 0)
  }
  return o
}

function slimLine(ld) {
  const o = {}
  if (ld.name != null && ld.name !== '') o.name = ld.name
  if (ld.from_bus_name != null && String(ld.from_bus_name).trim() !== '') {
    o.from_bus_name = String(ld.from_bus_name).trim()
  }
  if (ld.to_bus_name != null && String(ld.to_bus_name).trim() !== '') {
    o.to_bus_name = String(ld.to_bus_name).trim()
  }
  if (ld.in_service != null) o.in_service = ld.in_service
  if (ld.p_from_mw != null && !Number.isNaN(Number(ld.p_from_mw))) o.p_from_mw = Number(ld.p_from_mw)
  if (ld.q_from_mvar != null && !Number.isNaN(Number(ld.q_from_mvar))) o.q_from_mvar = Number(ld.q_from_mvar)
  if (ld.type != null && String(ld.type).trim() !== '') o.type = String(ld.type).trim()
  const numericKeys = [
    'r_ohm_per_km',
    'x_ohm_per_km',
    'g_us_per_km',
    'c_nf_per_km',
    'max_i_ka',
    'length_km',
  ]
  numericKeys.forEach((key) => {
    const v = ld[key]
    if (v != null && v !== '' && !Number.isNaN(Number(v))) o[key] = Number(v)
  })
  return o
}

function slimSwitch(sw) {
  const o = {}
  if (sw?.name != null && String(sw.name).trim() !== '') o.name = String(sw.name).trim()
  if (sw && Object.prototype.hasOwnProperty.call(sw, 'closed')) o.closed = sw.closed
  return o
}

function slimChannel(c) {
  return {
    from_station: c.from_station,
    to_station: c.to_station,
    min_vn_kv: c.min_vn_kv,
    line_data: Array.isArray(c.line_data) ? c.line_data.map(slimLine) : [],
    switch_data: Array.isArray(c.switch_data) ? c.switch_data.map(slimSwitch) : [],
  }
}

/** 判断载荷是否像接口全量（含大量未成图字段） */
export function shouldSlimLiaisonPayload(data, thresholdBytes = 512 * 1024) {
  const d = data && typeof data === 'object' ? data : {}
  if (Array.isArray(d.show_station_list) && d.show_station_list.length > 0) return true
  if (Array.isArray(d.show_station_data) && d.show_station_data.length > 0) return true
  const stations = Array.isArray(d.station_data) ? d.station_data : []
  if (stations.length > 200) return true
  const s0 = stations[0]
  if (s0 && (Array.isArray(s0.bus_id_list) || Array.isArray(s0.trafo_id_list))) return true
  const channels = Array.isArray(d.channel_data) ? d.channel_data : []
  const l0 = channels[0]?.line_data?.[0]
  if (l0 && (l0.r_ohm_per_km != null || Array.isArray(l0.timeseries))) return true
  return estimateLiaisonPayloadBytes(d) > thresholdBytes
}

/** 估算 JSON 载荷体积（小文件兜底） */
export function estimateLiaisonPayloadBytes(data) {
  if (!data || typeof data !== 'object') return 0
  try {
    return new TextEncoder().encode(JSON.stringify(data)).length
  } catch {
    const stations = Array.isArray(data.station_data) ? data.station_data.length : 0
    const channels = Array.isArray(data.channel_data) ? data.channel_data.length : 0
    return stations * 2500 + channels * 1200
  }
}

/** 全量接口 data → 成图用精简 data */
export function slimLiaisonDataPayload(data) {
  const d = data && typeof data === 'object' ? data : {}
  const rawStations = Array.isArray(d.station_data) ? d.station_data : []
  const rawChannels = Array.isArray(d.channel_data) ? d.channel_data : []
  const terminalVirtualTIds = computeTerminalVirtualTStationIds(rawStations, rawChannels)
  const slimStationsAll = rawStations.map(slimStation)
  const stationsDraw = slimStationsAll.filter(
    (s) =>
      s.station_id &&
      normalizeKV(s.vn_kv) >= 35 &&
      !isExternalBoundaryStation(s.station_name) &&
      !terminalVirtualTIds.has(s.station_id)
  )
  const keptIds = new Set(stationsDraw.map((s) => s.station_id))

  const slimChannelsAll = rawChannels.map(slimChannel)
  const channelsDraw = slimChannelsAll.filter((c) => {
    const minKV = Number(c.min_vn_kv || 0)
    if (minKV < 35) return false
    if (channelHasTerminalVirtualT(c, terminalVirtualTIds)) return false
    if (!keptIds.has(c.from_station) || !keptIds.has(c.to_station)) return false
    return true
  })

  return {
    station_data: stationsDraw,
    channel_data: channelsDraw,
  }
}

/**
 * 规范化联络 JSON 信封；大文件自动裁剪字段与过滤低压站。
 * @param {object} raw
 * @param {{ forceSlim?: boolean, slimThresholdBytes?: number }} [opts]
 */
export function normalizeAndSlimLiaisonEnvelope(raw, opts = {}) {
  const o = raw && typeof raw === 'object' ? raw : {}
  const data = o.data && typeof o.data === 'object' ? o.data : {}
  const threshold = opts.slimThresholdBytes != null ? opts.slimThresholdBytes : 512 * 1024
  const needSlim = opts.forceSlim || shouldSlimLiaisonPayload(data, threshold)

  const slimmedData = needSlim ? slimLiaisonDataPayload(data) : {
    station_data: Array.isArray(data.station_data) ? data.station_data : [],
    channel_data: Array.isArray(data.channel_data) ? data.channel_data : [],
  }

  return {
    code: o.code != null ? o.code : 1,
    message: o.message != null ? String(o.message) : '',
    data: slimmedData,
    _slimmed: needSlim,
  }
}
