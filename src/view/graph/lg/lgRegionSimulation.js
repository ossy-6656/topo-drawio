/**
 * 区域系统图仿真菜单：潮流数据上图、越限设备高亮（/in-site-svg 仅潮流上图，母线/主变专用标签）
 * /in-site-svg 固定越限演示：#2主变、府馨线红色闪烁并展示负载率
 * 潮流匹配：SVG 图元 metadata 中 cge:PSR_Ref.GlobeID ↔ JSON 的 busid/lineid/trafoid
 * /graphLg 潮流数据上图：使用 public/府城站配网潮流数据.json，母线/线路/机组匹配 data.res_sub_system 的 res_bus / res_line / res_gen
 * /graphLg 越限设备高亮：匹配 data.res_sub_system 下的 res_bus / res_line / res_trafo 等
 */
import { ElMessage } from 'element-plus'
import DeviceCategoryUtil from '@/plugins/tmzx/graph/DeviceCategoryUtil.js'
import TextUtil from '@/plugins/tmzx/graph/TextUtil.js'
import {
    isLgLoadShapeOrPsr,
    isLgSwitchShapeOrPsr,
    lgSwitchStatusLabel,
} from '@/view/graph/lg/Constants.js'
import { getLgFlowOverlayFontColor } from '@/view/graph/lg/lgCanvasTheme.js'
import {
    LG_IN_SITE_FUXIN_FEEDER_DATASET,
    LG_IN_SITE_FUXIN_FEEDER_LABEL,
    markLgInSiteFeederCell,
    refreshLgInSiteFeederCellIndex,
} from '@/view/graph/lg/lgInSiteFeederClick.js'

/** /graphLg 默认潮流数据（配网子系统 res_sub_system） */
const DEFAULT_FLOW_DATA_URL = '/府城站配网潮流数据.json'
/** /in-site-svg 站内图仍使用含顶层 res_bus/res_trafo 的完整潮流结果 */
const IN_SITE_DEFAULT_FLOW_DATA_URL = '/新乡潮流计算结果（府城站）.json'
const OVERLAY_PREFIX = 'lg-flow-overlay-'
const WARN_OVERLAY_PREFIX = 'lg-warn-overlay-'
const OVERLAY_FONT_SIZE = 9
const WARN_OVERLAY_FONT_SIZE = 12
const OVERLAY_LINE_HEIGHT = 1.8
const OVERLAY_GAP = 2
/** /in-site-svg 主变潮流标签相对图标的偏移（左、下，贴近图标左下角） */
const IN_SITE_TRAFO_FLOW_LABEL_LEFT_OFFSET = 50
const IN_SITE_TRAFO_FLOW_LABEL_DOWN_OFFSET = 50
const LINE_LABEL_GAP = 8
const LINE_LABEL_CLEARANCE = 6
/** 潮流上图：线路数据标签与线路的法向间距（略小于 LINE_LABEL_CLEARANCE，避免偏太远） */
const FLOW_LINE_LABEL_CLEARANCE = 2
const FLOW_LINE_LABEL_STROKE_PAD = 1
const FLOW_P_EPS = 1e-9
const FLOW_MOTION_DUR_SEC = 5.5
const FLOW_MOTION_ARROW_COLOR = '#00e5ff'
const SVG_NS = 'http://www.w3.org/2000/svg'
const LG_FLOW_MOTION_ATTR = 'data-lg-flow-motion'
const WARN_HIGHLIGHT_STROKE = '#ff0000'
const HIGHLIGHT_STROKE_WIDTH = 4
const FEEDER_LINE_BLINK_STROKE_WIDTH = 1.5
const BLINK_INTERVAL_MS = 600
const SHAPE_TINT_SELECTOR = 'path,circle,ellipse,line,rect,polygon,polyline,text'

const VM_LOW_LIMIT = 0.95
const VM_HIGH_LIMIT = 1.05
const LOADING_WARN_PERCENT = 80
/** /in-site-svg 固定越限演示设备（JSON 负载率不足时回退为演示值） */
const IN_SITE_FIXED_OVERLIMIT_DEMO = {
    trafo2: 92.5,
    fuxinFeeder: 92.5,
}

const LG_FEEDER_WARN_OVERLAY_ATTR = 'data-lg-feeder-warn'
/** 府城站 G 文件（01124107000002）府馨线 ConnectLine 兜底 id（仅下口 23 板列） */
const IN_SITE_FUXIN_FALLBACK_LINE_IDS = [
    '34007588', '34007589', '34007590', '34007591',
]

let flowDataCache = null
let flowDataUrlCache = ''
const overlayCellIds = new Set()
const warnOverlayCellIds = new Set()
const highlightedCells = new Set()
const savedHighlightStyles = new Map()
/** @type {Map<string, Array<{stroke: string|null, fill: string|null, strokeWidth: string|null}>>} */
const warnShapeColorTemplates = new Map()
/** @type {Set<object>} 府馨线等馈线边：overlay 层红色线段闪烁 */
const feederWarnEdgeCells = new Set()
let overLimitHighlightOn = false
let warnBlinkTimer = null
let warnBlinkGraph = null
let warnBlinkPhaseOn = true
let warnBlinkSyncHandler = null
/** @type {{ graph: object, parser: object, items: Array<{ id: string, label: string, kind: string, trafoCell?: object }> } | null} */
let inSiteWarnOverlayContext = null
let inSiteWarnOverlayRefreshTimer = null
/** @type {{ graph: object, items: Array<{ edge: object, record: object }>, parser: object, indexes: object } | null} */
let lgFlowMotionContext = null
let lgFlowMotionRefreshTimer = null

/** /graphLg、/in-site-svg 显示仿真菜单；/region-system-svg 不显示 */
function isLgSimulationMenuEnabled() {
    return window.__lgSimulationMenuEnabled === true
}

/** /in-site-svg 不显示越限设备高亮 */
function isLgOverLimitHighlightEnabled() {
    return !window.__lgInSiteSvgMode
}

function isLgInSiteSvgMode() {
    return window.__lgInSiteSvgMode === true
}

/** G 文件 voltype → 额定电压 kV（站内母线匹配） */
const IN_SITE_VOLTYPE_KV = { 1005: 230, 1006: 115, 1008: 10, 1010: 10 }

/** /in-site-svg 主变：侧栏变压器 + G 文件 Transformer3(0304) / powertransformer 图元 */
function isLgInSiteMainTransformerDevice(cell, graph, parser) {
    const pm = parser ? getCellPropMap(cell, parser) : null
    const psrType = pm?.['cge:PSR_Ref']?.PSRType
    if (psrType === '0304') return true
    const { shape, psrtype } = getCellShapeInfo(cell, graph)
    if (
        shape === 'potentialtransformer2w' ||
        shape === 'potentialtransformer3w' ||
        shape.indexOf('potentialtransformer2w_') === 0 ||
        shape.indexOf('potentialtransformer3w_') === 0 ||
        shape.indexOf('powertransformer') === 0
    ) {
        return true
    }
    return psrtype === '0304'
}

function getFlowDataUrl() {
    const custom = window.__lgRegionFlowDataUrl
    if (custom != null && String(custom).trim()) {
        return String(custom).trim()
    }
    return isLgInSiteSvgMode() ? IN_SITE_DEFAULT_FLOW_DATA_URL : DEFAULT_FLOW_DATA_URL
}

const SBID_PREFIX = 'sbid000000'

function normalizeId(id) {
    return String(id || '').replace(/-/g, '').toLowerCase()
}

/** 潮流 JSON 的 busid/lineid/trafoid 与 SVG GlobeID 的多种写法 */
function flowIdVariants(rawId) {
    const keys = new Set()
    const n = normalizeId(rawId)
    if (!n) return keys

    keys.add(n)

    if (n.startsWith('sbid')) {
        if (n.startsWith(SBID_PREFIX)) {
            keys.add(n.slice(SBID_PREFIX.length))
        }
        keys.add(n.slice(4))
        return keys
    }

    const colon = n.indexOf(':')
    if (colon >= 0) {
        const tail = n.slice(colon + 1)
        if (tail) {
            keys.add(tail)
            keys.add(SBID_PREFIX + tail)
        }
    }

    keys.add(SBID_PREFIX + n)
    if (n.startsWith('00') && n.length > 2) {
        const body = n.slice(2)
        keys.add(body)
        keys.add(SBID_PREFIX + body)
        if (body.startsWith('0')) {
            const core = body.slice(1)
            keys.add(core)
            keys.add(SBID_PREFIX + core)
        }
    }
    return keys
}

function indexFlowRecord(map, rawId, record) {
    for (const key of flowIdVariants(rawId)) {
        if (!map.has(key)) {
            map.set(key, record)
        }
    }
}

/** 从 PD_类型码_GlobeID 形式的 ObjectID 提取 GlobeID 段 */
function extractGlobeIdFromObjectId(objectId) {
    const m = String(objectId || '').match(/^PD_\d+_(.+)$/i)
    return m ? m[1] : ''
}

function getCellPropMap(cell, parser) {
    if (!cell?.id || !parser?.attrMap) return null
    const id = String(cell.id)
    if (parser.attrMap.has(id)) {
        return parser.attrMap.get(id)
    }
    return null
}

function normalizeName(name) {
    return String(name || '')
        .trim()
        .toLowerCase()
        .replace(/\s/g, '')
        .replace(/[（）()]/g, '')
}

function formatNumber(value, digits = 2) {
    const n = Number(value)
    if (value == null || value === '' || Number.isNaN(n)) {
        return '--'
    }
    return n.toFixed(digits)
}

async function loadFlowData(url) {
    const resolved = url || getFlowDataUrl()
    if (flowDataCache && flowDataUrlCache === resolved) {
        return flowDataCache
    }
    const response = await fetch(resolved)
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
    }
    const text = await response.text()
    if (!text.trim()) {
        throw new Error('潮流数据文件为空')
    }
    let json
    try {
        json = JSON.parse(text)
    } catch (e) {
        throw new Error('潮流数据 JSON 格式无效（文件可能不完整）')
    }
    flowDataCache = json.data || json
    flowDataUrlCache = resolved
    return flowDataCache
}

function buildFlowIndexes(data) {
    const lineById = new Map()
    const lineByName = new Map()
    const busById = new Map()
    const busByName = new Map()
    const busByIndex = new Map()
    const trafoById = new Map()
    const trafoByName = new Map()
    const trafoDisplayByTrafoid = new Map()
    const genById = new Map()
    const genByName = new Map()
    const loadById = new Map()
    const loadByName = new Map()
    const switchById = new Map()
    const switchByName = new Map()
    const recordByGlobeId = new Map()

    const preferTrafoDisplayRecord = (rec) => {
        const n = String(rec?.name || '')
        if (n.endsWith('_高')) return 3
        if (n.endsWith('_中')) return 2
        if (n.endsWith('_低')) return 1
        return 0
    }

    const indexTrafoDisplay = (trafo) => {
        if (!trafo?.trafoid) return
        const tid = String(trafo.trafoid)
        const existing = trafoDisplayByTrafoid.get(tid)
        if (!existing || preferTrafoDisplayRecord(trafo) > preferTrafoDisplayRecord(existing)) {
            trafoDisplayByTrafoid.set(tid, trafo)
        }
    }

    const resolveInSiteStationPrefix = () => {
        if (typeof window !== 'undefined' && window.__lgInSiteStationName) {
            const fromRoute = String(window.__lgInSiteStationName).trim()
            if (fromRoute) return fromRoute
        }
        for (const feeder of data.res_feeder || []) {
            if (!feeder?.station) continue
            const seg = String(feeder.station).split('.').pop()
            if (seg) return seg
        }
        return '府城站'
    }

    const inSiteStationPrefix = resolveInSiteStationPrefix()
    const trafoByStationNum = new Map()
    for (const trafo of data.res_trafo || []) {
        if (!trafo?.name || !String(trafo.name).startsWith(`${inSiteStationPrefix}.`)) continue
        const num = extractInSiteTrafoNum(trafo.name)
        if (num == null) continue
        const key = `${inSiteStationPrefix}:${num}`
        const existing = trafoByStationNum.get(key)
        if (!existing || preferTrafoDisplayRecord(trafo) > preferTrafoDisplayRecord(existing)) {
            trafoByStationNum.set(key, trafo)
        }
        indexTrafoDisplay(trafo)
    }

    const indexGlobe = (rawId, record, type) => {
        for (const key of flowIdVariants(rawId)) {
            if (!recordByGlobeId.has(key)) {
                recordByGlobeId.set(key, { record, type })
            }
        }
    }

    for (const line of data.res_line || []) {
        if (line.lineid) {
            indexFlowRecord(lineById, line.lineid, line)
            indexGlobe(line.lineid, line, 'line')
        }
        if (line.name) lineByName.set(normalizeName(line.name), line)
    }
    for (const bus of data.res_bus || []) {
        if (bus.busid) {
            indexFlowRecord(busById, bus.busid, bus)
            indexGlobe(bus.busid, bus, 'bus')
        }
        if (bus.name) busByName.set(normalizeName(bus.name), bus)
        if (bus.index != null) busByIndex.set(bus.index, bus)
    }
    for (const trafo of data.res_trafo || []) {
        if (trafo.trafoid) {
            indexFlowRecord(trafoById, trafo.trafoid, trafo)
            indexGlobe(trafo.trafoid, trafo, 'trafo')
            if (!String(trafo.name || '').startsWith(`${inSiteStationPrefix}.`)) {
                indexTrafoDisplay(trafo)
            }
        }
        if (trafo.name) trafoByName.set(normalizeName(trafo.name), trafo)
    }
    for (const gen of data.res_gen || []) {
        if (gen.genid) {
            indexFlowRecord(genById, gen.genid, gen)
            indexGlobe(gen.genid, gen, 'gen')
        }
        if (gen.name) genByName.set(normalizeName(gen.name), gen)
    }
    for (const load of data.res_load || []) {
        if (load.loadid) {
            indexFlowRecord(loadById, load.loadid, load)
            indexGlobe(load.loadid, load, 'load')
        }
        if (load.name) loadByName.set(normalizeName(load.name), load)
    }
    for (const sw of data.res_switch || []) {
        const switchId = sw.switchid || sw.breakerid || sw.busid
        if (switchId) {
            indexFlowRecord(switchById, switchId, sw)
            indexGlobe(switchId, sw, 'switch')
        }
        if (sw.name) switchByName.set(normalizeName(sw.name), sw)
    }

    return {
        lineById,
        lineByName,
        busById,
        busByName,
        busByIndex,
        trafoById,
        trafoByName,
        trafoDisplayByTrafoid,
        trafoByStationNum,
        genById,
        genByName,
        loadById,
        loadByName,
        switchById,
        switchByName,
        recordByGlobeId,
        busList: data.res_bus || [],
        trafoList: data.res_trafo || [],
        inSiteStationPrefix,
    }
}

