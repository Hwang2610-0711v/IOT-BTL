const db = require('../config/db');
const { sendDeviceCommand } = require('../config/mqtt');

// API 6: Lấy danh sách & trạng thái thiết bị
exports.getDevices = async (req, res) => {
  try {
    const [devices] = await db.query(
      'SELECT device_id, device_name, actual_state FROM devices ORDER BY device_id ASC'
    );
    return res.status(200).json({
      success: true,
      data: devices
    });
  } catch (error) {
    console.error('Lỗi getDevices:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ' });
  }
};

// API 4: Gửi lệnh điều khiển thiết bị (POST /api/devices/:id/control)
exports.controlDevice = async (req, res) => {
  const deviceId = parseInt(req.params.id, 10);
  const { command } = req.body;
  const userId = req.user ? req.user.user_id : 1; // Fallback admin

  if (!command || !['ON', 'OFF', 'Bật', 'Tắt'].includes(command)) {
    return res.status(400).json({ success: false, message: 'Lệnh command không hợp lệ (ON/OFF)' });
  }

  const standardCommand = (command === 'ON' || command === 'Bật') ? 'ON' : 'OFF';

  try {
    // 1. Kiểm tra thiết bị tồn tại
    const [devs] = await db.query('SELECT * FROM devices WHERE device_id = ?', [deviceId]);
    if (devs.length === 0) {
      return res.status(404).json({ success: false, message: 'Thiết bị không tồn tại' });
    }
    const device = devs[0];

    // 2. Ghi bản ghi PENDING vào actions
    const now = new Date();
    const [actionRes] = await db.query(
      'INSERT INTO actions (device_id, user_id, command, status, executed_at) VALUES (?, ?, ?, "PENDING", ?)',
      [deviceId, userId, standardCommand, now]
    );
    const actionId = actionRes.insertId;

    // 3. Đẩy lệnh MQTT và chờ phản hồi tối đa 5s
    try {
      await sendDeviceCommand(deviceId, standardCommand);

      // ESP8266 đã xác nhận thành công
      await db.query('UPDATE actions SET status = "SUCCESS" WHERE action_id = ?', [actionId]);

      const timeStr = now.toISOString().slice(0, 19).replace('T', ' ');
      return res.status(200).json({
        success: true,
        message: 'Điều khiển thiết bị thành công',
        data: {
          action_id: actionId,
          device_id: deviceId,
          device_name: device.device_name,
          command: standardCommand,
          status: 'SUCCESS',
          actual_state: standardCommand,
          executed_at: timeStr
        }
      });
    } catch (mqttErr) {
      // Quá thời gian quy định hoặc mất kết nối
      await db.query('UPDATE actions SET status = "FAILED" WHERE action_id = ?', [actionId]);

      return res.status(504).json({
        success: false,
        message: 'Thiết bị không phản hồi, lệnh điều khiển thất bại',
        data: {
          action_id: actionId,
          device_id: deviceId,
          status: 'FAILED'
        }
      });
    }
  } catch (error) {
    console.error('Lỗi controlDevice:', error);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi điều khiển' });
  }
};

// API 5: Lịch sử hoạt động thiết bị (GET /api/actions/history)
exports.getActionHistory = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
    const offset = (page - 1) * limit;

    const { device_name, command, status, timeSearch } = req.query;

    let whereClauses = [];
    let params = [];

    if (device_name && device_name !== 'ALL') {
      whereClauses.push('d.device_name = ?');
      params.push(device_name);
    }
    if (command && command !== 'ALL') {
      const cmdMap = command === 'Bật' ? 'ON' : (command === 'Tắt' ? 'OFF' : command);
      whereClauses.push('a.command = ?');
      params.push(cmdMap);
    }
    if (status && status !== 'ALL') {
      const statusMap = status === 'Thành công' ? 'SUCCESS' : (status === 'Thất bại' ? 'FAILED' : status);
      whereClauses.push('a.status = ?');
      params.push(statusMap);
    }
    if (timeSearch && timeSearch.trim() !== '') {
      whereClauses.push('DATE_FORMAT(a.executed_at, "%Y-%m-%d %H:%i:%s") LIKE ?');
      params.push(`%${timeSearch.trim()}%`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Lấy tổng số bản ghi
    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM actions a 
       JOIN devices d ON a.device_id = d.device_id 
       JOIN users u ON a.user_id = u.user_id ${whereSql}`,
      params
    );
    const totalRecords = countRows[0].total;

    // Lấy bản ghi phân trang
    const [rows] = await db.query(
      `SELECT a.action_id, d.device_name, a.command, a.status, 
              DATE_FORMAT(a.executed_at, "%Y-%m-%d %H:%i:%s") as executed_at, 
              u.username
       FROM actions a
       JOIN devices d ON a.device_id = d.device_id
       JOIN users u ON a.user_id = u.user_id
       ${whereSql}
       ORDER BY a.executed_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Chuẩn hóa định dạng hiển thị tiếng Việt khớp với Frontend table
    const formattedData = rows.map(r => ({
      id: `HT-${String(r.action_id).padStart(3, '0')}`,
      device: r.device_name,
      action: r.command === 'ON' ? 'Bật' : 'Tắt',
      status: r.status === 'SUCCESS' ? 'Thành công' : 'Thất bại',
      time: r.executed_at,
      user: r.username
    }));

    return res.status(200).json({
      success: true,
      data: formattedData,
      pagination: {
        current_page: page,
        limit: limit,
        total_records: totalRecords,
        total_pages: Math.ceil(totalRecords / limit) || 1
      }
    });
  } catch (error) {
    console.error('Lỗi getActionHistory:', error);
    return res.status(500).json({ success: false, message: 'Lỗi truy vấn lịch sử điều khiển' });
  }
};