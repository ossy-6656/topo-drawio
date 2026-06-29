/**
 * 无图中 shapeDragDefaults 时，侧栏拖入宽高 = ((1-t)×条目网格 + t×symbol 声明宽高 symEntry.w/h)×getScale。
 * t=0 偏小，t=1 偏大；配电站/箱变 w=h=3 时与 t 无关。变压器/机组由 graphLg 以双绕组为锚统一尺寸。
 */
export const LG_SIDEBAR_DRAG_SYMBOL_BLEND = 0.12

/** /graphLg 设备名称多行文本行高（相对字号；与 mxConstants.LINE_HEIGHT 同步） */
export const LG_GRAPH_DATASET_NAME_LINE_HEIGHT = 1.35

/** 柱上用户变 symbol.js viewBox 高/宽（3 × 2.550548） */
export const LG_PTUSER_SYMBOL_H_PER_W = 2.550548 / 3

/** 以配电站/箱变侧栏宽为锚，推算柱上用户变侧栏尺寸（保持 symbol 高宽比） */
export function resolveLgPtuserSidebarWhFromAnchor(anchorW) {
    const w = Number(anchorW)
    if (!(w > 0)) {
        return null
    }
    return { w, h: w * LG_PTUSER_SYMBOL_H_PER_W }
}

/** 负荷侧栏 dragDef：箱变跟配电站，柱上用户变宽跟配电站 */
export function alignLgLoadDeviceDragDef(dragDef) {
    const out = dragDef && typeof dragDef === 'object' ? { ...dragDef } : {}
    const sub =
        out.substation?.w > 0 && out.substation?.h > 0
            ? out.substation
            : out.xb?.w > 0 && out.xb?.h > 0
              ? out.xb
              : null
    if (!sub) {
        return out
    }
    out.xb = { w: sub.w, h: sub.h }
    const pt = resolveLgPtuserSidebarWhFromAnchor(sub.w)
    if (pt) {
        out.ptuser = pt
    }
    return out
}

/** 负荷侧栏模板行：箱变、柱上用户变与配电站尺寸对齐 */
export function alignLgLoadDeviceSizeRows(rows) {
    if (!Array.isArray(rows)) {
        return rows
    }
    const pd =
        rows.find((r) => r.key === 'substation' && r.w > 0 && r.h > 0) ||
        rows.find((r) => r.key === 'xb' && r.w > 0 && r.h > 0)
    if (!pd) {
        return rows
    }
    const pt = resolveLgPtuserSidebarWhFromAnchor(pd.w)
    for (const row of rows) {
        if (row.key === 'xb') {
            row.w = pd.w
            row.h = pd.h
        } else if (row.key === 'ptuser' && pt) {
            row.w = pt.w
            row.h = pt.h
        }
    }
    return rows
}

/**
 * lgdata 侧栏参考尺寸（/graphLg 打开 zjtSvg 前或与图中无对应设备时的回退）。
 * /in-site-svg 复用，与 graphLg 默认 zjtSvg 侧栏一致。
 */
export function getLgdataSidebarReferenceDragDef(scale) {
    const s = Number(scale)
    if (!(s > 0)) {
        return {}
    }
    const side = 3 * s
    return {
        substation: { w: side, h: side },
        xb: { w: side, h: side },
        ptuser: resolveLgPtuserSidebarWhFromAnchor(side) || { w: side, h: side * LG_PTUSER_SYMBOL_H_PER_W },
        potentialtransformer2w: { w: side, h: side },
        potentialtransformer3w: { w: side, h: side },
        generatingunit: { w: side, h: side },
    }
}

/** /in-site-svg 侧栏拖入：变压器、机组、负荷等 shape 键 */
export const LG_IN_SITE_GFILE_SIDEBAR_SHAPE_KEYS = [
    'substation',
    'xb',
    'ptuser',
    'potentialtransformer2w',
    'potentialtransformer3w',
    'generatingunit',
]

/** /in-site-svg：变压器/机组/负荷相对画布锚定尺寸的显示缩放（略小于断路器锚点） */
export const LG_IN_SITE_GFILE_DEVICE_DISPLAY_SCALE = 0.6