/** /graphLg 潮流上图：母线、线路、机组用 res_sub_system，其余仍用顶层 data */
function buildGraphLgFlowIndexes(data) {
    const sub = data?.res_sub_system
    if (!sub || typeof sub !== 'object') {
        return buildFlowIndexes(data)
    }
    return buildFlowIndexes({
        ...data,
        res_bus: sub.res_bus || [],
        res_line: sub.res_line || [],
        res_gen: sub.res_gen || [],
    })
}

function buildPowerFlowIndexes(data) {
    return isLgInSiteSvgMode() ? buildFlowIndexes(data) : buildGraphLgFlowIndexes(data)
}

/** /graphLg 越限高亮：优先使用 res_sub_system（馈线子系统潮流），无则回退顶层 data */
function buildOverLimitFlowIndexes(data) {
    const sub = data?.res_sub_system
    if (!sub || typeof sub !== 'object') {
        return buildFlowIndexes(data)
    }
    return buildFlowIndexes({
        res_bus: sub.res_bus || [],
        res_line: sub.res_line || [],
        res_trafo: sub.res_trafo || [],
        res_gen: sub.res_gen || [],
        res_load: sub.res_load || [],
        res_switch: sub.res_switch || [],
        res_feeder: sub.res_feeder || [],
    })
}

/** 从图元 metadata 提取 GlobeID（与 JSON 中 busid/lineid/trafoid 对应） */
function getCellGlobeIds(cell, parser) {
    const ids = []
    const seen = new Set()
    const push = (raw) => {
        const n = normalizeId(raw)
        if (!raw || seen.has(n)) return
        seen.add(n)
        ids.push(String(raw))
    }

    const pm = getCellPropMap(cell, parser)
    const psr = pm?.['cge:PSR_Ref']
    if (psr?.GlobeID) push(psr.GlobeID)
    if (psr?.GeoPsrid) push(psr.GeoPsrid)
    if (psr?.keyid) push(psr.keyid)
    if (psr?.rtkeyid) {
        push(psr.rtkeyid)
        const tail = String(psr.rtkeyid).split(':').pop()
        if (tail) push(tail)
    }
    if (cell.keyid) push(cell.keyid)
    if (cell.rtkeyid) {
        push(cell.rtkeyid)
        const tail = String(cell.rtkeyid).split(':').pop()
        if (tail) push(tail)
    }

    const fromObjectId = extractGlobeIdFromObjectId(cell.id)
    if (fromObjectId && (fromObjectId.length > 12 || /^sbid/i.test(fromObjectId))) {
        push(fromObjectId)
    }

    return ids
}

/** 站房/配电室图元（zf06 等），越限与潮流匹配 res_sub_system.res_load */
function isDistributionSubstationCell(cell, graph) {
    const { shape, psrtype } = getCellShapeInfo(cell, graph)
    const psr = String(psrtype || '').toLowerCase()
    return shape.startsWith('substation_') || psr === 'zf06' || psr === '30000005'
}

function getPreferredRecordTypes(cell, graph) {
    const category = getFlowOverlayDeviceCategory(cell, graph)
    if (isLgInSiteSvgMode()) {
        if (category === 'bus') return ['bus']
        if (category === 'trafo') return ['trafo']
    }
    if (isDistributionSubstationCell(cell, graph)) return ['load', 'line', 'bus', 'trafo']
    if (category === 'line') return ['line', 'bus', 'trafo']
    if (category === 'bus') return ['bus', 'line', 'trafo']
    if (category === 'trafo') return ['trafo', 'bus', 'line']
    if (category === 'gen') return ['gen', 'bus', 'line']
    if (category === 'load') return ['load', 'bus', 'line']
    if (category === 'switch') return ['switch', 'bus', 'line']
    if (isTrafoOrLoadDevice(cell, graph)) return ['trafo', 'line', 'bus']
    return ['bus', 'line', 'trafo', 'gen', 'load', 'switch']
}

/** 潮流上图支持的设备类型 */
function getFlowOverlayDeviceCategory(cell, graph) {
    const model = graph.getModel()
    const { shape, psrtype } = getCellShapeInfo(cell, graph)
    if (model.isEdge(cell)) {
        if (isLgInSiteSvgMode() && (psrtype === '0308' || psrtype === '0311')) return 'bus'
        return 'line'
    }
    if (DeviceCategoryUtil?.isBusCell?.(cell)) return 'bus'
    if (isLgInSiteSvgMode()) {
        if (isLgInSiteMainTransformerDevice(cell, graph)) return 'trafo'
        if (extractInSiteTrafoNum(cell.name) != null) return 'trafo'
    }
    if (isLgSwitchShapeOrPsr(shape, psrtype)) return 'switch'
    if (shape === 'generatingunit') return 'gen'
    if (psrtype === '370000' || shape.startsWith('energyconsumer_')) return 'load'
    return null
}

function getCellDisplayName(cell, parser, record) {
    const psrName = getCellPropMap(cell, parser)?.['cge:PSR_Ref']?.ObjectName
    return String(psrName || cell.name || record?.name || '').trim()
}

function calcBusRmsVoltage(record) {
    if (record?.rms_voltage != null && record.rms_voltage !== '') {
        return Number(record.rms_voltage)
    }
    if (record?.vm_pu != null && record?.vn_kv != null) {
        return Number(record.vm_pu) * Number(record.vn_kv)
    }
    return null
}

function resolveLineVnKv(record, indexes) {
    if (record?.vn_kv != null) return Number(record.vn_kv)
    const fromBus = indexes.busByIndex?.get(record?.from_bus)
    if (fromBus?.vn_kv != null) return Number(fromBus.vn_kv)
    const toBus = indexes.busByIndex?.get(record?.to_bus)
    if (toBus?.vn_kv != null) return Number(toBus.vn_kv)
    return null
}

/** 线路潮流方向量：p_from_mw 正负表示 from_bus → to_bus 或反向 */
function getLineFlowDirectionValue(record) {
    const pRaw = record?.p_from_mw
    if (pRaw == null || Number.isNaN(Number(pRaw))) return null
    return Number(pRaw)
}

function lineHasFlow(record) {
    const p = getLineFlowDirectionValue(record)
    if (p == null) return false
    return Math.abs(p) >= FLOW_P_EPS
}

function terminalMatchesBus(terminal, busRecord, parser) {
    if (!terminal || !busRecord?.busid) return false
    if (!DeviceCategoryUtil?.isBusCell?.(terminal)) return false

    for (const gid of getCellGlobeIds(terminal, parser)) {
        for (const v of flowIdVariants(gid)) {
            for (const bv of flowIdVariants(busRecord.busid)) {
                if (v === bv) return true
            }
        }
    }

    const cellName = normalizeName(getCellDisplayName(terminal, parser, busRecord))
    return Boolean(cellName && normalizeName(busRecord.name) === cellName)
}

/** 判断线路运动箭头是否应沿 absolutePoints 反向（p_from_mw 正负 + from/to 母线端子） */
function shouldReverseLineFlowPath(edge, graph, parser, record, indexes) {
    const p = getLineFlowDirectionValue(record) ?? 0
    const model = graph.getModel()
    const src = model.getTerminal(edge, true)
    const tgt = model.getTerminal(edge, false)
    const fromBus = indexes.busByIndex?.get(record.from_bus)
    const toBus = indexes.busByIndex?.get(record.to_bus)

    if (fromBus && terminalMatchesBus(src, fromBus, parser)) {
        return p < 0
    }
    if (fromBus && terminalMatchesBus(tgt, fromBus, parser)) {
        return p > 0
    }
    if (toBus && terminalMatchesBus(src, toBus, parser)) {
        return p > 0
    }
    if (toBus && terminalMatchesBus(tgt, toBus, parser)) {
        return p < 0
    }
    return p < 0
}

function createSvgEl(name) {
    return document.createElementNS(SVG_NS, name)
}

function roundPathCoord(v) {
    return Math.round(Number(v) * 10) / 10
}

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

function lgFlowMotionPathIdForCell(cell, batchId, seq) {
    const raw = String(cell?.id ?? 'e').replace(/[^a-zA-Z0-9_-]+/g, '_')
    return `lg_mpath_${batchId}_${seq}_${raw}`
}

function removeLgFlowMotionArrowsFromOverlay(graph) {
    const overlay = graph?.view?.getOverlayPane?.()
    if (!overlay || typeof overlay.querySelectorAll !== 'function') return
    overlay.querySelectorAll(`g[${LG_FLOW_MOTION_ATTR}="1"]`).forEach((g) => g.remove())
}

function clearLgFlowMotionArrows(graph) {
    removeLgFlowMotionArrowsFromOverlay(graph)
    lgFlowMotionContext = null
    if (graph) {
        delete graph._lgFlowMotionContext
    }
}

function scheduleLgFlowMotionArrowsRefresh(graph) {
    if (typeof window === 'undefined' || !graph || !lgFlowMotionContext) return
    if (lgFlowMotionRefreshTimer != null) {
        window.clearTimeout(lgFlowMotionRefreshTimer)
    }
    lgFlowMotionRefreshTimer = window.setTimeout(() => {
        lgFlowMotionRefreshTimer = null
        applyLgFlowMotionArrows(graph)
    }, 90)
}

function ensureLgFlowMotionViewListeners(graph) {
    if (!graph?.view || graph._lgFlowMotionViewListeners || typeof mxEvent === 'undefined') return

    const schedule = () => scheduleLgFlowMotionArrowsRefresh(graph)
    graph.view.addListener(mxEvent.SCALE_AND_TRANSLATE, schedule)
    graph.view.addListener(mxEvent.SCALE, schedule)
    graph.view.addListener(mxEvent.TRANSLATE, schedule)
    graph.addListener('cssTransformChanged', schedule)
    graph.addListener(mxEvent.SIZE, schedule)
    graph._lgFlowMotionViewListeners = true
}

function appendLgFlowMotionArrow(graph, edge, record, parser, indexes, batchId, seq) {
    if (!lineHasFlow(record)) return

    const st = graph.view.getState(edge)
    let pts = st?.absolutePoints
    if (!pts || pts.length < 2) return

    if (shouldReverseLineFlowPath(edge, graph, parser, record, indexes)) {
        pts = pts.slice().reverse()
    }

    const d = buildPolylineMotionPathD(pts)
    if (!d) return

    const overlay = graph.view.getOverlayPane?.()
    if (!overlay) return

    const edgeStyle = graph.getCurrentCellStyle(edge) || {}
    const strokeColor = String(edgeStyle.strokeColor || FLOW_MOTION_ARROW_COLOR)
    const lineW = Math.max(1.5, Number(edgeStyle.strokewidth || edgeStyle.strokeWidth || 2))
    const scale = graph.view.scale || 1
    const pathId = lgFlowMotionPathIdForCell(edge, batchId, seq)
    const h = Math.max(7, lineW * 3.2) * scale
    const L = Math.max(14, lineW * 6.4) * scale

    const wrap = createSvgEl('g')
    wrap.setAttribute(LG_FLOW_MOTION_ATTR, '1')
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
    poly.setAttribute('points', `0,${-h} ${L},0 0,${h}`)
    poly.setAttribute('fill', strokeColor)
    poly.setAttribute('stroke', 'none')

    const anim = createSvgEl('animateMotion')
    anim.setAttribute('dur', `${FLOW_MOTION_DUR_SEC}s`)
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

function applyLgFlowMotionArrows(graph) {
    if (typeof document === 'undefined' || !graph?.view?.getOverlayPane || !lgFlowMotionContext) return

    const { items, parser, indexes } = lgFlowMotionContext
    removeLgFlowMotionArrowsFromOverlay(graph)
    graph.view.validate()

    const batchId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    items.forEach(({ edge, record }, seq) => {
        if (!graph.view.getState(edge)) return
        appendLgFlowMotionArrow(graph, edge, record, parser, indexes, batchId, seq)
    })
}

function storeLgFlowMotionContext(graph, items, parser, indexes) {
    lgFlowMotionContext = { graph, items, parser, indexes }
    graph._lgFlowMotionContext = lgFlowMotionContext
    ensureLgFlowMotionViewListeners(graph)
    applyLgFlowMotionArrows(graph)
    if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => applyLgFlowMotionArrows(graph))
        window.setTimeout(() => applyLgFlowMotionArrows(graph), 100)
    }
}
function formatSwitchClosedValue(record, cell, graph) {
    if (record?.closed != null) {
        return record.closed === true || record.closed === 'true' || record.closed === 1 ? '闭合' : '断开'
    }
    const st = graph.getCurrentCellStyle(cell) || {}
    if (st.status != null) {
        return lgSwitchStatusLabel(st.status)
    }
    const shape = String(st.shape || cell.symbol || '').toLowerCase()
    if (shape === 'cbreaker_open' || shape.includes('@0')) {
        return '断开'
    }
    return '闭合'
}

function lookupFlowRecordByRawIds(rawIds, map, validate) {
    for (const raw of rawIds) {
        if (!raw) continue
        const candidates = [raw]
        const tail = String(raw).split(':').pop()
        if (tail && tail !== raw) candidates.push(tail)
        for (const id of candidates) {
            for (const v of flowIdVariants(id)) {
                const hit = map.get(v)
                if (hit && (!validate || validate(hit))) return hit
            }
        }
    }
    return null
}

function listInSiteStationBuses(indexes) {
    const prefix = indexes.inSiteStationPrefix || '府城站'
    return (indexes.busList || []).filter((b) => b.name && String(b.name).startsWith(`${prefix}.`))
}

function inSiteBusSectionRank(keyName) {
    const s = String(keyName || '')
    if (/东|ⅱ|ii|二/.test(s)) return 2
    if (/西|南|ⅰ|i|一|Ⅰ/.test(s) && !/东|ⅱ|ii|二/.test(s)) return 1
    if (/旁/.test(s)) return 3
    return 0
}

function collectInSiteBusPeers(cell, graph, parser, voltype) {
    const model = graph.getModel()
    const parent = model.getParent(cell)
    if (!parent) return [cell]
    const peers = []
    const childCount = model.getChildCount(parent)
    for (let i = 0; i < childCount; i++) {
        const ch = model.getChildAt(parent, i)
        if (!model.isEdge(ch)) continue
        if (getFlowOverlayDeviceCategory(ch, graph) !== 'bus') continue
        const pm = getCellPropMap(ch, parser)
        const vt = Number(pm?.['cge:PSR_Ref']?.voltype || ch.voltype)
        if (vt !== voltype) continue
        peers.push(ch)
    }
    peers.sort((a, b) => Number(a.id) - Number(b.id))
    return peers.length ? peers : [cell]
}

