const mqtt = require('mqtt');
const EventEmitter = require('events');
const db = require('./db');
const { broadcastRealtime } = require('../services/websocketService');

const mqttEvents = new EventEmitter();

const options = {
  clientId: 'NodeJS_Backend_' + Math.random().toString(16).substring(2, 8),
  username: process.env.MQTT_USERNAME || 'lethehoang',
  password: process.env.MQTT_PASSWORD || 'b23dccn331',
  reconnectPeriod: 3000
};

const client = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://10.121.99.92:1891', options);

const TOPIC_SENSOR = 'sensor_data';
const TOPIC_CONTROL = 'device_control';
const TOPIC_STATUS = 'device_status';

client.on('connect', () => {
  console.log('✓ Kết nối MQTT Broker thành công!');
  client.subscribe([TOPIC_SENSOR, TOPIC_STATUS], (err) => {
    if (err) console.error('Lỗi Subscribe MQTT:', err);
    else console.log(`✓ Đã đăng ký lắng nghe: ${TOPIC_SENSOR}, ${TOPIC_STATUS}`);
  });
});

client.on('error', (err) => {
  console.error('✗ Lỗi MQTT Client:', err.message);
});

// Xử lý gói tin nhận được từ ESP8266
client.on('message', async (topic, message) => {
  const payloadStr = message.toString().trim();

  // 1. Phân tích dữ liệu cảm biến định kỳ 2s
  if (topic === TOPIC_SENSOR) {
    try {
      let temp = null, hum = null, light = null;

      // Hỗ trợ cú pháp chuỗi từ Arduino: "Nhiet do: 28.4 C | Do am: 65.2 % | Anh sang: 480"
      const match = payloadStr.match(/Nhiet\s*do:\s*([\d.]+)\s*C\s*\|\s*Do\s*am:\s*([\d.]+)\s*%\s*\|\s*Anh\s*sang:\s*(\d+)/i);
      if (match) {
        temp = parseFloat(match[1]);
        hum = parseFloat(match[2]);
        light = parseInt(match[3], 10);
      } else {
        // Fallback định dạng JSON nếu nâng cấp firmware
        const json = JSON.parse(payloadStr);
        temp = json.temperature;
        hum = json.humidity;
        light = json.light;
      }

      if (temp !== null && hum !== null && light !== null) {
        const now = new Date();
        // Lưu đồng thời 3 thông số vào bảng sensordata
        await db.query(
          `INSERT INTO sensordata (sensor_id, value, recorded_at) VALUES 
           (1, ?, ?), (2, ?, ?), (3, ?, ?)`,
          [temp, now, hum, now, light, now]
        );

        // Lấy trạng thái 3 thiết bị hiện tại để hoàn thiện payload chuẩn SRS
        const [devices] = await db.query('SELECT device_id, device_name, actual_state FROM devices ORDER BY device_id ASC');

        // Bắn WebSocket đến tất cả Client đang mở Dashboard
        broadcastRealtime({
          event: 'SENSOR_UPDATE',
          timestamp: now.toISOString(),
          data: {
            temperature: temp,
            humidity: hum,
            light: light,
            devices: devices
          }
        });
      }
    } catch (e) {
      console.error('Lỗi phân tích hoặc lưu dữ liệu cảm biến:', e.message);
    }
  }

  // 2. Nhận xác nhận trạng thái bật/tắt từ ESP8266
  if (topic === TOPIC_STATUS) {
    console.log(`[MQTT STATUS] Nhận từ ESP: "${payloadStr}"`);
    let deviceId = null;
    let state = null;

    if (payloadStr === 'LED1 DA BAT') { deviceId = 1; state = 'ON'; }
    else if (payloadStr === 'LED1 DA TAT') { deviceId = 1; state = 'OFF'; }
    else if (payloadStr === 'LED2 DA BAT') { deviceId = 2; state = 'ON'; }
    else if (payloadStr === 'LED2 DA TAT') { deviceId = 2; state = 'OFF'; }
    else if (payloadStr === 'LED3 DA BAT') { deviceId = 3; state = 'ON'; }
    else if (payloadStr === 'LED3 DA TAT') { deviceId = 3; state = 'OFF'; }

    if (deviceId && state) {
      // Cập nhật CSDL
      await db.query('UPDATE devices SET actual_state = ? WHERE device_id = ?', [state, deviceId]);
      // Phát tín hiệu cho Promise Controller đang đợi
      mqttEvents.emit(`device_state_${deviceId}`, { deviceId, state });
    }
  }
});

// Hàm phát lệnh điều khiển có cơ chế chờ phản hồi Timeout 5s
function sendDeviceCommand(deviceId, command) {
  return new Promise((resolve, reject) => {
    let rawCommand = '';
    const normCmd = command.toUpperCase();

    if (deviceId === 1) rawCommand = (normCmd === 'ON' || normCmd === 'BẬT') ? 'LED1_ON' : 'LED1_OFF';
    else if (deviceId === 2) rawCommand = (normCmd === 'ON' || normCmd === 'BẬT') ? 'LED2_ON' : 'LED2_OFF';
    else if (deviceId === 3) rawCommand = (normCmd === 'ON' || normCmd === 'BẬT') ? 'LED3_ON' : 'LED3_OFF';
    else return reject(new Error('ID thiết bị không hợp lệ'));

    const expectedState = (normCmd === 'ON' || normCmd === 'BẬT') ? 'ON' : 'OFF';
    const eventName = `device_state_${deviceId}`;

    let timer = null;

    const onStateReceived = (data) => {
      if (data.state === expectedState) {
        clearTimeout(timer);
        mqttEvents.removeListener(eventName, onStateReceived);
        resolve(data);
      }
    };

    timer = setTimeout(() => {
      mqttEvents.removeListener(eventName, onStateReceived);
      reject(new Error('TIMEOUT'));
    }, 5000);

    mqttEvents.on(eventName, onStateReceived);

    // Gửi lệnh điều khiển lên MQTT Broker
    client.publish(TOPIC_CONTROL, rawCommand, { qos: 1 }, (err) => {
      if (err) {
        clearTimeout(timer);
        mqttEvents.removeListener(eventName, onStateReceived);
        reject(err);
      }
    });
  });
}

module.exports = { client, sendDeviceCommand };