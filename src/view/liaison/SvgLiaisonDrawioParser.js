import GraphTool from '@/plugins/tmzx/graph/GraphTool.js'
import { isExternalBoundaryStation } from './SvgLiaisonJsonSlim.js'

function normalizeKV(value) {
  return Math.round(Number(value || 0))
}

/** 230kV 视同 220kV，115kV 视同 110kV，525kV 视同 500kV（normalizeKV + 阈值） */
const KV1000 = '#0000FF'
const KV1000_STROKE = '#0000CC'
const KV500 = '#FF0000'
const KV500_STROKE = '#CC0000'
const KV220 = '#50007F'
const KV220_STROKE = '#3d0060'
const KV110 = '#F04155'
const KV110_STROKE = '#c03548'
const KV35 = '#FFFF00'
const KV35_STROKE = '#b8b800'
/** 站内主变、线路 P/Q 等量测数字颜色 */
const LIAISON_MEASUREMENT_COLOR = '#9CF0F2'

/** 电压分档：5=1000kV，4=500kV，3=220kV，2=110kV，1=35kV */
function voltageTier(kv) {
  const k = normalizeKV(kv)
  if (k >= 800) return 5
  if (k >= 500) return 4
  if (k >= 220) return 3
  if (k >= 110) return 2
  return 1
}

function stationFillColorByTier(tier) {
  if (tier === 5) return KV1000
  if (tier === 4) return KV500
  if (tier === 3) return KV220
  if (tier === 2) return KV110
  return KV35
}

function stationStrokeColorByKV(kv) {
  const k = normalizeKV(kv)
  if (k >= 800) return KV1000_STROKE
  if (k >= 500) return KV500_STROKE
  if (k >= 220) return KV220_STROKE
  if (k >= 110) return KV110_STROKE
  return KV35_STROKE
}

/** 收窄站房宽高比：略减宽、略增高 */
function applyStationBoxAspectAdjust(w, h) {
  return { w: Math.round(w * 0.85), h: Math.round(h * 1.1) }
}

/** 站房默认外廓（逻辑 px）：各档先收窄宽高比；1000kV ×1.5×0.8，500kV ×2×0.8，其余不变 */
function stationBoxSizeByKV(kv) {
  const k = normalizeKV(kv)
  if (k >= 800) {
    const { w, h } = applyStationBoxAspectAdjust(160, 80)
    return { w: Math.round(w * 1.5 * 0.8), h: Math.round(h * 1.5 * 0.8) }
  }
  if (k >= 500) {
    const { w, h } = applyStationBoxAspectAdjust(140, 70)
    return { w: Math.round(w * 2 * 0.8), h: Math.round(h * 2 * 0.8) }
  }
  if (k >= 220) return applyStationBoxAspectAdjust(120, 60)
  if (k >= 110) return applyStationBoxAspectAdjust(100, 50)
  return applyStationBoxAspectAdjust(80, 40)
}

function stationTitleFontPx(kv) {
  const k = normalizeKV(kv)
  if (k >= 800) return 32
  if (k >= 500) return 30
  if (k >= 220) return 20
  if (k >= 110) return 18
  return 14
}

/** 主变量测字号：随站名字号等比适配 */
function stationTrafoFontPx(kv) {
  return Math.max(6, Math.round(stationTitleFontPx(kv) * 0.36))
}

/** 站名与主变量测间隔：随字号与站高适配，不用固定 px */
function stationNameTrafoGapPx(kv) {
  const titlePx = stationTitleFontPx(kv)
  const { h } = stationBoxSizeByKV(kv)
  return Math.max(2, Math.round(titlePx * 0.22 + h * 0.012))
}

function stationStyleFontPx(kv, trafoLabel) {
  if (trafoLabel) return String(stationTrafoFontPx(kv))
  return String(stationTitleFontPx(kv))
}

function shortStationName(name) {
  const raw = String(name || '')
  const parts = raw.split('.')
  return parts[parts.length - 1] || raw || '未知站'
}

/** 站房图形内展示用短名：去掉「储能电站」「风电场」「电场」「站」后缀；侧栏/JSON 等仍用 shortStationName */
function stationGraphLabelName(name) {
  let label = shortStationName(name)
  if (label.endsWith('储能电站')) {
    label = label.slice(0, -'储能电站'.length)
  } else if (label.endsWith('风电场')) {
    label = label.slice(0, -'风电场'.length)
  } else if (label.endsWith('电场')) {
    label = label.slice(0, -'电场'.length)
  } else if (label.endsWith('站')) {
    label = label.slice(0, -1)
  }
  label = label.trim()
  return label || shortStationName(name)
}

/** 名称含 T+数字（如 T1、T2、T10）的虚拟站：与 110kV 同尺寸的虚线空心矩形母线框；内有文字（有标签时为短名，无标签时为「T+数字」） */
function isVirtualT10Station(name) {
  const str = String(name || '')
  return /T\d+/i.test(str)
}

/** 站房尺寸由算法/JSON 决定，禁止在画布上拉伸 */
const LIAISON_STATION_NO_RESIZE = 'resizable=0;rotatable=0;'

function virtualT10StationStyle(kv) {
  const stroke = stationStrokeColorByKV(kv)
  return `${LIAISON_STATION_NO_RESIZE}shape=ellipse;aspect=fixed;whiteSpace=wrap;html=1;fillColor=${stroke};strokeColor=${stroke};strokeWidth=1;fontColor=#ffffff;fontSize=10;fontStyle=1;align=center;verticalAlign=middle;`
}

/** T 虚拟站按母线展开后的圆点尺寸（逻辑 pt） */
const T10_BUS_NODE_SIZE = 32

function busNodeStyle(kv) {
  const stroke = stationStrokeColorByKV(kv)
  const fill = normalizeKV(kv) >= 110 ? stroke : KV35
  return `${LIAISON_STATION_NO_RESIZE}shape=ellipse;aspect=fixed;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};strokeWidth=1.5;fontColor=#ffffff;fontSize=0;align=center;verticalAlign=middle;`
}

function normalizeBusName(name) {
  return String(name || '').trim()
}

function busKeyFromName(busName) {
  const n = normalizeBusName(busName)
  const parts = n.split('.')
  return parts[parts.length - 1] || n
}

function parseBusNameList(rawStation) {
  const list = rawStation?.bus_name_list
  if (!Array.isArray(list) || list.length === 0) return []
  return list.map(normalizeBusName).filter(Boolean)
}

function collectBusNamesFromChannels(stationId, channels) {
  const set = new Set()
  channels.forEach((ch) => {
    const lines = Array.isArray(ch.line_data) ? ch.line_data : []
    lines.forEach((line) => {
      if (ch.from_station === stationId && line?.from_bus_name) {
        set.add(normalizeBusName(line.from_bus_name))
      }
      if (ch.to_station === stationId && line?.to_bus_name) {
        set.add(normalizeBusName(line.to_bus_name))
      }
    })
  })
  return [...set].sort()
}

function resolveT10BusNames(rawStation, stationId, channels) {
  const fromList = parseBusNameList(rawStation)
  if (fromList.length > 0) return fromList
  return collectBusNamesFromChannels(stationId, channels)
}

function createBusLayoutNode(parentStation, busName) {
  const busKey = busKeyFromName(busName)
  return {
    id: `busnode:${parentStation.id}:${busKey}`,
    stationId: parentStation.id,
    busName,
    busKey,
    name: busKey,
    kv: parentStation.kv,
    lon: parentStation.lon,
    lat: parentStation.lat,
    w: T10_BUS_NODE_SIZE,
    h: T10_BUS_NODE_SIZE,
    isBusNode: true,
    isVirtual: true,
    parentStationName: parentStation.name,
  }
}

/**
 * 将 T 开头虚拟站按母线拆成独立布局节点，参与全局 BFS 环布局（不再聚簇）。
 */
function prepareLayoutGraph(stations, rawStationById, channels) {
  const layoutNodes = []
  const virtualStationIds = new Set()
  const busNodeByStationAndName = new Map()
  const stationById = new Map(stations.map((s) => [s.id, s]))

  stations.forEach((s) => {
    if (isVirtualT10Station(s.name)) {
      virtualStationIds.add(s.id)
      s.isVirtual = true
      const raw = rawStationById.get(s.id)
      let busNames = resolveT10BusNames(raw, s.id, channels)
      if (busNames.length === 0) {
        busNames = [`${raw?.station_name || s.name}.bus`]
      }
      busNames.forEach((busName) => {
        const bn = createBusLayoutNode(s, busName)
        layoutNodes.push(bn)
        busNodeByStationAndName.set(`${s.id}::${normalizeBusName(bn.busName)}`, bn)
        busNodeByStationAndName.set(`${s.id}::${bn.busKey}`, bn)
      })
      return
    }
    const { w: baseW, h: baseH } = stationBoxSizeByKV(s.kv)
    s.w = baseW + trafoExtraWidthPx(s.trafoRows, baseW)
    s.h = baseH + trafoExtraHeightPx(s.trafoRows)
    s.isVirtual = false
    layoutNodes.push(s)
  })

  return { layoutNodes, busNodeByStationAndName, virtualStationIds, stationById }
}

function buildLayoutEdges(channelEntries, stationById, busNodeByStationAndName, virtualStationIds) {
  const edgeSet = new Set()
  const edges = []
  channelEntries.forEach(({ channel }) => {
    const fromSt = stationById.get(channel.from_station)
    const toSt = stationById.get(channel.to_station)
    if (!fromSt || !toSt) return
    const lines = Array.isArray(channel.line_data) && channel.line_data.length > 0 ? channel.line_data : [null]
    lines.forEach((line) => {
      let fromEp = fromSt
      let toEp = toSt
      if (virtualStationIds.has(channel.from_station)) {
        fromEp = resolveRouteEndpoint(fromSt, line?.from_bus_name, busNodeByStationAndName, virtualStationIds)
      }
      if (virtualStationIds.has(channel.to_station)) {
        toEp = resolveRouteEndpoint(toSt, line?.to_bus_name, busNodeByStationAndName, virtualStationIds)
      }
      const fromId = fromEp?.id
      const toId = toEp?.id
      if (!fromId || !toId || fromId === toId) return
      const key = [fromId, toId].sort().join('__')
      if (edgeSet.has(key)) return
      edgeSet.add(key)
      edges.push({ from: fromId, to: toId })
    })
  })
  return edges
}

function resolveRouteEndpoint(station, busName, busNodeByStationAndName, virtualStationIds) {
  if (!station || !virtualStationIds?.has(station.id)) return station
  const key = `${station.id}::${normalizeBusName(busName || '')}`
  const byFull = busNodeByStationAndName.get(key)
  if (byFull) return byFull
  const byKey = busNodeByStationAndName.get(`${station.id}::${busKeyFromName(busName)}`)
  if (byKey) return byKey
  const fallback = [...busNodeByStationAndName.entries()].find(([k]) => k.startsWith(`${station.id}::`))?.[1]
  return fallback || station
}

function pickLinePFromMw(line) {
  const v = line?.p_from_mw
  if (v != null && !Number.isNaN(Number(v))) return Number(v)
  return null
}

function pickLineQFromMvar(line) {
  const v = line?.q_from_mvar
  if (v != null && !Number.isNaN(Number(v))) return Number(v)
  return null
}

function expandChannelsToVisualLinks(
  channelEntries,
  stationById,
  busNodeByStationAndName,
  virtualStationIds,
  layoutNodeById
) {
  const visualLinks = []
  channelEntries.forEach(({ channel, docChannelIndex }) => {
    const fromSt = stationById.get(channel.from_station)
    const toSt = stationById.get(channel.to_station)
    if (!fromSt || !toSt) return

    const lines = Array.isArray(channel.line_data) && channel.line_data.length > 0 ? channel.line_data : [null]
    const fromIsVirtual = virtualStationIds.has(channel.from_station)
    const toIsVirtual = virtualStationIds.has(channel.to_station)

    const pushLink = (lineItem, lineIndex) => {
      const fromBus = lineItem?.from_bus_name
      const toBus = lineItem?.to_bus_name
      visualLinks.push({
        channel,
        docChannelIndex,
        lineIndex,
        lineItem,
        fromEndpoint: fromIsVirtual
          ? resolveRouteEndpoint(fromSt, fromBus, busNodeByStationAndName, virtualStationIds)
          : layoutNodeById?.get(channel.from_station) || fromSt,
        toEndpoint: toIsVirtual
          ? resolveRouteEndpoint(toSt, toBus, busNodeByStationAndName, virtualStationIds)
          : layoutNodeById?.get(channel.to_station) || toSt,
        fromStation: fromSt,
        toStation: toSt,
      })
    }

    if (lines.length > 1 || fromIsVirtual || toIsVirtual) {
      lines.forEach((lineItem, lineIndex) => pushLink(lineItem, lineIndex))
      return
    }
    pushLink(lines[0], 0)
  })
  return visualLinks
}

function visualLinkCellSuffix(docChannelIndex, lineIndex, splitCount) {
  return splitCount > 1 ? `${docChannelIndex}:${lineIndex}` : String(docChannelIndex)
}

function channelLineSplitCount(channel) {
  const n = Array.isArray(channel?.line_data) ? channel.line_data.length : 0
  return n > 1 ? n : 1
}

/** 拆线通道每条 visual link 各一组开关；单线通道仍为 sw:N:from/to */
function channelSwitchSuffix(docChannelIndex, lineIndex = 0, splitCount = 1) {
  return splitCount > 1 ? `${docChannelIndex}:${lineIndex}` : String(docChannelIndex)
}

function buildValidChannelSwitchIds(channels) {
  const valid = new Set()
  const list = Array.isArray(channels) ? channels : []
  for (let docIdx = 0; docIdx < list.length; docIdx++) {
    const splitCount = channelLineSplitCount(list[docIdx])
    const lineCount = splitCount > 1 ? splitCount : 1
    for (let li = 0; li < lineCount; li++) {
      const key = channelSwitchSuffix(docIdx, li, splitCount)
      valid.add(`sw:${key}:from`)
      valid.add(`sw:${key}:to`)
    }
  }
  return valid
}

/** 解析画布通道 id 后缀，如 `5` 或 `5:2` → 文档通道下标与 line_data 行号 */
function parseGraphChannelSuffix(suffix) {
  const s = String(suffix || '').trim()
  if (!s) return null
  const m = s.match(/^(\d+)(?::(\d+))?$/)
  if (!m) return null
  const docChannelIndex = Number(m[1])
  const lineIndex = m[2] != null ? Number(m[2]) : 0
  if (Number.isNaN(docChannelIndex) || docChannelIndex < 0) return null
  if (Number.isNaN(lineIndex) || lineIndex < 0) return null
  return { docChannelIndex, lineIndex, suffix: s }
}

/** 从 liaison / liaison-name / liaison-pq / liaison-j-* 等 cell id 提取通道后缀 */
function parseLiaisonGraphCellSuffix(cellId) {
  const id = String(cellId || '')
  const m = id.match(/^liaison(?:-name|-pq|-j-from|-j-to)?:(.+)$/)
  if (m) return m[1]
  if (id.startsWith('liaison:')) return id.slice('liaison:'.length)
  return null
}

function pickChannelLineItem(channel, lineIndex) {
  const lines = channel?.line_data
  if (!Array.isArray(lines) || lines.length === 0) return null
  if (lineIndex >= 0 && lineIndex < lines.length) return lines[lineIndex]
  return lines[0]
}

function buildLineEntityInfoFromChannel(
  channel,
  docChannelIndex,
  lineIndex,
  stationNameById,
  rawStationById
) {
  const from = rawStationById.get(channel.from_station)
  const to = rawStationById.get(channel.to_station)
  const fromKv = normalizeKV(from?.vn_kv)
  const toKv = normalizeKV(to?.vn_kv)
  const lineItem = pickChannelLineItem(channel, lineIndex)
  const pFromMw = lineItem ? pickLinePFromMw(lineItem) : pickChannelPFromMw(channel)
  const qFromMvar = lineItem ? pickLineQFromMvar(lineItem) : pickChannelQFromMvar(channel)
  return {
    type: 'line',
    doc_channel_index: docChannelIndex,
    line_index: lineIndex,
    channel_name: channel.channel_name,
    from_station: channel.from_station,
    to_station: channel.to_station,
    from_station_name: stationNameById.get(channel.from_station),
    to_station_name: stationNameById.get(channel.to_station),
    from_bus_name: lineItem?.from_bus_name || null,
    to_bus_name: lineItem?.to_bus_name || null,
    link_color: linkStrokeColor(fromKv, toKv),
    link_width_px: linkStrokeWidthPx(fromKv, toKv),
    from_kv: fromKv,
    to_kv: toKv,
    min_vn_kv: channel.min_vn_kv,
    max_vn_kv: channel.max_vn_kv,
    p_from_mw: pFromMw,
    q_from_mvar: qFromMvar,
    line_data: lineItem ? [lineItem] : channel.line_data || [],
    switch_data: channel.switch_data || [],
    raw: channel,
  }
}

function buildSidePortTotalsForEndpoints(visualLinks) {
  const totals = new Map()
  visualLinks.forEach((link) => {
    const from = link.fromEndpoint
    const to = link.toEndpoint
    const sides = pickSidesFacingPeer(
      { x: from.x + from.w / 2, y: from.y + from.h / 2 },
      { x: to.x + to.w / 2, y: to.y + to.h / 2 }
    )
    const kFrom = `${from.id}:${sides.from}`
    const kTo = `${to.id}:${sides.to}`
    totals.set(kFrom, (totals.get(kFrom) || 0) + 1)
    totals.set(kTo, (totals.get(kTo) || 0) + 1)
  })
  return totals
}

function buildSidePortRankForEndpoints(visualLinks) {
  const buckets = new Map()
  visualLinks.forEach((link, linkIdx) => {
    const from = link.fromEndpoint
    const to = link.toEndpoint
    const sides = pickSidesFacingPeer(
      { x: from.x + from.w / 2, y: from.y + from.h / 2 },
      { x: to.x + to.w / 2, y: to.y + to.h / 2 }
    )
    const kFrom = `${from.id}:${sides.from}`
    const kTo = `${to.id}:${sides.to}`
    const sortFrom = remotePrimaryForPortOrder(to, sides.from)
    const sortTo = remotePrimaryForPortOrder(from, sides.to)
    if (!buckets.has(kFrom)) buckets.set(kFrom, [])
    if (!buckets.has(kTo)) buckets.set(kTo, [])
    buckets.get(kFrom).push({ linkIdx, sortKey: sortFrom })
    buckets.get(kTo).push({ linkIdx, sortKey: sortTo })
  })
  const rankMap = new Map()
  buckets.forEach((items, key) => {
    items.sort((a, b) => {
      if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey
      return a.linkIdx - b.linkIdx
    })
    items.forEach((it, rank) => {
      rankMap.set(`${it.linkIdx}@@${key}`, rank)
    })
  })
  return rankMap
}

/** 开关沿出线第一段距出线点（连接块中心）的弧长，模型坐标 pt */
const SWITCH_DISTANCE_FROM_EXIT_PT = 28
/** 距首拐角预留，避免压在拐角上；首段过短时 dist 会小于 24 */
const SWITCH_RESERVE_BEFORE_CORNER_PT = 6

/** 出线点 → 首拐点方向，距出线点固定 SWITCH_DISTANCE_FROM_EXIT_PT（或夹在近拐角侧） */
function computeSwitchPointOnFirstLeg(source, firstTurn) {
  const dx = firstTurn.x - source.x
  const dy = firstTurn.y - source.y
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const dist = Math.min(SWITCH_DISTANCE_FROM_EXIT_PT, Math.max(4, len - SWITCH_RESERVE_BEFORE_CORNER_PT))
  return {
    x: source.x + (dx / len) * dist,
    y: source.y + (dy / len) * dist,
  }
}

/** 首段近竖直时长边顺线（8×14），近水平时 14×8；几何中心对齐 switchPoint */
function switchRectAlongFirstLeg(source, firstTurn) {
  const dx = firstTurn.x - source.x
  const dy = firstTurn.y - source.y
  const vertical = Math.abs(dy) >= Math.abs(dx)
  if (vertical) {
    return { w: 8, h: 14, ox: -4, oy: -7 }
  }
  return { w: 14, h: 8, ox: -7, oy: -4 }
}

/** 无 `switch_data` 时，用 `line_data` 的 in_service 推断默认（单端）开关是否合闸展示 */
function pickSwitchStateFallbackFromLines(channel) {
  const lines = Array.isArray(channel.line_data) ? channel.line_data : []
  if (lines.length === 0) return false
  return lines.some((item) => item?.in_service !== false)
}

/**
 * 本通道要绘制的开关列表。
 * - `switch_data` ≥2：约定依次为 **送端**（近 from_station 出线）、**受端**（近 to_station 出线）。
 * - `switch_data` 为 1：仅送端（与旧版一致）。
 * - 无开关数据：仍绘一个送端占位，合闸态由 `line_data.in_service` 推断。
 */
function buildChannelSwitchSpecs(channel) {
  const switches = Array.isArray(channel.switch_data) ? channel.switch_data : []
  if (switches.length >= 2) {
    return [
      { end: 'from', item: switches[0], closed: switches[0]?.closed !== false },
      { end: 'to', item: switches[1], closed: switches[1]?.closed !== false },
    ]
  }
  if (switches.length === 1) {
    return [{ end: 'from', item: switches[0], closed: switches[0]?.closed !== false }]
  }
  return [{ end: 'from', item: null, closed: pickSwitchStateFallbackFromLines(channel) }]
}

/** 潮流判断：对通道 line_data 内 p_from_mw 求和；无有效数据返回 null */
const FLOW_P_EPS = 1e-9

function primaryLineNameFromChannel(channel) {
  const ld = channel?.line_data
  if (!Array.isArray(ld) || ld.length === 0) return ''
  return String(ld[0]?.name || '').trim()
}

