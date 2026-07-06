/** /in-site-svg 站内馈线（府馨线）点击 → 跳转 /graphLg */

export const LG_IN_SITE_FUXIN_FEEDER_DATASET = 'fucheng23'
export const LG_IN_SITE_FUXIN_FEEDER_LABEL = '府城变23板府馨线'

function distPointToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1
    const dy = y2 - y1
    const len2 = dx * dx + dy * dy
    if (len2 === 0) {
        return Math.hypot(px - x1, py - y1)
    }
    let t = ((px - x1) * dx + (py - y1) * dy) / len2
    t = Math.max(0, Math.min(1, t))
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function containerPtToModel(graph, cx, cy) {
    if (graph.useCssTransforms) {
        return {
            x: cx / graph.currentScale - graph.currentTranslate.x,
            y: cy / graph.currentScale - graph.currentTranslate.y,
        }
    }
    const s = graph.view.scale
    const t = graph.view.translate
    return { x: cx / s - t.x, y: cy / s - t.y }
}

function distToEdgeCell(graph, cell, containerX, containerY) {
    const state = graph.view.getState(cell)
    if (!state?.absolutePoints || state.absolutePoints.length < 2) {
        return Infinity
    }
    const pts = state.absolutePoints
    let min = Infinity
    for (let i = 0; i < pts.length - 1; i++) {
        min = Math.min(
            min,
            distPointToSegment(
                containerX,
                containerY,
                pts[i].x,
                pts[i].y,
                pts[i + 1].x,
                pts[i + 1].y,
            ),
        )
    }
    return min
}

function vertexHit(graph, cell, containerX, containerY, padPx) {
    const model = graph.getModel()
    const geo = model.getGeometry(cell)
    if (!geo) {
        return false
    }
    const s = graph.view.scale || 1
    const pad = padPx / s
    const pt = containerPtToModel(graph, containerX, containerY)
    return (
        pt.x >= geo.x - pad &&
        pt.x <= geo.x + geo.width + pad &&
        pt.y >= geo.y - pad &&
        pt.y <= geo.y + geo.height + pad
    )
}

export function markLgInSiteFeederCell(cell, info = {}) {
    if (!cell) return
    cell.lgInSiteFeeder = true
    cell.lgInSiteFeederDataset = info.dataset || LG_IN_SITE_FUXIN_FEEDER_DATASET
    cell.lgInSiteFeederLabel = info.label || LG_IN_SITE_FUXIN_FEEDER_LABEL
    if (!cell.name) {
        cell.name = cell.lgInSiteFeederLabel
    }
}

/** 解析完成后缓存可点击站内馈线图元 */
export function refreshLgInSiteFeederCellIndex(graph) {
    if (!graph) {
        return []
    }
    const model = graph.getModel()
    const feeders = []
    const visit = (parent) => {
        const count = model.getChildCount(parent)
        for (let i = 0; i < count; i++) {
            const cell = model.getChildAt(parent, i)
            if (!cell) {
                continue
            }
            if (cell.lgInSiteFeeder === true) {
                feeders.push(cell)
            }
            visit(cell)
        }
    }
    visit(model.getRoot())
    graph._lgInSiteFeederCells = feeders
    return feeders
}

/** 在容器坐标下解析站内馈线图元（含细线容差） */
export function resolveLgInSiteFeederCellAt(graph, containerX, containerY) {
    if (!graph || !window.__lgInSiteSvgMode) {
        return null
    }

    let cell = graph.getCellAt(containerX, containerY)
    if (cell?.lgInSiteFeeder === true) {
        return cell
    }

    const feeders = graph._lgInSiteFeederCells || []
    if (!feeders.length) {
        return null
    }

    const edgeTol = 16
    let bestEdge = null
    let bestEdgeDist = edgeTol

    for (const fc of feeders) {
        const model = graph.getModel()
        if (model.isVertex(fc) && vertexHit(graph, fc, containerX, containerY, 10)) {
            return fc
        }
        if (model.isEdge(fc)) {
            const d = distToEdgeCell(graph, fc, containerX, containerY)
            if (d < bestEdgeDist) {
                bestEdgeDist = d
                bestEdge = fc
            }
        }
    }

    return bestEdge
}
