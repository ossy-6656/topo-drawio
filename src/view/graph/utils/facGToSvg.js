/**
 * 浏览器端：将 CIM-G 厂站图（.g，GBK）转为与 lgdata 同结构的 SVG 字符串。
 * 图元文件通过 Vite import.meta.glob 从仓库 scripts/.../display/fac 按需加载。
 *
 * 字符编码：使用原生 TextDecoder（gb18030/gbk），不引入 iconv-lite，避免 Vite 预构建
 * “Outdated Optimize Dep / 504” 及对 Node 专用包的解析问题。
 */
import SymbolParse from '../../../../scripts/parse/SymbolParse2.js'

let symbolParsePatched = false

function ensureSymbolParsePatched() {
    if (symbolParsePatched) return
    symbolParsePatched = true
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

function firstElementChild(el) {
    for (let c = el.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 1) return c
    }
    return null
}

/** AppleDouble 资源叉 */
export function isAppleDoubleBuffer(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
    return u8.length >= 4 && u8[0] === 0x00 && u8[1] === 0x05 && u8[2] === 0x16 && u8[3] === 0x07
}

/**
 * 解码力光 .g（通常 GBK）；与 Node 脚本中 iconv gbk 等价优先使用 gb18030/gbk。
 * 不依赖 iconv-lite，避免 Vite 预构建异常。
 */
