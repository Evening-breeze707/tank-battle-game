const { pool, json, verifyToken } = require('./_utils');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { message: 'Method Not Allowed' });

  try {
    const user = verifyToken(event);
    const [rows] = await pool.execute(
      'SELECT level, score, lives, updated_at FROM game_profiles WHERE user_id = ? LIMIT 1',
      [user.userId],
    );

    return json(200, { profile: rows[0] || null });
  } catch {
    return json(401, { message: '未登录或无权限' });
  }
};