/** 从 shapeDragDefaults 取最大边长（优先指定键，否则全表扫描） */
export function maxSideFromShapeDragDefaults(dragDef, preferKeys) {
    let max = 0
    const map = dragDef || {}
    const keys =
        preferKeys && preferKeys.length > 0 ? preferKeys : Object.keys(map)
    for (let i = 0; i < keys.length; i++) {
        const d = map[keys[i]]
        if (d && d.w > 0) {
            max = Math.max(max, d.w, d.h)
        }
    }
    if (max <= 0) {
        for (const d of Object.values(map)) {
            if (d && d.w > 0) {
                max = Math.max(max, d.w, d.h)
            }
        }
    }
    return max
}

/**
 * /in-site-svg：以 G 图画布设备边长为锚，补齐变压器/机组/负荷侧栏与拖入尺寸。
 */
export function buildInSiteGfileSidebarDragDef(gDrag, targetSide) {
    const side = Number(targetSide)
    const out = { ...(gDrag || {}) }
    if (!(side > 0)) {
        return out
    }
    const ptH = side * LG_PTUSER_SYMBOL_H_PER_W
    for (let i = 0; i < LG_IN_SITE_GFILE_SIDEBAR_SHAPE_KEYS.length; i++) {
        const key = LG_IN_SITE_GFILE_SIDEBAR_SHAPE_KEYS[i]
        if (!out[key] || !(out[key].w > 0)) {
            out[key] =
                key === 'ptuser' ? { w: side, h: ptH } : { w: side, h: side }
        }
    }
    if (out.potentialtransformer2w && out.potentialtransformer2w.w > 0) {
        const tw = { ...out.potentialtransformer2w }
        out.potentialtransformer3w = { ...tw }
        out.generatingunit = { ...tw }
    }
    if (out.substation && out.substation.w > 0) {
        out.xb = { w: out.substation.w, h: out.substation.h }
    }
    return alignLgLoadDeviceDragDef(out)
}

/** 仅缩小 in-site-svg 变压器/机组/负荷侧栏与拖入尺寸 */
export function scaleInSiteGfileSidebarDragDef(dragDef, scale) {
    const s = Number(scale)
    if (!(s > 0) || Math.abs(s - 1) < 0.001) {
        return dragDef || {}
    }
    const out = { ...(dragDef || {}) }
    for (let i = 0; i < LG_IN_SITE_GFILE_SIDEBAR_SHAPE_KEYS.length; i++) {
        const key = LG_IN_SITE_GFILE_SIDEBAR_SHAPE_KEYS[i]
        const d = out[key]
        if (d && d.w > 0 && d.h > 0) {
            out[key] = { w: d.w * s, h: d.h * s }
        }
    }
    return out
}

/** 侧栏「站内-断路器(0305)」无图中参考时的网格边长（× getScale）；有 lgdata 时以 shapeDragDefaults 为准 */
export const LG_SIDEBAR_SWITCH_GRID_WH = 10

/** lgdata 中 Breaker_30500000 use 元素 transform scale 典型值（与导入断路器视觉一致） */
export const LG_LGDATA_BREAKER_TYPICAL_USE_SCALE = 10.857673

/** lgdata 画布 0305 边长回退值（3×典型 use scale×lgdata 文本层 scale≈3.14） */
export const LG_SWITCH_CANVAS_REF_SIDE_FALLBACK = 102.27

/**
 * 画布/侧栏 0305 在 lgdata 基准边上的显示缩放（<1 略缩小，成图更协调）
 */
export const LG_SWITCH_CANVAS_DISPLAY_SCALE = 0.85

/**
 * 站所按原生 scale 算出的边长超过「目标×本系数」时走「大站所」策略（锦艺等），
 * 不再用 lgdata 文本层 scale 折算。浮龙/张衡等未超阈值时仍走折算。
 */
export const LG_SWITCH_STATION_CAP_TO_REF_RATIO = 1.15

/** 大站所（锦艺）：原生边长保留比例，与 ref×LG_SWITCH_LARGE_STATION_REF_BOOST 取较大值 */
export const LG_SWITCH_LARGE_STATION_SIDE_FACTOR = 0.92

/** 大站所目标边长下限：至少为 lgdata 显示目标×本系数 */
export const LG_SWITCH_LARGE_STATION_REF_BOOST = 1.55

/**
 * 站所 getScale / lgdata getScale 超过本值时（锦艺≈3.8），环网柜内全部 0305 统一放大，
 * 不依赖单颗开关原生边长是否超过 capTh（锦艺 symbol 宽 2，原生 max 边长常 <100）。
 */