function parseLineLabelFromCell(graph, cell) {
  if (!graph || !cell) return ''
  let s = ''
  if (typeof graph.convertValueToString === 'function') {
    s = graph.convertValueToString(cell) || ''
  } else {
    const v = graph.getModel?.()?.getValue(cell)
    s = typeof v === 'string' ? v : ''
  }
  return String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

/** 点到矩形边框的最短距离（模型坐标） */
function pointDistToRect(px, py, geo) {
  if (!geo) return Infinity
  const dx = Math.max(geo.x - px, 0, px - (geo.x + geo.width))
  const dy = Math.max(geo.y - py, 0, py - (geo.y + geo.height))
  return Math.sqrt(dx * dx + dy * dy)
}

function pickChannelPFromMw(channel) {
  const lines = channel?.line_data
  if (!Array.isArray(lines) || lines.length === 0) return null
  let sum = 0
  let any = false
  for (let i = 0; i < lines.length; i++) {
    const v = lines[i]?.p_from_mw
    if (v != null && !Number.isNaN(Number(v))) {
      sum += Number(v)
      any = true
    }
  }
  return any ? sum : null
}

function pickChannelQFromMvar(channel) {
  const lines = channel?.line_data
  if (!Array.isArray(lines) || lines.length === 0) return null
  let sum = 0
  let any = false
  for (let i = 0; i < lines.length; i++) {
    const v = lines[i]?.q_from_mvar
    if (v != null && !Number.isNaN(Number(v))) {
      sum += Number(v)
      any = true
    }
  }
  return any ? sum : null
}

function escapeHtmlLabel(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatMwMvarNumber(v) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  const n = Math.round(Number(v) * 1000) / 1000
  return String(n)
}

/** 站内主变展示：`station_data[].trafo_display_list`（可选）；图上不展示名称；多台横向并排，每台内 P 在上、Q 在下 */
/** 成图时最多展示的主变 P/Q 列数，避免多台主变撑宽站房 */
const LIAISON_TRAFO_GRAPH_DISPLAY_MAX = 2

function parseTrafoDisplayListFromRaw(item) {
  const list = item?.trafo_display_list
  if (!Array.isArray(list) || list.length === 0) return []
  return list.map((row) => {
    const p = row?.p_mw
    const q = row?.q_mvar
    const pNum = p != null && !Number.isNaN(Number(p)) ? Number(p) : null
    const qNum = q != null && !Number.isNaN(Number(q)) ? Number(q) : null
    return { p: pNum, q: qNum }
  })
}

/** 成图标签与站框加宽：仅取前 N 台主变量测 */
function trafoRowsForGraphDisplay(item) {
  return parseTrafoDisplayListFromRaw(item).slice(0, LIAISON_TRAFO_GRAPH_DISPLAY_MAX)
}

function trafoExtraWidthPx(rows, baseW) {
  if (!rows?.length) return 0
  const col = 34
  const gap = 10
  const pad = 12
  const need = rows.length * col + Math.max(0, rows.length - 1) * gap + pad
  if (need <= baseW) return 0
  return Math.min(need - baseW, 100)
}

/** 主变数据不增加站房默认高宽：靠紧凑 HTML + 单元格较小 fontSize 避免标签预留区过大；列数多时再按需加宽 */
function trafoExtraHeightPx(rows) {
  if (!rows?.length) return 0
  return 0
}

function stationInnerLabelColor(kv) {
  return normalizeKV(kv) >= 110 ? '#ffffff' : '#1e293b'
}

/**
 * 站房标签：不展示电压档位；`trafo_display_list` 时在站名下方小字展示：多台主变**横向并排**，每台内 **P 与 Q 上下排列**（不展示主变名，无单位）。
 * 站名与量测在站形内水平、垂直居中，间隔随电压档适配。
 * @returns {{ html: string, topAlign: boolean }}
 */
function buildStationVertexLabelHtml(s, showLabels) {
  if (!showLabels) {
    if (s.isVirtual) {
      const match = String(s.name || '').match(/T\d+/i)
      const label = match ? match[0] : 'T10'
      return { html: label, topAlign: false }
    }
    return { html: '', topAlign: false }
  }
  if (s.isVirtual) {
    const ne = escapeHtmlLabel(stationGraphLabelName(s.name))
    return {
      html: `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:100%;box-sizing:border-box;text-align:center;font-size:11px;font-weight:700;color:#ffffff;line-height:1;">${ne}</div>`,
      topAlign: false,
    }
  }
  const color = stationInnerLabelColor(s.kv)
  const rows = s.trafoRows || []
  const titlePx = stationTitleFontPx(s.kv)
  const nameEsc = escapeHtmlLabel(stationGraphLabelName(s.name))
  const nameBlock = `<div style="font-size:${titlePx}px;font-weight:700;line-height:1;margin:0;padding:0;color:${color};">${nameEsc}</div>`
  if (rows.length === 0) {
    return {
      html: `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:100%;box-sizing:border-box;text-align:center;line-height:0;font-size:0;">${nameBlock}</div>`,
      topAlign: false,
    }
  }
  const trafoPx = stationTrafoFontPx(s.kv)
  const gapPx = stationNameTrafoGapPx(s.kv)
  const colGapX = Math.round(trafoPx * 0.95)
  const colGapY = Math.round(trafoPx * 0.45)
  const colStyle = `display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:${trafoPx}px;font-weight:600;line-height:1;color:${LIAISON_MEASUREMENT_COLOR};`
  const columns = rows
    .map((r) => {
      const ps = formatMwMvarNumber(r.p)
      const qs = formatMwMvarNumber(r.q)
      return `<div style="${colStyle}"><div style="line-height:1;">${ps}</div><div style="line-height:1;">${qs}</div></div>`
    })
    .join('')
  const trafoRow = `<div style="display:flex;flex-direction:row;justify-content:center;align-items:center;flex-wrap:wrap;gap:${colGapY}px ${colGapX}px;margin:0;padding:0;line-height:0;font-size:0;">${columns}</div>`
  return {
    html: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;min-height:100%;box-sizing:border-box;gap:${gapPx}px;text-align:center;margin:0;padding:0;line-height:0;font-size:0;">
${nameBlock}
${trafoRow}
</div>`,
    topAlign: false,
  }
}

/** 有功/无功合并块：线路法线一侧，仅数字两行、无 P/Q 与单位 */
const PQ_BLOCK_W = 52
const PQ_BLOCK_H = 34

/**
 * 法线方向偏移量：须大于标签在法向上的半边尺寸，否则竖向导线仍会横穿横向文字、横向导线横穿竖排文字。
 * 竖线段 → 法线近似水平 → 用块半宽；横线段 → 法线近似竖直 → 用块半高。
 */
function perpendicularOffsetForPQ(dx, dy) {
  const adx = Math.abs(dx)
  const ady = Math.abs(dy)
  if (ady >= adx) {
    return PQ_BLOCK_W / 2 + 4
  }
  return PQ_BLOCK_H / 2 + 6
}

/** 取折线中最长线段中点，沿法线单侧放置 P/Q 合并块（左上角） */
function computeLongestSegmentPQBlockPosition(route) {
  const pts = [route.source, ...route.points, route.target]
  let bestI = 0
  let bestLen = -1
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const L = Math.hypot(b.x - a.x, b.y - a.y)
    if (L > bestLen) {
      bestLen = L
      bestI = i
    }
  }
  if (bestLen < 1e-6) return null
  const a = pts[bestI]
  const b = pts[bestI + 1]
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const off = perpendicularOffsetForPQ(dx, dy)
  const cx = mx + nx * off
  const cy = my + ny * off
  return {
    x: cx - PQ_BLOCK_W / 2,
    y: cy - PQ_BLOCK_H / 2,
    w: PQ_BLOCK_W,
    h: PQ_BLOCK_H,
  }
}

/** 同一站对之间多条联络线时，折线通道上下错开；仅一条时为 0 */
function pairLaneOffset(pairEdgeIndex) {
  if (pairEdgeIndex === 0) return 0
  const step = 44
  const rank = Math.floor((pairEdgeIndex - 1) / 2) + 1
  return (pairEdgeIndex % 2 === 1 ? 1 : -1) * rank * step
}

/** 同一 channel 拆成多条线时（目前最多 2 条），主干/端口用更小步长，使双线贴近 */
const INTRA_CHANNEL_LANE_STEP = 14
const INTRA_CHANNEL_PORT_STEP = 10

function intraChannelLaneOffset(lineIndex, splitCount) {
  if (splitCount <= 1) return 0
  const center = (splitCount - 1) / 2
  return (lineIndex - center) * INTRA_CHANNEL_LANE_STEP
}

function portOffsetIntraChannelLine(lineIndex, splitCount) {
  if (splitCount <= 1) return 0
  const center = (splitCount - 1) / 2
  return (lineIndex - center) * INTRA_CHANNEL_PORT_STEP
}

/** 同 channel 紧凑双线：仅适用于两个非虚拟实站之间；含虚拟站仍走常规错层 */
function useIntraChannelCompactSpacing(link) {
  if ((link?.splitCount ?? 1) <= 1) return false
  const fromSt = link.fromStation
  const toSt = link.toStation
  if (!fromSt || !toSt) return false
  return !fromSt.isVirtual && !toSt.isVirtual
}

function visualLinkSplitRouteOpts(link) {
  if (!useIntraChannelCompactSpacing(link)) return null
  return { splitCount: link.splitCount, lineIndex: link.lineIndex ?? 0 }
}

function portOffsetForVisualLinkEndpoint(link, station, side, rank, total) {
  if (useIntraChannelCompactSpacing(link)) {
    return portOffsetIntraChannelLine(link.lineIndex ?? 0, link.splitCount)
  }
  return portOffsetDistributedOnSide(station, side, rank, total)
}

function laneIndexForVisualLink(link, pairLaneCounter) {
  if (useIntraChannelCompactSpacing(link)) {
    return link.lineIndex ?? 0
  }
  const pairKey = [link.fromEndpoint.id, link.toEndpoint.id].sort().join('__')
  const laneIndex = pairLaneCounter.get(pairKey) || 0
  pairLaneCounter.set(pairKey, laneIndex + 1)
  return laneIndex
}

/**
 * 不同站对之间若仍共线，用通道序号微调主干横/竖段，减轻叠线（链式拓扑常用）
 */
function channelTrunkStagger(channelIndex) {
  const step = 22
  const slot = channelIndex % 9
  return (slot - 4) * step
}

/** 同 channel 拆线时仍用全局 trunkStagger（与单线一致） */
function trunkStaggerForVisualLink(link, visualLinkIndex) {
  return channelTrunkStagger(visualLinkIndex)
}

/**
 * 进出侧：矩形站房上朝向对端中心的那条边（水平占优走左右，竖直占优走上下）。
 * 这样「对站在左侧」时终点落在左边框，而不会只因 |dy|≥|dx| 就强制走底边、首段贴底重叠。
 */
function pickSidesFacingPeer(fromCenter, toCenter) {
  const vx = toCenter.x - fromCenter.x
  const vy = toCenter.y - fromCenter.y
  const pick = (dx, dy) => {
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? 'right' : 'left'
    }
    return dy >= 0 ? 'bottom' : 'top'
  }
  const fromSide = pick(vx, vy)
  const wx = fromCenter.x - toCenter.x
  const wy = fromCenter.y - toCenter.y
  const toSide = pick(wx, wy)
  return { from: fromSide, to: toSide }
}

/** 预统计：每站每条边上会有几条联络线，用于沿边均匀分摊锚点（避免多条时固定步长穿出框体，如 T10 左侧多回线） */
function buildSidePortTotals(stationById, channels) {
  const totals = new Map()
  channels.forEach((channel) => {
    const from = stationById.get(channel.from_station)
    const to = stationById.get(channel.to_station)
    if (!from || !to) return
    const sides = pickSidesFacingPeer(
      { x: from.x + from.w / 2, y: from.y + from.h / 2 },
      { x: to.x + to.w / 2, y: to.y + to.h / 2 }
    )
    const kFrom = `${from.id}:${sides.from}`
    const kTo = `${to.id}:${sides.to}`
    totals.set(kFrom, (totals.get(kFrom) || 0) + 1)
    totals.set(kTo, (totals.get(kTo) || 0) + 1)
  })
  return totals
}

/**
 * 沿该边在「边长 − 2×边距」范围内均匀排布锚点（相对边中点的偏移）。
 * 左/右：offset 加在 y；顶/底：加在 x。index 为 0..total−1 按通道遍历顺序。
 */
function portOffsetDistributedOnSide(station, side, index, total) {
  const margin = 8
  const verticalEdge = side === 'left' || side === 'right'
  const len = verticalEdge ? station.h : station.w
  const span = Math.max(len - 2 * margin, 4)
  if (total <= 1) return 0
  const u = index / (total - 1)
  return -span / 2 + u * span
}

/** 左/右边：用对端站心 y；顶/底边：用对端站心 x。用于同边多回线排序，使端口上下与对端站空间关系一致、减轻折线交叉 */
function remotePrimaryForPortOrder(otherStation, side) {
  if (side === 'left' || side === 'right') {
    return otherStation.y + otherStation.h / 2
  }
  return otherStation.x + otherStation.w / 2
}

/**
 * 每条通道在 `站:边` 上的端口序号（0..n−1）：同边多线按对端站主坐标升序，
 * 使例如 T10 左侧「更靠画布上方的对端」优先接边顶点偏上，避免仅靠 JSON 顺序导致三线交叉。
 */
function buildSidePortRankByRemotePrimary(stationById, channels) {
  const buckets = new Map()
  channels.forEach((channel, channelIdx) => {
    const from = stationById.get(channel.from_station)
    const to = stationById.get(channel.to_station)
    if (!from || !to) return
    const sides = pickSidesFacingPeer(
      { x: from.x + from.w / 2, y: from.y + from.h / 2 },
      { x: to.x + to.w / 2, y: to.y + to.h / 2 }
    )
    const kFrom = `${from.id}:${sides.from}`
    const kTo = `${to.id}:${sides.to}`
    const sortFrom = remotePrimaryForPortOrder(to, sides.from)
    const sortTo = remotePrimaryForPortOrder(from, sides.to)
    if (!buckets.has(kFrom)) buckets.set(kFrom, [])
    if (!buckets.has(kTo)) buckets.set(kTo, [])
    buckets.get(kFrom).push({ channelIdx, sortKey: sortFrom })
    buckets.get(kTo).push({ channelIdx, sortKey: sortTo })
  })
  const rankMap = new Map()
  buckets.forEach((items, key) => {
    items.sort((a, b) => {
      if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey
      return a.channelIdx - b.channelIdx
    })
    items.forEach((it, rank) => {
      rankMap.set(`${it.channelIdx}@@${key}`, rank)
    })
  })
  return rankMap
}

function pointOnStation(station, side) {
  const x = station.x
  const y = station.y
  const w = station.w
  const h = station.h

  if (side === 'left') return { x, y: y + h / 2 }
  if (side === 'right') return { x: x + w, y: y + h / 2 }
  if (side === 'top') return { x: x + w / 2, y }
  return { x: x + w / 2, y: y + h }
}

/** T10 虚拟母线框：与实站一致按边出线；此前取圆心时与 100×50 框体不一致 */
function stationConnectionPoint(station, side, portOffset) {
  if (station.isVirtual) {
    const p = pointOnStation(station, side)
    if (side === 'left' || side === 'right') {
      p.y += portOffset
    } else {
      p.x += portOffset
    }
    return p
  }
  const p = pointOnStation(station, side)
  if (side === 'left' || side === 'right') {
    p.y += portOffset
  } else {
    p.x += portOffset
  }
  return p
}

/** 顶/底边上的 x 须落在框内，与 portOffsetDistributedOnSide 边距一致；对齐到对端 x 时先 clamp，避免端点被拽到站体外（人民 智明→T10 等） */
function clampXOnTopBottomEdge(station, side, x) {
  if (side !== 'top' && side !== 'bottom') return x
  const margin = 8
  const lo = station.x + margin
  const hi = station.x + station.w - margin
  if (lo > hi) return station.x + station.w / 2
  return Math.min(hi, Math.max(lo, x))
}

/**
 * 同一站对的第一条通道优先 L 形（单拐点），避免 Z 在纯水平联络上多余台阶。
 * 第二条及以后仍用 Z 形 + pairLaneOffset / trunkStagger 错层。
 *
 * L 的拐角必须与 **进出边** 一致：左/右出线应先水平离开，上/下边应先垂直离开；末段应垂直进入上/下边、水平进入左/右边。
 * 仅用站心 |Δy| vs |Δx| 选 L 会在「上/下边出线」时错误地先走水平段，线贴站底/顶或接到角上。
 * 上/下对上/下、左/右对左/右时，单拐点无法同时满足两端垂直/水平约束，首条通道也走 Z（与第二条同构，仅 offset 常为 0）。
 */
function buildOrthogonalRoute(
  fromStation,
  toStation,
  edgeIndex,
  sourcePortOffset = 0,
  targetPortOffset = 0,
  trunkStagger = 0,
  splitOpts = null
) {
  const fromCenter = { x: fromStation.x + fromStation.w / 2, y: fromStation.y + fromStation.h / 2 }
  const toCenter = { x: toStation.x + toStation.w / 2, y: toStation.y + toStation.h / 2 }
  const side = pickSidesFacingPeer(fromCenter, toCenter)
  const splitCount = splitOpts?.splitCount ?? 1
  const lineIndex = splitOpts?.lineIndex ?? 0
  const intraChannelSplit = splitCount > 1
  const offset = intraChannelSplit
    ? intraChannelLaneOffset(lineIndex, splitCount)
    : pairLaneOffset(edgeIndex)
  let source = stationConnectionPoint(fromStation, side.from, sourcePortOffset)
  let target = stationConnectionPoint(toStation, side.to, targetPortOffset)

  // 仅「上/下↔上/下」且 |Δx| 很小时微移虚拟端 x，消 Z 形短横段（如万科→T10）；阈值外保持边框锚点，避免远站线甩开母线框。
  // 不做「左/右↔左/右」下对虚拟端 y 的对齐：香樟→T10 等常与母线 y 差 <56px，会把端点拽到实站高度，线与 T10 框错位。
  const VIRTUAL_AXIS_ALIGN_MAX_PX = 56
  if (fromStation.isVirtual !== toStation.isVirtual) {
    const sLR = side.from === 'left' || side.from === 'right'
    const tLR = side.to === 'left' || side.to === 'right'
    if (!sLR && !tLR) {
      if (toStation.isVirtual && Math.abs(source.x - target.x) <= VIRTUAL_AXIS_ALIGN_MAX_PX) {
        target = { ...target, x: clampXOnTopBottomEdge(toStation, side.to, source.x) }
      } else if (fromStation.isVirtual && Math.abs(source.x - target.x) <= VIRTUAL_AXIS_ALIGN_MAX_PX) {
        source = { ...source, x: clampXOnTopBottomEdge(fromStation, side.from, target.x) }
      }
    }
  }

  const points = []
  const exitVerticalFirst = side.from === 'top' || side.from === 'bottom'
  const useFirstChannelSimpleRoute = intraChannelSplit || edgeIndex === 0
  const fromLR = side.from === 'left' || side.from === 'right'
  const toLR = side.to === 'left' || side.to === 'right'

  let verticalFirst
  if (useFirstChannelSimpleRoute) {
    if (fromLR && !toLR) {
      points.push({ x: target.x, y: source.y + offset })
      verticalFirst = false
    } else if (!fromLR && toLR) {
      points.push({ x: source.x + offset, y: target.y })
      verticalFirst = true
    } else if (!fromLR && !toLR) {
      verticalFirst = true
      const middleY = (source.y + target.y) / 2 + offset + trunkStagger
      points.push({ x: source.x, y: middleY }, { x: target.x, y: middleY })
    } else {
      verticalFirst = false
      const middleX = (source.x + target.x) / 2 + offset + trunkStagger
      points.push({ x: middleX, y: source.y }, { x: middleX, y: target.y })
    }
  } else if (exitVerticalFirst) {
    verticalFirst = true
    const middleY = (source.y + target.y) / 2 + offset + trunkStagger
    points.push({ x: source.x, y: middleY }, { x: target.x, y: middleY })
  } else {
    verticalFirst = false
    const middleX = (source.x + target.x) / 2 + offset + trunkStagger
    points.push({ x: middleX, y: source.y }, { x: middleX, y: target.y })
  }
  const firstTurn = points[0] || target
  const switchPoint = computeSwitchPointOnFirstLeg(source, firstTurn)

  return { source, target, points, switchPoint, verticalFirst, side }
}

function recomputeSwitchPoint(route) {
  const firstTurn = route.points[0] || route.target
  return computeSwitchPointOnFirstLeg(route.source, firstTurn)
}

function intervalOverlap1D(lo1, hi1, lo2, hi2) {
  return Math.max(lo1, lo2) <= Math.min(hi1, hi2)
}

/** 水平线段（y 恒定）与膨胀后的站房矩形是否相交（含擦边） */
function horizontalSegmentHitsRect(y, x1, x2, r) {
  const rx1 = r.x
  const rx2 = r.x + r.w
  const ry1 = r.y
  const ry2 = r.y + r.h
  if (y < ry1 || y > ry2) return false
  const xa = Math.min(x1, x2)
  const xb = Math.max(x1, x2)
  return intervalOverlap1D(xa, xb, rx1, rx2)
}

/** 竖直线段（x 恒定）与矩形是否相交 */
function verticalSegmentHitsRect(x, y1, y2, r) {
  const rx1 = r.x
  const rx2 = r.x + r.w
  const ry1 = r.y
  const ry2 = r.y + r.h
  if (x < rx1 || x > rx2) return false
  const ya = Math.min(y1, y2)
  const yb = Math.max(y1, y2)
  return intervalOverlap1D(ya, yb, ry1, ry2)
}

function buildObstacleRects(stations, excludeIds, pad = 16) {
  const skip = new Set(excludeIds)
  return stations.filter((s) => s.id && !skip.has(s.id)).map((s) => ({
    x: s.x - pad,
    y: s.y - pad,
    w: s.w + 2 * pad,
    h: s.h + 2 * pad,
  }))
}

function polylineHitsAnyObstacle(route, obstacles) {
  const pts = [route.source, ...route.points, route.target]
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    for (let o = 0; o < obstacles.length; o++) {
      const r = obstacles[o]
      if (Math.abs(a.x - b.x) < 1e-3) {
        if (verticalSegmentHitsRect(a.x, a.y, b.y, r)) return true
      } else if (Math.abs(a.y - b.y) < 1e-3) {
        if (horizontalSegmentHitsRect(a.y, a.x, b.x, r)) return true
      }
    }
  }
  return false
}

/**
 * Z 形折线穿过无关站房时，沿垂直于「中间大横段/竖段」的方向平移该段，避开障碍物。
 * 仅调整中间拐点，不改变两端出线点。
 */
function nudgeRouteAwayFromStations(route, fromStation, toStation, stations) {
  const obstacles = buildObstacleRects(stations, [fromStation.id, toStation.id])
  if (obstacles.length === 0) return route

  if (!polylineHitsAnyObstacle(route, obstacles)) return route

  const step = 32
  const maxK = 36
  const vf = route.verticalFirst

  if (vf) {
    const baseY = route.points[0].y
    for (let k = 1; k <= maxK; k++) {
      const deltas = [k * step, -k * step]
      for (let di = 0; di < deltas.length; di++) {
        const my = baseY + deltas[di]
        const next = {
          ...route,
          points: [
            { x: route.source.x, y: my },
            { x: route.target.x, y: my },
          ],
        }
        if (!polylineHitsAnyObstacle(next, obstacles)) {
          next.switchPoint = recomputeSwitchPoint(next)
          return next
        }
      }
    }
  } else {
    const baseX = route.points[0].x
    for (let k = 1; k <= maxK; k++) {
      const deltas = [k * step, -k * step]
      for (let di = 0; di < deltas.length; di++) {
        const mx = baseX + deltas[di]
        const next = {
          ...route,
          points: [
            { x: mx, y: route.source.y },
            { x: mx, y: route.target.y },
          ],
        }
        if (!polylineHitsAnyObstacle(next, obstacles)) {
          next.switchPoint = recomputeSwitchPoint(next)
          return next
        }
      }
    }
  }

  return route
}

/**
 * 按站数调整布局尺度：站少保持 1（与原布局一致），站多时适度放大，让布局更分散。
 * 避免站点过于密集导致线路交叉和重叠。
 */
function layoutCompactScale(stationCount) {
  const n = Math.max(Number(stationCount) || 0, 1)
  if (n <= 6) return 1
  const t = Math.min(n - 6, 24)
  return Math.min(1.4, 1 + t * 0.015)
}

/** T10 枢纽：邻接数 ≥ 此值时启用副中心布局（徐庄类 10 回线） */
const T10_HUB_MIN_DEGREE = 8
/** 根站左缘与 T10 右缘之间的水平间隙（逻辑 px，× layoutCompactScale） */
const T10_ROOT_GAP_PX = 300
/** T10 邻站环绕椭圆半径 */
const T10_NEIGHBOR_RADIUS_X_BASE = 540
const T10_NEIGHBOR_RADIUS_Y_BASE = 400
/** 非 T10 邻站的外环半径（相对画布中心） */
const T10_OUTER_RING_RADIUS_X = 720
const T10_OUTER_RING_RADIUS_Y = 480

function findT10HubStation(stations) {
  let best = null
  let bestDeg = 0
  for (let i = 0; i < stations.length; i++) {
    const s = stations[i]
    if (!isVirtualT10Station(s.name)) continue
    const deg = s._hubDegree != null ? s._hubDegree : 0
    if (!best || deg > bestDeg) {
      best = s
      bestDeg = deg
    }
  }
  return best
}

/** T10 在根站西侧时，外环站避开西半平面，避免「根站—外环站」直线穿过 T10 */
function pickT10HubOuterRingAngles(count) {
  if (count <= 0) return []
  const candidates = []
  const steps = 48
  for (let i = 0; i < steps; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / steps
    if (Math.cos(angle) < -0.12) continue
    candidates.push(angle)
  }
  if (candidates.length === 0) {
    return Array.from({ length: count }, (_, i) => -Math.PI / 2 + (2 * Math.PI * i) / Math.max(count, 1))
  }
  const angles = []
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1)
    const idx = Math.round(t * (candidates.length - 1))
    angles.push(candidates[idx])
  }
  return angles
}

/**
 * T10 副中心布局：根站在画布中心；T10 在根站西侧；除根站外的 T10 邻站均匀环绕 T10；
 * 其余站落在根站外环。减轻「环上均分 + 朝向取边」导致 T10 单侧（如右侧）多回线挤在一起。
 */
function applyT10HubSubcenterLayout(stations, adjacency, root, t10Hub, scale, centerX, centerY) {
  root.x = centerX - root.w / 2
  root.y = centerY - root.h / 2

  const gap = T10_ROOT_GAP_PX * scale
  const t10CenterX = centerX - root.w / 2 - gap - t10Hub.w / 2
  const t10CenterY = centerY
  t10Hub.x = t10CenterX - t10Hub.w / 2
  t10Hub.y = t10CenterY - t10Hub.h / 2

  const stationById = new Map(stations.map((s) => [s.id, s]))
  const neighborIds = [...(adjacency.get(t10Hub.id) || [])].filter((id) => id !== root.id)
  neighborIds.sort((a, b) => {
    const na = stationById.get(a)?.name || ''
    const nb = stationById.get(b)?.name || ''
    return na.localeCompare(nb)
  })

  const ringRx = T10_NEIGHBOR_RADIUS_X_BASE * scale
  const ringRy = T10_NEIGHBOR_RADIUS_Y_BASE * scale
  const n = neighborIds.length
  neighborIds.forEach((id, idx) => {
    const s = stationById.get(id)
    if (!s) return
    const angle = -Math.PI / 2 + (2 * Math.PI * idx) / Math.max(n, 1)
    const cx = t10CenterX + Math.cos(angle) * ringRx
    const cy = t10CenterY + Math.sin(angle) * ringRy
    s.x = cx - s.w / 2
    s.y = cy - s.h / 2
  })

  const placed = new Set([root.id, t10Hub.id, ...neighborIds])
  const remaining = stations.filter((s) => !placed.has(s.id))
  if (remaining.length > 0) {
    remaining.sort((a, b) => a.name.localeCompare(b.name))
    const outerRx = T10_OUTER_RING_RADIUS_X * scale
    const outerRy = T10_OUTER_RING_RADIUS_Y * scale
    const outerAngles = pickT10HubOuterRingAngles(remaining.length)
    remaining.forEach((s, idx) => {
      const angle = outerAngles[idx] ?? -Math.PI / 2 + (2 * Math.PI * idx) / Math.max(remaining.length, 1)
      const x = centerX + Math.cos(angle) * outerRx
      const y = centerY + Math.sin(angle) * outerRy
      s.x = x - s.w / 2
      s.y = y - s.h / 2
    })
  }
}

/** 经纬度是否非空（(0,0) 视为缺失） */
function isValidGeoCoord(lon, lat) {
  const lo = Number(lon)
  const la = Number(lat)
  if (Number.isNaN(lo) || Number.isNaN(la)) return false
  if (Math.abs(lo) < 1e-9 && Math.abs(la) < 1e-9) return false
  return true
}

/**
 * 是否为经处理的真实地理坐标（WGS84 量级）。
 * 单线图平面坐标（如 lat≈2、lon≈17）不满足，避免误对庆丰/府城等 JSON 启用地理布局。
 */
function looksLikeProcessedGeoCoord(lon, lat) {
  if (!isValidGeoCoord(lon, lat)) return false
  const lo = Number(lon)
  const la = Number(lat)
  return la >= 18 && la <= 54 && lo >= 73 && lo <= 135
}

function layoutRealNodes(layoutNodes) {
  return layoutNodes.filter((n) => !n.isBusNode)
}

function layoutBusNodes(layoutNodes) {
  return layoutNodes.filter((n) => n.isBusNode)
}

function resolveGeoBounds(realNodes) {
  let minLon = Infinity
  let maxLon = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  realNodes.forEach((n) => {
    if (!looksLikeProcessedGeoCoord(n.lon, n.lat)) return
    minLon = Math.min(minLon, Number(n.lon))
    maxLon = Math.max(maxLon, Number(n.lon))
    minLat = Math.min(minLat, Number(n.lat))
    maxLat = Math.max(maxLat, Number(n.lat))
  })
  if (!Number.isFinite(minLon)) return null
  if (maxLon - minLon < 1e-8) {
    minLon -= 0.01
    maxLon += 0.01
  }
  if (maxLat - minLat < 1e-8) {
    minLat -= 0.01
    maxLat += 0.01
  }
  return { minLon, maxLon, minLat, maxLat }
}

function mapGeoToCanvas(lon, lat, bounds, margin, usableW, usableH) {
  const spanLon = bounds.maxLon - bounds.minLon
  const spanLat = bounds.maxLat - bounds.minLat
  const tLon = Math.max(0, Math.min(1, (Number(lon) - bounds.minLon) / spanLon))
  const tLat = Math.max(0, Math.min(1, (bounds.maxLat - Number(lat)) / spanLat))
  return {
    cx: margin + tLon * usableW,
    cy: margin + tLat * usableH,
  }
}

/** 叠站时沿轴轻微推开（有上限，避免新乡类密集图数值爆炸为 NaN） */
function separateLayoutNodeOverlaps(nodes, minGap = 18, maxIter = 24) {
  const list = nodes.filter((n) => !n.isBusNode)
  const maxPush = 36
  for (let iter = 0; iter < maxIter; iter++) {
    let moved = false
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]
        const b = list[j]
        if (
          !Number.isFinite(a.x) ||
          !Number.isFinite(a.y) ||
          !Number.isFinite(b.x) ||
          !Number.isFinite(b.y)
        ) {
          continue
        }
        const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
        const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
        if (overlapX <= 0 || overlapY <= 0) continue
        const acx = a.x + a.w / 2
        const acy = a.y + a.h / 2
        const bcx = b.x + b.w / 2
        const bcy = b.y + b.h / 2
        let dx = bcx - acx
        let dy = bcy - acy
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
          dx = 1
          dy = 0
        }
        const len = Math.hypot(dx, dy) || 1
        const push = Math.min(maxPush, Math.max(overlapX, overlapY) * 0.35 + 4)
        if (push <= 0) continue
        a.x -= (dx / len) * push * 0.5
        a.y -= (dy / len) * push * 0.5
        b.x += (dx / len) * push * 0.5
        b.y += (dy / len) * push * 0.5
        moved = true
      }
    }
    if (!moved) break
  }
}

function placeNodesWithoutGeo(invalidNodes, validNodes, layoutEdges) {
  const validById = new Map(validNodes.map((n) => [n.id, n]))
  const adjacency = new Map()
  layoutEdges.forEach(({ from, to }) => {
    if (!adjacency.has(from)) adjacency.set(from, [])
    if (!adjacency.has(to)) adjacency.set(to, [])
    adjacency.get(from).push(to)
    adjacency.get(to).push(from)
  })
  invalidNodes.forEach((s) => {
    const neighbors = (adjacency.get(s.id) || [])
      .map((id) => validById.get(id))
      .filter(Boolean)
    if (neighbors.length > 0) {
      const cx = neighbors.reduce((sum, n) => sum + n.x + n.w / 2, 0) / neighbors.length
      const cy = neighbors.reduce((sum, n) => sum + n.y + n.h / 2, 0) / neighbors.length
      s.x = cx - s.w / 2
      s.y = cy - s.h / 2
      return
    }
    const ref = validNodes[0]
    if (ref) {
      s.x = ref.x + ref.w + 48
      s.y = ref.y
    }
  })
}

function layoutBusNodesAtGeoParent(busNodes, mapPoint) {
  const byStation = new Map()
  busNodes.forEach((bn) => {
    if (!byStation.has(bn.stationId)) byStation.set(bn.stationId, [])
    byStation.get(bn.stationId).push(bn)
  })
  byStation.forEach((list) => {
    const ref = list[0]
    const { cx, cy } = mapPoint(ref.lon, ref.lat)
    const gap = 28
    if (list.length === 1) {
      const bn = list[0]
      bn.x = cx - bn.w / 2
      bn.y = cy - bn.h / 2
      return
    }
    const totalW = list.length * T10_BUS_NODE_SIZE + (list.length - 1) * gap
    let startX = cx - totalW / 2
    list.forEach((bn, i) => {
      bn.x = startX + i * (T10_BUS_NODE_SIZE + gap)
      bn.y = cy - bn.h / 2
    })
  })
}

/**
 * 地理示意布局：方位优先、距离可压缩；仅初次 parseSvg 使用。
 * @returns {boolean} 是否成功应用
 */
function computeGeoLayout(layoutNodes, layoutEdges) {
  const scale = layoutCompactScale(layoutNodes.length)
  const width = 2600 * scale
  const height = 1400 * scale
  const margin = 110 * scale
  const usableW = width - 2 * margin
  const usableH = height - 2 * margin
  const realNodes = layoutRealNodes(layoutNodes)
  const busNodes = layoutBusNodes(layoutNodes)
  const bounds = resolveGeoBounds(realNodes)
  if (!bounds) return false

  const validNodes = realNodes.filter((n) => looksLikeProcessedGeoCoord(n.lon, n.lat))
  if (validNodes.length === 0) return false

  const mapPoint = (lon, lat) => mapGeoToCanvas(lon, lat, bounds, margin, usableW, usableH)

  validNodes.forEach((s) => {
    const { cx, cy } = mapPoint(s.lon, s.lat)
    s.x = cx - s.w / 2
    s.y = cy - s.h / 2
  })

  const invalidNodes = realNodes.filter((n) => !looksLikeProcessedGeoCoord(n.lon, n.lat))
  if (invalidNodes.length > 0) {
    placeNodesWithoutGeo(invalidNodes, validNodes, layoutEdges)
  }

  separateLayoutNodeOverlaps(realNodes, 20 * scale)
  if (busNodes.length > 0) {
    layoutBusNodesAtGeoParent(busNodes, mapPoint)
  }
  return true
}

function countProcessedGeoNodes(layoutNodes) {
  return layoutRealNodes(layoutNodes).filter((n) => looksLikeProcessedGeoCoord(n.lon, n.lat)).length
}

function resolveLayoutMode(layoutMode, layoutNodes) {
  const mode = layoutMode || 'auto'
  const realCount = layoutRealNodes(layoutNodes).length
  const geoCount = countProcessedGeoNodes(layoutNodes)
  const canGeo = geoCount >= 2 && (geoCount >= realCount || geoCount / Math.max(realCount, 1) >= 0.5)
  if (mode === 'topology') return 'topology'
  if (mode === 'geo') return geoCount >= 1 ? 'geo' : 'topology'
  return canGeo ? 'geo' : 'topology'
}

/** 初次成图站位：满足地理坐标条件时用示意地理布局，否则 BFS 环布局 */
function applyStationLayout(layoutNodes, layoutEdges, options) {
  if (resolveLayoutMode(options?.layoutMode, layoutNodes) === 'geo' && computeGeoLayout(layoutNodes, layoutEdges)) {
    return 'geo'
  }
  computeTopologyLayout(layoutNodes, layoutEdges)
  return 'topology'
}

function computeTopologyLayout(layoutNodes, layoutEdges) {
  const scale = layoutCompactScale(layoutNodes.length)
  const width = 2600 * scale
  const height = 1400 * scale
  const centerX = width / 2
  const centerY = height / 2
  const adjacency = new Map()
  layoutNodes.forEach((s) => adjacency.set(s.id, new Set()))
  layoutEdges.forEach(({ from, to }) => {
    adjacency.get(from)?.add(to)
    adjacency.get(to)?.add(from)
  })

  const root = [...layoutNodes].sort((a, b) => b.kv - a.kv || a.name.localeCompare(b.name))[0]

  const levelMap = new Map()
  const queue = []
  if (root) {
    levelMap.set(root.id, 0)
    queue.push(root.id)
  }
  while (queue.length > 0) {
    const cur = queue.shift()
    const lv = levelMap.get(cur) || 0
    ;[...(adjacency.get(cur) || [])].forEach((next) => {
      if (!levelMap.has(next)) {
        levelMap.set(next, lv + 1)
        queue.push(next)
      }
    })
  }
  layoutNodes.forEach((s) => {
    if (!levelMap.has(s.id)) levelMap.set(s.id, 2)
  })

  const levelGroups = new Map()
  layoutNodes.forEach((s) => {
    const lv = levelMap.get(s.id) || 0
    if (!levelGroups.has(lv)) levelGroups.set(lv, [])
    levelGroups.get(lv).push(s)
  })

  const maxLevel = Math.max(...[...levelGroups.keys(), 0])
  /**
   * 按层整体旋转：缓解链式小图多层同射线叠线（原武等）。
   * 大图（站多或单层站多）若始终 twist，各层环彼此错角，联络线更易交叉、整体更「散」，故仅在小图启用。
   */
  let maxOnRing = 0
  for (let lv = 1; lv <= maxLevel; lv++) {
    maxOnRing = Math.max(maxOnRing, (levelGroups.get(lv) || []).length)
  }
  const RING_TWIST_MAX_STATIONS = 14
  const RING_TWIST_MAX_ON_LEVEL = 3
  const useRingTwist =
    layoutNodes.length <= RING_TWIST_MAX_STATIONS && maxOnRing <= RING_TWIST_MAX_ON_LEVEL
  const ringTwist = useRingTwist ? (2 * Math.PI) / Math.max(maxLevel + 3, 7) : 0
  for (let lv = 0; lv <= maxLevel; lv++) {
    const list = levelGroups.get(lv) || []
    if (lv === 0) {
      list.forEach((s) => {
        s.x = centerX - s.w / 2
        s.y = centerY - s.h / 2
      })
      continue
    }
    const radiusX = (520 + (lv - 1) * 380) * scale
    const radiusY = (360 + (lv - 1) * 260) * scale
    const count = list.length
    list.sort((a, b) => a.name.localeCompare(b.name))
    const twist = (lv - 1) * ringTwist
    list.forEach((s, idx) => {
      const angle = (-Math.PI / 2) + (2 * Math.PI * idx) / Math.max(count, 1) + twist
      const x = centerX + Math.cos(angle) * radiusX
      const y = centerY + Math.sin(angle) * radiusY
      s.x = x - s.w / 2
      s.y = y - s.h / 2
    })
  }
}

function stationStyleByKV(kv, topAlign = false, trafoLabel = false) {
  const k = normalizeKV(kv)
  const va = topAlign ? 'top' : 'middle'
  const st = topAlign ? '2' : '0'
  const fs = stationStyleFontPx(k, trafoLabel)
  const stroke = stationStrokeColorByKV(k)
  if (k >= 800) {
    return `${LIAISON_STATION_NO_RESIZE}rounded=0;whiteSpace=wrap;html=1;fillColor=${KV1000};strokeColor=${stroke};strokeWidth=2.5;fontColor=#ffffff;fontSize=${fs};align=center;verticalAlign=${va};spacingTop=${st};`
  }
  if (k >= 500) {
    return `${LIAISON_STATION_NO_RESIZE}rounded=0;whiteSpace=wrap;html=1;fillColor=${KV500};strokeColor=${stroke};strokeWidth=2.5;fontColor=#ffffff;fontSize=${fs};align=center;verticalAlign=${va};spacingTop=${st};`
  }
  if (k >= 220) {
    return `${LIAISON_STATION_NO_RESIZE}rounded=0;whiteSpace=wrap;html=1;fillColor=${KV220};strokeColor=${stroke};strokeWidth=2;fontColor=#ffffff;fontSize=${fs};align=center;verticalAlign=${va};spacingTop=${st};`
  }
  if (k >= 110) {
    return `${LIAISON_STATION_NO_RESIZE}rounded=0;whiteSpace=wrap;html=1;fillColor=${KV110};strokeColor=${stroke};strokeWidth=2;fontColor=#ffffff;fontSize=${fs};align=center;verticalAlign=${va};spacingTop=${st};`
  }
  return `${LIAISON_STATION_NO_RESIZE}rounded=0;whiteSpace=wrap;html=1;fillColor=${KV35};strokeColor=${stroke};strokeWidth=2;fontColor=#1e293b;fontSize=${fs};align=center;verticalAlign=${va};spacingTop=${st};`
}

/**
 * 联络线颜色：取两端较低电压档对应站色（525 视同 500kV 档）。
 */
function linkStrokeColor(fromKv, toKv) {
  const low = Math.min(voltageTier(fromKv), voltageTier(toKv))
  return stationFillColorByTier(low)
}

/**
 * 联络线宽：随较低电压档递增（1000 档 4px，500 档 3.5px，220 档 3px，110 档 2.5px，35 档 2px）。
 */
function linkStrokeWidthPx(fromKv, toKv) {
  const low = Math.min(voltageTier(fromKv), voltageTier(toKv))
  const widths = { 5: 4, 4: 3.5, 3: 3, 2: 2.5, 1: 2 }
  return widths[low] || 2
}

/** 开关闭合实心颜色与线路同色 */
function switchClosedFill(fromKv, toKv) {
  return linkStrokeColor(fromKv, toKv)
}

function switchStyle(closed, lineColor, closedFill) {
  const stroke = closed ? closedFill : lineColor
  const fill = closed ? closedFill : '#ffffff'
  return `shape=rect;rounded=0;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};strokeWidth=2;`
}

// 边若直接连站元，mxGraph 会按边界重新取端点，与 setTerminalPoint / points 不一致 → 弯折、开关偏离线。
// 用透明小矩形（直角）固定在几何端点上，椭圆连接点在 perimeter 计算时易偏，导致竖线看起来贴角。
const JUNCTION_STYLE =
  'shape=rectangle;fillColor=none;strokeColor=none;strokeWidth=0;opacity=0;rounded=0;selectable=0;movable=0;resizable=0;rotatable=0;deletable=0;editable=0;connectable=0;'

const LIAISON_LINE_TEXT_DARK = '#ffffff'
const LIAISON_LINE_TEXT_LIGHT = '#334155'

function liaisonLineTextColor(theme) {
  return theme === 'light' ? LIAISON_LINE_TEXT_LIGHT : LIAISON_LINE_TEXT_DARK
}

function pqMetricStyle(theme = 'dark') {
  return `text;html=1;strokeColor=none;fillColor=none;fontColor=${liaisonLineTextColor(theme)};fontSize=10;align=center;verticalAlign=middle;movable=0;resizable=0;rotatable=0;whiteSpace=wrap;spacing=2;`
}

function lineNameStyle(theme = 'dark') {
  return `text;html=1;strokeColor=none;fillColor=none;fontColor=${liaisonLineTextColor(theme)};fontSize=11;align=left;verticalAlign=middle;selectable=1;movable=1;resizable=0;rotatable=0;deletable=0;whiteSpace=nowrap;spacing=2;`
}

/** 程序化删图元：线路名等 deletable=0，removeCells(_, true) 会被 getDeletableCells 滤掉 */
function forceRemoveGraphCells(graph, cells) {
  if (!graph || !cells) return
  const list = Array.isArray(cells) ? cells : [cells]
  if (!list.length) return
  graph.removeCells(list, false)
}

function buildPqMetricHtml(pFromMw, qFromMvar) {
  const pStr = escapeHtmlLabel(formatMwMvarNumber(pFromMw))
  const qStr = escapeHtmlLabel(formatMwMvarNumber(qFromMvar))
  return `<div style="font-size:10pt;line-height:1.25;text-align:center;color:${LIAISON_MEASUREMENT_COLOR};">${pStr}<br/>${qStr}</div>`
}

function isLineNameManuallyPlaced(graph, cell) {
  if (!graph || !cell) return false
  if (cell._liaisonNamePositionManual) return true
  const style = graph.getCurrentCellStyle(cell)
  const v = style?.liaisonNameManual
  return v === '1' || v === 1
}

function estimateLineNameBlockWidth(lineName) {
  const n = String(lineName || '').length
  if (!n) return 0
  return Math.min(LINE_NAME_MAX_W, Math.max(LINE_NAME_MIN_W, n * LINE_NAME_CHAR_W + LINE_NAME_PAD_X * 2))
}

/** 线路名独立文本顶点（与边、P/Q 块分离） */
const LINE_NAME_BLOCK_H = 16
const LINE_NAME_CHAR_W = 7.2
const LINE_NAME_MIN_W = 36
const LINE_NAME_MAX_W = 120
const LINE_NAME_PAD_X = 4
const LINE_NAME_GAP = 6

function buildLineNameHtml(lineName, showLabels, theme = 'dark') {
  if (!showLabels || !lineName) return ''
  return `<div style="font-size:11px;line-height:1.2;color:${liaisonLineTextColor(theme)};white-space:nowrap;">${escapeHtmlLabel(lineName)}</div>`
}

/** 线路名靠近首段折角：竖段放右侧，横段放上方，避免压线 */
function computeLineNameBlockPosition(route, lineName) {
  if (!route || !lineName) return null
  const w = estimateLineNameBlockWidth(lineName)
  if (w <= 0) return null
  const h = LINE_NAME_BLOCK_H
  const d = route.source
  const bend = route.points[0] || route.target
  const dx = bend.x - d.x
  const dy = bend.y - d.y
  if (Math.abs(dy) >= Math.abs(dx)) {
    return { x: bend.x + LINE_NAME_GAP, y: bend.y - h / 2, w, h }
  }
  return { x: bend.x - w / 2, y: bend.y - h - LINE_NAME_GAP - 6, w, h }
}

/** 站间联络线路边（含折点），不可拖动/弯折；不含 liaison-name / liaison-pq 等附属文本顶点 */
function isLiaisonLineEdgeCell(cell) {
  if (!cell) return false
  const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
  if (
    id.startsWith('liaison-name:') ||
    id.startsWith('liaison-pq:') ||
    id.startsWith('liaison-j-')
  ) {
    return false
  }
  return id.startsWith('liaison:')
}

/** 联络边样式；线端不绘制固定箭头，潮流方向由 overlay 动画箭头表示 */
function buildLiaisonChannelEdgeStyle(fromKv, toKv, pFromMw) {
  const reverseFlow = pFromMw != null && pFromMw < -FLOW_P_EPS
  const showFlowArrow = pFromMw != null && Math.abs(pFromMw) >= FLOW_P_EPS
  const lineColor = linkStrokeColor(fromKv, toKv)
  const lineW = linkStrokeWidthPx(fromKv, toKv)
  const style = `noEdgeStyle=1;edgeStyle=none;rounded=0;orthogonalLoop=0;jettySize=0;strokeColor=${lineColor};strokeWidth=${lineW};endArrow=none;startArrow=none;movable=0;bendable=0;locked=1;editable=0;html=1;flag=svgLiaisonLine;`
  return { style, lineColor, lineW, reverseFlow, showFlowArrow }
}

function junctionCenterFromCell(graph, cell) {
  const geo = graph?.getModel()?.getGeometry(cell)
  if (!geo) return null
  return { x: geo.x + geo.width / 2, y: geo.y + geo.height / 2 }
}

function routeFromChannelBundle(graph, bundle, edge) {
  const source = junctionCenterFromCell(graph, bundle.jFrom)
  const target = junctionCenterFromCell(graph, bundle.jTo)
  if (!source || !target) return null
  const edgeGeo = graph.getModel().getGeometry(edge)
  const points = (edgeGeo?.points || []).map((p) => ({ x: p.x, y: p.y }))
  return { source, target, points }
}

const NS = 'http://www.w3.org/2000/svg'
const LIAISON_FLOW_DASH_LEGACY_STYLE_ID = 'liaison-flow-dash-style'

/** 与 `showFlowArrow` 一致：|聚合 P| ≥ eps 时视为有线头，可沿线路做运动箭头示意潮流 */
function liaisonEdgeHasFlowHead(entityInfo) {
  const p = entityInfo?.p_from_mw
  if (p == null || Number.isNaN(Number(p))) return false
  return Math.abs(Number(p)) >= FLOW_P_EPS
}

function liaisonMotionPathIdForCell(cell) {
  const raw = typeof cell?.getId === 'function' ? String(cell.getId()) : String(cell?.id ?? 'e')
  const safe = raw.replace(/[^a-zA-Z0-9_-]+/g, '_')
  return safe
}

function roundPathCoord(v) {
  return Math.round(Number(v) * 10) / 10
}

/** 由 `absolutePoints` 构造供 `animateMotion`/`mpath` 使用的折线路径 `d` */
function buildPolylineMotionPathD(pts) {
  if (!pts || pts.length < 2) return null
  const chunks = []
  let pen = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    if (p == null || Number.isNaN(p.x) || Number.isNaN(p.y)) return null
    const x = roundPathCoord(p.x)
    const y = roundPathCoord(p.y)
    if (i > 0) {
      const q = pts[i - 1]
      if (q && Math.abs(q.x - p.x) < 1e-3 && Math.abs(q.y - p.y) < 1e-3) continue
    }
    chunks.push(pen === 0 ? `M${x} ${y}` : `L${x} ${y}`)
    pen++
  }
  return chunks.length >= 2 ? chunks.join(' ') : null
}

