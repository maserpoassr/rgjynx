const fs = require('fs');
const vm = require('vm');

const file = process.argv[2];
let code = fs.readFileSync(file, 'utf8');

// 找到数组函数定义
const arrFnM = code.match(/function (a\d+_0x[0-9a-f]+)\(\)\{var _0x[0-9a-f]+=\[/);
if (!arrFnM) { console.error('array fn not found'); process.exit(1); }
const arrFnName = arrFnM[1];

// 提取数组函数定义体
const afStart = code.indexOf('function ' + arrFnName + '()');
const afEndMark = 'return ' + arrFnName + '();}';
const afEnd = code.indexOf(afEndMark, afStart);
const arrayFnDef = code.slice(afStart, afEnd + afEndMark.length);

// 找到访问器函数:  function aX_0xYY(idx){ idx = idx - 0xOFFSET; ... }
const accM = code.match(/function (a\d+_0x[0-9a-f]+)\((_0x[0-9a-f]+)(,_0x[0-9a-f]+)?\)\{_0x[0-9a-f]+=_0x[0-9a-f]+-(0x[0-9a-f]+);var _0x[0-9a-f]+=a\d+_0x[0-9a-f]+\(\);/);
if (!accM) { console.error('accessor not found'); process.exit(1); }
const accName = accM[1];
const OFFSET = parseInt(accM[4], 16);

// 提取旋转 IIFE:  (function(...){...}(<arrFnName>,0x...))
const rotEnd = code.indexOf('}(' + arrFnName + ',');
let iife = '';
if (rotEnd >= 0) {
  const iifeStart = code.lastIndexOf('(function(', rotEnd);
  const iifeEnd = code.indexOf('))', rotEnd) + 2;
  iife = code.slice(iifeStart, iifeEnd);
}

let snippet = arrayFnDef + '\n' + iife;
// 补上访问器定义
const accDef = `function ${accName}(_0xa,_0xb){_0xa=_0xa-${accM[4]};var _0xa2=${arrFnName}();return _0xa2[_0xa];}\n`;
const ctx = {};
vm.createContext(ctx);
vm.runInContext(accDef + snippet + `\nglobalThis.__arr = ${arrFnName}();`, ctx);
const arr = ctx.__arr;
console.log('array length:', arr.length, 'offset:', accM[4]);

function dec(k) { return arr[k - OFFSET]; }

// 别名传递闭包
const aliases = new Set([accName]);
let changed = true;
while (changed) {
  changed = false;
  const list = [...aliases].map(a => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp('([A-Za-z0-9_$]+)\\s*=\\s*(?:' + list + ')(?![A-Za-z0-9_$])', 'g');
  let mm;
  while ((mm = re.exec(code))) { if (!aliases.has(mm[1])) { aliases.add(mm[1]); changed = true; } }
}

let count = 0;
const list = [...aliases].map(a => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
const callRe = new RegExp('(?:' + list + ')\\((0x[0-9a-fA-F]+)\\)', 'g');
code = code.replace(callRe, (full, hex) => {
  const v = dec(parseInt(hex, 16));
  count++;
  if (v === undefined) return full;
  return JSON.stringify(v);
});
console.log('aliases:', aliases.size, 'replaced:', count);

fs.writeFileSync(file.replace(/\.js$/, '.deob.js'), code);
console.log('written:', file.replace(/\.js$/, '.deob.js'));
