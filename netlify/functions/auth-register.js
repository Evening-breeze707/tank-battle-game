const bcrypt = require('bcryptjs');
const { pool, json } = require('./_utils');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { message: 'Method Not Allowed' });

  try {
    const { email, password, nickname } = JSON.parse(event.body || '{}');
    if (!email || !password || !nickname) return json(400, { message: '参数不完整' });
    if (password.length < 6) return json(400, { message: '密码至少6位' });

    const hash = await bcrypt.hash(password, 10);

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedNickname = nickname.trim();

    const [result] = await pool.execute(
      `INSERT INTO users(email, password_hash, nickname)
       VALUES (?, ?, ?)`,
      [normalizedEmail, hash, normalizedNickname],
    );

    return json(200, {
      user: {
        id: result.insertId,
        email: normalizedEmail,
        nickname: normalizedNickname,
      },
    });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') return json(409, { message: '邮箱或昵称已存在' });
    return json(500, { message: '注册失败' });
  }
};