export const LG_SWITCH_EXTREME_HIGH_SCALE_RATIO = 2.5

/** lgdata 解析时 #Text_Layer 推算的 getScale()，站所图不得用于开关目标尺寸 */
let lgLgdataParserTextScale = 0

/** lgdata 画布 0305 目标边长（px）；仅随 lgdata 刷新 */
let lgSwitchCanvasRefSide = 0

export function setLgLgdataParserTextScale(scale) {
    const n = Number(scale)
    if (Number.isFinite(n) && n > 0) {
        lgLgdataParserTextScale = n
    }
}

export function getLgLgdataParserTextScale() {
    return lgLgdataParserTextScale > 0 ? lgLgdataParserTextScale : 0
}

export function setLgSwitchCanvasRefSide(side) {
    const n = Number(side)
    if (Number.isFinite(n) && n > 0) {
        lgSwitchCanvasRefSide = n
    }
}

/** 画布与侧栏拖入使用的 0305 目标边长（已含 LG_SWITCH_CANVAS_DISPLAY_SCALE） */
export function getLgSwitchCanvasRefSide() {
    let base = 0
    if (lgSwitchCanvasRefSide > 0) {
        base = lgSwitchCanvasRefSide
    } else {
        const computed = computeLgSwitchCanvasRefSideFromLgdataScale()
        base = computed > 0 ? computed : LG_SWITCH_CANVAS_REF_SIDE_FALLBACK
    }
    const k = Number(LG_SWITCH_CANVAS_DISPLAY_SCALE)
    const scale = Number.isFinite(k) && k > 0 ? Math.min(1, k) : 1
    return base * scale
}

/**
 * 将开关宽高对齐到目标边长：默认仅缩小；allowEnlarge 为 true 时也可放大至目标。
 */
export function fitLgSwitchVertexToRefSide(width, height, refSide, allowEnlarge = false) {
    const w = Number(width)
    const h = Number(height)
    const ref = Number(refSide)
    if (!(w > 0) || !(h > 0) || !(ref > 0)) {
        return { width: w, height: h }
    }
    const cur = Math.max(w, h)
    if (cur <= ref) {
        if (allowEnlarge && cur < ref * 0.98) {
            const f = ref / cur
            return { width: w * f, height: h * f }
        }
        return { width: w, height: h }
    }
    const f = ref / cur
    return { width: w * f, height: h * f }
}

/** 0305 画布统一为正方形（SVG use 常为扁矩形，旋转后易呈细竖条） */
export function applyLgSwitchSquareCanvasSize(side) {
    const s = Number(side)
    if (!(s > 0)) {
        return { width: s, height: s }
    }
    return { width: s, height: s }
}

/** 文本层 scale 明显大于 lgdata 的站所（锦艺）：目标边长大于通用 ref */
export function getLgSwitchTargetForLargeStation(stationCur, refSide) {
    const cur = Number(stationCur)
    const ref = Number(refSide)
    if (!(cur > 0) || !(ref > 0)) {
        return ref
    }
    const retain = Number(LG_SWITCH_LARGE_STATION_SIDE_FACTOR)
    const f = Number.isFinite(retain) && retain > 0 ? retain : 0.82
    const boost = Number(LG_SWITCH_LARGE_STATION_REF_BOOST)
    const b = Number.isFinite(boost) && boost > 1 ? boost : 1.32
    const fromNative = cur * f
    const fromRef = ref * b
    return Math.min(cur, Math.max(fromNative, fromRef))
}

/**
 * 站所 SVG 文本层 getScale() 大于 lgdata 时，0305 按 lgdata 文本层 scale 折算，避免浮龙/张衡等站偏大。
 */
export function scaleLgSwitchVertexForStationImport(width, height, stationParserScale) {
    const w = Number(width)
    const h = Number(height)
    const station = Number(stationParserScale)
    const lg = getLgLgdataParserTextScale()
    if (!(w > 0) || !(h > 0) || !(station > 0) || !(lg > 0) || station <= lg) {
        return { width: w, height: h }
    }
    const corr = lg / station
    return { width: w * corr, height: h * corr }
}

