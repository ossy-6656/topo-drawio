/** 左侧「负荷」面板：默认宽高与 lgdata.js 内嵌 symbol（3×3）一致，× getScale 后与解析图元一致 */
export const LG_SIDEBAR_DEVICE_ENTRIES = [
    ['substation', '配电站(zf06)', 3, 3],
    ['xb', '箱式变电站(zf08)', 3, 3],
]

/** 左侧「变压器」面板：0314；无黑底；init 约 14×12 / 15×13，× getScale 后接近站内其它设备量级 */
export const LG_SIDEBAR_TRANSFORMER_ENTRIES = [
    ['potentialtransformer2w', '电压互感器-双绕组(0314)', 14, 12, 'psrtype=0314;'],
    ['potentialtransformer3w', '电压互感器-三绕组(0314)', 15, 13, 'psrtype=0314;'],
]

/** 左侧「机组」面板：空心圆 + G，与变压器同量级 */
export const LG_SIDEBAR_UNIT_ENTRIES = [['generatingunit', '发电机组', 14, 14]]

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
