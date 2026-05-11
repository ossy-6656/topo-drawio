/** 左侧「负荷」面板：配电站(zf06)、箱式变电站(zf08)；与 graphLg / parseUse 对齐 */
export const LG_SIDEBAR_DEVICE_ENTRIES = [
    ['substation', '配电站(zf06)', 70, 70],
    ['xb', '箱式变电站(zf08)', 70, 70],
]

export function lgSidebarDeviceIdsByLengthDesc() {
    return [...new Set(LG_SIDEBAR_DEVICE_ENTRIES.map((e) => e[0]))].sort(
        (a, b) => b.length - a.length
    )
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