/** 锦艺等：整站文本层 scale 远高于 lgdata（非单开关边长） */
export function isLgExtremeHighScaleStation(stationParserScale) {
    const station = Number(stationParserScale)
    const lg = getLgLgdataParserTextScale()
    const ratio = Number(LG_SWITCH_EXTREME_HIGH_SCALE_RATIO)
    const th = Number.isFinite(ratio) && ratio > 1 ? ratio : 2.5
    return lg > 0 && station > lg * th
}

/** 导入/画布 0305：按站所类型在「收到目标边长」与「lgdata 文本层折算」间择优 */
export function resolveLgSwitchCanvasVertexSize(width, height, stationParserScale) {
    const ref = getLgSwitchCanvasRefSide()
    const w = Number(width)
    const h = Number(height)
    const station = Number(stationParserScale)
    const lg = getLgLgdataParserTextScale()
    if (!(w > 0) || !(h > 0) || !(ref > 0)) {
        return { width: w, height: h }
    }
    const stationCur = Math.max(w, h)
    const capRatio = Number(LG_SWITCH_STATION_CAP_TO_REF_RATIO)
    const capTh =
        Number.isFinite(capRatio) && capRatio > 1 ? ref * capRatio : ref * 1.15
    const boost = Number(LG_SWITCH_LARGE_STATION_REF_BOOST)
    const boostMul = Number.isFinite(boost) && boost > 1 ? boost : 1.55

    if (isLgExtremeHighScaleStation(station)) {
        const target = Math.max(
            getLgSwitchTargetForLargeStation(stationCur, ref),
            ref * boostMul
        )
        return applyLgSwitchSquareCanvasSize(target)
    }

    if (lg > 0 && station > lg && stationCur > capTh) {
        const target = getLgSwitchTargetForLargeStation(stationCur, ref)
        return applyLgSwitchSquareCanvasSize(target)
    }

    const corrected = scaleLgSwitchVertexForStationImport(w, h, station)
    const cur = Math.max(corrected.width, corrected.height)
    const targetSide = cur > ref ? ref : cur
    return applyLgSwitchSquareCanvasSize(targetSide)
}

/** symbol 3×3 × lgdata 典型 use scale × lgdata 文本层 scale（与站所 getScale 无关） */
export function computeLgSwitchCanvasRefSideFromLgdataScale() {
    const s = getLgLgdataParserTextScale()
    if (!(s > 0)) {
        return 0
    }
    return 3 * LG_LGDATA_BREAKER_TYPICAL_USE_SCALE * s
}

/** @deprecated 使用 computeLgSwitchCanvasRefSideFromLgdataScale */
export function computeLgSwitchCanvasRefSideFromScale(parserScale) {
    const s = Number(parserScale)
    if (!(s > 0)) {
        return 0
    }
    return 3 * LG_LGDATA_BREAKER_TYPICAL_USE_SCALE * s
}

/** 左侧「开关」面板：站内断路器 0305，与 lgdata 导入尺寸一致，可旋转 */
export const LG_SIDEBAR_SWITCH_ENTRIES = [
    [
        'cbreaker',
        '站内-断路器(0305)',
        LG_SIDEBAR_SWITCH_GRID_WH,
        LG_SIDEBAR_SWITCH_GRID_WH,
        'psrtype=0305;strokeColor=none;rotation=0;rotatable=1;resizable=1;status=true;',
    ],
]

/** 侧栏/画布站内断路器(0305)：shape 或 PSRType 判定 */
export function isLgSwitchShapeOrPsr(shapeOrSymbol, psrtype) {
    const sym = String(shapeOrSymbol || '').toLowerCase()
    const psr = String(psrtype || '')
    return (
        sym === 'cbreaker' ||
        sym === 'cbreaker_open' ||
        sym.startsWith('breaker_30500000') ||
        psr === '0305'
    )
}

/** 0305 开关状态存为字符串 true/false：true 闭合，false 断开 */
export function normalizeLgSwitchStatus(raw) {
    if (raw === true || raw === 1 || raw === '1') {
        return 'true'
    }
    if (raw === false || raw === 0 || raw === '0') {
        return 'false'
    }
    const s = String(raw == null ? '' : raw)
        .trim()
        .toLowerCase()
    if (s === 'true' || s === '闭合' || s === 'close' || s === 'closed' || s === '合') {
        return 'true'
    }
    if (s === 'false' || s === '断开' || s === '打开' || s === 'open' || s === 'opened' || s === '分') {
        return 'false'
    }
    return 'true'
}

