/* ============================================================================
 *  入馆教育/阅读活动 题库导出脚本（Node.js 离线版）
 *
 *  适用于已经拿到登录态的场景。需要提供:
 *    UID       - 用户 uid (localStorage: answer-uid)
 *    FID       - 机构 fid  (localStorage: answer-fid)
 *    ACTIVITY  - 活动 id   (localStorage: answer-activityId)
 *    COOKIE    - (可选) 浏览器 Cookie 字符串, 若接口校验会话则必填
 *
 *  用法:
 *    UID=xxx FID=yyy ACTIVITY=zzz COOKIE="..." node dump_node.js
 *
 *  输出: 题库.json
 * ========================================================================== */
const crypto = require('crypto');
const fs = require('fs');

const KEY = 'o6v8cHFSdtIXT7q2';                 // AES-128-ECB 密钥 (来自前端 keyArr.key)
const BASE = 'https://tvu.chaoxing.com/api';
const UID = process.env.UID || '';
const FID = process.env.FID || '';
const ACTIVITY = process.env.ACTIVITY || '';
const COOKIE = process.env.COOKIE || '';

function enc(msg) {
  const c = crypto.createCipheriv('aes-128-ecb', Buffer.from(KEY, 'utf8'), null);
  c.setAutoPadding(true);
  return Buffer.concat([c.update(Buffer.from(msg, 'utf8')), c.final()]).toString('base64');
}
function dec(b64) {
  const d = crypto.createDecipheriv('aes-128-ecb', Buffer.from(KEY, 'utf8'), null);
  d.setAutoPadding(true);
  return Buffer.concat([d.update(Buffer.from(b64, 'base64')), d.final()]).toString('utf8');
}

const H = () => ({
  'Content-Type': 'application/json',
  'Origin': 'https://static.zsjy.chaoxing.com',
  'User-Agent': 'Mozilla/5.0',
  ...(COOKIE ? { 'Cookie': COOKIE } : {}),
});
async function post(path, body, headers = {}) {
  const r = await fetch(BASE + path, { method: 'POST', headers: { ...H(), ...headers }, body: JSON.stringify(body) });
  return r.json();
}
async function get(path) {
  const r = await fetch(BASE + path, { headers: H() });
  return r.json();
}

(async () => {
  if (!UID) { console.error('请通过环境变量 UID 提供用户 uid'); process.exit(1); }

  const lvRes = await get(`/applet/activity/level/list?uid=${UID}&activityId=${ACTIVITY}&fid=${FID}`);
  const levels = lvRes.data;
  if (!Array.isArray(levels)) { console.error('关卡列表失败:', lvRes); process.exit(1); }
  console.log('关卡数:', levels.length);

  const all = [];
  for (const lv of levels) {
    const payload = JSON.stringify({ levelId: lv.id, uid: UID, fid: FID, activityId: ACTIVITY });
    const res = await post(`/applet/activity/answer/start?uid=${UID}&fid=${FID}&activityId=${ACTIVITY}`, { encData: enc(payload) });
    if (!res || !res.data || !res.data.data) { console.log(`关卡 ${lv.id} 无数据:`, JSON.stringify(res).slice(0, 160)); continue; }
    let qs;
    try { qs = JSON.parse(dec(res.data.data)); } catch (e) { console.log(`关卡 ${lv.id} 解密失败`, e.message); continue; }
    console.log(`关卡 ${lv.id} ${lv.levelName}: ${qs.length} 题`);
    qs.forEach(q => all.push({ level: lv.id, levelName: lv.levelName, ...q }));
  }

  fs.writeFileSync('题库.json', JSON.stringify(all, null, 2));
  console.log('总计:', all.length, '题 -> 题库.json');
})();
