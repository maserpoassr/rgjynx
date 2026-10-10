const crypto = require('crypto');

const KEY = 'o6v8cHFSdtIXT7q2';
const BASE = 'https://tvu.chaoxing.com/api';
const ORIGIN = 'https://static.zsjy.chaoxing.com';
const UID = process.env.UID || '1';
const FID = process.env.FID || '1';
const ACTIVITY = process.env.ACTIVITY || '1';

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

async function post(path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': ORIGIN, 'User-Agent': 'Mozilla/5.0', ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, text: await res.text(), headers: res.headers };
}
async function get(path) {
  const res = await fetch(BASE + path, { headers: { 'Origin': ORIGIN, 'User-Agent': 'Mozilla/5.0' } });
  return { status: res.status, text: await res.text() };
}

(async () => {
  // 1. 关卡列表
  const lr = await get(`/applet/activity/level/list?uid=${UID}&activityId=${ACTIVITY}&fid=${FID}`);
  const levels = JSON.parse(lr.text).data;
  console.log('levels:', levels.length);

  const all = [];
  for (const lv of levels) {
    const payload = JSON.stringify({ levelId: lv.id, uid: UID, fid: FID, activityId: ACTIVITY });
    const r = await post(
      `/applet/activity/answer/start?uid=${UID}&fid=${FID}&activityId=${ACTIVITY}`,
      { encData: enc(payload) }
    );
    let body;
    try { body = JSON.parse(r.text); } catch (e) { console.log('level', lv.id, 'parse fail', r.text.slice(0, 200)); continue; }
    if (!body.data || !body.data.data) { console.log('level', lv.id, 'no data:', r.text.slice(0, 200)); continue; }
    let qs;
    try { qs = JSON.parse(dec(body.data.data)); } catch (e) { console.log('level', lv.id, 'dec fail', e.message); continue; }
    console.log(`level ${lv.id} (${lv.levelName}): ${qs.length} questions`);
    qs.forEach(q => all.push({ level: lv.id, levelName: lv.levelName, ...q }));
  }
  require('fs').writeFileSync('题库_raw.json', JSON.stringify(all, null, 2));
  console.log('total:', all.length, '-> 题库_raw.json');
  if (all[0]) console.log('sample:', JSON.stringify(all[0], null, 2));
})();
