import GraphTool from '@/plugins/tmzx/graph/GraphTool.js'

function normalizeKV(value) {
  return Math.round(Number(value || 0))
}

function shortStationName(name) {
  const raw = String(name || '')
  const parts = raw.split('.')
  return parts[parts.length - 1] || raw || '未知站'
}

/** 名称含 T+数字（如 T1、T2、T10）的虚拟站：与 110kV 同尺寸的虚线空心矩形母线框；内有文字（有标签时为短名，无标签时为「T+数字」） */
function isVirtualT10Station(name) {
  const str = String(name || '')
  return /T\d+/i.test(str)
}

/** 110kV 档站房外框色，用于 T10 虚线矩形描边 */
const STROKE_110 = '#c03548'

/** 站房尺寸由算法/JSON 决定，禁止在画布上拉伸 */
const LIAISON_STATION_NO_RESIZE = 'resizable=0;rotatable=0;'

function virtualT10StationStyle(kv) {
  const fill = kv >= 220 ? '#3d0060' : kv >= 110 ? STROKE_110 : '#b8b800'
  return `${LIAISON_STATION_NO_RESIZE}shape=ellipse;aspect=fixed;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${fill};strokeWidth=1;fontColor=#ffffff;fontSize=10;fontStyle=1;align=center;verticalAlign=middle;`
}

/** 230kV 视同 220kV，115kV 视同 110kV（normalizeKV + 阈值） */
const KV220 = '#50007F'
const KV110 = '#F04155'
const KV35 = '#FFFF00'

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
  return kv >= 110 ? '#ffffff' : '#1e293b'
}

/**
 * 站房标签：不展示电压档位；`trafo_display_list` 时在站名下方小字展示：多台主变**横向并排**，每台内 **P 与 Q 上下排列**（不展示主变名，无单位）。
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
    const ne = escapeHtmlLabel(s.name)
    return {
      html: `<div style="text-align:center;font-size:11px;font-weight:700;color:#ffffff;">${ne}</div>`,
      topAlign: false,
    }
  }
  const color = stationInnerLabelColor(s.kv)
  const rows = s.trafoRows || []
  const titlePx = s.kv >= 220 ? 14 : s.kv >= 110 ? 12 : 11
  const trafoPx = 8
  const nameEsc = escapeHtmlLabel(s.name)
  if (rows.length === 0) {
    return {
      html: `<div style="text-align:center;font-size:${titlePx}px;font-weight:700;color:${color};line-height:1;">${nameEsc}</div>`,
      topAlign: false,
    }
  }
  const colStyle = `display:flex;flex-direction:column;align-items:center;justify-content:flex-start;font-size:${trafoPx}px;font-weight:600;line-height:1;`
  const columns = rows
    .map((r) => {
      const ps = formatMwMvarNumber(r.p)
      const qs = formatMwMvarNumber(r.q)
      return `<div style="${colStyle}"><div style="line-height:1;">${ps}</div><div style="line-height:1;">${qs}</div></div>`
    })
    .join('')
  const trafoRow = `<div style="display:flex;flex-direction:row;justify-content:center;align-items:flex-start;flex-wrap:wrap;gap:4px 8px;margin:0;padding:0;line-height:0;font-size:0;">${columns}</div>`
  return {
    html: `<div style="text-align:center;color:${color};margin:0;padding:0;line-height:0;font-size:0;">
<div style="font-size:${titlePx}px;font-weight:700;line-height:1;margin:0;padding:0;">${nameEsc}</div>
<div style="margin-top:5px;padding:0;line-height:0;font-size:0;">${trafoRow}</div>
</div>`,
    topAlign: true,
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

/**
 * 不同站对之间若仍共线，用通道序号微调主干横/竖段，减轻叠线（链式拓扑常用）
 */
