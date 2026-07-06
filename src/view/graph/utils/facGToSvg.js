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
    const keyName1 = dom.getAttribute('key_name1');
    const voltype =
        nodeName === 'Transformer3'
            ? dom.getAttribute('voltype1') || dom.getAttribute('voltype')
            : dom.getAttribute('voltype') || dom.getAttribute('voltype1');
    attrs = appendXmlAttr(attrs, 'keyid', keyid);
    attrs = appendXmlAttr(attrs, 'rtkeyid', rtkeyid);
    attrs = appendXmlAttr(attrs, 'key_name', keyName);
    attrs = appendXmlAttr(attrs, 'key_name1', keyName1);
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
    const ts = dom.getAttribute('ts') || '';
    const fatherId = dom.getAttribute('p_FatherObjId') || dom.getAttribute('FatherObjId') || '';
    let textLinkId = rawId;
    if (fatherId && /#\d+主变/.test(ts)) {
        textLinkId = fatherId;
    }
    const gId = textLinkId.indexOf('TXT-') === 0 ? textLinkId : `TXT-${textLinkId}`;
    const pid = dom.getAttribute('pid') || (fatherId && textLinkId !== rawId ? fatherId : '');
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

/** 馈线全称/出线端短名 → 段号 + 核心名（保留 Ⅰ/Ⅱ/Ⅲ，避免多条同芯线串列） */
function feederMatchParts(label) {
    let s = String(label || '')
        .replace(/^\(原?/, '')
        .replace(/\)$/, '')
        .replace(/线$/, '')
        .replace(/\d+$/, '');
    let section = '';
    if (/^Ⅲ/.test(s)) {
        section = '3';
        s = s.slice(1);
    } else if (/^Ⅱ/.test(s)) {
        section = '2';
        s = s.slice(1);
    } else if (/^Ⅰ/.test(s)) {
        section = '1';
        s = s.slice(1);
    } else if (/^III/.test(s)) {
        section = '3';
        s = s.slice(3);
    } else if (/^II/.test(s)) {
        section = '2';
        s = s.slice(2);
    } else if (/^I[\u4e00-\u9fff]/.test(s)) {
        section = '1';
        s = s.slice(1);
    }
    return { section, core: s };
}

/** @deprecated 用于简单相等比较；段号与核心名拼接 */
function feederNameKey(label) {
    const { section, core } = feederMatchParts(label);
    return section + core;
}

function facFeederSummaryBand(y) {
    if (y < 120) return 'north';
    if (y > 500) return 'south';
    return 'middle';
}

function facFeederAnchorBand(anchorY) {
    return anchorY < 400 ? 'north' : 'south';
}

function facFeederSameBand(lineY, anchorY) {
    const lineBand = facFeederSummaryBand(lineY);
    const anchorBand = facFeederAnchorBand(anchorY);
    if (lineBand === 'middle') return true;
    return lineBand === anchorBand;
}

function pickFacFeederNearestByX(items, refX) {
    return items.reduce(
        (best, cur) => (!best || Math.abs(cur.x - refX) < Math.abs(best.x - refX) ? cur : best)
    );
}

/** 按段号 + 汇总区/出线端纵向分区配对馈线全称与出线短名 */
function matchFacFeederAnchor(line, anchors) {
    const lp = feederMatchParts(line.ts);
    if (lp.core.length < 2) return null;
    const sorted = anchors
        .filter(
            (a) =>
                facFeederSameBand(line.y, a.y) &&
                feederMatchParts(a.ts).core === lp.core
        )
        .sort((a, b) => a.x - b.x);
    if (!sorted.length) return null;

    if (lp.section) {
        const exact = sorted.filter((a) => feederMatchParts(a.ts).section === lp.section);
        if (exact.length) return pickFacFeederNearestByX(exact, line.x);
        const idx = Math.min(parseInt(lp.section, 10) - 1, sorted.length - 1);
        return sorted[idx];
    }
    return pickFacFeederNearestByX(sorted, line.x);
}

function isFacFeederLineLabel(text) {
    const s = String(text || '').trim();
    if (!s) return false;
    if (/^\([^)]+\)$/.test(s)) return false;
    return /线$/.test(s);
}

/** 出线端短名：府客1、Ⅱ府正1、I卫府2 等 */
function isFacFeederAnchorLabel(text) {
    const s = String(text || '').trim();
    if (!s || isFacFeederLineLabel(s)) return false;
    return /^[ⅠⅡⅢI]?[\u4e00-\u9fff]+?\d+$/.test(s) || /^I[\u4e00-\u9fff]+\d+$/.test(s);
}

/** 馈线附属说明：（重合闸长投）、（延津县）等，随馈线全称一起移动 */
function isFacFeederAuxLabel(text) {
    const s = String(text || '').trim();
    if (!s || isFacFeederLineLabel(s) || isFacFeederAnchorLabel(s)) return false;
    return /^\([^)]+\)$/.test(s);
}

