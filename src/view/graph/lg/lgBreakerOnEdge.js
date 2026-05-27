/**
 * 侧栏「站内-断路器(0305)」拖放到连接线上：分割线段并自动接线、对齐旋转。
 */
import TextUtil from '@/plugins/tmzx/graph/TextUtil.js'
import DeviceCategoryUtil from '@/plugins/tmzx/graph/DeviceCategoryUtil.js'
import mathutil from '@/plugins/tmzx/mathutil.js'
import { isLgSwitchShapeOrPsr } from './Constants.js'

/** 拖放到虚线时的命中容差（屏幕像素） */
const LG_BREAKER_DASHED_LINE_HIT_PX = 28
const LG_BREAKER_SOLID_LINE_HIT_PX = 14

/** cbreaker 竖向默认端子（symbol viewBox 0 0 3 3，y=0.08 / 2.92） */
const LG_BREAKER_TERM_TOP = { x: 0.5, y: 0.08 / 3 }
const LG_BREAKER_TERM_BOTTOM = { x: 0.5, y: 2.92 / 3 }

function newLgBreakerObjectId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return 'PD_0305_' + crypto.randomUUID()
    }
    return 'PD_0305_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11)
}

/** mxGraph 须在 cell 上 setId，并同步 model.cells 索引 */
function assignLgBreakerObjectId(model, breaker) {
    const curId = String(
        typeof breaker.getId === 'function' ? breaker.getId() : breaker.id || ''
    )
    if (curId && curId.indexOf('PD_0305_') === 0) {
        return
    }
    const oldId = curId
    const newId = newLgBreakerObjectId()
    if (typeof breaker.setId === 'function') {
        breaker.setId(newId)
    } else {
        breaker.id = newId
    }
    if (model.cells != null) {
        if (oldId && model.cells[oldId] === breaker) {
            delete model.cells[oldId]
        }
        model.cells[newId] = breaker
    }
}

function isLgBreakerCell(graph, cell) {
    if (cell == null || !graph.getModel().isVertex(cell)) {
        return false
    }
    const st = graph.getCurrentCellStyle(cell) || {}
    const shape = (st.shape || cell.symbol || '').toLowerCase()
    const psr =
        cell.psrtype != null && cell.psrtype !== '' ? cell.psrtype : st.psrtype
    return isLgSwitchShapeOrPsr(shape, psr)
}

function edgeLineFlag(edge, graph) {
    const st = graph.getCurrentCellStyle(edge) || {}
    const obj = TextUtil.parseDrawioStyle(edge.style || '')
    return String(edge.flag || st.flag || obj.flag || '')
}

/** 站内虚线连接线（侧栏「虚线连接线」或导入 stroke-dasharray / dashed=1） */
export function isLgDashedConnLine(graph, edge) {
    if (graph == null || edge == null || !graph.getModel().isEdge(edge)) {
        return false
    }
    if (isBusbarConnectorEdge(graph, edge)) {
        return false
    }
    const st = graph.getCurrentCellStyle(edge) || {}
    const obj = TextUtil.parseDrawioStyle(edge.style || '')
    if (
        st.dashed === '1' ||
        st.dashed === 1 ||
        obj.dashed === '1' ||
        obj.dashed === 1
    ) {
        return true
    }
    if (st.dashPattern || obj.dashPattern) {
        return true
    }
    const styleStr = String(edge.style || '')
    return styleStr.indexOf('dashed=1') !== -1 || styleStr.indexOf('dashPattern=') !== -1
}

function isImportedConnLine(edge) {
    const id = edge.id != null ? String(edge.id) : ''
    if (id.indexOf('36000000') !== -1 || id.indexOf('360000') !== -1) {
        return true
    }
    const psr = edge.psrtype != null ? String(edge.psrtype) : ''
    return psr === '360000' || psr === '36000000'
}

