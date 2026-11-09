const API_URL = 'http://localhost:3000/api/tickets';

document.addEventListener('DOMContentLoaded', () => {
  fetchTickets();

  const ticketForm = document.getElementById('ticketForm');
  ticketForm.addEventListener('submit', handleCreateTicket);
});

// Action 2: Fetch รายการ Ticket ทั้งหมดมาแสดงในตาราง
async function fetchTickets() {
  try {
    const response = await fetch(API_URL);
    const tickets = await response.json();
    renderTable(tickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
  }
}

// Render โครงสร้างตาราง HTML
function renderTable(tickets) {
  const tableBody = document.getElementById('ticketTableBody');
  tableBody.innerHTML = '';

  if (tickets.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">ยังไม่มีรายการแจ้งซ่อม</td></tr>';
    return;
  }

  tickets.forEach(ticket => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${ticket.id}</td>
      <td><strong>${escapeHtml(ticket.title)}</strong><br><small>${escapeHtml(ticket.description || '-')}</small></td>
      <td><span class="badge category">${ticket.category}</span></td>
      <td><span class="badge priority-${ticket.priority ? ticket.priority.toLowerCase() : 'medium'}">${ticket.priority}</span></td>
      <td><span class="badge status-${ticket.status ? ticket.status.toLowerCase().replace(/\s+/g, '-') : 'pending'}">${ticket.status}</span></td>
      <td>
        <select onchange="handleUpdateStatus(${ticket.id}, this.value)">
          <option value="Pending" ${ticket.status === 'Pending' ? 'selected' : ''}>Pending</option>
          <option value="In Progress" ${ticket.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
          <option value="Resolved" ${ticket.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
        </select>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

// Action 1: ยิง POST เพื่อสร้าง Ticket ใหม่
async function handleCreateTicket(event) {
  event.preventDefault();

  const payload = {
    title: document.getElementById('title').value,
    category: document.getElementById('category').value,
    priority: document.getElementById('priority').value,
    description: document.getElementById('description').value
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      document.getElementById('ticketForm').reset();
      fetchTickets(); // รีโหลดตารางใหม่
    } else {
      alert('เกิดข้อผิดพลาดในการส่งข้อมูล');
    }
  } catch (error) {
    console.error('Error creating ticket:', error);
    alert('ไม่สามารถเชื่อมต่อกับ Backend Server ได้');
  }
}

// Action 3: ยิง PATCH เพื่ออัปเดตสถานะ Ticket
async function handleUpdateStatus(id, newStatus) {
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    if (response.ok) {
      fetchTickets(); // รีโหลดตารางเพื่ออัปเดต Badge สีสถานะ
    } else {
      alert('อัปเดตสถานะไม่สำเร็จ');
    }
  } catch (error) {
    console.error('Error updating status:', error);
  }
}

// Utility ป้องกัน XSS
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}