function channelTrunkStagger(channelIndex) {
  const step = 22
  const slot = channelIndex % 9
  return (slot - 4) * step
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

  if (station.isVirtual) {
    return { x: x + w / 2, y: y + h / 2 }
  }

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
  trunkStagger = 0
) {
  const fromCenter = { x: fromStation.x + fromStation.w / 2, y: fromStation.y + fromStation.h / 2 }
  const toCenter = { x: toStation.x + toStation.w / 2, y: toStation.y + toStation.h / 2 }
  const side = pickSidesFacingPeer(fromCenter, toCenter)
  const offset = pairLaneOffset(edgeIndex)
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
  const useFirstChannelSimpleRoute = edgeIndex === 0
  const fromLR = side.from === 'left' || side.from === 'right'
  const toLR = side.to === 'left' || side.to === 'right'

  let verticalFirst
  if (useFirstChannelSimpleRoute) {
    if (fromLR && !toLR) {
      points.push({ x: target.x, y: source.y })
      verticalFirst = false
    } else if (!fromLR && toLR) {
      points.push({ x: source.x, y: target.y })
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

function computeTopologyLayout(stations, channels) {
  const scale = layoutCompactScale(stations.length)
  const width = 2600 * scale
  const height = 1400 * scale
  const centerX = width / 2
  const centerY = height / 2
  const adjacency = new Map()
  stations.forEach((s) => adjacency.set(s.id, new Set()))
  channels.forEach((c) => {
    adjacency.get(c.from_station)?.add(c.to_station)
    adjacency.get(c.to_station)?.add(c.from_station)
  })

  stations.forEach((s) => {
    if (isVirtualT10Station(s.name)) {
      s._hubDegree = adjacency.get(s.id)?.size || 0
    }
  })

  const root = [...stations].sort((a, b) => b.kv - a.kv)[0]
  const t10Hub = findT10HubStation(stations)
  if (t10Hub && (t10Hub._hubDegree || 0) >= T10_HUB_MIN_DEGREE && root) {
    applyT10HubSubcenterLayout(stations, adjacency, root, t10Hub, scale, centerX, centerY)
    return
  }

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
  stations.forEach((s) => {
    if (!levelMap.has(s.id)) levelMap.set(s.id, 2)
  })

  const levelGroups = new Map()
  stations.forEach((s) => {
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
    stations.length <= RING_TWIST_MAX_STATIONS && maxOnRing <= RING_TWIST_MAX_ON_LEVEL
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
  const va = topAlign ? 'top' : 'middle'
  const st = topAlign ? '2' : '0'
  const fs = trafoLabel ? '8' : kv >= 220 ? '15' : kv >= 110 ? '13' : '12'
  if (kv >= 220) {
    return `${LIAISON_STATION_NO_RESIZE}rounded=0;whiteSpace=wrap;html=1;fillColor=${KV220};strokeColor=#3d0060;strokeWidth=2;fontColor=#ffffff;fontSize=${fs};align=center;verticalAlign=${va};spacingTop=${st};`
  }
  if (kv >= 110) {
    return `${LIAISON_STATION_NO_RESIZE}rounded=0;whiteSpace=wrap;html=1;fillColor=${KV110};strokeColor=#c03548;strokeWidth=2;fontColor=#ffffff;fontSize=${fs};align=center;verticalAlign=${va};spacingTop=${st};`
  }
  return `${LIAISON_STATION_NO_RESIZE}rounded=0;whiteSpace=wrap;html=1;fillColor=${KV35};strokeColor=#b8b800;strokeWidth=2;fontColor=#1e293b;fontSize=${fs};align=center;verticalAlign=${va};spacingTop=${st};`
}

/** 与站房分级一致：≥220 为 3 档，≥110 为 2 档，其余（≥35）为 1 档 */
function voltageTier(kv) {
  const k = normalizeKV(kv)
  if (k >= 220) return 3
  if (k >= 110) return 2
  return 1
}

/**
 * 联络线颜色（230 视同 220，115 视同 110）：
 * 220↔220 紫 #50007F；220↔110 红；220↔35 黄；110↔110 红；110↔35 黄；35↔35 黄
 */
function linkStrokeColor(fromKv, toKv) {
  const a = voltageTier(fromKv)
  const b = voltageTier(toKv)
  const low = Math.min(a, b)
  const high = Math.max(a, b)
  if (high === 3 && low === 3) return KV220
  if (high === 3 && low === 2) return KV110
  if (high === 3 && low === 1) return KV35
  if (high === 2 && low === 2) return KV110
  if (high === 2 && low === 1) return KV35
  return KV35
}

/**
 * 联络线宽：220↔220 为 3px；220↔110 与 110↔110 为 2.5px；凡含 35 档或仅 35↔35 为 2px
 */
function linkStrokeWidthPx(fromKv, toKv) {
  const a = voltageTier(fromKv)
  const b = voltageTier(toKv)
  const low = Math.min(a, b)
  const high = Math.max(a, b)
  if (high === 3 && low === 3) return 3
  if (high === 3 && low === 2) return 2.5
  if (high === 3 && low === 1) return 2
  if (high === 2 && low === 2) return 2.5
  if (high === 2 && low === 1) return 2
  return 2
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

/** 线路两侧飘字（与边分离，仅展示 P/Q） */
const PQ_METRIC_STYLE =
  'text;html=1;strokeColor=none;fillColor=none;fontColor=#334155;fontSize=10;align=center;verticalAlign=middle;movable=0;resizable=0;rotatable=0;whiteSpace=wrap;spacing=2;'

/** 线路名靠近首段折角、略偏上。非 relative 时 mxGraph 标签锚在首尾端点弦中点，offset 相对该点计算 */
function computeEdgeLabelModelOffset(route) {
  const d = route.source
  const e = route.target
  const bend = route.points[0] || d
  const mx = (d.x + e.x) / 2
  const my = (d.y + e.y) / 2
  return new mxPoint(bend.x - mx - 6, bend.y - my - 14)
}

/** 联络边样式（含潮流箭头），供成图与策略 B 量测同步共用 */
function buildLiaisonChannelEdgeStyle(fromKv, toKv, pFromMw) {
  const reverseFlow = pFromMw != null && pFromMw < -FLOW_P_EPS
  const showFlowArrow = pFromMw != null && Math.abs(pFromMw) >= FLOW_P_EPS
  const arrowStyle = showFlowArrow
    ? 'endArrow=classic;endFill=1;startArrow=none;'
    : 'endArrow=none;startArrow=none;'
  const lineColor = linkStrokeColor(fromKv, toKv)
  const lineW = linkStrokeWidthPx(fromKv, toKv)
  const style = `noEdgeStyle=1;edgeStyle=none;rounded=0;orthogonalLoop=0;jettySize=0;strokeColor=${lineColor};strokeWidth=${lineW};${arrowStyle}fontSize=11;fontColor=#334155;movable=1;html=1;align=center;verticalLabelPosition=middle;verticalAlign=middle;spacingTop=4;flag=svgLiaisonLine;`
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

function scheduleLiaisonFlowMotionArrows(graph) {
  if (!graph) return
  ensureLiaisonFlowMotionViewListeners(graph)
  const run = () => applyLiaisonFlowMotionArrows(graph)
  if (typeof window !== 'undefined') {
    window.requestAnimationFrame(run)
    window.setTimeout(run, 0)
    window.setTimeout(run, 100)
    window.setTimeout(run, 400)
  } else {
    run()
  }
}

export default class SvgLiaisonDrawioParser {
  constructor(data, options = {}) {
    this.data = data || {}
    this.options = {
      showLabels: options.showLabels !== false,
      /** 有潮流（|p_from_mw|≥eps）的边：沿线运动箭头（SVG animateMotion），默认开启 */
      flowMotionAnimation: options.flowMotionAnimation !== false && options.flowDashAnimation !== false,
      /** 运动箭头沿折线跑一圈的时长（秒），默认 2.5，限制在 [0.3, 120] */
      flowMotionDurationSec: clampFlowMotionDurationSec(
        options.flowMotionDurationSec != null ? options.flowMotionDurationSec : LIAISON_FLOW_MOTION_DUR_DEFAULT_SEC
      ),
    }
    this.graph = null
    /** 为 true 时 App 不自动 parseSvg，由页面加载已保存图形或手动首次成图 */
    this.skipInitialParseSvg = false
  }

  setGraph(graph) {
    this.graph = graph
    this._ensureLiaisonGraphUi(graph)
    this._installLiaisonResizeGuard(graph)
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
      .map((item) => ({
        id: item.station_id,
        name: shortStationName(item.station_name),
        kv: normalizeKV(item.vn_kv),
        lon: Number(item.lon || 0),
        lat: Number(item.lat || 0),
        trafoRows: parseTrafoDisplayListFromRaw(item),
      }))
      .filter((item) => item.id && item.kv >= 35)

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

    stations.forEach((s) => {
      if (isVirtualT10Station(s.name)) {
        s.w = 60
        s.h = 60
        s.isVirtual = true
      } else {
        const baseW = s.kv >= 220 ? 120 : s.kv >= 110 ? 100 : 80
        const baseH = s.kv >= 220 ? 60 : s.kv >= 110 ? 50 : 40
        s.w = baseW + trafoExtraWidthPx(s.trafoRows, baseW)
        s.h = baseH + trafoExtraHeightPx(s.trafoRows)
        s.isVirtual = false
      }
    })
    computeTopologyLayout(stations, channels)

    const sidePortTotals = buildSidePortTotals(stationById, channels)
    const sidePortRankByKey = buildSidePortRankByRemotePrimary(stationById, channels)

    const stationsCell = new Map()
    const pairLaneCounter = new Map()
    const edgeCells = []
    const switchCells = []
    const junctionCells = []
    const pqMetricCells = []
    const edgeSwitchPairs = []
    const cells = graph.getChildCells(parent, true, true)

    model.beginUpdate()
    try {
      if (cells.length > 0) {
        graph.removeCells(cells, true)
      }

      this._ensureLiaisonGraphUi(graph)

      stations.forEach((s) => {
        const doc_station_index = rawStations.findIndex((r) => r.station_id === s.id)
        const isVirt = Boolean(s.isVirtual)
        const { html: label, topAlign } = buildStationVertexLabelHtml(s, this.options.showLabels)
        const trafoLabel = Boolean(!isVirt && s.trafoRows?.length)
        const cell = graph.insertVertex(
          parent,
          `station:${s.id}`,
          label,
          s.x,
          s.y,
          s.w,
          s.h,
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

      channelEntries.forEach(({ channel, docChannelIndex }, idx) => {
        const from = stationById.get(channel.from_station)
        const to = stationById.get(channel.to_station)
        if (!from || !to) return

        const pairKey = [from.id, to.id].sort().join('__')
        const laneIndex = pairLaneCounter.get(pairKey) || 0
        pairLaneCounter.set(pairKey, laneIndex + 1)

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

        const trunkStagger = channelTrunkStagger(idx)
        let route = buildOrthogonalRoute(from, to, laneIndex, sourceOffset, targetOffset, trunkStagger)
        route = nudgeRouteAwayFromStations(route, from, to, stations)
        const lineName = (channel.line_data || [])
          .map((line) => line?.name)
          .filter(Boolean)
          .slice(0, 1)
          .join('')
        const pFromMw = pickChannelPFromMw(channel)
        const qFromMvar = pickChannelQFromMvar(channel)
        const edgeLabel =
          this.options.showLabels && lineName
            ? `<div style="font-size:11px;line-height:1.2;color:#334155;">${escapeHtmlLabel(lineName)}</div>`
            : ''
        const lineColor = linkStrokeColor(from.kv, to.kv)
        const lineW = linkStrokeWidthPx(from.kv, to.kv)
        const reverseFlow = pFromMw != null && pFromMw < -FLOW_P_EPS

        const showFlowArrow = pFromMw != null && Math.abs(pFromMw) >= FLOW_P_EPS
        const arrowStyle = showFlowArrow
          ? 'endArrow=classic;endFill=1;startArrow=none;'
          : 'endArrow=none;startArrow=none;'
        const style = `noEdgeStyle=1;edgeStyle=none;rounded=0;orthogonalLoop=0;jettySize=0;strokeColor=${lineColor};strokeWidth=${lineW};${arrowStyle}fontSize=11;fontColor=#334155;movable=0;html=1;align=left;verticalLabelPosition=top;verticalAlign=bottom;spacingTop=2;flag=svgLiaisonLine;`
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
        jFrom.entityType = 'junction'
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
        jTo.entityType = 'junction'
        junctionCells.push(jFrom, jTo)

        const edgeSource = reverseFlow ? jTo : jFrom
        const edgeTarget = reverseFlow ? jFrom : jTo
        const lineEntityInfo = {
          type: 'line',
          doc_channel_index: docChannelIndex,
          channel_name: channel.channel_name,
          from_station: channel.from_station,
          to_station: channel.to_station,
          from_station_name: from.name,
          to_station_name: to.name,
          link_color: lineColor,
          link_width_px: lineW,
          from_kv: from.kv,
          to_kv: to.kv,
          min_vn_kv: channel.min_vn_kv,
          max_vn_kv: channel.max_vn_kv,
          p_from_mw: pFromMw,
          q_from_mvar: qFromMvar,
          line_data: channel.line_data || [],
          switch_data: channel.switch_data || [],
          raw: channel,
        }
        const edge = graph.insertEdge(parent, `liaison:${docChannelIndex}`, edgeLabel, edgeSource, edgeTarget, style)
        edge.entityType = 'line'
        edge.entityInfo = lineEntityInfo

        const pqBlock = computeLongestSegmentPQBlockPosition(route)
        if (pqBlock) {
          const pStr = escapeHtmlLabel(formatMwMvarNumber(pFromMw))
          const qStr = escapeHtmlLabel(formatMwMvarNumber(qFromMvar))
          const pqHtml = `<div style="font-size:10pt;line-height:1.25;text-align:center;color:#334155;">${pStr}<br/>${qStr}</div>`
          const pqLbl = graph.insertVertex(
            parent,
            `liaison-pq:${docChannelIndex}`,
            pqHtml,
            pqBlock.x,
            pqBlock.y,
            pqBlock.w,
            pqBlock.h,
            PQ_METRIC_STYLE
          )
          pqLbl.entityType = 'line'
          pqLbl.entityInfo = lineEntityInfo
          pqMetricCells.push(pqLbl)
        }

        const geometry = edge.geometry ? edge.geometry.clone() : new mxGeometry()
        const reversedPts =
          reverseFlow && route.points.length >= 2
            ? [route.points[1], route.points[0]].map((p) => new mxPoint(p.x, p.y))
            : route.points.map((p) => new mxPoint(p.x, p.y))
        geometry.points = reversedPts
        geometry.relative = false
        geometry.offset = computeEdgeLabelModelOffset(route)
        edge.geometry = geometry
        edgeCells.push(edge)

        const closedFill = switchClosedFill(from.kv, to.kv)
        const switchSpecs = buildChannelSwitchSpecs(channel)
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
          sw.entityType = 'switch'
          sw.entityInfo = {
            type: 'switch',
            doc_channel_index: docChannelIndex,
            switch_doc_index,
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
          switchCells.push(sw)
          edgeSwitchPairs.push({ edge, sw, switchLogicalEnd: spec.end, channelRoute: route, reverseFlow })
        })
      })
    } finally {
      model.endUpdate()
    }

    if (junctionCells.length > 0) graph.orderCells(true, junctionCells)
    if (edgeCells.length > 0) graph.orderCells(true, edgeCells)
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

    if (this.options.flowMotionAnimation) {
      graph._liaisonFlowMotionDurationSec = this.options.flowMotionDurationSec
      scheduleLiaisonFlowMotionArrows(graph)
    }
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
        const docChannelIndex = this._docIndexForGraphSuffix(chMatch[1])
        if (docChannelIndex == null) continue
        const channel = rawChannels[docChannelIndex]
        if (!channel) continue
        const from = rawStationById.get(channel.from_station)
        const to = rawStationById.get(channel.to_station)
        const fromKv = normalizeKV(from?.vn_kv)
        const toKv = normalizeKV(to?.vn_kv)
        const lineColor = linkStrokeColor(fromKv, toKv)
        const lineW = linkStrokeWidthPx(fromKv, toKv)
        const pFromMw = pickChannelPFromMw(channel)
        const qFromMvar = pickChannelQFromMvar(channel)
        const info = {
          type: 'line',
          doc_channel_index: docChannelIndex,
          from_station: channel.from_station,
          to_station: channel.to_station,
          from_station_name: stationNameById.get(channel.from_station),
          to_station_name: stationNameById.get(channel.to_station),
          link_color: lineColor,
          link_width_px: lineW,
          from_kv: fromKv,
          to_kv: toKv,
          min_vn_kv: channel.min_vn_kv,
          max_vn_kv: channel.max_vn_kv,
          p_from_mw: pFromMw,
          q_from_mvar: qFromMvar,
          line_data: channel.line_data || [],
          switch_data: channel.switch_data || [],
          raw: channel,
        }
        cell.entityType = 'line'
        cell.entityInfo = info
        continue
      }

      if (id.startsWith('liaison-j-')) {
        cell.entityType = 'junction'
        const jm = id.match(/^liaison-j-(?:from|to):(.+)$/)
        if (jm) {
          const docChannelIndex = this._docIndexForGraphSuffix(jm[1])
          if (docChannelIndex == null) continue
          const channel = rawChannels[docChannelIndex]
          if (channel) {
            const from = rawStationById.get(channel.from_station)
            const to = rawStationById.get(channel.to_station)
            cell.entityInfo = {
              type: 'line',
              doc_channel_index: docChannelIndex,
              from_station: channel.from_station,
              to_station: channel.to_station,
              line_data: channel.line_data || [],
              raw: channel,
              from_kv: normalizeKV(from?.vn_kv),
              to_kv: normalizeKV(to?.vn_kv),
            }
          }
        }
        continue
      }

      if (id.startsWith('liaison-pq:')) {
        const docChannelIndex = this._docIndexForGraphSuffix(id.slice('liaison-pq:'.length))
        if (docChannelIndex == null) continue
        const channel = rawChannels[docChannelIndex]
        if (channel) {
          cell.entityType = 'line'
          cell.entityInfo = { type: 'line', doc_channel_index: docChannelIndex, raw: channel }
        }
        continue
      }

      const swMatch = id.match(/^sw:(.+):(from|to)$/)
      if (swMatch) {
        const docChannelIndex = this._docIndexForGraphSuffix(swMatch[1])
        if (docChannelIndex == null) continue
        const end = swMatch[2]
        const channel = rawChannels[docChannelIndex]
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
        const pFromMw = pickChannelPFromMw(channel)
        cell.entityType = 'switch'
        cell.entityInfo = {
          type: 'switch',
          doc_channel_index: docChannelIndex,
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
          q_from_mvar: pickChannelQFromMvar(channel),
          closed: item ? item.closed !== false : pickSwitchStateFallbackFromLines(channel),
          switch_data: sd,
          raw: channel,
        }
      }
    }
  }

  _buildChannelRouteContext() {
    const stations = this._buildStationsFromGraph()
    const stationById = new Map(stations.map((s) => [s.id, s]))
    const rawChannels = this.data?.data?.channel_data || []
    const channelEntries = []
    for (let docChannelIndex = 0; docChannelIndex < rawChannels.length; docChannelIndex++) {
      const ch = rawChannels[docChannelIndex]
      const from = stationById.get(ch.from_station)
      const to = stationById.get(ch.to_station)
      if (from && to && Number(ch.min_vn_kv || 0) >= 35) {
        channelEntries.push({ channel: ch, docChannelIndex })
      }
    }
    const channels = channelEntries.map((e) => e.channel)
    const sidePortTotals = buildSidePortTotals(stationById, channels)
    const sidePortRankByKey = buildSidePortRankByRemotePrimary(stationById, channels)
    const drawIdxByDoc = new Map()
    const laneByDoc = new Map()
    const pairLaneCounter = new Map()
    channelEntries.forEach(({ channel, docChannelIndex }, idx) => {
      drawIdxByDoc.set(docChannelIndex, idx)
      const from = stationById.get(channel.from_station)
      const to = stationById.get(channel.to_station)
      const pairKey = [from.id, to.id].sort().join('__')
      const lane = pairLaneCounter.get(pairKey) || 0
      pairLaneCounter.set(pairKey, lane + 1)
      laneByDoc.set(docChannelIndex, lane)
    })
    return {
      stations,
      stationById,
      channelEntries,
      sidePortTotals,
      sidePortRankByKey,
      drawIdxByDoc,
      laneByDoc,
    }
  }

  _computeChannelRoute(docChannelIndex, ctx) {
    const channel = this.data?.data?.channel_data?.[docChannelIndex]
    if (!channel || !ctx) return null
    const from = ctx.stationById.get(channel.from_station)
    const to = ctx.stationById.get(channel.to_station)
    if (!from || !to) return null
    const idx = ctx.drawIdxByDoc.get(docChannelIndex) ?? 0
    const laneIndex = ctx.laneByDoc.get(docChannelIndex) ?? 0
    const sides = pickSidesFacingPeer(
      { x: from.x + from.w / 2, y: from.y + from.h / 2 },
      { x: to.x + to.w / 2, y: to.y + to.h / 2 }
    )
    const sourcePortKey = `${from.id}:${sides.from}`
    const targetPortKey = `${to.id}:${sides.to}`
    const sourceTotal = ctx.sidePortTotals.get(sourcePortKey) || 1
    const targetTotal = ctx.sidePortTotals.get(targetPortKey) || 1
    const sourceRank = ctx.sidePortRankByKey.get(`${idx}@@${sourcePortKey}`) ?? 0
    const targetRank = ctx.sidePortRankByKey.get(`${idx}@@${targetPortKey}`) ?? 0
    const sourceOffset = portOffsetDistributedOnSide(from, sides.from, sourceRank, sourceTotal)
    const targetOffset = portOffsetDistributedOnSide(to, sides.to, targetRank, targetTotal)
    const trunkStagger = channelTrunkStagger(idx)
    let route = buildOrthogonalRoute(from, to, laneIndex, sourceOffset, targetOffset, trunkStagger)
    route = nudgeRouteAwayFromStations(route, from, to, ctx.stations)
    return route
  }

  _alignChannelSwitchPairs(edgeSwitchPairs) {
    const graph = this.graph
    const model = graph?.getModel()
    if (!graph || !model || !edgeSwitchPairs?.length) return
    if (graph.view?.invalidate) graph.view.invalidate()
    model.beginUpdate()
    try {
      edgeSwitchPairs.forEach(({ edge, sw, switchLogicalEnd, channelRoute, reverseFlow: rev }) => {
        if (!graph.view.getState(edge)) return
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

  _relayoutChannelAtDocIndex(docChannelIndex, ctx) {
    const graph = this.graph
    const model = graph?.getModel()
    const channel = this.data?.data?.channel_data?.[docChannelIndex]
    if (!graph || !model || !channel) return

    const route = this._computeChannelRoute(docChannelIndex, ctx)
    if (!route) return

    const bundle = this._resolveChannelGraphCells(docChannelIndex)
    if (!bundle?.jFrom || !bundle?.jTo || !bundle?.edge) return
    const { suffix, jFrom, jTo, edge } = bundle

    const jw = 6
    const jh = 6
    const pFromMw = pickChannelPFromMw(channel)
    const reverseFlow = pFromMw != null && pFromMw < -FLOW_P_EPS
    const reversedPts =
      reverseFlow && route.points.length >= 2
        ? [route.points[1], route.points[0]].map((p) => new mxPoint(p.x, p.y))
        : route.points.map((p) => new mxPoint(p.x, p.y))

    const switchSpecs = buildChannelSwitchSpecs(channel)
    const from = ctx.stationById.get(channel.from_station)
    const to = ctx.stationById.get(channel.to_station)
    if (!from || !to) return
    const lineColor = linkStrokeColor(from.kv, to.kv)
    const lineW = linkStrokeWidthPx(from.kv, to.kv)
    const closedFill = switchClosedFill(from.kv, to.kv)
    const qFromMvar = pickChannelQFromMvar(channel)
    const neededEnds = new Set(switchSpecs.map((s) => s.end))
    const parent = graph.getDefaultParent()

    ;['from', 'to'].forEach((end) => {
      if (neededEnds.has(end)) return
      const orphan = model.getCell(`sw:${suffix}:${end}`)
      if (orphan) graph.removeCells([orphan], true)
    })

    const edgeSwitchPairs = []
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
      let sw = model.getCell(`sw:${suffix}:${spec.end}`)
      if (!sw) {
        sw = graph.insertVertex(
          parent,
          `sw:${suffix}:${spec.end}`,
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
      this._bindSwitchEntityInfo(sw, spec, docChannelIndex, channel, from, to, lineColor, lineW, pFromMw, qFromMvar)
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
        edgeGeo.offset = computeEdgeLabelModelOffset(route)
        edgeGeo.sourcePoint = null
        edgeGeo.targetPoint = null
        model.setGeometry(edge, edgeGeo)
      }
      const pqLbl = model.getCell(`liaison-pq:${suffix}`)
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
      }
      switchSpecs.forEach((spec) => {
        const sw = model.getCell(`sw:${suffix}:${spec.end}`)
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
    if (graph.view) {
      graph.view.invalidate(jFrom, false, false)
      graph.view.invalidate(jTo, false, false)
      graph.view.invalidate(edge, false, false)
    }
    if (String(suffix) !== String(docChannelIndex)) {
      this._renameChannelCellSuffix(suffix, String(docChannelIndex))
      this.rebindEntityInfo()
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
    affected.forEach((docChannelIndex) => {
      this._relayoutChannelAtDocIndex(docChannelIndex, ctx)
    })
    if (graph.view?.validate) graph.view.validate()
    if (this.options.flowMotionAnimation) {
      scheduleLiaisonFlowMotionArrows(graph)
    }
  }

  /** 从 CELLS_MOVED 事件中的图元解析被拖动的站 id */
  _stationIdsFromMovedCells(cells) {
    const graph = this.graph
    const model = graph?.getModel()
    if (!model || !cells?.length) return new Set()
    const stationIds = new Set()
    for (let i = 0; i < cells.length; i++) {
      let cell = cells[i]
      while (cell) {
        const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
        if (id.startsWith('station:')) {
          stationIds.add(id.slice('station:'.length))
          break
        }
        const ei = cell.entityInfo
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

  /** 允许拖动站、开关、线路及折点；结点仍固定 */
  enableManualEdit() {
    const graph = this.graph
    if (!graph) return
    this._ensureLiaisonGraphUi(graph)
    graph.setCellsMovable(true)
    graph.setCellsBendable(true)
    const parent = graph.getDefaultParent()
    const cells = graph.getChildCells(parent, true, true) || []
    const model = graph.getModel()
    model.beginUpdate()
    try {
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i]
        const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
        if (id.startsWith('liaison-j-') || id.startsWith('liaison-pq:') || id.startsWith('liaison:')) {
          graph.setCellStyles('movable', '0', [cell])
          graph.setCellStyles('bendable', '0', [cell])
          graph.setCellStyles('resizable', '0', [cell])
          graph.setCellStyles('rotatable', '0', [cell])
          continue
        }
        if (id.startsWith('station:')) {
          graph.setCellStyles('movable', '1', [cell])
          graph.setCellStyles('resizable', '0', [cell])
          graph.setCellStyles('rotatable', '0', [cell])
          continue
        }
        graph.setCellStyles('movable', '1', [cell])
        graph.setCellStyles('resizable', '0', [cell])
        graph.setCellStyles('rotatable', '0', [cell])
      }
    } finally {
      model.endUpdate()
    }
    this._installStationMoveListener()
    if (graph.view?.invalidate) graph.view.invalidate()
  }

  _stationCellById(stationId) {
    return this.graph?.getModel?.()?.getCell?.(`station:${stationId}`) || null
  }

  _collectChannelGraphCellsBySuffix(suffix) {
    const graph = this.graph
    if (!graph || suffix == null || suffix === '') return []
    const model = graph.getModel()
    const s = String(suffix)
    const ids = [
      `liaison:${s}`,
      `liaison-j-from:${s}`,
      `liaison-j-to:${s}`,
      `liaison-pq:${s}`,
      `sw:${s}:from`,
      `sw:${s}:to`,
    ]
    const out = []
    for (let i = 0; i < ids.length; i++) {
      const c = model.getCell(ids[i])
      if (c) out.push(c)
    }
    return out
  }

  _collectChannelGraphCells(docChannelIndex) {
    return this._collectChannelGraphCellsBySuffix(String(docChannelIndex))
  }

  /** 按文档通道解析画布后缀并删除该通道全部图元（含开关，避免删线后残留导致无法重插） */
  _removeChannelGraphCellsResolved(docChannelIndex) {
    const graph = this.graph
    const channel = this.data?.data?.channel_data?.[docChannelIndex]
    if (!graph || !channel) return
    const suffixes = new Set([String(docChannelIndex)])
    const matched = this._findGraphSuffixForDocChannel(channel, new Set())
    if (matched) suffixes.add(String(matched))
    suffixes.forEach((s) => {
      const cells = this._collectChannelGraphCellsBySuffix(s)
      if (cells.length) graph.removeCells(cells, true)
    })
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

  _bindSwitchEntityInfo(sw, spec, docChannelIndex, channel, from, to, lineColor, lineW, pFromMw, qFromMvar) {
    sw.entityType = 'switch'
    sw.entityInfo = {
      type: 'switch',
      doc_channel_index: docChannelIndex,
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
      const labelName = parseLineLabelFromCell(graph, cell)
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

  _channelEndpointDistanceScore(jFrom, jTo, fromStationCell, toStationCell) {
    const model = this.graph?.getModel()
    if (!model || !jFrom || !jTo || !fromStationCell || !toStationCell) return Infinity
    const jf = model.getGeometry(jFrom)
    const jt = model.getGeometry(jTo)
    const fs = model.getGeometry(fromStationCell)
    const ts = model.getGeometry(toStationCell)
    if (!jf || !jt || !fs || !ts) return Infinity
    const jfx = jf.x + jf.width / 2
    const jfy = jf.y + jf.height / 2
    const jtx = jt.x + jt.width / 2
    const jty = jt.y + jt.height / 2
    const d1 = pointDistToRect(jfx, jfy, fs) + pointDistToRect(jtx, jty, ts)
    const d2 = pointDistToRect(jfx, jfy, ts) + pointDistToRect(jtx, jty, fs)
    return Math.min(d1, d2)
  }

  /** 按线路名 + 结点贴近站房几何匹配画布通道（不依赖可能已错的 entityInfo） */
  _findGraphSuffixForDocChannel(channel, usedSuffixes = new Set()) {
    const graph = this.graph
    const model = graph?.getModel()
    if (!graph || !model || !channel) return null

    const fromSt = this._stationCellById(channel.from_station)
    const toSt = this._stationCellById(channel.to_station)
    if (!fromSt || !toSt) return null

    const lineName = primaryLineNameFromChannel(channel)
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

      let score = this._channelEndpointDistanceScore(jFrom, jTo, fromSt, toSt)
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

  _docIndexForGraphSuffix(suffix) {
    const channels = this.data?.data?.channel_data || []
    const s = String(suffix)
    const n = Number(s)
    if (!Number.isNaN(n) && n >= 0 && n < channels.length) {
      if (this._findGraphSuffixForDocChannel(channels[n], new Set()) === s) return n
    }
    for (let i = 0; i < channels.length; i++) {
      if (this._findGraphSuffixForDocChannel(channels[i], new Set()) === s) return i
    }
    return !Number.isNaN(n) && n >= 0 && n < channels.length ? n : null
  }

  /** 从点击的图元解析文档通道下标 */
  resolveDocChannelIndexFromCell(cell) {
    if (!cell || !this.graph) return null
    const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
    let suffix = null
    let m = id.match(/^liaison:(.+)$/)
    if (m) suffix = m[1]
    else {
      m = id.match(/^liaison-j-(?:from|to):(.+)$/)
      if (m) suffix = m[1]
      else {
        m = id.match(/^sw:(.+):(from|to)$/)
        if (m) suffix = m[1]
        else {
          m = id.match(/^liaison-pq:(.+)$/)
          if (m) suffix = m[1]
        }
      }
    }
    if (suffix != null) {
      const docIdx = this._docIndexForGraphSuffix(suffix)
      if (docIdx != null) return docIdx
    }
    const ei = cell.entityInfo?.doc_channel_index
    return ei != null && ei >= 0 ? ei : null
  }

  /** 按文档下标或几何匹配解析通道图元 */
  _resolveChannelGraphCells(docChannelIndex) {
    const graph = this.graph
    const model = graph?.getModel()
    const channel = this.data?.data?.channel_data?.[docChannelIndex]
    if (!graph || !model || !channel) return null

    const directSuffix = String(docChannelIndex)
    const directEdge = model.getCell(`liaison:${directSuffix}`)
    if (directEdge) {
      return {
        suffix: directSuffix,
        edge: directEdge,
        jFrom: model.getCell(`liaison-j-from:${directSuffix}`),
        jTo: model.getCell(`liaison-j-to:${directSuffix}`),
      }
    }

    const suffix = this._findGraphSuffixForDocChannel(channel, new Set()) || directSuffix
    const edge = model.getCell(`liaison:${suffix}`)
    if (!edge) return null

    return {
      suffix,
      edge,
      jFrom: model.getCell(`liaison-j-from:${suffix}`),
      jTo: model.getCell(`liaison-j-to:${suffix}`),
    }
  }

  /** 从画布几何读取已放置站点（用于增量画线，不跑整图布局） */
  _buildStationsFromGraph() {
    const graph = this.graph
    const payload = this.data?.data || {}
    const rawStations = Array.isArray(payload.station_data) ? payload.station_data : []
    const parent = graph.getDefaultParent()
    const cells = graph.getChildCells(parent, true, true) || []
    const byId = new Map()

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      const id = typeof cell.getId === 'function' ? String(cell.getId()) : ''
      if (!id.startsWith('station:')) continue
      const sid = id.slice('station:'.length)
      const raw = rawStations.find((r) => r.station_id === sid)
      if (!raw) continue
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
      const name = shortStationName(raw.station_name)
      const kv = normalizeKV(raw.vn_kv)
      const isVirt = isVirtualT10Station(name)
      let w = geo.width
      let h = geo.height
      if (!isVirt) {
        const baseW = kv >= 220 ? 120 : kv >= 110 ? 100 : 80
        const baseH = kv >= 220 ? 60 : kv >= 110 ? 50 : 40
        w = baseW + trafoExtraWidthPx(parseTrafoDisplayListFromRaw(raw), baseW)
        h = baseH + trafoExtraHeightPx(parseTrafoDisplayListFromRaw(raw))
      } else {
        w = 100
        h = 50
      }
      byId.set(sid, {
        id: sid,
        name,
        kv,
        lon: Number(raw.lon || 0),
        lat: Number(raw.lat || 0),
        trafoRows: parseTrafoDisplayListFromRaw(raw),
        x,
        y,
        w: geo.width > 0 ? geo.width : w,
        h: geo.height > 0 ? geo.height : h,
        isVirtual: isVirt,
      })
    }

    const placed = []
    rawStations.forEach((raw) => {
      const s = byId.get(raw.station_id)
      if (s && s.kv >= 35) placed.push(s)
    })
    return placed
  }

  _placeNewStationRect(graph, kv, trafoRows, isVirt) {
    const bounds = graph.getGraphBounds()
    const baseW = isVirt ? 100 : kv >= 220 ? 120 : kv >= 110 ? 100 : 80
    const baseH = isVirt ? 50 : kv >= 220 ? 60 : kv >= 110 ? 50 : 40
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
    if (this._stationCellById(raw.station_id)) return this._stationCellById(raw.station_id)

    const kv = normalizeKV(raw.vn_kv)
    if (kv < 35) return null
    const name = shortStationName(raw.station_name)
    const isVirt = isVirtualT10Station(name)
    const trafoRows = parseTrafoDisplayListFromRaw(raw)
    const { x, y, w, h } = this._placeNewStationRect(graph, kv, trafoRows, isVirt)
    const parent = graph.getDefaultParent()
    const { html: label, topAlign } = buildStationVertexLabelHtml(
      { name, kv, trafoRows, isVirtual: isVirt },
      this.options.showLabels
    )
    const trafoLabel = Boolean(!isVirt && trafoRows?.length)
    const cell = graph.insertVertex(
      parent,
      `station:${raw.station_id}`,
      label,
      x,
      y,
      w,
      h,
      isVirt ? virtualT10StationStyle(kv, topAlign) : stationStyleByKV(kv, topAlign, trafoLabel)
    )
    graph.orderCells(false, [cell])
    this.rebindEntityInfo()
    this.enableManualEdit()
    return cell
  }

  removeStationGraphCells(stationId) {
    const graph = this.graph
    if (!graph || !stationId) return
    const payload = this.data?.data || {}
    const channels = Array.isArray(payload.channel_data) ? payload.channel_data : []
    const toRemove = []
    const st = this._stationCellById(stationId)
    if (st) toRemove.push(st)
    channels.forEach((ch, idx) => {
      if (ch.from_station === stationId || ch.to_station === stationId) {
        toRemove.push(...this._collectChannelGraphCells(idx))
      }
    })
    if (toRemove.length) graph.removeCells(toRemove, true)
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
    const trafoRows = parseTrafoDisplayListFromRaw(raw)
    const { html: label, topAlign } = buildStationVertexLabelHtml(
      { name, kv, trafoRows, isVirtual: isVirt },
      this.options.showLabels
    )
    const trafoLabel = Boolean(!isVirt && trafoRows?.length)
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
    if (this._resolveChannelGraphCells(docChannelIndex)) return

    const stations = this._buildStationsFromGraph()
    const stationById = new Map(stations.map((s) => [s.id, s]))
    const from = stationById.get(channel.from_station)
    const to = stationById.get(channel.to_station)
    const minKV = Number(channel.min_vn_kv || 0)
    if (!from || !to || minKV < 35) return

    const rawStations = this.data?.data?.station_data || []
    const rawStationById = new Map(rawStations.map((item) => [item.station_id, item]))
    const stationsCell = new Map()
    stations.forEach((s) => {
      const c = this._stationCellById(s.id)
      if (c) stationsCell.set(s.id, c)
    })

    const allChannels = []
    for (let i = 0; i < (this.data?.data?.channel_data || []).length; i++) {
      const ch = this.data.data.channel_data[i]
      const f = stationById.get(ch.from_station)
      const t = stationById.get(ch.to_station)
      if (f && t && Number(ch.min_vn_kv || 0) >= 35) allChannels.push(ch)
    }
    const sidePortTotals = buildSidePortTotals(stationById, allChannels)
    const sidePortRankByKey = buildSidePortRankByRemotePrimary(stationById, allChannels)

    let drawIdx = 0
    for (let i = 0; i <= docChannelIndex; i++) {
      const ch = this.data.data.channel_data[i]
      if (stationById.get(ch.from_station) && stationById.get(ch.to_station)) drawIdx++
    }
    drawIdx = Math.max(0, drawIdx - 1)

    this._drawOneChannel({
      channel,
      docChannelIndex,
      idx: drawIdx,
      from,
      to,
      stations,
      stationById,
      stationsCell,
      rawStationById,
      sidePortTotals,
      sidePortRankByKey,
    })

    this.rebindEntityInfo()
    this.enableManualEdit()
    if (this.options.flowMotionAnimation) {
      graph._liaisonFlowMotionDurationSec = this.options.flowMotionDurationSec
      scheduleLiaisonFlowMotionArrows(graph)
    }
  }

  removeChannelGraphCells(docChannelIndex) {
    const graph = this.graph
    if (!graph || docChannelIndex == null) return
    const cells = this._collectChannelGraphCells(docChannelIndex)
    if (cells.length) graph.removeCells(cells, true)
    if (this.options.flowMotionAnimation) {
      scheduleLiaisonFlowMotionArrows(graph)
    }
  }

  _renameChannelCellSuffix(oldSuffix, newSuffix) {
    const os = String(oldSuffix)
    const ns = String(newSuffix)
    if (os === ns) return
    const model = this.graph?.getModel()
    if (!model?.setId) return
    const pairs = [
      [`liaison:${os}`, `liaison:${ns}`],
      [`liaison-j-from:${os}`, `liaison-j-from:${ns}`],
      [`liaison-j-to:${os}`, `liaison-j-to:${ns}`],
      [`liaison-pq:${os}`, `liaison-pq:${ns}`],
      [`sw:${os}:from`, `sw:${ns}:from`],
      [`sw:${os}:to`, `sw:${ns}:to`],
    ]
    model.beginUpdate()
    try {
      for (let i = 0; i < pairs.length; i++) {
        const [oldId, newId] = pairs[i]
        const cell = model.getCell(oldId)
        if (cell) model.setId(cell, newId)
      }
    } finally {
      model.endUpdate()
    }
  }

  _renameChannelCellId(oldIdx, newIdx) {
    this._renameChannelCellSuffix(String(oldIdx), String(newIdx))
  }

  /** 删除单条通道后，将 liaison:N 与文档下标重新对齐 */
  reindexChannelCellIdsAfterDelete() {
    this.resyncChannelCellIdsToDoc()
  }

  /**
   * 批量删通道/删站后：按有向起终点 + 线路名匹配画布通道，重命名 id 后缀并清除孤儿图元
   */
  resyncChannelCellIdsToDoc() {
    const graph = this.graph
    const model = graph?.getModel()
    const channels = this.data?.data?.channel_data || []
    if (!graph || !model) {
      this.rebindEntityInfo()
      return
    }

    const graphEdges = this._enumerateGraphChannelEdges()
    const usedSuffixes = new Set()
    const mappings = []

    for (let docIdx = 0; docIdx < channels.length; docIdx++) {
      const ch = channels[docIdx]
      const pickSuffix = this._findGraphSuffixForDocChannel(ch, usedSuffixes)
      if (!pickSuffix) continue
      usedSuffixes.add(pickSuffix)
      const newSuffix = String(docIdx)
      if (pickSuffix !== newSuffix) {
        mappings.push({ oldSuffix: pickSuffix, newSuffix })
      }
    }

    const orphans = graphEdges.filter((g) => !usedSuffixes.has(g.suffix))
    if (orphans.length) {
      const toRemove = []
      for (let i = 0; i < orphans.length; i++) {
        toRemove.push(...this._collectChannelGraphCellsBySuffix(orphans[i].suffix))
      }
      if (toRemove.length) graph.removeCells(toRemove, true)
    }

    for (let i = 0; i < mappings.length; i++) {
      const { oldSuffix } = mappings[i]
      this._renameChannelCellSuffix(oldSuffix, `__t${oldSuffix}`)
    }
    for (let i = 0; i < mappings.length; i++) {
      const { oldSuffix, newSuffix } = mappings[i]
      this._renameChannelCellSuffix(`__t${oldSuffix}`, newSuffix)
    }

    this.rebindEntityInfo()

    const ctx = this._buildChannelRouteContext()
    for (let i = 0; i < channels.length; i++) {
      this._relayoutChannelAtDocIndex(i, ctx)
    }
    if (this.options.flowMotionAnimation) {
      scheduleLiaisonFlowMotionArrows(graph)
    }
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
      if (this.options.flowMotionAnimation) {
        scheduleLiaisonFlowMotionArrows(graph)
      }
      return
    }
    const ctx = this._buildChannelRouteContext()
    this._relayoutChannelAtDocIndex(docChannelIndex, ctx)
    this.rebindEntityInfo()
    if (this.options.flowMotionAnimation) {
      scheduleLiaisonFlowMotionArrows(graph)
    }
  }

  /** 仅刷新线路名标签（不删线重画） */
  updateChannelLabelOnly(docChannelIndex) {
    const graph = this.graph
    const channel = this.data?.data?.channel_data?.[docChannelIndex]
    if (!graph || !channel) return
    const edge = graph.getModel().getCell(`liaison:${docChannelIndex}`)
    if (!edge) return
    const lineName = (channel.line_data || [])
      .map((line) => line?.name)
      .filter(Boolean)
      .slice(0, 1)
      .join('')
    const edgeLabel =
      this.options.showLabels && lineName
        ? `<div style="font-size:11px;line-height:1.2;color:#334155;">${escapeHtmlLabel(lineName)}</div>`
        : ''
    graph.getModel().setValue(edge, edgeLabel)
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
    applyLiaisonFlowMotionArrows(graph)
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
    const trafoRows = parseTrafoDisplayListFromRaw(raw)
    const { html: label, topAlign } = buildStationVertexLabelHtml(
      { name, kv, trafoRows, isVirtual: isVirt },
      this.options.showLabels
    )
    const trafoLabel = Boolean(!isVirt && trafoRows?.length)
    graph.getModel().setValue(cell, label)
    graph.setCellStyle(
      isVirt ? virtualT10StationStyle(kv, topAlign) : stationStyleByKV(kv, topAlign, trafoLabel),
      [cell]
    )
  }

  _syncChannelMeasurementsAtDocIndex(docChannelIndex) {
    const graph = this.graph
    const model = graph?.getModel()
    const channel = this.data?.data?.channel_data?.[docChannelIndex]
    if (!graph || !model || !channel) return

    const bundle = this._resolveChannelGraphCells(docChannelIndex)
    if (!bundle?.edge || !bundle.jFrom || !bundle.jTo) return

    const rawStations = this.data?.data?.station_data || []
    const fromRaw = rawStations.find((s) => s.station_id === channel.from_station)
    const toRaw = rawStations.find((s) => s.station_id === channel.to_station)
    const fromKv = normalizeKV(fromRaw?.vn_kv)
    const toKv = normalizeKV(toRaw?.vn_kv)
    const pFromMw = pickChannelPFromMw(channel)
    const qFromMvar = pickChannelQFromMvar(channel)
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
          const route = routeFromChannelBundle(graph, bundle, bundle.edge)
          if (route) edgeGeo.offset = computeEdgeLabelModelOffset(route)
          model.setGeometry(bundle.edge, edgeGeo)
        }
      }
      graph.setCellStyle(style, [bundle.edge])
    } finally {
      model.endUpdate()
    }

    const pqLbl = model.getCell(`liaison-pq:${bundle.suffix}`)
    if (pqLbl) {
      const pStr = escapeHtmlLabel(formatMwMvarNumber(pFromMw))
      const qStr = escapeHtmlLabel(formatMwMvarNumber(qFromMvar))
      const pqHtml = `<div style="font-size:10pt;line-height:1.25;text-align:center;color:#334155;">${pStr}<br/>${qStr}</div>`
      model.setValue(pqLbl, pqHtml)
    }

    const switchSpecs = buildChannelSwitchSpecs(channel)
    switchSpecs.forEach((spec) => {
      const sw = model.getCell(`sw:${bundle.suffix}:${spec.end}`)
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

    const lineName = (channel.line_data || [])
      .map((line) => line?.name)
      .filter(Boolean)
      .slice(0, 1)
      .join('')
    const pFromMw = pickChannelPFromMw(channel)
    const qFromMvar = pickChannelQFromMvar(channel)
    const edgeLabel =
      this.options.showLabels && lineName
        ? `<div style="font-size:11px;line-height:1.2;color:#334155;">${escapeHtmlLabel(lineName)}</div>`
        : ''
    const lineColor = linkStrokeColor(from.kv, to.kv)
    const lineW = linkStrokeWidthPx(from.kv, to.kv)
    const reverseFlow = pFromMw != null && pFromMw < -FLOW_P_EPS
    const showFlowArrow = pFromMw != null && Math.abs(pFromMw) >= FLOW_P_EPS
    const arrowStyle = showFlowArrow
      ? 'endArrow=classic;endFill=1;startArrow=none;'
      : 'endArrow=none;startArrow=none;'
    const style = `noEdgeStyle=1;edgeStyle=none;rounded=0;orthogonalLoop=0;jettySize=0;strokeColor=${lineColor};strokeWidth=${lineW};${arrowStyle}fontSize=11;fontColor=#334155;movable=1;html=1;align=center;verticalLabelPosition=middle;verticalAlign=middle;spacingTop=4;flag=svgLiaisonLine;`

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
    const edge = graph.insertEdge(parent, `liaison:${docChannelIndex}`, edgeLabel, edgeSource, edgeTarget, style)

    const pqBlock = computeLongestSegmentPQBlockPosition(route)
    const pqMetricCells = []
    if (pqBlock) {
      const pStr = escapeHtmlLabel(formatMwMvarNumber(pFromMw))
      const qStr = escapeHtmlLabel(formatMwMvarNumber(qFromMvar))
      const pqHtml = `<div style="font-size:10pt;line-height:1.25;text-align:center;color:#334155;">${pStr}<br/>${qStr}</div>`
      const pqLbl = graph.insertVertex(
        parent,
        `liaison-pq:${docChannelIndex}`,
        pqHtml,
        pqBlock.x,
        pqBlock.y,
        pqBlock.w,
        pqBlock.h,
        PQ_METRIC_STYLE
      )
      pqMetricCells.push(pqLbl)
    }

    const geometry = edge.geometry ? edge.geometry.clone() : new mxGeometry()
    const reversedPts =
      reverseFlow && route.points.length >= 2
        ? [route.points[1], route.points[0]].map((p) => new mxPoint(p.x, p.y))
        : route.points.map((p) => new mxPoint(p.x, p.y))
    geometry.points = reversedPts
    geometry.relative = false
    geometry.offset = computeEdgeLabelModelOffset(route, reverseFlow)
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