function isBusbarConnectorEdge(graph, edge) {
    const model = graph.getModel()
    const isBus = (v) => {
        if (!v) {
            return false
        }
        const st = graph.getCurrentCellStyle(v) || {}
        return (
            v.symbol === 'busbar' ||
            st.psrtype === '0311' ||
            st.flag === 'busbar' ||
            DeviceCategoryUtil.isBusCell(v)
        )
    }
    return isBus(model.getTerminal(edge, true)) && isBus(model.getTerminal(edge, false))
}

/** 是否允许被 0305 断路器分割的站内连接线 */
export function isLgSplittableConnLine(graph, edge) {
    if (graph == null || edge == null || !graph.getModel().isEdge(edge)) {
        return false
    }
    if (DeviceCategoryUtil.isPointLine(edge) || DeviceCategoryUtil.isUselessLine(edge)) {
        return false
    }
    const flag = edgeLineFlag(edge, graph)
    const dashedConn = isLgDashedConnLine(graph, edge)
    if (flag !== 'line' && !isImportedConnLine(edge) && !dashedConn) {
        return false
    }
    if (isBusbarConnectorEdge(graph, edge)) {
        return false
    }
    const geo = graph.getModel().getGeometry(edge)
    if (geo == null) {
        return false
    }
    const model = graph.getModel()
    const hasTerminal =
        model.getTerminal(edge, true) != null || model.getTerminal(edge, false) != null
    const hasPoint = geo.sourcePoint != null || geo.targetPoint != null
    return hasTerminal || hasPoint
}

function absoluteEdgePoints(graph, edge) {
    const st = graph.view.getState(edge)
    if (st != null && st.absolutePoints != null && st.absolutePoints.length >= 2) {
        return st.absolutePoints
    }
    const geo = graph.getModel().getGeometry(edge)
    if (geo == null) {
        return null
    }
    const pts = []
    if (geo.sourcePoint != null) {
        pts.push(geo.sourcePoint)
    }
    if (geo.points != null) {
        for (let i = 0; i < geo.points.length; i++) {
            pts.push(geo.points[i])
        }
    }
    if (geo.targetPoint != null) {
        pts.push(geo.targetPoint)
    }
    return pts.length >= 2 ? pts : null
}

function rotationForLinePoints(pts) {
    const p0 = pts[0]
    const p1 = pts[pts.length - 1]
    const rad = Math.atan2(p1.y - p0.y, p1.x - p0.x)
    const horiz = Math.abs(Math.cos(rad)) > Math.abs(Math.sin(rad))
    return horiz ? 90 : 0
}

function applyEdgeToBreakerTerminal(graph, edge, isSource, term) {
    if (isSource) {
        graph.setCellStyles('exitX', term.x, [edge])
        graph.setCellStyles('exitY', term.y, [edge])
        graph.setCellStyles('exitPerimeter', 0, [edge])
    } else {
        graph.setCellStyles('entryX', term.x, [edge])
        graph.setCellStyles('entryY', term.y, [edge])
        graph.setCellStyles('entryPerimeter', 0, [edge])
    }
}

/** 与断路器相连的一端改用顶点连接，清除几何端点避免线“穿过”断路器 */
function clearTerminalPointAtVertex(graph, edge, isSource) {
    const model = graph.getModel()
    const geo = model.getGeometry(edge)
    if (geo == null) {
        return
    }
    const geo2 = geo.clone()
    if (isSource) {
        geo2.sourcePoint = null
    } else {
        geo2.targetPoint = null
    }
    model.setGeometry(edge, geo2)
}

function updateLgEdgeLockFromTerminals(graph, edge) {
    const model = graph.getModel()
    const src = model.getTerminal(edge, true)
    const tgt = model.getTerminal(edge, false)
    const st = graph.getCurrentCellStyle(edge) || {}
    if (src != null) {
        edge.id_sc = src.id
        edge.exitX_sc = st.exitX
        edge.exitY_sc = st.exitY
    }
    if (tgt != null) {
        edge.id_tc = tgt.id
        edge.entryX_tc = st.entryX
        edge.entryY_tc = st.entryY
    }
}

