/**
 * 从 fucheng23.js SVG 统计未匹配潮流数据的图元。
 * 与 /graphLg applyLgPowerFlowOverlay 范围一致，排除文本/背景/开关/站房等误统计项。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FLOW_JSON = path.join(ROOT, 'public/府城站配网潮流数据.json');
const FUCHENG23_JS = path.join(ROOT, 'src/view/graph/data/fucheng23.js');
const OUT_JSON = path.join(ROOT, 'public/府城变23板府馨线-SVG未匹配潮流设备.json');
const OUT_CSV = path.join(ROOT, 'public/府城变23板府馨线-SVG未匹配潮流设备.csv');

const SBID_PREFIX = 'sbid000000';

const SKIP_OBJECT_ID = /^TXT-/i;
const SKIP_LAYER_IDS = new Set(['BackGround_Layer', 'Text_Layer', 'Hot_Layer', 'ConnLine_Layer']);
const SWITCH_PSR = new Set(['0305', '0306', '0307', '0309', '0313', '0314', '0315', '0316', '0317', '0318', '0319']);
const STATION_PSR = new Set(['zf01', 'zf04', '100430000']);
const FLOW_LINE_PSR = new Set(['360000', '36000000']);

function normalizeId(id) {
    return String(id || '').replace(/-/g, '').toLowerCase();
}

function normalizeName(name) {
    return String(name || '')
        .trim()
        .toLowerCase()
        .replace(/\s/g, '')
        .replace(/[（）()]/g, '');
}

function flowIdVariants(rawId) {
    const keys = new Set();
    const n = normalizeId(rawId);
    if (!n) return keys;
    keys.add(n);
    if (n.startsWith('sbid')) {
        if (n.startsWith(SBID_PREFIX)) keys.add(n.slice(SBID_PREFIX.length));
        keys.add(n.slice(4));
        return keys;
    }
    const colon = n.indexOf(':');
    if (colon >= 0) {
        const tail = n.slice(colon + 1);
        if (tail) {
            keys.add(tail);
            keys.add(SBID_PREFIX + tail);
        }
    }
    keys.add(SBID_PREFIX + n);
    if (n.startsWith('00') && n.length > 2) {
        const body = n.slice(2);
        keys.add(body);
        keys.add(SBID_PREFIX + body);
        if (body.startsWith('0')) {
            const core = body.slice(1);
            keys.add(core);
            keys.add(SBID_PREFIX + core);
        }
    }
    return keys;
}

function extractGlobeIdFromObjectId(objectId) {
    const m = String(objectId || '').match(/^PD_\d+_(.+)$/i);
    return m ? m[1] : '';
}

function indexFlowRecord(map, rawId, record) {
    for (const key of flowIdVariants(rawId)) {
        if (!map.has(key)) map.set(key, record);
    }
}

function buildGraphLgFlowIndexes(data) {
    const sub = data?.res_sub_system;
    const merged =
        sub && typeof sub === 'object'
            ? { ...data, res_bus: sub.res_bus || [], res_line: sub.res_line || [], res_gen: sub.res_gen || [] }
            : data;
    return buildFlowIndexes(merged);
}

function buildFlowIndexes(data) {
    const lineById = new Map();
    const lineByName = new Map();
    const busById = new Map();
    const busByName = new Map();
    const genById = new Map();
    const genByName = new Map();
    const loadById = new Map();
    const loadByName = new Map();
    const recordByGlobeId = new Map();

    const indexGlobe = (rawId, record, type) => {
        for (const key of flowIdVariants(rawId)) {
            if (!recordByGlobeId.has(key)) recordByGlobeId.set(key, { record, type });
        }
    };

    for (const line of data.res_line || []) {
        if (line.lineid) {
            indexFlowRecord(lineById, line.lineid, line);
            indexGlobe(line.lineid, line, 'line');
        }
        if (line.name) lineByName.set(normalizeName(line.name), line);
    }
    for (const bus of data.res_bus || []) {
        if (bus.busid) {
            indexFlowRecord(busById, bus.busid, bus);
            indexGlobe(bus.busid, bus, 'bus');
        }
        if (bus.name) busByName.set(normalizeName(bus.name), bus);
    }
    for (const gen of data.res_gen || []) {
        if (gen.genid) {
            indexFlowRecord(genById, gen.genid, gen);
            indexGlobe(gen.genid, gen, 'gen');
        }
        if (gen.name) genByName.set(normalizeName(gen.name), gen);
    }
    for (const load of data.res_load || []) {
        if (load.loadid) {
            indexFlowRecord(loadById, load.loadid, load);
            indexGlobe(load.loadid, load, 'load');
        }
        if (load.name) loadByName.set(normalizeName(load.name), load);
    }

    return { lineById, lineByName, busById, busByName, genById, genByName, loadById, loadByName, recordByGlobeId };
}

function loadFucheng23Svg() {
    const txt = fs.readFileSync(FUCHENG23_JS, 'utf8');
    const startMarker = 'var fucheng23Svg = "';
    const start = txt.indexOf(startMarker);
    const contentStart = start + startMarker.length;
    const contentEnd = txt.lastIndexOf('"');
    return JSON.parse('"' + txt.slice(contentStart, contentEnd) + '"');
}

function parseMetadataBlock(metaHtml) {
    const propMap = {};
    const tagRe = /<cge:([A-Za-z_]+)([^>]*)>/g;
    let m;
    while ((m = tagRe.exec(metaHtml))) {
        const tag = `cge:${m[1]}`;
        const obj = {};
        const attrRe = /(\w+)="([^"]*)"/g;
        let am;
        while ((am = attrRe.exec(m[2]))) obj[am[1]] = am[2];
        propMap[tag] = obj;
    }
    return propMap;
}

function shouldSkipDevice(objectId, psrType, gAttrs) {
    if (SKIP_OBJECT_ID.test(objectId)) return true;
    const gId = gAttrs.match(/\bid="([^"]+)"/)?.[1] || '';
    if (SKIP_LAYER_IDS.has(gId)) return true;
    const psr = String(psrType || '').toLowerCase();
    if (STATION_PSR.has(psr)) return true;
    return false;
}

/** 与 graphLg getFlowOverlayDeviceCategory 对齐；null 表示不参与潮流上图统计 */
function detectFlowCategory(gInner, psrType, symbolHref) {
    const psr = String(psrType || '').toLowerCase();
    if (SWITCH_PSR.has(psr)) return null;
    const sym = String(symbolHref || '').toLowerCase();
    if (sym.includes('cbreaker') || sym.includes('breaker') || sym.includes('disconnector')) return null;

    if (psr === '0311' || psr === '0308' || sym.includes('busbar')) return 'bus';
    if (sym.includes('generatingunit')) return 'gen';
    if (psr === '370000' || psr === '30000005' || psr === 'zf06' || sym.includes('energyconsumer') || sym.includes('substation_')) {
        return 'load';
    }

    const isEdge = /<polyline[\s>]/.test(gInner) || /<path[\s>]/.test(gInner);
    if (isEdge) {
        if (FLOW_LINE_PSR.has(psr)) return 'line';
        return null;
    }
    return null;
}

