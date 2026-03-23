const { pool, json } = require('./_utils');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { message: 'Method Not Allowed' });

  try {
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(120) UNIQUE NOT NULL,
        password_hash VARCHAR(200) NOT NULL,
        nickname VARCHAR(60) UNIQUE NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_login_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS game_profiles (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        level INT NOT NULL DEFAULT 1,
        score INT NOT NULL DEFAULT 0,
        lives INT NOT NULL DEFAULT 3,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS score_records (
        id BIGSERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        score INT NOT NULL,
        stage VARCHAR(20) NOT NULL,
        duration_sec INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_score_records_user_id ON score_records(user_id);
      CREATE INDEX IF NOT EXISTS idx_score_records_score ON score_records(score DESC);
    `);

    return json(200, { ok: true, message: '数据库初始化完成' });
  } catch (err) {
    return json(500, { message: '数据库初始化失败', detail: String(err.message || err) });
  }
};