function breakerTerminalAbs(graph, breaker, term, rotationDeg) {
    const geo = graph.getModel().getGeometry(breaker)
    if (geo == null) {
        return null
    }
    const w = geo.width
    const h = geo.height
    const cx = geo.x + w / 2
    const cy = geo.y + h / 2
    const lx = (term.x - 0.5) * w
    const ly = (term.y - 0.5) * h
    const rad = (Number(rotationDeg) || 0) * (Math.PI / 180)
    return {
        x: cx + lx * Math.cos(rad) - ly * Math.sin(rad),
        y: cy + lx * Math.sin(rad) + ly * Math.cos(rad),
    }
}

function farEndpointFromBreaker(graph, edge, bcx, bcy) {
    const pts = absoluteEdgePoints(graph, edge)
    if (pts == null || pts.length < 2) {
        return null
    }
    const d0 = (pts[0].x - bcx) ** 2 + (pts[0].y - bcy) ** 2
    const d1 = (pts[pts.length - 1].x - bcx) ** 2 + (pts[pts.length - 1].y - bcy) ** 2
    return d0 >= d1 ? pts[0] : pts[pts.length - 1]
}

function pickTerminalsForEdges(graph, breaker, edgeKept, edgeNew, rotation) {
    const terms = { a: { ...LG_BREAKER_TERM_TOP }, b: { ...LG_BREAKER_TERM_BOTTOM } }
    const bState = graph.view.getState(breaker)
    if (bState == null) {
        return { termKept: terms.a, termNew: terms.b }
    }
    const bcx = bState.getCenterX()
    const bcy = bState.getCenterY()
    const pKept = farEndpointFromBreaker(graph, edgeKept, bcx, bcy)
    const pNew = farEndpointFromBreaker(graph, edgeNew, bcx, bcy)
    if (pKept == null || pNew == null) {
        return { termKept: terms.a, termNew: terms.b }
    }
    const absA = breakerTerminalAbs(graph, breaker, terms.a, rotation)
    const absB = breakerTerminalAbs(graph, breaker, terms.b, rotation)
    if (absA == null || absB == null) {
        return { termKept: terms.a, termNew: terms.b }
    }
    const dist = (p, t) => (p.x - t.x) ** 2 + (p.y - t.y) ** 2
    const direct = dist(pKept, absA) + dist(pNew, absB)
    const cross = dist(pKept, absB) + dist(pNew, absA)
    if (direct <= cross) {
        return { termKept: terms.a, termNew: terms.b }
    }
    return { termKept: terms.b, termNew: terms.a }
}

/**
 * splitEdge 后：edgeKept 为 断路器→原终点，edgeNew 为 原起点→断路器（与 mxGraph.splitEdge 一致）
 */
function reconnectSplitEdges(graph, breaker, edgeKept, edgeNew, termKept, termNew) {
    const model = graph.getModel()
    const srcNew = model.getTerminal(edgeNew, true)
    const tgtKept = model.getTerminal(edgeKept, false)

    model.setTerminal(edgeKept, breaker, true)
    if (tgtKept != null) {
        model.setTerminal(edgeKept, tgtKept, false)
    }

    if (srcNew != null) {
        model.setTerminal(edgeNew, srcNew, true)
    }
    model.setTerminal(edgeNew, breaker, false)

    applyEdgeToBreakerTerminal(graph, edgeKept, true, termKept)
    applyEdgeToBreakerTerminal(graph, edgeNew, false, termNew)

    clearTerminalPointAtVertex(graph, edgeKept, true)
    clearTerminalPointAtVertex(graph, edgeNew, false)

    updateLgEdgeLockFromTerminals(graph, edgeKept)
    updateLgEdgeLockFromTerminals(graph, edgeNew)
}