export function lgSwitchStatusLabel(statusVal) {
    return normalizeLgSwitchStatus(statusVal) === 'false' ? '断开' : '闭合'
}

/** lgdata 导入断路器：闭合(@1 实心) ↔ 断开(@0 空心) */
const LG_IMPORTED_BREAKER_CLOSED_TO_OPEN = {
    'breaker_30500000_4030010@1': 'breaker_30500000_4030011@0',
    'breaker_30500000_4030020@1': 'breaker_30500000_4030021@0',
    'breaker_30500000_4100010@1': 'breaker_30500000_4100011@0',
}

/** 按 status 返回应对外展示的 mxGraph shape（null 表示无需切换） */
export function lgSwitchBreakerShapeForStatus(currentShape, status) {
    const sym = String(currentShape || '').toLowerCase()
    const closed = normalizeLgSwitchStatus(status) !== 'false'
    if (sym === 'cbreaker' || sym === 'cbreaker_open') {
        return closed ? 'cbreaker' : 'cbreaker_open'
    }
    const openShape = LG_IMPORTED_BREAKER_CLOSED_TO_OPEN[sym]
    if (openShape) {
        return closed ? sym : openShape
    }
    for (const closedShape of Object.keys(LG_IMPORTED_BREAKER_CLOSED_TO_OPEN)) {
        if (sym === LG_IMPORTED_BREAKER_CLOSED_TO_OPEN[closedShape]) {
            return closed ? closedShape : sym
        }
    }
    return null
}

/** 根据 status 刷新 0305 断路器实心/空心图元 */
export function applyLgSwitchBreakerVisual(graph, cells) {
    if (graph == null || cells == null) {
        return
    }
    const list = Array.isArray(cells) ? cells : [cells]
    const model = graph.getModel()
    const toRefresh = []
    for (let i = 0; i < list.length; i++) {
        const cell = list[i]
        if (cell == null || !model.isVertex(cell)) {
            continue
        }
        const st = graph.getCellStyle(cell) || {}
        const psr =
            cell.psrtype != null && cell.psrtype !== ''
                ? String(cell.psrtype)
                : st.psrtype != null
                  ? String(st.psrtype)
                  : ''
        const curShape = (st.shape || cell.symbol || '').toString().toLowerCase()
        if (!isLgSwitchShapeOrPsr(curShape, psr)) {
            continue
        }
        const statusRaw =
            cell.status != null && cell.status !== ''
                ? cell.status
                : st.status
        const nextShape = lgSwitchBreakerShapeForStatus(curShape, statusRaw)
        if (nextShape && nextShape !== curShape) {
            graph.setCellStyles('shape', nextShape, [cell])
            if (nextShape === 'cbreaker' || nextShape === 'cbreaker_open') {
                cell.symbol = 'cbreaker'
            } else {
                cell.symbol = nextShape
            }
            const val = model.getValue(cell)
            if (mxUtils.isNode(val) && val.nodeName === 'attr') {
                val.setAttribute('shape', nextShape)
            }
            toRefresh.push(cell)
        }
    }
    for (let ri = 0; ri < toRefresh.length; ri++) {
        graph.view.invalidate(toRefresh[ri])
    }
}

/** 全图刷新 0305 断路器实心/空心（导入完成后、批量改 status 后） */
export function refreshAllLgSwitchBreakerVisuals(graph) {
    if (graph == null) {
        return
    }
    const model = graph.getModel()
    const cells = []
    const walk = (parent) => {
        const n = model.getChildCount(parent)
        for (let i = 0; i < n; i++) {
            const cell = model.getChildAt(parent, i)
            if (model.isVertex(cell)) {
                const st = graph.getCellStyle(cell) || {}
                const shape = (st.shape || cell.symbol || '').toString().toLowerCase()
                const psr =
                    cell.psrtype != null && cell.psrtype !== ''
                        ? String(cell.psrtype)
                        : st.psrtype != null
                          ? String(st.psrtype)
                          : ''
                if (isLgSwitchShapeOrPsr(shape, psr)) {
                    cells.push(cell)
                }
            }
            if (model.isVertex(cell) && model.getChildCount(cell) > 0) {
                walk(cell)
            }
        }
    }
    walk(graph.getDefaultParent())
    applyLgSwitchBreakerVisual(graph, cells)
}

