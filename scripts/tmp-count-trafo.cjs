const fs = require('fs');
const path = require('path');
const { TextDecoder } = require('util');

const json = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/新乡潮流计算结果（府城站）.json'), 'utf8'));
const data = json.data || json;
const trafoList = data.res_trafo || [];

const resolveInSiteStationPrefix = () => {
    for (const feeder of data.res_feeder || []) {
        if (!feeder?.station) continue;
        const seg = String(feeder.station).split('.').pop();
        if (seg) return seg;
    }
    return '府城站';
};
const prefix = resolveInSiteStationPrefix();
console.log('inSiteStationPrefix:', prefix);

const fucheng = trafoList.filter((r) => String(r.name || '').startsWith(`${prefix}.`));
console.log('matching prefix records:', fucheng.length);
console.log('names:', fucheng.map((r) => r.name));

const byTrafoid = new Map();
for (const r of fucheng) {
    if (!byTrafoid.has(r.trafoid)) byTrafoid.set(r.trafoid, []);
    byTrafoid.get(r.trafoid).push(r.name);
}
console.log('unique main transformers:', byTrafoid.size);

function extractInSiteTrafoNum(text) {
    const mm = String(text || '').match(/#(\d+)主变/);
    return mm ? Number(mm[1]) : null;
}

const gtext = new TextDecoder('gbk').decode(
    fs.readFileSync(path.join(__dirname, '../src/assets/substation/410700.01124107000002.fac.pic.g'))
);
const trBlocks = [...gtext.matchAll(/<Transformer3\b[^/]*\/>/g)].map((m) => m[0]);
console.log('\nG Transformer3:', trBlocks.length);

function pickInSiteTrafoDisplayRecord(records) {
    if (!records?.length) return null;
    if (records.length === 1) return records[0];
    return (
        records.find((r) => String(r.name || '').endsWith('_高')) ||
        records.find((r) => String(r.name || '').endsWith('_中')) ||
        records[0]
    );
}

let matched = 0;
for (const block of trBlocks) {
    const kn1 = block.match(/\bkey_name1="([^"]*)"/)?.[1];
    const num = extractInSiteTrafoNum(kn1);
    const hits = trafoList.filter((rec) => {
        if (!rec.name || !String(rec.name).includes(prefix)) return false;
        return extractInSiteTrafoNum(rec.name) === num;
    });
    const pick = pickInSiteTrafoDisplayRecord(hits);
    console.log(kn1, 'num', num, 'hits', hits.length, '->', pick?.name || 'NO MATCH');
    if (pick) matched++;
}
console.log('\nMatched on canvas:', matched, '/', trBlocks.length);
