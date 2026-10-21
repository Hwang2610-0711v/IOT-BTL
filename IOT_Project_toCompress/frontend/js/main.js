/**
 * ==============================================================================
 * IOT PTIT - UI & CONTROLLER LAYER (js/main.js)
 * Điều khiển giao diện, tương tác DOM, biểu đồ Chart.js, phân trang và WebSocket
 * Đã kết nối với Node.js Backend API & WebSocket Server
 * ==============================================================================
 */

const MAX_CHART_POINTS = 10; // Cố định luôn có 10 mốc thời gian trên biểu đồ

let myChartInstance = null;
let currentSensorPage = 1;
let sensorPageSize = 10;
let currentHistoryPage = 1;
let historyPageSize = 8; // Mặc định 8 bản ghi

// Trạng thái bộ lọc đã áp dụng (chỉ cập nhật khi nhấn nút Tìm kiếm hình kính lúp)
let appliedSensorFilter = 'ALL';
let appliedSensorSearch = '';

let appliedHistoryDevice = 'ALL';
let appliedHistoryAction = 'ALL';
let appliedHistoryStatus = 'ALL';
let appliedHistoryTime = '';

// Hàm định dạng ngày giờ cục bộ chuẩn Việt Nam (YYYY-MM-DD HH:mm:ss)
function getLocalDateTimeStr(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Hàm tiện ích sao chép nhanh chuỗi thời gian vào Clipboard
function copyTimeToClipboard(timeStr, btnElem) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(timeStr);
  } else {
    const tempInput = document.createElement('input');
    tempInput.value = timeStr;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
  }

  if (!btnElem) return;
  const copyIconHtml = `
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  `;
  btnElem.classList.add('copied');
  btnElem.innerHTML = `
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M5 13l4 4L19 7" />
    </svg>
  `;
  setTimeout(() => {
    btnElem.classList.remove('copied');
    btnElem.innerHTML = copyIconHtml;
  }, 1200);
}