export function alignBreakerAfterSplitEdge(graph, breaker, edgeKept, edgeNew) {
    if (graph == null || breaker == null || edgeKept == null || edgeNew == null) {
        return
    }
    if (!isLgBreakerCell(graph, breaker)) {
        return
    }

    const model = graph.getModel()
    model.beginUpdate()
    try {
        const ptsA = absoluteEdgePoints(graph, edgeKept)
        const ptsB = absoluteEdgePoints(graph, edgeNew)
        let pts = ptsA
        if (ptsB != null && ptsB.length >= 2) {
            if (pts == null) {
                pts = ptsB
            } else {
                pts = pts.slice()
                const last = pts[pts.length - 1]
                const firstB = ptsB[0]
                if (
                    Math.abs(last.x - firstB.x) > 0.5 ||
                    Math.abs(last.y - firstB.y) > 0.5
                ) {
                    pts.push(...ptsB)
                } else {
                    pts.push(...ptsB.slice(1))
                }
            }
        }
        if (pts == null || pts.length < 2) {
            return
        }

        const rotation = rotationForLinePoints(pts)
        graph.setCellStyles('rotation', rotation, [breaker])
        graph.setCellStyles('rotatable', 1, [breaker])
        graph.setCellStyles('resizable', 1, [breaker])

        breaker.symbol = 'cbreaker'
        breaker.psrtype = '0305'

        assignLgBreakerObjectId(model, breaker)

        const { termKept, termNew } = pickTerminalsForEdges(
            graph,
            breaker,
            edgeKept,
            edgeNew,
            rotation
        )

        reconnectSplitEdges(graph, breaker, edgeKept, edgeNew, termKept, termNew)

        graph.view.invalidate(breaker)
        graph.view.invalidate(edgeKept)
        graph.view.invalidate(edgeNew)
        graph.refresh()
    } finally {
        model.endUpdate()
    }
}

function modelPointToAbsolute(graph, mx, my) {
    const scale = graph.view.scale
    const tr = graph.view.translate
    return { x: (mx + tr.x) * scale, y: (my + tr.y) * scale }
}

/** 点到折线的最短距离（屏幕像素） */
function distPxPointToEdge(graph, edge, mx, my) {
    const st = graph.view.getState(edge)
    if (st == null || st.absolutePoints == null || st.absolutePoints.length < 2) {
        return null
    }
    const pt = modelPointToAbsolute(graph, mx, my)
    let min = Infinity
    const pts = st.absolutePoints
    for (let i = 0; i < pts.length - 1; i++) {
        const d = mathutil.distancePointToLine(pt, pts[i], pts[i + 1])
        if (d < min) {
            min = d
        }
    }
    return min
}

function findSplittableEdgeAt(graph, x, y) {
    return graph.getCellAt(x, y, null, null, null, function (st) {
        return graph.getModel().isEdge(st.cell) && isLgSplittableConnLine(graph, st.cell)
    })
}

/**
 * 按与 (mx,my) 的距离查找可分割连接线；虚线使用更大容差（细线难点选）。
 */
function forEachSplittableEdge(graph, fn) {
    const model = graph.getModel()
    const edges = model.filterDescendants(function (cell) {
        return model.isEdge(cell) && isLgSplittableConnLine(graph, cell)
    }, model.getRoot())
    for (let i = 0; i < edges.length; i++) {
        fn(edges[i])
    }
}

function findNearestSplittableEdge(graph, mx, my, opts) {
    const maxDistPx = opts?.maxDistPx ?? LG_BREAKER_SOLID_LINE_HIT_PX
    const preferDashed = opts?.preferDashed !== false

    let bestDashed = null
    let bestDashedD = LG_BREAKER_DASHED_LINE_HIT_PX
    let bestAny = null
    let bestAnyD = maxDistPx

    forEachSplittableEdge(graph, function (cell) {
        const d = distPxPointToEdge(graph, cell, mx, my)
        if (d == null) {
            return
        }
        const dashed = isLgDashedConnLine(graph, cell)
        const limit = dashed ? LG_BREAKER_DASHED_LINE_HIT_PX : maxDistPx
        if (d <= limit && d <= bestAnyD) {
            bestAnyD = d
            bestAny = cell
        }
        if (preferDashed && dashed && d <= LG_BREAKER_DASHED_LINE_HIT_PX && d <= bestDashedD) {
            bestDashedD = d
            bestDashed = cell
        }
    })

    if (preferDashed && bestDashed != null) {
        return bestDashed
    }
    return bestAny
}