export function decodeGFileBuffer(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
    for (const label of ['gb18030', 'gbk']) {
        try {
            return new TextDecoder(label, { fatal: false }).decode(u8)
        } catch {
            continue
        }
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(u8)
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

/** 懒构建：glob 键 → 异步加载 raw 文本的工厂 */
let facSymbolLoaders = null

function getFacSymbolLoaderMap() {
    if (facSymbolLoaders !== null) return facSymbolLoaders
    facSymbolLoaders = new Map()
    const modules = import.meta.glob(
        '../../../../scripts/鹤壁220kV浚县变主接线图/CIM-G/display/fac/**/*.g',
        { query: '?raw', import: 'default' }
    )
    const marker = '/display/fac/'
    for (const [fullPath, loader] of Object.entries(modules)) {
        const normalized = fullPath.replace(/\\/g, '/')
        const idx = normalized.indexOf(marker)
        if (idx === -1) continue
        const rel = normalized.slice(idx + marker.length)
        facSymbolLoaders.set(rel, loader)
    }
    return facSymbolLoaders
}

async function loadSymbolXmlFromProject(subdir, fileBase) {
    const key = `${subdir}/${fileBase}`.replace(/\\/g, '/')
    const map = getFacSymbolLoaderMap()
    const loader = map.get(key)
    if (!loader) return null
    try {
        const raw = await loader()
        return typeof raw === 'string' ? raw : String(raw)
    } catch {
        return null
    }
}

/** 与 lgdata 类似的最小 CSS，便于画布解析 stroke/fill class */
const FAC_DEFS_MIN_STYLE = `<style type="text/css"><![CDATA[
symbol {overflow:visible}
.kv10 {fill:none;stroke:rgb(240,65,85);stroke-width:1;}
.lkv220 {fill:none;stroke:rgb(128,0,128);stroke-width:1;}
]]></style>`

function escapeXmlAttr(s) {
    if (s == null || s === '') return ''
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

const PSR_TYPE_BY_G_NODE = {
    CBreaker: '0305',
    Disconnector: '0306',
    GroundDisconnector: '0311',
    PT: '0313',
    Status: '0320',
}

function psrTypeForGNode(nodeName) {
    return PSR_TYPE_BY_G_NODE[nodeName] || '0305'
}

function normalizeFacUseFragment(useXml) {
    if (!useXml) return useXml
    let s = useXml.trim()
    if (!/\bxlink:href\s*=/.test(s)) {
        s = s.replace(/\bhref\s*=\s*"#/i, 'xlink:href="#')
    }
    if (!/\bclass\s*=/.test(s)) {
        s = s.replace(/<use\s+/i, '<use class="kv10" ')
    }
    return s
}

function wrapDeviceUseGroup(dom, useInner) {
    const id = dom.getAttribute('id') || 'PD_unknown'
    const name = escapeXmlAttr(dom.getAttribute('keyname') || dom.getAttribute('keyid') || id)
    const psr = psrTypeForGNode(dom.nodeName)
    const frag = normalizeFacUseFragment(useInner)
    return (
        `<g id="${escapeXmlAttr(id)}">` +
        frag +
        `<metadata>` +
        `<cge:PSR_Ref ObjectID="${escapeXmlAttr(id)}" ObjectName="${name}" PSRType="${psr}"/>` +
        `<cge:Layer_Ref ObjectName="Breaker_Layer"/>` +
        `</metadata></g>`
    )
}

function lineGToPolylineSvg(dom) {
    const x1 = dom.getAttribute('x1')
    const y1 = dom.getAttribute('y1')
    const x2 = dom.getAttribute('x2')
    const y2 = dom.getAttribute('y2')
    const lc = dom.getAttribute('lc')
    const lw = dom.getAttribute('lw')
    let poly = '<polyline fill="none" '
    poly += `points="${escapeXmlAttr(x1)},${escapeXmlAttr(y1)} ${escapeXmlAttr(x2)},${escapeXmlAttr(y2)}" `
    if (lc) poly += `stroke="rgb(${escapeXmlAttr(lc)})" `
    if (lw) poly += `stroke-width="${escapeXmlAttr(lw)}" `
    poly += 'class="lkv220" />'
    return poly
}

function wrapLineLikeGroup(dom, innerSvg, idx) {
    const id = dom.getAttribute('id') || `PD_line_${idx}`
    const oid = escapeXmlAttr(id)
    const name = escapeXmlAttr(dom.getAttribute('name') || dom.getAttribute('keyname') || '')
    return (
        `<g id="${oid}">` +
        innerSvg +
        `<metadata>` +
        `<cge:PSR_Ref ObjectID="${oid}" ObjectName="${name}" PSRType="36000000"/>` +
        `<cge:Layer_Ref ObjectName="ACLineSegment_Layer"/>` +
        `</metadata></g>`
    )
}

function wrapTextBlock(dom, textXml) {
    const rawId = dom.getAttribute('id') || 'TXT_misc'
    const gId = rawId.indexOf('TXT-') === 0 ? rawId : `TXT-${rawId}`
    const pid = dom.getAttribute('pid')
    const pidPart = pid ? ` pid="${escapeXmlAttr(pid)}"` : ''
    let inner = textXml.replace(/\s+id\s*=\s*"[^"]*"/i, ' ')
    const fs = dom.getAttribute('fs')
    if (fs && !/\bfont-size\s*=/.test(inner)) {
        inner = inner.replace(/<text\s/i, `<text font-size="${escapeXmlAttr(fs)}" `)
    }
    const gid = escapeXmlAttr(gId)
    return (
        `<g id="${gid}"${pidPart}>` +
        inner +
        `<metadata><cge:PSR_Ref ObjectID="${gid}"/><cge:Layer_Ref ObjectName="Text_Layer"/></metadata>` +
        `</g>`
    )
}

/**
 * LGSvgParser 要求：svg 下直接子节点为各 *_Layer 的 &lt;g&gt;，设备/线/文本为带 metadata 的分组。
 */
function buildLgCompatibleBody(children, onWarn) {
    const textParts = []
    const deviceParts = []
    const lineParts = []

    for (let i = 0; i < children.length; i++) {
        const dom = children[i]
        if (dom.nodeType !== 1) continue
        const nodeName = dom.nodeName

        switch (nodeName) {
            case 'rect':
            case 'polygon':
            case 'ellipse':
            case 'circlearc':
            case 'ellipsear':
                if (onWarn) onWarn(nodeName, dom.getAttribute('id'))
                break
            case 'polyline': {
                const inner = SymbolParse.parsePolyline(dom, true)
                if (inner) lineParts.push(wrapLineLikeGroup(dom, inner, i))
                break
            }
            case 'BusbarSection':
            case 'ACLineSegment':
            case 'line': {
                const inner = lineGToPolylineSvg(dom)
                lineParts.push(wrapLineLikeGroup(dom, inner, i))
                break
            }
            case 'Text': {
                const inner = SymbolParse.parseText(dom)
                if (inner) textParts.push(wrapTextBlock(dom, inner))
                break
            }
            case 'DText': {
                const inner = SymbolParse.parseDText(dom)
                if (inner) textParts.push(wrapTextBlock(dom, inner))
                break
            }
            case 'Status':
            case 'PT':
            case 'GroundDisconnector':
            case 'Disconnector':
            case 'CBreaker': {
                const inner = SymbolParse.parseDev(dom)
                if (inner) deviceParts.push(wrapDeviceUseGroup(dom, inner))
                break
            }
            default:
                if (onWarn) onWarn(nodeName, dom.getAttribute('id'))
        }
    }

    return (
        `<g id="Breaker_Layer">${deviceParts.join('')}</g>` +
        `<g id="ACLineSegment_Layer">${lineParts.join('')}</g>` +
        `<g id="Text_Layer">${textParts.join('')}</g>` +
        `<g id="Hot_Layer"></g>` +
        `<g id="Point_Layer"></g>`
    )
}

async function parseSymbolDefs(spcMap, onMissing) {
    const sb = ['<defs>', FAC_DEFS_MIN_STYLE]
    for (const nodeName of Object.keys(spcMap)) {
        const symbolMap = spcMap[nodeName]
        const subdir = nodeName.toLowerCase()
        for (const symbolName of Object.keys(symbolMap)) {
            const colon = symbolName.indexOf(':')
            const fileBase = colon >= 0 ? symbolName.slice(0, colon) : symbolName
            const xmlStr = await loadSymbolXmlFromProject(subdir, fileBase)
            if (!xmlStr) {
                if (onMissing) onMissing(`${subdir}/${fileBase}`)
                continue
            }
            const doc = new DOMParser().parseFromString(xmlStr, 'text/xml')
            const g = doc.documentElement
            if (!g || g.nodeName !== 'G') continue
            const symbol = firstElementChild(g)
            if (!symbol) continue
            sb.push(SymbolParse.parse(symbol, symbolName))
        }
    }
    sb.push('</defs>')
    return sb.join('')
}

async function buildSvgDocument(gEl, layerEl, options) {
    const w = gEl.getAttribute('w') || '2400'
    const h = gEl.getAttribute('h') || '1350'
    const bgc = gEl.getAttribute('bgc')

    const spcMap = getSpecialSymbol(layerEl)
    const missingSymbols = []
    const defs = await parseSymbolDefs(spcMap, (path) => missingSymbols.push(path))

    const children = []
    for (let i = 0; i < layerEl.childNodes.length; i++) {
        const n = layerEl.childNodes[i]
        if (n.nodeType === 1) children.push(n)
    }
    const warnNodes = options?.quiet ? () => {} : (type, id) => console.warn(`[facG] 未转换节点: ${type} id=${id || ''}`)
    const body = buildLgCompatibleBody(children, warnNodes)

    let bg = ''
    if (bgc) {
        bg = `<g id="BackGround_Layer"><rect fill="rgb(${bgc})" x="0" y="0" width="${w}" height="${h}"/></g>`
    }

    const inner = `${defs}${bg}${body}`
    const svg =
        `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n` +
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:cge="http://iec.ch/TC57/2005/SVG-schema#" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
        `width="${w}" height="${h}" coordinateExtent="0 0 ${w} ${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid">` +
        inner +
        `</svg>`
    return { svg, missingSymbols }
}

/**
 * @param {ArrayBuffer} arrayBuffer - 主接线 .g 文件内容
 * @param {{ quiet?: boolean }} [options]
 * @returns {Promise<{ svg: string, missingSymbols: string[] }>}
 */
export async function convertFacGBufferToSvg(arrayBuffer, options) {
    ensureSymbolParsePatched()
    if (isAppleDoubleBuffer(arrayBuffer)) {
        throw new Error(
            '该文件为 macOS 资源叉（AppleDouble），不是 XML。请选择同名的主图 .g 文件，或使用去掉 ._ 前缀的那份文件。'
        )
    }
    const xml = decodeGFileBuffer(arrayBuffer)
    const doc = new DOMParser().parseFromString(xml, 'text/xml')
    const gEl = doc.documentElement
    if (!gEl || gEl.nodeName !== 'G') {
        throw new Error('根元素应为 <G>，请确认是力光/CIM-G 厂站图 .g 文件')
    }
    const layerEl = gEl.getElementsByTagName('Layer')[0]
    if (!layerEl) {
        throw new Error('<G> 下缺少 <Layer>')
    }
    return buildSvgDocument(gEl, layerEl, options)
}