// --- 1. Tiện ích Toast thông báo toàn cục ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  let iconColor = '#1746c9';
  if (type === 'success') iconColor = '#16a34a';
  if (type === 'error') iconColor = '#dc2626';

  toast.innerHTML = `
    <svg style="width: 16px; height: 16px; color: ${iconColor}; flex-shrink: 0;" fill="currentColor" viewBox="0 0 20 20">
      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
    </svg>
    <span style="flex: 1;">${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// --- 2. Logic Màn hình Đăng nhập (index.html) ---
function togglePasswordVisibility() {
  const pwd = document.getElementById('loginPassword');
  const icon = document.getElementById('eyeIcon');
  if (!pwd || !icon) return;

  if (pwd.type === 'password') {
    pwd.type = 'text';
    // Đổi icon thành mắt gạch chéo (đang hiện mật khẩu)
    icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />`;
  } else {
    pwd.type = 'password';
    // Đổi lại icon "mắt thường"
    icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />`;
  }
}

// Hàm xử lý đăng nhập qua API Backend
async function handleLogin() {
  const user = document.getElementById('loginUsername')?.value.trim();
  const pass = document.getElementById('loginPassword')?.value.trim();
  if (!user || !pass) {
    showToast('Vui lòng nhập tên đăng nhập và mật khẩu!', 'error');
    return;
  }

  try {
    const res = await apiLogin(user, pass);
    if (res.success && res.data) {
      localStorage.setItem('iot_token', res.data.token);
      localStorage.setItem('iot_user', JSON.stringify(res.data));
      showToast('Đăng nhập thành công! Đang chuyển hướng...', 'success');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 600);
    } else {
      showToast(res.message || 'Tên đăng nhập hoặc mật khẩu không chính xác', 'error');
    }
  } catch (error) {
    showToast('Không thể kết nối đến máy chủ Backend Node.js!', 'error');
  }
}

// --- 3. Logic Màn hình Dashboard (dashboard.html) ---
// Hàm đồng bộ trạng thái Bật/Tắt và màu sắc icon của từng thiết bị lên giao diện
function applyDeviceStateToUI(deviceId, state) {
  const isOn = (state === 'ON');
  let chk = null;
  let txt = null;

  if (deviceId === 1) {
    chk = document.getElementById('deviceFan');
    txt = document.getElementById('fanStatusText');
  } else if (deviceId === 2) {
    chk = document.getElementById('deviceLight');
    txt = document.getElementById('lightStatusText');
  } else if (deviceId === 3) {
    chk = document.getElementById('deviceAC');
    txt = document.getElementById('acStatusText');
  }

  if (chk) {
    chk.checked = isOn;
    // Bật/tắt trạng thái đen-trắng (.device-off) cho icon thiết bị
    const deviceRow = chk.closest('.device-item-row');
    if (deviceRow) deviceRow.classList.toggle('device-off', !isOn);
  }
  if (txt) {
    txt.innerText = isOn ? 'Đang bật' : 'Đã tắt';
    txt.className = isOn ? 'device-status-text status-active' : 'device-status-text status-inactive';
  }
}

// Khởi tạo biểu đồ cảm biến cố định 10 mốc thời gian
async function initSensorChart() {
  const chartCanvas = document.getElementById('sensorChart');
  if (!chartCanvas) return;

  let labels = [];
  let tempData = [];
  let humData = [];
  let lightData = [];

  try {
    const res = await apiGetChartData('1h');
    if (res.success && Array.isArray(res.data)) {
      res.data.forEach(item => {
        labels.push(item.time);
        tempData.push(item.temperature);
        humData.push(item.humidity);
        lightData.push(+(item.light / 10).toFixed(0));
      });
    }
  } catch (err) {
    console.warn('Lỗi tải dữ liệu biểu đồ:', err.message);
  }

  // Nếu dữ liệu trả về nhiều hơn 10 mốc thì chỉ giữ lại 10 mốc mới nhất
  while (labels.length > MAX_CHART_POINTS) {
    labels.shift();
    tempData.shift();
    humData.shift();
    lightData.shift();
  }

  // Đảm bảo ban đầu luôn có đủ 10 mốc cố định trải đều khung biểu đồ (không bị co lại)
  while (labels.length < MAX_CHART_POINTS) {
    labels.unshift('--:--:--');
    tempData.unshift(null);
    humData.unshift(null);
    lightData.unshift(null);
  }

  const ctx = chartCanvas.getContext('2d');
  myChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Nhiệt độ (°C)',
          data: tempData,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.05)',
          borderWidth: 2.2,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#ef4444',
          spanGaps: true,
          fill: false
        },
        {
          label: 'Độ ẩm (%)',
          data: humData,
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.05)',
          borderWidth: 2.2,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#06b6d4',
          spanGaps: true,
          fill: false
        },
        {
          label: 'Độ sáng (lx/10)',
          data: lightData,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.05)',
          borderWidth: 2.4,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#f59e0b',
          spanGaps: true,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false }, // Hover 1 điểm hiện cả 3 giá trị
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#ffffff',
          titleColor: '#0f172a',
          bodyColor: '#334155',
          borderColor: '#cbd5e1',
          borderWidth: 1,
          padding: 12,
          boxPadding: 4,
          usePointStyle: true,
          callbacks: {
            label: function (context) {
              if (context.parsed.y === null) return '';
              let label = context.dataset.label || '';
              if (label.includes('Nhiệt độ')) return ` temp : ${context.parsed.y} °C`;
              if (label.includes('Độ ẩm')) return ` hum : ${context.parsed.y} %`;
              if (label.includes('Độ sáng')) return ` light : ${context.parsed.y * 10} lx`;
              return `${label}: ${context.parsed.y}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#f1f5f9', drawBorder: false },
          ticks: { color: '#64748b', font: { size: 11 } }
        },
        y: {
          min: 0,
          max: 100, // Chuẩn hóa thang đo về 0-100 cho toàn bộ 3 cảm biến
          grid: { color: '#f1f5f9', drawBorder: false },
          ticks: { stepSize: 20, color: '#64748b', font: { size: 11 } }
        }
      }
    }
  });
}