/**
 * 断路器已在图中时手动分割（与 mxGraph.splitEdge 拓扑一致：新线 源→断路器，原线 断路器→目标）
 */
function manualLgBreakerSplitOnLine(graph, breaker, edge) {
    const model = graph.getModel()
    const src = model.getTerminal(edge, true)
    const tgt = model.getTerminal(edge, false)
    const parent = model.getParent(edge)
    const style = edge.style

    model.beginUpdate()
    try {
        const edgeNew = graph.insertEdge(parent, null, null, src, breaker, style)
        model.setTerminal(edge, breaker, true)
        if (tgt != null) {
            model.setTerminal(edge, tgt, false)
        }

        const geoEdge = model.getGeometry(edge)
        const geoNew = model.getGeometry(edgeNew)
        if (geoEdge != null && geoNew != null) {
            const geoNew2 = geoNew.clone()
            geoNew2.sourcePoint =
                geoEdge.sourcePoint != null ? geoEdge.sourcePoint.clone() : null
            geoNew2.targetPoint = null
            if (geoEdge.points != null) {
                geoNew2.points = geoEdge.points.map((p) => p.clone())
            }
            model.setGeometry(edgeNew, geoNew2)

            const geoEdge2 = geoEdge.clone()
            geoEdge2.sourcePoint = null
            geoEdge2.points = null
            model.setGeometry(edge, geoEdge2)
        }

        alignBreakerAfterSplitEdge(graph, breaker, edge, edgeNew)
    } finally {
        model.endUpdate()
    }
    return true
}

/** 强制将连接线（含虚线）在断路器处分割为两段并接线 */
export function forceLgBreakerSplitOnLine(graph, breaker, edge) {
    if (
        graph == null ||
        breaker == null ||
        edge == null ||
        !isLgBreakerCell(graph, breaker) ||
        !isLgSplittableConnLine(graph, edge)
    ) {
        return false
    }

    const model = graph.getModel()
    const geo = model.getGeometry(breaker)
    if (geo == null) {
        return false
    }

    const cx = geo.x + geo.width / 2
    const cy = geo.y + geo.height / 2
    const scale = graph.view.scale
    const tr = graph.view.translate
    const tx = (cx + tr.x) * scale
    const ty = (cy + tr.y) * scale

    const edgeCountBefore = (model.getEdges(breaker) || []).length
    const parent = model.getParent(breaker)
    const alreadyOnGraph = parent != null

    if (alreadyOnGraph && edgeCountBefore < 2) {
        try {
            graph.splitEdge(edge, [breaker], null, geo.x, geo.y, tx, ty)
        } catch (e) {
            console.warn('[lgBreakerOnEdge] splitEdge failed, use manual split', e)
        }
        const n = (model.getEdges(breaker) || []).length
        if (n >= 2) {
            return true
        }
        return manualLgBreakerSplitOnLine(graph, breaker, edge)
    }

    graph.splitEdge(edge, [breaker], null, geo.x, geo.y, tx, ty)
    return true
}

/** 断路器已落画布但未正确接线时，强制吸附最近连接线/虚线并分割 */
function tryConnectBreakerToNearbyLine(graph, breaker) {
    if (!isLgBreakerCell(graph, breaker)) {
        return false
    }
    const model = graph.getModel()
    const edges = model.getEdges(breaker) || []
    if (edges.length >= 2) {
        return false
    }

    const geo = model.getGeometry(breaker)
    if (geo == null) {
        return false
    }
    const cx = geo.x + geo.width / 2
    const cy = geo.y + geo.height / 2

    let edge = findNearestSplittableEdge(graph, cx, cy, {
        preferDashed: true,
        maxDistPx: LG_BREAKER_DASHED_LINE_HIT_PX,
    })
    if (edge == null) {
        edge = findSplittableEdgeAt(graph, cx, cy)
    }
    if (edge == null) {
        return false
    }

    return forceLgBreakerSplitOnLine(graph, breaker, edge)
}

