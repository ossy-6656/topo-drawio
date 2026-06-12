const NS = 'http://www.w3.org/2000/svg'
const OVERLAY_ATTR = 'data-lg-pv-shine'
export const LG_PV_ICON_VIEW_W = 48
export const LG_PV_ICON_VIEW_H = 42
const PANEL_COLOR = '#009688'
const PANEL_GRID_STROKE = '#00796B'
const STAND_STROKE = '#4DB6AC'
/** 光伏板梯形（viewBox 坐标） */
const PANEL = { x1: 10, x2: 38, x3: 42, x4: 6, yTop: 4, yBot: 32 }
const SHINE_DUR_SEC = 2.8

function uidFromCellId(cellId) {
    return String(cellId || 'pv').replace(/[^a-zA-Z0-9_-]/g, '_')
}

/** 青绿光伏板（2×3 栅格）+ 支架，无太阳 */
export function buildLgPvIconImageSvg() {
    return (
        `<svg xmlns="${NS}" viewBox="0 0 ${LG_PV_ICON_VIEW_W} ${LG_PV_ICON_VIEW_H}" width="${LG_PV_ICON_VIEW_W}" height="${LG_PV_ICON_VIEW_H}">` +
        `<g fill="${PANEL_COLOR}" stroke="none">` +
        `<path d="M10,4 L38,4 L42,32 L6,32 Z"/>` +
        `</g>` +
        `<g fill="none" stroke="${PANEL_GRID_STROKE}" stroke-width="0.75" stroke-linejoin="miter">` +
        `<path d="M10,4 L19.33,4 L18.67,18 L8,18 Z"/>` +
        `<path d="M19.33,4 L28.67,4 L29.33,18 L18.67,18 Z"/>` +
        `<path d="M28.67,4 L38,4 L40,18 L29.33,18 Z"/>` +
        `<path d="M8,18 L18.67,18 L18,32 L6,32 Z"/>` +
        `<path d="M18.67,18 L29.33,18 L30,32 L18,32 Z"/>` +
        `<path d="M29.33,18 L40,18 L42,32 L30,32 Z"/>` +
        `<line x1="8" y1="18" x2="40" y2="18"/>` +
        `<path d="M10,4 L38,4 L42,32 L6,32 Z" stroke-width="1"/>` +
        `</g>` +
        `<g fill="none" stroke="${STAND_STROKE}" stroke-width="1.8" stroke-linecap="round">` +
        `<path d="M24,32 L24,40"/>` +
        `<path d="M17,40 L31,40"/>` +
        `</g>` +
        `</svg>`
    )
}

export function lgPvIconImageDataUri() {
    return 'data:image/svg+xml,' + encodeURIComponent(buildLgPvIconImageSvg())
}

function createSvgEl(name) {
    return document.createElementNS(NS, name)
}

function removeLgPvIconShineOverlays(graph) {
    const overlay = graph?.view?.getOverlayPane?.()
    if (!overlay?.querySelectorAll) {
        return
    }
    overlay.querySelectorAll(`g[${OVERLAY_ATTR}="1"]`).forEach((g) => g.remove())
}

function panelMetrics(w, h) {
    const sx = w / LG_PV_ICON_VIEW_W
    const sy = h / LG_PV_ICON_VIEW_H
    const tlX = PANEL.x1 * sx
    const tlY = PANEL.yTop * sy
    const brX = PANEL.x3 * sx
    const brY = PANEL.yBot * sy
    const diagDx = brX - tlX
    const diagDy = brY - tlY
    const diagLen = Math.sqrt(diagDx * diagDx + diagDy * diagDy)
    const angleDeg = (Math.atan2(diagDy, diagDx) * 180) / Math.PI

    return {
        sx,
        sy,
        tlX,
        tlY,
        brX,
        brY,
        diagDx,
        diagDy,
        diagLen,
        angleDeg,
        clipD: [
            `M${PANEL.x1 * sx},${PANEL.yTop * sy}`,
            `L${PANEL.x2 * sx},${PANEL.yTop * sy}`,
            `L${PANEL.x3 * sx},${PANEL.yBot * sy}`,
            `L${PANEL.x4 * sx},${PANEL.yBot * sy}`,
            'Z',
        ].join(' '),
    }
}

