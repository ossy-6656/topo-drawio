/**
 * 将 CIM-G 厂站图 (.fac.pic.g，GBK) 转为与 src/view/graph/data/lgdata.js 相同的导出格式：
 *   var zjtSvg = "<svg ...>"
 *   export{zjtSvg}
 *
 * 说明：路径中形如 ._TEST_xxx 的文件多为 macOS AppleDouble 资源叉（非 XML）。
 * 若检测到会自动尝试同目录下去掉 ._ 前缀的真实图纸文件。
 *
 * 用法：
 *   node scripts/convert-fac-g-to-lgdata.mjs
 *   node scripts/convert-fac-g-to-lgdata.mjs -i <输入.g> -o <输出.js> --var mySvg
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import iconv from 'iconv-lite'
import { DOMParser } from '@xmldom/xmldom'
import SymbolParse from './parse/SymbolParse2.js'

/** xmldom 的 Element 无 getAttributeNames（常见于现代浏览器 DOM），SymbolParse2 依赖此方法 */
function polyfillElementGetAttributeNames() {
    const el = new DOMParser().parseFromString('<r/>', 'text/xml').documentElement
    const proto = Object.getPrototypeOf(el)
    if (proto && !proto.getAttributeNames) {
        proto.getAttributeNames = function getAttributeNames() {
            const out = []
            if (this.attributes) {
                for (let i = 0; i < this.attributes.length; i++) {
                    out.push(this.attributes[i].name)
                }
            }
            return out
        }
    }
}

function firstElementChild(el) {
    for (let c = el.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 1) return c
    }
    return null
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

function parseArgs(argv) {
    let input = ''
    let output = path.join(projectRoot, 'src/view/graph/data/lgdata.js')
    let varName = 'zjtSvg'
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i]
        if (a === '-i' || a === '--input') input = path.resolve(argv[++i])
        else if (a === '-o' || a === '--output') output = path.resolve(argv[++i])
        else if (a === '--var') varName = argv[++i]
    }
    if (!input) {
        input = path.join(
            projectRoot,
            'scripts/鹤壁220kV浚县变主接线图/CIM-G/display/fac/TEST_220kV浚县站_变电站主页.fac.pic.g'
        )
    }
    return { input, output, varName }
}

/** AppleDouble 资源叉魔数 */
function isAppleDouble(buf) {
    return buf.length >= 4 && buf[0] === 0x00 && buf[1] === 0x05 && buf[2] === 0x16 && buf[3] === 0x07
}

function resolveRealGFile(inputPath) {
    const base = path.resolve(inputPath)
    if (!fs.existsSync(base)) {
        throw new Error(`文件不存在: ${base}`)
    }
    const buf = fs.readFileSync(base)
    if (isAppleDouble(buf)) {
        const bn = path.basename(base)
        if (bn.startsWith('._')) {
            const alt = path.join(path.dirname(base), bn.slice(2))
            if (fs.existsSync(alt)) {
                console.warn(
                    `[convert] 输入为 AppleDouble 资源叉 (${bn})，已改读同目录实文件: ${path.basename(alt)}`
                )
                return alt
            }
        }
        throw new Error(
            '该文件为 macOS AppleDouble 资源叉，不是可解析的 G 图。请使用同目录下不带 ._ 前缀的 .g 文件（例如 TEST_...fac.pic.g）。'
        )
    }
    return base
}

function readAsXmlString(absPath) {
    const buf = fs.readFileSync(absPath)
    let xml = iconv.decode(buf, 'gbk')
    if (!/^\s*</.test(xml) && xml.indexOf('<') === -1) {
        xml = buf.toString('utf8')
    }
    return xml
}

function patchSymbolParseForNode() {
    SymbolParse.parse = function parseSymbolDom(symbol, id) {
        const sb = []
        const state = parseInt(symbol.getAttribute('state'), 10) || 0
        for (let i = 0; i < state; i++) {
            const symbolId = id + '_' + i
            sb.push(this.getContainer(symbol, symbolId))
            const layers = symbol.getElementsByTagName('Layer')
            const layer = layers[0]
            if (layer) {
                for (let j = 0; j < layer.childNodes.length; j++) {
                    const dom = layer.childNodes[j]
                    if (dom.nodeType !== 1) continue
                    if (dom.getAttribute('sta') !== String(i)) continue
                    const html = this.parseEle(dom)
                    if (html) sb.push(html)
                }
            }
            sb.push('</symbol>')
        }
        return sb.join('')
    }
}

function getSpecialSymbol(layerEl) {
    const map = {}
    for (let i = 0; i < layerEl.childNodes.length; i++) {
        const el = layerEl.childNodes[i]
        if (el.nodeType !== 1) continue
        const name = el.nodeName
        const devref = el.getAttribute('devref')
        if (devref) {
            if (!map[name]) map[name] = {}
            map[name][devref.substring(1)] = true
        }
    }
    return map
}

