const { pool, json, verifyToken } = require('./_utils');

let lastSubmitByUser = new Map();

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { message: 'Method Not Allowed' });

  try {
    const user = verifyToken(event);
    const { score, stage, duration_sec } = JSON.parse(event.body || '{}');

    if (!Number.isInteger(score) || score < 0 || score > 999999) {
      return json(400, { message: '分数不合法' });
    }

    const now = Date.now();
    const lastAt = lastSubmitByUser.get(user.userId) || 0;
    if (now - lastAt < 500) {
      return json(200, { ok: true, throttled: true });
    }
    lastSubmitByUser.set(user.userId, now);

    await pool.execute(
      `INSERT INTO score_records (user_id, score, stage, duration_sec, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [user.userId, score, String(stage || '1-1'), Number.isInteger(duration_sec) ? duration_sec : 0],
    );

    return json(200, { ok: true });
  } catch {
    return json(401, { message: '未登录或无权限' });
  }
};
