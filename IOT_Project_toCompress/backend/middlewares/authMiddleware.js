const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Yêu cầu Token xác thực để truy cập API này'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'PTIT_IOT_SECRET_KEY_2026', (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Token đã hết hạn hoặc không hợp lệ'
      });
    }
    req.user = user;
    next();
  });
}

module.exports = { verifyToken };