/** 左侧「负荷」面板：仅配电站(zf06)、变电站、箱式变电站(zf08)；与 graphLg / parseUse 对齐 */
export const LG_SIDEBAR_DEVICE_ENTRIES = [
    ['substation', '配电站(zf06)', 70, 70],
    ['Substation_PMS25_d5483a04-3f50-423d-ad63-93cf5d024385_1030000', '变电站', 70, 70],
    ['xb', '箱式变电站(zf08)', 70, 70],
]

export function lgSidebarDeviceIdsByLengthDesc() {
    return [...new Set(LG_SIDEBAR_DEVICE_ENTRIES.map((e) => e[0]))].sort(
        (a, b) => b.length - a.length
    )
}

// 自定义的symbol id
export const customShapeLs = [
    'bridgeoverriver',
    'bridgeoverroad',
    'tunnel', 
    'tree',
    'mountain', 
    'lakes',
    'river',
    'breaker0305',
    'xb',
    'lightningarrester',
    'substation_30000005_1030020',
    'Substation_PMS25_d5483a04-3f50-423d-ad63-93cf5d024385_1030000',
    'LoadBreakSwitch_PMS25_a1fd8575-5bf1-47c6-950c-242129f7b2fe_4040011@0'
];
