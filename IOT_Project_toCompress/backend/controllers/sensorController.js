const db = require('../config/db');

// API 2: Lấy dữ liệu phục vụ biểu đồ giám sát (Monitoring Chart)
exports.getChartData = async (req, res) => {
  try {
    // Lấy 10 mốc đo thời gian gần nhất trong CSDL
    const [rows] = await db.query(
      `SELECT 
         DATE_FORMAT(recorded_at, '%H:%i:%s') as time,
         MAX(CASE WHEN sensor_id = 1 THEN value END) as temperature,
         MAX(CASE WHEN sensor_id = 2 THEN value END) as humidity,
         MAX(CASE WHEN sensor_id = 3 THEN value END) as light
       FROM sensordata
       GROUP BY recorded_at
       ORDER BY recorded_at DESC
       LIMIT 10`
    );

    // Đảo ngược mảng để sắp xếp từ quá khứ đến hiện tại (trục X hiển thị từ trái qua phải)
    const chronologicalData = rows.reverse().map(r => ({
      time: r.time,
      temperature: r.temperature !== null ? Number(r.temperature.toFixed(1)) : 0,
      humidity: r.humidity !== null ? Number(r.humidity.toFixed(1)) : 0,
      light: r.light !== null ? Math.round(r.light) : 0
    }));

    return res.status(200).json({
      success: true,
      data: chronologicalData
    });
  } catch (error) {
    console.error('Lỗi getChartData:', error);
    return res.status(500).json({ success: false, message: 'Lỗi truy vấn dữ liệu biểu đồ' });
  }
};

// API 3: Truy vấn và phân trang lịch sử dữ liệu cảm biến (Sensor Data)
exports.getSensorHistory = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
    const offset = (page - 1) * limit;

    const { filterType, searchValue } = req.query;

    let whereClauses = [];
    let params = [];

    if (filterType === 'Nhiệt độ (DHT11)' || filterType === 'Độ ẩm (DHT11)' || filterType === 'Độ sáng (CBAS)') {
      whereClauses.push('s.sensor_name = ?');
      params.push(filterType);
    } else if (filterType === 'VALUE' && searchValue) {
      whereClauses.push('CAST(sd.value AS CHAR) LIKE ?');
      params.push(`%${searchValue.trim()}%`);
    } else if (filterType === 'TIME' && searchValue) {
      whereClauses.push('DATE_FORMAT(sd.recorded_at, "%Y-%m-%d %H:%i:%s") LIKE ?');
      params.push(`%${searchValue.trim()}%`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM sensordata sd 
       JOIN sensors s ON sd.sensor_id = s.sensor_id ${whereSql}`,
      params
    );
    const totalRecords = countRows[0].total;

    const [rows] = await db.query(
      `SELECT sd.data_id, s.sensor_name, sd.value, s.unit,
              DATE_FORMAT(sd.recorded_at, "%Y-%m-%d %H:%i:%s") as recorded_at
       FROM sensordata sd
       JOIN sensors s ON sd.sensor_id = s.sensor_id
       ${whereSql}
       ORDER BY sd.recorded_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const formattedData = rows.map(r => ({
      id: `SN-${String(r.data_id).padStart(3, '0')}`,
      name: r.sensor_name,
      value: `${r.value}${r.unit ? (r.unit === 'lx' ? ' lx' : r.unit) : ''}`,
      time: r.recorded_at
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
    console.error('Lỗi getSensorHistory:', error);
    return res.status(500).json({ success: false, message: 'Lỗi truy vấn lịch sử cảm biến' });
  }
};


// API : Lấy dữ liệu cảm biến mới nhất (GET /api/sensor-data/latest)
exports.getLatestSensorData = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
         DATE_FORMAT(recorded_at, '%Y-%m-%d %H:%i:%s') as time,
         MAX(CASE WHEN sensor_id = 1 THEN value END) as temperature,
         MAX(CASE WHEN sensor_id = 2 THEN value END) as humidity,
         MAX(CASE WHEN sensor_id = 3 THEN value END) as light
       FROM sensordata
       GROUP BY recorded_at
       ORDER BY recorded_at DESC
       LIMIT 1`
    );

    const latest = rows[0] || { time: null, temperature: 0, humidity: 0, light: 0 };

    return res.status(200).json({
      success: true,
      message: 'Lấy dữ liệu cảm biến mới nhất thành công',
      data: {
        time: latest.time,
        temperature: latest.temperature !== null ? Number(latest.temperature.toFixed(1)) : 0,
        humidity: latest.humidity !== null ? Number(latest.humidity.toFixed(1)) : 0,
        light: latest.light !== null ? Math.round(latest.light) : 0
      }
    });
  } catch (error) {
    console.error('Lỗi getLatestSensorData:', error);
    return res.status(500).json({ success: false, message: 'Lỗi truy vấn dữ liệu cảm biến mới nhất' });
  }
};