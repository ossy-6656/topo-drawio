/**
 * 无图中 shapeDragDefaults 时，侧栏拖入宽高 = ((1-t)×条目网格 + t×symbol 声明宽高 symEntry.w/h)×getScale。
 * t=0 偏小，t=1 偏大；配电站/箱变 w=h=3 时与 t 无关。变压器/机组由 graphLg 以双绕组为锚统一尺寸。
 */
export const LG_SIDEBAR_DRAG_SYMBOL_BLEND = 0.12

/** 侧栏「站内-断路器(0305)」拖入画布网格边长（× getScale） */
export const LG_SIDEBAR_SWITCH_GRID_WH = 10

/** 左侧「开关」面板：站内断路器 0305，固定 10×10，可旋转 */
export const LG_SIDEBAR_SWITCH_ENTRIES = [
    [
        'cbreaker',
        '站内-断路器(0305)',
        LG_SIDEBAR_SWITCH_GRID_WH,
        LG_SIDEBAR_SWITCH_GRID_WH,
        'psrtype=0305;strokeColor=none;rotation=0;rotatable=1;resizable=1;',
    ],
]

/** 侧栏/画布站内断路器(0305)：shape 或 PSRType 判定 */
export function isLgSwitchShapeOrPsr(shapeOrSymbol, psrtype) {
    const sym = String(shapeOrSymbol || '').toLowerCase()
    const psr = String(psrtype || '')
    return sym === 'cbreaker' || sym.startsWith('breaker_30500000') || psr === '0305'
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

/** 侧栏/画布负荷图元：配电站、箱变、柱上用户变压器(0110) */
export function isLgLoadShapeOrPsr(shapeOrSymbol, psrtype) {
    const sym = String(shapeOrSymbol || '').toLowerCase()
    const psr = String(psrtype || '')
    if (sym === 'substation' || sym === 'xb' || sym === 'ptuser') {
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
