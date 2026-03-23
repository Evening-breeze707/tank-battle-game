const { pool, json } = require('./_utils');

let leaderboardCache = { at: 0, items: [] };
const CACHE_TTL_MS = 10000;

exports.handler = async () => {
  const now = Date.now();
  if (now - leaderboardCache.at < CACHE_TTL_MS) {
    return json(200, { items: leaderboardCache.items, cached: true });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT u.nickname, t.best_score
       FROM (
         SELECT user_id, MAX(score) AS best_score
         FROM score_records
         GROUP BY user_id
       ) t
       JOIN users u ON u.id = t.user_id
       ORDER BY t.best_score DESC
       LIMIT 20`,
    );

    const items = rows.map((row) => ({
      nickname: row.nickname,
      best_score: Number(row.best_score || 0),
    }));

    leaderboardCache = { at: now, items };
    return json(200, { items, cached: false });
  } catch {
    return json(500, { message: '排行榜加载失败' });
  }
};