function matchInSiteBusByVoltypeAndName(cell, graph, parser, indexes) {
    const pm = getCellPropMap(cell, parser)
    const psr = pm?.['cge:PSR_Ref'] || {}
    const voltype = Number(psr.voltype || cell.voltype)
    const kv = IN_SITE_VOLTYPE_KV[voltype]
    if (kv == null) return null

    const keyName = psr.key_name || psr.ObjectName || cell.name || ''
    const candidates = listInSiteStationBuses(indexes).filter((b) => Number(b.vn_kv) === kv)
    if (!candidates.length) return null
    if (candidates.length === 1) return candidates[0]

    const sorted = [...candidates].sort((a, b) => {
        const sa = Number(String(a.name).split('.').pop()) || 0
        const sb = Number(String(b.name).split('.').pop()) || 0
        return sa - sb
    })

    const rank = inSiteBusSectionRank(keyName)
    if (rank > 0) {
        return sorted[Math.min(rank - 1, sorted.length - 1)] || sorted[0]
    }

    const peers = collectInSiteBusPeers(cell, graph, parser, voltype)
    const peerIndex = peers.indexOf(cell)
    if (peerIndex >= 0 && peerIndex < sorted.length) {
        return sorted[peerIndex]
    }
    return sorted[0]
}

function extractInSiteTrafoNum(text) {
    const s = String(text || '')
    let m = s.match(/#(\d+)主变/)
    if (m) return Number(m[1])
    m = s.match(/(?:^|[.#\s])府#(\d+)主变/)
    if (m) return Number(m[1])
    m = s.match(/#(\d+)号主变/)
    return m ? Number(m[1]) : null
}

function pickInSiteTrafoDisplayRecord(records) {
    if (!records?.length) return null
    if (records.length === 1) return records[0]
    return (
        records.find((r) => String(r.name || '').endsWith('_高')) ||
        records.find((r) => String(r.name || '').endsWith('_中')) ||
        records[0]
    )
}

function getInSiteTrafoLabelText(cell, parser) {
    const pm = getCellPropMap(cell, parser)
    const psr = pm?.['cge:PSR_Ref'] || {}
    const candidates = [
        psr.key_name,
        psr.key_name1,
        psr.key_name2,
        psr.key_name3,
        psr.ObjectName,
        cell.name,
    ]
    for (const text of candidates) {
        if (text && extractInSiteTrafoNum(text) != null) return String(text)
    }

    const txtCell = parser?.txtMap?.get?.(String(cell.id))
    if (txtCell?.value) {
        const linked = String(txtCell.value).replace(/\n/g, '')
        if (extractInSiteTrafoNum(linked) != null) return linked
    }

    if (parser?.widgetMap && cell.geometry) {
        const cx = cell.geometry.x + cell.geometry.width / 2
        const cy = cell.geometry.y + cell.geometry.height / 2
        for (const [, txt] of parser.widgetMap) {
            if (!DeviceCategoryUtil?.isTextCell?.(txt)) continue
            const t = String(txt.value || txt.name || '').replace(/\n/g, '')
            if (extractInSiteTrafoNum(t) == null) continue
            const g = txt.geometry
            if (!g) continue
            const dx = g.x + g.width / 2 - cx
            const dy = g.y + g.height / 2 - cy
            if (dx * dx + dy * dy < 140 * 140) return t
        }
    }

    return candidates.find(Boolean) || ''
}

function matchInSiteTrafoByName(cell, graph, parser, indexes) {
    const text = getInSiteTrafoLabelText(cell, parser)
    const num = extractInSiteTrafoNum(text)
    if (num == null) return null

    const prefix = indexes.inSiteStationPrefix || '府城站'
    const keyed = indexes.trafoByStationNum?.get(`${prefix}:${num}`)
    if (keyed) {
        return indexes.trafoDisplayByTrafoid?.get(keyed.trafoid) || keyed
    }

    const hits = (indexes.trafoList || []).filter((rec) => {
        if (!rec.name || !String(rec.name).startsWith(`${prefix}.`)) return false
        return extractInSiteTrafoNum(rec.name) === num
    })
    return pickInSiteTrafoDisplayRecord(hits)
}

function matchInSiteBusById(cell, parser, indexes) {
    const pm = getCellPropMap(cell, parser)
    const psr = pm?.['cge:PSR_Ref'] || {}
    return lookupFlowRecordByRawIds(
        [psr.keyid, psr.rtkeyid, cell.keyid, cell.rtkeyid],
        indexes.busById,
        isBusFlowRecord,
    )
}

function matchInSiteTrafoById(cell, parser, indexes) {
    const pm = getCellPropMap(cell, parser)
    const psr = pm?.['cge:PSR_Ref'] || {}
    const hit = lookupFlowRecordByRawIds(
        [psr.keyid, psr.rtkeyid, cell.keyid, cell.rtkeyid],
        indexes.trafoById,
        isTrafoFlowRecord,
    )
    if (!hit) return null
    return indexes.trafoDisplayByTrafoid?.get(hit.trafoid) || hit
}

/** /in-site-svg：母线仅 res_bus，主变仅 res_trafo */
function matchInSiteFlowRecord(cell, graph, parser, indexes) {
    const category = getFlowOverlayDeviceCategory(cell, graph)
    if (category === 'bus') {
        const byId = matchInSiteBusById(cell, parser, indexes)
        if (byId) return byId

        const byGlobe = matchFlowRecordByGlobeId(cell, graph, parser, indexes.recordByGlobeId)
        if (byGlobe && isBusFlowRecord(byGlobe)) return byGlobe

        return matchInSiteBusByVoltypeAndName(cell, graph, parser, indexes)
    }

    if (category === 'trafo') {
        const byId = matchInSiteTrafoById(cell, parser, indexes)
        if (byId) return byId

        const byGlobe = matchFlowRecordByGlobeId(cell, graph, parser, indexes.recordByGlobeId)
        if (byGlobe && isTrafoFlowRecord(byGlobe)) {
            return indexes.trafoDisplayByTrafoid?.get(byGlobe.trafoid) || byGlobe
        }

        return matchInSiteTrafoByName(cell, graph, parser, indexes)
    }

    return null
}

function matchFlowRecordByName(cell, graph, parser, indexes) {
    const category = getFlowOverlayDeviceCategory(cell, graph)
    if (!category) return null

    const name = normalizeName(getCellDisplayName(cell, parser, null))
    if (!name) return null

    if (category === 'gen' && indexes.genByName.has(name)) return indexes.genByName.get(name)
    if (category === 'load' && indexes.loadByName.has(name)) return indexes.loadByName.get(name)
    if (category === 'switch' && indexes.switchByName.has(name)) return indexes.switchByName.get(name)
    if (category === 'bus' && indexes.busByName.has(name)) return indexes.busByName.get(name)
    if (category === 'line' && indexes.lineByName.has(name)) return indexes.lineByName.get(name)
    if (category === 'trafo' && indexes.trafoByName.has(name)) return indexes.trafoByName.get(name)
    return null
}

function lookupRecordsByGlobeId(globeId, recordByGlobeId) {
    const hits = []
    const seenRecord = new Set()
    for (const key of flowIdVariants(globeId)) {
        const hit = recordByGlobeId.get(key)
        if (hit && !seenRecord.has(hit.record)) {
            seenRecord.add(hit.record)
            hits.push(hit)
        }
    }
    return hits
}

/** 优先按 GlobeID 匹配 JSON 中的 bus / line / trafo 记录 */
function matchFlowRecordByGlobeId(cell, graph, parser, recordByGlobeId) {
    const globeIds = getCellGlobeIds(cell, parser)
    if (!globeIds.length) return null

    const typeOrder = getPreferredRecordTypes(cell, graph)
    const allHits = []
    for (const globeId of globeIds) {
        allHits.push(...lookupRecordsByGlobeId(globeId, recordByGlobeId))
    }
    if (!allHits.length) return null

    for (const preferType of typeOrder) {
        for (const hit of allHits) {
            if (hit.type === preferType && acceptsTrafoRecord(cell, graph, parser, hit.record)) {
                return hit.record
            }
        }
    }
    for (const hit of allHits) {
        if (acceptsTrafoRecord(cell, graph, parser, hit.record)) {
            return hit.record
        }
    }
    return null
}

function addGlobeIdKeys(keys, rawGlobeId) {
    if (!rawGlobeId) return
    for (const variant of flowIdVariants(rawGlobeId)) {
        keys.add(variant)
    }
}

function getCellMatchKeys(cell, parser) {
    const keys = new Set()
    const id = String(cell.id || '')
    if (id.startsWith('TXT-')) {
        return keys
    }

    const globeFromObjectId = extractGlobeIdFromObjectId(id)
    if (globeFromObjectId) {
        addGlobeIdKeys(keys, globeFromObjectId)
    }

    const pm = getCellPropMap(cell, parser)
    const psr = pm?.['cge:PSR_Ref']
    if (psr) {
        addGlobeIdKeys(keys, psr.GlobeID)
        if (psr.ObjectID) {
            addGlobeIdKeys(keys, extractGlobeIdFromObjectId(psr.ObjectID) || psr.ObjectID)
        }
        if (psr.GeoPsrid) addGlobeIdKeys(keys, psr.GeoPsrid)
        if (psr.keyid) {
            for (const v of flowIdVariants(psr.keyid)) keys.add(v)
        }
        if (psr.rtkeyid) {
            for (const v of flowIdVariants(psr.rtkeyid)) keys.add(v)
        }
        if (psr.ObjectName) keys.add(normalizeName(psr.ObjectName))
    }
    if (cell.keyid) {
        for (const v of flowIdVariants(cell.keyid)) keys.add(v)
    }
    if (cell.rtkeyid) {
        for (const v of flowIdVariants(cell.rtkeyid)) keys.add(v)
    }

    if (cell.name) keys.add(normalizeName(cell.name))

    const val = cell.value
    if (typeof val === 'string' && val.trim()) {
        keys.add(normalizeName(val.split('\n')[0]))
    }

    return keys
}

function getCellShapeInfo(cell, graph) {
    const st = graph.getCurrentCellStyle(cell) || {}
    return {
        shape: String(st.shape || cell.symbol || '').toLowerCase(),
        psrtype: String(st.psrtype || cell.psrtype || ''),
    }
}

/** 配变/配电站等负荷类设备，优先匹配 res_trafo */
function isTrafoOrLoadDevice(cell, graph) {
    const { shape, psrtype } = getCellShapeInfo(cell, graph)
    return (
        shape.indexOf('potentialtransformer') === 0 ||
        shape.indexOf('powertransformer') === 0 ||
        shape.startsWith('substation_') ||
        isLgLoadShapeOrPsr(shape, psrtype)
    )
}

function getFlowMatchMaps(cell, graph, indexes) {
    const model = graph.getModel()
    const category = getFlowOverlayDeviceCategory(cell, graph)
    const maps = []

    if (category === 'line' || model.isEdge(cell)) {
        maps.push(indexes.lineById, indexes.lineByName, indexes.busById, indexes.busByName)
    } else if (category === 'bus' || DeviceCategoryUtil?.isBusCell?.(cell)) {
        maps.push(indexes.busById, indexes.busByName, indexes.lineById, indexes.lineByName)
    } else if (category === 'gen') {
        maps.push(indexes.genById, indexes.genByName, indexes.busById, indexes.busByName)
    } else if (category === 'load') {
        maps.push(indexes.loadById, indexes.loadByName, indexes.busById, indexes.busByName)
    } else if (category === 'trafo') {
        maps.push(indexes.trafoById, indexes.trafoByName, indexes.busById, indexes.busByName)
    } else if (category === 'switch') {
        maps.push(indexes.switchById, indexes.switchByName)
    } else if (isTrafoOrLoadDevice(cell, graph)) {
        if (isDistributionSubstationCell(cell, graph)) {
            maps.push(indexes.loadById, indexes.loadByName)
        }
        maps.push(indexes.trafoById, indexes.trafoByName, indexes.busById, indexes.busByName, indexes.lineById, indexes.lineByName)
    } else {
        maps.push(
            indexes.busById,
            indexes.busByName,
            indexes.lineById,
            indexes.lineByName,
            indexes.trafoById,
            indexes.trafoByName,
            indexes.genById,
            indexes.genByName,
            indexes.loadById,
            indexes.loadByName,
            indexes.switchById,
            indexes.switchByName,
        )
    }

    return maps
}

function matchFlowRecord(cell, graph, parser, indexes) {
    if (isLgInSiteSvgMode()) {
        const category = getFlowOverlayDeviceCategory(cell, graph)
        if (category === 'bus' || category === 'trafo') {
            return matchInSiteFlowRecord(cell, graph, parser, indexes)
        }
    }

    const byGlobe = matchFlowRecordByGlobeId(cell, graph, parser, indexes.recordByGlobeId)
    if (byGlobe) return byGlobe

    if (isDistributionSubstationCell(cell, graph)) {
        const name = normalizeName(getCellDisplayName(cell, parser, null))
        if (name && indexes.loadByName?.has(name)) {
            return indexes.loadByName.get(name)
        }
    }

    const byName = matchFlowRecordByName(cell, graph, parser, indexes)
    if (byName) return byName

    const keys = getCellMatchKeys(cell, parser)
    if (keys.size === 0) return null

    for (const map of getFlowMatchMaps(cell, graph, indexes)) {
        for (const key of keys) {
            if (map.has(key)) {
                const record = map.get(key)
                if (!acceptsTrafoRecord(cell, graph, parser, record)) {
                    continue
                }
                return record
            }
        }
    }
    return null
}

function isTrafoLoadRecord(record) {
    return record != null && record.trafoid != null && record.loading_percent != null
}

/** 避免 GlobeID 变体碰撞导致配变匹配到错误的 res_trafo */
function acceptsTrafoRecord(cell, graph, parser, record) {
    if (!isTrafoLoadRecord(record)) return true
    if (!isTrafoOrLoadDevice(cell, graph) && !isLgInSiteMainTransformerDevice(cell, graph)) return false
    const psrName = normalizeName(getCellPropMap(cell, parser)?.['cge:PSR_Ref']?.ObjectName || cell.name)
    const recordName = normalizeName(record.name)
    if (psrName && recordName) {
        return psrName === recordName
    }
    return true
}

function shouldHighlightOverLimitCell(cell, graph, parser, record) {
    if (!isOverLimitRecord(record)) return false
    if (isTrafoLoadRecord(record)) {
        return acceptsTrafoRecord(cell, graph, parser, record)
    }
    return true
}

function getCellFlowAttr(cell, graph, key) {
    const st = graph.getCurrentCellStyle(cell) || {}
    const raw = cell[key] != null && cell[key] !== '' ? cell[key] : st[key]
    if (raw == null || raw === '') return null
    const n = Number(raw)
    return Number.isNaN(n) ? raw : n
}

function isTrafoFlowRecord(record) {
    return (
        record != null &&
        (record.trafoid != null ||
            record.sn_mva != null ||
            record.p_hv_mw != null ||
            record.p_lv_mw != null)
    )
}

function isBusFlowRecord(record) {
    return record != null && record.trafoid == null && record.lineid == null && record.vm_pu != null
}

function resolveInSiteTrafoRatedKv(cell, graph) {
    const st = graph.getCurrentCellStyle(cell) || {}
    const vt = Number(st.voltype || cell.voltype)
    if (Number.isFinite(vt) && IN_SITE_VOLTYPE_KV[vt] != null) {
        return IN_SITE_VOLTYPE_KV[vt]
    }
    return null
}

/** JSON 无 sn_mva 时，由视在功率与负载率反推额定容量 */
function deriveTrafoSnMvaFromFlow(record) {
    const loading = Number(record?.loading_percent)
    if (!Number.isFinite(loading) || Math.abs(loading) < 1e-6) return null
    const p =
        record?.p_hv_mw != null
            ? Number(record.p_hv_mw)
            : record?.p_lv_mw != null
              ? Number(record.p_lv_mw)
              : null
    const q =
        record?.q_hv_mvar != null
            ? Number(record.q_hv_mvar)
            : record?.q_lv_mvar != null
              ? Number(record.q_lv_mvar)
              : null
    if (p == null && q == null) return null
    const apparent = Math.hypot(p || 0, q || 0)
    if (apparent < 1e-6) return null
    return (apparent * 100) / Math.abs(loading)
}

function resolveTrafoFlowVoltage(record, cell, graph) {
    if (record?.hv_rms_voltage != null) return Number(record.hv_rms_voltage)
    if (record?.vn_hv_kv != null) return Number(record.vn_hv_kv)
    if (record?.vn_lv_kv != null) return Number(record.vn_lv_kv)
    if (record?.vn_kv != null) return Number(record.vn_kv)
    const iv = getCellFlowAttr(cell, graph, 'I_Vol')
    if (iv != null && !Number.isNaN(Number(iv))) return Number(iv)
    const kv = getCellFlowAttr(cell, graph, 'K_Vol')
    if (kv != null && !Number.isNaN(Number(kv))) return Number(kv)
    if (isLgInSiteSvgMode()) {
        const ratedKv = resolveInSiteTrafoRatedKv(cell, graph)
        if (ratedKv != null) return ratedKv
    }
    return null
}

function resolveTrafoFlowSn(record, cell, graph) {
    if (record?.sn_mva != null) return Number(record.sn_mva)
    const derived = deriveTrafoSnMvaFromFlow(record)
    if (derived != null) return derived
    const is = getCellFlowAttr(cell, graph, 'I_S')
    if (is != null && !Number.isNaN(Number(is))) return Number(is)
    return null
}

function resolveTrafoFlowP(record, cell, graph) {
    if (record?.p_hv_mw != null) return Number(record.p_hv_mw)
    if (record?.p_lv_mw != null) return Number(record.p_lv_mw)
    if (record?.p_mw != null) return Number(record.p_mw)
    const p = getCellFlowAttr(cell, graph, 'P')
    if (p != null && !Number.isNaN(Number(p))) return Number(p)
    return null
}

function resolveTrafoFlowQ(record, cell, graph) {
    if (record?.q_hv_mvar != null) return Number(record.q_hv_mvar)
    if (record?.q_lv_mvar != null) return Number(record.q_lv_mvar)
    if (record?.q_mvar != null) return Number(record.q_mvar)
    const q = getCellFlowAttr(cell, graph, 'Q')
    if (q != null && !Number.isNaN(Number(q))) return Number(q)
    return null
}

/** /in-site-svg 母线潮流标签：额定电压 vn_kv、计算电压 rms_voltage */
function buildInSiteBusFlowLabel(record) {
    if (!record) return ''
    const lines = []
    if (record.vn_kv != null) lines.push(`额定电压:${formatNumber(record.vn_kv, 0)}kV`)
    const rms = calcBusRmsVoltage(record)
    if (rms != null) lines.push(`计算电压:${formatNumber(rms, 3)}kV`)
    return lines.join('\n')
}

/** /in-site-svg 主变潮流标签：电压、额定容量、有功、无功、负载（五项固定展示） */
function buildInSiteTrafoFlowLabel(cell, graph, record) {
    if (!record) return ''

    const vn = resolveTrafoFlowVoltage(record, cell, graph)
    const sn = resolveTrafoFlowSn(record, cell, graph)
    const p = resolveTrafoFlowP(record, cell, graph)
    const q = resolveTrafoFlowQ(record, cell, graph)
    const load = record.loading_percent

    const vnDigits = vn != null && Math.abs(vn) >= 100 ? 0 : vn != null && Math.abs(vn) >= 10 ? 1 : 2
    return [
        `电压:${vn != null ? `${formatNumber(vn, vnDigits)}kV` : '--'}`,
        `额定容量:${sn != null ? `${formatNumber(sn)}MVA` : '--'}`,
        `P:${p != null ? `${formatNumber(p)}MW` : '--'}`,
        `Q:${q != null ? `${formatNumber(q)}Mvar` : '--'}`,
        `负载:${load != null && load !== '' ? `${formatNumber(load, 1)}%` : '--'}`,
    ].join('\n')
}

function buildFlowOverlayLabel(cell, graph, parser, record, indexes) {
    const category = getFlowOverlayDeviceCategory(cell, graph)
    if (!category) return ''

    if (isLgInSiteSvgMode()) {
        if (category === 'bus') {
            return buildInSiteBusFlowLabel(record)
        }
        if (category === 'trafo') {
            return buildInSiteTrafoFlowLabel(cell, graph, record)
        }
    }

    const lines = []
    const displayName = getCellDisplayName(cell, parser, record)

    if (category === 'bus') {
        if (!record) return ''
        if (record.vn_kv != null) lines.push(`额定电压:${formatNumber(record.vn_kv, 0)}kV`)
        const rms = calcBusRmsVoltage(record)
        if (rms != null) lines.push(`计算电压:${formatNumber(rms, 3)}kV`)
    } else if (category === 'line') {
        if (!record) return ''
        const vn = resolveLineVnKv(record, indexes)
        if (vn != null) lines.push(`电压:${formatNumber(vn, 0)}kV`)
        if (record.i_from_ka != null) lines.push(`电流:${formatNumber(record.i_from_ka, 4)}kA`)
        if (record.p_from_mw != null) lines.push(`P:${formatNumber(record.p_from_mw)}MW`)
        if (record.q_from_mvar != null) lines.push(`Q:${formatNumber(record.q_from_mvar)}MVar`)
        if (record.loading_percent != null) lines.push(`负载:${formatNumber(record.loading_percent, 1)}%`)
    } else if (category === 'gen') {
        if (!record) return ''
        if (displayName || record.name) lines.push(`名称:${displayName || record.name}`)
        if (record.p_mw != null) lines.push(`P:${formatNumber(record.p_mw)}MW`)
        if (record.q_mvar != null) lines.push(`Q:${formatNumber(record.q_mvar)}MVar`)
    } else if (category === 'load') {
        if (!record) return ''
        if (displayName || record.name) lines.push(`名称:${displayName || record.name}`)
        if (record.p_mw != null) lines.push(`功率:${formatNumber(record.p_mw)}MW`)
    } else if (category === 'switch') {
        if (displayName) lines.push(`名称:${displayName}`)
        else if (record?.name) lines.push(`名称:${record.name}`)
        lines.push(`状态:${formatSwitchClosedValue(record, cell, graph)}`)
    }

    return lines.join('\n')
}

/** @deprecated 保留供越限高亮等场景；潮流上图请用 buildFlowOverlayLabel */
function buildFlowLabel(record, graph, cell) {
    return buildFlowOverlayLabel(cell, graph, null, record, { busByIndex: new Map() })
}

function getOverlaySize(label, fontSize = OVERLAY_FONT_SIZE, lineHeight = 1) {
    const lines = String(label || '').split('\n').filter(Boolean)
    if (!lines.length) {
        return { width: 48, height: Math.ceil(fontSize * lineHeight) + 2 }
    }
    const dim = TextUtil.getTextDimensionFromTxtList(fontSize, lines)
    const height = Math.ceil(lines.length * fontSize * lineHeight)
    return {
        width: Math.max(dim.width + 4, 24),
        height: Math.max(height + 2, Math.ceil(fontSize * lineHeight) + 2),
    }
}

function formatFlowOverlayHtml(label) {
    const lines = String(label || '').split('\n').filter(Boolean)
    if (!lines.length) return ''
    const inner = lines.map((line) => mxUtils.htmlEntities(line, false)).join('<br/>')
    return `<div style="text-align:left;line-height:${OVERLAY_LINE_HEIGHT};">${inner}</div>`
}

function buildFlowOverlayStyle() {
    return [
        'text',
        'html=1',
        'strokeColor=none',
        'fillColor=none',
        'align=left',
        'verticalAlign=top',
        `fontColor=${getLgFlowOverlayFontColor()}`,
        `fontSize=${OVERLAY_FONT_SIZE}`,
        'fontFamily=SimSun',
        'layer=Text_Layer',
        'lgFlowOverlay=1',
    ].join(';')
}

/** mxGraph：view = scale * (model + translate) → model = view/scale - translate */
function viewPtToModel(graph, viewX, viewY) {
    const view = graph.view
    const scale = view.scale || 1
    return {
        x: viewX / scale - view.translate.x,
        y: viewY / scale - view.translate.y,
    }
}

function getEdgePathPointsInModel(graph, edge) {
    const state = graph.view.getState(edge)
    if (state?.absolutePoints?.length >= 2) {
        return state.absolutePoints.map((p) => viewPtToModel(graph, p.x, p.y))
    }

    const geo = graph.getModel().getGeometry(edge)
    if (!geo) return null

    const pts = []
    if (geo.sourcePoint != null) {
        pts.push({ x: geo.sourcePoint.x, y: geo.sourcePoint.y })
    }
    if (geo.points != null) {
        for (let i = 0; i < geo.points.length; i++) {
            pts.push({ x: geo.points[i].x, y: geo.points[i].y })
        }
    }
    if (geo.targetPoint != null) {
        pts.push({ x: geo.targetPoint.x, y: geo.targetPoint.y })
    }

    if (pts.length >= 2) return pts

    const src = graph.getModel().getTerminal(edge, true)
    const tgt = graph.getModel().getTerminal(edge, false)
    const srcState = src ? graph.view.getState(src) : null
    const tgtState = tgt ? graph.view.getState(tgt) : null
    if (srcState && tgtState) {
        return [
            viewPtToModel(graph, srcState.getCenterX(), srcState.getCenterY()),
            viewPtToModel(graph, tgtState.getCenterX(), tgtState.getCenterY()),
        ]
    }
    return null
}

/** 取线路折线最长段中点 + 法向单位向量（与 LGSvgParser 线路名称标签一致，法向为线段下方/外侧） */
function getEdgeLabelFrameInModel(graph, edge) {
    const pts = getEdgePathPointsInModel(graph, edge)
    if (!pts || pts.length < 2) return null

    let bestLen = 0
    let mx = (pts[0].x + pts[pts.length - 1].x) / 2
    let my = (pts[0].y + pts[pts.length - 1].y) / 2
    let segDx = pts[pts.length - 1].x - pts[0].x
    let segDy = pts[pts.length - 1].y - pts[0].y

    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]
        const b = pts[i]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const lenSq = dx * dx + dy * dy
        if (lenSq > bestLen) {
            bestLen = lenSq
            mx = (a.x + b.x) / 2
            my = (a.y + b.y) / 2
            segDx = dx
            segDy = dy
        }
    }

    let lineAngle = (Math.atan2(segDy, segDx) * 180) / Math.PI
    if (lineAngle > 90) lineAngle -= 180

    const rad = ((lineAngle + 90) * Math.PI) / 180
    const segLen = Math.sqrt(bestLen) || 1
    return {
        mx,
        my,
        nx: Math.cos(rad),
        ny: Math.sin(rad),
        segLen,
        segDx: segDx / segLen,
        segDy: segDy / segLen,
    }
}

/** @deprecated 使用 getEdgeLabelFrameInModel */
function getEdgeLabelAnchorInModel(graph, edge) {
    const frame = getEdgeLabelFrameInModel(graph, edge)
    if (!frame) return null
    return {
        x: frame.mx + frame.nx * LINE_LABEL_GAP,
        y: frame.my + frame.ny * LINE_LABEL_GAP,
    }
}

/** 线路标签：沿法向偏移，使标签最近边与线路保持 clearance，避免压线 */
function placeEdgeOverlayLabel(frame, width, height, clearance = LINE_LABEL_CLEARANCE, strokePad = 2) {
    const offset = clearance + strokePad + height / 2
    const cx = frame.mx + frame.nx * offset
    const cy = frame.my + frame.ny * offset
    return {
        x: cx - width / 2,
        y: cy - height / 2,
        width,
        height,
    }
}

function getCellModelBounds(graph, cell) {
    const bbox =
        typeof graph.getBoundingBoxFromGeometry === 'function'
            ? graph.getBoundingBoxFromGeometry([cell], true)
            : null
    if (bbox && (bbox.width > 0 || bbox.height > 0)) {
        return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height }
    }
    const geo = graph.getModel()?.getGeometry(cell)
    if (geo && (geo.width > 0 || geo.height > 0)) {
        return { x: geo.x, y: geo.y, width: geo.width, height: geo.height }
    }
    return null
}

/** /in-site-svg 主变潮流标签：图标左下角偏左、略上移，贴近图标 */
function createInSiteTrafoFlowOverlayPlacement(graph, cell, width, height) {
    const bounds = getCellModelBounds(graph, cell)
    if (!bounds) return null
    return {
        parent: graph.getDefaultParent(),
        x: bounds.x - IN_SITE_TRAFO_FLOW_LABEL_LEFT_OFFSET,
        y: bounds.y + bounds.height - height + IN_SITE_TRAFO_FLOW_LABEL_DOWN_OFFSET,
        width,
        height,
        relative: false,
    }
}

/** 顶点图元：站内图用模型绝对坐标；其它页面用子节点相对定位 */
function createFlowOverlayPlacement(graph, cell, width, height, opts = {}) {
    const { category } = opts
    const model = graph.getModel()
    const gap = OVERLAY_GAP

    if (!model.isEdge(cell)) {
        if (isLgInSiteSvgMode() && category === 'trafo') {
            const trafoPlacement = createInSiteTrafoFlowOverlayPlacement(graph, cell, width, height)
            if (trafoPlacement) return trafoPlacement
        }

        if (isLgInSiteSvgMode()) {
            const bbox =
                typeof graph.getBoundingBoxFromGeometry === 'function'
                    ? graph.getBoundingBoxFromGeometry([cell], true)
                    : null
            let cx
            let topY
            if (bbox && (bbox.width > 0 || bbox.height > 0)) {
                cx = bbox.x + bbox.width / 2
                topY = bbox.y
            } else {
                const geo = model.getGeometry(cell)
                if (geo && (geo.width > 0 || geo.height > 0)) {
                    cx = geo.x + geo.width / 2
                    topY = geo.y
                }
            }
            if (cx != null && topY != null) {
                return {
                    parent: graph.getDefaultParent(),
                    x: cx - width / 2,
                    y: topY - height - gap,
                    width,
                    height,
                    relative: false,
                }
            }
        }

        const geo = new mxGeometry(0.5, 0, width, height)
        geo.relative = true
        geo.offset = new mxPoint(-width / 2, -height - gap)
        return { parent: cell, geo, relative: true }
    }

    const frame = getEdgeLabelFrameInModel(graph, cell)
    if (frame) {
        const pos = placeEdgeOverlayLabel(
            frame,
            width,
            height,
            FLOW_LINE_LABEL_CLEARANCE,
            FLOW_LINE_LABEL_STROKE_PAD
        )
        return {
            parent: graph.getDefaultParent(),
            x: pos.x,
            y: pos.y,
            width: pos.width,
            height: pos.height,
            relative: false,
        }
    }

    const bbox = typeof graph.getBoundingBoxFromGeometry === 'function'
        ? graph.getBoundingBoxFromGeometry([cell], true)
        : null
    let cx
    let cy
    if (bbox && (bbox.width > 0 || bbox.height > 0)) {
        cx = bbox.x + bbox.width / 2
        cy = bbox.y + bbox.height / 2
    } else {
        cx = 0
        cy = 0
    }

    return {
        parent: graph.getDefaultParent(),
        x: cx - width / 2,
        y: cy - height / 2 - gap,
        width,
        height,
        relative: false,
    }
}

/** 越限负载率标签：顶点图元贴右侧；线路贴最长段中点偏右 */
function createWarnOverlayPlacement(graph, cell, width, height) {
    const model = graph.getModel()
    const gap = OVERLAY_GAP

    if (!model.isEdge(cell)) {
        const geo = new mxGeometry(1, 0.5, width, height)
        geo.relative = true
        geo.offset = new mxPoint(gap, -height / 2)
        return { parent: cell, geo, relative: true }
    }

    const frame = getEdgeLabelFrameInModel(graph, cell)
    if (frame) {
        const pos = placeEdgeOverlayLabel(frame, width, height, LINE_LABEL_CLEARANCE)
        return {
            parent: graph.getDefaultParent(),
            x: pos.x,
            y: pos.y,
            width: pos.width,
            height: pos.height,
            relative: false,
        }
    }

    const bbox = typeof graph.getBoundingBoxFromGeometry === 'function'
        ? graph.getBoundingBoxFromGeometry([cell], true)
        : null
    if (bbox && (bbox.width > 0 || bbox.height > 0)) {
        return {
            parent: graph.getDefaultParent(),
            x: bbox.x + bbox.width + gap,
            y: bbox.y + bbox.height / 2 - height / 2,
            width,
            height,
            relative: false,
        }
    }

    return createFlowOverlayPlacement(graph, cell, width, height)
}

function shouldSkipFlowOverlayCell(cell) {
    const id = String(cell.id || '')
    if (
        id.startsWith(OVERLAY_PREFIX) ||
        id.startsWith(WARN_OVERLAY_PREFIX) ||
        cell.lgFlowOverlay ||
        cell.lgWarnOverlay
    ) {
        return true
    }
    if (DeviceCategoryUtil?.isTextCell?.(cell)) return true
    if (cell.flag === 'virtualCell' || cell.flag === 'pointline') return true
    return false
}

function insertWarnOverlay(graph, cell, label) {
    const model = graph.getModel()
    const { width, height } = getOverlaySize(label, WARN_OVERLAY_FONT_SIZE)
    const placement = createWarnOverlayPlacement(graph, cell, width, height)
    const overlayId = `${WARN_OVERLAY_PREFIX}${cell.id}`
    const style = [
        'text',
        'html=0',
        'strokeColor=none',
        'fillColor=none',
        'align=left',
        'verticalAlign=middle',
        `fontColor=${WARN_HIGHLIGHT_STROKE}`,
        `fontSize=${WARN_OVERLAY_FONT_SIZE}`,
        'fontStyle=1',
        'fontFamily=SimSun',
        'whiteSpace=nowrap',
        'layer=Text_Layer',
        'lgWarnOverlay=1',
    ].join(';')

    const existing = model.getCell(overlayId)
    if (existing) {
        graph.removeCells([existing], false)
        warnOverlayCellIds.delete(overlayId)
    }

    let overlay
    if (placement.relative) {
        overlay = graph.insertVertex(
            placement.parent,
            overlayId,
            label,
            placement.geo.x,
            placement.geo.y,
            width,
            height,
            style,
            true,
        )
        model.setGeometry(overlay, placement.geo)
    } else {
        overlay = graph.insertVertex(
            placement.parent,
            overlayId,
            label,
            placement.x,
            placement.y,
            width,
            height,
            style,
        )
    }
    overlay.setConnectable(false)
    overlay.lgWarnOverlay = true
    warnOverlayCellIds.add(overlayId)
    return overlay
}

/** /in-site-svg：主变/馈线负载率标签与名称的屏幕像素间距 */
const IN_SITE_LOADING_LABEL_GAP = 0

/** 文字标签在模型坐标下的外接框（优先用渲染 bbox，缩放/侧栏变化后仍准确） */
function getInSiteTextLabelModelFrame(graph, labelCell) {
    if (!labelCell) return null
    graph.view.validate(labelCell)
    const state = graph.view.getState(labelCell)
    if (state) {
        if (state.text?.boundingBox) {
            const bb = state.text.boundingBox
            const tl = viewPtToModel(graph, bb.x, bb.y)
            const br = viewPtToModel(graph, bb.x + bb.width, bb.y + bb.height)
            return {
                x: Math.min(tl.x, br.x),
                y: Math.min(tl.y, br.y),
                width: Math.abs(br.x - tl.x),
                height: Math.abs(br.y - tl.y),
            }
        }
        if (state.width > 0 && state.height > 0) {
            const tl = viewPtToModel(graph, state.x, state.y)
            const br = viewPtToModel(graph, state.x + state.width, state.y + state.height)
            return {
                x: Math.min(tl.x, br.x),
                y: Math.min(tl.y, br.y),
                width: Math.abs(br.x - tl.x),
                height: Math.abs(br.y - tl.y),
            }
        }
    }
    const geo = graph.getModel()?.getGeometry(labelCell)
    if (geo && (geo.width > 0 || geo.height > 0)) {
        return { x: geo.x, y: geo.y, width: geo.width, height: geo.height }
    }
    return null
}

function createInSiteLabelBelowOverlayPlacement(graph, labelCell, width, height) {
    if (!labelCell) return null
    const frame = getInSiteTextLabelModelFrame(graph, labelCell)
    if (!frame) return null
    const scale = graph.view.scale || 1
    const gapModel = IN_SITE_LOADING_LABEL_GAP / scale
    return {
        parent: graph.getDefaultParent(),
        x: frame.x + frame.width / 2 - width / 2,
        y: frame.y + frame.height + gapModel,
        width,
        height,
        relative: false,
    }
}

/** #2主变名称文字（如 #2主变） */
function findInSiteTrafo2NameLabelCell(parser, trafoCell) {
    if (parser?.txtMap && trafoCell?.id) {
        const linked = parser.txtMap.get(String(trafoCell.id))
        if (linked && DeviceCategoryUtil?.isTextCell?.(linked)) {
            const t = String(linked.value ?? linked.name ?? '').replace(/\n/g, '').trim()
            if (extractInSiteTrafoNum(t) === 2) return linked
        }
    }
    if (!parser?.widgetMap) return null
    let fallback = null
    for (const cell of parser.widgetMap.values()) {
        if (!DeviceCategoryUtil?.isTextCell?.(cell)) continue
        const t = String(cell.value ?? cell.name ?? '')
            .replace(/\n/g, '')
            .trim()
        if (extractInSiteTrafoNum(t) !== 2 || !/主变/.test(t)) continue
        if (t === '#2主变') return cell
        fallback = cell
    }
    return fallback
}

/** 府馨线全称标签（如 23板府馨线），用于负载率定位 */
function findInSiteFuxinFeederLineLabelCell(parser) {
    if (!parser?.widgetMap) return null
    let best = null
    let bestLen = 0
    for (const cell of parser.widgetMap.values()) {
        if (!DeviceCategoryUtil?.isTextCell?.(cell)) continue
        const t = String(cell.value ?? cell.name ?? '')
            .replace(/\n/g, '')
            .trim()
        if (!/府馨线/.test(t) || /^府馨\d+$/.test(t)) continue
        if (t.length >= bestLen) {
            bestLen = t.length
            best = cell
        }
    }
    return best
}

function createInSiteFuxinFeederWarnOverlayPlacement(graph, parser, width, height) {
    return createInSiteLabelBelowOverlayPlacement(
        graph,
        findInSiteFuxinFeederLineLabelCell(parser),
        width,
        height,
    )
}

function createInSiteTrafoWarnOverlayPlacement(graph, parser, trafoCell, width, height) {
    const labelCell = findInSiteTrafo2NameLabelCell(parser, trafoCell)
    return createInSiteLabelBelowOverlayPlacement(graph, labelCell || trafoCell, width, height)
}

/** /in-site-svg：负载率贴在名称文字正下方（模型绝对坐标，随缩放/侧栏同步） */
function mountInSiteWarnOverlay(graph, overlayId, label, placement) {
    if (!placement || placement.relative) return null
    const model = graph.getModel()
    const { width, height } = getOverlaySize(label, WARN_OVERLAY_FONT_SIZE)
    const style = [
        'text',
        'html=0',
        'strokeColor=none',
        'fillColor=none',
        'align=center',
        'verticalAlign=top',
        `fontColor=${WARN_HIGHLIGHT_STROKE}`,
        `fontSize=${WARN_OVERLAY_FONT_SIZE}`,
        'fontStyle=1',
        'fontFamily=SimSun',
        'whiteSpace=nowrap',
        'layer=Text_Layer',
        'lgWarnOverlay=1',
    ].join(';')

    const existing = model.getCell(overlayId)
    if (existing) {
        graph.removeCells([existing], false)
        warnOverlayCellIds.delete(overlayId)
    }

    const overlay = graph.insertVertex(
        placement.parent,
        overlayId,
        label,
        placement.x,
        placement.y,
        width,
        height,
        style,
    )
    overlay.setConnectable(false)
    overlay.lgWarnOverlay = true
    warnOverlayCellIds.add(overlayId)
    return overlay
}

function registerInSiteWarnOverlay(graph, parser, item) {
    if (!isLgInSiteSvgMode()) return
    if (!inSiteWarnOverlayContext || inSiteWarnOverlayContext.graph !== graph) {
        inSiteWarnOverlayContext = { graph, parser, items: [] }
    } else {
        inSiteWarnOverlayContext.parser = parser
    }
    const idx = inSiteWarnOverlayContext.items.findIndex((entry) => entry.id === item.id)
    if (idx >= 0) {
        inSiteWarnOverlayContext.items[idx] = item
    } else {
        inSiteWarnOverlayContext.items.push(item)
    }
    ensureInSiteWarnOverlayViewListeners(graph)
}

function rebuildInSiteWarnOverlays(graph) {
    if (!graph || !inSiteWarnOverlayContext || inSiteWarnOverlayContext.graph !== graph) return
    const { parser, items } = inSiteWarnOverlayContext
    if (!items.length) return

    graph.view.validate()
    const model = graph.getModel()
    model.beginUpdate()
    try {
        for (const item of items) {
            const overlay = model.getCell(item.id)
            if (!overlay) continue
            let labelCell = null
            if (item.kind === 'trafo2') {
                labelCell = findInSiteTrafo2NameLabelCell(parser, item.trafoCell) || item.trafoCell
            } else if (item.kind === 'fuxin') {
                labelCell = findInSiteFuxinFeederLineLabelCell(parser)
            }
            if (!labelCell) continue
            const { width, height } = getOverlaySize(item.label, WARN_OVERLAY_FONT_SIZE)
            const placement = createInSiteLabelBelowOverlayPlacement(graph, labelCell, width, height)
            if (!placement) continue
            model.setGeometry(overlay, new mxGeometry(placement.x, placement.y, width, height))
        }
    } finally {
        model.endUpdate()
    }
}

function scheduleInSiteWarnOverlayRefresh(graph) {
    if (typeof window === 'undefined' || !graph || !inSiteWarnOverlayContext) return
    if (inSiteWarnOverlayRefreshTimer != null) {
        window.clearTimeout(inSiteWarnOverlayRefreshTimer)
    }
    inSiteWarnOverlayRefreshTimer = window.setTimeout(() => {
        inSiteWarnOverlayRefreshTimer = null
        rebuildInSiteWarnOverlays(graph)
    }, 90)
}

function ensureInSiteWarnOverlayViewListeners(graph) {
    if (!graph?.view || graph._lgInSiteWarnOverlayListeners || typeof mxEvent === 'undefined') return
    const schedule = () => scheduleInSiteWarnOverlayRefresh(graph)
    graph.view.addListener(mxEvent.SCALE_AND_TRANSLATE, schedule)
    graph.view.addListener(mxEvent.SCALE, schedule)
    graph.view.addListener(mxEvent.TRANSLATE, schedule)
    graph.addListener('cssTransformChanged', schedule)
    graph.addListener(mxEvent.SIZE, schedule)
    graph._lgInSiteWarnOverlayListeners = true
}

function clearInSiteWarnOverlayContext() {
    inSiteWarnOverlayContext = null
    if (inSiteWarnOverlayRefreshTimer != null) {
        window.clearTimeout(inSiteWarnOverlayRefreshTimer)
        inSiteWarnOverlayRefreshTimer = null
    }
}

/** /in-site-svg：府馨线负载率贴在馈线名称正下方 */
function insertInSiteFuxinFeederWarnOverlay(graph, parser, label, fallbackEdge) {
    const { width, height } = getOverlaySize(label, WARN_OVERLAY_FONT_SIZE)
    const placement =
        createInSiteFuxinFeederWarnOverlayPlacement(graph, parser, width, height) ||
        (fallbackEdge ? createWarnOverlayPlacement(graph, fallbackEdge, width, height) : null)
    if (!placement) return null
    if (!placement.relative) {
        const overlayId = `${WARN_OVERLAY_PREFIX}fuxin-feeder`
        const overlay = mountInSiteWarnOverlay(graph, overlayId, label, placement)
        if (overlay && parser) {
            registerInSiteWarnOverlay(graph, parser, { id: overlayId, label, kind: 'fuxin' })
        }
        return overlay
    }
    return insertWarnOverlay(graph, fallbackEdge, label)
}

/** /in-site-svg：#2主变负载率贴在主变名称正下方 */
function insertInSiteTrafoWarnOverlay(graph, parser, label, trafoCell) {
    const { width, height } = getOverlaySize(label, WARN_OVERLAY_FONT_SIZE)
    const placement = createInSiteTrafoWarnOverlayPlacement(graph, parser, trafoCell, width, height)
    if (!placement) return insertWarnOverlay(graph, trafoCell, label)
    if (!placement.relative) {
        const overlayId = `${WARN_OVERLAY_PREFIX}trafo2`
        const overlay = mountInSiteWarnOverlay(graph, overlayId, label, placement)
        if (overlay && parser) {
            registerInSiteWarnOverlay(graph, parser, {
                id: overlayId,
                label,
                kind: 'trafo2',
                trafoCell,
            })
        }
        return overlay
    }
    return insertWarnOverlay(graph, trafoCell, label)
}

function clearFeederWarnOverlays(graph) {
    const overlay = graph?.view?.getOverlayPane?.()
    if (!overlay?.querySelectorAll) return
    overlay.querySelectorAll(`path[${LG_FEEDER_WARN_OVERLAY_ATTR}]`).forEach((el) => el.remove())
    feederWarnEdgeCells.clear()
}

function getEdgeRenderPoints(graph, edge) {
    graph.view.validate(edge)
    const st = graph.view.getState(edge)
    if (st?.absolutePoints?.length >= 2) return st.absolutePoints
    if (st?.absPoints?.length >= 2) return st.absPoints
    return getEdgeAbsPoints(edge, graph)
}

function rebuildFeederWarnOverlays(graph, visible = true) {
    if (typeof document === 'undefined' || !graph?.view?.getOverlayPane) return 0
    const overlay = graph.view.getOverlayPane()
    if (!overlay) return 0

    overlay.querySelectorAll(`path[${LG_FEEDER_WARN_OVERLAY_ATTR}]`).forEach((el) => el.remove())
    if (!visible || feederWarnEdgeCells.size === 0) return 0

    graph.view.validate()
    const scale = graph.view.scale || 1
    const strokeW = FEEDER_LINE_BLINK_STROKE_WIDTH * scale
    let count = 0

    for (const edge of feederWarnEdgeCells) {
        const pts = getEdgeRenderPoints(graph, edge)
        const d = buildPolylineMotionPathD(pts)
        if (!d) continue
        const path = createSvgEl('path')
        path.setAttribute('d', d)
        path.setAttribute('fill', 'none')
        path.setAttribute('stroke', WARN_HIGHLIGHT_STROKE)
        path.setAttribute('stroke-width', String(strokeW))
        path.setAttribute('stroke-linecap', 'round')
        path.setAttribute('stroke-linejoin', 'round')
        path.setAttribute(LG_FEEDER_WARN_OVERLAY_ATTR, String(edge.id))
        path.setAttribute('pointer-events', 'none')
        path.style.opacity = visible ? '1' : '0.15'
        overlay.appendChild(path)
        count++
    }
    return count
}

function applyFeederWarnOverlayBlinkPhase(graph, on) {
    const overlay = graph?.view?.getOverlayPane?.()
    if (!overlay?.querySelectorAll) return
    overlay.querySelectorAll(`path[${LG_FEEDER_WARN_OVERLAY_ATTR}]`).forEach((path) => {
        path.style.opacity = on ? '1' : '0.12'
    })
}

function clearWarnOverlays(graph) {
    clearInSiteWarnOverlayContext()
    if (!graph || warnOverlayCellIds.size === 0) return
    const model = graph.getModel()
    const cells = Array.from(warnOverlayCellIds)
        .map((id) => model.getCell(id))
        .filter(Boolean)
    if (cells.length) {
        model.beginUpdate()
        try {
            graph.removeCells(cells, false)
        } finally {
            model.endUpdate()
        }
    }
    warnOverlayCellIds.clear()
}

function clearFlowOverlays(graph) {
    clearLgFlowMotionArrows(graph)
    if (!graph || overlayCellIds.size === 0) return
    const model = graph.getModel()
    const cells = Array.from(overlayCellIds)
        .map((id) => model.getCell(id))
        .filter(Boolean)
    if (cells.length) {
        model.beginUpdate()
        try {
            graph.removeCells(cells, false)
        } finally {
            model.endUpdate()
        }
    }
    overlayCellIds.clear()
}

function stopWarnBlink() {
    if (warnBlinkTimer != null) {
        clearInterval(warnBlinkTimer)
        warnBlinkTimer = null
    }
    if (warnBlinkSyncHandler && warnBlinkGraph?.view) {
        warnBlinkGraph.view.removeListener(warnBlinkSyncHandler)
    }
    warnBlinkSyncHandler = null
    warnBlinkGraph = null
}

/** SVG symbol 图元内嵌固定描边色，改 cell 样式无效，直接切换 shape SVG 颜色实现本体闪烁 */
function usesShapeTintBlink(graph, cell) {
    const model = graph.getModel()
    if (model.isEdge(cell)) return false
    if (DeviceCategoryUtil?.isBusCell?.(cell)) return false
    return true
}

function getShapeTintElements(node) {
    if (!node || typeof node.querySelectorAll !== 'function') return []
    return Array.from(node.querySelectorAll(SHAPE_TINT_SELECTOR))
}

function applyShapeOpacityBlink(graph, cell, on) {
    const state = graph.view.getState(cell)
    const node = state?.shape?.node
    if (!node?.style) return false
    node.style.opacity = on ? '1' : '0.25'
    return true
}

function restoreShapeOpacity(graph, cell) {
    const saved = savedHighlightStyles.get(cell.id)
    const state = graph.view.getState(cell)
    const node = state?.shape?.node
    if (!node?.style) return
    node.style.opacity = saved?.shapeOpacity || ''
}

function ensureShapeColorTemplate(cellId, elements) {
    const template = elements.map((el) => ({
        stroke: el.getAttribute('stroke'),
        fill: el.getAttribute('fill'),
        strokeWidth: el.getAttribute('stroke-width'),
    }))
    warnShapeColorTemplates.set(cellId, template)
    return template
}

function restoreShapeElementStyle(el, orig) {
    if (orig.stroke != null) {
        if (orig.stroke) el.setAttribute('stroke', orig.stroke)
        else el.removeAttribute('stroke')
    }
    if (orig.fill != null) {
        if (orig.fill) el.setAttribute('fill', orig.fill)
        else el.removeAttribute('fill')
    }
    if (orig.strokeWidth != null) {
        if (orig.strokeWidth) el.setAttribute('stroke-width', orig.strokeWidth)
        else el.removeAttribute('stroke-width')
    }
}

function applyShapeWarnTint(graph, cell, on, strokeOnly = false, thickStroke = false) {
    const state = graph.view.getState(cell)
    const elements = getShapeTintElements(state?.shape?.node)
    if (!elements.length) return

    const cellId = String(cell.id)
    let template = warnShapeColorTemplates.get(cellId)
    if (!template || template.length !== elements.length) {
        template = ensureShapeColorTemplate(cellId, elements)
    }

    elements.forEach((el, index) => {
        const orig = template[index]
        if (!orig) return
        if (on) {
            if (orig.stroke && orig.stroke !== 'none') {
                el.setAttribute('stroke', WARN_HIGHLIGHT_STROKE)
                const w = parseFloat(orig.strokeWidth)
                if (thickStroke) {
                    if (!Number.isNaN(w) && w > 0) {
                        el.setAttribute('stroke-width', String(Math.max(w * 2, w + 1.5, 3)))
                    } else {
                        el.setAttribute('stroke-width', String(HIGHLIGHT_STROKE_WIDTH))
                    }
                } else if (!Number.isNaN(w) && w > 0) {
                    el.setAttribute('stroke-width', String(Math.max(w * 1.6, w + 0.4)))
                }
            }
            if (!strokeOnly && orig.fill && orig.fill !== 'none') {
                el.setAttribute('fill', WARN_HIGHLIGHT_STROKE)
            }
        } else {
            restoreShapeElementStyle(el, orig)
        }
    })
}

function clearShapeWarnTints(graph) {
    for (const cell of highlightedCells) {
        const saved = savedHighlightStyles.get(cell.id)
        if (saved?.useShapeTint) {
            applyShapeWarnTint(graph, cell, false, saved.strokeOnlyTint, saved.thickStrokeTint)
        }
        if (saved?.useShapeOpacity) {
            restoreShapeOpacity(graph, cell)
        }
    }
    warnShapeColorTemplates.clear()
}

function installWarnBlinkSync(graph) {
    if (warnBlinkSyncHandler || !graph?.view || typeof mxEvent === 'undefined') return
    warnBlinkSyncHandler = () => {
        if (warnBlinkGraph && highlightedCells.size > 0) {
            rebuildFeederWarnOverlays(warnBlinkGraph, warnBlinkPhaseOn)
            applyWarnBlinkPhase(warnBlinkGraph, warnBlinkPhaseOn)
        }
        scheduleInSiteWarnOverlayRefresh(warnBlinkGraph)
    }
    graph.view.addListener(mxEvent.SCALE, warnBlinkSyncHandler)
    graph.view.addListener(mxEvent.TRANSLATE, warnBlinkSyncHandler)
    graph.view.addListener(mxEvent.SCALE_AND_TRANSLATE, warnBlinkSyncHandler)
    graph.addListener('cssTransformChanged', warnBlinkSyncHandler)
    graph.addListener(mxEvent.SIZE, warnBlinkSyncHandler)
}

function restoreHighlightedCellStyles(graph, cell) {
    const saved = savedHighlightStyles.get(cell.id)
    if (!saved) return
    if (saved.strokeColor != null) {
        graph.setCellStyles('strokeColor', saved.strokeColor, [cell])
    } else {
        graph.setCellStyles('strokeColor', null, [cell])
    }
    if (saved.strokeWidth != null) {
        graph.setCellStyles('strokeWidth', saved.strokeWidth, [cell])
    } else {
        graph.setCellStyles('strokeWidth', null, [cell])
    }
    if (saved.fillColor != null) {
        graph.setCellStyles('fillColor', saved.fillColor, [cell])
    } else if (saved.isBus) {
        graph.setCellStyles('fillColor', null, [cell])
    }
}

function applyWarnBlinkPhase(graph, on) {
    warnBlinkPhaseOn = on
    let needInvalidate = false
    let hasFeederOverlay = false
    for (const cell of highlightedCells) {
        const saved = savedHighlightStyles.get(cell.id)
        if (saved?.feederOverlayBlink) {
            hasFeederOverlay = true
            continue
        }
        if (saved?.useShapeTint) {
            applyShapeWarnTint(graph, cell, on, saved.strokeOnlyTint, saved.thickStrokeTint)
            continue
        }
        if (saved?.useShapeOpacity) {
            applyShapeOpacityBlink(graph, cell, on)
            continue
        }
        needInvalidate = true
        if (on) {
            graph.setCellStyles('strokeColor', WARN_HIGHLIGHT_STROKE, [cell])
            graph.setCellStyles(
                'strokeWidth',
                saved?.feederEdgeBlink ? FEEDER_LINE_BLINK_STROKE_WIDTH : HIGHLIGHT_STROKE_WIDTH,
                [cell],
            )
            if (saved?.isBus) {
                graph.setCellStyles('fillColor', WARN_HIGHLIGHT_STROKE, [cell])
            }
        } else {
            restoreHighlightedCellStyles(graph, cell)
        }
    }
    if (hasFeederOverlay) {
        applyFeederWarnOverlayBlinkPhase(graph, on)
    }
    if (needInvalidate) {
        graph.view.invalidate()
    }
}

function startWarnBlink(graph) {
    stopWarnBlink()
    if (!graph || highlightedCells.size === 0) return

    warnBlinkGraph = graph
    installWarnBlinkSync(graph)
    warnBlinkPhaseOn = true
    rebuildFeederWarnOverlays(graph, true)
    applyWarnBlinkPhase(graph, true)

    warnBlinkTimer = setInterval(() => {
        if (!warnBlinkGraph || highlightedCells.size === 0) {
            stopWarnBlink()
            return
        }
        warnBlinkPhaseOn = !warnBlinkPhaseOn
        applyWarnBlinkPhase(warnBlinkGraph, warnBlinkPhaseOn)
    }, BLINK_INTERVAL_MS)
}

function clearOverLimitHighlight(graph) {
    stopWarnBlink()
    clearShapeWarnTints(graph)
    clearFeederWarnOverlays(graph)
    clearWarnOverlays(graph)
    if (!graph || highlightedCells.size === 0) {
        overLimitHighlightOn = false
        return
    }
    for (const cell of highlightedCells) {
        restoreHighlightedCellStyles(graph, cell)
    }
    highlightedCells.clear()
    savedHighlightStyles.clear()
    overLimitHighlightOn = false
    graph.view.invalidate()
}

function isOverLimitRecord(record) {
    if (!record) return false
    if (record.loading_percent != null && Number(record.loading_percent) >= LOADING_WARN_PERCENT) {
        return true
    }
    if (record.vm_pu != null) {
        const vm = Number(record.vm_pu)
        return vm < VM_LOW_LIMIT || vm > VM_HIGH_LIMIT
    }
    return false
}

function buildOverLimitOverlayLabel(record) {
    if (!record) return ''
    if (record.loading_percent != null && Number(record.loading_percent) >= LOADING_WARN_PERCENT) {
        return `负载率:${formatNumber(Math.abs(Number(record.loading_percent)), 1)}%`
    }
    if (record.vm_pu != null) {
        const vm = Number(record.vm_pu)
        if (vm < VM_LOW_LIMIT || vm > VM_HIGH_LIMIT) {
            return `电压:${formatNumber(vm, 3)}pu`
        }
    }
    return ''
}

function buildForcedLoadingOverlayLabel(record) {
    if (record?.loading_percent == null || record.loading_percent === '') return ''
    return `负载率:${formatNumber(Math.abs(Number(record.loading_percent)), 1)}%`
}

function ensureForcedLoadingPercent(record, demoPercent, alwaysUseDemo = false) {
    const base = record && typeof record === 'object' ? { ...record } : {}
    if (alwaysUseDemo) {
        base.loading_percent = demoPercent
        return base
    }
    const loading = Number(base.loading_percent)
    if (!Number.isFinite(loading) || loading < LOADING_WARN_PERCENT) {
        base.loading_percent = demoPercent
    }
    return base
}

function isInSiteTrafo2Cell(cell, graph, parser) {
    const pm = getCellPropMap(cell, parser)
    const psrType = pm?.['cge:PSR_Ref']?.PSRType || getCellShapeInfo(cell, graph).psrtype
    const isTrafo = psrType === '0304' || isLgInSiteMainTransformerDevice(cell, graph, parser)
    if (!isTrafo) return false
    return extractInSiteTrafoNum(getInSiteTrafoLabelText(cell, parser)) === 2
}

function getInSiteFuxinNameText(cell, parser) {
    const pm = getCellPropMap(cell, parser)
    const psr = pm?.['cge:PSR_Ref'] || {}
    return `${cell.name || ''}${cell.feederKeyName || ''}${psr.ObjectName || ''}${psr.key_name || ''}`
}

function isInSiteFuxinName(text) {
    return /府馨线/.test(String(text || ''))
}

/** 府馨线：ACLineEnd 出线端，或 G 文件 EnergyConsumer「府馨线负荷」 */
function isInSiteFuxinFeederDevice(cell, graph, parser) {
    if (!cell?.id || graph?.getModel?.()?.isEdge?.(cell)) return false
    const nameText = getInSiteFuxinNameText(cell, parser)
    if (!isInSiteFuxinName(nameText)) return false
    if (cell.lgInSiteFeeder) return true
    const { shape, psrtype } = getCellShapeInfo(cell, graph)
    return isLgLoadShapeOrPsr(shape, psrtype) || psrtype === '0302'
}

function collectInSiteFuxinFeederHighlightCells(cells, graph, parser) {
    const out = []
    const seen = new Set()

    for (const cell of cells) {
        if (!cell?.id || seen.has(cell.id) || shouldSkipFlowOverlayCell(cell)) continue
        if (!isInSiteFuxinFeederDevice(cell, graph, parser)) continue
        out.push(cell)
        seen.add(cell.id)
    }

    if (!out.length) return out

    const anchor = out[0]
    const edges = graph.getEdges?.(anchor) || []
    for (const edge of edges) {
        if (!edge?.id || seen.has(edge.id) || shouldSkipFlowOverlayCell(edge)) continue
        out.push(edge)
        seen.add(edge.id)
    }

    return out
}

function findInSiteFuxinColumnAnchorCell(parser) {
    if (!parser?.widgetMap) return null
    for (const cell of parser.widgetMap.values()) {
        if (!DeviceCategoryUtil?.isTextCell?.(cell)) continue
        const t = String(cell.value ?? cell.name ?? '')
            .replace(/\n/g, '')
            .trim()
        if (t === '府馨1' || t === '府馨线' || /^府馨\d+$/.test(t)) return cell
    }
    return null
}

function resolveInSiteFuxinLoadCell(cells, graph, parser) {
    for (const cell of cells) {
        if (!cell?.id || shouldSkipFlowOverlayCell(cell)) continue
        if (isInSiteFuxinFeederDevice(cell, graph, parser)) return cell
    }
    if (!parser?.attrMap || !graph?.getModel) return null
    const model = graph.getModel()
    for (const [idStr, pm] of parser.attrMap) {
        const psr = pm?.['cge:PSR_Ref'] || {}
        const nameText = `${psr.key_name || ''}${psr.ObjectName || ''}`
        if (!isInSiteFuxinName(nameText)) continue
        if (String(psr.PSRType || '') !== '0302') continue
        const cell = model.getCell(idStr)
        if (cell && !shouldSkipFlowOverlayCell(cell)) return cell
    }
    return null
}

function getCellCenterX(cell, graph) {
    graph.view.validate(cell)
    const st = graph.view.getState(cell)
    if (st && Number.isFinite(st.x) && Number.isFinite(st.width)) {
        return st.x + st.width / 2
    }
    const g = cell?.geometry
    if (!g) return null
    return g.x + g.width / 2
}

function getEdgeAbsPoints(cell, graph) {
    graph.view.validate(cell)
    const st = graph.view.getState(cell)
    if (st?.absPoints?.length) return st.absPoints
    const geo = cell?.geometry
    if (!geo) return []
    const pts = []
    if (geo.sourcePoint) pts.push(geo.sourcePoint)
    if (geo.points) pts.push(...geo.points)
    if (geo.targetPoint) pts.push(geo.targetPoint)
    return pts
}

/** 府馨线列 x 容差（过大会误匹配府东/府河等邻列） */
const IN_SITE_FUXIN_COLUMN_TOL = 28

function isInSiteOtherFeederAnchorText(text) {
    const t = String(text || '').replace(/\n/g, '').trim()
    if (!t || /府馨/.test(t)) return false
    return t === '府东线' || t === '府河线' || /^府东\d+$/.test(t) || /^府河\d+$/.test(t)
}

function collectInSiteOtherFeederColumnXs(graph, parser) {
    const xs = []
    const seen = new Set()
    const pushX = (x) => {
        if (x == null || !Number.isFinite(x)) return
        const key = Math.round(x)
        if (seen.has(key)) return
        seen.add(key)
        xs.push(x)
    }

    if (parser?.widgetMap) {
        for (const cell of parser.widgetMap.values()) {
            if (!DeviceCategoryUtil?.isTextCell?.(cell)) continue
            const t = String(cell.value ?? cell.name ?? '')
            if (!isInSiteOtherFeederAnchorText(t)) continue
            pushX(getCellCenterX(cell, graph))
        }
    }

    if (parser?.attrMap && graph?.getModel) {
        const model = graph.getModel()
        for (const [idStr, pm] of parser.attrMap) {
            const psr = pm?.['cge:PSR_Ref'] || {}
            const nameText = `${psr.key_name || ''}${psr.ObjectName || ''}`
            if (!/府东|府河/.test(nameText) || /府馨/.test(nameText)) continue
            const cell = model.getCell(idStr)
            if (!cell) continue
            pushX(getCellCenterX(cell, graph))
        }
    }

    return xs
}

function edgeBelongsToInSiteFuxinColumn(edge, graph, fuxinX, anchorY, otherColumnXs, tol = IN_SITE_FUXIN_COLUMN_TOL) {
    if (fuxinX == null || !Number.isFinite(fuxinX)) return false
    const pts = getEdgeAbsPoints(edge, graph)
    if (pts.length < 2) return false

    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    const xSpread = Math.max(...xs) - Math.min(...xs)
    const ySpread = Math.max(...ys) - Math.min(...ys)
    if (xSpread > tol * 2.2 && ySpread < 10) return false

    const onFuxin = pts.filter((p) => Math.abs(p.x - fuxinX) <= tol)
    if (!onFuxin.length) return false

    if (Number.isFinite(anchorY)) {
        // 府馨1 在下口区：收窄 y，避免误匹配上口府东列（y≈210）
        const yMin = anchorY - 150
        const yMax = anchorY + 85
        if (!onFuxin.some((p) => p.y >= yMin && p.y <= yMax)) return false
    }

    const avgX = onFuxin.reduce((sum, p) => sum + p.x, 0) / onFuxin.length
    for (const ox of otherColumnXs) {
        if (Math.abs(avgX - ox) <= Math.abs(avgX - fuxinX)) return false
    }

    return true
}

function getCellCenterY(cell, graph) {
    graph.view.validate(cell)
    const st = graph.view.getState(cell)
    if (st && Number.isFinite(st.y) && Number.isFinite(st.height)) {
        return st.y + st.height / 2
    }
    const g = cell?.geometry
    if (!g) return null
    return g.y + g.height / 2
}

function resolveInSiteFuxinColumnAnchor(cells, graph, parser) {
    const anchorCell = findInSiteFuxinColumnAnchorCell(parser)
    let anchorX = anchorCell ? getCellCenterX(anchorCell, graph) : null
    let anchorY = anchorCell ? getCellCenterY(anchorCell, graph) : null

    if (anchorX == null) {
        const loadCell = resolveInSiteFuxinLoadCell(cells, graph, parser)
        if (loadCell) {
            anchorX = getCellCenterX(loadCell, graph)
            anchorY = getCellCenterY(loadCell, graph)
        }
    }

    if (anchorX == null && parser?.attrMap && graph?.getModel) {
        const model = graph.getModel()
        for (const [idStr, pm] of parser.attrMap) {
            const psr = pm?.['cge:PSR_Ref'] || {}
            const nameText = `${psr.ObjectName || ''}${psr.key_name || ''}`
            if (!isInSiteFuxinName(nameText)) continue
            const cell = model.getCell(idStr)
            if (!cell) continue
            anchorX = getCellCenterX(cell, graph)
            anchorY = getCellCenterY(cell, graph)
            if (anchorX != null) break
        }
    }

    if (anchorX == null) return null
    return { anchorX, anchorY }
}

/** 府馨线：仅匹配府馨列 ConnectLine，排除府东/府河邻列 */
function collectInSiteFuxinFeederLineCells(cells, graph, parser) {
    const anchor = resolveInSiteFuxinColumnAnchor(cells, graph, parser)
    if (!anchor) return collectInSiteFuxinFeederLineCellsByKnownIds(graph, parser)

    const { anchorX, anchorY } = anchor
    const otherColumnXs = collectInSiteOtherFeederColumnXs(graph, parser)
    const model = graph.getModel()
    const edges = []
    const seen = new Set()

    for (const cell of cells) {
        if (!cell?.id || seen.has(cell.id) || !model.isEdge(cell)) continue
        if (shouldSkipFlowOverlayCell(cell)) continue
        if (!edgeBelongsToInSiteFuxinColumn(cell, graph, anchorX, anchorY, otherColumnXs)) continue
        edges.push(cell)
        seen.add(cell.id)
    }

    if (edges.length) return edges
    return collectInSiteFuxinFeederLineCellsByKnownIds(graph, parser)
}

/** 府城站 G 文件府馨线 ConnectLine id 兜底（不含邻列 34007600 等） */
function collectInSiteFuxinFeederLineCellsByKnownIds(graph, parser) {
    if (!graph?.getModel) return []
    const model = graph.getModel()
    const edges = []
    for (const id of IN_SITE_FUXIN_FALLBACK_LINE_IDS) {
        const cell = model.getCell(id)
        if (!cell || !model.isEdge(cell) || shouldSkipFlowOverlayCell(cell)) continue
        edges.push(cell)
    }
    return edges
}

/** /in-site-svg：标记府馨线线段/名称/负荷可点击，跳转 /graphLg */
export function refreshLgInSiteFuxinFeederClickMarks(graph, parser) {
    if (!isLgInSiteSvgMode() || !graph || !parser) return
    const model = graph.getModel()
    const cells = Object.values(model.cells || {}).filter((c) => c && c.id && c.id !== '0')
    const info = {
        dataset: LG_IN_SITE_FUXIN_FEEDER_DATASET,
        label: LG_IN_SITE_FUXIN_FEEDER_LABEL,
    }

    for (const cell of collectInSiteFuxinFeederLineCells(cells, graph, parser)) {
        markLgInSiteFeederCell(cell, info)
    }
    const labelCell = findInSiteFuxinFeederLineLabelCell(parser)
    if (labelCell) {
        markLgInSiteFeederCell(labelCell, info)
    }
    for (const cell of collectInSiteFuxinFeederHighlightCells(cells, graph, parser)) {
        if (!model.isEdge(cell)) {
            markLgInSiteFeederCell(cell, info)
        }
    }
    refreshLgInSiteFeederCellIndex(graph)
}

/** 从 attrMap 兜底查找 #2主变（G 文件 Transformer3） */
function resolveInSiteTrafo2Cell(cells, graph, parser) {
    for (const cell of cells) {
        if (isInSiteTrafo2Cell(cell, graph, parser)) return cell
    }
    if (!parser?.attrMap || !graph?.getModel) return null
    const model = graph.getModel()
    for (const [idStr, pm] of parser.attrMap) {
        const psr = pm?.['cge:PSR_Ref']
        if (!psr || String(psr.PSRType || '') !== '0304') continue
        const label =
            psr.key_name1 || psr.key_name || psr.key_name2 || psr.key_name3 || psr.ObjectName || ''
        if (extractInSiteTrafoNum(label) !== 2) continue
        const cell = model.getCell(idStr)
        if (cell && !shouldSkipFlowOverlayCell(cell)) return cell
    }
    return null
}

/** 从 attrMap 兜底查找府馨线负荷 / 出线端；优先闪烁馈线线段 */
function resolveInSiteFuxinHighlightCells(cells, graph, parser) {
    const lineCells = collectInSiteFuxinFeederLineCells(cells, graph, parser)
    if (lineCells.length) return lineCells

    const fromCells = collectInSiteFuxinFeederHighlightCells(cells, graph, parser)
    if (fromCells.length) return fromCells

    if (!parser?.attrMap || !graph?.getModel) return []
    const model = graph.getModel()
    for (const [idStr, pm] of parser.attrMap) {
        const psr = pm?.['cge:PSR_Ref'] || {}
        const nameText = `${psr.ObjectName || ''}${psr.key_name || ''}`
        if (!isInSiteFuxinName(nameText)) continue
        const pt = String(psr.PSRType || '')
        if (pt !== '0302' && pt !== '12104104') continue
        const cell = model.getCell(idStr)
        if (!cell || shouldSkipFlowOverlayCell(cell)) continue
        return collectInSiteFuxinFeederHighlightCells([cell, ...cells], graph, parser)
    }
    return []
}

function resolveInSiteTrafo2FlowRecord(cell, graph, parser, indexes) {
    const byName = matchInSiteTrafoByName(cell, graph, parser, indexes)
    if (byName) return byName
    return matchFlowRecord(cell, graph, parser, indexes)
}

function resolveInSiteFuxinFeederFlowRecord(cell, graph, parser, indexes) {
    const byFlow = matchFlowRecord(cell, graph, parser, indexes)
    if (byFlow) return byFlow
    const loadName = normalizeName('府城站.府馨线负荷')
    if (indexes.loadByName?.has(loadName)) {
        return indexes.loadByName.get(loadName)
    }
    return null
}

function collectInSiteFixedOverLimitTargets(cells, graph, parser, indexes) {
    const targets = []
    const seen = new Set()

    const trafo2Cell = resolveInSiteTrafo2Cell(cells, graph, parser)
    if (trafo2Cell?.id && !seen.has(trafo2Cell.id)) {
        const record = ensureForcedLoadingPercent(
            resolveInSiteTrafo2FlowRecord(trafo2Cell, graph, parser, indexes),
            IN_SITE_FIXED_OVERLIMIT_DEMO.trafo2,
        )
        targets.push({ cell: trafo2Cell, record, highlightMode: 'trafo-symbol' })
        seen.add(trafo2Cell.id)
    }

    const fuxinCells = resolveInSiteFuxinHighlightCells(cells, graph, parser)
    if (fuxinCells.length) {
        const record = ensureForcedLoadingPercent(
            resolveInSiteFuxinFeederFlowRecord(fuxinCells[0], graph, parser, indexes),
            IN_SITE_FIXED_OVERLIMIT_DEMO.fuxinFeeder,
            true,
        )
        for (const cell of fuxinCells) {
            if (!cell?.id || seen.has(cell.id)) continue
            targets.push({ cell, record, highlightMode: 'feeder-line' })
            seen.add(cell.id)
        }
    }

    return targets
}

function applyOverLimitTargets(graph, targets, labelBuilder = buildForcedLoadingOverlayLabel, parser = null) {
    const model = graph.getModel()
    let count = 0
    const insertedWarnOverlays = []
    model.beginUpdate()
    try {
        let fuxinOverlayDone = false
        for (const { cell, record, highlightMode } of targets) {
            const highlightOptions = {}
            if (highlightMode === 'trafo-symbol') {
                highlightOptions.isMainTrafo = true
            } else if (highlightMode === 'feeder-line') {
                highlightOptions.isFeederLine = true
            }
            applyHighlight(graph, cell, highlightOptions)
            const label = labelBuilder(record)
            if (label) {
                if (highlightMode === 'feeder-line') {
                    if (!fuxinOverlayDone) {
                        const overlay =
                            parser && isLgInSiteSvgMode()
                                ? insertInSiteFuxinFeederWarnOverlay(graph, parser, label, cell)
                                : insertWarnOverlay(graph, cell, label)
                        if (overlay) insertedWarnOverlays.push(overlay)
                        fuxinOverlayDone = true
                    }
                } else if (highlightMode === 'trafo-symbol') {
                    const overlay =
                        parser && isLgInSiteSvgMode()
                            ? insertInSiteTrafoWarnOverlay(graph, parser, label, cell)
                            : insertWarnOverlay(graph, cell, label)
                    if (overlay) insertedWarnOverlays.push(overlay)
                } else {
                    const overlay = insertWarnOverlay(graph, cell, label)
                    if (overlay) insertedWarnOverlays.push(overlay)
                }
            }
            count++
        }
        if (insertedWarnOverlays.length) {
            graph.orderCells(false, insertedWarnOverlays)
        }
    } finally {
        model.endUpdate()
    }
    return count
}

/** 多次调度，避免 G 文件解析/视图尚未就绪 */
export function scheduleLgInSiteFixedOverLimitHighlight(ui, parserHint, flowDataUrl) {
    if (!isLgInSiteSvgMode()) return
    for (const delay of [800, 1600, 2800, 4500, 7000]) {
        window.setTimeout(() => {
            applyLgInSiteFixedOverLimitHighlight(ui, flowDataUrl, 0, parserHint)
        }, delay)
    }
}

/** /in-site-svg：#2主变、府馨线固定红色闪烁并展示负载率 */
export function applyLgInSiteFixedOverLimitHighlight(ui, flowDataUrl, retry = 0, parserHint) {
    if (!isLgInSiteSvgMode()) return Promise.resolve(0)

    const graph = ui?.editor?.graph
    const parser = ui?.svgParser || parserHint
    if (!graph || !parser) {
        if (retry < 3) {
            return new Promise((resolve) => {
                window.setTimeout(() => {
                    applyLgInSiteFixedOverLimitHighlight(ui, flowDataUrl, retry + 1, parserHint).then(resolve)
                }, 400)
            })
        }
        return Promise.resolve(0)
    }

    return loadFlowData(flowDataUrl || getFlowDataUrl())
        .catch((e) => {
            console.warn('[lgRegionSimulation] 潮流数据不可用，固定越限演示仍继续', e)
            return null
        })
        .then((data) => {
            const wasEnabled = graph.isEnabled()
            if (!wasEnabled) {
                graph.setEnabled(true)
            }

            try {
                const indexes = buildFlowIndexes(data || {})
                const model = graph.getModel()
                const cells = Object.values(model.cells || {}).filter((c) => c && c.id && c.id !== '0')

                clearOverLimitHighlight(graph)
                graph.view.validate()
                refreshLgInSiteFuxinFeederClickMarks(graph, parser)

                const targets = collectInSiteFixedOverLimitTargets(cells, graph, parser, indexes)
                const count = applyOverLimitTargets(graph, targets, buildForcedLoadingOverlayLabel, parser)

                overLimitHighlightOn = count > 0
                if (count > 0) {
                    startWarnBlink(graph)
                    rebuildFeederWarnOverlays(graph, warnBlinkPhaseOn)
                    rebuildInSiteWarnOverlays(graph)
                    graph.view.invalidate()
                } else if (retry < 5) {
                    return new Promise((resolve) => {
                        window.setTimeout(() => {
                            applyLgInSiteFixedOverLimitHighlight(ui, flowDataUrl, retry + 1, parserHint).then(resolve)
                        }, 600)
                    })
                }
                return count
            } finally {
                if (!wasEnabled && !isLgInSiteSvgMode()) {
                    graph.setEnabled(false)
                }
            }
        })
        .catch((e) => {
            console.error('[lgRegionSimulation] /in-site-svg 固定越限高亮失败', e)
            return 0
        })
}

function applyHighlight(graph, cell, options = {}) {
    if (!cell || highlightedCells.has(cell)) return

    graph.view.validate(cell)
    const st = graph.getCurrentCellStyle(cell) || {}
    const state = graph.view.getState(cell)
    const shapeNode = state?.shape?.node
    const shapeElements = getShapeTintElements(shapeNode)

    const saved = {
        strokeColor: st.strokeColor,
        strokeWidth: st.strokeWidth,
        fillColor: st.fillColor,
        isBus: DeviceCategoryUtil?.isBusCell?.(cell),
        useShapeTint: false,
        strokeOnlyTint: false,
        thickStrokeTint: false,
        useShapeOpacity: false,
        shapeOpacity: shapeNode?.style?.opacity || '',
    }

    if (options.isFeederLine) {
        const model = graph.getModel()
        if (model.isEdge(cell)) {
            saved.feederOverlayBlink = true
            savedHighlightStyles.set(cell.id, saved)
            highlightedCells.add(cell)
            feederWarnEdgeCells.add(cell)
            return
        }
    }

    if (options.isMainTrafo || options.isFeederLine) {
        const hasTintableStroke =
            shapeElements.length > 0 &&
            shapeElements.some((el) => {
                const s = el.getAttribute('stroke')
                return s && s !== 'none'
            })
        if (hasTintableStroke) {
            saved.useShapeTint = true
            saved.strokeOnlyTint = true
            saved.thickStrokeTint = !!options.isFeederLine
        } else if (shapeNode?.style) {
            saved.useShapeOpacity = true
        }
        savedHighlightStyles.set(cell.id, saved)
        highlightedCells.add(cell)
        if (saved.useShapeTint) {
            applyShapeWarnTint(graph, cell, true, true)
        }
        if (!saved.useShapeTint && !saved.useShapeOpacity) {
            graph.setCellStyles('strokeColor', WARN_HIGHLIGHT_STROKE, [cell])
            graph.setCellStyles('strokeWidth', HIGHLIGHT_STROKE_WIDTH, [cell])
        }
        return
    }

    saved.useShapeTint = usesShapeTintBlink(graph, cell) && shapeElements.length > 0
    savedHighlightStyles.set(cell.id, saved)
    highlightedCells.add(cell)

    if (!saved.useShapeTint) {
        graph.setCellStyles('strokeColor', WARN_HIGHLIGHT_STROKE, [cell])
        graph.setCellStyles('strokeWidth', HIGHLIGHT_STROKE_WIDTH, [cell])
        if (saved.isBus) {
            graph.setCellStyles('fillColor', WARN_HIGHLIGHT_STROKE, [cell])
        }
    }
}

export async function applyLgPowerFlowOverlay(ui, flowDataUrl) {
    const graph = ui?.editor?.graph
    const parser = ui?.svgParser
    if (!graph || !parser) {
        ElMessage.warning('图形尚未加载完成')
        return
    }

    const wasEnabled = graph.isEnabled()
    if (!wasEnabled) {
        graph.setEnabled(true)
    }

    try {
        const data = await loadFlowData(flowDataUrl)
        const indexes = buildPowerFlowIndexes(data)
        const model = graph.getModel()
        const cells = Object.values(model.cells || {}).filter((c) => c && c.id && c.id !== '0')

        clearFlowOverlays(graph)
        graph.view.validate()

        let matched = 0
        const flowLineItems = []
        const insertedOverlays = []
        model.beginUpdate()
        try {
            for (const cell of cells) {
                if (shouldSkipFlowOverlayCell(cell)) continue

                const category = getFlowOverlayDeviceCategory(cell, graph)
                if (!category || category === 'switch') continue
                if (isLgInSiteSvgMode() && category === 'line') continue

                const record = matchFlowRecord(cell, graph, parser, indexes)
                if (category === 'line' && record && lineHasFlow(record)) {
                    flowLineItems.push({ edge: cell, record })
                }

                const label = buildFlowOverlayLabel(cell, graph, parser, record, indexes)
                if (!label) continue

                const { width, height } = getOverlaySize(label, OVERLAY_FONT_SIZE, OVERLAY_LINE_HEIGHT)
                const placement = createFlowOverlayPlacement(graph, cell, width, height, { category })
                const overlayId = `${OVERLAY_PREFIX}${cell.id}`
                const style = buildFlowOverlayStyle()
                const displayLabel = formatFlowOverlayHtml(label)

                let overlay
                if (placement.relative) {
                    overlay = graph.insertVertex(
                        placement.parent,
                        overlayId,
                        displayLabel,
                        placement.geo.x,
                        placement.geo.y,
                        width,
                        height,
                        style,
                        true,
                    )
                    model.setGeometry(overlay, placement.geo)
                } else {
                    overlay = graph.insertVertex(
                        placement.parent,
                        overlayId,
                        displayLabel,
                        placement.x,
                        placement.y,
                        width,
                        height,
                        style,
                    )
                }
                overlay.setConnectable(false)
                overlay.lgFlowOverlay = true
                overlayCellIds.add(overlayId)
                insertedOverlays.push(overlay)
                matched++
            }

            if (insertedOverlays.length) {
                graph.orderCells(false, insertedOverlays)
            }
        } finally {
            model.endUpdate()
        }

        graph.view.invalidate()
        if (flowLineItems.length) {
            storeLgFlowMotionContext(graph, flowLineItems, parser, indexes)
        }
        ElMessage.success(`潮流数据已上图，匹配 ${matched} 处${flowLineItems.length ? `，${flowLineItems.length} 条线路显示潮流箭头` : ''}`)
    } catch (e) {
        console.error('[lgRegionSimulation] 潮流数据上图失败', e)
        ElMessage.error('潮流数据加载失败: ' + (e.message || e))
    } finally {
        if (!wasEnabled) {
            graph.setEnabled(false)
        }
    }
}

export function toggleLgOverLimitHighlight(ui, flowDataUrl) {
    const graph = ui?.editor?.graph
    const parser = ui?.svgParser
    if (!graph || !parser) {
        ElMessage.warning('图形尚未加载完成')
        return
    }

    if (overLimitHighlightOn) {
        clearOverLimitHighlight(graph)
        graph.view.invalidate()
        ElMessage.info('已取消越限设备高亮')
        return
    }

    loadFlowData(flowDataUrl)
        .then((data) => {
            const wasEnabled = graph.isEnabled()
            if (!wasEnabled) {
                graph.setEnabled(true)
            }

            try {
                const indexes = buildOverLimitFlowIndexes(data)
                const model = graph.getModel()
                const cells = Object.values(model.cells || {}).filter((c) => c && c.id && c.id !== '0')

                clearOverLimitHighlight(graph)

                graph.view.validate()

                let count = 0
                const targets = []
                for (const cell of cells) {
                    if (shouldSkipFlowOverlayCell(cell)) {
                        continue
                    }
                    const record = matchFlowRecord(cell, graph, parser, indexes)
                    if (!shouldHighlightOverLimitCell(cell, graph, parser, record)) continue
                    targets.push({ cell, record })
                }
                count = applyOverLimitTargets(graph, targets, buildOverLimitOverlayLabel)

                overLimitHighlightOn = count > 0
                if (count > 0) {
                    startWarnBlink(graph)
                    ElMessage.success(`已红色闪烁高亮 ${count} 个越限设备（负载率≥${LOADING_WARN_PERCENT}% 或电压越限）`)
                } else {
                    ElMessage.info(`未发现越限设备（负载率≥${LOADING_WARN_PERCENT}% 或电压越限）`)
                }
            } finally {
                if (!wasEnabled) {
                    graph.setEnabled(false)
                }
            }
        })
        .catch((e) => {
            console.error('[lgRegionSimulation] 越限设备高亮失败', e)
            ElMessage.error('潮流数据加载失败: ' + (e.message || e))
        })
}

function installLgRegionSimulationActions(actions) {
    if (!isLgSimulationMenuEnabled()) return

    const ui = actions.editorUi
    const flowDataUrl = getFlowDataUrl()

    actions.put(
        'lgSimPowerFlowOverlay',
        new Action('潮流数据上图', function () {
            applyLgPowerFlowOverlay(ui, flowDataUrl)
        })
    )

    if (isLgOverLimitHighlightEnabled()) {
        const highlightAction = actions.put(
            'lgSimOverLimitHighlight',
            new Action('越限设备高亮', function () {
                toggleLgOverLimitHighlight(ui, flowDataUrl)
            })
        )
        highlightAction.setToggleAction(true)
        highlightAction.setSelectedCallback(function () {
            return overLimitHighlightOn
        })
    }
}

function installLgRegionSimulationMenuDefinition() {
    const preMenusInit = Menus.prototype.init
    Menus.prototype.init = function () {
        preMenusInit.apply(this, arguments)

        if (!isLgSimulationMenuEnabled()) return

        this.put(
            'simulation',
            new Menu(
                mxUtils.bind(this, function (menu, parent) {
                    const items = ['lgSimPowerFlowOverlay']
                    if (isLgOverLimitHighlightEnabled()) {
                        items.push('lgSimOverLimitHighlight')
                    }
                    this.addMenuItems(menu, items, parent)
                })
            )
        )
    }
}

function installLgRegionSimulationMenubar() {
    const preCreateMenubar = Menus.prototype.createMenubar
    Menus.prototype.createMenubar = function (container) {
        const baseItems = Menus.prototype.defaultMenuItems
        let appended = false

        if (isLgSimulationMenuEnabled() && baseItems.indexOf('simulation') < 0) {
            Menus.prototype.defaultMenuItems = baseItems.concat(['simulation'])
            appended = true
        }

        try {
            return preCreateMenubar.apply(this, arguments)
        } finally {
            if (appended) {
                Menus.prototype.defaultMenuItems = baseItems
            }
        }
    }
}

let lgRegionSimulationMenuInstalled = false

/** 注册顶部「仿真」菜单（与「主题」同级，/graphLg、/in-site-svg；越限高亮仅 /graphLg） */
export function installLgRegionSimulationMenu() {
    if (lgRegionSimulationMenuInstalled) return
    if (typeof Actions === 'undefined' || typeof Menus === 'undefined' || typeof Action === 'undefined') {
        return
    }

    const preActionsInit = Actions.prototype.init
    Actions.prototype.init = function () {
        preActionsInit.apply(this, arguments)
        installLgRegionSimulationActions(this)
    }

    installLgRegionSimulationMenuDefinition()
    installLgRegionSimulationMenubar()
    lgRegionSimulationMenuInstalled = true
}
