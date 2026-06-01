/**
 * 由 scripts/convert-svg-to-lgdata-js.mjs 根据 data/*.svg 生成
 * 勿手改各 *.js 内 SVG 字符串；改 SVG 后重新运行脚本
 */
import { changcunSvg } from './changcun.js'
import { tongjiSvg } from './tongji.js'
import { zhanghengSvg } from './zhangheng.js'
import { jinyiSvg } from './jinyi.js'
import { yongqiuSvg } from './yongqiu.js'
import { longtanSvg } from './longtan.js'
import { fulongSvg } from './fulong.js'

export const STATION_DATA_OPTIONS = [
    { value: 'changcun', label: '常村变电站', svg: changcunSvg },
    { value: 'tongji', label: '同济变电站', svg: tongjiSvg },
    { value: 'zhangheng', label: '张衡变电站', svg: zhanghengSvg },
    { value: 'jinyi', label: '锦艺变电站', svg: jinyiSvg },
    { value: 'yongqiu', label: '雍丘变电站', svg: yongqiuSvg },
    { value: 'longtan', label: '龙潭变电站', svg: longtanSvg },
    { value: 'fulong', label: '浮龙变电站', svg: fulongSvg }
]

export const STATION_DATA_MAP = Object.fromEntries(
    STATION_DATA_OPTIONS.map((o) => [o.value, o.svg])
)