/** 附属标签与馈线全称原位置的横向、纵向配对容差 */
const FAC_FEEDER_AUX_MATCH_DX = 120;
const FAC_FEEDER_AUX_MATCH_DY = 50;
/** 馈线末端名称/附属说明字号上限，避免并列馈线文字互相遮挡 */
const FAC_FEEDER_LINE_MAX_FS = 14;
const FAC_FEEDER_AUX_MAX_FS = 12;
/** SymbolParse.parseText 固定偏移，G 坐标需反算才能使文字中心落在馈线列上 */
const FAC_FEEDER_TEXT_PARSE_OFFSET_X = 20;
/** 馈线名称与附属说明（延津县/重合闸长投）行间距 */
const FAC_FEEDER_AUX_LINE_GAP = 15;
/** 母线上方馈线名称相对馈线末端额外上移间距 */
const FAC_FEEDER_ABOVE_LINE_EXTRA_GAP = 15;

function shrinkFacFeederTextFont(dom, maxFs) {
    const raw = parseFloat(dom.getAttribute('fs'));
    const base = Number.isFinite(raw) ? raw : 18;
    const next = Math.min(base, maxFs);
    dom.setAttribute('fs', String(next));
    return next;
}

/** 与 TextUtil.getStrWidth 一致的文字宽度估算 */
function estimateFacTextWidth(text, fs) {
    let len = 0;
    for (let i = 0; i < text.length; i++) {
        len += text.charCodeAt(i) > 0xff ? fs : fs / 2;
    }
    return len;
}

function facFeederDomXFromCenter(centerX) {
    return centerX - FAC_FEEDER_TEXT_PARSE_OFFSET_X;
}

/** 文字左缘对齐时，由左缘与字宽反算 G 文件 x */
function facFeederDomXFromLeft(textLeft, textWidth) {
    return textLeft + textWidth / 2 - FAC_FEEDER_TEXT_PARSE_OFFSET_X;
}

function markFacFeederTextHidden(dom) {
    dom.setAttribute('data-fac-hide', '1');
}

/** 出线端 x/y 附近 ConnectLine 列中心（并列馈线列 x 接近时需按 y 区分） */
function resolveFeederColumnX(linePts, refX, refY, tol = 45) {
    let pool = linePts.filter((p) => Math.abs(p.x - refX) <= tol);
    if (!pool.length) return refX;
    if (Number.isFinite(refY)) {
        const nearAnchorY = pool.filter((p) => Math.abs(p.y - refY) <= 120);
        if (nearAnchorY.length >= 3) pool = nearAnchorY;
    }
    const buckets = new Map();
    for (const p of pool) {
        const k = Math.round(p.x);
        buckets.set(k, (buckets.get(k) || 0) + 1);
    }
    let bestX = refX;
    let bestCount = 0;
    for (const [k, count] of buckets) {
        const x = Number(k);
        if (count > bestCount || (count === bestCount && Math.abs(x - refX) < Math.abs(bestX - refX))) {
            bestCount = count;
            bestX = x;
        }
    }
    return bestX;
}

function collectFacLinePoints(children) {
    const pts = [];
    for (const dom of children) {
        if (dom.nodeType !== 1) continue;
        const nodeName = dom.nodeName;
        if (nodeName !== 'ConnectLine' && nodeName !== 'ACLineEnd') continue;
        const d = dom.getAttribute('d');
        if (!d) continue;
        for (const part of d.trim().split(/\s+/)) {
            const [x, y] = part.split(',').map(Number);
            if (Number.isFinite(x) && Number.isFinite(y)) {
                pts.push({ x, y });
            }
        }
    }
    return pts;
}

/** 从 Bus 读取 10kV 北母/中母 y，用于判断馈线 outward 方向 */
function detectFac10kVBusY(children) {
    let northY = null;
    let midY = null;
    for (const dom of children) {
        if (dom.nodeType !== 1 || dom.nodeName !== 'Bus') continue;
        const keyName = dom.getAttribute('key_name') || '';
        const y1 = parseFloat(dom.getAttribute('y1'));
        if (!Number.isFinite(y1)) continue;
        if (keyName.includes('10kV') && keyName.includes('北')) northY = y1;
        if (keyName.includes('10kV') && keyName.includes('中')) midY = y1;
    }
    return { northY, midY };
}

/** 在馈线列（x 相近）上取 outward 方向最外端 y；横向始终用列心 columnX */
function feederColumnOuterPoint(linePts, anchorX, anchorY, northY, midY, tol = 45) {
    if (!linePts.length || !Number.isFinite(anchorX) || !Number.isFinite(anchorY)) return null;
    const columnX = resolveFeederColumnX(linePts, anchorX, anchorY, tol);
    let col = linePts.filter((p) => Math.abs(p.x - columnX) <= tol);
    if (!col.length) return null;

    const busY = anchorY < 350 ? northY : midY;
    const outwardUp = Number.isFinite(busY) ? anchorY < busY : anchorY < 350;

    if (Number.isFinite(busY)) {
        const branch = col.filter((p) => (outwardUp ? p.y <= busY + 8 : p.y >= busY - 8));
        if (branch.length) col = branch;
    }

    let onCol = col.filter((p) => Math.abs(p.x - columnX) <= 12);
    if (!onCol.length) onCol = col;

    const outerY = outwardUp
        ? onCol.reduce((a, b) => (a.y < b.y ? a : b)).y
        : onCol.reduce((a, b) => (a.y > b.y ? a : b)).y;

    return { columnX, outerY };
}

