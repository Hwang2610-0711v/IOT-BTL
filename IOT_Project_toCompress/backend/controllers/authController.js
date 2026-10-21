const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// API 1: Đăng nhập hệ thống (POST /api/auth/login)
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền tên đăng nhập và mật khẩu'
      });
    }

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    // 1. Tìm user trong CSDL
    const [users] = await db.query(
      'SELECT * FROM users WHERE username = ? LIMIT 1',
      [cleanUsername]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không chính xác'
      });
    }

    const user = users[0];

    // 2. Đối chiếu mật khẩu bằng bcrypt.compare
    const isMatch = await bcrypt.compare(cleanPassword, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không chính xác'
      });
    }

    // 3. Khởi tạo mã phiên JWT Token
    const token = jwt.sign(
      { user_id: user.user_id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'PTIT_IOT_SECRET_KEY_2026',
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      data: {
        user_id: user.user_id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        token: token
      }
    });
  } catch (error) {
    console.error('Lỗi Controller Auth:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ' });
  }
};

// API : Đăng ký tài khoản mới (POST /api/auth/register)
exports.register = async (req, res) => {
  try {
    const { username, password, full_name } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền tên đăng nhập và mật khẩu'
      });
    }

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();
    const cleanFullName = full_name ? full_name.trim() : 'Lê Thế Hoàng';

    // 1. Kiểm tra username đã tồn tại trong bảng users chưa
    const [existingUsers] = await db.query(
      'SELECT user_id FROM users WHERE username = ? LIMIT 1',
      [cleanUsername]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Tên đăng nhập đã tồn tại trong hệ thống'
      });
    }

    // 2. Mã hóa mật khẩu bằng bcryptjs và lưu vào MySQL
    const hashedPassword = await bcrypt.hash(cleanPassword, 10);

    const [result] = await db.query(
      'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
      [cleanUsername, hashedPassword, cleanFullName, 'user']
    );

    // 3. Khởi tạo mã phiên JWT Token đồng bộ với hàm login
    const token = jwt.sign(
      { user_id: result.insertId, username: cleanUsername, role: 'user' },
      process.env.JWT_SECRET || 'PTIT_IOT_SECRET_KEY_2026',
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công',
      data: {
        user_id: result.insertId,
        username: cleanUsername,
        full_name: cleanFullName,
        role: 'user',
        token: token
      }
    });
  } catch (error) {
    console.error('Lỗi register Auth:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ' });
  }
};