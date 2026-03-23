const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, json } = require('./_utils');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { message: 'Method Not Allowed' });

  try {
    const { email, password } = JSON.parse(event.body || '{}');
    if (!email || !password) return json(400, { message: '参数不完整' });

    const [rows] = await pool.execute(
      'SELECT id, email, nickname, password_hash FROM users WHERE email = ? LIMIT 1',
      [email.trim().toLowerCase()],
    );

    const user = rows[0];
    if (!user) return json(401, { message: '账号或密码错误' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return json(401, { message: '账号或密码错误' });

    await pool.execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    const token = jwt.sign(
      { userId: user.id, email: user.email, nickname: user.nickname },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: '7d' },
    );

    return json(200, { token, user: { id: user.id, email: user.email, nickname: user.nickname } });
  } catch {
    return json(500, { message: '登录失败' });
  }
};