/**
 * G 文件常把馈线全称放在画布顶部/底部汇总区。
 * 按名称配对出线端短名后，将全称标签移到该列馈线几何末端。
 */
function repositionFacFeederLineLabels(children) {
    const linePts = collectFacLinePoints(children);
    if (!linePts.length) return;

    const { northY, midY } = detectFac10kVBusY(children);

    const entries = [];
    for (const dom of children) {
        if (dom.nodeType !== 1 || dom.nodeName !== 'Text') continue;
        const ts = dom.getAttribute('ts') || '';
        if (!ts) continue;
        const x = parseFloat(dom.getAttribute('x')) || 0;
        const y = parseFloat(dom.getAttribute('y')) || 0;
        const fs = parseFloat(dom.getAttribute('fs')) || 18;
        entries.push({
            dom,
            ts,
            x,
            y,
            fs,
            isLine: isFacFeederLineLabel(ts),
            isAnchor: isFacFeederAnchorLabel(ts),
            isAux: isFacFeederAuxLabel(ts),
        });
    }

    const lineLabels = entries.filter(e => e.isLine);
    const anchors = entries.filter(e => e.isAnchor);
    const auxLabels = entries.filter(e => e.isAux);
    if (!lineLabels.length || !anchors.length) return;

    for (const line of lineLabels) {
        line.fs = shrinkFacFeederTextFont(line.dom, FAC_FEEDER_LINE_MAX_FS);
    }
    for (const aux of auxLabels) {
        aux.fs = shrinkFacFeederTextFont(aux.dom, FAC_FEEDER_AUX_MAX_FS);
    }

    const lineMoves = new Map();
    const placements = [];

    for (const line of lineLabels) {
        const best = matchFacFeederAnchor(line, anchors);
        if (!best) continue;

        const outer = feederColumnOuterPoint(linePts, best.x, best.y, northY, midY);
        if (!outer) continue;

        const busY = best.y < 350 ? northY : midY;
        const gap = Math.max(10, line.fs * 0.7);
        const outwardUp = Number.isFinite(busY) ? best.y < busY : best.y < 350;
        const lineGap = outwardUp ? gap + FAC_FEEDER_ABOVE_LINE_EXTRA_GAP : gap;
        placements.push({
            line,
            columnX: outer.columnX,
            centerX: outer.columnX,
            width: estimateFacTextWidth(line.ts, line.fs),
            newY: outwardUp ? outer.outerY - lineGap : outer.outerY + lineGap,
            outwardUp,
        });
    }

    for (const item of placements) {
        const { line, centerX, newY } = item;
        const domX = facFeederDomXFromCenter(centerX);
        line.dom.setAttribute('x', String(domX));
        line.dom.setAttribute('y', String(newY));
        lineMoves.set(line.dom, {
            oldX: line.x,
            oldY: line.y,
            newX: domX,
            newY,
            centerX,
            lineWidth: item.width,
            lineFs: line.fs,
        });
    }

    const auxMoved = new Set();
    for (const aux of auxLabels) {
        let pairedLine = null;
        let bestScore = Infinity;
        for (const line of lineLabels) {
            const dy = Math.abs(aux.y - line.y);
            if (dy > FAC_FEEDER_AUX_MATCH_DY) continue;
            const dx = Math.abs(aux.x - line.x);
            if (dx > FAC_FEEDER_AUX_MATCH_DX) continue;
            const score = dx + dy;
            if (score < bestScore) {
                bestScore = score;
                pairedLine = line;
            }
        }
        if (!pairedLine) continue;
        const move = lineMoves.get(pairedLine.dom);
        if (!move) continue;
        const lineLeft = move.centerX - move.lineWidth / 2;
        const auxWidth = estimateFacTextWidth(aux.ts, aux.fs);
        const auxDomX = facFeederDomXFromLeft(lineLeft, auxWidth);
        const auxDomY = move.newY + FAC_FEEDER_AUX_LINE_GAP;
        aux.dom.setAttribute('x', String(auxDomX));
        aux.dom.setAttribute('y', String(auxDomY));
        auxMoved.add(aux.dom);
    }

    for (const line of lineLabels) {
        if (!lineMoves.has(line.dom)) markFacFeederTextHidden(line.dom);
    }
    for (const aux of auxLabels) {
        if (!auxMoved.has(aux.dom)) markFacFeederTextHidden(aux.dom);
    }
}

/**
 * LGSvgParser 要求：svg 下直接子节点为各 *_Layer 的 &lt;g&gt;，设备/线/文本为带 metadata 的分组。
 */
function buildLgCompatibleBody(children, onWarn) {
    repositionFacFeederLineLabels(children);
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
                if (dom.getAttribute('data-fac-hide') === '1') break;
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
