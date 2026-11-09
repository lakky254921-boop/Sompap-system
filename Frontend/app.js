// กำหนด URL ของ Backend API (ใช้ Relative Path รองรับทั้ง Local และ Kubernetes)
const API_URL = '/api/tickets';

// โหลดรายการคำร้องทันทีเมื่อเปิดหน้าเว็บ
document.addEventListener('DOMContentLoaded', () => {
    loadTickets();
});

// Action 1: ส่งข้อมูลฟอร์มสร้าง Ticket ใหม่ (POST)
document.getElementById('ticketForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const newTicket = {
        title: document.getElementById('title').value,
        category: document.getElementById('category').value,
        description: document.getElementById('description').value,
        priority: document.getElementById('priority')?.value || 'Medium'
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTicket)
        });

        if (response.ok) {
            document.getElementById('ticketForm').reset();
            loadTickets(); // รีเฟรชตารางหลังส่งข้อมูลสำเร็จ
        } else {
            alert('ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
        }
    } catch (error) {
        console.error('Error creating ticket:', error);
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อกับ Server');
    }
});

// Action 2: ดึงรายการคำร้องทั้งหมดมาแสดงในตาราง (GET)
async function loadTickets() {
    const tableBody = document.getElementById('ticketTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">กำลังโหลดข้อมูล...</td></tr>`;

    try {
        const response = await fetch(API_URL);
        const tickets = await response.json();

        if (!Array.isArray(tickets) || tickets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">ยังไม่มีรายการแจ้งซ่อม</td></tr>`;
            return;
        }

        tableBody.innerHTML = tickets.map(ticket => `
            <tr>
                <td>#${ticket.id}</td>
                <td>
                    <strong>${escapeHtml(ticket.title || '')}</strong><br>
                    <small style="color: #666;">${escapeHtml(ticket.description || '-')}</small>
                </td>
                <td>${escapeHtml(ticket.category || '')}</td>
                <td>${escapeHtml(ticket.priority || 'Medium')}</td>
                <td>
                    <span style="padding: 3px 8px; border-radius: 4px; font-size: 0.9em; background-color: ${getStatusColor(ticket.status)};">
                        ${escapeHtml(ticket.status || 'Pending')}
                    </span>
                </td>
                <td>
                    <!-- Action 3: อัปเดตสถานะสำหรับ IT Support (PATCH) -->
                    <select onchange="updateTicketStatus(${ticket.id}, this.value)">
                        <option value="" disabled>เปลี่ยนสถานะ...</option>
                        <option value="Pending" ${ticket.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="In Progress" ${ticket.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                        <option value="Resolved" ${ticket.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                    </select>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading tickets:', error);
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">เชื่อมต่อ Server ไม่สำเร็จ</td></tr>`;
    }
}

// Action 3: อัปเดตสถานะคำร้อง (PATCH)
async function updateTicketStatus(id, newStatus) {
    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            loadTickets(); // โหลดข้อมูลใหม่เพื่อแสดงสถานะล่าสุด
        } else {
            alert('อัปเดตสถานะไม่สำเร็จ');
        }
    } catch (error) {
        console.error('Error updating status:', error);
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
}

// ฟังก์ชันช่วยกำหนดสีสถานะ
function getStatusColor(status) {
    if (!status) return '#e2e3e5';
    const s = status.toString().trim();
    if (s === 'Resolved') return '#d4edda'; // เขียวอ่อน
    if (s === 'In Progress') return '#cce5ff'; // ฟ้าอ่อน
    return '#e2e3e5'; // เทา (Pending)
}

// ฟังก์ชันป้องกัน XSS
function escapeHtml(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}