/** 左侧「负荷」面板：默认宽高与 lgdata.js 内嵌 symbol（3×3）一致，× getScale 后与解析图元一致 */
export const LG_SIDEBAR_DEVICE_ENTRIES = [
    ['substation', '配电站(zf06)', 3, 3],
    ['xb', '箱式变电站(zf08)', 3, 3],
    [
        'ptuser',
        '柱上-用户变压器(0110)',
        3,
        2.550548,
        'psrtype=0110;strokeColor=none;rotation=0;rotatable=1;resizable=1;',
    ],
]

/** 侧栏/画布柱上用户变压器(0110)：shape 或 PSRType 判定（旋转与 0305 断路器同策略） */
export function isLgPtUserShapeOrPsr(shapeOrSymbol, psrtype) {
    const sym = String(shapeOrSymbol || '').toLowerCase()
    const psr = String(psrtype || '')
    return sym === 'ptuser' || (psr === '0110' && sym.startsWith('powertransformer_'))
}

/** 侧栏拖入后须保证可旋转的图元（仅 0305 断路器、0110 柱上用户变，不影响配电站/箱变） */
export function isLgSidebarRotatableShapeOrPsr(shapeOrSymbol, psrtype) {
    return isLgSwitchShapeOrPsr(shapeOrSymbol, psrtype) || isLgPtUserShapeOrPsr(shapeOrSymbol, psrtype)
}

/** 侧栏/画布负荷图元：配电站(zf06)、箱变(zf08)、柱上用户变压器(0110) */
export function isLgLoadShapeOrPsr(shapeOrSymbol, psrtype) {
    const sym = String(shapeOrSymbol || '').toLowerCase()
    const psr = String(psrtype || '')
    if (sym === 'substation' || sym === 'xb' || sym === 'ptuser') {
        return true
    }
    // 导入 SVG：配电站/箱变共用 Substation_* symbol，shape 为 substation_* 前缀
    if (sym.startsWith('substation_') || sym.startsWith('xb_')) {
        return true
    }
    if (psr === 'zf06' || psr === 'zf08') {
        return true
    }
    return isLgPtUserShapeOrPsr(sym, psr)
}

/** 侧栏拖入的负荷图元（简名 shape：substation / xb / ptuser） */
export function isLgSidebarAddedLoadShapeOrPsr(shapeOrSymbol, psrtype) {
    const sym = String(shapeOrSymbol || '').toLowerCase()
    return sym === 'substation' || sym === 'xb' || sym === 'ptuser'
}

/** 导入 SVG 原有配变/负荷图元（非侧栏拖入），无 P/Q 数据，tooltip 不展示有功/无功 */
export function isLgImportedLoadShapeOrPsr(shapeOrSymbol, psrtype) {
    return isLgLoadShapeOrPsr(shapeOrSymbol, psrtype) && !isLgSidebarAddedLoadShapeOrPsr(shapeOrSymbol, psrtype)
}

/** 左侧「变压器」面板：0314；先 resolve 再统一为双绕组尺寸（同箱式变对齐配电站） */
export const LG_SIDEBAR_TRANSFORMER_ENTRIES = [
    ['potentialtransformer2w', '电压互感器-双绕组(0314)', 3, 3],
    ['potentialtransformer3w', '电压互感器-三绕组(0314)', 3, 3],
]

/** 左侧「机组」面板：resolve 后宽高对齐变压器锚点(2w)，与 LG_SIDEBAR_DRAG_SYMBOL_BLEND 联动 */
export const LG_SIDEBAR_UNIT_ENTRIES = [['generatingunit', '发电机组', 3, 3]]

/** 侧栏可拖拽顶点图元的 shape 简名（供 LGSvgParser.matchSidebarShapeKey / collectShapeDragDefaultsFromGraph） */
const LG_SIDEBAR_ALL_VERTEX_ENTRY_LISTS = [
    LG_SIDEBAR_DEVICE_ENTRIES,
    LG_SIDEBAR_SWITCH_ENTRIES,
    LG_SIDEBAR_TRANSFORMER_ENTRIES,
    LG_SIDEBAR_UNIT_ENTRIES,
]

export function lgSidebarDeviceIdsByLengthDesc() {
    const ids = LG_SIDEBAR_ALL_VERTEX_ENTRY_LISTS.flat().map((e) => e[0])
    return [...new Set(ids)].sort((a, b) => b.length - a.length)
}

