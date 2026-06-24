/**
 * 区域系统图仿真菜单：潮流数据上图、越限设备高亮
 */
import { ElMessage } from 'element-plus'
import DeviceCategoryUtil from '@/plugins/tmzx/graph/DeviceCategoryUtil.js'

const DEFAULT_FLOW_DATA_URL = '/新乡潮流计算结果（府城站）.json'
const OVERLAY_PREFIX = 'lg-flow-overlay-'
const HIGHLIGHT_STROKE = '#ff3b30'
const HIGHLIGHT_STROKE_WIDTH = 4

const VM_LOW_LIMIT = 0.95
const VM_HIGH_LIMIT = 1.05
const LOADING_LIMIT_PERCENT = 100

let flowDataCache = null
let flowDataUrlCache = ''
const overlayCellIds = new Set()
const highlightedCells = new Set()
const savedHighlightStyles = new Map()
let overLimitHighlightOn = false

/** /graphLg、/in-site-svg 显示仿真菜单；/region-system-svg 不显示 */
function isLgSimulationMenuEnabled() {
    return window.__lgSimulationMenuEnabled === true
}

function getFlowDataUrl() {
    return window.__lgRegionFlowDataUrl || DEFAULT_FLOW_DATA_URL
}

function normalizeId(id) {
    return String(id || '').replace(/-/g, '').toLowerCase()
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
    const trafoById = new Map()
    const trafoByName = new Map()

    for (const line of data.res_line || []) {
        if (line.lineid) lineById.set(normalizeId(line.lineid), line)
        if (line.name) lineByName.set(normalizeName(line.name), line)
    }
    for (const bus of data.res_bus || []) {
        if (bus.busid) busById.set(normalizeId(bus.busid), bus)
        if (bus.name) busByName.set(normalizeName(bus.name), bus)
    }
    for (const trafo of data.res_trafo || []) {
        if (trafo.trafoid) trafoById.set(normalizeId(trafo.trafoid), trafo)
        if (trafo.name) trafoByName.set(normalizeName(trafo.name), trafo)
    }

    return { lineById, lineByName, busById, busByName, trafoById, trafoByName }
}

function getCellMatchKeys(cell, parser) {
    const keys = new Set()
    const id = String(cell.id || '')
    if (id) keys.add(normalizeId(id))

    const pm = parser?.attrMap?.get(id)
    const psr = pm?.['cge:PSR_Ref']
    if (psr) {
        ;['GlobeID', 'ObjectID', 'GeoPsrid'].forEach((field) => {
            if (psr[field]) keys.add(normalizeId(psr[field]))
        })
        if (psr.ObjectName) keys.add(normalizeName(psr.ObjectName))
    }

    if (cell.name) keys.add(normalizeName(cell.name))
    if (cell.sbid) keys.add(normalizeId(cell.sbid))

    const val = cell.value
    if (typeof val === 'string' && val.trim()) {
        keys.add(normalizeName(val.split('\n')[0]))
    }

    return keys
}

function matchFlowRecord(cell, graph, parser, indexes) {
    const keys = getCellMatchKeys(cell, parser)
    const model = graph.getModel()
    const tryMaps = []

    if (model.isEdge(cell)) {
        tryMaps.push(indexes.lineById, indexes.lineByName)
    } else if (DeviceCategoryUtil?.isBusCell?.(cell)) {
        tryMaps.push(indexes.busById, indexes.busByName)
    } else {
        const st = graph.getCurrentCellStyle(cell) || {}
        const shape = String(st.shape || cell.symbol || '').toLowerCase()
        if (shape.indexOf('potentialtransformer') === 0) {
            tryMaps.push(indexes.trafoById, indexes.trafoByName)
        }
    }

    for (const map of tryMaps) {
        for (const key of keys) {
            if (map.has(key)) {
                return map.get(key)
            }
        }
    }
    return null
}

