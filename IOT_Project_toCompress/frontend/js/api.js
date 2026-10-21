/**
 * ==============================================================================
 * IOT PTIT - API CLIENT & REALTIME SERVICE LAYER (js/api.js)
 * Quản lý kết nối REST API & WebSocket thực tế với Node.js Backend
 * ==============================================================================
 */

// Cấu hình địa chỉ máy chủ Backend Node.js và cổng WebSocket thời gian thực
const API_BASE_URL = 'http://localhost:5000/api';
const WS_URL = 'ws://localhost:5000/ws/realtime';

// Hàm tiện ích lấy Header xác thực kèm JWT Token từ localStorage
function getAuthHeader() {
  const token = localStorage.getItem('iot_token');
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

// 1. API Đăng nhập
// main.js sẽ gọi trong handleLogin() khi người dùng submit form ở index.html
async function apiLogin(username, password) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return await res.json();
}

// 1.1 API Đăng ký tài khoản mới
async function apiRegister(username, password, full_name) {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, full_name })
  });
  return await res.json();
}


// 2. API Lấy trạng thái thực tế của các thiết bị
// main.js sẽ gọi trong refreshDeviceState() khi tải trang hoặc bấm nút "Cập nhật"
async function apiGetDevices() {
  const res = await fetch(`${API_BASE_URL}/devices`, { headers: getAuthHeader() });
  return await res.json();
}

// 3. API Điều khiển thiết bị (Bật / Tắt)
// main.js sẽ gọi trong handleDeviceToggle() khi người dùng gạt công tắc trên dashboard.html
async function apiControlDevice(deviceId, command) {
  const res = await fetch(`${API_BASE_URL}/devices/${deviceId}/control`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ command })
  });
  return await res.json();
}

// 4. API Lấy dữ liệu lịch sử gần nhất để khởi tạo biểu đồ
// main.js sẽ gọi trong initSensorChart() khi tạo Chart instance trên dashboard.html
async function apiGetChartData(duration = '1h') {
  const res = await fetch(`${API_BASE_URL}/sensor-data/chart?duration=${duration}`, { headers: getAuthHeader() });
  return await res.json();
}

// 5. API Lấy danh sách dữ liệu cảm biến (Sensor Data) có lọc, tìm kiếm và phân trang
// main.js sẽ gọi trong renderSensorDataTable() để render bảng ở sensor-data.html
async function apiGetSensorHistory(page = 1, limit = 10, filterType = 'ALL', searchValue = '') {
  const query = new URLSearchParams({ page, limit, filterType, searchValue });
  const res = await fetch(`${API_BASE_URL}/sensor-data/history?${query.toString()}`, { headers: getAuthHeader() });
  return await res.json();
}

// 6. API Lấy lịch sử hoạt động thiết bị (Action History) có lọc và phân trang
// main.js sẽ gọi trong renderHistoryTable() để render bảng ở history.html
async function apiGetActionHistory(page = 1, limit = 8, device_name = 'ALL', command = 'ALL', status = 'ALL', timeSearch = '') {
  const query = new URLSearchParams({ page, limit, device_name, command, status, timeSearch });
  const res = await fetch(`${API_BASE_URL}/actions/history?${query.toString()}`, { headers: getAuthHeader() });
  return await res.json();
}

// 7. Khởi tạo kết nối WebSocket nhận luồng dữ liệu cảm biến thời gian thực
// main.js sẽ gọi trong startRealtimeStream() để cập nhật 3 Card và biểu đồ
function initRealtimeWebSocket(onSensorUpdate) {
  const ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('[WebSocket] Đã kết nối tới Server thời gian thực!');
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.event === 'SENSOR_UPDATE' && typeof onSensorUpdate === 'function') {
        onSensorUpdate(msg.data);
      }
    } catch (err) {
      console.error('[WebSocket] Lỗi xử lý bản tin:', err);
    }
  };

  ws.onclose = () => {
    console.warn('[WebSocket] Mất kết nối, đang thử kết nối lại sau 3 giây...');
    setTimeout(() => initRealtimeWebSocket(onSensorUpdate), 3000);
  };
}