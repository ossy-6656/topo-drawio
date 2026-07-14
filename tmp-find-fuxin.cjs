const fs = require('fs');
const buf = fs.readFileSync('src/assets/substation/410700.01124107000002.fac.pic.g');
const t = new TextDecoder('gb18030').decode(buf);
for (const re of [/ts="([^"]*府馨[^"]*)"/g, /key_name="([^"]*府馨[^"]*)"/g, /keyname="([^"]*府馨[^"]*)"/g]) {
  const m = [...t.matchAll(re)];
  console.log(re.source, m.map((x) => x[1]));
}