function buildFlowLabel(record, graph, cell) {
    if (!record) return ''
    const model = graph.getModel()
    if (model.isEdge(cell) && record.p_from_mw != null) {
        return [
            `P:${formatNumber(record.p_from_mw)}MW`,
            `Q:${formatNumber(record.q_from_mvar)}MVar`,
            `负载:${formatNumber(record.loading_percent, 1)}%`,
        ].join('\n')
    }
    if (record.vm_pu != null && record.p_mw != null && record.q_mvar != null && record.loading_percent == null) {
        return [
            `U:${formatNumber(record.vm_pu, 3)}pu`,
            `P:${formatNumber(record.p_mw)}MW`,
            `Q:${formatNumber(record.q_mvar)}MVar`,
        ].join('\n')
    }
    if (record.loading_percent != null) {
        return [
            `P:${formatNumber(record.p_hv_mw ?? record.p_lv_mw)}MW`,
            `负载:${formatNumber(record.loading_percent, 1)}%`,
        ].join('\n')
    }
    return ''
}

function getOverlayPosition(graph, cell) {
    const geo = graph.getCellGeometry(cell)
    if (!geo) {
        return { x: 0, y: 0, width: 80, height: 36 }
    }
    if (typeof geo.getCenterPoint === 'function') {
        const p = geo.getCenterPoint()
        return { x: p.x - 40, y: p.y - 42, width: 80, height: 36 }
    }
    return {
        x: geo.x + Math.max(0, geo.width / 2 - 40),
        y: geo.y - 42,
        width: 80,
        height: 36,
    }
}

function clearFlowOverlays(graph) {
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

function clearOverLimitHighlight(graph) {
    if (!graph || highlightedCells.size === 0) return
    const cells = Array.from(highlightedCells)
    graph.setCellStyles('strokeColor', null, cells)
    graph.setCellStyles('strokeWidth', null, cells)
    for (const cell of cells) {
        const saved = savedHighlightStyles.get(cell.id)
        if (saved) {
            if (saved.strokeColor != null) graph.setCellStyles('strokeColor', saved.strokeColor, [cell])
            if (saved.strokeWidth != null) graph.setCellStyles('strokeWidth', saved.strokeWidth, [cell])
            if (saved.fillColor != null) graph.setCellStyles('fillColor', saved.fillColor, [cell])
        }
    }
    highlightedCells.clear()
    savedHighlightStyles.clear()
    overLimitHighlightOn = false
}

function isOverLimitRecord(record) {
    if (!record) return false
    if (record.loading_percent != null && Number(record.loading_percent) >= LOADING_LIMIT_PERCENT) {
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
    })
    graph.setCellStyles('strokeColor', HIGHLIGHT_STROKE, [cell])
    graph.setCellStyles('strokeWidth', HIGHLIGHT_STROKE_WIDTH, [cell])
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

        let matched = 0
        model.beginUpdate()
        try {
            const parent = graph.getDefaultParent()
            for (const cell of cells) {
                if (String(cell.id).startsWith(OVERLAY_PREFIX)) continue
                const record = matchFlowRecord(cell, graph, parser, indexes)
                const label = buildFlowLabel(record, graph, cell)
                if (!record || !label) continue

                const pos = getOverlayPosition(graph, cell)
                const overlayId = `${OVERLAY_PREFIX}${cell.id}`
                const style = [
                    'text',
                    'html=0',
                    'strokeColor=none',
                    'fillColor=none',
                    'align=center',
                    'verticalAlign=middle',
                    'fontColor=#00e5ff',
                    'fontSize=10',
                    'fontFamily=SimSun',
                    'lgFlowOverlay=1',
                ].join(';')

                const overlay = graph.insertVertex(parent, overlayId, label, pos.x, pos.y, pos.width, pos.height, style)
                overlay.setConnectable(false)
                overlay.lgFlowOverlay = true
                overlayCellIds.add(overlayId)
                matched++
            }
        } finally {
            model.endUpdate()
        }

        graph.view.invalidate()
        ElMessage.success(`潮流数据已上图，匹配 ${matched} 处`)
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

                let count = 0
                for (const cell of cells) {
                    if (String(cell.id).startsWith(OVERLAY_PREFIX) || cell.lgFlowOverlay) continue
                    const record = matchFlowRecord(cell, graph, parser, indexes)
                    if (!isOverLimitRecord(record)) continue
                    applyHighlight(graph, cell)
                    count++
                }

                overLimitHighlightOn = count > 0
                graph.view.invalidate()
                if (count > 0) {
                    ElMessage.success(`已高亮 ${count} 个越限设备`)
                } else {
                    ElMessage.info('未发现越限设备（负载率≥100% 或电压越限）')
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
