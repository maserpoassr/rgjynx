/* ============================================================================
 *  入馆教育/阅读活动 题库导出脚本（浏览器控制台版）
 *  站点: https://static.zsjy.chaoxing.com/project/custom-rgjy/index.html
 *
 *  用法:
 *   1. 在浏览器中打开该站点并登录，进入答题页面（如 #/mapPoint 或 #/answer）
 *   2. 打开开发者工具 -> Console，粘贴本文件全部内容并回车
 *   3. 脚本会自动抓取全部关卡题目并下载 题库.json，同时在控制台打印表格
 *
 *  原理: 复用页面已加载的 webpack 模块中的 packParams / wyjdecrypt（AES-128-ECB），
 *        调用后端 /api/applet/activity/answer/start 获取并解密题库。
 * ========================================================================== */
(async () => {
  const log = (...a) => console.log('[题库导出]', ...a);

  // ---------- 1. 取得 webpack require ----------
  let req = null;
  try {
    const rt = window.webpackChunkanswer;
    rt.push([[Math.random().toString(36).slice(2)], {}, (r) => { req = r; }]);
  } catch (e) {
    console.error('未找到 webpackChunkanswer，请确认页面已加载完成'); return;
  }
  if (!req) { console.error('无法获取 webpack require'); return; }

  // ---------- 2. 定位加密模块 (含 packParams / wyjdecrypt) ----------
  let crypt = null;
  try { const m = req(0x99c); if (m && m.A && m.A.packParams) crypt = m.A; } catch (e) {}
  if (!crypt) {
    for (const id of Object.keys(req.m || {})) {
      try {
        const m = req(id);
        if (m && m.A && typeof m.A.packParams === 'function' && typeof m.A.wyjdecrypt === 'function') { crypt = m.A; break; }
      } catch (e) { /* ignore */ }
    }
  }
  if (!crypt) { console.error('未找到加密模块'); return; }
  const KEY = crypt.keyArr.key;                 // 'o6v8cHFSdtIXT7q2'
  log('加密模块已加载, key =', KEY);

  // ---------- 3. 读取身份参数 (localStorage 优先, 其次 URL) ----------
  const usp = new URLSearchParams(location.search.replace(/^\?/, ''));
  const hsp = new URLSearchParams((location.hash.split('?')[1]) || '');
  const qp = (k) => usp.get(k) || hsp.get(k);
  const uid        = localStorage.getItem('answer-uid')        || qp('UID') || qp('uid');
  const fid        = localStorage.getItem('answer-fid')        || qp('fid');
  const activityId = localStorage.getItem('answer-activityId') || qp('activityId');
  log('uid =', uid, ' fid =', fid, ' activityId =', activityId);
  if (!uid || !activityId) { console.error('缺少 uid/activityId，请确认已登录并进入过活动页面'); return; }

  const BASE = 'https://tvu.chaoxing.com/api';
  async function post(path, body, headers) {
    const r = await fetch(BASE + path, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(headers || {}) },
      body: JSON.stringify(body),
    });
    return r.json();
  }
  async function get(path) {
    const r = await fetch(BASE + path, { credentials: 'include' });
    return r.json();
  }

  // ---------- 4. 关卡列表 ----------
  const lvRes = await get(`/applet/activity/level/list?uid=${uid}&activityId=${activityId}&fid=${fid}`);
  const levels = lvRes && lvRes.data;
  if (!Array.isArray(levels)) { console.error('关卡列表获取失败:', lvRes); return; }
  log('关卡数:', levels.length);

  // ---------- 5. 逐关拉取并解密题目 ----------
  const all = [];
  for (const lv of levels) {
    const payload = JSON.stringify({ levelId: lv.id, uid, fid, activityId });
    const encBody = crypt.packParams(payload);                 // { encData: AES-ECB(json) }
    let res;
    try {
      res = await post(`/applet/activity/answer/start?uid=${uid}&fid=${fid}&activityId=${activityId}`, encBody);
    } catch (e) { log('关卡', lv.id, '请求失败', e); continue; }
    if (!res || !res.data || !res.data.data) { log('关卡', lv.id, '无数据:', res); continue; }
    let qs;
    try {
      qs = JSON.parse(crypt.wyjdecrypt(res.data.data, KEY));   // AES-ECB 解密
    } catch (e) { log('关卡', lv.id, '解密失败', e); continue; }
    log(`关卡 ${lv.id} ${lv.levelName}: ${qs.length} 题`);
    qs.forEach(q => all.push({ level: lv.id, levelName: lv.levelName, ...q }));
  }

  log('总计:', all.length, '题');
  window.__TK__ = all;   // 结果挂到全局，方便进一步处理

  // ---------- 6. 导出 JSON ----------
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '题库.json';
  document.body.appendChild(a); a.click(); a.remove();

  // ---------- 7. 打印题目/答案表格 ----------
  const OPT = ['A', 'B', 'C', 'D', 'E', 'F'];
  console.table(all.map(q => {
    const opts = OPT.map((L, i) => q['option' + L] ? `${L}.${q['option' + L]}` : '').filter(Boolean).join(' | ');
    return { 关卡: q.level, 类型: q.type, 题目: q.questionTitle, 选项: opts, 答案: q.rightOption };
  }));
})();
