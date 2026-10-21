CREATE DATABASE IF NOT EXISTS iot_ptit CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE iot_ptit;

-- 1. Bảng Users
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  role VARCHAR(20) DEFAULT 'user'
);

-- 2. Bảng Sensors
CREATE TABLE IF NOT EXISTS sensors (
  sensor_id INT AUTO_INCREMENT PRIMARY KEY,
  sensor_name VARCHAR(50) NOT NULL UNIQUE,
  unit VARCHAR(20)
);

-- 3. Bảng SensorData
CREATE TABLE IF NOT EXISTS sensordata (
  data_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sensor_id INT NOT NULL,
  value FLOAT NOT NULL,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sensor_id) REFERENCES sensors(sensor_id) ON DELETE CASCADE
);

-- 4. Bảng Devices
CREATE TABLE IF NOT EXISTS devices (
  device_id INT AUTO_INCREMENT PRIMARY KEY,
  device_name VARCHAR(50) NOT NULL,
  actual_state VARCHAR(10) DEFAULT 'OFF'
);

-- 5. Bảng Actions
CREATE TABLE IF NOT EXISTS actions (
  action_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  device_id INT NOT NULL,
  user_id INT NOT NULL,
  command VARCHAR(10) NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Tạo Index tối ưu hóa truy vấn biểu đồ và tìm kiếm phân trang
CREATE INDEX idx_sensordata_recorded ON sensordata(recorded_at);
CREATE INDEX idx_actions_executed ON actions(executed_at);

-- Dữ liệu hạt giống (Seed Data)
-- Mật khẩu mặc định: 12345678 (đã băm bằng bcrypt)
INSERT INTO users (username, password, full_name, role) VALUES 
('admin@iotptit.vn', '$2a$10$wN1r7y7F6c/h4mR8x1R8h.gZ12o0M7p6d6Tz7481L48qE.X11Mv4q', 'Lê Thế Hoàng', 'admin'),
('user001', '$2a$10$wN1r7y7F6c/h4mR8x1R8h.gZ12o0M7p6d6Tz7481L48qE.X11Mv4q', 'Lê Thế Hoàng', 'user')
ON DUPLICATE KEY UPDATE full_name=VALUES(full_name);

INSERT INTO sensors (sensor_id, sensor_name, unit) VALUES 
(1, 'Nhiệt độ (DHT11)', '°C'),
(2, 'Độ ẩm (DHT11)', '%'),
(3, 'Độ sáng (CBAS)', 'lx')
ON DUPLICATE KEY UPDATE sensor_name=VALUES(sensor_name);

INSERT INTO devices (device_id, device_name, actual_state) VALUES 
(1, 'Quạt', 'OFF'),
(2, 'Đèn', 'OFF'),
(3, 'Điều hòa', 'OFF')
ON DUPLICATE KEY UPDATE device_name=VALUES(device_name);