// Xử lý khi user gạt công tắc thiết bị
async function handleDeviceToggle(deviceId, deviceName, toggleElem) {
  const isChecked = toggleElem.checked;
  const command = isChecked ? 'ON' : 'OFF';

  // Bật/tắt trạng thái đen-trắng cho icon thiết bị
  const deviceRow = toggleElem.closest('.device-item-row');
  if (deviceRow) deviceRow.classList.toggle('device-off', !isChecked);

  toggleElem.disabled = true;

  try {
    const res = await apiControlDevice(deviceId, command);
    if (res.success) {
      applyDeviceStateToUI(deviceId, command);
      const timeElem = document.getElementById('lastUpdatedDeviceTime');
      if (timeElem) timeElem.innerText = getLocalDateTimeStr();
      // Đã xóa showToast() thông báo thành công khi gạt công tắc
    } else {
      // Hoàn tác lại trạng thái công tắc và màu icon nếu thiết bị không phản hồi
      toggleElem.checked = !isChecked;
      applyDeviceStateToUI(deviceId, !isChecked ? 'ON' : 'OFF');
      showToast(res.message || 'Thiết bị không phản hồi, vui lòng kiểm tra phần cứng', 'error');
    }
  } catch (err) {
    // Hoàn tác lại trạng thái công tắc và màu icon nếu lỗi kết nối
    toggleElem.checked = !isChecked;
    applyDeviceStateToUI(deviceId, !isChecked ? 'ON' : 'OFF');
    showToast('Lỗi kết nối tới máy chủ khi điều khiển thiết bị', 'error');
  } finally {
    toggleElem.disabled = false;
  }
}

// Đồng bộ trạng thái mới nhất của thiết bị từ CSDL (khi bấm nút "Cập nhật" hoặc mới tải trang)
async function refreshDeviceState(showNotification = true) {
  const icon = document.getElementById('refreshIcon');
  if (icon) icon.classList.add('spin-anim');

  try {
    const res = await apiGetDevices();
    if (res.success && Array.isArray(res.data)) {
      res.data.forEach(dev => {
        applyDeviceStateToUI(dev.device_id, dev.actual_state);
      });
      const timeElem = document.getElementById('lastUpdatedDeviceTime');
      if (timeElem) timeElem.innerText = getLocalDateTimeStr();
      // Đã xóa showToast('Đã đồng bộ trạng thái thực tế từ thiết bị', 'info')
    }
  } catch (e) {
    if (showNotification) showToast('Không thể đồng bộ trạng thái thiết bị', 'error');
  } finally {
    if (icon) icon.classList.remove('spin-anim');
  }
}

// Luồng nhận dữ liệu cảm biến thời gian thực qua WebSocket
function startRealtimeStream() {
  initRealtimeWebSocket((streamData) => {
    // 1. Cập nhật số liệu tức thời và thanh progress bar trên 3 Card
    const elemTemp = document.getElementById('valTemperature');
    const elemHum = document.getElementById('valHumidity');
    const elemLight = document.getElementById('valLight');
    if (elemTemp) elemTemp.innerText = `${streamData.temperature}°C`;
    if (elemHum) elemHum.innerText = `${streamData.humidity}%`;
    if (elemLight) elemLight.innerText = `${streamData.light} lx`;

    const barT = document.getElementById('barTemperature');
    const barH = document.getElementById('barHumidity');
    const barL = document.getElementById('barLight');
    if (barT) barT.style.width = `${Math.min(100, (streamData.temperature / 50) * 100)}%`;
    if (barH) barH.style.width = `${Math.min(100, streamData.humidity)}%`;
    if (barL) barL.style.width = `${Math.min(100, (streamData.light / 1000) * 100)}%`;

    // 2. Sliding Window: Đẩy điểm mới sang phải, loại bỏ điểm cũ bên trái để giữ cố định 10 mốc
    if (myChartInstance) {
      const nowTime = new Date().toLocaleTimeString('vi-VN');

      myChartInstance.data.labels.push(nowTime);
      myChartInstance.data.datasets[0].data.push(streamData.temperature);
      myChartInstance.data.datasets[1].data.push(streamData.humidity);
      myChartInstance.data.datasets[2].data.push(+(streamData.light / 10).toFixed(0));

      // Duy trì chính xác đúng 10 mốc thời gian trên trục hoành
      while (myChartInstance.data.labels.length > MAX_CHART_POINTS) {
        myChartInstance.data.labels.shift();
        myChartInstance.data.datasets.forEach(ds => ds.data.shift());
      }

      myChartInstance.update();
    }
  });
}

// --- 4. Logic Dữ liệu cảm biến (sensor-data.html) ---
// Chỉ bắt đầu lọc khi người dùng nhấn nút Tìm kiếm hình kính lúp (hoặc nhấn Enter)
function handleSensorSearch() {
  appliedSensorFilter = document.getElementById('sensorFilterMain')?.value || 'ALL';
  appliedSensorSearch = document.getElementById('sensorDynamicInput')?.value?.trim() || '';
  currentSensorPage = 1;
  renderSensorDataTable();
}