/**
 * 根据 style.shape / cell.symbol 匹配侧栏图元显示名（如 substation_* → 配电站(zf06)），与 graphLg 侧栏文案一致
 */
export function lgSidebarPaletteTitleForShape(shapeOrSymbol) {
    const symLower = String(shapeOrSymbol || '').toLowerCase()
    if (!symLower) return null
    const entries = LG_SIDEBAR_ALL_VERTEX_ENTRY_LISTS.flat()
    entries.sort((a, b) => String(b[0]).length - String(a[0]).length)
    for (let i = 0; i < entries.length; i++) {
        const id = String(entries[i][0]).toLowerCase()
        const label = entries[i][1]
        if (symLower === id || symLower.startsWith(id + '_')) {
            return label
        }
    }
    return null
}

// 自定义的symbol id
/**
 * 力光设备属性中文标签（编辑弹窗、tooltip 共用；电压 kV，容量 MW，有功 MW，无功 Mvar）
 */
/** 编辑弹窗左侧标签（不含单位，单位在输入框右侧 append 展示） */
export const LG_DEVICE_ATTR_LABELS = {
    P: '有功功率',
    Q: '无功功率',
    V_Rate: '额定电压',
    P_Rate: '额定有功功率',
    P_max: '最大有功功率',
    P_min: '最小有功功率',
    Q_max: '最大无功功率',
    Q_min: '最小无功功率',
    P_meas: '目标出力',
    I_Vol: '高压侧额定电压',
    K_Vol: '中压侧额定电压',
    J_Vol: '低压侧额定电压',
    I_S: '高压侧容量',
    K_S: '中压侧容量',
    J_S: '低压侧容量',
    dydj: '电压等级',
    volt: '电压',
    Ih: '额定载流量',
    length: '线路长度',
    model_paras_r: '电阻',
    model_paras_x: '电抗',
    model_paras_g: '电导',
    model_paras_b: '电纳',
}

/** 编辑弹窗输入框右侧单位块文案 */
export const LG_DEVICE_ATTR_UNIT_SUFFIX = {
    P: 'MW',
    Q: 'Mvar',
    V_Rate: 'kV',
    P_Rate: 'MW',
    P_max: 'MW',
    P_min: 'MW',
    Q_max: 'Mvar',
    Q_min: 'Mvar',
    P_meas: 'MW',
    I_Vol: 'kV',
    K_Vol: 'kV',
    J_Vol: 'kV',
    I_S: 'MW',
    K_S: 'MW',
    J_S: 'MW',
    dydj: 'kV',
    volt: 'kV',
    Ih: 'kA',
    length: 'km',
    model_paras_r: 'Ω/km',
    model_paras_x: 'Ω/km',
    model_paras_g: 'Ω/km',
    model_paras_b: 'Ω/km',
    hv_ks: 'kW',
    hv_kd: 'KA',
    hv_fs: 'kW',
    hv_kz: '%',
    mv_ks: 'kW',
    mv_kd: 'KA',
    mv_fs: 'kW',
    mv_kz: '%',
    lv_ks: 'kW',
    lv_kd: 'KA',
    lv_fs: 'kW',
    lv_kz: '%'
}

export function lgDeviceAttrLabel(name, fallback) {
    if (name != null && Object.prototype.hasOwnProperty.call(LG_DEVICE_ATTR_LABELS, name)) {
        return LG_DEVICE_ATTR_LABELS[name]
    }
    return fallback != null ? fallback : name
}

/** tooltip 等场景：标签后附带单位 */
export function lgDeviceAttrLabelWithUnit(name, fallback) {
    const label = lgDeviceAttrLabel(name, fallback)
    const unit = lgDeviceAttrUnitSuffix(name)
    return unit ? label + '(' + unit + ')' : label
}

export function lgDeviceAttrUnitSuffix(name) {
    if (name != null && Object.prototype.hasOwnProperty.call(LG_DEVICE_ATTR_UNIT_SUFFIX, name)) {
        return LG_DEVICE_ATTR_UNIT_SUFFIX[name]
    }
    return ''
}

export function lgDeviceAttrPlaceholder(name) {
    return lgDeviceAttrUnitSuffix(name) ? '请输入内容' : '请输入'
}

