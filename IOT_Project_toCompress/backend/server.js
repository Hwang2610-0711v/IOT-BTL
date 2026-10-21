require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const db = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const sensorRoutes = require('./routes/sensorRoutes');
const { getActionHistory } = require('./controllers/deviceController');
const { initWebSocket } = require('./services/websocketService');
require('./config/mqtt'); // Kích hoạt kết nối MQTT

const app = express();
const server = http.createServer(app);

//   NEW NGÀY 21/10
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
//   http://localhost:5000/api/docs


// 1. Tự động khởi tạo / chuẩn hóa tài khoản Admin vào Database khi khởi động
async function initAdminAccount() {
  try {
    const rawPass = '12345678';
    const hashedPassword = await bcrypt.hash(rawPass, 10);

    await db.query(
      `INSERT INTO users (username, password, full_name, role) 
       VALUES ('admin@iotptit.vn', ?, 'Lê Thế Hoàng', 'admin')
       ON DUPLICATE KEY UPDATE password = ?, full_name = 'Lê Thế Hoàng'`,
      [hashedPassword, hashedPassword]
    );
  } catch (err) {
    console.error('✗ Lỗi khởi tạo tài khoản admin:', err.message);
  }
}

// 2. Khởi tạo WebSocket Server trên đường dẫn /ws/realtime
initWebSocket(server);

// 3. Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Định tuyến API theo tài liệu SRS
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/sensor-data', sensorRoutes);
app.get('/api/actions/history', getActionHistory);

// Bắt lỗi tuyến đường không tồn tại
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Không tìm thấy API endpoint' });
});

// 5. Khởi chạy Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  console.log(`===============================================`);
  console.log(`✓ IoT PTIT Backend đang chạy trên cổng : ${PORT}`);
  console.log(`✓ HTTP API URL: http://localhost:${PORT}`);
  console.log(`✓ WebSocket:   ws://localhost:${PORT}/ws/realtime`);
  console.log(`===============================================`);

  // Thực thi nạp tài khoản admin tự động
  await initAdminAccount();
});