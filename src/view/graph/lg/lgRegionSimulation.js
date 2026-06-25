/**
 * 区域系统图仿真菜单：潮流数据上图、越限设备高亮
 * 潮流匹配：SVG 图元 metadata 中 cge:PSR_Ref.GlobeID ↔ JSON 的 busid/lineid/trafoid
 */
import { ElMessage } from 'element-plus'
import DeviceCategoryUtil from '@/plugins/tmzx/graph/DeviceCategoryUtil.js'
import TextUtil from '@/plugins/tmzx/graph/TextUtil.js'
import {
    isLgLoadShapeOrPsr,
    isLgSwitchShapeOrPsr,
    lgSwitchStatusLabel,
} from '@/view/graph/lg/Constants.js'

const DEFAULT_FLOW_DATA_URL = '/新乡潮流计算结果（府城站）.json'
const OVERLAY_PREFIX = 'lg-flow-overlay-'
const OVERLAY_FONT_SIZE = 9
const OVERLAY_GAP = 2
const LINE_LABEL_GAP = 8
const FLOW_P_EPS = 1e-9
const FLOW_MOTION_DUR_SEC = 5.5
const FLOW_MOTION_ARROW_COLOR = '#00e5ff'
const SVG_NS = 'http://www.w3.org/2000/svg'
const LG_FLOW_MOTION_ATTR = 'data-lg-flow-motion'
const WARN_HIGHLIGHT_STROKE = '#ffcc00'
const HIGHLIGHT_STROKE_WIDTH = 4
const BLINK_INTERVAL_MS = 600
const SHAPE_TINT_SELECTOR = 'path,circle,ellipse,line,rect,polygon,polyline,text'

const VM_LOW_LIMIT = 0.95
const VM_HIGH_LIMIT = 1.05
const LOADING_WARN_PERCENT = 80

let flowDataCache = null
let flowDataUrlCache = ''
const overlayCellIds = new Set()
const highlightedCells = new Set()
const savedHighlightStyles = new Map()
/** @type {Map<string, Array<{stroke: string|null, fill: string|null, strokeWidth: string|null}>>} */
const warnShapeColorTemplates = new Map()
let overLimitHighlightOn = false
let warnBlinkTimer = null
let warnBlinkGraph = null
let warnBlinkPhaseOn = true
let warnBlinkSyncHandler = null
/** @type {{ graph: object, items: Array<{ edge: object, record: object }>, parser: object, indexes: object } | null} */
let lgFlowMotionContext = null
let lgFlowMotionRefreshTimer = null

/** /graphLg、/in-site-svg 显示仿真菜单；/region-system-svg 不显示 */
function isLgSimulationMenuEnabled() {
    return window.__lgSimulationMenuEnabled === true
}

function getFlowDataUrl() {
    return window.__lgRegionFlowDataUrl || DEFAULT_FLOW_DATA_URL
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
    const json = await response.json()
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
    const genById = new Map()
    const genByName = new Map()
    const loadById = new Map()
    const loadByName = new Map()
    const switchById = new Map()
    const switchByName = new Map()
    const recordByGlobeId = new Map()

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
        genById,
        genByName,
        loadById,
        loadByName,
        switchById,
        switchByName,
        recordByGlobeId,
    }
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

    const fromObjectId = extractGlobeIdFromObjectId(cell.id)
    if (fromObjectId && (fromObjectId.length > 12 || /^sbid/i.test(fromObjectId))) {
        push(fromObjectId)
    }

    return ids
}