function removeLiaisonFlowMotionArrowsFromOverlay(graph) {
  const overlay = graph?.view?.getOverlayPane?.()
  if (!overlay || typeof overlay.querySelectorAll !== 'function') return
  overlay.querySelectorAll('g[data-liaison-flow-motion="1"]').forEach((g) => g.remove())
}

/** 去掉旧版 dash 动画注入的 `<style>`（若存在） */
function removeLiaisonFlowDashLegacyStyle() {
  if (typeof document === 'undefined') return
  document.getElementById(LIAISON_FLOW_DASH_LEGACY_STYLE_ID)?.remove()
}

/** 沿线运动箭头：单圈时长（秒），默认与上下限 */
const LIAISON_FLOW_MOTION_DUR_DEFAULT_SEC = 2.5
const LIAISON_FLOW_MOTION_DUR_MIN_SEC = 0.3
const LIAISON_FLOW_MOTION_DUR_MAX_SEC = 120

function clampFlowMotionDurationSec(v) {
  const n = Number(v)
  if (Number.isNaN(n) || n <= 0) return LIAISON_FLOW_MOTION_DUR_DEFAULT_SEC
  return Math.min(LIAISON_FLOW_MOTION_DUR_MAX_SEC, Math.max(LIAISON_FLOW_MOTION_DUR_MIN_SEC, n))
}

function resolveFlowMotionDurationSec(graph, durationSecOverride) {
  if (durationSecOverride != null && !Number.isNaN(Number(durationSecOverride))) {
    return clampFlowMotionDurationSec(durationSecOverride)
  }
  if (graph && graph._liaisonFlowMotionDurationSec != null) {
    return clampFlowMotionDurationSec(graph._liaisonFlowMotionDurationSec)
  }
  return LIAISON_FLOW_MOTION_DUR_DEFAULT_SEC
}

function createSvgEl(name) {
  return document.createElementNS(NS, name)
}

/**
 * 对有潮流（|p_from_mw|≥eps）的联络边，在 **overlayPane** 上叠一层沿折线运动的箭头（SVG `animateMotion` + `mpath`）。
 * 几何取自 `view.getState(edge).absolutePoints`，与线端箭头方向一致。
 * @param graph mxGraph 实例
 * @param {number} [durationSecOverride] 单圈时长（秒）；省略则用 `graph._liaisonFlowMotionDurationSec`（由 `SvgLiaisonDrawioParser` 的 `flowMotionDurationSec` 写入）或默认 2.5s
 */
export function applyLiaisonFlowMotionArrows(graph, durationSecOverride) {
  if (typeof document === 'undefined' || !graph?.view?.getOverlayPane) return
  if (graph._liaisonShowMeasurements === false) {
    removeLiaisonFlowMotionArrowsFromOverlay(graph)
    return
  }
  removeLiaisonFlowDashLegacyStyle()
  removeLiaisonFlowMotionArrowsFromOverlay(graph)

  const overlay = graph.view.getOverlayPane()
  const model = graph.getModel()
  const parent = graph.getDefaultParent()
  const n = model.getChildCount(parent)
  const dur = resolveFlowMotionDurationSec(graph, durationSecOverride)
  const batchId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

  for (let i = 0; i < n; i++) {
    const cell = model.getChildAt(parent, i)
    if (!model.isEdge(cell) || cell.entityType !== 'line') continue
    if (!liaisonEdgeHasFlowHead(cell.entityInfo)) continue
    const st = graph.view.getState(cell)
    const pts = st?.absolutePoints
    const d = buildPolylineMotionPathD(pts)
    if (!d) continue

    const pathId = `liaison_mpath_${batchId}_${i}_${liaisonMotionPathIdForCell(cell)}`
    const strokeColor = String(cell.entityInfo?.link_color || '#F04155')
    const lineW = Math.max(1.5, Number(cell.entityInfo?.link_width_px) || 2)

    const wrap = createSvgEl('g')
    wrap.setAttribute('data-liaison-flow-motion', '1')
    wrap.setAttribute('pointer-events', 'none')

    const defs = createSvgEl('defs')
    const path = createSvgEl('path')
    path.setAttribute('id', pathId)
    path.setAttribute('d', d)
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', 'none')
    path.setAttribute('stroke-width', '0')
    defs.appendChild(path)
    wrap.appendChild(defs)

    const poly = createSvgEl('polygon')
    const scale = graph.view.scale || 1
    const h = Math.max(6, lineW * 2.8) * scale
    const L = Math.max(12, lineW * 5.6) * scale
    poly.setAttribute('points', `0,${-h} ${L},0 0,${h}`)
    poly.setAttribute('fill', strokeColor)
    poly.setAttribute('stroke', '#ffffff')
    poly.setAttribute('stroke-width', String(Math.max(1.4, lineW * 0.6) * scale))

    const anim = createSvgEl('animateMotion')
    anim.setAttribute('dur', `${dur}s`)
    anim.setAttribute('repeatCount', 'indefinite')
    anim.setAttribute('rotate', 'auto')
    anim.setAttribute('calcMode', 'linear')
    const mpath = createSvgEl('mpath')
    mpath.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#${pathId}`)
    mpath.setAttribute('href', `#${pathId}`)
    anim.appendChild(mpath)
    poly.appendChild(anim)
    wrap.appendChild(poly)

    overlay.appendChild(wrap)
  }
}

function ensureLiaisonFlowMotionViewListeners(graph) {
  if (!graph?.view || graph._liaisonFlowMotionViewListeners || typeof mxEvent === 'undefined') return
  let timer = null
  const schedule = () => {
    if (typeof window === 'undefined') return
    if (timer != null) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      timer = null
      applyLiaisonFlowMotionArrows(graph)
    }, 90)
  }
  // setScale / setTranslate 分别只发 SCALE、TRANSLATE；scaleAndTranslate 才发 SCALE_AND_TRANSLATE。
  // 仅监听后者会导致滚轮/菜单缩放后路径不刷新，箭头与导线错位。
  graph.view.addListener(mxEvent.SCALE_AND_TRANSLATE, schedule)
  graph.view.addListener(mxEvent.SCALE, schedule)
  graph.view.addListener(mxEvent.TRANSLATE, schedule)
  graph.addListener('cssTransformChanged', schedule)
  graph.addListener(mxEvent.SIZE, schedule)
  graph._liaisonFlowMotionViewListeners = true
}

/** 站数/连线较多时推迟运动箭头，先让首屏绘制完成 */
const LIAISON_LARGE_GRAPH_STATIONS = 80
const LIAISON_LARGE_GRAPH_LINKS = 200
/** 大图跳过逐线穿站避让（O(links×stations×attempts)，327 站时收益明显） */
const LIAISON_SKIP_ROUTE_NUDGE_NODES = 60

function liaisonGraphLoadDeferMs(stationCount, linkCount) {
  if (stationCount >= LIAISON_LARGE_GRAPH_STATIONS || linkCount >= LIAISON_LARGE_GRAPH_LINKS) {
    return 1200
  }
  return 80
}

function scheduleLiaisonFlowMotionArrows(graph, opts = {}) {
  if (!graph) return
  if (graph._liaisonShowMeasurements === false) {
    removeLiaisonFlowMotionArrowsFromOverlay(graph)
    return
  }
  ensureLiaisonFlowMotionViewListeners(graph)
  if (typeof window === 'undefined') {
    applyLiaisonFlowMotionArrows(graph, opts.durationSecOverride)
    return
  }
  if (graph._liaisonFlowMotionScheduleTimer != null) {
    window.clearTimeout(graph._liaisonFlowMotionScheduleTimer)
  }
  const deferMs = opts.deferMs != null ? opts.deferMs : 0
  graph._liaisonFlowMotionScheduleTimer = window.setTimeout(() => {
    graph._liaisonFlowMotionScheduleTimer = null
    window.requestAnimationFrame(() => applyLiaisonFlowMotionArrows(graph, opts.durationSecOverride))
  }, deferMs)
}

export default class SvgLiaisonDrawioParser {
  constructor(data, options = {}) {
    this.data = data || {}
    this.options = {
      showLabels: options.showLabels !== false,
      /** 站内主变 P/Q、线路 P/Q 与潮流运动箭头；默认关闭，点「刷新量测」后再展示 */
      showMeasurements: options.showMeasurements === true,
      /** 有潮流（|p_from_mw|≥eps）的边：沿线运动箭头（SVG animateMotion），默认开启 */
      flowMotionAnimation: options.flowMotionAnimation !== false && options.flowDashAnimation !== false,
      /** 运动箭头沿折线跑一圈的时长（秒），默认 2.5，限制在 [0.3, 120] */
      flowMotionDurationSec: clampFlowMotionDurationSec(
        options.flowMotionDurationSec != null ? options.flowMotionDurationSec : LIAISON_FLOW_MOTION_DUR_DEFAULT_SEC
      ),
      theme: options.theme === 'light' ? 'light' : 'dark',
      /**
       * 初次成图站位：auto（默认，仅当 JSON 含经处理 WGS84 量级坐标时用地理示意布局）、geo、topology。
       * 已保存 graphXml / 拖动后的几何不受影响。
       */
      layoutMode: options.layoutMode || 'auto',
    }
    this.graph = null
    /** 为 true 时 App 不自动 parseSvg，由页面加载已保存图形或手动首次成图 */
    this.skipInitialParseSvg = false
  }

  measurementsVisible() {
    return this.options.showMeasurements === true
  }

  trafoRowsForDisplay(source) {
    if (!this.measurementsVisible()) return []
    if (Array.isArray(source)) return source
    return trafoRowsForGraphDisplay(source)
  }

  _applyFlowMotionState(graph, opts = {}) {
    if (!graph) return
    graph._liaisonShowMeasurements = this.measurementsVisible()
    const motionOn = graph._liaisonShowMeasurements && this.options.flowMotionAnimation !== false
    if (motionOn) {
      graph._liaisonFlowMotionDurationSec = this.options.flowMotionDurationSec
      scheduleLiaisonFlowMotionArrows(graph, opts)
      return
    }
    if (graph._liaisonFlowMotionScheduleTimer != null) {
      window.clearTimeout(graph._liaisonFlowMotionScheduleTimer)
      graph._liaisonFlowMotionScheduleTimer = null
    }
    removeLiaisonFlowMotionArrowsFromOverlay(graph)
  }

  _syncPqLabelContent(graph, pqLbl, pFromMw, qFromMvar) {
    if (!graph || !pqLbl) return
    const model = graph.getModel()
    if (!this.measurementsVisible()) {
      model.setValue(pqLbl, '')
      return
    }
    model.setValue(pqLbl, buildPqMetricHtml(pFromMw, qFromMvar))
    graph.setCellStyle(pqMetricStyle(this.options.theme), [pqLbl])
  }

  setGraph(graph) {
    this.graph = graph
    if (graph) graph._liaisonShowMeasurements = this.measurementsVisible()
    this._ensureLiaisonGraphUi(graph)
    this._installLiaisonResizeGuard(graph)
    this._installLiaisonEdgeInteractionGuard(graph)
    this._installLiaisonStationSelectionStyle(graph)
  }

  /**
   * 变电站选中框。
   * cellsEditable=false 时 mxGraph 用 LOCKED_HANDLE_FILLCOLOR(#FF0000) 画红色虚线，与 110kV 站框混淆。
   * 须用独立 VertexHandler 子类，在 init() 创建 selectionBorder 前就覆盖配色方法。
   */
  _installLiaisonStationSelectionStyle(graph) {
    if (!graph || graph._liaisonStationSelectionVersion === 3) return
    if (typeof mxVertexHandler === 'undefined' || typeof mxUtils === 'undefined') return
    graph._liaisonStationSelectionVersion = 3

    const SEL_STROKE = '#16a34a'
    const SEL_FILL = 'rgba(34, 197, 94, 0.07)'
    const SEL_PAD = 2
    const SEL_STROKE_W = 1.5

    function LiaisonStationVertexHandler(state) {
      mxVertexHandler.call(this, state)
    }
    mxUtils.extend(LiaisonStationVertexHandler, mxVertexHandler)

    LiaisonStationVertexHandler.prototype.getSelectionColor = function () {
      return SEL_STROKE
    }
    LiaisonStationVertexHandler.prototype.isSelectionDashed = function () {
      return false
    }
    LiaisonStationVertexHandler.prototype.getSelectionStrokeWidth = function () {
      return SEL_STROKE_W
    }
    LiaisonStationVertexHandler.prototype.isSizerVisible = function () {
      return false
    }

    const baseGetSelectionBounds = mxVertexHandler.prototype.getSelectionBounds
    LiaisonStationVertexHandler.prototype.getSelectionBounds = function (state) {
      const r = baseGetSelectionBounds.call(this, state)
      return new mxRectangle(
        r.x - SEL_PAD,
        r.y - SEL_PAD,
        r.width + 2 * SEL_PAD,
        r.height + 2 * SEL_PAD
      )
    }

    LiaisonStationVertexHandler.prototype.createSelectionShape = function (bounds) {
      const shape = new mxRectangleShape(mxRectangle.fromRectangle(bounds), SEL_FILL, SEL_STROKE)
      shape.strokewidth = SEL_STROKE_W
      shape.isDashed = false
      return shape
    }

    const prevCreateVertexHandler = graph.createVertexHandler.bind(graph)
    graph.createVertexHandler = function liaisonCreateVertexHandler(state) {
      const cell = state?.cell
      const id = cell && typeof cell.getId === 'function' ? String(cell.getId()) : ''
      if (id.startsWith('station:')) {
        return new LiaisonStationVertexHandler(state)
      }
      return prevCreateVertexHandler(state)
    }
  }

  /** 禁止变电站被拉伸（draw.io 载入后可能恢复 cellsResizable） */
  _installLiaisonResizeGuard(graph) {
    if (!graph || graph._liaisonResizeGuardInstalled) return
    graph._liaisonResizeGuardInstalled = true
    const prevIsCellResizable = graph.isCellResizable.bind(graph)
    graph.isCellResizable = (cell) => {
      if (!cell) return false
      const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      if (id.startsWith('station:')) return false
      return prevIsCellResizable(cell)
    }
  }

  /**
   * 禁止联络线路被拖动或弯折（含端点/折点手柄）。
   * draw.io 对 noEdgeStyle 边仍会显示可拖动手柄，须样式 locked + 专用 EdgeHandler。
   */
  _installLiaisonEdgeInteractionGuard(graph) {
    if (!graph || graph._liaisonEdgeInteractionVersion === 2) return
    if (typeof mxEdgeHandler === 'undefined' || typeof mxUtils === 'undefined') return
    graph._liaisonEdgeInteractionVersion = 2

    const prevIsCellMovable = graph.isCellMovable.bind(graph)
    graph.isCellMovable = (cell) => {
      const id = typeof cell?.getId === 'function' ? String(cell.getId()) : ''
      if (id.startsWith('liaison-name:')) {
        return graph.isCellsMovable() && !graph.isCellLocked(cell)
      }
      if (isLiaisonLineEdgeCell(cell)) return false
      if (id.startsWith('liaison-j-') || id.startsWith('liaison-pq:')) return false
      return prevIsCellMovable(cell)
    }

    const prevIsCellBendable = graph.isCellBendable.bind(graph)
    graph.isCellBendable = (cell) => {
      if (isLiaisonLineEdgeCell(cell)) return false
      const id = typeof cell?.getId === 'function' ? String(cell.getId()) : ''
      if (id.startsWith('liaison-j-') || id.startsWith('liaison-pq:') || id.startsWith('liaison-name:')) return false
      return prevIsCellBendable(cell)
    }

    const prevIsLabelMovable = graph.isLabelMovable.bind(graph)
    graph.isLabelMovable = (cell) => {
      const id = typeof cell?.getId === 'function' ? String(cell.getId()) : ''
      if (id.startsWith('liaison:') || id.startsWith('liaison-pq:') || id.startsWith('liaison-name:')) return false
      return prevIsLabelMovable(cell)
    }

    function LiaisonLineEdgeHandler(state) {
      mxEdgeHandler.call(this, state)
    }
    mxUtils.extend(LiaisonLineEdgeHandler, mxEdgeHandler)
    LiaisonLineEdgeHandler.prototype.isHandlesVisible = function () {
      return false
    }
    LiaisonLineEdgeHandler.prototype.createBends = function () {
      return []
    }
    LiaisonLineEdgeHandler.prototype.createVirtualBends = function () {
      return []
    }
    LiaisonLineEdgeHandler.prototype.createLabelShape = function () {
      return null
    }
    const baseInit = LiaisonLineEdgeHandler.prototype.init
    LiaisonLineEdgeHandler.prototype.init = function () {
      baseInit.apply(this, arguments)
      if (this.shape?.setCursor) this.shape.setCursor('default')
    }

    const prevCreateEdgeHandler = graph.createEdgeHandler.bind(graph)
    graph.createEdgeHandler = function liaisonCreateEdgeHandler(state, edgeStyle) {
      if (isLiaisonLineEdgeCell(state?.cell)) {
        return new LiaisonLineEdgeHandler(state)
      }
      return prevCreateEdgeHandler(state, edgeStyle)
    }
  }

  /** 站间联络图必需的 graph 选项（加载已保存 XML 时不会走 parseSvg，须单独设置） */
  _ensureLiaisonGraphUi(graph) {
    if (!graph) return
    graph.setHtmlLabels(true)
    graph.setPanning(true)
    graph.setCellsEditable(false)
    graph.setConnectable(false)
    graph.setAllowDanglingEdges(false)
    graph.setCellsResizable(false)
    graph.setTooltips(false)
    // 拖动站/开关时勿断开联络边；折点由 _relayoutChannelsForStations 重算
    if (typeof graph.setDisconnectOnMove === 'function') {
      graph.setDisconnectOnMove(false)
    } else {
      graph.disconnectOnMove = false
    }
    graph.resetEdgesOnMove = false
  }

  setData(data) {
    this.data = data || {}
  }

