/**
 * 无图中 shapeDragDefaults 时，侧栏拖入宽高 = ((1-t)×条目网格 + t×symbol 声明宽高 symEntry.w/h)×getScale。
 * t=0 偏小，t=1 偏大；配电站/箱变 w=h=3 时与 t 无关。变压器/机组由 graphLg 以双绕组为锚统一尺寸。
 */
export const LG_SIDEBAR_DRAG_SYMBOL_BLEND = 0.12

/** 左侧「负荷」面板：默认宽高与 lgdata.js 内嵌 symbol（3×3）一致，× getScale 后与解析图元一致 */
export const LG_SIDEBAR_DEVICE_ENTRIES = [
    ['substation', '配电站(zf06)', 3, 3],
    ['xb', '箱式变电站(zf08)', 3, 3],
]

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
    LG_SIDEBAR_TRANSFORMER_ENTRIES,
    LG_SIDEBAR_UNIT_ENTRIES,
]

export function lgSidebarDeviceIdsByLengthDesc() {
    const ids = LG_SIDEBAR_ALL_VERTEX_ENTRY_LISTS.flat().map((e) => e[0])
    return [...new Set(ids)].sort((a, b) => b.length - a.length)
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
    'breaker0305',
    'lightningarrester',
    'substation_30000005_1030020',
    'LoadBreakSwitch_PMS25_a1fd8575-5bf1-47c6-950c-242129f7b2fe_4040011@0'
];