function changeSensorPageSize() {
  sensorPageSize = parseInt(document.getElementById('sensorPageSize').value, 10);
  currentSensorPage = 1;
  renderSensorDataTable();
}

function goToSensorPage(p) {
  currentSensorPage = p;
  renderSensorDataTable();
}

async function renderSensorDataTable() {
  const tbody = document.getElementById('sensorTableBody');
  if (!tbody) return;

  try {
    const res = await apiGetSensorHistory(currentSensorPage, sensorPageSize, appliedSensorFilter, appliedSensorSearch);
    if (res.success) {
      const { data, pagination } = res;
      document.getElementById('sensorTotalRecords').innerText = pagination.total_records;

      if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="padding: 32px; text-align: center; color: #64748b;">Không tìm thấy bản ghi dữ liệu cảm biến nào phù hợp.</td></tr>`;
        renderSensorPagination(1);
        return;
      }

      tbody.innerHTML = data.map(row => `
        <tr>
          <td class="td-id">${row.id}</td>
          <td style="color: #334155; font-weight: 500;">${row.name}</td>
          <td class="td-val-highlight">${row.value}</td>
          <td class="td-time">
            <div class="time-cell-content">
              <span>${row.time}</span>
              <button type="button" class="btn-copy-time" onclick="copyTimeToClipboard('${row.time}', this)" title="Sao chép thời gian">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

      renderSensorPagination(pagination.total_pages || 1);
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="padding: 32px; text-align: center; color: #dc2626;">Lỗi tải dữ liệu từ máy chủ.</td></tr>`;
  }
}

function renderSensorPagination(totalPages) {
  const container = document.getElementById('sensorPaginationButtons');
  if (!container) return;

  let html = '';
  if (currentSensorPage > 1) {
    html += `<button class="page-btn" onclick="goToSensorPage(${currentSensorPage - 1})">← Trước</button>`;
  } else {
    html += `<button class="page-btn" style="opacity: 0.45; cursor: not-allowed;" disabled>← Trước</button>`;
  }

  if (totalPages <= 6) {
    for (let p = 1; p <= totalPages; p++) {
      html += `<button class="page-btn ${p === currentSensorPage ? 'active' : ''}" onclick="goToSensorPage(${p})">${p}</button>`;
    }
  } else {
    if (currentSensorPage <= 3) {
      for (let p = 1; p <= 3; p++) {
        html += `<button class="page-btn ${p === currentSensorPage ? 'active' : ''}" onclick="goToSensorPage(${p})">${p}</button>`;
      }
      html += `<span style="padding: 0 4px; color: #94a3b8;">...</span>`;
      html += `<button class="page-btn" onclick="goToSensorPage(${totalPages})">${totalPages}</button>`;
    } else if (currentSensorPage >= totalPages - 2) {
      html += `<button class="page-btn" onclick="goToSensorPage(1)">1</button>`;
      html += `<span style="padding: 0 4px; color: #94a3b8;">...</span>`;
      for (let p = totalPages - 2; p <= totalPages; p++) {
        html += `<button class="page-btn ${p === currentSensorPage ? 'active' : ''}" onclick="goToSensorPage(${p})">${p}</button>`;
      }
    } else {
      html += `<button class="page-btn" onclick="goToSensorPage(1)">1</button>`;
      html += `<span style="padding: 0 4px; color: #94a3b8;">...</span>`;
      html += `<button class="page-btn active" onclick="goToSensorPage(${currentSensorPage})">${currentSensorPage}</button>`;
      html += `<button class="page-btn" onclick="goToSensorPage(${currentSensorPage + 1})">${currentSensorPage + 1}</button>`;
      html += `<span style="padding: 0 4px; color: #94a3b8;">...</span>`;
      html += `<button class="page-btn" onclick="goToSensorPage(${totalPages})">${totalPages}</button>`;
    }
  }

  if (currentSensorPage < totalPages) {
    html += `<button class="page-btn" onclick="goToSensorPage(${currentSensorPage + 1})">Sau →</button>`;
  } else {
    html += `<button class="page-btn" style="opacity: 0.45; cursor: not-allowed;" disabled>Sau →</button>`;
  }

  container.innerHTML = html;
}

// --- 5. Logic Lịch sử hoạt động (history.html) ---
// Chỉ bắt đầu lọc khi người dùng nhấn nút Tìm kiếm hình kính lúp (hoặc nhấn Enter)
function handleHistorySearch() {
  appliedHistoryDevice = document.getElementById('historyFilterDevice')?.value || 'ALL';
  appliedHistoryAction = document.getElementById('historyFilterAction')?.value || 'ALL';
  appliedHistoryStatus = document.getElementById('historyFilterStatus')?.value || 'ALL';
  appliedHistoryTime = document.getElementById('historySearchTime')?.value?.trim() || '';
  currentHistoryPage = 1;
  renderHistoryTable();
}

function changeHistoryPageSize() {
  historyPageSize = parseInt(document.getElementById('historyPageSize').value, 10);
  currentHistoryPage = 1;
  renderHistoryTable();
}

function goToHistoryPage(p) {
  currentHistoryPage = p;
  renderHistoryTable();
}

async function renderHistoryTable() {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

  try {
    const res = await apiGetActionHistory(
      currentHistoryPage,
      historyPageSize,
      appliedHistoryDevice,
      appliedHistoryAction,
      appliedHistoryStatus,
      appliedHistoryTime
    );
    if (res.success) {
      const { data, pagination } = res;
      document.getElementById('historyTotalRecords').innerText = pagination.total_records;

      if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="padding: 32px; text-align: center; color: #64748b;">Không có lịch sử hoạt động nào khớp với bộ lọc.</td></tr>`;
        renderHistoryPagination(1);
        return;
      }

      tbody.innerHTML = data.map(row => {
        let iconSvg = '';
        if (row.device === 'Quạt') {
          iconSvg = `<div style="width: 28px; height: 28px; border-radius: 8px; background: #eff6ff; border: 1px solid #dbeafe; display: flex; align-items: center; justify-content: center;"><svg style="width: 18px; height: 18px; color: #1746c9;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.827 16.379a6.082 6.082 0 0 1-8.618-7.002l5.412 1.45a6.082 6.082 0 0 1 7.002-8.618l-1.45 5.412a6.082 6.082 0 0 1 8.618 7.002l-5.412-1.45a6.082 6.082 0 0 1-7.002 8.618l1.45-5.412Z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 12v.01" /></svg></div>`;
        } else if (row.device === 'Đèn') {
          iconSvg = `<div style="width: 28px; height: 28px; border-radius: 8px; background: #fffbeb; border: 1px solid #fef3c7; display: flex; align-items: center; justify-content: center;"><svg style="width: 16px; height: 16px; color: #d97706;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg></div>`;
        } else {
          iconSvg = `<div style="width: 28px; height: 28px; border-radius: 8px; background: #f0f9ff; border: 1px solid #e0f2fe; display: flex; align-items: center; justify-content: center;"><svg style="width: 16px; height: 16px; color: #0284c7;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2zm3 4h12M6 15h6" /></svg></div>`;
        }

        const actionBadge = row.action === 'Bật'
          ? `<span class="badge-action badge-action-on">Bật</span>`
          : `<span class="badge-action badge-action-off">Tắt</span>`;

        // 3 trạng thái: Thành công (xanh lá), Đang chờ (vàng), Thất bại (đỏ)
        let statusBadge = '';
        if (row.status === 'Thành công') {
          statusBadge = `<span class="badge-status badge-status-success"><span class="status-dot"></span> Thành công</span>`;
        } else if (row.status === 'Đang chờ' || row.status === 'PENDING') {
          statusBadge = `<span class="badge-status badge-status-pending"><span class="status-dot"></span> Đang chờ</span>`;
        } else {
          statusBadge = `<span class="badge-status badge-status-failed"><span class="status-dot"></span> Thất bại</span>`;
        }

        return `
          <tr>
            <td class="td-id">${row.id}</td>
            <td style="color: #0f172a;">
              <div style="display: flex; align-items: center; gap: 10px;">
                ${iconSvg}
                <span style="font-weight: 500;">${row.device}</span>
              </div>
            </td>
            <td>${actionBadge}</td>
            <td>${statusBadge}</td>
            <td style="color: #1746c9; font-family: monospace; font-weight: 700;">${row.user}</td>
            <td class="td-time">
              <div class="time-cell-content">
                <span>${row.time}</span>
                <button type="button" class="btn-copy-time" onclick="copyTimeToClipboard('${row.time}', this)" title="Sao chép thời gian">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      renderHistoryPagination(pagination.total_pages || 1);
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding: 32px; text-align: center; color: #dc2626;">Lỗi tải lịch sử thao tác từ máy chủ.</td></tr>`;
  }
}

function renderHistoryPagination(totalPages) {
  const container = document.getElementById('historyPaginationButtons');
  if (!container) return;

  let html = '';
  if (currentHistoryPage > 1) {
    html += `<button class="page-btn" onclick="goToHistoryPage(${currentHistoryPage - 1})">← Trước</button>`;
  } else {
    html += `<button class="page-btn" style="opacity: 0.45; cursor: not-allowed;" disabled>← Trước</button>`;
  }

  if (totalPages <= 6) {
    for (let p = 1; p <= totalPages; p++) {
      html += `<button class="page-btn ${p === currentHistoryPage ? 'active' : ''}" onclick="goToHistoryPage(${p})">${p}</button>`;
    }
  } else {
    if (currentHistoryPage <= 3) {
      for (let p = 1; p <= 3; p++) {
        html += `<button class="page-btn ${p === currentHistoryPage ? 'active' : ''}" onclick="goToHistoryPage(${p})">${p}</button>`;
      }
      html += `<span style="padding: 0 4px; color: #94a3b8;">...</span>`;
      html += `<button class="page-btn" onclick="goToHistoryPage(${totalPages})">${totalPages}</button>`;
    } else if (currentHistoryPage >= totalPages - 2) {
      html += `<button class="page-btn" onclick="goToHistoryPage(1)">1</button>`;
      html += `<span style="padding: 0 4px; color: #94a3b8;">...</span>`;
      for (let p = totalPages - 2; p <= totalPages; p++) {
        html += `<button class="page-btn ${p === currentHistoryPage ? 'active' : ''}" onclick="goToHistoryPage(${p})">${p}</button>`;
      }
    } else {
      html += `<button class="page-btn" onclick="goToHistoryPage(1)">1</button>`;
      html += `<span style="padding: 0 4px; color: #94a3b8;">...</span>`;
      html += `<button class="page-btn active" onclick="goToHistoryPage(${currentHistoryPage})">${currentHistoryPage}</button>`;
      html += `<button class="page-btn" onclick="goToHistoryPage(${currentHistoryPage + 1})">${currentHistoryPage + 1}</button>`;
      html += `<span style="padding: 0 4px; color: #94a3b8;">...</span>`;
      html += `<button class="page-btn" onclick="goToHistoryPage(${totalPages})">${totalPages}</button>`;
    }
  }

  if (currentHistoryPage < totalPages) {
    html += `<button class="page-btn" onclick="goToHistoryPage(${currentHistoryPage + 1})">Sau →</button>`;
  } else {
    html += `<button class="page-btn" style="opacity: 0.45; cursor: not-allowed;" disabled>Sau →</button>`;
  }

  container.innerHTML = html;
}

// --- 6. Xử lý Đăng xuất và Bảo vệ phiên làm việc ---
function setupAuthAndLogout() {
  const logoutButtons = document.querySelectorAll('.logout-link');
  logoutButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('iot_token');
      localStorage.removeItem('iot_user');
      showToast('Đã đăng xuất tài khoản', 'info');
      setTimeout(() => { window.location.href = 'index.html'; }, 400);
    });
  });
}

// --- 7. Tự động nhận diện trang và khởi chạy (App Bootstrap) ---
window.addEventListener('DOMContentLoaded', async () => {
  setupAuthAndLogout();

  const isLoginPage = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/');
  const token = localStorage.getItem('iot_token');
  if (!isLoginPage && !token) {
    window.location.href = 'index.html';
    return;
  }

  // Nếu là Dashboard
  if (document.getElementById('sensorChart')) {
    await initSensorChart();
    await refreshDeviceState(false);
    startRealtimeStream();
  }

  // Nếu là Sensor Data
  if (document.getElementById('sensorTableBody')) {
    renderSensorDataTable();
  }

  // Nếu là History
  if (document.getElementById('historyTableBody')) {
    renderHistoryTable();
  }
});