let splitTargetPatched = false

export function installLgBreakerEdgeDrop(graph) {
    if (graph == null || graph._lgBreakerEdgeDropInstalled) {
        return
    }
    graph._lgBreakerEdgeDropInstalled = true
    graph.splitEnabled = true
    graph.setDropEnabled(true)

    if (typeof Graph !== 'undefined' && !splitTargetPatched) {
        splitTargetPatched = true
        const origIsSplitTarget = Graph.prototype.isSplitTarget
        Graph.prototype.isSplitTarget = function (target, cells, evt) {
            if (!this._lgEvtInited) {
                return origIsSplitTarget.apply(this, arguments)
            }
            if (cells == null || cells.length !== 1 || this.model.isEdge(cells[0])) {
                return false
            }
            const cell = cells[0]
            const st = this.getCurrentCellStyle(cell) || {}
            const shape = String(st.shape || cell.symbol || '').toLowerCase()
            const psr =
                cell.psrtype != null && cell.psrtype !== ''
                    ? cell.psrtype
                    : st.psrtype
            if (!isLgSwitchShapeOrPsr(shape, psr)) {
                return false
            }
            if (!this.model.isEdge(target) || !isLgSplittableConnLine(this, target)) {
                return false
            }
            if (mxEvent.isAltDown(evt) || mxEvent.isShiftDown(evt)) {
                return false
            }
            if (this.isCellLocked(this.getLayerForCell(target))) {
                return false
            }
            const t1 = this.model.getTerminal(target, true)
            const t2 = this.model.getTerminal(target, false)
            if (t1 != null && this.model.isAncestor(cell, t1)) {
                return false
            }
            if (t2 != null && this.model.isAncestor(cell, t2)) {
                return false
            }
            if (!this.isCellConnectable(cell)) {
                return false
            }
            // 虚线连接：跳过 drawio 默认校验，允许强制分割（细线不易命中时由 CELLS_ADDED 兜底）
            if (isLgDashedConnLine(this, target) && !isBusbarConnectorEdge(this, target)) {
                return true
            }
            return mxGraph.prototype.isSplitTarget.call(this, target, cells, evt)
        }
    }

    graph.addListener(mxEvent.SPLIT_EDGE, function (sender, evt) {
        const cells = evt.getProperty('cells')
        const edgeKept = evt.getProperty('edge')
        const edgeNew = evt.getProperty('newEdge')
        const breaker = cells != null && cells.length > 0 ? cells[0] : null
        if (breaker == null || edgeKept == null || edgeNew == null) {
            return
        }
        alignBreakerAfterSplitEdge(graph, breaker, edgeKept, edgeNew)
    })

    graph.addListener(mxEvent.CELLS_ADDED, function (sender, evt) {
        const cells = evt.getProperty('cells')
        if (cells == null || cells.length === 0) {
            return
        }
        for (let i = 0; i < cells.length; i++) {
            const cell = cells[i]
            if (!graph.getModel().isVertex(cell) || !isLgBreakerCell(graph, cell)) {
                continue
            }
            const edges = graph.getModel().getEdges(cell) || []
            if (edges.length >= 2) {
                continue
            }
            const runConnect = function () {
                const id =
                    typeof cell.getId === 'function' ? cell.getId() : cell.id
                if (graph.getModel().getCell(id) == null) {
                    return
                }
                graph.view.validate()
                const n = graph.getModel().getEdges(cell) || []
                if (n.length >= 2) {
                    return
                }
                tryConnectBreakerToNearbyLine(graph, cell)
            }
            window.setTimeout(runConnect, 0)
            window.setTimeout(runConnect, 80)
            window.setTimeout(runConnect, 200)
        }
    })
}
