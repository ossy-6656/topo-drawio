/**
 * 无图中 shapeDragDefaults 时，侧栏拖入宽高 = ((1-t)×条目网格 + t×symbol 声明宽高 symEntry.w/h)×getScale。
 * t=0 偏小，t=1 偏大；配电站/箱变 w=h=3 时与 t 无关。变压器/机组由 graphLg 以双绕组为锚统一尺寸。
 */
export const LG_SIDEBAR_DRAG_SYMBOL_BLEND = 0.12

/** 侧栏「站内-断路器(0305)」无图中参考时的网格边长（× getScale）；有 lgdata 时以 shapeDragDefaults 为准 */
export const LG_SIDEBAR_SWITCH_GRID_WH = 10

/** lgdata 中 Breaker_30500000 use 元素 transform scale 典型值（与导入断路器视觉一致） */
export const LG_LGDATA_BREAKER_TYPICAL_USE_SCALE = 10.857673

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
