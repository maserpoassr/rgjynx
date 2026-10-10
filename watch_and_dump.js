/* ============================================================================
 *  自动等待「答题次数」刷新并导出题库
 *  - 每隔 INTERVAL 分钟查询一次 /applet/activity/chance
 *  - 一旦 activityRemainTimes > 0（次数刷新），立即逐关导出题库到 题库.json
 *
 *  用法:  UID=xxx FID=yyy ACTIVITY=zzz COOKIE="..." node watch_and_dump.js
 *  可选:  INTERVAL=5  (轮询间隔, 分钟; 默认 5)
 * ========================================================================== */
const crypto = require('crypto');
const fs = require('fs');

const KEY = 'o6v8cHFSdtIXT7q2';
const BASE = 'https://tvu.chaoxing.com/api';
const UID = process.env.UID || '';
const FID = process.env.FID || '';
const ACTIVITY = process.env.ACTIVITY || '';
const COOKIE = process.env.COOKIE || (fs.existsSync('cookie.txt') ? fs.readFileSync('cookie.txt', 'utf8').trim() : '');
const INTERVAL = Number(process.env.INTERVAL || 5) * 60 * 1000;

const H = () => ({ 'Content-Type': 'application/json', 'Origin': 'https://static.zsjy.chaoxing.com', 'User-Agent': 'Mozilla/5.0', ...(COOKIE ? { Cookie: COOKIE } : {}) });
const enc = (m) => { const c = crypto.createCipheriv('aes-128-ecb', Buffer.from(KEY, 'utf8'), null); return Buffer.concat([c.update(Buffer.from(m, 'utf8')), c.final()]).toString('base64'); };
const dec = (b) => { const d = crypto.createDecipheriv('aes-128-ecb', Buffer.from(KEY, 'utf8'), null); return Buffer.concat([d.update(Buffer.from(b, 'base64')), d.final()]).toString('utf8'); };
const post = async (p, b) => (await fetch(BASE + p, { method: 'POST', headers: H(), body: JSON.stringify(b || {}) })).json();
const get = async (p) => (await fetch(BASE + p, { headers: H() })).json();

async function levelIds() {
  const levels = (await get(`/applet/activity/level/list?uid=${UID}&activityId=${ACTIVITY}&fid=${FID}`)).data || [];
  return levels.map(l => l.id);
}

async function remain(levelId) {
  const r = await post('/applet/activity/chance', { levelId, uid: UID });
  return (r && r.data && r.data.activityRemainTimes) ?? -1;
}

async function dumpAll() {
  const levels = (await get(`/applet/activity/level/list?uid=${UID}&activityId=${ACTIVITY}&fid=${FID}`)).data;
  const all = [];
  for (const lv of levels) {
    const body = JSON.stringify({ levelId: lv.id, uid: UID, fid: FID, activityId: ACTIVITY });
    const r = await post(`/applet/activity/answer/start?uid=${UID}&fid=${FID}&activityId=${ACTIVITY}`, { encData: enc(body) });
    if (!r || !r.data || !r.data.data) { console.log(`关卡 ${lv.id} 无数据:`, JSON.stringify(r).slice(0, 120)); continue; }
    let qs; try { qs = JSON.parse(dec(r.data.data)); } catch (e) { console.log(`关卡 ${lv.id} 解密失败`, e.message); continue; }
    console.log(`关卡 ${lv.id} ${lv.levelName}: ${qs.length} 题`);
    qs.forEach(q => all.push({ level: lv.id, levelName: lv.levelName, ...q }));
  }
  fs.writeFileSync('题库.json', JSON.stringify(all, null, 2));
  console.log('总计:', all.length, '题 -> 题库.json');
  return all.length;
}

(async () => {
  if (!UID || !ACTIVITY) { console.error('请通过环境变量提供 UID / FID / ACTIVITY'); process.exit(1); }
  const ids = await levelIds();
  const probeLevel = ids[0];
  console.log('开始等待次数刷新... (每', INTERVAL / 60000, '分钟检查一次, 探测关卡', probeLevel, ')');
  while (true) {
    const n = await remain(probeLevel);
    const t = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    console.log(`[${t}] activityRemainTimes = ${n}`);
    if (n > 0) { console.log('次数已刷新，开始导出...'); await dumpAll(); break; }
    await new Promise(r => setTimeout(r, INTERVAL));
  }
})();
