document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in as student
    if (sessionStorage.getItem('isLoggedIn') !== 'true' || 
        sessionStorage.getItem('userType') !== 'student') {
        window.location.href = 'login.html';
        return;
    }

    // Display student information
    const studentId = sessionStorage.getItem('studentId');
    document.getElementById('studentId').textContent = studentId;

    // Sample ticket history data
    const ticketHistory = [
        {
            bookingDate: '2024-02-15',
            visitDate: '2024-02-20',
            timeSlot: '10:00 AM',
            status: 'Completed',
            ticketId: 'TKT001'
        },
        {
            bookingDate: '2024-03-01',
            visitDate: '2024-03-05',
            timeSlot: '2:00 PM',
            status: 'Upcoming',
            ticketId: 'TKT002'
        }
    ];

    // Render ticket history
    const ticketHistoryBody = document.getElementById('ticketHistoryBody');
    const noTickets = document.getElementById('noTickets');

    if (ticketHistory.length > 0) {
        ticketHistoryBody.innerHTML = ticketHistory.map(ticket => `
            <tr>
                <td>${formatDate(ticket.bookingDate)}</td>
                <td>${formatDate(ticket.visitDate)}</td>
                <td>${ticket.timeSlot}</td>
                <td>${ticket.status}</td>
                <td>
                    <button class="qr-btn" data-ticket="${ticket.ticketId}">
                        <img src="../assets/images/qr-icon.png" alt="QR" width="20">
                    </button>
                </td>
            </tr>
        `).join('');
        noTickets.style.display = 'none';
    } else {
        ticketHistoryBody.innerHTML = '';
        noTickets.style.display = 'block';
    }

    // Handle logout
    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn.addEventListener('click', () => {
        sessionStorage.clear();
        window.location.href = 'login.html';
    });

    function formatDate(dateString) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-US', options);
    }

    // QR Modal functionality
    const modal = document.getElementById('qrModal');
    const qrCode = document.getElementById('qrCode');
    const closeBtn = document.querySelector('.close-modal');

    document.addEventListener('click', (e) => {
        if (e.target.closest('.qr-btn')) {
            const ticketId = e.target.closest('.qr-btn').dataset.ticket;
            // In a real app, generate QR code using a library
            qrCode.innerHTML = `
                <img src="https://api.qrserver.com/v1/create-qr-code/?data=${ticketId}&size=200x200" 
                     alt="Ticket QR Code">
            `;
            modal.style.display = 'block';
        }
    });

    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (e) => {
        if (e.target === modal) modal.style.display = 'none';
    };
}); 