function getPreferredRecordTypes(cell, graph) {
    const category = getFlowOverlayDeviceCategory(cell, graph)
    if (category === 'line') return ['line', 'bus', 'trafo']
    if (category === 'bus') return ['bus', 'line', 'trafo']
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
    if (model.isEdge(cell)) return 'line'
    if (DeviceCategoryUtil?.isBusCell?.(cell)) return 'bus'
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

/** 线路潮流方向量：loading_percent 正负表示流向；若仅为正幅度则结合 p_from_mw 符号 */
function getLineFlowDirectionValue(record) {
    const lpRaw = record?.loading_percent
    const pRaw = record?.p_from_mw
    const lp = lpRaw != null && !Number.isNaN(Number(lpRaw)) ? Number(lpRaw) : null
    const p = pRaw != null && !Number.isNaN(Number(pRaw)) ? Number(pRaw) : null

    if (lp != null) {
        if (lp < -FLOW_P_EPS) return lp
        if (lp > FLOW_P_EPS) {
            if (p != null && p < -FLOW_P_EPS) return -lp
            if (p != null && p > FLOW_P_EPS) return lp
        }
        return lp
    }
    if (p != null) return p
    return null
}

function lineHasFlow(record) {
    const v = getLineFlowDirectionValue(record)
    if (v == null) return false
    return Math.abs(v) >= FLOW_P_EPS
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

/** 判断线路运动箭头是否应沿 absolutePoints 反向（结合 loading_percent 正负与 from/to 母线端子） */
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
        if (psr.ObjectName) keys.add(normalizeName(psr.ObjectName))
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
    } else if (category === 'switch') {
        maps.push(indexes.switchById, indexes.switchByName)
    } else if (isTrafoOrLoadDevice(cell, graph)) {
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
    const byGlobe = matchFlowRecordByGlobeId(cell, graph, parser, indexes.recordByGlobeId)
    if (byGlobe) return byGlobe

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
    if (!isTrafoOrLoadDevice(cell, graph)) return false
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

function buildFlowOverlayLabel(cell, graph, parser, record, indexes) {
    const category = getFlowOverlayDeviceCategory(cell, graph)
    if (!category) return ''

    const lines = []
    const displayName = getCellDisplayName(cell, parser, record)

    if (category === 'bus') {
        if (!record) return ''
        if (displayName || record.name) lines.push(`名称:${displayName || record.name}`)
        if (record.vn_kv != null) lines.push(`额定电压:${formatNumber(record.vn_kv, 0)}kV`)
        const rms = calcBusRmsVoltage(record)
        if (rms != null) lines.push(`计算电压:${formatNumber(rms, 3)}kV`)
    } else if (category === 'line') {
        if (!record) return ''
        const vn = resolveLineVnKv(record, indexes)
        if (vn != null) lines.push(`电压:${formatNumber(vn, 0)}kV`)
        if (record.i_from_ka != null) lines.push(`电流:${formatNumber(record.i_from_ka, 4)}kA`)
        if (record.p_from_mw != null) lines.push(`有功:${formatNumber(record.p_from_mw)}MW`)
        if (record.q_from_mvar != null) lines.push(`无功:${formatNumber(record.q_from_mvar)}MVar`)
        if (record.loading_percent != null) lines.push(`负载:${formatNumber(record.loading_percent, 1)}%`)
    } else if (category === 'gen') {
        if (!record) return ''
        if (displayName || record.name) lines.push(`名称:${displayName || record.name}`)
        if (record.p_mw != null) lines.push(`有功:${formatNumber(record.p_mw)}MW`)
        if (record.q_mvar != null) lines.push(`无功:${formatNumber(record.q_mvar)}MVar`)
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

function getOverlaySize(label, fontSize = OVERLAY_FONT_SIZE) {
    const lines = String(label || '').split('\n').filter(Boolean)
    if (!lines.length) {
        return { width: 48, height: fontSize + 2 }
    }
    const dim = TextUtil.getTextDimensionFromTxtList(fontSize, lines)
    return {
        width: Math.max(dim.width + 4, 24),
        height: Math.max(dim.height + 2, fontSize + 2),
    }
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

/** 取线路折线最长段中点 + 法向偏移（与 LGSvgParser 线路名称标签一致） */
function getEdgeLabelAnchorInModel(graph, edge) {
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
    const ox = Math.cos(rad) * LINE_LABEL_GAP
    const oy = Math.sin(rad) * LINE_LABEL_GAP

    return { x: mx + ox, y: my + oy }
}

/** 顶点图元：子节点相对定位；线路：模型坐标贴最长段中点 */
function createFlowOverlayPlacement(graph, cell, width, height) {
    const model = graph.getModel()
    const gap = OVERLAY_GAP

    if (!model.isEdge(cell)) {
        const geo = new mxGeometry(0.5, 0, width, height)
        geo.relative = true
        geo.offset = new mxPoint(-width / 2, -height - gap)
        return { parent: cell, geo, relative: true }
    }

    const anchor = getEdgeLabelAnchorInModel(graph, cell)
    if (anchor) {
        return {
            parent: graph.getDefaultParent(),
            x: anchor.x - width / 2,
            y: anchor.y - height / 2,
            width,
            height,
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

function shouldSkipFlowOverlayCell(cell) {
    const id = String(cell.id || '')
    if (id.startsWith(OVERLAY_PREFIX) || cell.lgFlowOverlay) return true
    if (DeviceCategoryUtil?.isTextCell?.(cell)) return true
    if (cell.flag === 'virtualCell' || cell.flag === 'pointline') return true
    return false
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

function applyShapeWarnTint(graph, cell, on) {
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
                if (!Number.isNaN(w) && w > 0) {
                    el.setAttribute('stroke-width', String(Math.max(w * 1.6, w + 0.4)))
                }
            }
            if (orig.fill && orig.fill !== 'none') {
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
            applyShapeWarnTint(graph, cell, false)
        }
    }
    warnShapeColorTemplates.clear()
}

function installWarnBlinkSync(graph) {
    if (warnBlinkSyncHandler || !graph?.view || typeof mxEvent === 'undefined') return
    warnBlinkSyncHandler = () => {
        if (warnBlinkGraph && highlightedCells.size > 0) {
            applyWarnBlinkPhase(warnBlinkGraph, warnBlinkPhaseOn)
        }
    }
    graph.view.addListener(mxEvent.SCALE, warnBlinkSyncHandler)
    graph.view.addListener(mxEvent.TRANSLATE, warnBlinkSyncHandler)
    graph.view.addListener(mxEvent.SCALE_AND_TRANSLATE, warnBlinkSyncHandler)
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
    for (const cell of highlightedCells) {
        const saved = savedHighlightStyles.get(cell.id)
        if (saved?.useShapeTint) {
            applyShapeWarnTint(graph, cell, on)
            continue
        }
        needInvalidate = true
        if (on) {
            graph.setCellStyles('strokeColor', WARN_HIGHLIGHT_STROKE, [cell])
            graph.setCellStyles('strokeWidth', HIGHLIGHT_STROKE_WIDTH, [cell])
            if (saved?.isBus) {
                graph.setCellStyles('fillColor', WARN_HIGHLIGHT_STROKE, [cell])
            }
        } else {
            restoreHighlightedCellStyles(graph, cell)
        }
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

function applyHighlight(graph, cell) {
    if (!cell || highlightedCells.has(cell)) return
    const st = graph.getCurrentCellStyle(cell) || {}
    savedHighlightStyles.set(cell.id, {
        strokeColor: st.strokeColor,
        strokeWidth: st.strokeWidth,
        fillColor: st.fillColor,
        isBus: DeviceCategoryUtil?.isBusCell?.(cell),
        useShapeTint: usesShapeTintBlink(graph, cell),
    })
    highlightedCells.add(cell)
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
        const indexes = buildFlowIndexes(data)
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

                const record = matchFlowRecord(cell, graph, parser, indexes)
                if (category === 'line' && record && lineHasFlow(record)) {
                    flowLineItems.push({ edge: cell, record })
                }

                const label = buildFlowOverlayLabel(cell, graph, parser, record, indexes)
                if (!label) continue

                const { width, height } = getOverlaySize(label)
                const placement = createFlowOverlayPlacement(graph, cell, width, height)
                const overlayId = `${OVERLAY_PREFIX}${cell.id}`
                const style = [
                    'text',
                    'html=0',
                    'strokeColor=none',
                    'fillColor=none',
                    'align=center',
                    'verticalAlign=middle',
                    'fontColor=#00e5ff',
                    `fontSize=${OVERLAY_FONT_SIZE}`,
                    'fontFamily=SimSun',
                    'whiteSpace=wrap',
                    'layer=Text_Layer',
                    'lgFlowOverlay=1',
                ].join(';')

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
                const indexes = buildFlowIndexes(data)
                const model = graph.getModel()
                const cells = Object.values(model.cells || {}).filter((c) => c && c.id && c.id !== '0')

                clearOverLimitHighlight(graph)

                graph.view.validate()

                let count = 0
                for (const cell of cells) {
                    if (String(cell.id).startsWith(OVERLAY_PREFIX) || cell.lgFlowOverlay) {
                        continue
                    }
                    const record = matchFlowRecord(cell, graph, parser, indexes)
                    if (!shouldHighlightOverLimitCell(cell, graph, parser, record)) continue
                    applyHighlight(graph, cell)
                    count++
                }

                overLimitHighlightOn = count > 0
                if (count > 0) {
                    startWarnBlink(graph)
                    ElMessage.success(`已黄色闪烁高亮 ${count} 个越限设备（负载率≥${LOADING_WARN_PERCENT}% 或电压越限）`)
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

function installLgRegionSimulationMenuDefinition() {
    const preMenusInit = Menus.prototype.init
    Menus.prototype.init = function () {
        preMenusInit.apply(this, arguments)

        if (!isLgSimulationMenuEnabled()) return

        this.put(
            'simulation',
            new Menu(
                mxUtils.bind(this, function (menu, parent) {
                    this.addMenuItems(menu, ['lgSimPowerFlowOverlay', 'lgSimOverLimitHighlight'], parent)
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

/** 注册顶部「仿真」菜单（与「主题」同级，仅 /graphLg、/in-site-svg） */
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
