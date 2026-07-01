/**
 * 浏览器端：将 CIM-G 厂站图（.g，GBK）转为与 lgdata 同结构的 SVG 字符串。
 * 图元文件通过 /__cim-g-element/ 按路径读取 scripts/CIM-G/element（避免 glob 对 # 等文件名报错）。
 *
 * 字符编码：使用原生 TextDecoder（gb18030/gbk），不引入 iconv-lite，避免 Vite 预构建
 * “Outdated Optimize Dep / 504” 及对 Node 专用包的解析问题。
 */
import SymbolParse from '../../../../scripts/parse/SymbolParse2.js';

let symbolParsePatched = false;

function ensureSymbolParsePatched() {
    if (symbolParsePatched) return;
    symbolParsePatched = true;
    const origGetContainer = SymbolParse.getContainer.bind(SymbolParse);
    SymbolParse.getContainer = function getContainerSvg(con, id) {
        const raw = origGetContainer(con, id);
        const w = con.getAttribute('w');
        const h = con.getAttribute('h');
        if (w && h) {
            return raw.replace('">', `" viewBox="0 0 ${w} ${h}">`);
        }
        return raw;
    };
    SymbolParse.parse = function parseSymbolDom(symbol, id, nodeName) {
        const sb = [];
        const state = parseInt(symbol.getAttribute('state'), 10) || 0;
        for (let i = 0; i < state; i++) {
            const symbolId = id + '_' + i;
            sb.push(this.getContainer(symbol, symbolId));
            const layers = symbol.getElementsByTagName('Layer');
            for (let k = 0; k < layers.length; k++) {
                const layer = layers[k];
                for (let j = 0; j < layer.childNodes.length; j++) {
                    const dom = layer.childNodes[j];
                    if (dom.nodeType !== 1) continue;
                    if (dom.getAttribute('sta') !== String(i)) continue;
                    const html = this.parseEle(dom);
                    if (html) sb.push(html);
                }
            }
            sb.push('</symbol>');
        }
        // if (nodeName == 'CBreaker' || nodeName == 'Transformer3') console.log('sbsbsbsbsb', sb)
        return sb.join('');
    };

    const origParseDev = SymbolParse.parseDev.bind(SymbolParse);
    SymbolParse.parseDev = function parseDevSafe(dom, devMap) {
        if (!devrefToSymbolKey(dom.getAttribute('devref'))) {
            return '';
        }
        return origParseDev(dom, devMap) || '';
    };
}

function firstElementChild(el) {
    for (let c = el.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 1) return c;
    }
    return null;
}

/** devref 可能缺失或非 # 开头，统一为 symbol 键（不含 #） */
function devrefToSymbolKey(devref) {
    if (devref == null) return null;
    const s = String(devref).trim();
    if (!s) return null;
    return s.charAt(0) === '#' ? s.substring(1) : s;
}

/** AppleDouble 资源叉 */
export function isAppleDoubleBuffer(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    return u8.length >= 4 && u8[0] === 0x00 && u8[1] === 0x05 && u8[2] === 0x16 && u8[3] === 0x07;
}

/**
 * 解码力光 .g（通常 GBK）；与 Node 脚本中 iconv gbk 等价优先使用 gb18030/gbk。
 * 不依赖 iconv-lite，避免 Vite 预构建异常。
 */