  parseSvg() {
    if (!this.graph) return

    const graph = this.graph
    const model = graph.getModel()
    const parent = graph.getDefaultParent()
    const payload = this.data?.data || {}
    const rawStations = Array.isArray(payload.station_data) ? payload.station_data : []
    const rawChannels = Array.isArray(payload.channel_data) ? payload.channel_data : []

    const stations = rawStations
      .filter(
        (item) =>
          item.station_id &&
          normalizeKV(item.vn_kv) >= 35 &&
          !isExternalBoundaryStation(item.station_name)
      )
      .map((item) => ({
        id: item.station_id,
        name: shortStationName(item.station_name),
        kv: normalizeKV(item.vn_kv),
        lon: Number(item.lon || 0),
        lat: Number(item.lat || 0),
        trafoRows: this.trafoRowsForDisplay(item),
      }))

    const stationById = new Map(stations.map((item) => [item.id, item]))
    const rawStationById = new Map(rawStations.map((item) => [item.station_id, item]))

    /** 保留在 `channel_data` 中的下标，供编辑页写回 JSON（过滤后顺序与原文下标不同） */
    const channelEntries = []
    for (let docChannelIndex = 0; docChannelIndex < rawChannels.length; docChannelIndex++) {
      const item = rawChannels[docChannelIndex]
      const from = stationById.get(item.from_station)
      const to = stationById.get(item.to_station)
      const minKV = Number(item.min_vn_kv || 0)
      if (from && to && minKV >= 35) {
        channelEntries.push({ channel: item, docChannelIndex })
      }
    }
    const channels = channelEntries.map((e) => e.channel)

    const { layoutNodes, busNodeByStationAndName, virtualStationIds, stationById: layoutStationById } =
      prepareLayoutGraph(stations, rawStationById, channels)
    const layoutEdges = buildLayoutEdges(
      channelEntries,
      layoutStationById,
      busNodeByStationAndName,
      virtualStationIds
    )
    applyStationLayout(layoutNodes, layoutEdges, this.options)

    const layoutNodeById = new Map(layoutNodes.map((n) => [n.id, n]))
    const visualLinks = expandChannelsToVisualLinks(
      channelEntries,
      layoutStationById,
      busNodeByStationAndName,
      virtualStationIds,
      layoutNodeById
    )
    const splitCountByDoc = new Map()
    visualLinks.forEach((link) => {
      splitCountByDoc.set(link.docChannelIndex, (splitCountByDoc.get(link.docChannelIndex) || 0) + 1)
    })

    const sidePortTotals = buildSidePortTotalsForEndpoints(visualLinks)
    const sidePortRankByKey = buildSidePortRankForEndpoints(visualLinks)
    const routeObstacles = layoutNodes
    const skipRouteNudge = layoutNodes.length > LIAISON_SKIP_ROUTE_NUDGE_NODES
    const stationIdToDocIndex = new Map()
    rawStations.forEach((r, idx) => {
      if (r?.station_id) stationIdToDocIndex.set(r.station_id, idx)
    })

    const stationsCell = new Map()
    const pairLaneCounter = new Map()
    const edgeCells = []
    const switchCells = []
    const junctionCells = []
    const lineNameCells = []
    const pqMetricCells = []
    const edgeSwitchPairs = []
    const cells = graph.getChildCells(parent, true, true)

    model.beginUpdate()
    try {
      if (cells.length > 0) {
        forceRemoveGraphCells(graph, cells)
      }

      this._ensureLiaisonGraphUi(graph)

      stations.forEach((s) => {
        if (isVirtualT10Station(s.name)) return
        const node = layoutNodeById.get(s.id) || s
        const doc_station_index = stationIdToDocIndex.get(s.id) ?? -1
        const isVirt = Boolean(s.isVirtual)
        const trafoRows = this.trafoRowsForDisplay(s.trafoRows)
        const { html: label, topAlign } = buildStationVertexLabelHtml(
          { ...s, trafoRows },
          this.options.showLabels
        )
        const trafoLabel = Boolean(!isVirt && trafoRows.length)
        const cell = graph.insertVertex(
          parent,
          `station:${s.id}`,
          label,
          node.x,
          node.y,
          node.w,
          node.h,
          isVirt ? virtualT10StationStyle(s.kv) : stationStyleByKV(s.kv, topAlign, trafoLabel)
        )
        cell.entityType = 'station'
        cell.entityInfo = {
          type: 'station',
          doc_station_index: doc_station_index >= 0 ? doc_station_index : null,
          station_id: s.id,
          station_name: s.name,
          vn_kv: s.kv,
          is_virtual: isVirt,
          raw: rawStationById.get(s.id) || null,
        }
        stationsCell.set(s.id, cell)
      })

      layoutNodes.filter((n) => n.isBusNode).forEach((bn) => {
        const parentRaw = rawStationById.get(bn.stationId)
        const cell = graph.insertVertex(
          parent,
          bn.id,
          '',
          bn.x,
          bn.y,
          bn.w,
          bn.h,
          busNodeStyle(bn.kv)
        )
        cell.entityType = 'busnode'
        cell.entityInfo = {
          type: 'busnode',
          station_id: bn.stationId,
          station_name: shortStationName(parentRaw?.station_name),
          bus_name: bn.busName,
          bus_key: bn.busKey,
          vn_kv: bn.kv,
          is_virtual: true,
          raw: parentRaw || null,
        }
      })

      visualLinks.forEach((link, idx) => {
        const { channel, docChannelIndex, lineIndex, lineItem, fromEndpoint, toEndpoint, fromStation, toStation } =
          link
        const splitCount = splitCountByDoc.get(docChannelIndex) || 1
        link.splitCount = splitCount
        const cellSuffix = visualLinkCellSuffix(docChannelIndex, lineIndex, splitCount)

        const laneIndex = laneIndexForVisualLink(link, pairLaneCounter)

        const sides = pickSidesFacingPeer(
          { x: fromEndpoint.x + fromEndpoint.w / 2, y: fromEndpoint.y + fromEndpoint.h / 2 },
          { x: toEndpoint.x + toEndpoint.w / 2, y: toEndpoint.y + toEndpoint.h / 2 }
        )
        const sourcePortKey = `${fromEndpoint.id}:${sides.from}`
        const targetPortKey = `${toEndpoint.id}:${sides.to}`
        const sourceTotal = sidePortTotals.get(sourcePortKey) || 1
        const targetTotal = sidePortTotals.get(targetPortKey) || 1
        const sourceRank = sidePortRankByKey.get(`${idx}@@${sourcePortKey}`) ?? 0
        const targetRank = sidePortRankByKey.get(`${idx}@@${targetPortKey}`) ?? 0
        const sourceOffset = portOffsetForVisualLinkEndpoint(link, fromEndpoint, sides.from, sourceRank, sourceTotal)
        const targetOffset = portOffsetForVisualLinkEndpoint(link, toEndpoint, sides.to, targetRank, targetTotal)

        const trunkStagger = trunkStaggerForVisualLink(link, idx)
        let route = buildOrthogonalRoute(
          fromEndpoint,
          toEndpoint,
          laneIndex,
          sourceOffset,
          targetOffset,
          trunkStagger,
          visualLinkSplitRouteOpts(link)
        )
        if (!skipRouteNudge) {
          route = nudgeRouteAwayFromStations(route, fromEndpoint, toEndpoint, routeObstacles)
        }
        const lineName = lineItem?.name ? String(lineItem.name).trim() : primaryLineNameFromChannel(channel)
        const pFromMw = lineItem ? pickLinePFromMw(lineItem) : pickChannelPFromMw(channel)
        const qFromMvar = lineItem ? pickLineQFromMvar(lineItem) : pickChannelQFromMvar(channel)
        const { style, lineColor, lineW, reverseFlow } = buildLiaisonChannelEdgeStyle(
          fromStation.kv,
          toStation.kv,
          pFromMw
        )
        const jw = 6
        const jh = 6
        const jFrom = graph.insertVertex(
          parent,
          `liaison-j-from:${cellSuffix}`,
          '',
          route.source.x - jw / 2,
          route.source.y - jh / 2,
          jw,
          jh,
          JUNCTION_STYLE
        )
        jFrom.entityType = 'junction'
        const jTo = graph.insertVertex(
          parent,
          `liaison-j-to:${cellSuffix}`,
          '',
          route.target.x - jw / 2,
          route.target.y - jh / 2,
          jw,
          jh,
          JUNCTION_STYLE
        )
        jTo.entityType = 'junction'
        junctionCells.push(jFrom, jTo)

        const edgeSource = reverseFlow ? jTo : jFrom
        const edgeTarget = reverseFlow ? jFrom : jTo
        const lineEntityInfo = {
          type: 'line',
          doc_channel_index: docChannelIndex,
          line_index: lineIndex,
          channel_name: channel.channel_name,
          from_station: channel.from_station,
          to_station: channel.to_station,
          from_station_name: fromStation.name,
          to_station_name: toStation.name,
          from_bus_name: lineItem?.from_bus_name || null,
          to_bus_name: lineItem?.to_bus_name || null,
          link_color: lineColor,
          link_width_px: lineW,
          from_kv: fromStation.kv,
          to_kv: toStation.kv,
          min_vn_kv: channel.min_vn_kv,
          max_vn_kv: channel.max_vn_kv,
          p_from_mw: pFromMw,
          q_from_mvar: qFromMvar,
          line_data: lineItem ? [lineItem] : channel.line_data || [],
          switch_data: channel.switch_data || [],
          raw: channel,
        }
        const edge = graph.insertEdge(parent, `liaison:${cellSuffix}`, '', edgeSource, edgeTarget, style)
        edge.entityType = 'line'
        edge.entityInfo = lineEntityInfo

        const nameLbl = this._syncLineNameLabel({
          suffix: cellSuffix,
          route,
          lineName,
          lineEntityInfo,
          showLabels: this.options.showLabels,
        })
        if (nameLbl) lineNameCells.push(nameLbl)

        const pqBlock = computeLongestSegmentPQBlockPosition(route)
        if (pqBlock) {
          const pqLbl = graph.insertVertex(
            parent,
            `liaison-pq:${cellSuffix}`,
            '',
            pqBlock.x,
            pqBlock.y,
            pqBlock.w,
            pqBlock.h,
            pqMetricStyle(this.options.theme)
          )
          pqLbl.entityType = 'line'
          pqLbl.entityInfo = lineEntityInfo
          this._syncPqLabelContent(graph, pqLbl, pFromMw, qFromMvar)
          pqMetricCells.push(pqLbl)
        }

        const geometry = edge.geometry ? edge.geometry.clone() : new mxGeometry()
        const reversedPts =
          reverseFlow && route.points.length >= 2
            ? [route.points[1], route.points[0]].map((p) => new mxPoint(p.x, p.y))
            : route.points.map((p) => new mxPoint(p.x, p.y))
        geometry.points = reversedPts
        geometry.relative = false
        edge.geometry = geometry
        edgeCells.push(edge)

        const closedFill = switchClosedFill(fromStation.kv, toStation.kv)
        const switchSpecs = buildChannelSwitchSpecs(channel)
        const swSuffix = channelSwitchSuffix(docChannelIndex, lineIndex, splitCount)
        if (splitCount > 1 && lineIndex === 0) {
          this._purgeLegacySharedChannelSwitches(docChannelIndex)
        }
        switchSpecs.forEach((spec) => {
            const sd = channel.switch_data || []
            let switch_doc_index = null
            if (spec.item != null) {
              switch_doc_index = sd.findIndex(
                (x) => x === spec.item || (x && spec.item && String(x.name || '') === String(spec.item.name || ''))
              )
              if (switch_doc_index < 0) switch_doc_index = spec.end === 'to' ? 1 : 0
            }
            const prevForTo =
              route.points.length > 0 ? route.points[route.points.length - 1] : route.source
            const firstTurnForSw = route.points[0] || route.target
            const fromCenterPt = computeSwitchPointOnFirstLeg(route.source, firstTurnForSw)
            const toCenterPt = computeSwitchPointOnFirstLeg(route.target, prevForTo)
            const swRectFrom = switchRectAlongFirstLeg(route.source, firstTurnForSw)
            const swRectTo = switchRectAlongFirstLeg(route.target, prevForTo)
            const isFromEnd = spec.end === 'from'
            const centerPt = isFromEnd ? fromCenterPt : toCenterPt
            const swRect = isFromEnd ? swRectFrom : swRectTo
            let sw = model.getCell(`sw:${swSuffix}:${spec.end}`)
            if (!sw) {
              sw = graph.insertVertex(
                parent,
                `sw:${swSuffix}:${spec.end}`,
                '',
                centerPt.x + swRect.ox,
                centerPt.y + swRect.oy,
                swRect.w,
                swRect.h,
                switchStyle(spec.closed, lineColor, closedFill)
              )
              switchCells.push(sw)
            } else {
              graph.setCellStyle(switchStyle(spec.closed, lineColor, closedFill), [sw])
              const swGeo = model.getGeometry(sw)?.clone()
              if (swGeo) {
                swGeo.x = centerPt.x + swRect.ox
                swGeo.y = centerPt.y + swRect.oy
                swGeo.width = swRect.w
                swGeo.height = swRect.h
                model.setGeometry(sw, swGeo)
              }
            }
            sw.entityType = 'switch'
            sw.entityInfo = {
              type: 'switch',
              doc_channel_index: docChannelIndex,
              line_index: lineIndex,
              switch_doc_index,
              switch_end: spec.end,
              switch_item: spec.item,
              switch_name: spec.item?.name,
              channel_name: channel.channel_name,
              from_station: channel.from_station,
              to_station: channel.to_station,
              from_station_name: fromStation.name,
              to_station_name: toStation.name,
              link_color: lineColor,
              link_width_px: lineW,
              p_from_mw: pFromMw,
              q_from_mvar: qFromMvar,
              closed: spec.closed,
              switch_data: channel.switch_data || [],
              raw: channel,
            }
            edgeSwitchPairs.push({ edge, sw, switchLogicalEnd: spec.end, channelRoute: route, reverseFlow })
          })
      })
    } finally {
      model.endUpdate()
    }

    if (junctionCells.length > 0) graph.orderCells(true, junctionCells)
    if (edgeCells.length > 0) graph.orderCells(true, edgeCells)
    if (lineNameCells.length > 0) graph.orderCells(false, lineNameCells)
    if (pqMetricCells.length > 0) graph.orderCells(false, pqMetricCells)
    if (switchCells.length > 0) graph.orderCells(false, switchCells)

    // absolutePoints 与顶点 geometry 不在同一坐标系，不能直接写入 geometry。
    // 与 GraphTool.getEdgePoints 一致：先转到模型坐标再定位开关。
    const alignSwitchesToRenderedEdges = () => {
      if (!edgeSwitchPairs.length) return
      const view = graph.view
      if (view && typeof view.invalidate === 'function') {
        view.invalidate()
      }
      model.beginUpdate()
      try {
        edgeSwitchPairs.forEach(({ edge, sw, switchLogicalEnd, channelRoute, reverseFlow: rev }) => {
          if (!view || !view.getState(edge)) return
          const geo = model.getGeometry(sw)
          if (!geo) return
          const modelPts = GraphTool.getEdgePoints(graph, edge)
          if (!modelPts || modelPts.length < 2) return
          const n = modelPts.length
          let cx
          let cy
          let sr
          if (switchLogicalEnd === 'from') {
            if (rev && channelRoute) {
              const ft = channelRoute.points[0] || channelRoute.target
              sr = switchRectAlongFirstLeg(channelRoute.source, ft)
              const sp = computeSwitchPointOnFirstLeg(channelRoute.source, ft)
              cx = sp.x + sr.ox
              cy = sp.y + sr.oy
            } else {
              const p0 = modelPts[0]
              const p1 = modelPts[1]
              const dx = p1.x - p0.x
              const dy = p1.y - p0.y
              const len = Math.sqrt(dx * dx + dy * dy) || 1
              if (len < 1) return
              const dist = Math.min(
                SWITCH_DISTANCE_FROM_EXIT_PT,
                Math.max(4, len - SWITCH_RESERVE_BEFORE_CORNER_PT)
              )
              cx = p0.x + (dx / len) * dist
              cy = p0.y + (dy / len) * dist
              sr = switchRectAlongFirstLeg(p0, p1)
              cx += sr.ox
              cy += sr.oy
            }
          } else {
            const pNear = rev ? modelPts[0] : modelPts[n - 1]
            const pOut = rev ? modelPts[1] : modelPts[n - 2]
            const sp = computeSwitchPointOnFirstLeg(pNear, pOut)
            sr = switchRectAlongFirstLeg(pNear, pOut)
            cx = sp.x + sr.ox
            cy = sp.y + sr.oy
          }
          const next = geo.clone()
          next.x = cx
          next.y = cy
          next.width = sr.w
          next.height = sr.h
          model.setGeometry(sw, next)
        })
      } finally {
        model.endUpdate()
      }
    }

    alignSwitchesToRenderedEdges()
    if (typeof window !== 'undefined') {
      window.setTimeout(alignSwitchesToRenderedEdges, 0)
    }

    this._applyFlowMotionState(graph, {
      deferMs: liaisonGraphLoadDeferMs(stations.length, visualLinks.length),
    })
    this.enableManualEdit()
  }