/** 母线连接线 model_paras 拆分为 4 个标量编辑项（顺序：电阻、电抗、电导、电纳） */
export const LG_MODEL_PARAS_FIELD_KEYS = ['model_paras_r', 'model_paras_x', 'model_paras_g', 'model_paras_b']
export const LG_MODEL_PARAS_FIELD_LABELS = ['电阻', '电抗', '电导', '电纳']
export const LG_MODEL_PARAS_UNIT = 'Ω/km'

export function isLgModelParasSubField(name) {
    return LG_MODEL_PARAS_FIELD_KEYS.indexOf(name) >= 0
}

function lgModelParasEmptySlots() {
    return ['', '', '', '']
}

/** 解析 model_paras 为 4 个编辑框字符串；无数据时返回空字符串，不填充默认值 */
export function parseLgModelParasArray(raw) {
    if (raw == null || raw === '') {
        return lgModelParasEmptySlots()
    }
    let nums = null
    if (Array.isArray(raw)) {
        nums = raw
    } else {
        const s = String(raw).trim()
        try {
            if (s.startsWith('[') && s.endsWith(']')) {
                const parsed = JSON.parse(s)
                if (Array.isArray(parsed)) {
                    nums = parsed
                }
            }
        } catch (e) {
            /* ignore */
        }
        if (!nums) {
            const parts = s.split(/[,，;\s]+/).map((p) => p.trim())
            if (parts.length >= 4) {
                nums = parts
            }
        }
    }
    if (!nums || nums.length === 0) {
        return lgModelParasEmptySlots()
    }
    return LG_MODEL_PARAS_FIELD_KEYS.map((_, i) => {
        const v = nums[i]
        if (v == null || v === '') {
            return ''
        }
        const n = parseFloat(v)
        return !isNaN(n) && isFinite(n) ? String(n) : ''
    })
}

/** 将 4 个标量合并为 model_paras JSON 数组字符串；全空则返回空字符串，不填充默认值 */
export function serializeLgModelParasArray(parts) {
    const nums = LG_MODEL_PARAS_FIELD_KEYS.map((_, i) => {
        const raw = parts[i]
        if (raw === '' || raw == null) {
            return null
        }
        const n = typeof raw === 'number' ? raw : parseFloat(String(raw).trim())
        if (isNaN(n) || !isFinite(n)) {
            return null
        }
        return n
    })
    if (nums.every((v) => v == null)) {
        return ''
    }
    return JSON.stringify(nums)
}

/** 力光设备编辑框中应按 number 存储的标量属性（非数组、非枚举字符串） */
export const LG_SCALAR_NUMERIC_ATTRS = new Set([
    'P',
    'Q',
    'V_Rate',
    'P_Rate',
    'P_max',
    'P_min',
    'Q_max',
    'Q_min',
    'P_meas',
    'I_Vol',
    'K_Vol',
    'J_Vol',
    'I_S',
    'K_S',
    'J_S',
    'Ih',
    'length',
    'model_paras_r',
    'model_paras_x',
    'model_paras_g',
    'model_paras_b',
])

export function isLgScalarNumericAttr(name) {
    return LG_SCALAR_NUMERIC_ATTRS.has(name)
}

/** 编辑保存 / 提交：可解析为有限数字时返回 number，否则保留原值 */
export function coerceLgScalarNumericAttr(name, raw) {
    if (!isLgScalarNumericAttr(name)) {
        return raw
    }
    if (raw == null || raw === '') {
        return ''
    }
    if (typeof raw === 'number' && !isNaN(raw) && isFinite(raw)) {
        return raw
    }
    const s = String(raw).trim()
    if (s === '') {
        return ''
    }
    const n = parseFloat(s)
    if (!isNaN(n) && isFinite(n)) {
        return n
    }
    return raw
}

// 注意：列入此表的图元在 StencilParse.symbol2shape 中不会生成 <shape> 模板，侧栏/缩略图将无法绘制
//（仅写入 symbolProp）。箱式变(zf08) 等须与 substation 一样走 parseSymbol，故不放此表。
export const customShapeLs = [
    'bridgeoverriver',
    'bridgeoverroad',
    'tunnel', 
    'tree',
    'mountain', 
    'lakes',
    'river',
    'lightningarrester',
    'substation_30000005_1030020',
    'LoadBreakSwitch_PMS25_a1fd8575-5bf1-47c6-950c-242129f7b2fe_4040011@0'
];