export function decodeGFileBuffer(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    for (const label of ['gb18030', 'gbk']) {
        try {
            return new TextDecoder(label, { fatal: false }).decode(u8);
        } catch {
            continue;
        }
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(u8);
}

function getSpecialSymbol(layerEl) {
    const map = {};
    for (let i = 0; i < layerEl.childNodes.length; i++) {
        const el = layerEl.childNodes[i];
        if (el.nodeType !== 1) continue;
        const name = el.nodeName;
        const devref = el.getAttribute('devref');
        const symbolKey = devrefToSymbolKey(devref);
        if (symbolKey) {
            if (!map[name]) map[name] = {};
            map[name][symbolKey] = true;
        }
    }
    return map;
}

const CIM_G_ELEMENT_URL_PREFIX = '/__cim-g-element/';

function buildCimElementFetchUrl(relativeKey) {
    return CIM_G_ELEMENT_URL_PREFIX + relativeKey.split('/').map(encodeURIComponent).join('/');
}

async function loadSymbolXmlFromProject(subdir, fileBase) {
    const key = `${subdir}/${fileBase}`.replace(/\\/g, '/');
    try {
        const response = await fetch(buildCimElementFetchUrl(key));
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        const raw = decodeGFileBuffer(arrayBuffer);
        return raw.replace(/encoding="[^"]*"/i, 'encoding="UTF-8"');
    } catch {
        return null;
    }
}

/** 与 lgdata 类似的最小 CSS，便于画布解析 stroke/fill class */
const FAC_DEFS_MIN_STYLE = `<style type="text/css"><![CDATA[
symbol {overflow:visible}
.kv10 {fill:none;stroke:rgb(240,65,85);stroke-width:5;}
.lkv220 {fill:none;stroke:rgb(128,0,128);stroke-width:5;}
]]></style>`;

function escapeXmlAttr(s) {
    if (s == null || s === '') return '';
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const PSR_TYPE_BY_G_NODE = {
    CBreaker: '0305',
    Disconnector: '0306',
    GroundDisconnector: '0311',
    PT: '0313',
    Status: '0320',
    Protect: '0325',
    Gzp: '0326',
    EnergyConsumer: '0302',
    Transformer3: '0304',
    Bus: '0308',
    BusbarSection: '0311',
    poke: '0399',
};

function psrTypeForGNode(nodeName) {
    return PSR_TYPE_BY_G_NODE[nodeName] || '0305';
}

function normalizeFacUseFragment(useXml) {
    if (!useXml) return useXml;
    let s = useXml.trim();
    if (!/\bxlink:href\s*=/.test(s)) {
        s = s.replace(/\bhref\s*=\s*"#/i, 'xlink:href="#');
    }
    if (!/\bclass\s*=/.test(s)) {
        s = s.replace(/<use\s+/i, '<use class="kv10" ');
    }
    return s;
}

function appendXmlAttr(attrs, key, value) {
    if (value == null || value === '') return attrs;
    return attrs + ` ${key}="${escapeXmlAttr(String(value))}"`;
}

function buildPsrRefAttrs(dom, psrType) {
    const id = dom.getAttribute('id') || 'PD_unknown';
    const nodeName = dom.nodeName;
    let name =
        dom.getAttribute('keyname') ||
        dom.getAttribute('key_name') ||
        dom.getAttribute('name') ||
        '';
    if (!name && nodeName === 'Transformer3') {
        name = dom.getAttribute('key_name1') || id;
    }
    name = name || id;
    const psr = psrType || psrTypeForGNode(nodeName);
    let attrs = `ObjectID="${escapeXmlAttr(id)}" ObjectName="${escapeXmlAttr(name)}" PSRType="${psr}"`;
    const keyid = dom.getAttribute('keyid') || dom.getAttribute('keyid1');
    const rtkeyid = dom.getAttribute('rtkeyid') || dom.getAttribute('rtkeyid1');
    const keyName = dom.getAttribute('key_name') || dom.getAttribute('key_name1');
    const voltype = dom.getAttribute('voltype') || dom.getAttribute('voltype1');
    attrs = appendXmlAttr(attrs, 'keyid', keyid);
    attrs = appendXmlAttr(attrs, 'rtkeyid', rtkeyid);
    attrs = appendXmlAttr(attrs, 'key_name', keyName);
    attrs = appendXmlAttr(attrs, 'voltype', voltype);
    return attrs;
}

function wrapDeviceUseGroup(dom, useInner) {
    const id = dom.getAttribute('id') || 'PD_unknown';
    const psrAttrs = buildPsrRefAttrs(dom);
    const frag = normalizeFacUseFragment(useInner);
    return `<g id="${escapeXmlAttr(id)}">` + frag + `<metadata>` + `<cge:PSR_Ref ${psrAttrs}/>` + `<cge:Layer_Ref ObjectName="Breaker_Layer"/>` + `</metadata></g>`;
}

function lineGToPolylineSvg(dom) {
    const x1 = dom.getAttribute('x1');
    const y1 = dom.getAttribute('y1');
    const x2 = dom.getAttribute('x2');
    const y2 = dom.getAttribute('y2');
    const lc = dom.getAttribute('lc');
    const lw = dom.getAttribute('lw');
    let poly = '<polyline fill="none" ';
    poly += `points="${escapeXmlAttr(x1)},${escapeXmlAttr(y1)} ${escapeXmlAttr(x2)},${escapeXmlAttr(y2)}" `;
    if (lc) poly += `stroke="rgb(${escapeXmlAttr(lc)})" `;
    if (lw) poly += `stroke-width="${escapeXmlAttr(lw)}" `;
    poly += '/>';
    poly += ' />';

    return poly;
}

function feederShortName(keyName) {
    if (!keyName) return '';
    const s = String(keyName);
    const dot = s.lastIndexOf('.');
    if (dot >= 0 && dot < s.length - 1) return s.slice(dot + 1);
    const slash = s.lastIndexOf('/');
    if (slash >= 0 && slash < s.length - 1) return s.slice(slash + 1);
    return s;
}

function wrapLineLikeGroup(dom, innerSvg, idx, psrType) {
    const id = dom.getAttribute('id') || `PD_line_${idx}`;
    const oid = escapeXmlAttr(id);
    const psrAttrs = buildPsrRefAttrs(dom, psrType || '36000000');
    return `<g id="${oid}">` + innerSvg + `<metadata>` + `<cge:PSR_Ref ${psrAttrs}/>` + `<cge:Layer_Ref ObjectName="ACLineSegment_Layer"/>` + `</metadata></g>`;
}

/** 站内图出线端（ACLineEnd）→ 可点击跳转至站外馈线图 */
function wrapAclineEndGroup(dom, innerSvg, idx) {
    const id = dom.getAttribute('id') || `PD_acline_${idx}`;
    const oid = escapeXmlAttr(id);
    const keyName = dom.getAttribute('key_name') || dom.getAttribute('keyname') || '';
    const keyid = dom.getAttribute('keyid') || '';
    const rtkeyid = dom.getAttribute('rtkeyid') || '';
    const shortName = feederShortName(keyName);
    const name = escapeXmlAttr(shortName || keyName || id);
    return `<g id="${oid}">` + innerSvg + `<metadata>` +
        `<cge:PSR_Ref ObjectID="${oid}" ObjectName="${name}" PSRType="12104104" key_name="${escapeXmlAttr(keyName)}" keyid="${escapeXmlAttr(keyid)}" rtkeyid="${escapeXmlAttr(rtkeyid)}"/>` +
        `<cge:Layer_Ref ObjectName="ACLineSegment_Layer"/>` +
        `</metadata></g>`;
}

function wrapTextBlock(dom, textXml) {
    const rawId = dom.getAttribute('id') || 'TXT_misc';
    const gId = rawId.indexOf('TXT-') === 0 ? rawId : `TXT-${rawId}`;
    const pid = dom.getAttribute('pid');
    const pidPart = pid ? ` pid="${escapeXmlAttr(pid)}"` : '';
    let inner = textXml.replace(/\s+id\s*=\s*"[^"]*"/i, ' ');
    const fs = dom.getAttribute('fs');
    if (fs && !/\bfont-size\s*=/.test(inner)) {
        inner = inner.replace(/<text\s/i, `<text font-size="${escapeXmlAttr(fs)}" `);
    }
    const gid = escapeXmlAttr(gId);
    return `<g id="${gid}"${pidPart}>` + inner + `<metadata><cge:PSR_Ref ObjectID="${gid}"/><cge:Layer_Ref ObjectName="Text_Layer"/></metadata>` + `</g>`;
}

function parse_link_ids(link_str){
    let ids = []
    if(!link_str) {
        return ids
    }
    let segments = link_str.trim().replace(/;+$/, "").split(';');
    segments.forEach((seg) => {
        let parts = seg.split(',')
        if (parts.length >= 3) {
            ids.push(parts[2])
        }
    })
    return ids
}

function get_best_voltype(voltype_list){
    let best = null;
    let best_level = -1;
    const VOLTAGE_CONFIG = {
        '1005': {color: '80,0,127',lv: 5},   // 220kV 紫
        '1006': {color: '240,65,85',lv: 4},   // 110kV 红
        '1008': {color: '255,255,0',lv: 3},   // 35kV 黄
        '1010': {color: '159,62,56',lv: 2}   // 10kV 红
    }
    for (const vt of voltype_list) {
      // 判断key是否存在配置里（对应python in）
      if (VOLTAGE_CONFIG.hasOwnProperty(vt)) {
        const lv = VOLTAGE_CONFIG[vt].lv; // 解构取值，_忽略第一个值
        if (lv > best_level) {
          best_level = lv;
          best = vt;
        }
      }
    }
    return best;
}

function parse_node_area(node_area_str) {
    const res = [];
    // 空字符串直接返回空数组
    if (!node_area_str) return res;

    // 对应: strip().rstrip(';').split(';')
    const segments = node_area_str.trim().replace(/;+$/, '').split(';');

    for (const seg of segments) {
        const parts = seg.split(',');
        if (parts.length >= 3) {
            const port_idx = parts[0];
            const node_id = parts[2];
            res.push([port_idx, node_id]); // js用数组替代python元组
        }
    }
    return res;
}
/**
 * LGSvgParser 要求：svg 下直接子节点为各 *_Layer 的 &lt;g&gt;，设备/线/文本为带 metadata 的分组。
 */
function buildLgCompatibleBody(children, onWarn) {
    // console.log(children);
    const textParts = [];
    const deviceParts = [];
    const lineParts = [];
    const inlineDefs = [];
    const VOLTAGE_CONFIG = {
        '1005': {color: '80,0,127',lv: 5},   // 220kV 紫
        '1006': {color: '240,65,85',lv: 4},   // 110kV 红
        '1008': {color: '255,255,0',lv: 3},   // 35kV 黄
        '1010': {color: '159,62,56',lv: 2}   // 10kV 红
    }
    let id_to_voltage = {}
    for (let i = 0; i < children.length; i++) {
        const dom = children[i];
        if (dom.nodeType !== 1) continue;
        const nodeName = dom.nodeName;
        
        let eid = dom.getAttribute('id')
        let vt = dom.getAttribute('voltype')
        if (VOLTAGE_CONFIG.hasOwnProperty(vt)) {
            id_to_voltage[eid] = vt
        }
        if(nodeName == 'Bus' && VOLTAGE_CONFIG.hasOwnProperty(vt)) {
            dom.setAttribute('lc',VOLTAGE_CONFIG[vt].color)
        }
    }
    // 第2遍：专门处理 Transformer3
    for (let i = 0; i < children.length; i++) {
        const dom = children[i];
        if (dom.nodeType !== 1) continue;
        const nodeName = dom.nodeName;
        let tid = dom.getAttribute('id')
        if (nodeName == 'Transformer3') {
            // 取三个绕组电压
            let vt1 = dom.getAttribute('voltype1')
            let vt2 = dom.getAttribute('voltype2')
            let vt3 = dom.getAttribute('voltype3')
            let vt_list = [vt1, vt2, vt3]
            
            // 整个变压器取最高电压（用于自身图元）
            let best_vt = get_best_voltype(vt_list)
            if (best_vt){
                id_to_voltage[tid] = best_vt
            }
            // 关键：node_area 每个端口ID 一一对应 voltype1/2/3
            let node_area = dom.getAttribute('node_area', '')
            let port_nodes = parse_node_area(node_area)
            // if(dom.getAttribute('id') == '103007888') {
            //     debugger
            // }
            port_nodes.forEach((item,index) => {
                if (index < vt_list.length) {
                    let vt = vt_list[index]
                    if (VOLTAGE_CONFIG.hasOwnProperty(vt)) {
                        id_to_voltage[item[1]] = vt
                    }
                }
            })
        }
    }
    for (let i = 0; i < children.length; i++) {
        const dom = children[i];
        if (dom.nodeType !== 1) continue;
        const nodeName = dom.nodeName;
        if (nodeName == 'ConnectLine'||nodeName == 'ACLineEnd') {
            let link_str = dom.getAttribute('link', '')
            let linked_ids = parse_link_ids(link_str)
            let best_vt = null
            let best_level = -1
            // if(dom.getAttribute('id') == '34007614') {
            //     debugger
            // }
            linked_ids.forEach((lid) => {
                if (id_to_voltage.hasOwnProperty(lid)) {
                    
                    let vt = id_to_voltage[lid]
                    let lv = VOLTAGE_CONFIG[vt].lv
                    if(lv > best_level){
                        best_level = lv
                        best_vt = vt
                    }
                }
            })
            if(id_to_voltage.hasOwnProperty(dom.getAttribute('id'))) {
                let vt = id_to_voltage[dom.getAttribute('id')]
                best_vt = vt
            }
            let color = VOLTAGE_CONFIG[best_vt]?VOLTAGE_CONFIG[best_vt].color : '128,128,128'
            
            dom.setAttribute('lc',color)
        }
    }

    for (let i = 0; i < children.length; i++) {
        const dom = children[i];
        if (dom.nodeType !== 1) continue;
        const nodeName = dom.nodeName;
        
        let eid = dom.getAttribute('id')
        let vt = dom.getAttribute('voltype')

        switch (nodeName) {
            case 'rect':
            case 'polygon':
            case 'ellipse':
            case 'circlearc':
            case 'ellipsear':
                if (onWarn) onWarn(nodeName, dom.getAttribute('id'));
                break;
            case 'polyline':
            case 'ConnectLine': {
                const inner = SymbolParse.parsePolyline(dom, true);
                if (inner) lineParts.push(wrapLineLikeGroup(dom, inner, i));
                break;
            }
            case 'ACLineEnd': {
                const inner = SymbolParse.parsePolyline(dom, true);
                if (inner) lineParts.push(wrapAclineEndGroup(dom, inner, i));
                break;
            }
            case 'BusbarSection':
            case 'Bus':
            case 'ACLineSegment':
            case 'line': {
                const inner = lineGToPolylineSvg(dom);
                const busPsr =
                    nodeName === 'Bus' || nodeName === 'BusbarSection'
                        ? psrTypeForGNode(nodeName)
                        : '36000000';
                lineParts.push(wrapLineLikeGroup(dom, inner, i, busPsr));
                break;
            }
            case 'Text': {
                const inner = SymbolParse.parseText(dom);
                if (inner) textParts.push(wrapTextBlock(dom, inner));
                break;
            }
            case 'DText': {
                const inner = SymbolParse.parseDText(dom);
                if (inner) textParts.push(wrapTextBlock(dom, inner));
                break;
            }
            case 'Status':
            case 'PT':
            case 'GroundDisconnector':
            case 'Disconnector':
            case 'CBreaker':
            case 'Protect':
            case 'Gzp':
            case 'EnergyConsumer':
            case 'Transformer3':
            case 'DollyBreaker':
            case 'Arrester':
            case 'Capacitor_P':
            case 'poke': {
                const inner = SymbolParse.parseDev(dom);
                if (inner) deviceParts.push(wrapDeviceUseGroup(dom, inner));
                break;
            }
            default:
                if (onWarn) onWarn(nodeName, dom.getAttribute('id'));
        }
    }

    return {
        body: `<g id="Breaker_Layer">${deviceParts.join('')}</g>` + `<g id="ACLineSegment_Layer">${lineParts.join('')}</g>` + `<g id="Text_Layer">${textParts.join('')}</g>` + `<g id="Hot_Layer"></g>` + `<g id="Point_Layer"></g>`,
        inlineDefs: inlineDefs.join(''),
    };
}

function convertISO88591ToUTF8(isoString) {
    // 将字符串按 ISO-8859-1 解码
    const isoDecoder = new TextDecoder('GBK');
    const bytes = Uint8Array.from(isoString, c => c.charCodeAt(0));
    return isoDecoder.decode(bytes);
}

async function parseSymbolDefs(spcMap, onMissing) {
    // console.log(spcMap);
    const sb = ['<defs>', FAC_DEFS_MIN_STYLE];

    for (const nodeName of Object.keys(spcMap)) {
        const symbolMap = spcMap[nodeName];
        const subdir = nodeName.toLowerCase();
        console.log(subdir);
        for (const symbolName of Object.keys(symbolMap)) {
            const colon = symbolName.indexOf(':');
            const fileBase = colon >= 0 ? symbolName.slice(0, colon) : symbolName;
            console.log(fileBase);
            // console.log('symbolNamesymbolNamesymbolNamesymbolName', symbolName, '解码---------',convertISO88591ToUTF8(symbolName))
            const xmlStr = await loadSymbolXmlFromProject(subdir, fileBase);
            console.log(xmlStr);
            if (!xmlStr) {
                if (onMissing) onMissing(`${subdir}/${fileBase}`);
                continue;
            }
            const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');
            // console.log('docdocdoc', doc)
            const g = doc.documentElement;
            if (!g || g.nodeName !== 'G') continue;
            const symbol = firstElementChild(g);
            // console.log('symbolsymbolsymbolsymbolsymbolsymbol', symbol)
            if (!symbol) continue;
            // console.log('3344552211');

            // console.log(symbol, symbolName, nodeName);
            sb.push(SymbolParse.parse(symbol, symbolName, nodeName));
        }
    }
    sb.push('</defs>');
    return sb.join('');
}

async function buildSvgDocument(gEl, layerEl, options) {
    const w = gEl.getAttribute('w') || '2400';
    const h = gEl.getAttribute('h') || '1350';
    const bgc = gEl.getAttribute('bgc');

    const spcMap = getSpecialSymbol(layerEl);
    const missingSymbols = [];
    const defs = await parseSymbolDefs(spcMap, path => missingSymbols.push(path));

    const children = [];
    // console.log('layerEl.childNodeslayerEl.childNodeslayerEl.childNodes', layerEl.childNodes)
    for (let i = 0; i < layerEl.childNodes.length; i++) {
        const n = layerEl.childNodes[i];
        if (n.nodeType === 1) children.push(n);
    }
    const warnNodes = options?.quiet ? () => {} : (type, id) => console.warn(`[facG] 未转换节点: ${type} id=${id || ''}`);
    const { body, inlineDefs } = buildLgCompatibleBody(children, warnNodes);

    let bg = '';
    if (bgc) {
        bg = `<g id="BackGround_Layer"><rect fill="rgb(${bgc})" x="0" y="0" width="${w}" height="${h}"/></g>`;
    }

    const inner = `${defs}${inlineDefs}${bg}${body}`;
    const svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n` + `<svg xmlns="http://www.w3.org/2000/svg" xmlns:cge="http://iec.ch/TC57/2005/SVG-schema#" xmlns:xlink="http://www.w3.org/1999/xlink" ` + `width="${w}" height="${h}" coordinateExtent="0 0 ${w} ${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid">` + inner + `</svg>`;
    return { svg, missingSymbols };
}

/**
 * @param {ArrayBuffer} arrayBuffer - 主接线 .g 文件内容
 * @param {{ quiet?: boolean }} [options]
 * @returns {Promise<{ svg: string, missingSymbols: string[] }>}
 */
export async function convertFacGBufferToSvg(arrayBuffer, options) {
    ensureSymbolParsePatched();
    if (isAppleDoubleBuffer(arrayBuffer)) {
        throw new Error('该文件为 macOS 资源叉（AppleDouble），不是 XML。请选择同名的主图 .g 文件，或使用去掉 ._ 前缀的那份文件。');
    }
    const xml = decodeGFileBuffer(arrayBuffer);
    const xmlUtf8 = xml.replace(/encoding="[^"]*"/i, 'encoding="UTF-8"');
    const doc = new DOMParser().parseFromString(xmlUtf8, 'text/xml');
    const gEl = doc.documentElement;
    if (!gEl || gEl.nodeName !== 'G') {
        throw new Error('根元素应为 <G>，请确认是力光/CIM-G 厂站图 .g 文件');
    }
    const layerEl = gEl.getElementsByTagName('Layer')[0];
    if (!layerEl) {
        throw new Error('<G> 下缺少 <Layer>');
    }

    return buildSvgDocument(gEl, layerEl, options);
}
