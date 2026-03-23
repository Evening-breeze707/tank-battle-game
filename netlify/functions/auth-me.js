const { json, verifyToken } = require('./_utils');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { message: 'Method Not Allowed' });

  try {
    const payload = verifyToken(event);
    return json(200, {
      user: {
        id: payload.userId,
        email: payload.email,
        nickname: payload.nickname,
      },
    });
  } catch {
    return json(401, { message: '未登录或登录已过期' });
  }
};
