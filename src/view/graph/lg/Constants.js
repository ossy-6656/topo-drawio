/** 左侧电力设备面板：与 graphLg / parseUse 对齐；id 较长者须排在短 id 之前供前缀匹配 */
export const LG_SIDEBAR_DEVICE_ENTRIES = [
    ['LoadBreakSwitch_PMS25_a1fd8575-5bf1-47c6-950c-242129f7b2fe_4040011@0', '站内—负荷开关（分）', 120, 44],
    ['Substation_PMS25_d5483a04-3f50-423d-ad63-93cf5d024385_1030000', '变电站', 70, 70],
    ['breaker0305', '站内-断路器(0305)', 120, 56],
    ['grounddisconnector', '接地刀闸', 120, 61],
    ['powertransformer', '变压器', 90, 98],
    ['potentialtransformer', '电压互感器', 70, 68],
    ['currenttransformer', '电流互感器', 60, 71],
    ['lightningarrester', '避雷器', 50, 80],
    ['disconnector', '隔离开关', 120, 74],
    ['remoteunit', '远动装置', 70, 70],
    ['substation', '配电站(zf06)', 70, 70],
    ['junction', '节点/T接', 52, 60],
    ['breaker', '断路器', 120, 63],
    ['fuse', '熔断器', 120, 51],
    ['polecode', '杆塔', 50, 50],
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
