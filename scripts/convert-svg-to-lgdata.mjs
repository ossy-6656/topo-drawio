/**
 * 将 SVG 文件转为与 src/view/graph/data/lgdata.js 相同的导出格式：
 *   var zjtSvg = "<svg ...>"
 *   export{zjtSvg}
 *
 * 用法：
 *   node scripts/convert-svg-to-lgdata.mjs
 *   node scripts/convert-svg-to-lgdata.mjs -i src/view/graph/data/dkxdata.svg -o src/view/graph/data/dkxdata.js --var dkxSvg
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

function parseArgs(argv) {
    let input = path.join(projectRoot, 'src/view/graph/data/dkxdata.svg')
    let output = path.join(projectRoot, 'src/view/graph/data/dkxdata.js')
    let varName = 'dkxSvg'
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i]
        if (a === '-i' || a === '--input') input = path.resolve(argv[++i])
        else if (a === '-o' || a === '--output') output = path.resolve(argv[++i])
        else if (a === '--var') varName = argv[++i]
    }
    return { input, output, varName }
}

function normalizeSvgDeclaration(svgXml) {
    return svgXml.replace(
        /<\?xml\s+version="1\.0"\s+encoding="UTF-8"\s*\?>/i,
        '<?xml version="1.0" encoding="UTF-8" standalone="no"?>'
    )
}

function writeLgdataJs(svgXml, outputPath, varName) {
    const line1 = `var ${varName} = ${JSON.stringify(svgXml)}\n`
    const line2 = `export{${varName}}\n`
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, line1 + line2, 'utf8')
}

function main() {
    const { input, output, varName } = parseArgs(process.argv)
    if (!fs.existsSync(input)) {
        throw new Error(`文件不存在: ${input}`)
    }
    let svgXml = fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, '')
    if (!/^\s*<\?xml/i.test(svgXml) && !/^\s*<svg/i.test(svgXml)) {
        throw new Error(`不是有效的 SVG 文件: ${input}`)
    }
    svgXml = normalizeSvgDeclaration(svgXml)
    writeLgdataJs(svgXml, output, varName)
    console.log(`[convert] 已写入 ${output}（变量 ${varName}，约 ${Math.round(svgXml.length / 1024)} KB）`)
}

main()