  /** 根据 cell.id 与当前 JSON 重新挂载 entityInfo（加载已保存图形后必须调用） */
  rebindEntityInfo() {
    const graph = this.graph
    if (!graph) return
    const payload = this.data?.data || {}
    const rawStations = Array.isArray(payload.station_data) ? payload.station_data : []
    const rawChannels = Array.isArray(payload.channel_data) ? payload.channel_data : []
    const rawStationById = new Map(rawStations.map((item) => [item.station_id, item]))
    const parent = graph.getDefaultParent()
    const cells = graph.getChildCells(parent, true, true) || []

    const stationNameById = new Map()
    rawStations.forEach((s) => {
      stationNameById.set(s.station_id, shortStationName(s.station_name))
    })

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      if (!id) continue

      if (id.startsWith('station:')) {
        const stationId = id.slice('station:'.length)
        const doc_station_index = rawStations.findIndex((r) => r.station_id === stationId)
        const raw = rawStationById.get(stationId)
        const kv = normalizeKV(raw?.vn_kv)
        cell.entityType = 'station'
        cell.entityInfo = {
          type: 'station',
          doc_station_index: doc_station_index >= 0 ? doc_station_index : null,
          station_id: stationId,
          station_name: stationNameById.get(stationId) || stationId,
          vn_kv: kv,
          is_virtual: isVirtualT10Station(raw?.station_name),
          raw: raw || null,
        }
        continue
      }

      const chMatch = id.match(/^liaison:(.+)$/)
      if (chMatch) {
        const parsed = parseGraphChannelSuffix(chMatch[1])
        if (!parsed) continue
        const channel = rawChannels[parsed.docChannelIndex]
        if (!channel) continue
        const info = buildLineEntityInfoFromChannel(
          channel,
          parsed.docChannelIndex,
          parsed.lineIndex,
          stationNameById,
          rawStationById
        )
        cell.entityType = 'line'
        cell.entityInfo = info
        continue
      }

      if (id.startsWith('busnode:')) {
        const parts = id.split(':')
        const stationId = parts[1]
        const busKey = parts.slice(2).join(':')
        const raw = rawStationById.get(stationId)
        if (!raw) continue
        cell.entityType = 'busnode'
        cell.entityInfo = {
          type: 'busnode',
          station_id: stationId,
          station_name: stationNameById.get(stationId) || shortStationName(raw.station_name),
          bus_name: cell.entityInfo?.bus_name || `${raw.station_name}.${busKey}`,
          bus_key: busKey,
          vn_kv: normalizeKV(raw.vn_kv),
          is_virtual: true,
          raw,
        }
        continue
      }

      if (id.startsWith('liaison-j-')) {
        cell.entityType = 'junction'
        const jm = id.match(/^liaison-j-(?:from|to):(.+)$/)
        if (jm) {
          const parsed = parseGraphChannelSuffix(jm[1])
          if (!parsed) continue
          const channel = rawChannels[parsed.docChannelIndex]
          if (channel) {
            cell.entityInfo = buildLineEntityInfoFromChannel(
              channel,
              parsed.docChannelIndex,
              parsed.lineIndex,
              stationNameById,
              rawStationById
            )
          }
        }
        continue
      }

      if (id.startsWith('liaison-pq:') || id.startsWith('liaison-name:')) {
        const prefix = id.startsWith('liaison-pq:') ? 'liaison-pq:' : 'liaison-name:'
        const parsed = parseGraphChannelSuffix(id.slice(prefix.length))
        if (!parsed) continue
        const channel = rawChannels[parsed.docChannelIndex]
        if (channel) {
          cell.entityType = 'line'
          cell.entityInfo = buildLineEntityInfoFromChannel(
            channel,
            parsed.docChannelIndex,
            parsed.lineIndex,
            stationNameById,
            rawStationById
          )
        }
        continue
      }

      const swMatch = id.match(/^sw:(\d+(?::\d+)?):(from|to)$/)
      if (swMatch) {
        const parsed = parseGraphChannelSuffix(swMatch[1])
        if (!parsed) continue
        const end = swMatch[2]
        const channel = rawChannels[parsed.docChannelIndex]
        if (!channel) continue
        const sd = channel.switch_data || []
        const switch_doc_index = end === 'to' ? 1 : 0
        const item = sd[switch_doc_index] || null
        const from = rawStationById.get(channel.from_station)
        const to = rawStationById.get(channel.to_station)
        const fromKv = normalizeKV(from?.vn_kv)
        const toKv = normalizeKV(to?.vn_kv)
        const lineColor = linkStrokeColor(fromKv, toKv)
        const lineW = linkStrokeWidthPx(fromKv, toKv)
        const lineItem = pickChannelLineItem(channel, parsed.lineIndex)
        const pFromMw = lineItem ? pickLinePFromMw(lineItem) : pickChannelPFromMw(channel)
        cell.entityType = 'switch'
        cell.entityInfo = {
          type: 'switch',
          doc_channel_index: parsed.docChannelIndex,
          line_index: parsed.lineIndex,
          switch_doc_index: item != null ? switch_doc_index : null,
          switch_end: end,
          switch_item: item,
          switch_name: item?.name,
          from_station: channel.from_station,
          to_station: channel.to_station,
          from_station_name: stationNameById.get(channel.from_station),
          to_station_name: stationNameById.get(channel.to_station),
          link_color: lineColor,
          link_width_px: lineW,
          p_from_mw: pFromMw,
          q_from_mvar: lineItem ? pickLineQFromMvar(lineItem) : pickChannelQFromMvar(channel),
          closed: item ? item.closed !== false : pickSwitchStateFallbackFromLines(channel),
          switch_data: sd,
          raw: channel,
        }
      }
    }
  }

  _buildChannelRouteContext() {
    const layoutNodes = this._buildStationsFromGraph()
    const layoutNodeById = new Map(layoutNodes.map((n) => [n.id, n]))

    const rawStations = this.data?.data?.station_data || []
    const stationById = new Map()
    const virtualStationIds = new Set()
    rawStations.forEach((raw) => {
      const kv = normalizeKV(raw.vn_kv)
      if (!raw.station_id || kv < 35) return
      const name = shortStationName(raw.station_name)
      if (isVirtualT10Station(name)) virtualStationIds.add(raw.station_id)
      stationById.set(raw.station_id, {
        id: raw.station_id,
        name,
        kv,
        isVirtual: isVirtualT10Station(name),
      })
    })

    const busNodeByStationAndName = new Map()
    layoutNodes.forEach((n) => {
      if (!n.isBusNode) return
      busNodeByStationAndName.set(`${n.stationId}::${normalizeBusName(n.busName)}`, n)
      busNodeByStationAndName.set(`${n.stationId}::${n.busKey}`, n)
    })

    const rawChannels = this.data?.data?.channel_data || []
    const channelEntries = []
    for (let docChannelIndex = 0; docChannelIndex < rawChannels.length; docChannelIndex++) {
      const ch = rawChannels[docChannelIndex]
      if (
        stationById.has(ch.from_station) &&
        stationById.has(ch.to_station) &&
        Number(ch.min_vn_kv || 0) >= 35
      ) {
        channelEntries.push({ channel: ch, docChannelIndex })
      }
    }

    const visualLinks = expandChannelsToVisualLinks(
      channelEntries,
      stationById,
      busNodeByStationAndName,
      virtualStationIds,
      layoutNodeById
    )

    const splitCountByDoc = new Map()
    visualLinks.forEach((link) => {
      splitCountByDoc.set(link.docChannelIndex, (splitCountByDoc.get(link.docChannelIndex) || 0) + 1)
    })
    visualLinks.forEach((link) => {
      link.splitCount = splitCountByDoc.get(link.docChannelIndex) || 1
    })

    const sidePortTotals = buildSidePortTotalsForEndpoints(visualLinks)
    const sidePortRankByKey = buildSidePortRankForEndpoints(visualLinks)

    const laneByVisualLinkKey = new Map()
    const pairLaneCounter = new Map()
    visualLinks.forEach((link, idx) => {
      link._visualIdx = idx
      const laneIndex = laneIndexForVisualLink(link, pairLaneCounter)
      laneByVisualLinkKey.set(`${link.docChannelIndex}:${link.lineIndex}`, laneIndex)
    })

    return {
      layoutNodes,
      layoutNodeById,
      stationById,
      visualLinks,
      channelEntries,
      sidePortTotals,
      sidePortRankByKey,
      laneByVisualLinkKey,
      virtualStationIds,
      busNodeByStationAndName,
    }
  }

  _computeVisualLinkRoute(link, ctx) {
    const { fromEndpoint, toEndpoint } = link
    if (!fromEndpoint || !toEndpoint) return null
    if (fromEndpoint.x == null || toEndpoint.x == null) return null

    const idx = link._visualIdx ?? 0
    const laneKey = `${link.docChannelIndex}:${link.lineIndex}`
    const laneIndex = ctx.laneByVisualLinkKey?.get(laneKey) ?? 0

    const sides = pickSidesFacingPeer(
      { x: fromEndpoint.x + fromEndpoint.w / 2, y: fromEndpoint.y + fromEndpoint.h / 2 },
      { x: toEndpoint.x + toEndpoint.w / 2, y: toEndpoint.y + toEndpoint.h / 2 }
    )
    const sourcePortKey = `${fromEndpoint.id}:${sides.from}`
    const targetPortKey = `${toEndpoint.id}:${sides.to}`
    const sourceTotal = ctx.sidePortTotals.get(sourcePortKey) || 1
    const targetTotal = ctx.sidePortTotals.get(targetPortKey) || 1
    const sourceRank = ctx.sidePortRankByKey.get(`${idx}@@${sourcePortKey}`) ?? 0
    const targetRank = ctx.sidePortRankByKey.get(`${idx}@@${targetPortKey}`) ?? 0
    const sourceOffset = portOffsetForVisualLinkEndpoint(link, fromEndpoint, sides.from, sourceRank, sourceTotal)
    const targetOffset = portOffsetForVisualLinkEndpoint(link, toEndpoint, sides.to, targetRank, targetTotal)
    const trunkStagger = trunkStaggerForVisualLink(link, idx)
    let route = buildOrthogonalRoute(
      fromEndpoint,
      toEndpoint,
      laneIndex,
      sourceOffset,
      targetOffset,
      trunkStagger,
      visualLinkSplitRouteOpts(link)
    )
    route = nudgeRouteAwayFromStations(route, fromEndpoint, toEndpoint, ctx.layoutNodes)
    return route
  }

  /** 拖动时按最新站位置算路由，不用旧折点 */
  _computeVisualLinkRouteOrBuild(link, ctx) {
    if (!link?.channel || !ctx) return null
    link.fromEndpoint =
      ctx.layoutNodeById?.get(link.channel.from_station) || link.fromEndpoint
    link.toEndpoint = ctx.layoutNodeById?.get(link.channel.to_station) || link.toEndpoint
    link.fromStation = link.fromStation || ctx.stationById?.get(link.channel.from_station)
    link.toStation = link.toStation || ctx.stationById?.get(link.channel.to_station)
    return this._computeVisualLinkRoute(link, ctx)
  }

  /** 拖动/relayout 时解析通道图元（按线路名+起终点，不受 usedSuffixes 影响） */
  _resolveVisualLinkBundle(docChannelIndex, lineIndex, channel) {
    if (docChannelIndex == null || !channel) return null
    const splitCount = channelLineSplitCount(channel)
    const expectedSuffix = visualLinkCellSuffix(docChannelIndex, lineIndex, splitCount)

    const atExpected = this._resolveChannelGraphCellsBySuffix(expectedSuffix)
    if (
      atExpected?.jFrom &&
      atExpected?.jTo &&
      atExpected?.edge &&
      this._graphEdgeMatchesDocChannel(
        {
          suffix: expectedSuffix,
          edge: atExpected.edge,
          from: atExpected.edge.entityInfo?.from_station,
          to: atExpected.edge.entityInfo?.to_station,
          lineName: this._lineNameForChannelLine(channel, lineIndex),
        },
        channel,
        lineIndex,
        { skipGeometry: true }
      )
    ) {
      return atExpected
    }

    const resolved = this._resolveChannelGraphCells(docChannelIndex, lineIndex)
    if (resolved?.jFrom && resolved?.jTo && resolved?.edge) return resolved

    const pickSuffix = this._pickGraphSuffixForDocChannel(channel, new Set(), lineIndex, docChannelIndex)
    if (pickSuffix) {
      const picked = this._resolveChannelGraphCellsBySuffix(pickSuffix)
      if (picked?.jFrom && picked?.jTo && picked?.edge) return picked
    }
    return null
  }

  /** 拖动后把画布 suffix 与文档下标对齐（仅 id 重命名，不改几何） */
  _syncGraphSuffixesForDocChannels(docChannelIndices) {
    const graph = this.graph
    const channels = this.data?.data?.channel_data || []
    if (!graph || !docChannelIndices?.length) return

    const mappings = []
    for (let ii = 0; ii < docChannelIndices.length; ii++) {
      const docIdx = docChannelIndices[ii]
      const ch = channels[docIdx]
      if (!ch) continue
      const splitCount = channelLineSplitCount(ch)
      const lineCount = splitCount > 1 ? splitCount : 1
      for (let li = 0; li < lineCount; li++) {
        const expected = visualLinkCellSuffix(docIdx, li, splitCount)
        const bundle = this._resolveChannelGraphCells(docIdx, li)
        if (!bundle?.edge || bundle.suffix === expected) continue
        mappings.push({ oldSuffix: bundle.suffix, newSuffix: expected })
      }
    }
    if (!mappings.length) return

    for (let i = 0; i < mappings.length; i++) {
      this._renameChannelCellSuffix(mappings[i].oldSuffix, `__t${mappings[i].oldSuffix}`)
    }
    const phase2 = [...mappings].sort((a, b) => {
      const ao = parseGraphChannelSuffix(a.oldSuffix)?.docChannelIndex ?? 0
      const bo = parseGraphChannelSuffix(b.oldSuffix)?.docChannelIndex ?? 0
      return bo - ao
    })
    for (let i = 0; i < phase2.length; i++) {
      this._renameChannelCellSuffix(`__t${phase2[i].oldSuffix}`, phase2[i].newSuffix)
    }
    this._repairSwitchIdsAfterResync(mappings)
  }

  _computeChannelRoute(docChannelIndex, ctx) {
    const link = ctx.visualLinks?.find((l) => l.docChannelIndex === docChannelIndex && l.lineIndex === 0)
    if (link) return this._computeVisualLinkRoute(link, ctx)
    return null
  }

  _switchCellMatchesChannelLine(cell, channel, docChannelIndex, lineIndex, end) {
    if (!cell || !channel || docChannelIndex == null) return false
    const ei = cell.entityInfo
    if (
      ei?.doc_channel_index === docChannelIndex &&
      (ei?.line_index ?? 0) === lineIndex &&
      (ei?.switch_end || end) === end
    ) {
      return true
    }
    if (ei?.switch_end && ei.switch_end !== end) return false
    if (ei?.line_index != null && ei.line_index !== lineIndex) return false
    if (ei?.from_station && ei?.to_station) {
      if (!this._channelPairMatchesStations(ei.from_station, ei.to_station, channel)) return false
      const spec = buildChannelSwitchSpecs(channel).find((s) => s.end === end)
      const wantName = spec?.item?.name ? String(spec.item.name).trim() : ''
      const eiName = ei?.switch_name ? String(ei.switch_name).trim() : ''
      if (wantName && eiName && wantName !== eiName) return false
      return true
    }
    return false
  }

  _positionSwitchFromRoute(switchLogicalEnd, channelRoute, reverseFlow, modelPts) {
    if (modelPts && modelPts.length >= 2) {
      const n = modelPts.length
      if (switchLogicalEnd === 'from') {
        if (reverseFlow && channelRoute) {
          const ft = channelRoute.points[0] || channelRoute.target
          const sr = switchRectAlongFirstLeg(channelRoute.source, ft)
          const sp = computeSwitchPointOnFirstLeg(channelRoute.source, ft)
          return { cx: sp.x + sr.ox, cy: sp.y + sr.oy, sr }
        }
        const p0 = modelPts[0]
        const p1 = modelPts[1]
        const dx = p1.x - p0.x
        const dy = p1.y - p0.y
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        if (len < 1) return null
        const dist = Math.min(
          SWITCH_DISTANCE_FROM_EXIT_PT,
          Math.max(4, len - SWITCH_RESERVE_BEFORE_CORNER_PT)
        )
        let cx = p0.x + (dx / len) * dist
        let cy = p0.y + (dy / len) * dist
        const sr = switchRectAlongFirstLeg(p0, p1)
        cx += sr.ox
        cy += sr.oy
        return { cx, cy, sr }
      }
      const pNear = reverseFlow ? modelPts[0] : modelPts[n - 1]
      const pOut = reverseFlow ? modelPts[1] : modelPts[n - 2]
      const sp = computeSwitchPointOnFirstLeg(pNear, pOut)
      const sr = switchRectAlongFirstLeg(pNear, pOut)
      return { cx: sp.x + sr.ox, cy: sp.y + sr.oy, sr }
    }
    if (!channelRoute) return null
    if (switchLogicalEnd === 'from') {
      const ft = channelRoute.points[0] || channelRoute.target
      const sr = switchRectAlongFirstLeg(channelRoute.source, ft)
      const sp = computeSwitchPointOnFirstLeg(channelRoute.source, ft)
      return { cx: sp.x + sr.ox, cy: sp.y + sr.oy, sr }
    }
    const prevForTo =
      channelRoute.points.length > 0
        ? channelRoute.points[channelRoute.points.length - 1]
        : channelRoute.source
    const sp = computeSwitchPointOnFirstLeg(channelRoute.target, prevForTo)
    const sr = switchRectAlongFirstLeg(channelRoute.target, prevForTo)
    return { cx: sp.x + sr.ox, cy: sp.y + sr.oy, sr }
  }

  _alignChannelSwitchPairs(edgeSwitchPairs) {
    const graph = this.graph
    const model = graph?.getModel()
    if (!graph || !model || !edgeSwitchPairs?.length) return
    if (graph.view?.invalidate) graph.view.invalidate()
    model.beginUpdate()
    try {
      edgeSwitchPairs.forEach(({ edge, sw, switchLogicalEnd, channelRoute, reverseFlow: rev }) => {
        const geo = model.getGeometry(sw)
        if (!geo || !edge) return
        const modelPts = GraphTool.getEdgePoints(graph, edge)
        const pos = this._positionSwitchFromRoute(switchLogicalEnd, channelRoute, rev, modelPts)
        if (!pos) return
        const next = geo.clone()
        next.x = pos.cx
        next.y = pos.cy
        next.width = pos.sr.w
        next.height = pos.sr.h
        model.setGeometry(sw, next)
      })
    } finally {
      model.endUpdate()
    }
  }

  /** 拖动站后：凡连接该站的开关一律沿对应边重定位（含 id 未对齐的遗留开关） */
  _realignSwitchesTouchingStations(stationIds) {
    const graph = this.graph
    const model = graph?.getModel()
    if (!graph || !model || !stationIds?.size) return

    const channels = this.data?.data?.channel_data || []
    const ctx = this._buildChannelRouteContext()
    const allPairs = []
    const cells = graph.getChildCells(graph.getDefaultParent(), true, true) || []

    for (let i = 0; i < cells.length; i++) {
      const sw = cells[i]
      const id = typeof sw.getId === 'function' ? String(sw.getId()) : ''
      const m = id.match(/^sw:(.+):(from|to)$/)
      if (!m) continue

      const end = m[2]
      const ei = sw.entityInfo
      const fromId = ei?.from_station
      const toId = ei?.to_station
      if (!fromId && !toId) continue
      if (!stationIds.has(fromId) && !stationIds.has(toId)) continue

      let docChannelIndex = ei?.doc_channel_index
      let lineIndex = ei?.line_index ?? 0
      let channel = docChannelIndex != null ? channels[docChannelIndex] : null

      if (!channel || docChannelIndex < 0 || docChannelIndex >= channels.length) {
        for (let ci = 0; ci < channels.length; ci++) {
          const ch = channels[ci]
          if (!fromId || !toId) continue
          if (!this._channelPairMatchesStations(fromId, toId, ch)) continue
          docChannelIndex = ci
          lineIndex = 0
          channel = ch
          break
        }
      }
      if (!channel) continue

      const splitCount = channelLineSplitCount(channel)
      const parsed = parseGraphChannelSuffix(m[1])
      if (parsed && (ei?.line_index == null || ei.line_index === 0)) {
        lineIndex = parsed.lineIndex
      }

      let bundle = this._resolveChannelGraphCells(docChannelIndex, lineIndex)
      if (!bundle?.edge) continue

      const links = (ctx.visualLinks || []).filter((l) => l.docChannelIndex === docChannelIndex)
      const link = links.find((l) => l.lineIndex === lineIndex) || links[0]
      let route = link ? this._computeVisualLinkRouteOrBuild(link, ctx) : null
      if (!route) route = routeFromChannelBundle(graph, bundle, bundle.edge)
      if (!route) continue

      const lineItem = pickChannelLineItem(channel, lineIndex)
      const pFromMw = lineItem ? pickLinePFromMw(lineItem) : pickChannelPFromMw(channel)
      const reverseFlow = pFromMw != null && pFromMw < -FLOW_P_EPS

      allPairs.push({
        edge: bundle.edge,
        sw,
        switchLogicalEnd: ei?.switch_end || end,
        channelRoute: route,
        reverseFlow,
      })
    }

    if (graph.view?.validate) graph.view.validate()
    this._alignChannelSwitchPairs(allPairs)
    if (typeof window !== 'undefined' && allPairs.length) {
      window.setTimeout(() => this._alignChannelSwitchPairs(allPairs), 0)
    }
  }

  /** 按当前线路几何重定位指定通道的全部开关（删站/resync/拖动后补正） */
  _realignSwitchesForDocChannels(docChannelIndices, ctx) {
    const graph = this.graph
    if (!graph || !docChannelIndices?.length) return
    const routeCtx = ctx || this._buildChannelRouteContext()
    const channels = this.data?.data?.channel_data || []
    const allPairs = []

    for (let ii = 0; ii < docChannelIndices.length; ii++) {
      const docChannelIndex = docChannelIndices[ii]
      const channel = channels[docChannelIndex]
      if (!channel) continue
      const splitCount = channelLineSplitCount(channel)
      const lineCount = splitCount > 1 ? splitCount : 1
      const links = (routeCtx.visualLinks || []).filter((l) => l.docChannelIndex === docChannelIndex)

      for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
        const link = links.find((l) => l.lineIndex === lineIndex) || links[0]
        let bundle = this._resolveChannelGraphCells(docChannelIndex, lineIndex)
        if (!bundle?.edge) {
          bundle = this._resolveChannelGraphCellsBySuffix(
            visualLinkCellSuffix(docChannelIndex, lineIndex, splitCount)
          )
        }
        if (!bundle?.jFrom || !bundle?.jTo || !bundle?.edge) continue

        let route = link ? this._computeVisualLinkRouteOrBuild(link, routeCtx) : null
        if (!route) route = routeFromChannelBundle(graph, bundle, bundle.edge)
        if (!route) continue

        const lineItem = pickChannelLineItem(channel, lineIndex)
        const pFromMw = lineItem ? pickLinePFromMw(lineItem) : pickChannelPFromMw(channel)
        const reverseFlow = pFromMw != null && pFromMw < -FLOW_P_EPS
        const switchSpecs = buildChannelSwitchSpecs(channel)

        switchSpecs.forEach((spec) => {
          const sw = this._resolveSwitchCell(
            docChannelIndex,
            lineIndex,
            splitCount,
            spec.end,
            channel,
            bundle.suffix
          )
          if (!sw) return
          allPairs.push({
            edge: bundle.edge,
            sw,
            switchLogicalEnd: spec.end,
            channelRoute: route,
            reverseFlow,
          })
        })
      }
    }

    if (graph.view?.validate) graph.view.validate()
    this._alignChannelSwitchPairs(allPairs)
    if (typeof window !== 'undefined' && allPairs.length) {
      window.setTimeout(() => this._alignChannelSwitchPairs(allPairs), 0)
    }
  }

  _relayoutChannelAtDocIndex(docChannelIndex, ctx, usedSuffixes = new Set()) {
    const links = (ctx?.visualLinks || []).filter((l) => l.docChannelIndex === docChannelIndex)
    if (links.length > 0) {
      links.forEach((link) => this._relayoutVisualLink(link, ctx, usedSuffixes))
      return
    }
    const channel = this.data?.data?.channel_data?.[docChannelIndex]
    const link = {
      channel,
      docChannelIndex,
      lineIndex: 0,
      lineItem: channel?.line_data?.[0] ?? null,
      splitCount: 1,
      fromEndpoint: ctx?.layoutNodeById?.get(channel?.from_station),
      toEndpoint: ctx?.layoutNodeById?.get(channel?.to_station),
      fromStation: ctx?.stationById?.get(channel?.from_station),
      toStation: ctx?.stationById?.get(channel?.to_station),
      _visualIdx: 0,
    }
    if (link.channel && link.fromEndpoint && link.toEndpoint) {
      this._relayoutVisualLink(link, ctx, usedSuffixes)
    }
  }

  _relayoutVisualLink(link, ctx, _usedSuffixes = new Set()) {
    const graph = this.graph
    const model = graph?.getModel()
    const channel = link.channel
    const docChannelIndex = link.docChannelIndex
    const lineIdx = link.lineIndex ?? 0
    if (!graph || !model || !channel) return

    link.fromEndpoint =
      ctx?.layoutNodeById?.get(channel.from_station) || link.fromEndpoint
    link.toEndpoint = ctx?.layoutNodeById?.get(channel.to_station) || link.toEndpoint
    link.fromStation = link.fromStation || ctx?.stationById?.get(channel.from_station)
    link.toStation = link.toStation || ctx?.stationById?.get(channel.to_station)

    const splitCount = link.splitCount || channelLineSplitCount(channel)
    const expectedSuffix = visualLinkCellSuffix(docChannelIndex, lineIdx, splitCount)
    const bundle = this._resolveVisualLinkBundle(docChannelIndex, lineIdx, channel)
    if (!bundle?.jFrom || !bundle?.jTo || !bundle?.edge) return
    const { jFrom, jTo, edge } = bundle
    const actualSuffix = bundle.suffix

    const route = this._computeVisualLinkRouteOrBuild(link, ctx)
    if (!route) return

    const jw = 6
    const jh = 6
    const pFromMw = link.lineItem ? pickLinePFromMw(link.lineItem) : pickChannelPFromMw(channel)
    const qFromMvar = link.lineItem ? pickLineQFromMvar(link.lineItem) : pickChannelQFromMvar(channel)
    const reverseFlow = pFromMw != null && pFromMw < -FLOW_P_EPS
    const reversedPts =
      reverseFlow && route.points.length >= 2
        ? [route.points[1], route.points[0]].map((p) => new mxPoint(p.x, p.y))
        : route.points.map((p) => new mxPoint(p.x, p.y))

    const switchSpecs = buildChannelSwitchSpecs(channel)
    const from = link.fromStation || ctx.stationById.get(channel.from_station)
    const to = link.toStation || ctx.stationById.get(channel.to_station)
    const lineColor = from && to ? linkStrokeColor(from.kv, to.kv) : ''
    const lineW = from && to ? linkStrokeWidthPx(from.kv, to.kv) : 1
    const closedFill = from && to ? switchClosedFill(from.kv, to.kv) : ''
    const parent = graph.getDefaultParent()
    const edgeSwitchPairs = []

    model.beginUpdate()
    try {
      const jfGeo = model.getGeometry(jFrom)?.clone()
      if (jfGeo) {
        jfGeo.x = route.source.x - jw / 2
        jfGeo.y = route.source.y - jh / 2
        model.setGeometry(jFrom, jfGeo)
      }
      const jtGeo = model.getGeometry(jTo)?.clone()
      if (jtGeo) {
        jtGeo.x = route.target.x - jw / 2
        jtGeo.y = route.target.y - jh / 2
        model.setGeometry(jTo, jtGeo)
      }
      const edgeGeo = model.getGeometry(edge)?.clone()
      if (edgeGeo) {
        edgeGeo.points = reversedPts
        edgeGeo.relative = false
        edgeGeo.offset = null
        edgeGeo.sourcePoint = null
        edgeGeo.targetPoint = null
        model.setGeometry(edge, edgeGeo)
      }
      model.setValue(edge, '')
      const lineName = link.lineItem?.name
        ? String(link.lineItem.name).trim()
        : primaryLineNameFromChannel(channel)
      const labelSuffix = expectedSuffix
      this._syncLineNameLabel({
        suffix: labelSuffix,
        route,
        lineName,
        lineEntityInfo: edge.entityInfo,
        showLabels: this.options.showLabels,
      })
      if (actualSuffix !== expectedSuffix) {
        const stray = []
        const strayName = model.getCell(`liaison-name:${actualSuffix}`)
        const strayPq = model.getCell(`liaison-pq:${actualSuffix}`)
        if (strayName) stray.push(strayName)
        if (strayPq) stray.push(strayPq)
        if (stray.length) forceRemoveGraphCells(graph, stray)
      }
      const pqLbl = model.getCell(`liaison-pq:${labelSuffix}`)
      const pqBlock = computeLongestSegmentPQBlockPosition(route)
      if (pqLbl && pqBlock) {
        const pqGeo = model.getGeometry(pqLbl)?.clone()
        if (pqGeo) {
          pqGeo.x = pqBlock.x
          pqGeo.y = pqBlock.y
          pqGeo.width = pqBlock.w
          pqGeo.height = pqBlock.h
          model.setGeometry(pqLbl, pqGeo)
        }
        this._syncPqLabelContent(graph, pqLbl, pFromMw, qFromMvar)
      }
    } finally {
      model.endUpdate()
    }

    if (from && to) {
      if (splitCount > 1 && lineIdx === 0) {
        this._purgeLegacySharedChannelSwitches(docChannelIndex)
      }
      const neededEnds = new Set(switchSpecs.map((s) => s.end))
      ;['from', 'to'].forEach((end) => {
        if (neededEnds.has(end)) return
        const orphan = model.getCell(this._canonicalSwitchCellId(docChannelIndex, lineIdx, splitCount, end))
        if (orphan) forceRemoveGraphCells(graph, [orphan])
      })

      switchSpecs.forEach((spec) => {
        const prevForTo = route.points.length > 0 ? route.points[route.points.length - 1] : route.source
        const firstTurnForSw = route.points[0] || route.target
        const swRect =
          spec.end === 'from'
            ? switchRectAlongFirstLeg(route.source, firstTurnForSw)
            : switchRectAlongFirstLeg(route.target, prevForTo)
        const centerPt =
          spec.end === 'from'
            ? computeSwitchPointOnFirstLeg(route.source, firstTurnForSw)
            : computeSwitchPointOnFirstLeg(route.target, prevForTo)
        let sw = this._resolveSwitchCell(
          docChannelIndex,
          link.lineIndex ?? 0,
          splitCount,
          spec.end,
          channel,
          actualSuffix
        )
        if (!sw) {
          sw = graph.insertVertex(
            parent,
            this._canonicalSwitchCellId(docChannelIndex, link.lineIndex ?? 0, splitCount, spec.end),
            '',
            centerPt.x + swRect.ox,
            centerPt.y + swRect.oy,
            swRect.w,
            swRect.h,
            switchStyle(spec.closed, lineColor, closedFill)
          )
          graph.orderCells(false, [sw])
        } else {
          graph.setCellStyle(switchStyle(spec.closed, lineColor, closedFill), [sw])
        }
        this._bindSwitchEntityInfo(
          sw,
          spec,
          docChannelIndex,
          channel,
          from,
          to,
          lineColor,
          lineW,
          pFromMw,
          qFromMvar,
          link.lineIndex ?? 0
        )
        edgeSwitchPairs.push({
          edge,
          sw,
          switchLogicalEnd: spec.end,
          channelRoute: route,
          reverseFlow,
        })
      })

      model.beginUpdate()
      try {
        switchSpecs.forEach((spec) => {
          const sw = model.getCell(
            this._canonicalSwitchCellId(docChannelIndex, link.lineIndex ?? 0, splitCount, spec.end)
          )
          if (!sw) return
          const prevForTo = route.points.length > 0 ? route.points[route.points.length - 1] : route.source
          const firstTurnForSw = route.points[0] || route.target
          const swRect =
            spec.end === 'from'
              ? switchRectAlongFirstLeg(route.source, firstTurnForSw)
              : switchRectAlongFirstLeg(route.target, prevForTo)
          const centerPt =
            spec.end === 'from'
              ? computeSwitchPointOnFirstLeg(route.source, firstTurnForSw)
              : computeSwitchPointOnFirstLeg(route.target, prevForTo)
          const swGeo = model.getGeometry(sw)?.clone()
          if (swGeo) {
            swGeo.x = centerPt.x + swRect.ox
            swGeo.y = centerPt.y + swRect.oy
            swGeo.width = swRect.w
            swGeo.height = swRect.h
            model.setGeometry(sw, swGeo)
          }
        })
      } finally {
        model.endUpdate()
      }

      this._alignChannelSwitchPairs(edgeSwitchPairs)
      if (typeof window !== 'undefined' && edgeSwitchPairs.length) {
        window.setTimeout(() => this._alignChannelSwitchPairs(edgeSwitchPairs), 0)
      }
    }

    if (graph.view) {
      graph.view.invalidate(jFrom, false, false)
      graph.view.invalidate(jTo, false, false)
      graph.view.invalidate(edge, false, false)
    }
  }

  _relayoutChannelsForStations(stationIds) {
    const graph = this.graph
    if (!graph || !stationIds?.size) return
    const channels = this.data?.data?.channel_data || []
    const affected = new Set()
    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i]
      if (stationIds.has(ch.from_station) || stationIds.has(ch.to_station)) {
        affected.add(i)
      }
    }
    if (!affected.size) return

    const ctx = this._buildChannelRouteContext()
    const affectedList = [...affected]
    affectedList.forEach((docChannelIndex) => {
      this._relayoutChannelAtDocIndex(docChannelIndex, ctx, new Set())
    })
    this._syncGraphSuffixesForDocChannels(affectedList)
    this._realignSwitchesForDocChannels(affectedList, ctx)
    this._realignSwitchesTouchingStations(stationIds)
    this.purgeOrphanChannelGraphCells()
    this._purgeOrphanLineNameLabels()
    this._purgeDuplicateLineNameLabels()
    this._purgeNonCanonicalLineNameLabels()
    if (graph.view?.validate) graph.view.validate()
    this._applyFlowMotionState(graph)
  }

  /** 从 CELLS_MOVED 事件中的图元解析被拖动的站 id（含 T 母线圆 busnode） */
  _stationIdsFromMovedCells(cells) {
    const graph = this.graph
    const model = graph?.getModel()
    if (!model || !cells?.length) return new Set()
    const stationIds = new Set()
    for (let i = 0; i < cells.length; i++) {
      let cell = cells[i]
      const directId = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      if (directId.startsWith('busnode:')) {
        const sid = directId.split(':')[1]
        if (sid) stationIds.add(sid)
        continue
      }
      while (cell) {
        const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
        if (id.startsWith('busnode:')) {
          const sid = id.split(':')[1]
          if (sid) stationIds.add(sid)
          break
        }
        if (id.startsWith('station:')) {
          stationIds.add(id.slice('station:'.length))
          break
        }
        const ei = cell.entityInfo
        if (ei?.type === 'busnode' && ei.station_id) {
          stationIds.add(ei.station_id)
          break
        }
        if (ei?.type === 'station' && ei.station_id) {
          stationIds.add(ei.station_id)
          break
        }
        cell = model.getParent(cell)
      }
    }
    return stationIds
  }

  _installStationMoveListener() {
    const graph = this.graph
    if (!graph || graph._liaisonStationMoveListener || typeof mxEvent === 'undefined') return
    graph._liaisonStationMoveListener = true
    let relayoutTimer = null
    let pendingStationIds = new Set()

    const scheduleRelayout = () => {
      if (typeof window === 'undefined') {
        if (pendingStationIds.size > 0) {
          this._relayoutChannelsForStations(pendingStationIds)
          pendingStationIds = new Set()
        }
        return
      }
      if (relayoutTimer != null) window.clearTimeout(relayoutTimer)
      relayoutTimer = window.setTimeout(() => {
        relayoutTimer = null
        const ids = pendingStationIds
        pendingStationIds = new Set()
        if (ids.size > 0) this._relayoutChannelsForStations(ids)
      }, 0)
    }

    graph.addListener(mxEvent.CELLS_MOVED, (_sender, evt) => {
      const moved = this._stationIdsFromMovedCells(evt.getProperty('cells') || [])
      if (!moved.size) return
      moved.forEach((id) => pendingStationIds.add(id))
      scheduleRelayout()
    })
  }

  /** 允许拖动变电站与开关；线路、结点及折点固定不可拖弯 */
  enableManualEdit() {
    const graph = this.graph
    if (!graph) return
    this._ensureLiaisonGraphUi(graph)
    this._installLiaisonEdgeInteractionGuard(graph)
    graph.setCellsMovable(true)
    graph.setCellsBendable(false)
    if (typeof graph.setCellsDisconnectable === 'function') graph.setCellsDisconnectable(false)
    const parent = graph.getDefaultParent()
    const cells = graph.getChildCells(parent, true, true) || []
    const model = graph.getModel()
    model.beginUpdate()
    try {
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i]
        const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
        if (id.startsWith('liaison-name:')) {
          graph.setCellStyles('movable', '1', [cell])
          graph.setCellStyles('bendable', '0', [cell])
          graph.setCellStyles('locked', '0', [cell])
          graph.setCellStyles('resizable', '0', [cell])
          graph.setCellStyles('rotatable', '0', [cell])
          if (isLineNameManuallyPlaced(graph, cell)) cell._liaisonNamePositionManual = true
          continue
        }
        if (id.startsWith('liaison-j-') || id.startsWith('liaison-pq:') || id.startsWith('liaison:')) {
          graph.setCellStyles('movable', '0', [cell])
          graph.setCellStyles('bendable', '0', [cell])
          graph.setCellStyles('locked', '1', [cell])
          graph.setCellStyles('resizable', '0', [cell])
          graph.setCellStyles('rotatable', '0', [cell])
          continue
        }
        if (id.startsWith('station:') || id.startsWith('busnode:') || id.startsWith('sw:')) {
          graph.setCellStyles('movable', '1', [cell])
          graph.setCellStyles('bendable', '0', [cell])
          graph.setCellStyles('resizable', '0', [cell])
          graph.setCellStyles('rotatable', '0', [cell])
          continue
        }
        graph.setCellStyles('movable', '0', [cell])
        graph.setCellStyles('bendable', '0', [cell])
        graph.setCellStyles('resizable', '0', [cell])
        graph.setCellStyles('rotatable', '0', [cell])
      }
    } finally {
      model.endUpdate()
    }
    this._installStationMoveListener()
    this._installLineNameMoveListener()
    this._migrateEdgeLabelsToNameVertices()
    this.purgeOrphanChannelGraphCells()
    if (graph.view?.invalidate) graph.view.invalidate()
  }

  /** 用户拖动线路名后打标，重算线路几何时保留手动位置；保存 graphXml 时一并持久化 */
  _installLineNameMoveListener() {
    const graph = this.graph
    if (!graph || graph._liaisonLineNameMoveListener || typeof mxEvent === 'undefined') return
    graph._liaisonLineNameMoveListener = true
    graph.addListener(mxEvent.CELLS_MOVED, (_sender, evt) => {
      const moved = evt.getProperty('cells') || []
      for (let i = 0; i < moved.length; i++) {
        const cell = moved[i]
        const id = typeof cell?.getId === 'function' ? String(cell.getId()) : ''
        if (!id.startsWith('liaison-name:')) continue
        cell._liaisonNamePositionManual = true
        graph.setCellStyles('liaisonNameManual', '1', [cell])
      }
    })
  }

  _stationCellById(stationId) {
    return this.graph?.getModel?.()?.getCell?.(`station:${stationId}`) || null
  }

  /** 布局端点：实站为 station 单元格；T 虚拟站为全部 busnode 单元格 */
  _endpointCellsForStation(stationId) {
    const st = this._stationCellById(stationId)
    if (st) return [st]
    const graph = this.graph
    const parent = graph?.getDefaultParent()
    if (!graph || !parent) return []
    const raw = this.data?.data?.station_data?.find((s) => s.station_id === stationId)
    if (!raw || !isVirtualT10Station(raw.station_name)) return []
    const cells = graph.getChildCells(parent, true, true) || []
    const out = []
    for (let i = 0; i < cells.length; i++) {
      const id = typeof cells[i].getId === 'function' ? String(cells[i].getId()) : ''
      if (id.startsWith(`busnode:${stationId}:`)) out.push(cells[i])
    }
    return out
  }

  _collectChannelSuffixesForDocIndex(docChannelIndex) {
    const graph = this.graph
    if (!graph || docChannelIndex == null) return []
    const docKey = String(docChannelIndex)
    const suffixes = new Set([docKey])
    const parent = graph.getDefaultParent()
    const cells = graph.getChildCells(parent, true, true) || []
    cells.forEach((cell) => {
      const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      const suffix = parseLiaisonGraphCellSuffix(id)
      if (suffix == null) return
      if (suffix === docKey || suffix.startsWith(`${docKey}:`)) suffixes.add(suffix)
    })
    return [...suffixes]
  }

  /** 按起终点站（及可选线路名）匹配画布后缀，避免已保存图形 id 与文档下标不一致时漏删 */
  _collectGraphSuffixesForChannel(channel) {
    const suffixes = new Set()
    if (!channel) return suffixes
    const lineNames = new Set(
      (channel.line_data || []).map((l) => String(l?.name || '').trim()).filter(Boolean)
    )
    this._enumerateGraphChannelEdges().forEach((g) => {
      const from = g.from || g.edge?.entityInfo?.from_station
      const to = g.to || g.edge?.entityInfo?.to_station
      const samePair =
        (from === channel.from_station && to === channel.to_station) ||
        (from === channel.to_station && to === channel.from_station)
      if (!samePair) return
      if (lineNames.size > 0 && g.lineName && !lineNames.has(g.lineName)) return
      suffixes.add(g.suffix)
    })
    return suffixes
  }

  _collectAllSuffixesForChannelRemoval(docChannelIndex, channel) {
    const suffixes = new Set(this._collectChannelSuffixesForDocIndex(docChannelIndex))
    this._collectGraphSuffixesForChannel(channel).forEach((s) => suffixes.add(s))
    return [...suffixes]
  }

  /** 拆线通道旧版共用 sw:N:from/to → 每条线独立 sw:N:L:from/to 后清理遗留 */
  _purgeLegacySharedChannelSwitches(docChannelIndex) {
    const graph = this.graph
    const model = graph?.getModel()
    if (!graph || !model || docChannelIndex == null) return
    const toRemove = []
    ;['from', 'to'].forEach((end) => {
      const legacy = model.getCell(`sw:${docChannelIndex}:${end}`)
      if (legacy) toRemove.push(legacy)
    })
    if (toRemove.length) forceRemoveGraphCells(graph, toRemove)
  }

  _canonicalSwitchCellId(docChannelIndex, lineIndex, splitCount, end) {
    const key = channelSwitchSuffix(docChannelIndex, lineIndex, splitCount)
    return `sw:${key}:${end}`
  }

  /** 删站/resync 后：将错位开关 id 归并到规范 id，并清理无效遗留 */
  _normalizeChannelSwitchIds() {
    const graph = this.graph
    const model = graph?.getModel()
    const channels = this.data?.data?.channel_data || []
    if (!graph || !model?.setId) return

    const valid = buildValidChannelSwitchIds(channels)
    const parent = graph.getDefaultParent()
    const cells = graph.getChildCells(parent, true, true) || []
    const toRemove = []

    model.beginUpdate()
    try {
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i]
        const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
        const m = id.match(/^sw:(.+):(from|to)$/)
        if (!m) continue
        if (valid.has(id)) continue

        const end = m[2]
        const ei = cell.entityInfo
        let docIdx = ei?.doc_channel_index
        let lineIndex = ei?.line_index ?? 0

        if (docIdx == null || docIdx < 0 || docIdx >= channels.length) {
          const parsed = parseGraphChannelSuffix(m[1])
          if (parsed && parsed.docChannelIndex >= 0 && parsed.docChannelIndex < channels.length) {
            docIdx = parsed.docChannelIndex
            lineIndex = parsed.lineIndex
          }
        }

        if (docIdx != null && docIdx >= 0 && docIdx < channels.length) {
          const splitCount = channelLineSplitCount(channels[docIdx])
          const canonicalId = this._canonicalSwitchCellId(docIdx, lineIndex, splitCount, end)
          if (valid.has(canonicalId)) {
            const existing = model.getCell(canonicalId)
            if (!existing) {
              this._safeSetCellId(cell, canonicalId)
              continue
            }
            if (existing !== cell) {
              toRemove.push(cell)
              continue
            }
          }
        }

        let migrated = false
        for (let di = 0; di < channels.length && !migrated; di++) {
          const ch = channels[di]
          const splitCount = channelLineSplitCount(ch)
          const lineCount = splitCount > 1 ? splitCount : 1
          for (let li = 0; li < lineCount && !migrated; li++) {
            for (const swEnd of ['from', 'to']) {
              if (swEnd !== end) continue
              if (!this._switchCellMatchesChannelLine(cell, ch, di, li, swEnd)) continue
              const canonicalId = this._canonicalSwitchCellId(di, li, splitCount, swEnd)
              if (!valid.has(canonicalId)) continue
              const existing = model.getCell(canonicalId)
              if (existing && existing !== cell) {
                toRemove.push(cell)
                migrated = true
                break
              }
              if (!existing) {
                this._safeSetCellId(cell, canonicalId)
                migrated = true
                break
              }
            }
          }
        }
        if (migrated) continue

        toRemove.push(cell)
      }
    } finally {
      model.endUpdate()
    }

    if (toRemove.length) forceRemoveGraphCells(graph, toRemove)
  }

  _safeSetCellId(cell, newId) {
    const graph = this.graph
    const model = graph?.getModel()
    if (!graph || !model?.setId || !cell || !newId) return
    const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
    if (id === newId) return
    model.beginUpdate()
    try {
      const existing = model.getCell(newId)
      if (existing && existing !== cell) forceRemoveGraphCells(graph, [existing])
      model.setId(cell, newId)
    } finally {
      model.endUpdate()
    }
  }

  /** 按规范 id / entityInfo / 画布后缀遗留 id 查找开关，必要时迁移 id */
  _resolveSwitchCell(docChannelIndex, lineIndex, splitCount, end, channel, graphSuffix = null) {
    const graph = this.graph
    const model = graph?.getModel()
    if (!graph || !model || docChannelIndex == null || !end) return null

    const canonicalId = this._canonicalSwitchCellId(docChannelIndex, lineIndex, splitCount, end)
    let sw = model.getCell(canonicalId)
    if (sw) return sw

    const tryMigrate = (cell) => {
      if (!cell || model.getCell(canonicalId)) return model.getCell(canonicalId)
      this._safeSetCellId(cell, canonicalId)
      return model.getCell(canonicalId)
    }

    const tryId = (id) => {
      const cell = model.getCell(id)
      if (!cell) return null
      return tryMigrate(cell)
    }

    sw = tryId(`sw:${docChannelIndex}:${end}`)
    if (sw) return sw

    if (splitCount > 1) {
      sw = tryId(`sw:${docChannelIndex}:${lineIndex}:${end}`)
      if (sw) return sw
    }

    if (graphSuffix != null && graphSuffix !== '') {
      const parsed = parseGraphChannelSuffix(graphSuffix)
      if (parsed) {
        const graphKey =
          splitCount > 1 ? `${parsed.docChannelIndex}:${parsed.lineIndex}` : String(parsed.docChannelIndex)
        sw = tryId(`sw:${graphKey}:${end}`)
        if (sw) return sw
        if (String(graphSuffix) !== graphKey) {
          sw = tryId(`sw:${graphSuffix}:${end}`)
          if (sw) return sw
        }
      } else {
        sw = tryId(`sw:${graphSuffix}:${end}`)
        if (sw) return sw
      }
    }

    const parent = graph.getDefaultParent()
    const cells = graph.getChildCells(parent, true, true) || []

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      const cid = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      if (!cid.startsWith('sw:') || !cid.endsWith(`:${end}`)) continue
      if (model.getCell(canonicalId)) break

      if (this._switchCellMatchesChannelLine(cell, channel, docChannelIndex, lineIndex, end)) {
        sw = tryMigrate(cell)
        if (sw) return sw
      }
    }

    return null
  }

  /** 删除站后清理仍引用该站、或已无 liaison 边的线路名 / P·Q 飘字 */
  _purgeLineLabelsForStation(stationId) {
    const graph = this.graph
    const model = graph?.getModel()
    if (!graph || !model || !stationId) return
    const toRemove = []
    const seen = new Set()
    const add = (cell) => {
      if (!cell) return
      const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      if (!id || seen.has(id)) return
      seen.add(id)
      toRemove.push(cell)
    }
    const cells = graph.getChildCells(graph.getDefaultParent(), true, true) || []
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      if (!id.startsWith('liaison-name:') && !id.startsWith('liaison-pq:')) continue
      const suffix = parseLiaisonGraphCellSuffix(id)
      const ei = cell.entityInfo
      if (ei?.from_station === stationId || ei?.to_station === stationId) {
        add(cell)
        continue
      }
      const edge = suffix != null ? model.getCell(`liaison:${suffix}`) : null
      const edgeInfo = edge?.entityInfo
      if (edgeInfo?.from_station === stationId || edgeInfo?.to_station === stationId) {
        add(cell)
        continue
      }
      if (suffix != null && !edge) add(cell)
    }
    if (toRemove.length) forceRemoveGraphCells(graph, toRemove)
  }

  /**
   * 线路名独立文本：创建/更新/移除 liaison-name 顶点，并清空边上的内嵌标签。
   */
  _syncLineNameLabel({ suffix, route, lineName, lineEntityInfo, showLabels, createIfMissing = true }) {
    const graph = this.graph
    const model = graph?.getModel()
    if (!graph || !model || suffix == null || suffix === '') return null
    const id = `liaison-name:${suffix}`
    const html = buildLineNameHtml(lineName, showLabels, this.options.theme)
    const nameStyle = lineNameStyle(this.options.theme)
    const block = showLabels && lineName && route ? computeLineNameBlockPosition(route, lineName) : null
    let cell = model.getCell(id)
    const edge = model.getCell(`liaison:${suffix}`)

    if (!html || !block) {
      if (cell) forceRemoveGraphCells(graph, [cell])
      if (edge) model.setValue(edge, '')
      return null
    }

    if (!cell && !createIfMissing) return null
    const parent = graph.getDefaultParent()
    if (!cell) {
      cell = graph.insertVertex(parent, id, html, block.x, block.y, block.w, block.h, nameStyle)
      cell.entityType = 'line'
      cell.entityInfo = lineEntityInfo || edge?.entityInfo || null
      graph.orderCells(false, [cell])
    } else {
      const keepManualPos = isLineNameManuallyPlaced(graph, cell)
      model.beginUpdate()
      try {
        model.setValue(cell, html)
        const geo = model.getGeometry(cell)?.clone()
        if (geo) {
          if (!keepManualPos) {
            geo.x = block.x
            geo.y = block.y
          }
          geo.width = block.w
          geo.height = block.h
          model.setGeometry(cell, geo)
        }
        if (lineEntityInfo || edge?.entityInfo) {
          cell.entityType = 'line'
          cell.entityInfo = lineEntityInfo || edge.entityInfo
        }
        graph.setCellStyle(nameStyle, [cell])
      } finally {
        model.endUpdate()
      }
    }
    if (edge) model.setValue(edge, '')
    return cell
  }

  /** 已保存图形可能仍将线路名挂在边上，迁移为 liaison-name 顶点 */
  _migrateEdgeLabelsToNameVertices() {
    const graph = this.graph
    const model = graph?.getModel()
    const channels = this.data?.data?.channel_data || []
    if (!graph || !model || !channels.length) return
    for (let i = 0; i < channels.length; i++) {
      const bundle = this._resolveChannelGraphCells(i)
      if (!bundle?.edge) continue
      if (model.getCell(`liaison-name:${bundle.suffix}`)) continue
      const route = routeFromChannelBundle(graph, bundle, bundle.edge)
      const lineName = primaryLineNameFromChannel(channels[i])
      if (!lineName || !route) continue
      this._syncLineNameLabel({
        suffix: bundle.suffix,
        route,
        lineName,
        lineEntityInfo: bundle.edge.entityInfo,
        showLabels: this.options.showLabels,
      })
    }
  }

  _collectChannelGraphCellsBySuffix(suffix, opts = {}) {
    const graph = this.graph
    if (!graph || suffix == null || suffix === '') return []
    const model = graph.getModel()
    const s = String(suffix)
    const ids = [
      `liaison:${s}`,
      `liaison-j-from:${s}`,
      `liaison-j-to:${s}`,
      `liaison-name:${s}`,
      `liaison-pq:${s}`,
    ]
    if (!opts.skipSwitches) {
      const parsed = parseGraphChannelSuffix(s)
      if (parsed) {
        const channel = this.data?.data?.channel_data?.[parsed.docChannelIndex]
        const splitCount = channelLineSplitCount(channel)
        const swKey = channelSwitchSuffix(parsed.docChannelIndex, parsed.lineIndex, splitCount)
        ids.push(`sw:${swKey}:from`, `sw:${swKey}:to`)
      } else {
        ids.push(`sw:${s}:from`, `sw:${s}:to`)
      }
    }
    const out = []
    for (let i = 0; i < ids.length; i++) {
      const c = model.getCell(ids[i])
      if (c) out.push(c)
    }
    return out
  }

  _collectChannelGraphCells(docChannelIndex) {
    const graph = this.graph
    if (!graph || docChannelIndex == null) return []
    const docKey = String(docChannelIndex)
    const suffixes = new Set([docKey])
    const parent = graph.getDefaultParent()
    const cells = graph.getChildCells(parent, true, true) || []
    cells.forEach((cell) => {
      const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      const m = id.match(/^liaison:(\d+(?::\d+)?)$/)
      if (!m) return
      const suffix = m[1]
      if (suffix === docKey || suffix.startsWith(`${docKey}:`)) suffixes.add(suffix)
    })
    const out = []
    const seen = new Set()
    suffixes.forEach((s) => {
      this._collectChannelGraphCellsBySuffix(s, { skipSwitches: true }).forEach((c) => {
        const id = typeof c.getId === 'function' ? String(c.getId()) : ''
        if (seen.has(id)) return
        seen.add(id)
        out.push(c)
      })
    })
    const channel = this.data?.data?.channel_data?.[docChannelIndex]
    const splitCount = channelLineSplitCount(channel)
    const switchKeys = new Set()
    if (splitCount > 1) {
      for (let li = 0; li < splitCount; li++) {
        switchKeys.add(channelSwitchSuffix(docChannelIndex, li, splitCount))
      }
      switchKeys.add(String(docChannelIndex))
    } else {
      switchKeys.add(channelSwitchSuffix(docChannelIndex, 0, 1))
    }
    switchKeys.forEach((swKey) => {
      ;['from', 'to'].forEach((end) => {
        const sw = graph.getModel().getCell(`sw:${swKey}:${end}`)
        if (sw) {
          const id = typeof sw.getId === 'function' ? String(sw.getId()) : ''
          if (!seen.has(id)) {
            seen.add(id)
            out.push(sw)
          }
        }
      })
    })
    return out
  }

  /** 按文档通道解析画布后缀并删除该通道全部图元（含开关，避免删线后残留导致无法重插） */
  _removeChannelGraphCellsResolved(docChannelIndex) {
    const graph = this.graph
    const channel = this.data?.data?.channel_data?.[docChannelIndex]
    if (!graph || !channel) return
    const suffixes = this._collectAllSuffixesForChannelRemoval(docChannelIndex, channel)
    const toRemove = []
    const seen = new Set()
    suffixes.forEach((s) => {
      this._collectChannelGraphCellsBySuffix(s, { skipSwitches: true }).forEach((c) => {
        const id = typeof c.getId === 'function' ? String(c.getId()) : ''
        if (id && !seen.has(id)) {
          seen.add(id)
          toRemove.push(c)
        }
      })
    })
    const splitCount = channelLineSplitCount(channel)
    const switchKeys = new Set([String(docChannelIndex)])
    if (splitCount > 1) {
      for (let li = 0; li < splitCount; li++) {
        switchKeys.add(channelSwitchSuffix(docChannelIndex, li, splitCount))
      }
    } else {
      switchKeys.add(channelSwitchSuffix(docChannelIndex, 0, 1))
    }
    suffixes.forEach((s) => {
      const parsed = parseGraphChannelSuffix(s)
      if (parsed) {
        switchKeys.add(channelSwitchSuffix(parsed.docChannelIndex, parsed.lineIndex, splitCount))
      }
    })
    switchKeys.forEach((base) => {
      ;['from', 'to'].forEach((end) => {
        const sw = graph.getModel().getCell(`sw:${base}:${end}`)
        if (sw) toRemove.push(sw)
      })
    })
    if (toRemove.length) forceRemoveGraphCells(graph, toRemove)
  }

  _resolveSwitchDocIndex(channel, spec) {
    const sd = channel.switch_data || []
    if (spec.item == null) return null
    let switch_doc_index = sd.findIndex(
      (x) => x === spec.item || (x && spec.item && String(x.name || '') === String(spec.item.name || ''))
    )
    if (switch_doc_index < 0) switch_doc_index = spec.end === 'to' ? 1 : 0
    return switch_doc_index
  }

  _bindSwitchEntityInfo(sw, spec, docChannelIndex, channel, from, to, lineColor, lineW, pFromMw, qFromMvar, lineIndex = 0) {
    sw.entityType = 'switch'
    sw.entityInfo = {
      type: 'switch',
      doc_channel_index: docChannelIndex,
      line_index: lineIndex,
      switch_doc_index: this._resolveSwitchDocIndex(channel, spec),
      switch_end: spec.end,
      switch_item: spec.item,
      switch_name: spec.item?.name,
      channel_name: channel.channel_name,
      from_station: channel.from_station,
      to_station: channel.to_station,
      from_station_name: from.name,
      to_station_name: to.name,
      link_color: lineColor,
      link_width_px: lineW,
      p_from_mw: pFromMw,
      q_from_mvar: qFromMvar,
      closed: spec.closed,
      switch_data: channel.switch_data || [],
      raw: channel,
    }
  }

  /** 枚举画布上所有通道边（按 cell.id 后缀） */
  _enumerateGraphChannelEdges() {
    const graph = this.graph
    if (!graph) return []
    const parent = graph.getDefaultParent()
    const cells = graph.getChildCells(parent, true, true) || []
    const out = []
    const seen = new Set()
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      const m = id.match(/^liaison:(.+)$/)
      if (!m) continue
      const suffix = m[1]
      if (seen.has(suffix)) continue
      seen.add(suffix)
      const info = cell.entityInfo || {}
      const nameCell = graph.getModel().getCell(`liaison-name:${suffix}`)
      const labelName = nameCell
        ? parseLineLabelFromCell(graph, nameCell)
        : parseLineLabelFromCell(graph, cell)
      out.push({
        suffix,
        from: info.from_station,
        to: info.to_station,
        lineName: labelName || primaryLineNameFromChannel(info),
        edge: cell,
      })
    }
    return out
  }

  _junctionNearEndpointCells(model, junction, endpointCells, threshold = 120) {
    const jg = model?.getGeometry?.(junction)
    if (!jg || !endpointCells?.length) return false
    const jcx = jg.x + jg.width / 2
    const jcy = jg.y + jg.height / 2
    for (let i = 0; i < endpointCells.length; i++) {
      const eg = model.getGeometry(endpointCells[i])
      if (!eg) continue
      if (pointDistToRect(jcx, jcy, eg) < threshold) return true
    }
    return false
  }

  _graphChannelTouchesStation(suffix, stationId) {
    const model = this.graph?.getModel()
    if (!model || suffix == null || suffix === '' || !stationId) return false
    const s = String(suffix)
    const edge = model.getCell(`liaison:${s}`)
    const info = edge?.entityInfo
    if (info?.from_station === stationId || info?.to_station === stationId) return true
    const endpointCells = this._endpointCellsForStation(stationId)
    if (!endpointCells.length) return false
    const jFrom = model.getCell(`liaison-j-from:${s}`)
    const jTo = model.getCell(`liaison-j-to:${s}`)
    return (
      this._junctionNearEndpointCells(model, jFrom, endpointCells) ||
      this._junctionNearEndpointCells(model, jTo, endpointCells)
    )
  }

  /** 清理无对应 liaison 边的孤立线路名 / P·Q 标签 / 结点 */
  purgeOrphanChannelGraphCells() {
    const graph = this.graph
    const model = graph?.getModel()
    if (!graph || !model) return
    const parent = graph.getDefaultParent()
    const cells = graph.getChildCells(parent, true, true) || []
    const toRemove = []
    const seen = new Set()
    const add = (cell) => {
      if (!cell) return
      const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      if (!id || seen.has(id)) return
      seen.add(id)
      toRemove.push(cell)
    }

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      const suffix = parseLiaisonGraphCellSuffix(id)
      if (suffix == null) continue
      if (!model.getCell(`liaison:${suffix}`)) add(cell)
    }

    if (toRemove.length) forceRemoveGraphCells(graph, toRemove)
  }

  /** 删除站后：仅清除仍引用已删站 id 的通道图元（不按下标删，避免误伤待 resync 的合法线路） */
  _purgeGraphChannelsNotInDoc() {
    const graph = this.graph
    const model = graph?.getModel()
    const data = this.data?.data
    const stationIds = new Set((data?.station_data || []).map((s) => s.station_id))
    if (!graph || !model) return

    const suffixesToRemove = new Set()
    const markInvalid = (from, to, suffix) => {
      if (!suffix) return
      if (from && !stationIds.has(from)) suffixesToRemove.add(suffix)
      if (to && !stationIds.has(to)) suffixesToRemove.add(suffix)
    }

    this._enumerateGraphChannelEdges().forEach((g) => {
      const from = g.from || g.edge?.entityInfo?.from_station
      const to = g.to || g.edge?.entityInfo?.to_station
      markInvalid(from, to, g.suffix)
    })

    const parent = graph.getDefaultParent()
    const cells = graph.getChildCells(parent, true, true) || []
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      const suffix = parseLiaisonGraphCellSuffix(id)
      if (suffix == null) continue
      const ei = cell.entityInfo
      markInvalid(ei?.from_station, ei?.to_station, suffix)
      if (!model.getCell(`liaison:${suffix}`)) suffixesToRemove.add(suffix)
    }

    if (!suffixesToRemove.size) return
    const toRemove = []
    const seen = new Set()
    const add = (cell) => {
      if (!cell) return
      const cid = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      if (!cid || seen.has(cid)) return
      seen.add(cid)
      toRemove.push(cell)
    }
    suffixesToRemove.forEach((s) => {
      this._collectChannelGraphCellsBySuffix(s).forEach(add)
      const parsed = parseGraphChannelSuffix(s)
      if (parsed && !String(s).includes(':')) {
        ;['from', 'to'].forEach((end) => add(model.getCell(`sw:${parsed.docChannelIndex}:${end}`)))
      }
    })
    if (toRemove.length) forceRemoveGraphCells(graph, toRemove)
    this.purgeOrphanChannelGraphCells()
  }

  /**
   * 删除变电站：先清画布通道（文档下标未变），再清站房与残余图元。
   * 须在更新 JSON channel_data 之前调用。
   */
  removeStationAndChannelsFromGraph(stationId, docChannelIndices = []) {
    const graph = this.graph
    const model = graph?.getModel()
    if (!graph || !model || !stationId) return

    const indices = [...docChannelIndices].sort((a, b) => b - a)
    for (let i = 0; i < indices.length; i++) {
      this._removeChannelGraphCellsResolved(indices[i])
    }

    const toRemove = []
    const seen = new Set()
    const addCell = (cell) => {
      if (!cell) return
      const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      if (!id || seen.has(id)) return
      seen.add(id)
      toRemove.push(cell)
    }

    addCell(this._stationCellById(stationId))
    this._endpointCellsForStation(stationId).forEach((cell) => {
      const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      if (id.startsWith('busnode:')) addCell(cell)
    })

    const channelBases = new Set()
    this._enumerateGraphChannelEdges().forEach((g) => {
      const from = g.from || g.edge?.entityInfo?.from_station
      const to = g.to || g.edge?.entityInfo?.to_station
      if (from !== stationId && to !== stationId) return
      const parsed = parseGraphChannelSuffix(g.suffix)
      if (parsed) channelBases.add(String(parsed.docChannelIndex))
      this._collectChannelGraphCellsBySuffix(g.suffix).forEach(addCell)
    })
    channelBases.forEach((base) => {
      ;['from', 'to'].forEach((end) => addCell(model.getCell(`sw:${base}:${end}`)))
    })

    const parent = graph.getDefaultParent()
    const allCells = graph.getChildCells(parent, true, true) || []
    for (let ci = 0; ci < allCells.length; ci++) {
      const cell = allCells[ci]
      const cid = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      if (!cid.startsWith('liaison-name:') && !cid.startsWith('liaison-pq:')) continue
      const ei = cell.entityInfo
      if (ei?.from_station === stationId || ei?.to_station === stationId) addCell(cell)
    }

    if (toRemove.length) forceRemoveGraphCells(graph, toRemove)
    this._purgeLineLabelsForStation(stationId)
    this.purgeOrphanChannelGraphCells()
    this._applyFlowMotionState(graph)
  }

  _channelPairMatchesStations(fromA, toA, channel) {
    if (!channel || !fromA || !toA) return false
    return (
      (fromA === channel.from_station && toA === channel.to_station) ||
      (fromA === channel.to_station && toA === channel.from_station)
    )
  }

  _lineNameForChannelLine(channel, lineIndex = 0) {
    const lineItem = pickChannelLineItem(channel, lineIndex)
    return lineItem?.name ? String(lineItem.name).trim() : primaryLineNameFromChannel(channel)
  }

  /** 画布图元是否对应该 JSON 通道（及可选 line_data 行） */
  _graphBundleMatchesChannel(bundle, channel, lineIndex = 0) {
    if (!bundle?.edge || !channel) return false
    const graph = this.graph
    const info = bundle.edge.entityInfo
    const lineName = this._lineNameForChannelLine(channel, lineIndex)

    const fromCells = this._endpointCellsForStation(channel.from_station)
    const toCells = this._endpointCellsForStation(channel.to_station)
    const geoOk =
      fromCells.length > 0 &&
      toCells.length > 0 &&
      bundle.jFrom &&
      bundle.jTo &&
      this._channelEndpointDistanceScore(bundle.jFrom, bundle.jTo, fromCells, toCells) <= 500

    if (info?.from_station && info?.to_station) {
      if (!this._channelPairMatchesStations(info.from_station, info.to_station, channel) && !geoOk) {
        return false
      }
    } else if (!geoOk) {
      return false
    }

    if (lineName && graph) {
      const nameCell = graph.getModel()?.getCell(`liaison-name:${bundle.suffix}`)
      const labelName = nameCell ? parseLineLabelFromCell(graph, nameCell) : ''
      if (labelName && labelName !== lineName) return false
    }
    return true
  }

  _channelEndpointDistanceScore(jFrom, jTo, fromCells, toCells) {
    const model = this.graph?.getModel()
    if (!model || !jFrom || !jTo || !fromCells?.length || !toCells?.length) return Infinity
    const jf = model.getGeometry(jFrom)
    const jt = model.getGeometry(jTo)
    if (!jf || !jt) return Infinity
    const jfx = jf.x + jf.width / 2
    const jfy = jf.y + jf.height / 2
    const jtx = jt.x + jt.width / 2
    const jty = jt.y + jt.height / 2
    let best = Infinity
    for (let fi = 0; fi < fromCells.length; fi++) {
      const fs = model.getGeometry(fromCells[fi])
      if (!fs) continue
      for (let ti = 0; ti < toCells.length; ti++) {
        const ts = model.getGeometry(toCells[ti])
        if (!ts) continue
        const d1 = pointDistToRect(jfx, jfy, fs) + pointDistToRect(jtx, jty, ts)
        const d2 = pointDistToRect(jfx, jfy, ts) + pointDistToRect(jtx, jty, fs)
        best = Math.min(best, d1, d2)
      }
    }
    return best
  }

  /** 按线路名 + 结点贴近站房/busnode 几何匹配画布通道（不依赖可能已错的 entityInfo） */
  _findGraphSuffixForDocChannel(channel, usedSuffixes = new Set(), lineIndex = null) {
    const graph = this.graph
    const model = graph?.getModel()
    if (!graph || !model || !channel) return null

    const fromCells = this._endpointCellsForStation(channel.from_station)
    const toCells = this._endpointCellsForStation(channel.to_station)
    if (fromCells.length === 0 || toCells.length === 0) return null

    const lineItem = lineIndex != null ? pickChannelLineItem(channel, lineIndex) : null
    const lineName = lineItem?.name
      ? String(lineItem.name).trim()
      : primaryLineNameFromChannel(channel)
    const edges = this._enumerateGraphChannelEdges()
    let bestSuffix = null
    let bestScore = Infinity

    for (let i = 0; i < edges.length; i++) {
      const g = edges[i]
      if (usedSuffixes.has(g.suffix)) continue
      const jFrom = model.getCell(`liaison-j-from:${g.suffix}`)
      const jTo = model.getCell(`liaison-j-to:${g.suffix}`)
      if (!jFrom || !jTo) continue

      if (lineName && g.lineName && g.lineName !== lineName) continue
      if (lineName && !g.lineName) {
        const info = g.edge?.entityInfo
        if (
          !info?.from_station ||
          !info?.to_station ||
          !this._channelPairMatchesStations(info.from_station, info.to_station, channel)
        ) {
          continue
        }
      }

      let score = this._channelEndpointDistanceScore(jFrom, jTo, fromCells, toCells)
      if (lineName && g.lineName === lineName) score -= 8000
      if (g.from === channel.from_station && g.to === channel.to_station) score -= 2000
      else if (g.from === channel.to_station && g.to === channel.from_station) score -= 1500

      if (score < bestScore) {
        bestScore = score
        bestSuffix = g.suffix
      }
    }

    if (bestScore > 500) return null
    return bestSuffix
  }

  /** 画布边是否对应该 JSON 通道（起终点 + 线路名，可选几何校验） */
  _graphEdgeMatchesDocChannel(graphEdge, channel, lineIndex = 0, opts = {}) {
    if (!graphEdge?.edge || !channel) return false
    const lineName = this._lineNameForChannelLine(channel, lineIndex)
    const from = graphEdge.from || graphEdge.edge?.entityInfo?.from_station
    const to = graphEdge.to || graphEdge.edge?.entityInfo?.to_station

    if (from && to && this._channelPairMatchesStations(from, to, channel)) {
      if (lineName && graphEdge.lineName && graphEdge.lineName !== lineName) return false
      if (opts.skipGeometry) return true
      const bundle = this._resolveChannelGraphCellsBySuffix(graphEdge.suffix)
      if (!bundle) return true
      const info = graphEdge.edge.entityInfo
      if (info?.from_station && info?.to_station && this._channelPairMatchesStations(info.from_station, info.to_station, channel)) {
        return true
      }
      return this._graphBundleMatchesChannel(bundle, channel, lineIndex)
    }

    if (opts.skipGeometry) return false
    const bundle = this._resolveChannelGraphCellsBySuffix(graphEdge.suffix)
    return bundle ? this._graphBundleMatchesChannel(bundle, channel, lineIndex) : false
  }

  _graphEdgeMatchesAnyDocChannel(graphEdge) {
    const channels = this.data?.data?.channel_data || []
    for (let di = 0; di < channels.length; di++) {
      const ch = channels[di]
      const lines = Array.isArray(ch.line_data) && ch.line_data.length > 0 ? ch.line_data : [null]
      for (let li = 0; li < lines.length; li++) {
        if (this._graphEdgeMatchesDocChannel(graphEdge, ch, li, { skipGeometry: true })) return true
      }
    }
    return false
  }

  /** resync/拖动：几何匹配失败时仍可按起终点 + 线路名认领画布后缀 */
  _pickGraphSuffixForDocChannel(channel, usedSuffixes = new Set(), lineIndex = 0, docChannelIndex = null) {
    let pickSuffix = this._findGraphSuffixForDocChannel(channel, usedSuffixes, lineIndex)
    if (pickSuffix) return pickSuffix

    const docIdx =
      docChannelIndex != null && docChannelIndex >= 0
        ? docChannelIndex
        : (this.data?.data?.channel_data || []).indexOf(channel)
    if (docIdx >= 0) {
      const atNew = visualLinkCellSuffix(
        docIdx,
        lineIndex,
        channelLineSplitCount(channel) > 1 ? channelLineSplitCount(channel) : 1
      )
      if (!usedSuffixes.has(atNew)) {
        const bundle = this._resolveChannelGraphCellsBySuffix(atNew)
        if (
          bundle?.edge &&
          this._graphEdgeMatchesDocChannel(
            {
              suffix: atNew,
              edge: bundle.edge,
              from: bundle.edge.entityInfo?.from_station,
              to: bundle.edge.entityInfo?.to_station,
              lineName: this._lineNameForChannelLine(channel, lineIndex),
            },
            channel,
            lineIndex,
            { skipGeometry: true }
          )
        ) {
          return atNew
        }
      }
    }

    const edges = this._enumerateGraphChannelEdges()
    for (let i = 0; i < edges.length; i++) {
      const g = edges[i]
      if (usedSuffixes.has(g.suffix)) continue
      if (this._graphEdgeMatchesDocChannel(g, channel, lineIndex, { skipGeometry: true })) return g.suffix
    }
    return null
  }

  /** 文档通道在画布上是否已有图元（含旧 suffix 几何匹配） */
  _docChannelHasGraphRepresentation(docChannelIndex) {
    const graph = this.graph
    const model = graph?.getModel()
    const channel = this.data?.data?.channel_data?.[docChannelIndex]
    if (!graph || !model || !channel) return false

    const splitCount = channelLineSplitCount(channel)
    const lineCount = splitCount > 1 ? splitCount : 1
    for (let li = 0; li < lineCount; li++) {
      const suffix = visualLinkCellSuffix(docChannelIndex, li, splitCount)
      if (model.getCell(`liaison:${suffix}`)) return true
      if (this._resolveChannelGraphCells(docChannelIndex, li)?.edge) return true
    }
    return false
  }

  /** 仅当画布上完全缺线时才补插（避免与旧 suffix 重复成图导致布局乱） */
  _insertMissingDocChannelsIfAbsent() {
    const channels = this.data?.data?.channel_data || []
    for (let docIdx = 0; docIdx < channels.length; docIdx++) {
      if (!this._docChannelHasGraphRepresentation(docIdx)) {
        this.insertChannelAtDocIndex(docIdx)
      }
    }
  }

  /** 删站/resync 后只清理线路名标签，不重算位置（保持画布布局不变） */
  _cleanupLineNameLabelsAfterResync() {
    this._purgeStaleTempChannelCells()
    this._purgeOrphanLineNameLabels()
    this._purgeDuplicateLineNameLabels()
    this._purgeNonCanonicalLineNameLabels()
  }

  /** 文档通道在画布上缺边时补插（删站 resync 后防线路丢失） */
  _ensureDocChannelsOnGraph() {
    this._insertMissingDocChannelsIfAbsent()
  }

  /** 按文档规范 suffix 刷新线路名文本（会重算标签位置，仅用于显式同步场景） */
  _syncCanonicalLineNameLabels() {
    const graph = this.graph
    const channels = this.data?.data?.channel_data || []
    if (!graph || !channels.length) return
    const ctx = this._buildChannelRouteContext()

    for (let docIdx = 0; docIdx < channels.length; docIdx++) {
      const ch = channels[docIdx]
      const splitCount = channelLineSplitCount(ch)
      const lineCount = splitCount > 1 ? splitCount : 1
      for (let li = 0; li < lineCount; li++) {
        const suffix = visualLinkCellSuffix(docIdx, li, splitCount)
        const bundle = this._resolveChannelGraphCellsBySuffix(suffix)
        if (!bundle?.edge) continue
        const link = (ctx.visualLinks || []).find((l) => l.docChannelIndex === docIdx && l.lineIndex === li)
        let route = link ? this._computeVisualLinkRoute(link, ctx) : null
        if (!route) route = routeFromChannelBundle(graph, bundle, bundle.edge)
        const lineName = this._lineNameForChannelLine(ch, li)
        if (!route || !lineName) continue
        this._syncLineNameLabel({
          suffix,
          route,
          lineName,
          lineEntityInfo: bundle.edge.entityInfo,
          showLabels: this.options.showLabels,
        })
      }
    }
    this._purgeOrphanLineNameLabels()
    this._purgeDuplicateLineNameLabels()
    this._purgeNonCanonicalLineNameLabels()
  }

  /** 同线路名+起终点只保留文档规范 suffix 的标签（如删站后旧的 liaison-name:4） */
  _purgeNonCanonicalLineNameLabels() {
    const graph = this.graph
    const model = graph?.getModel()
    const channels = this.data?.data?.channel_data || []
    if (!graph || !model) return

    const canonicalByKey = new Map()
    for (let docIdx = 0; docIdx < channels.length; docIdx++) {
      const ch = channels[docIdx]
      const splitCount = channelLineSplitCount(ch)
      const lines = ch.line_data?.length ? ch.line_data : [null]
      for (let li = 0; li < lines.length; li++) {
        const name = this._lineNameForChannelLine(ch, li)
        if (!name) continue
        const key = `${name}::${[ch.from_station, ch.to_station].sort().join('::')}`
        canonicalByKey.set(key, visualLinkCellSuffix(docIdx, li, splitCount > 1 ? splitCount : 1))
      }
    }

    const toRemove = []
    const cells = graph.getChildCells(graph.getDefaultParent(), true, true) || []
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      if (!id.startsWith('liaison-name:')) continue
      const suffix = id.slice('liaison-name:'.length)
      if (suffix.includes('__t')) {
        toRemove.push(cell)
        continue
      }
      const lineName = parseLineLabelFromCell(graph, cell)
      if (!lineName) continue
      let from = cell.entityInfo?.from_station
      let to = cell.entityInfo?.to_station
      const edge = model.getCell(`liaison:${suffix}`)
      if (edge?.entityInfo) {
        from = edge.entityInfo.from_station || from
        to = edge.entityInfo.to_station || to
      }
      if (!from || !to) continue
      const key = `${lineName}::${[from, to].sort().join('::')}`
      const canonical = canonicalByKey.get(key)
      if (!canonical || canonical === suffix) continue
      if (model.getCell(`liaison:${canonical}`)) toRemove.push(cell)
    }
    if (toRemove.length) forceRemoveGraphCells(graph, toRemove)
  }

  _docIndexForGraphSuffix(suffix) {
    const parsed = parseGraphChannelSuffix(suffix)
    if (parsed) {
      const channels = this.data?.data?.channel_data || []
      if (parsed.docChannelIndex >= 0 && parsed.docChannelIndex < channels.length) {
        return parsed.docChannelIndex
      }
    }
    const channels = this.data?.data?.channel_data || []
    const s = String(suffix)
    for (let i = 0; i < channels.length; i++) {
      if (this._findGraphSuffixForDocChannel(channels[i], new Set()) === s) return i
    }
    return null
  }

  /** 从点击的图元解析文档通道下标 */
  resolveDocChannelIndexFromCell(cell) {
    const resolved = this.resolveDocChannelFromCell(cell)
    return resolved?.docChannelIndex ?? null
  }

  /** 从图元解析文档通道下标与 line_data 行号（供点击编辑侧栏） */
  resolveDocChannelFromCell(cell) {
    if (!cell || !this.graph) return null
    const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
    let suffix = parseLiaisonGraphCellSuffix(id)
    if (!suffix) {
      const swMatch = id.match(/^sw:(.+):(from|to)$/)
      if (swMatch) suffix = swMatch[1]
    }
    if (suffix != null) {
      const parsed = parseGraphChannelSuffix(suffix)
      if (parsed) return parsed
      const docChannelIndex = this._docIndexForGraphSuffix(suffix)
      if (docChannelIndex != null) {
        return { docChannelIndex, lineIndex: 0, suffix: String(suffix) }
      }
    }
    const ei = cell.entityInfo
    if (ei?.doc_channel_index != null && ei.doc_channel_index >= 0) {
      return {
        docChannelIndex: ei.doc_channel_index,
        lineIndex: ei.line_index != null && ei.line_index >= 0 ? ei.line_index : 0,
      }
    }
    return null
  }

  _resolveChannelGraphCellsBySuffix(suffix) {
    const graph = this.graph
    const model = graph?.getModel()
    if (!graph || !model || suffix == null || suffix === '') return null
    const s = String(suffix)
    const edge = model.getCell(`liaison:${s}`)
    if (!edge) return null
    return {
      suffix: s,
      edge,
      jFrom: model.getCell(`liaison-j-from:${s}`),
      jTo: model.getCell(`liaison-j-to:${s}`),
    }
  }

  /** 按文档下标或几何匹配解析通道图元（校验起终点/线路名，避免按下标误匹配） */
  _resolveChannelGraphCells(docChannelIndex, lineIndex = 0) {
    const graph = this.graph
    const model = graph?.getModel()
    const channel = this.data?.data?.channel_data?.[docChannelIndex]
    if (!graph || !model || !channel) return null

    const lines = Array.isArray(channel.line_data) && channel.line_data.length > 0 ? channel.line_data : [null]
    const splitCount = lines.length
    const expectedSuffix = visualLinkCellSuffix(
      docChannelIndex,
      lineIndex,
      splitCount > 1 ? splitCount : 1
    )

    const acceptBundle = (bundle) => {
      if (!bundle?.jFrom || !bundle?.jTo || !bundle?.edge) return null
      if (this._graphBundleMatchesChannel(bundle, channel, lineIndex)) return bundle
      const fromCells = this._endpointCellsForStation(channel.from_station)
      const toCells = this._endpointCellsForStation(channel.to_station)
      if (
        fromCells.length > 0 &&
        toCells.length > 0 &&
        this._channelEndpointDistanceScore(bundle.jFrom, bundle.jTo, fromCells, toCells) <= 500
      ) {
        return bundle
      }
      return null
    }

    const direct = this._resolveChannelGraphCellsBySuffix(expectedSuffix)
    const fromDirect = acceptBundle(direct)
    if (fromDirect) return fromDirect

    const pickSuffix = this._pickGraphSuffixForDocChannel(channel, new Set(), lineIndex, docChannelIndex)
    if (pickSuffix) {
      const picked = this._resolveChannelGraphCellsBySuffix(pickSuffix)
      const fromPicked = acceptBundle(picked)
      if (fromPicked) return fromPicked
    }
    return null
  }

  /** 从画布几何读取已放置站点（用于增量画线，不跑整图布局） */
  _buildStationsFromGraph() {
    const graph = this.graph
    const payload = this.data?.data || {}
    const rawStations = Array.isArray(payload.station_data) ? payload.station_data : []
    const parent = graph.getDefaultParent()
    const cells = graph.getChildCells(parent, true, true) || []
    const byId = new Map()
    const busNodesByStation = new Map()

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      if (id.startsWith('busnode:')) {
        const parts = id.split(':')
        const sid = parts[1]
        const busKey = parts.slice(2).join(':')
        const raw = rawStations.find((r) => r.station_id === sid)
        if (!raw) continue
        const geo = graph.getModel().getGeometry(cell)
        if (!geo) continue
        const kv = normalizeKV(raw.vn_kv)
        const busName =
          cell.entityInfo?.bus_name ||
          `${raw.station_name}.${busKey}`.replace(/\.+/g, '.')
        const bn = {
          id,
          stationId: sid,
          busName,
          busKey,
          name: busKey,
          kv,
          x: geo.x,
          y: geo.y,
          w: geo.width,
          h: geo.height,
          isBusNode: true,
          isVirtual: true,
        }
        if (!busNodesByStation.has(sid)) busNodesByStation.set(sid, [])
        busNodesByStation.get(sid).push(bn)
        continue
      }
      if (!id.startsWith('station:')) continue
      const sid = id.slice('station:'.length)
      const raw = rawStations.find((r) => r.station_id === sid)
      if (!raw) continue
      const name = shortStationName(raw.station_name)
      if (isVirtualT10Station(name)) continue
      const geo = graph.getModel().getGeometry(cell)
      if (!geo) continue
      let x = geo.x
      let y = geo.y
      if (typeof graph.getBoundingBoxFromGeometry === 'function') {
        const box = graph.getBoundingBoxFromGeometry([cell], true)
        if (box) {
          x = box.x
          y = box.y
        }
      }
      const kv = normalizeKV(raw.vn_kv)
      let w = geo.width
      let h = geo.height
      const { w: baseW, h: baseH } = stationBoxSizeByKV(kv)
      w = baseW + trafoExtraWidthPx(trafoRowsForGraphDisplay(raw), baseW)
      h = baseH + trafoExtraHeightPx(trafoRowsForGraphDisplay(raw))
      byId.set(sid, {
        id: sid,
        name,
        kv,
        lon: Number(raw.lon || 0),
        lat: Number(raw.lat || 0),
        trafoRows: trafoRowsForGraphDisplay(raw),
        x,
        y,
        w: geo.width > 0 ? geo.width : w,
        h: geo.height > 0 ? geo.height : h,
        isVirtual: false,
      })
    }

    const placed = []
    rawStations.forEach((raw) => {
      const name = shortStationName(raw.station_name)
      if (isVirtualT10Station(name)) return
      const s = byId.get(raw.station_id)
      if (s && s.kv >= 35) placed.push(s)
    })
    busNodesByStation.forEach((nodes) => {
      nodes.forEach((bn) => placed.push(bn))
    })
    return placed
  }

  _placeNewStationRect(graph, kv, trafoRows, isVirt) {
    const bounds = graph.getGraphBounds()
    const { w: baseW, h: baseH } = isVirt ? { w: T10_BUS_NODE_SIZE, h: T10_BUS_NODE_SIZE } : stationBoxSizeByKV(kv)
    const w = isVirt ? baseW : baseW + trafoExtraWidthPx(trafoRows, baseW)
    const h = isVirt ? baseH : baseH + trafoExtraHeightPx(trafoRows)
    let x = 80
    let y = 80
    if (bounds && bounds.width > 0) {
      x = bounds.x + bounds.width + 80
      y = bounds.y + Math.max(0, bounds.height / 2 - h / 2)
    }
    return { x, y, w, h }
  }

  insertStationAtDocIndex(docStationIndex) {
    const graph = this.graph
    if (!graph || docStationIndex == null || docStationIndex < 0) return null
    const raw = this.data?.data?.station_data?.[docStationIndex]
    if (!raw?.station_id) return null

    const kv = normalizeKV(raw.vn_kv)
    if (kv < 35) return null
    const name = shortStationName(raw.station_name)
    const isVirt = isVirtualT10Station(name)
    const parent = graph.getDefaultParent()

    if (isVirt) {
      const cells = graph.getChildCells(parent, true, true) || []
      for (let i = 0; i < cells.length; i++) {
        const id = typeof cells[i].getId === 'function' ? String(cells[i].getId()) : ''
        if (id.startsWith(`busnode:${raw.station_id}:`)) return cells[i]
      }
    } else if (this._stationCellById(raw.station_id)) {
      return this._stationCellById(raw.station_id)
    }

    const trafoRows = this.trafoRowsForDisplay(raw)
    const { x, y, w, h } = this._placeNewStationRect(graph, kv, trafoRows, isVirt)

    if (isVirt) {
      const parentStation = {
        id: raw.station_id,
        name,
        kv,
        lon: Number(raw.lon || 0),
        lat: Number(raw.lat || 0),
      }
      const channels = Array.isArray(this.data?.data?.channel_data) ? this.data.data.channel_data : []
      let busNames = resolveT10BusNames(raw, raw.station_id, channels)
      if (busNames.length === 0) busNames = [`${raw.station_name}.bus`]
      const inserted = []
      const gap = 28
      busNames.forEach((busName, i) => {
        const bn = createBusLayoutNode(parentStation, busName)
        bn.x = x + i * (T10_BUS_NODE_SIZE + gap)
        bn.y = y
        const cell = graph.insertVertex(
          parent,
          bn.id,
          '',
          bn.x,
          bn.y,
          bn.w,
          bn.h,
          busNodeStyle(bn.kv)
        )
        cell.entityType = 'busnode'
        cell.entityInfo = {
          type: 'busnode',
          station_id: bn.stationId,
          station_name: name,
          bus_name: bn.busName,
          bus_key: bn.busKey,
          vn_kv: bn.kv,
          is_virtual: true,
          raw,
        }
        inserted.push(cell)
      })
      if (inserted.length) graph.orderCells(false, inserted)
      this.rebindEntityInfo()
      this.enableManualEdit()
      return inserted[0] || null
    }

    const { html: label, topAlign } = buildStationVertexLabelHtml(
      { name, kv, trafoRows, isVirtual: isVirt },
      this.options.showLabels
    )
    const trafoLabel = Boolean(!isVirt && trafoRows.length)
    const cell = graph.insertVertex(
      parent,
      `station:${raw.station_id}`,
      label,
      x,
      y,
      w,
      h,
      stationStyleByKV(kv, topAlign, trafoLabel)
    )
    graph.orderCells(false, [cell])
    this.rebindEntityInfo()
    this.enableManualEdit()
    return cell
  }

  removeStationGraphCells(stationId) {
    const graph = this.graph
    if (!graph || !stationId) return
    const model = graph.getModel()
    const toRemove = []
    const seen = new Set()
    const addCell = (cell) => {
      if (!cell) return
      const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      if (!id || seen.has(id)) return
      seen.add(id)
      toRemove.push(cell)
    }

    addCell(this._stationCellById(stationId))
    this._endpointCellsForStation(stationId).forEach((cell) => {
      const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      if (id.startsWith('busnode:')) addCell(cell)
    })

    const channelBases = new Set()
    this._enumerateGraphChannelEdges().forEach((g) => {
      const from = g.from || g.edge?.entityInfo?.from_station
      const to = g.to || g.edge?.entityInfo?.to_station
      if (from !== stationId && to !== stationId) return
      const parsed = parseGraphChannelSuffix(g.suffix)
      if (parsed) channelBases.add(String(parsed.docChannelIndex))
      this._collectChannelGraphCellsBySuffix(g.suffix).forEach(addCell)
    })

    channelBases.forEach((base) => {
      ;['from', 'to'].forEach((end) => addCell(model.getCell(`sw:${base}:${end}`)))
    })

    const parent = graph.getDefaultParent()
    const allCells = graph.getChildCells(parent, true, true) || []
    for (let ci = 0; ci < allCells.length; ci++) {
      const cell = allCells[ci]
      const cid = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      if (!cid.startsWith('liaison-name:') && !cid.startsWith('liaison-pq:')) continue
      const ei = cell.entityInfo
      if (ei?.from_station === stationId || ei?.to_station === stationId) addCell(cell)
    }

    if (toRemove.length) forceRemoveGraphCells(graph, toRemove)
    this._purgeLineLabelsForStation(stationId)
    this.purgeOrphanChannelGraphCells()
    this._applyFlowMotionState(graph)
  }

  updateStationFromDoc(docStationIndex) {
    const graph = this.graph
    const raw = this.data?.data?.station_data?.[docStationIndex]
    if (!graph || !raw) return
    const cell = this._stationCellById(raw.station_id)
    if (!cell) {
      this.insertStationAtDocIndex(docStationIndex)
      return
    }
    const kv = normalizeKV(raw.vn_kv)
    const name = shortStationName(raw.station_name)
    const isVirt = isVirtualT10Station(name)
    const trafoRows = this.trafoRowsForDisplay(raw)
    const { html: label, topAlign } = buildStationVertexLabelHtml(
      { name, kv, trafoRows, isVirtual: isVirt },
      this.options.showLabels
    )
    const trafoLabel = Boolean(!isVirt && trafoRows.length)
    graph.getModel().setValue(cell, label)
    graph.setCellStyle(
      isVirt ? virtualT10StationStyle(kv, topAlign) : stationStyleByKV(kv, topAlign, trafoLabel),
      [cell]
    )
    this.rebindEntityInfo()
  }

  _pairLaneIndexForChannel(channel, docChannelIndex) {
    const channels = this.data?.data?.channel_data || []
    const pairKey = [channel.from_station, channel.to_station].sort().join('__')
    let lane = 0
    for (let i = 0; i < channels.length; i++) {
      if (i === docChannelIndex) break
      const c = channels[i]
      const k = [c.from_station, c.to_station].sort().join('__')
      if (k === pairKey) lane++
    }
    return lane
  }

  insertChannelAtDocIndex(docChannelIndex) {
    const graph = this.graph
    const channel = this.data?.data?.channel_data?.[docChannelIndex]
    if (!graph || !channel) return

    const ctx = this._buildChannelRouteContext()
    const links = (ctx.visualLinks || []).filter((l) => l.docChannelIndex === docChannelIndex)
    if (!links.length) return

    const model = graph.getModel()
    const pending = links.filter((link) => {
      const suffix = visualLinkCellSuffix(link.docChannelIndex, link.lineIndex, link.splitCount || 1)
      return !model.getCell(`liaison:${suffix}`)
    })
    if (!pending.length) return

    const junctionCells = []
    const edgeCells = []
    const lineNameCells = []
    const pqMetricCells = []
    const switchCells = []
    const edgeSwitchPairs = []

    model.beginUpdate()
    try {
      pending.forEach((link) => {
        this._insertVisualLinkGraphCells(link, ctx, {
          junctionCells,
          edgeCells,
          lineNameCells,
          pqMetricCells,
          switchCells,
          edgeSwitchPairs,
        })
      })
    } finally {
      model.endUpdate()
    }

    if (junctionCells.length > 0) graph.orderCells(true, junctionCells)
    if (edgeCells.length > 0) graph.orderCells(true, edgeCells)
    if (lineNameCells.length > 0) graph.orderCells(false, lineNameCells)
    if (pqMetricCells.length > 0) graph.orderCells(false, pqMetricCells)
    if (switchCells.length > 0) graph.orderCells(false, switchCells)

    this._alignEdgeSwitchPairsToRenderedEdges(edgeSwitchPairs)
    this.rebindEntityInfo()
    this.enableManualEdit()
    this._applyFlowMotionState(graph)
  }

  /** 插入单条 visual link 图元（与 parseSvg 拆线逻辑一致） */
  _insertVisualLinkGraphCells(link, ctx, out) {
    const graph = this.graph
    const model = graph?.getModel()
    const parent = graph?.getDefaultParent()
    const channel = link.channel
    if (!graph || !model || !channel) return

    const { docChannelIndex, lineIndex, lineItem, fromEndpoint, toEndpoint, fromStation, toStation } = link
    if (!fromEndpoint || !toEndpoint || !fromStation || !toStation) return

    const splitCount = link.splitCount || 1
    const cellSuffix = visualLinkCellSuffix(docChannelIndex, lineIndex, splitCount)
    if (model.getCell(`liaison:${cellSuffix}`)) return

    const route = this._computeVisualLinkRoute(link, ctx)
    if (!route) return

    const lineName = lineItem?.name ? String(lineItem.name).trim() : primaryLineNameFromChannel(channel)
    const pFromMw = lineItem ? pickLinePFromMw(lineItem) : pickChannelPFromMw(channel)
    const qFromMvar = lineItem ? pickLineQFromMvar(lineItem) : pickChannelQFromMvar(channel)
    const { style, lineColor, lineW, reverseFlow } = buildLiaisonChannelEdgeStyle(
      fromStation.kv,
      toStation.kv,
      pFromMw
    )

    const jw = 6
    const jh = 6
    const jFrom = graph.insertVertex(
      parent,
      `liaison-j-from:${cellSuffix}`,
      '',
      route.source.x - jw / 2,
      route.source.y - jh / 2,
      jw,
      jh,
      JUNCTION_STYLE
    )
    jFrom.entityType = 'junction'
    const jTo = graph.insertVertex(
      parent,
      `liaison-j-to:${cellSuffix}`,
      '',
      route.target.x - jw / 2,
      route.target.y - jh / 2,
      jw,
      jh,
      JUNCTION_STYLE
    )
    jTo.entityType = 'junction'
    out.junctionCells.push(jFrom, jTo)

    const edgeSource = reverseFlow ? jTo : jFrom
    const edgeTarget = reverseFlow ? jFrom : jTo
    const lineEntityInfo = {
      type: 'line',
      doc_channel_index: docChannelIndex,
      line_index: lineIndex,
      channel_name: channel.channel_name,
      from_station: channel.from_station,
      to_station: channel.to_station,
      from_station_name: fromStation.name,
      to_station_name: toStation.name,
      from_bus_name: lineItem?.from_bus_name || null,
      to_bus_name: lineItem?.to_bus_name || null,
      link_color: lineColor,
      link_width_px: lineW,
      from_kv: fromStation.kv,
      to_kv: toStation.kv,
      min_vn_kv: channel.min_vn_kv,
      max_vn_kv: channel.max_vn_kv,
      p_from_mw: pFromMw,
      q_from_mvar: qFromMvar,
      line_data: lineItem ? [lineItem] : channel.line_data || [],
      switch_data: channel.switch_data || [],
      raw: channel,
    }
    const edge = graph.insertEdge(parent, `liaison:${cellSuffix}`, '', edgeSource, edgeTarget, style)
    edge.entityType = 'line'
    edge.entityInfo = lineEntityInfo

    const nameLbl = this._syncLineNameLabel({
      suffix: cellSuffix,
      route,
      lineName,
      lineEntityInfo,
      showLabels: this.options.showLabels,
    })
    if (nameLbl) out.lineNameCells.push(nameLbl)

    const pqBlock = computeLongestSegmentPQBlockPosition(route)
    if (pqBlock) {
      const pqLbl = graph.insertVertex(
        parent,
        `liaison-pq:${cellSuffix}`,
        '',
        pqBlock.x,
        pqBlock.y,
        pqBlock.w,
        pqBlock.h,
        pqMetricStyle(this.options.theme)
      )
      pqLbl.entityType = 'line'
      pqLbl.entityInfo = lineEntityInfo
      this._syncPqLabelContent(graph, pqLbl, pFromMw, qFromMvar)
      out.pqMetricCells.push(pqLbl)
    }

    const geometry = edge.geometry ? edge.geometry.clone() : new mxGeometry()
    const reversedPts =
      reverseFlow && route.points.length >= 2
        ? [route.points[1], route.points[0]].map((p) => new mxPoint(p.x, p.y))
        : route.points.map((p) => new mxPoint(p.x, p.y))
    geometry.points = reversedPts
    geometry.relative = false
    edge.geometry = geometry
    out.edgeCells.push(edge)

    const closedFill = switchClosedFill(fromStation.kv, toStation.kv)
    const switchSpecs = buildChannelSwitchSpecs(channel)
    const effectiveSplit = splitCount > 1 ? splitCount : channelLineSplitCount(channel)
    const swSuffix = channelSwitchSuffix(docChannelIndex, lineIndex ?? 0, effectiveSplit)
    if (effectiveSplit > 1 && (lineIndex ?? 0) === 0) {
      this._purgeLegacySharedChannelSwitches(docChannelIndex)
    }
    switchSpecs.forEach((spec) => {
        const sd = channel.switch_data || []
        let switch_doc_index = null
        if (spec.item != null) {
          switch_doc_index = sd.findIndex(
            (x) => x === spec.item || (x && spec.item && String(x.name || '') === String(spec.item.name || ''))
          )
          if (switch_doc_index < 0) switch_doc_index = spec.end === 'to' ? 1 : 0
        }
        const prevForTo = route.points.length > 0 ? route.points[route.points.length - 1] : route.source
        const firstTurnForSw = route.points[0] || route.target
        const fromCenterPt = computeSwitchPointOnFirstLeg(route.source, firstTurnForSw)
        const toCenterPt = computeSwitchPointOnFirstLeg(route.target, prevForTo)
        const swRectFrom = switchRectAlongFirstLeg(route.source, firstTurnForSw)
        const swRectTo = switchRectAlongFirstLeg(route.target, prevForTo)
        const isFromEnd = spec.end === 'from'
        const centerPt = isFromEnd ? fromCenterPt : toCenterPt
        const swRect = isFromEnd ? swRectFrom : swRectTo
        let sw = model.getCell(`sw:${swSuffix}:${spec.end}`)
        if (!sw) {
          sw = graph.insertVertex(
            parent,
            `sw:${swSuffix}:${spec.end}`,
            '',
            centerPt.x + swRect.ox,
            centerPt.y + swRect.oy,
            swRect.w,
            swRect.h,
            switchStyle(spec.closed, lineColor, closedFill)
          )
          out.switchCells.push(sw)
        } else {
          graph.setCellStyle(switchStyle(spec.closed, lineColor, closedFill), [sw])
          const swGeo = model.getGeometry(sw)?.clone()
          if (swGeo) {
            swGeo.x = centerPt.x + swRect.ox
            swGeo.y = centerPt.y + swRect.oy
            swGeo.width = swRect.w
            swGeo.height = swRect.h
            model.setGeometry(sw, swGeo)
          }
        }
        sw.entityType = 'switch'
        sw.entityInfo = {
          type: 'switch',
          doc_channel_index: docChannelIndex,
          line_index: lineIndex,
          switch_doc_index,
          switch_end: spec.end,
          switch_item: spec.item,
          switch_name: spec.item?.name,
          channel_name: channel.channel_name,
          from_station: channel.from_station,
          to_station: channel.to_station,
          from_station_name: fromStation.name,
          to_station_name: toStation.name,
          link_color: lineColor,
          link_width_px: lineW,
          p_from_mw: pFromMw,
          q_from_mvar: qFromMvar,
          closed: spec.closed,
          switch_data: channel.switch_data || [],
          raw: channel,
        }
        out.edgeSwitchPairs.push({ edge, sw, switchLogicalEnd: spec.end, channelRoute: route, reverseFlow })
      })
  }

  _alignEdgeSwitchPairsToRenderedEdges(edgeSwitchPairs) {
    const graph = this.graph
    const model = graph?.getModel()
    if (!graph || !model || !edgeSwitchPairs?.length) return

    const align = () => {
      const view = graph.view
      if (view && typeof view.invalidate === 'function') view.invalidate()
      model.beginUpdate()
      try {
        edgeSwitchPairs.forEach(({ edge, sw, switchLogicalEnd, channelRoute, reverseFlow: rev }) => {
          if (!view || !view.getState(edge)) return
          const geo = model.getGeometry(sw)
          if (!geo) return
          const modelPts = GraphTool.getEdgePoints(graph, edge)
          if (!modelPts || modelPts.length < 2) return
          const n = modelPts.length
          let cx
          let cy
          let sr
          if (switchLogicalEnd === 'from') {
            if (rev && channelRoute) {
              const ft = channelRoute.points[0] || channelRoute.target
              sr = switchRectAlongFirstLeg(channelRoute.source, ft)
              const sp = computeSwitchPointOnFirstLeg(channelRoute.source, ft)
              cx = sp.x + sr.ox
              cy = sp.y + sr.oy
            } else {
              const p0 = modelPts[0]
              const p1 = modelPts[1]
              const dx = p1.x - p0.x
              const dy = p1.y - p0.y
              const len = Math.sqrt(dx * dx + dy * dy) || 1
              if (len < 1) return
              const dist = Math.min(
                SWITCH_DISTANCE_FROM_EXIT_PT,
                Math.max(4, len - SWITCH_RESERVE_BEFORE_CORNER_PT)
              )
              cx = p0.x + (dx / len) * dist
              cy = p0.y + (dy / len) * dist
              sr = switchRectAlongFirstLeg(p0, p1)
              cx += sr.ox
              cy += sr.oy
            }
          } else {
            const pNear = rev ? modelPts[0] : modelPts[n - 1]
            const pOut = rev ? modelPts[1] : modelPts[n - 2]
            const sp = computeSwitchPointOnFirstLeg(pNear, pOut)
            sr = switchRectAlongFirstLeg(pNear, pOut)
            cx = sp.x + sr.ox
            cy = sp.y + sr.oy
          }
          const next = geo.clone()
          next.x = cx
          next.y = cy
          next.width = sr.w
          next.height = sr.h
          model.setGeometry(sw, next)
        })
      } finally {
        model.endUpdate()
      }
    }
    align()
    if (typeof window !== 'undefined') window.setTimeout(align, 0)
  }

  removeChannelGraphCells(docChannelIndex) {
    const graph = this.graph
    if (!graph || docChannelIndex == null) return
    const cells = this._collectChannelGraphCells(docChannelIndex)
    if (cells.length) forceRemoveGraphCells(graph, cells)
    this._applyFlowMotionState(graph)
  }

  _renameChannelCellSuffix(oldSuffix, newSuffix) {
    const os = String(oldSuffix)
    const ns = String(newSuffix)
    if (os === ns) return
    const graph = this.graph
    const model = graph?.getModel()
    if (!graph || !model?.setId) return
    const pairs = [
      [`liaison:${os}`, `liaison:${ns}`],
      [`liaison-j-from:${os}`, `liaison-j-from:${ns}`],
      [`liaison-j-to:${os}`, `liaison-j-to:${ns}`],
      [`liaison-pq:${os}`, `liaison-pq:${ns}`],
      [`liaison-name:${os}`, `liaison-name:${ns}`],
    ]
    if (!os.includes(':') && !ns.startsWith('__t')) {
      pairs.push([`sw:${os}:from`, `sw:${ns}:from`], [`sw:${os}:to`, `sw:${ns}:to`])
    } else if (os.startsWith('__t') && !ns.startsWith('__t')) {
      const op = parseGraphChannelSuffix(os.slice(3))
      const np = parseGraphChannelSuffix(ns)
      if (op && np) {
        const oHasLine = os.slice(3).includes(':')
        const nHasLine = ns.includes(':')
        const oSw = oHasLine ? `${op.docChannelIndex}:${op.lineIndex}` : String(op.docChannelIndex)
        const nSw = nHasLine ? `${np.docChannelIndex}:${np.lineIndex}` : String(np.docChannelIndex)
        if (oSw !== nSw) {
          pairs.push(
            [`sw:${oSw}:from`, `sw:${nSw}:from`],
            [`sw:${oSw}:to`, `sw:${nSw}:to`],
            [`sw:__t${oSw}:from`, `sw:${nSw}:from`],
            [`sw:__t${oSw}:to`, `sw:${nSw}:to`]
          )
        }
      }
    }
    model.beginUpdate()
    try {
      for (let i = 0; i < pairs.length; i++) {
        const [oldId, newId] = pairs[i]
        const cell = model.getCell(oldId)
        if (!cell) continue
        const existing = model.getCell(newId)
        if (existing && existing !== cell) forceRemoveGraphCells(graph, [existing])
        model.setId(cell, newId)
      }
    } finally {
      model.endUpdate()
    }
  }

  /** 仅重命名通道开关 id（sw:N:from/to），不触碰 liaison 边 */
  _renameChannelSwitchBase(oldBase, newBase) {
    const ob = String(oldBase)
    const nb = String(newBase)
    if (ob === nb || ob.includes(':')) return
    const graph = this.graph
    const model = graph?.getModel()
    if (!graph || !model?.setId) return
    const pairs = [
      [`sw:${ob}:from`, `sw:${nb}:from`],
      [`sw:${ob}:to`, `sw:${nb}:to`],
    ]
    model.beginUpdate()
    try {
      for (let i = 0; i < pairs.length; i++) {
        const [oldId, newId] = pairs[i]
        const cell = model.getCell(oldId)
        if (!cell) continue
        const existing = model.getCell(newId)
        if (existing && existing !== cell) forceRemoveGraphCells(graph, [existing])
        model.setId(cell, newId)
      }
    } finally {
      model.endUpdate()
    }
  }

  /** 清理 resync 两阶段重命名遗留的 __t 临时 id 图元 */
  _purgeStaleTempChannelCells() {
    const graph = this.graph
    const model = graph?.getModel()
    if (!graph || !model) return
    const toRemove = []
    const seen = new Set()
    const add = (cell) => {
      if (!cell) return
      const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      if (!id || seen.has(id)) return
      seen.add(id)
      toRemove.push(cell)
    }
    const cells = graph.getChildCells(graph.getDefaultParent(), true, true) || []
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      if (!id.includes('__t')) continue
      if (id.startsWith('sw:__t')) add(cell)
      else if (id.startsWith('liaison-name:__t')) add(cell)
      else if (id.startsWith('liaison-pq:__t')) add(cell)
    }
    if (toRemove.length) forceRemoveGraphCells(graph, toRemove)
  }

  /** 无对应 liaison 边的线路名标签 */
  _purgeOrphanLineNameLabels() {
    const graph = this.graph
    const model = graph?.getModel()
    if (!graph || !model) return
    const toRemove = []
    const cells = graph.getChildCells(graph.getDefaultParent(), true, true) || []
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      if (!id.startsWith('liaison-name:')) continue
      const suffix = id.slice('liaison-name:'.length)
      if (suffix.includes('__t') || !model.getCell(`liaison:${suffix}`)) {
        toRemove.push(cell)
      }
    }
    if (toRemove.length) forceRemoveGraphCells(graph, toRemove)
  }

  /** resync 映射完成后，将开关 id 与文档下标对齐（修复 __t 临时 id 遗留） */
  _repairSwitchIdsAfterResync(mappings) {
    const graph = this.graph
    const model = graph?.getModel()
    const channels = this.data?.data?.channel_data || []
    if (!graph || !model || !mappings?.length) return

    const switchSwKey = (suffix) => {
      const parsed = parseGraphChannelSuffix(suffix)
      if (!parsed) return String(suffix)
      const splitCount = channelLineSplitCount(channels[parsed.docChannelIndex])
      if (splitCount > 1) return `${parsed.docChannelIndex}:${parsed.lineIndex}`
      return String(parsed.docChannelIndex)
    }

    model.beginUpdate()
    try {
      for (let mi = 0; mi < mappings.length; mi++) {
        const { oldSuffix, newSuffix } = mappings[mi]
        const oSw = switchSwKey(oldSuffix)
        const nSw = switchSwKey(newSuffix)
        if (oSw === nSw) continue
        ;['from', 'to'].forEach((end) => {
          const dst = `sw:${nSw}:${end}`
          if (model.getCell(dst)) return
          for (const src of [`sw:${oSw}:${end}`, `sw:__t${oSw}:${end}`]) {
            const cell = model.getCell(src)
            if (!cell) continue
            this._safeSetCellId(cell, dst)
            break
          }
        })
      }
    } finally {
      model.endUpdate()
    }
  }

  /** 删站/删通道后：按当前站位置重算全部线路几何与名称（suffix 须已 resync） */
  relayoutAllChannelsFromGraph() {
    const graph = this.graph
    const channels = this.data?.data?.channel_data || []
    if (!graph || !channels.length) return
    const ctx = this._buildChannelRouteContext()
    const usedSuffixes = new Set()
    for (let i = 0; i < channels.length; i++) {
      this._relayoutChannelAtDocIndex(i, ctx, usedSuffixes)
    }
    this.purgeOrphanChannelGraphCells()
    this._purgeOrphanLineNameLabels()
    this._purgeDuplicateLineNameLabels()
    this.rebindEntityInfo()
    this._applyFlowMotionState(graph)
  }

  /** 同线路名 + 起终点重复的名称标签只保留与 liaison 边 suffix 一致的一条 */
  _purgeDuplicateLineNameLabels() {
    const graph = this.graph
    const model = graph?.getModel()
    if (!graph || !model) return
    const channels = this.data?.data?.channel_data || []
    const parent = graph.getDefaultParent()
    const cells = graph.getChildCells(parent, true, true) || []
    const groups = new Map()
    const toRemove = []

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      if (!id.startsWith('liaison-name:')) continue
      const suffix = id.slice('liaison-name:'.length)
      const lineName = parseLineLabelFromCell(graph, cell)
      if (!lineName) continue
      const ei = cell.entityInfo
      let from = ei?.from_station
      let to = ei?.to_station
      const edge = model.getCell(`liaison:${suffix}`)
      if (edge?.entityInfo) {
        from = edge.entityInfo.from_station || from
        to = edge.entityInfo.to_station || to
      }
      if (!from || !to) {
        for (let ci = 0; ci < channels.length; ci++) {
          const ch = channels[ci]
          const lines = ch.line_data?.length ? ch.line_data : [null]
          for (let li = 0; li < lines.length; li++) {
            const name = this._lineNameForChannelLine(ch, li)
            if (name !== lineName) continue
            from = ch.from_station
            to = ch.to_station
            break
          }
          if (from && to) break
        }
      }
      if (!from || !to) {
        if (!edge) toRemove.push(cell)
        continue
      }
      const key = `${lineName}::${[from, to].sort().join('::')}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push({ cell, suffix, lineName, from, to })
    }

    groups.forEach((items) => {
      if (items.length <= 1) return
      const canonical = new Set()
      for (let ci = 0; ci < channels.length; ci++) {
        const ch = channels[ci]
        const lines = ch.line_data?.length ? ch.line_data : [null]
        for (let li = 0; li < lines.length; li++) {
          const name = this._lineNameForChannelLine(ch, li)
          if (!name) continue
          const pairKey = `${name}::${[ch.from_station, ch.to_station].sort().join('::')}`
          const itemKey = `${items[0].lineName}::${[items[0].from, items[0].to].sort().join('::')}`
          if (pairKey !== itemKey) continue
          const splitCount = lines.length
          canonical.add(visualLinkCellSuffix(ci, li, splitCount > 1 ? splitCount : 1))
        }
      }
      let keep = items.find((x) => canonical.has(x.suffix) && model.getCell(`liaison:${x.suffix}`))
      if (!keep) keep = items.find((x) => model.getCell(`liaison:${x.suffix}`)) || items[0]
      items.forEach((x) => {
        if (x.cell !== keep.cell) toRemove.push(x.cell)
      })
    })
    if (toRemove.length) forceRemoveGraphCells(graph, toRemove)
  }

  _renameChannelCellId(oldIdx, newIdx) {
    this._renameChannelCellSuffix(String(oldIdx), String(newIdx))
  }

  /** 删除单条通道后，将 liaison:N 与文档下标重新对齐 */
  reindexChannelCellIdsAfterDelete() {
    this.resyncChannelCellIdsToDoc()
  }

  /**
   * 批量删通道/删站后：按起终点 + 线路名匹配画布后缀，重命名 id 与文档下标对齐；不重算全局布局。
   */
  resyncChannelCellIdsToDoc() {
    const graph = this.graph
    const model = graph?.getModel()
    const channels = this.data?.data?.channel_data || []
    if (!graph || !model) {
      this.rebindEntityInfo()
      return
    }

    this._purgeGraphChannelsNotInDoc()

    const graphEdges = this._enumerateGraphChannelEdges()
    const usedSuffixes = new Set()
    const mappings = []

    for (let docIdx = 0; docIdx < channels.length; docIdx++) {
      const ch = channels[docIdx]
      const lines = Array.isArray(ch.line_data) && ch.line_data.length > 0 ? ch.line_data : [null]
      const splitCount = lines.length

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const newSuffix = visualLinkCellSuffix(docIdx, lineIndex, splitCount > 1 ? splitCount : 1)
        let pickSuffix = this._pickGraphSuffixForDocChannel(ch, usedSuffixes, lineIndex, docIdx)

        if (!pickSuffix) {
          const atNew = this._resolveChannelGraphCellsBySuffix(newSuffix)
          if (atNew?.edge && this._graphEdgeMatchesDocChannel(
            { suffix: newSuffix, edge: atNew.edge, from: atNew.edge.entityInfo?.from_station, to: atNew.edge.entityInfo?.to_station, lineName: null },
            ch,
            lineIndex
          )) {
            pickSuffix = newSuffix
          }
        }

        if (!pickSuffix) continue
        usedSuffixes.add(pickSuffix)
        if (pickSuffix === newSuffix) continue

        mappings.push({ oldSuffix: pickSuffix, newSuffix })
      }
    }

    const orphans = graphEdges.filter(
      (g) => !usedSuffixes.has(g.suffix) && !this._graphEdgeMatchesAnyDocChannel(g)
    )
    if (orphans.length) {
      const toRemove = []
      const seen = new Set()
      const orphanBases = new Set()
      orphans.forEach((g) => {
        const parsed = parseGraphChannelSuffix(g.suffix)
        if (parsed) orphanBases.add(String(parsed.docChannelIndex))
        this._collectChannelGraphCellsBySuffix(g.suffix).forEach((c) => {
          const id = typeof c.getId === 'function' ? String(c.getId()) : ''
          if (id && !seen.has(id)) {
            seen.add(id)
            toRemove.push(c)
          }
        })
      })
      orphanBases.forEach((base) => {
        const docIdx = Number(base)
        if (docIdx >= 0 && docIdx < channels.length) return
        ;['from', 'to'].forEach((end) => {
          const sw = model.getCell(`sw:${base}:${end}`)
          if (sw) {
            const id = typeof sw.getId === 'function' ? String(sw.getId()) : ''
            if (id && !seen.has(id)) {
              seen.add(id)
              toRemove.push(sw)
            }
          }
        })
        for (let li = 0; li < 8; li++) {
          ;['from', 'to'].forEach((end) => {
            const sw = model.getCell(`sw:${base}:${li}:${end}`)
            if (sw) {
              const id = typeof sw.getId === 'function' ? String(sw.getId()) : ''
              if (id && !seen.has(id)) {
                seen.add(id)
                toRemove.push(sw)
              }
            }
          })
        }
      })
      if (toRemove.length) forceRemoveGraphCells(graph, toRemove)
    }

    for (let i = 0; i < mappings.length; i++) {
      this._renameChannelCellSuffix(mappings[i].oldSuffix, `__t${mappings[i].oldSuffix}`)
    }
    const phase2 = [...mappings].sort((a, b) => {
      const ao = parseGraphChannelSuffix(a.oldSuffix)?.docChannelIndex ?? 0
      const bo = parseGraphChannelSuffix(b.oldSuffix)?.docChannelIndex ?? 0
      return bo - ao
    })
    for (let i = 0; i < phase2.length; i++) {
      this._renameChannelCellSuffix(`__t${phase2[i].oldSuffix}`, phase2[i].newSuffix)
    }

    this._repairSwitchIdsAfterResync(mappings)

    for (let mi = 0; mi < mappings.length; mi++) {
      const { oldSuffix, newSuffix } = mappings[mi]
      const op = parseGraphChannelSuffix(oldSuffix)
      const np = parseGraphChannelSuffix(newSuffix)
      if (!op || !np || !String(oldSuffix).includes(':') || op.lineIndex !== 0) continue
      const splitCount = channelLineSplitCount(channels[np.docChannelIndex])
      if (splitCount <= 1) continue
      ;['from', 'to'].forEach((end) => {
        const legacy = model.getCell(`sw:${op.docChannelIndex}:${end}`)
        const canonicalId = this._canonicalSwitchCellId(np.docChannelIndex, np.lineIndex, splitCount, end)
        if (!legacy || model.getCell(canonicalId)) return
        this._safeSetCellId(legacy, canonicalId)
      })
    }

    this.purgeOrphanChannelGraphCells()
    this._insertMissingDocChannelsIfAbsent()
    this._cleanupLineNameLabelsAfterResync()
    this._normalizeChannelSwitchIds()
    this.rebindEntityInfo()
    this._applyFlowMotionState(graph)
  }

  renameStationCellId(oldId, newId) {
    const graph = this.graph
    const model = graph?.getModel()
    if (!graph || !model?.setId || !oldId || !newId || oldId === newId) return
    const cell = this._stationCellById(oldId)
    if (!cell) return
    model.beginUpdate()
    try {
      model.setId(cell, `station:${newId}`)
    } finally {
      model.endUpdate()
    }
    this.updateStationFromDoc(
      (this.data?.data?.station_data || []).findIndex((s) => s.station_id === newId)
    )
    this.rebindEntityInfo()
  }

  updateChannelFromDoc(docChannelIndex) {
    const graph = this.graph
    if (!graph) return
    this._removeChannelGraphCellsResolved(docChannelIndex)
    this.insertChannelAtDocIndex(docChannelIndex)
  }

  /** 仅同步开关增删/样式/位置，不删除通道边（避免删线重插失败导致线路消失） */
  updateChannelSwitchesFromDoc(docChannelIndex) {
    const graph = this.graph
    if (!graph) return
    const bundle = this._resolveChannelGraphCells(docChannelIndex)
    if (!bundle?.edge) {
      this.insertChannelAtDocIndex(docChannelIndex)
      this.rebindEntityInfo()
      this._applyFlowMotionState(graph)
      return
    }
    const ctx = this._buildChannelRouteContext()
    this._relayoutChannelAtDocIndex(docChannelIndex, ctx)
    this.rebindEntityInfo()
    this._applyFlowMotionState(graph)
  }

  /** 仅刷新线路名独立文本（不删线重画） */
  updateChannelLabelOnly(docChannelIndex) {
    const graph = this.graph
    const channel = this.data?.data?.channel_data?.[docChannelIndex]
    if (!graph || !channel) return
    const bundle = this._resolveChannelGraphCells(docChannelIndex)
    if (!bundle?.edge) return
    const route = routeFromChannelBundle(graph, bundle, bundle.edge)
    const lineName = primaryLineNameFromChannel(channel)
    this._syncLineNameLabel({
      suffix: bundle.suffix,
      route,
      lineName,
      lineEntityInfo: bundle.edge.entityInfo,
      showLabels: this.options.showLabels,
    })
  }

  syncAllLabels() {
    const payload = this.data?.data || {}
    const rawStations = payload.station_data || []
    rawStations.forEach((raw, docStationIndex) => {
      if (normalizeKV(raw.vn_kv) >= 35) this.updateStationFromDoc(docStationIndex)
    })
    const rawChannels = payload.channel_data || []
    for (let i = 0; i < rawChannels.length; i++) {
      this.updateChannelLabelOnly(i)
    }
  }

  /** 切换画布亮/暗色时，刷新线路名与 P/Q 量测文字颜色 */
  applyLineTextTheme(theme) {
    this.options.theme = theme === 'light' ? 'light' : 'dark'
    const graph = this.graph
    if (!graph) return
    const model = graph.getModel()
    const parent = graph.getDefaultParent()
    const cells = graph.getChildCells(parent, true, true) || []
    const t = this.options.theme
    const nameStyle = lineNameStyle(t)
    const pqStyle = pqMetricStyle(t)
    model.beginUpdate()
    try {
      cells.forEach((cell) => {
        const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
        if (id.startsWith('liaison-name:')) {
          const lineName = parseLineLabelFromCell(graph, cell)
          if (!lineName) return
          model.setValue(cell, buildLineNameHtml(lineName, this.options.showLabels, t))
          graph.setCellStyle(nameStyle, [cell])
          return
        }
        if (id.startsWith('liaison-pq:')) {
          const info = cell.entityInfo
          if (!info) return
          if (!this.measurementsVisible()) {
            model.setValue(cell, '')
            return
          }
          model.setValue(cell, buildPqMetricHtml(info.p_from_mw, info.q_from_mvar, t))
          graph.setCellStyle(pqStyle, [cell])
        }
      })
    } finally {
      model.endUpdate()
    }
    if (graph.view?.invalidate) graph.view.invalidate()
  }

  /**
   * 策略 B：布局 XML 不变，仅按当前 JSON 刷新量测表现（主变 P/Q、线路飘字、潮流箭头、开关状态、运动箭头）。
   * 不修改站/线/开关几何，不触发 parseSvg 或整通道重画。
   */
  syncMeasurementsFromDoc() {
    const graph = this.graph
    if (!graph) return

    const payload = this.data?.data || {}
    const rawStations = Array.isArray(payload.station_data) ? payload.station_data : []
    const rawChannels = Array.isArray(payload.channel_data) ? payload.channel_data : []

    rawStations.forEach((raw, docStationIndex) => {
      if (normalizeKV(raw.vn_kv) >= 35) this._syncStationMeasurementsAtDocIndex(docStationIndex)
    })
    for (let i = 0; i < rawChannels.length; i++) {
      const ch = rawChannels[i]
      if (Number(ch?.min_vn_kv || 0) >= 35) this._syncChannelMeasurementsAtDocIndex(i)
    }

    this.rebindEntityInfo()
    this._applyFlowMotionState(graph, { deferMs: 0 })
    if (graph.view?.invalidate) graph.view.invalidate()
    if (graph.view?.validate) graph.view.validate()
  }

  /** 仅更新站房标签内主变 P/Q（不改坐标与尺寸） */
  _syncStationMeasurementsAtDocIndex(docStationIndex) {
    const graph = this.graph
    const raw = this.data?.data?.station_data?.[docStationIndex]
    if (!graph || !raw?.station_id) return
    const cell = this._stationCellById(raw.station_id)
    if (!cell) return

    const kv = normalizeKV(raw.vn_kv)
    const name = shortStationName(raw.station_name)
    const isVirt = isVirtualT10Station(name)
    const trafoRows = this.trafoRowsForDisplay(raw)
    const { html: label, topAlign } = buildStationVertexLabelHtml(
      { name, kv, trafoRows, isVirtual: isVirt },
      this.options.showLabels
    )
    const trafoLabel = Boolean(!isVirt && trafoRows.length)
    graph.getModel().setValue(cell, label)
    graph.setCellStyle(
      isVirt ? virtualT10StationStyle(kv, topAlign) : stationStyleByKV(kv, topAlign, trafoLabel),
      [cell]
    )
  }

  _syncChannelMeasurementsAtDocIndex(docChannelIndex) {
    const suffixes = this._collectChannelSuffixesForDocIndex(docChannelIndex)
    suffixes.forEach((suffix) => this._syncChannelMeasurementsBySuffix(suffix, docChannelIndex))
  }

  _syncChannelMeasurementsBySuffix(suffix, docChannelIndex) {
    const graph = this.graph
    const model = graph?.getModel()
    const channel = this.data?.data?.channel_data?.[docChannelIndex]
    if (!graph || !model || !channel) return

    const bundle = this._resolveChannelGraphCellsBySuffix(suffix)
    if (!bundle?.edge || !bundle.jFrom || !bundle.jTo) return

    const parsed = parseGraphChannelSuffix(suffix)
    const lineIndex = parsed?.lineIndex ?? 0
    const lineItem = pickChannelLineItem(channel, lineIndex)

    const rawStations = this.data?.data?.station_data || []
    const fromRaw = rawStations.find((s) => s.station_id === channel.from_station)
    const toRaw = rawStations.find((s) => s.station_id === channel.to_station)
    const fromKv = normalizeKV(fromRaw?.vn_kv)
    const toKv = normalizeKV(toRaw?.vn_kv)
    const pFromMw = lineItem ? pickLinePFromMw(lineItem) : pickChannelPFromMw(channel)
    const qFromMvar = lineItem ? pickLineQFromMvar(lineItem) : pickChannelQFromMvar(channel)
    const { style, lineColor, lineW, reverseFlow } = buildLiaisonChannelEdgeStyle(fromKv, toKv, pFromMw)
    const closedFill = switchClosedFill(fromKv, toKv)

    const wantSource = reverseFlow ? bundle.jTo : bundle.jFrom
    const wantTarget = reverseFlow ? bundle.jFrom : bundle.jTo
    const currentSource = model.getTerminal(bundle.edge, true)

    model.beginUpdate()
    try {
      if (currentSource !== wantSource) {
        model.setTerminal(bundle.edge, wantSource, true)
        model.setTerminal(bundle.edge, wantTarget, false)
        const edgeGeo = model.getGeometry(bundle.edge)?.clone()
        if (edgeGeo?.points?.length >= 2) {
          edgeGeo.points = edgeGeo.points.slice().reverse()
          edgeGeo.offset = null
          model.setGeometry(bundle.edge, edgeGeo)
        }
      }
      graph.setCellStyle(style, [bundle.edge])
      bundle.edge.entityType = 'line'
      bundle.edge.entityInfo = buildLineEntityInfoFromChannel(
        channel,
        docChannelIndex,
        lineIndex,
        new Map(rawStations.map((s) => [s.station_id, shortStationName(s.station_name)])),
        new Map(rawStations.map((s) => [s.station_id, s]))
      )
    } finally {
      model.endUpdate()
    }

    const pqLbl = model.getCell(`liaison-pq:${suffix}`)
    if (pqLbl) {
      this._syncPqLabelContent(graph, pqLbl, pFromMw, qFromMvar)
    }

    const switchSpecs = buildChannelSwitchSpecs(channel)
    const splitCount = channelLineSplitCount(channel)
    const swSuffix = channelSwitchSuffix(docChannelIndex, lineIndex, splitCount)
    switchSpecs.forEach((spec) => {
      const sw = model.getCell(`sw:${swSuffix}:${spec.end}`)
      if (!sw) return
      graph.setCellStyle(switchStyle(spec.closed, lineColor, closedFill), [sw])
    })
  }

  _drawOneChannel(ctx) {
    const {
      channel,
      docChannelIndex,
      idx,
      from,
      to,
      stations,
      stationById,
      stationsCell,
      rawStationById,
      sidePortTotals,
      sidePortRankByKey,
    } = ctx
    const graph = this.graph
    const model = graph.getModel()
    const parent = graph.getDefaultParent()

    const pairKey = [from.id, to.id].sort().join('__')
    const laneIndex = this._pairLaneIndexForChannel(channel, docChannelIndex)

    const sides = pickSidesFacingPeer(
      { x: from.x + from.w / 2, y: from.y + from.h / 2 },
      { x: to.x + to.w / 2, y: to.y + to.h / 2 }
    )
    const sourcePortKey = `${from.id}:${sides.from}`
    const targetPortKey = `${to.id}:${sides.to}`
    const sourceTotal = sidePortTotals.get(sourcePortKey) || 1
    const targetTotal = sidePortTotals.get(targetPortKey) || 1
    const sourceRank = sidePortRankByKey.get(`${idx}@@${sourcePortKey}`) ?? 0
    const targetRank = sidePortRankByKey.get(`${idx}@@${targetPortKey}`) ?? 0
    const sourceOffset = portOffsetDistributedOnSide(from, sides.from, sourceRank, sourceTotal)
    const targetOffset = portOffsetDistributedOnSide(to, sides.to, targetRank, targetTotal)
    const trunkStagger = channelTrunkStagger(docChannelIndex)

    let route = buildOrthogonalRoute(from, to, laneIndex, sourceOffset, targetOffset, trunkStagger)
    route = nudgeRouteAwayFromStations(route, from, to, stations)

    const lineName = primaryLineNameFromChannel(channel)
    const pFromMw = pickChannelPFromMw(channel)
    const qFromMvar = pickChannelQFromMvar(channel)
    const { style, lineColor, lineW, reverseFlow } = buildLiaisonChannelEdgeStyle(from.kv, to.kv, pFromMw)

    const jw = 6
    const jh = 6
    const jFrom = graph.insertVertex(
      parent,
      `liaison-j-from:${docChannelIndex}`,
      '',
      route.source.x - jw / 2,
      route.source.y - jh / 2,
      jw,
      jh,
      JUNCTION_STYLE
    )
    const jTo = graph.insertVertex(
      parent,
      `liaison-j-to:${docChannelIndex}`,
      '',
      route.target.x - jw / 2,
      route.target.y - jh / 2,
      jw,
      jh,
      JUNCTION_STYLE
    )
    const edgeSource = reverseFlow ? jTo : jFrom
    const edgeTarget = reverseFlow ? jFrom : jTo
    const edge = graph.insertEdge(parent, `liaison:${docChannelIndex}`, '', edgeSource, edgeTarget, style)

    const lineNameCells = []
    const nameLbl = this._syncLineNameLabel({
      suffix: String(docChannelIndex),
      route,
      lineName,
      lineEntityInfo: edge.entityInfo,
      showLabels: this.options.showLabels,
    })
    if (nameLbl) lineNameCells.push(nameLbl)

    const pqBlock = computeLongestSegmentPQBlockPosition(route)
    const pqMetricCells = []
    if (pqBlock) {
      const pqLbl = graph.insertVertex(
        parent,
        `liaison-pq:${docChannelIndex}`,
        '',
        pqBlock.x,
        pqBlock.y,
        pqBlock.w,
        pqBlock.h,
        pqMetricStyle(this.options.theme)
      )
      this._syncPqLabelContent(graph, pqLbl, pFromMw, qFromMvar)
      pqMetricCells.push(pqLbl)
    }

    const geometry = edge.geometry ? edge.geometry.clone() : new mxGeometry()
    const reversedPts =
      reverseFlow && route.points.length >= 2
        ? [route.points[1], route.points[0]].map((p) => new mxPoint(p.x, p.y))
        : route.points.map((p) => new mxPoint(p.x, p.y))
    geometry.points = reversedPts
    geometry.relative = false
    edge.geometry = geometry

    const closedFill = switchClosedFill(from.kv, to.kv)
    const switchSpecs = buildChannelSwitchSpecs(channel)
    const switchCells = []
    const edgeSwitchPairs = []
    switchSpecs.forEach((spec) => {
      const prevForTo = route.points.length > 0 ? route.points[route.points.length - 1] : route.source
      const firstTurnForSw = route.points[0] || route.target
      const fromCenterPt = computeSwitchPointOnFirstLeg(route.source, firstTurnForSw)
      const toCenterPt = computeSwitchPointOnFirstLeg(route.target, prevForTo)
      const swRectFrom = switchRectAlongFirstLeg(route.source, firstTurnForSw)
      const swRectTo = switchRectAlongFirstLeg(route.target, prevForTo)
      const isFromEnd = spec.end === 'from'
      const centerPt = isFromEnd ? fromCenterPt : toCenterPt
      const swRect = isFromEnd ? swRectFrom : swRectTo
      const sw = graph.insertVertex(
        parent,
        `sw:${docChannelIndex}:${spec.end}`,
        '',
        centerPt.x + swRect.ox,
        centerPt.y + swRect.oy,
        swRect.w,
        swRect.h,
        switchStyle(spec.closed, lineColor, closedFill)
      )
      switchCells.push(sw)
      edgeSwitchPairs.push({
        edge,
        sw,
        switchLogicalEnd: spec.end,
        channelRoute: route,
        reverseFlow,
      })
    })

    graph.orderCells(true, [jFrom, jTo, edge])
    if (lineNameCells.length) graph.orderCells(false, lineNameCells)
    if (pqMetricCells.length) graph.orderCells(false, pqMetricCells)
    if (switchCells.length) graph.orderCells(false, switchCells)

    const alignSwitches = () => {
      if (!edgeSwitchPairs.length) return
      graph.view.invalidate()
      model.beginUpdate()
      try {
        edgeSwitchPairs.forEach(({ edge: ed, sw, switchLogicalEnd, channelRoute, reverseFlow: rev }) => {
          if (!graph.view.getState(ed)) return
          const geo = model.getGeometry(sw)
          if (!geo) return
          const modelPts = GraphTool.getEdgePoints(graph, ed)
          if (!modelPts || modelPts.length < 2) return
          const n = modelPts.length
          let cx
          let cy
          let sr
          if (switchLogicalEnd === 'from') {
            if (rev && channelRoute) {
              const ft = channelRoute.points[0] || channelRoute.target
              sr = switchRectAlongFirstLeg(channelRoute.source, ft)
              const sp = computeSwitchPointOnFirstLeg(channelRoute.source, ft)
              cx = sp.x + sr.ox
              cy = sp.y + sr.oy
            } else {
              const p0 = modelPts[0]
              const p1 = modelPts[1]
              const dx = p1.x - p0.x
              const dy = p1.y - p0.y
              const len = Math.sqrt(dx * dx + dy * dy) || 1
              if (len < 1) return
              const dist = Math.min(
                SWITCH_DISTANCE_FROM_EXIT_PT,
                Math.max(4, len - SWITCH_RESERVE_BEFORE_CORNER_PT)
              )
              cx = p0.x + (dx / len) * dist
              cy = p0.y + (dy / len) * dist
              sr = switchRectAlongFirstLeg(p0, p1)
              cx += sr.ox
              cy += sr.oy
            }
          } else {
            const pNear = rev ? modelPts[0] : modelPts[n - 1]
            const pOut = rev ? modelPts[1] : modelPts[n - 2]
            const sp = computeSwitchPointOnFirstLeg(pNear, pOut)
            sr = switchRectAlongFirstLeg(pNear, pOut)
            cx = sp.x + sr.ox
            cy = sp.y + sr.oy
          }
          const next = geo.clone()
          next.x = cx
          next.y = cy
          next.width = sr.w
          next.height = sr.h
          model.setGeometry(sw, next)
        })
      } finally {
        model.endUpdate()
      }
    }
    alignSwitches()
    if (typeof window !== 'undefined') window.setTimeout(alignSwitches, 0)
  }
}
