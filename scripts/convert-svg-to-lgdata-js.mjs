/**
 * 将 src/view/graph/data 下的 *.svg 转为 lgdata.js 同结构（var xxx = "..."; export{xxx}）
 * 用法: node scripts/convert-svg-to-lgdata-js.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(__dirname, '../src/view/graph/data')

/** 仅转换厂站 SVG（排除已有独立 js 的 dkxdata.svg） */
const STATION_SVG_MAP = [
    { file: '常村变电站.svg', exportName: 'changcunSvg', key: 'changcun' },
    { file: '同济变电站.svg', exportName: 'tongjiSvg', key: 'tongji' },
    { file: '张衡变电站.svg', exportName: 'zhanghengSvg', key: 'zhangheng' },
    { file: '锦艺变电站.svg', exportName: 'jinyiSvg', key: 'jinyi' },
    { file: '雍丘变电站.svg', exportName: 'yongqiuSvg', key: 'yongqiu' },
    { file: '龙潭变电站.svg', exportName: 'longtanSvg', key: 'longtan' },
    { file: '浮龙变电站.svg', exportName: 'fulongSvg', key: 'fulong' },
]

function normalizeSvgForLgdata(svg) {
    let s = svg.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim()
    if (!s.startsWith('<?xml')) {
        s = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + s
    } else if (!/standalone=/i.test(s.slice(0, 200))) {
        s = s.replace(
            /(<\?xml[^?]*)(\?>)/i,
            (_, head, end) => (/\bstandalone=/i.test(head) ? head + end : `${head} standalone="no"${end}`)
        )
    }
    return s
}

function writeLgdataJs(outPath, exportName, svgContent) {
    const normalized = normalizeSvgForLgdata(svgContent)
    const code = `var ${exportName} = ${JSON.stringify(normalized)};\nexport{${exportName}}\n`
    fs.writeFileSync(outPath, code, 'utf8')
}

const registry = []

for (const item of STATION_SVG_MAP) {
    const svgPath = path.join(dataDir, item.file)
    if (!fs.existsSync(svgPath)) {
        console.warn('[skip] 未找到:', svgPath)
        continue
    }
    const jsName = `${item.key}.js`
    const jsPath = path.join(dataDir, jsName)
    const svg = fs.readFileSync(svgPath, 'utf8')
    writeLgdataJs(jsPath, item.exportName, svg)
    const label = item.file.replace(/\.svg$/i, '')
    registry.push({
        key: item.key,
        exportName: item.exportName,
        label,
        jsFile: jsName,
    })
    console.log('[ok]', item.file, '->', jsName, `(${(fs.statSync(jsPath).size / 1024).toFixed(1)} KB)`)
}

const registryPath = path.join(dataDir, 'stationDatasets.js')
const importLines = registry.map((r) => `import { ${r.exportName} } from './${r.key}.js'`).join('\n')
const entries = registry
    .map(
        (r) =>
            `    { value: '${r.key}', label: '${r.label}', svg: ${r.exportName} }`
    )
    .join(',\n')

const registryCode = `/**
 * 由 scripts/convert-svg-to-lgdata-js.mjs 根据 data/*.svg 生成
 * 勿手改各 *.js 内 SVG 字符串；改 SVG 后重新运行脚本
 */
${importLines}

export const STATION_DATA_OPTIONS = [
${entries}
]

export const STATION_DATA_MAP = Object.fromEntries(
    STATION_DATA_OPTIONS.map((o) => [o.value, o.svg])
)
`

fs.writeFileSync(registryPath, registryCode, 'utf8')
console.log('[ok] registry -> stationDatasets.js')