function parseSvgDevices(svg) {
    const devices = [];
    const metaRe = /<g\b([^>]*)>([\s\S]*?)<metadata>([\s\S]*?)<\/metadata>[\s\S]*?<\/g>/g;
    let m;
    while ((m = metaRe.exec(svg))) {
        const gAttrs = m[1];
        const gInner = m[2] + m[0];
        const propMap = parseMetadataBlock(m[3]);
        const psr = propMap['cge:PSR_Ref'] || {};
        if (!psr.ObjectID && !psr.GlobeID && !psr.PSRType) continue;

        const objectId = psr.ObjectID || gAttrs.match(/\bid="([^"]+)"/)?.[1] || '';
        if (shouldSkipDevice(objectId, psr.PSRType, gAttrs)) continue;

        const psrType = psr.PSRType || '';
        const hrefM = gInner.match(/(?:xlink:href|href)="(#?[^"]+)"/);
        const category = detectFlowCategory(gInner, psrType, hrefM ? hrefM[1] : '');
        if (!category) continue;

        const txtM = gInner.match(/<text[^>]*>([^<]*)<\/text>/);
        const labelText = txtM ? txtM[1].replace(/\\n/g, '') : '';

        devices.push({
            objectId,
            globeId: psr.GlobeID || extractGlobeIdFromObjectId(objectId) || '',
            objectName: psr.ObjectName || '',
            displayName: psr.ObjectName || labelText,
            psrType,
            category,
            psr,
        });
    }
    return devices;
}

