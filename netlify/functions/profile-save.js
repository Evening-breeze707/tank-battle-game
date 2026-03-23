const { pool, json, verifyToken } = require('./_utils');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { message: 'Method Not Allowed' });

  try {
    const user = verifyToken(event);
    const { level, score, lives } = JSON.parse(event.body || '{}');

    if (![level, score, lives].every((v) => Number.isInteger(v))) {
      return json(400, { message: '参数格式错误' });
    }

    await pool.execute(
      `INSERT INTO game_profiles (user_id, level, score, lives, updated_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         level = VALUES(level),
         score = VALUES(score),
         lives = VALUES(lives),
         updated_at = NOW()`,
      [user.userId, level, score, lives],
    );

    return json(200, { ok: true });
  } catch {
    return json(401, { message: '未登录或无权限' });
  }
};
