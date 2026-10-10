const fs = require('fs');
const vm = require('vm');

const file = process.argv[2];
let code = fs.readFileSync(file, 'utf8');

// 1. 提取 数组函数 + 旋转 IIFE，执行后取旋转后的数组
const i = code.indexOf('function a0_0x4e5d()');
const endMarker = '}(a0_0x4e5d,0x1efc5));';
const j = code.indexOf(endMarker, i);
const fn = code.slice(i, j + endMarker.length);
console.log('fn len:', fn.length);

const accessorDef = 'function a0_0x225c(_0x37f214,_0x440f5d){_0x37f214=_0x37f214-0x11e;var _0x3d20f9=a0_0x4e5d();var _0x541e70=_0x3d20f9[_0x37f214];return _0x541e70;}\n';
const ctx = {};
vm.createContext(ctx);
vm.runInContext(accessorDef + fn + '\nglobalThis.__arr = a0_0x4e5d();', ctx);
const arr = ctx.__arr;
console.log('array length:', arr.length);

const OFFSET = 0x11e;
function dec(k) { return arr[k - OFFSET]; }

// 2. 找到所有别名 (传递闭包): X = a0_0x225c 或 X = Y(已是别名)
const aliases = new Set(['a0_0x225c']);
let changed = true;
while (changed) {
  changed = false;
  const aliasList = [...aliases].map(a => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp('([A-Za-z0-9_$]+)\\s*=\\s*(?:' + aliasList + ')(?![A-Za-z0-9_$])', 'g');
  let mm;
  while ((mm = re.exec(code))) {
    if (!aliases.has(mm[1])) { aliases.add(mm[1]); changed = true; }
  }
}
console.log('aliases:', aliases.size);

// 3. 替换所有 alias(0xNNN) -> "decoded"
let count = 0;
const aliasList = [...aliases].join('|');
const callRe = new RegExp('(?:' + aliasList + ')\\((0x[0-9a-fA-F]+)\\)', 'g');
code = code.replace(callRe, (full, hex) => {
  const v = dec(parseInt(hex, 16));
  count++;
  if (v === undefined) return full;
  return JSON.stringify(v);
});
console.log('replaced calls:', count);

fs.writeFileSync(file.replace(/\.js$/, '.deob.js'), code);
console.log('written:', file.replace(/\.js$/, '.deob.js'));