function getCellGlobeIds(device) {
    const ids = [];
    const seen = new Set();
    const push = (raw) => {
        const n = normalizeId(raw);
        if (!raw || seen.has(n)) return;
        seen.add(n);
        ids.push(String(raw));
    };
    const psr = device.psr;
    if (psr.GlobeID) push(psr.GlobeID);
    if (psr.GeoPsrid) push(psr.GeoPsrid);
    if (psr.keyid) push(psr.keyid);
    if (psr.rtkeyid) {
        push(psr.rtkeyid);
        const tail = String(psr.rtkeyid).split(':').pop();
        if (tail) push(tail);
    }
    const fromObjectId = extractGlobeIdFromObjectId(device.objectId);
    if (fromObjectId && (fromObjectId.length > 12 || /^sbid/i.test(fromObjectId))) push(fromObjectId);
    return ids;
}

function getCellMatchKeys(device) {
    const keys = new Set();
    const globeFromObjectId = extractGlobeIdFromObjectId(device.objectId);
    if (globeFromObjectId) for (const v of flowIdVariants(globeFromObjectId)) keys.add(v);
    const psr = device.psr;
    if (psr.GlobeID) for (const v of flowIdVariants(psr.GlobeID)) keys.add(v);
    if (psr.ObjectID) {
        const g = extractGlobeIdFromObjectId(psr.ObjectID) || psr.ObjectID;
        for (const v of flowIdVariants(g)) keys.add(v);
    }
    if (psr.GeoPsrid) for (const v of flowIdVariants(psr.GeoPsrid)) keys.add(v);
    if (psr.keyid) for (const v of flowIdVariants(psr.keyid)) keys.add(v);
    if (psr.rtkeyid) for (const v of flowIdVariants(psr.rtkeyid)) keys.add(v);
    if (psr.ObjectName) keys.add(normalizeName(psr.ObjectName));
    if (device.displayName) keys.add(normalizeName(device.displayName));
    return keys;
}

function lookupRecordsByGlobeId(globeId, recordByGlobeId) {
    const hits = [];
    const seenRecord = new Set();
    for (const key of flowIdVariants(globeId)) {
        const hit = recordByGlobeId.get(key);
        if (hit && !seenRecord.has(hit.record)) {
            seenRecord.add(hit.record);
            hits.push(hit);
        }
    }
    return hits;
}

function getPreferredRecordTypes(category) {
    if (category === 'line') return ['line', 'bus'];
    if (category === 'bus') return ['bus', 'line'];
    if (category === 'gen') return ['gen', 'bus'];
    if (category === 'load') return ['load', 'bus'];
    return ['bus', 'line', 'gen', 'load'];
}

function matchFlowRecordByGlobeId(device, indexes) {
    const globeIds = getCellGlobeIds(device);
    if (!globeIds.length) return null;
    const typeOrder = getPreferredRecordTypes(device.category);
    const allHits = [];
    for (const globeId of globeIds) allHits.push(...lookupRecordsByGlobeId(globeId, indexes.recordByGlobeId));
    if (!allHits.length) return null;
    for (const preferType of typeOrder) {
        for (const hit of allHits) {
            if (hit.type === preferType) return hit.record;
        }
    }
    return allHits[0]?.record || null;
}