function appendShineOverlay(graph, cell, state) {
    const overlay = graph.view.getOverlayPane()
    if (!overlay || !state) {
        return
    }
    const uid = uidFromCellId(cell.id)
    const x = state.x
    const y = state.y
    const w = Math.max(10, state.width)
    const h = Math.max(w * (LG_PV_ICON_VIEW_H / LG_PV_ICON_VIEW_W), state.height)
    const rot = Number(state.style?.rotation) || 0
    const pm = panelMetrics(w, h)
    const bandW = Math.max(8, pm.diagLen * 0.32)
    const bandH = Math.max(pm.diagLen * 0.55, (PANEL.yBot - PANEL.yTop) * pm.sy * 1.15)

    const wrap = createSvgEl('g')
    wrap.setAttribute(OVERLAY_ATTR, '1')
    wrap.setAttribute('data-lg-pv-cell', String(cell.id))
    wrap.setAttribute('pointer-events', 'none')
    wrap.setAttribute(
        'transform',
        rot ? `translate(${x + w / 2},${y + h / 2}) rotate(${rot}) translate(${-w / 2},${-h / 2})` : `translate(${x},${y})`
    )

    const defs = createSvgEl('defs')
    const clip = createSvgEl('clipPath')
    clip.setAttribute('id', `pvPanelClip_${uid}`)
    clip.setAttribute('clipPathUnits', 'userSpaceOnUse')
    const clipPath = createSvgEl('path')
    clipPath.setAttribute('d', pm.clipD)
    clip.appendChild(clipPath)
    defs.appendChild(clip)

    const shineGrad = createSvgEl('linearGradient')
    shineGrad.setAttribute('id', `pvShine_${uid}`)
    shineGrad.setAttribute('x1', '0%')
    shineGrad.setAttribute('y1', '0%')
    shineGrad.setAttribute('x2', '100%')
    shineGrad.setAttribute('y2', '0%')
    ;[
        ['0%', '#FFFFFF', '0'],
        ['38%', '#FFFFFF', '0'],
        ['50%', '#FFFFFF', '0.72'],
        ['62%', '#FFFFFF', '0'],
        ['100%', '#FFFFFF', '0'],
    ].forEach(([offset, color, opacity]) => {
        const stop = createSvgEl('stop')
        stop.setAttribute('offset', offset)
        stop.setAttribute('stop-color', color)
        stop.setAttribute('stop-opacity', opacity)
        shineGrad.appendChild(stop)
    })
    defs.appendChild(shineGrad)
    wrap.appendChild(defs)

    const panelClipGroup = createSvgEl('g')
    panelClipGroup.setAttribute('clip-path', `url(#pvPanelClip_${uid})`)

    const shineTrack = createSvgEl('g')
    shineTrack.setAttribute('transform', `translate(${pm.tlX}, ${pm.tlY}) rotate(${pm.angleDeg})`)

    const shine = createSvgEl('rect')
    shine.setAttribute('x', String(-bandW))
    shine.setAttribute('y', String(-bandH / 2))
    shine.setAttribute('width', String(bandW))
    shine.setAttribute('height', String(bandH))
    shine.setAttribute('fill', `url(#pvShine_${uid})`)
    shine.setAttribute('opacity', '0.75')
    shine.setAttribute('style', 'mix-blend-mode:screen')

    const shineAnim = createSvgEl('animateTransform')
    shineAnim.setAttribute('attributeName', 'transform')
    shineAnim.setAttribute('type', 'translate')
    shineAnim.setAttribute('additive', 'sum')
    shineAnim.setAttribute('from', '0 0')
    shineAnim.setAttribute('to', `${pm.diagLen + bandW} 0`)
    shineAnim.setAttribute('dur', `${SHINE_DUR_SEC}s`)
    shineAnim.setAttribute('repeatCount', 'indefinite')
    shine.appendChild(shineAnim)

    shineTrack.appendChild(shine)
    panelClipGroup.appendChild(shineTrack)
    wrap.appendChild(panelClipGroup)
    overlay.appendChild(wrap)
}

export function applyLgPvIconShineOverlays(graph) {
    if (typeof document === 'undefined' || !graph?.view?.getOverlayPane) {
        return
    }
    removeLgPvIconShineOverlays(graph)
    const model = graph.getModel()
    const walk = (parent) => {
        const count = model.getChildCount(parent)
        for (let i = 0; i < count; i++) {
            const cell = model.getChildAt(parent, i)
            if (!cell) {
                continue
            }
            if (cell.lgPvIcon === true) {
                const st = graph.view.getState(cell)
                if (st) {
                    appendShineOverlay(graph, cell, st)
                }
            }
            walk(cell)
        }
    }
    walk(model.getRoot())
}

let syncTimer = null

function scheduleLgPvIconShineSync(graph) {
    if (typeof window === 'undefined' || !graph) {
        return
    }
    if (syncTimer != null) {
        window.clearTimeout(syncTimer)
    }
    syncTimer = window.setTimeout(() => {
        syncTimer = null
        applyLgPvIconShineOverlays(graph)
    }, 60)
}

export function installLgPvIconShineListeners(graph) {
    if (!graph || graph._lgPvIconShineListeners) {
        return
    }
    graph._lgPvIconShineListeners = true
    if (typeof mxEvent === 'undefined') {
        return
    }
    const handler = () => scheduleLgPvIconShineSync(graph)
    graph.addListener(mxEvent.SCALE_AND_TRANSLATE, handler)
    graph.addListener(mxEvent.SCALE, handler)
    graph.addListener(mxEvent.TRANSLATE, handler)
    graph.addListener(mxEvent.CELLS_MOVED, handler)
    graph.view.addListener(mxEvent.SCALE_AND_TRANSLATE, handler)
    graph.view.addListener(mxEvent.SCALE, handler)
    graph.view.addListener(mxEvent.TRANSLATE, handler)
}

export function teardownLgPvIconShine(graph) {
    if (syncTimer != null && typeof window !== 'undefined') {
        window.clearTimeout(syncTimer)
        syncTimer = null
    }
    if (graph) {
        graph._lgPvIconShineListeners = false
    }
    removeLgPvIconShineOverlays(graph)
}