function parseSymbolDefs(spcMap, facBase) {
    const sb = ['<defs>']
    for (const nodeName of Object.keys(spcMap)) {
        const symbolMap = spcMap[nodeName]
        const subdir = nodeName.toLowerCase()
        for (const symbolName of Object.keys(symbolMap)) {
            const colon = symbolName.indexOf(':')
            const fileBase = colon >= 0 ? symbolName.slice(0, colon) : symbolName
            const filePath = path.join(facBase, subdir, fileBase)
            if (!fs.existsSync(filePath)) {
                console.warn(`[convert] 缺少图元文件，已跳过: ${filePath}`)
                continue
            }
            const xml = readAsXmlString(filePath)
            const doc = new DOMParser().parseFromString(xml, 'text/xml')
            const g = doc.documentElement
            if (!g || g.nodeName !== 'G') {
                console.warn(`[convert] 根节点不是 <G>: ${filePath}`)
                continue
            }
            const symbol = firstElementChild(g)
            if (!symbol) {
                console.warn(`[convert] <G> 下无元素子节点: ${filePath}`)
                continue
            }
            sb.push(SymbolParse.parse(symbol, symbolName))
        }
    }
    sb.push('</defs>')
    return sb.join('')
}

function parseLayerItems(list) {
    const sb = []
    for (let i = 0; i < list.length; i++) {
        const dom = list[i]
        if (dom.nodeType !== 1) continue
        const nodeName = dom.nodeName
        let html = ''
        switch (nodeName) {
            case 'rect':
                html = SymbolParse.parseRect(dom, true)
                break
            case 'polygon':
                html = SymbolParse.parsePolygon(dom, true)
                break
            case 'polyline':
                html = SymbolParse.parsePolyline(dom, true)
                break
            case 'ellipse':
                html = SymbolParse.parseEllipse(dom, true)
                break
            case 'BusbarSection':
            case 'ACLineSegment':
            case 'line':
                html = SymbolParse.parseLine(dom, true)
                break
            case 'Text':
                html = SymbolParse.parseText(dom, true)
                break
            case 'DText':
                html = SymbolParse.parseDText(dom, true)
                break
            case 'circlearc':
                html = SymbolParse.parseCirclearc(dom, true)
                break
            case 'ellipsear':
                html = SymbolParse.parseEllipsear(dom, true)
                break
            case 'Status':
            case 'PT':
            case 'GroundDisconnector':
            case 'Disconnector':
            case 'CBreaker':
                html = SymbolParse.parseDev(dom)
                break
            default:
                console.warn(`[convert] 未转换的节点类型: ${nodeName} id=${dom.getAttribute('id') || ''}`)
        }
        if (html) sb.push(html)
    }
    return sb.join('')
}

function buildSvgDocument(gEl, layerEl, facBase) {
    const w = gEl.getAttribute('w') || '2400'
    const h = gEl.getAttribute('h') || '1350'
    const bgc = gEl.getAttribute('bgc')

    const spcMap = getSpecialSymbol(layerEl)
    const defs = parseSymbolDefs(spcMap, facBase)

    const children = []
    for (let i = 0; i < layerEl.childNodes.length; i++) {
        const n = layerEl.childNodes[i]
        if (n.nodeType === 1) children.push(n)
    }
    const body = parseLayerItems(children)

    let bg = ''
    if (bgc) {
        bg =
            `<g id="BackGround_Layer"><rect fill="rgb(${bgc})" x="0" y="0" width="${w}" height="${h}"/></g>`
    }

    const inner = `${defs}${bg}${body}`
    const svg =
        `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n` +
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:cge="http://iec.ch/TC57/2005/SVG-schema#" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
        `width="${w}" height="${h}" coordinateExtent="0 0 ${w} ${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid">` +
        inner +
        `</svg>`
    return svg
}

function writeLgdataJs(svgXml, outputPath, varName) {
    const line1 = `var ${varName} = ${JSON.stringify(svgXml)}\n`
    const line2 = `export{${varName}}\n`
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, line1 + line2, 'utf8')
}

function main() {
    polyfillElementGetAttributeNames()
    const { input, output, varName } = parseArgs(process.argv)
    patchSymbolParseForNode()

    const gPath = resolveRealGFile(input)
    const facBase = path.dirname(gPath)
    const xml = readAsXmlString(gPath)
    const doc = new DOMParser().parseFromString(xml, 'text/xml')

    const gEl = doc.documentElement
    if (!gEl || gEl.nodeName !== 'G') {
        throw new Error('根元素应为 <G>')
    }
    const layerEl = gEl.getElementsByTagName('Layer')[0]
    if (!layerEl) {
        throw new Error('<G> 下缺少 <Layer>')
    }

    const svg = buildSvgDocument(gEl, layerEl, facBase)
    writeLgdataJs(svg, output, varName)
    console.log(`[convert] 已写入 ${output}（变量 ${varName}，约 ${Math.round(svg.length / 1024)} KB）`)
}

main()