function matchFlowRecordByName(device, indexes) {
    const name = normalizeName(device.displayName);
    if (!name) return null;
    if (device.category === 'gen' && indexes.genByName.has(name)) return indexes.genByName.get(name);
    if (device.category === 'load' && indexes.loadByName.has(name)) return indexes.loadByName.get(name);
    if (device.category === 'bus' && indexes.busByName.has(name)) return indexes.busByName.get(name);
    if (device.category === 'line' && indexes.lineByName.has(name)) return indexes.lineByName.get(name);
    return null;
}

function getFlowMatchMaps(device, indexes) {
    if (device.category === 'line') return [indexes.lineById, indexes.lineByName, indexes.busById, indexes.busByName];
    if (device.category === 'bus') return [indexes.busById, indexes.busByName, indexes.lineById, indexes.lineByName];
    if (device.category === 'gen') return [indexes.genById, indexes.genByName, indexes.busById, indexes.busByName];
    if (device.category === 'load') return [indexes.loadById, indexes.loadByName, indexes.busById, indexes.busByName];
    return [];
}

function matchFlowRecord(device, indexes) {
    return (
        matchFlowRecordByGlobeId(device, indexes) ||
        matchFlowRecordByName(device, indexes) ||
        (() => {
            for (const map of getFlowMatchMaps(device, indexes)) {
                for (const key of getCellMatchKeys(device)) {
                    if (map.has(key)) return map.get(key);
                }
            }
            return null;
        })()
    );
}

function categoryLabel(category) {
    return ({ bus: '母线', line: '线路', gen: '机组', load: '负荷' }[category] || category);
}

function csvEscape(v) {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function main() {
    const json = JSON.parse(fs.readFileSync(FLOW_JSON, 'utf8'));
    const indexes = buildGraphLgFlowIndexes(json.data || json);
    const devices = parseSvgDevices(loadFucheng23Svg());

    const matched = [];
    const unmatched = [];

    for (const device of devices) {
        const record = matchFlowRecord(device, indexes);
        if (record) {
            matched.push(device);
        } else {
            unmatched.push({
                category: device.category,
                globeId: device.globeId,
                name: device.displayName,
            });
        }
    }

    unmatched.sort((a, b) => {
        const ta = { bus: 0, line: 1, gen: 2, load: 3 }[a.category] ?? 9;
        const tb = { bus: 0, line: 1, gen: 2, load: 3 }[b.category] ?? 9;
        return ta !== tb ? ta - tb : String(a.name).localeCompare(String(b.name), 'zh-CN');
    });

    const items = unmatched.map((row) => ({
        名称: row.name,
        设备类型: categoryLabel(row.category),
        globeId: row.globeId,
    }));

    const byCategory = {};
    for (const d of devices) byCategory[d.category] = (byCategory[d.category] || 0) + 1;
    const unmatchedByCategory = {};
    for (const d of unmatched) unmatchedByCategory[d.category] = (unmatchedByCategory[d.category] || 0) + 1;

    const summary = {
        dataset: 'fucheng23',
        label: '府城变23板府馨线',
        flowOverlayTargets: devices.length,
        matchedCount: matched.length,
        unmatchedCount: items.length,
        generatedAt: new Date().toISOString(),
        items,
    };

    fs.writeFileSync(OUT_JSON, JSON.stringify(summary, null, '\t'), 'utf8');
    const csvLines = ['名称,设备类型,globeId'];
    for (const row of items) {
        csvLines.push([row.名称, row.设备类型, row.globeId].map(csvEscape).join(','));
    }
    fs.writeFileSync(OUT_CSV, '\ufeff' + csvLines.join('\n'), 'utf8');

    console.log('潮流上图统计图元:', devices.length, byCategory);
    console.log('已匹配:', matched.length);
    console.log('未匹配:', unmatched.length, unmatchedByCategory);
    console.log('JSON:', OUT_JSON);
    console.log('CSV:', OUT_CSV);
}

main();
