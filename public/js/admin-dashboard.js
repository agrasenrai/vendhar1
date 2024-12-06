document.addEventListener('DOMContentLoaded', () => {
    // Check admin authentication
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
        window.location.href = 'login.html';
        return;
    }

    // Navigation
    const navItems = document.querySelectorAll('.admin-nav li[data-section]');
    const sections = document.querySelectorAll('main section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const sectionId = item.dataset.section;
            
            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Show selected section
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === sectionId) {
                    section.classList.add('active');
                    loadSectionData(sectionId);
                }
            });
        });
    });

    // Logout handler
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('adminToken');
        window.location.href = 'login.html';
    });

    // Load dashboard data
    async function loadDashboardStats() {
        try {
            const response = await fetch('http://localhost:3000/admin/stats', {
                headers: {
                    'Authorization': `Bearer ${adminToken}`
                }
            });
            const data = await response.json();

            // Update stats
            document.getElementById('todayBookings').textContent = data.todayBookings;
            document.getElementById('totalRevenue').textContent = `₹${data.totalRevenue}`;
            document.getElementById('activeBookings').textContent = data.activeBookings;
            document.getElementById('availableSlots').textContent = data.availableSlots;

            // Create visitor trends chart
            const visitorTrendsCtx = document.getElementById('visitorTrends').getContext('2d');
            new Chart(visitorTrendsCtx, {
                type: 'line',
                data: {
                    labels: data.trends.dates,
                    datasets: [{
                        label: 'Visitors',
                        data: data.trends.visitors,
                        borderColor: '#3498db',
                        tension: 0.1
                    }]
                }
            });

            // Create peak hours chart
            const peakHoursCtx = document.getElementById('peakHours').getContext('2d');
            new Chart(peakHoursCtx, {
                type: 'bar',
                data: {
                    labels: data.peakHours.times,
                    datasets: [{
                        label: 'Visitors per Hour',
                        data: data.peakHours.visitors,
                        backgroundColor: '#2ecc71'
                    }]
                }
            });
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
        }
    }

    // Update the loadBookings function
    async function loadBookings() {
        try {
            // Get filter values (but don't use them initially)
            const searchTerm = document.getElementById('searchBookings').value;
            const status = document.getElementById('filterStatus').value;
            const dateFrom = document.getElementById('filterDateFrom').value;
            const dateTo = document.getElementById('filterDateTo').value;
            const timeSlot = document.getElementById('filterTimeSlot').value;
            const sortBy = document.getElementById('sortBookings').value;

            // Only add parameters to query if they are actually set
            const params = new URLSearchParams();
            if (searchTerm) params.append('search', searchTerm);
            if (status) params.append('status', status);
            if (dateFrom) params.append('dateFrom', dateFrom);
            if (dateTo) params.append('dateTo', dateTo);
            if (timeSlot) params.append('timeSlot', timeSlot);
            if (sortBy) params.append('sortBy', sortBy);

            const queryString = params.toString();
            const url = `http://localhost:3000/admin/bookings${queryString ? `?${queryString}` : ''}`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch bookings');
            }

            const bookings = await response.json();
            console.log('Loaded bookings:', bookings);

            // Display the bookings
            const tbody = document.getElementById('bookingsTableBody');
            tbody.innerHTML = '';

            bookings.forEach(booking => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${booking.id}</td>
                    <td>${booking.username}</td>
                    <td>${booking.email}</td>
                    <td>${booking.phone}</td>
                    <td>${new Date(booking.visit_date).toLocaleDateString()}</td>
                    <td>${booking.time_slot}</td>
                    <td>${booking.num_tickets}</td>
                    <td>₹${booking.amount || 0}</td>
                    <td><span class="status-badge ${booking.status}">${booking.status}</span></td>
                    <td>
                        <button onclick="viewBookingDetails(${booking.id})" class="action-btn">
                            View
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            // Add export functionality
            document.getElementById('exportBookings').onclick = () => {
                exportToExcel(bookings);
            };

        } catch (error) {
            console.error('Error loading bookings:', error);
            alert('Failed to load bookings');
        }
    }

    // Add export function
    function exportToExcel(bookings) {
        const headers = ['Booking ID', 'User', 'Email', 'Phone', 'Date', 'Time', 'Tickets', 'Amount', 'Status'];
        const data = bookings.map(booking => [
            booking.id,
            booking.username,
            booking.email,
            booking.phone,
            new Date(booking.visit_date).toLocaleDateString(),
            booking.time_slot,
            booking.num_tickets,
            `₹${booking.amount || 0}`,
            booking.status
        ]);

        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Bookings');
        XLSX.writeFile(wb, `bookings_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    // Add event listeners for real-time search
    document.getElementById('searchBookings')?.addEventListener('input', debounce(loadBookings, 500));

    // Debounce function to prevent too many API calls
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // System control handlers
    document.getElementById('bookingSystemToggle')?.addEventListener('change', async (e) => {
        try {
            const response = await fetch('http://localhost:3000/admin/system/toggle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({
                    enabled: e.target.checked
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update booking system status');
            }

            console.log('Booking system status updated:', e.target.checked);
        } catch (error) {
            console.error('Error toggling booking system:', error);
            // Revert toggle if failed
            e.target.checked = !e.target.checked;
            alert('Failed to update booking system status');
        }
    });

    // Time slot management
    document.getElementById('addSlotBtn').addEventListener('click', async () => {
        const time = prompt('Enter time slot (HH:MM format):');
        if (time) {
            try {
                await fetch('http://localhost:3000/admin/slots', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${adminToken}`
                    },
                    body: JSON.stringify({ time })
                });
                loadTimeSlots();
            } catch (error) {
                console.error('Error adding time slot:', error);
            }
        }
    });

    // Search functionality
    document.getElementById('searchBtn')?.addEventListener('click', () => {
        const searchTerm = document.getElementById('searchBookings').value;
        const status = document.getElementById('filterStatus').value;
        const date = document.getElementById('filterDate').value;
        const timeSlot = document.getElementById('filterTimeSlot').value;
        loadBookings(searchTerm, status, date, timeSlot);
    });

    document.getElementById('resetFilters')?.addEventListener('click', () => {
        document.getElementById('searchBookings').value = '';
        document.getElementById('filterStatus').value = '';
        document.getElementById('filterDate').value = '';
        document.getElementById('filterTimeSlot').value = '';
        loadBookings();
    });

    // Load initial data
    loadDashboardStats();
    loadBookings();

    // Section data loader
    function loadSectionData(sectionId) {
        switch(sectionId) {
            case 'dashboard':
                loadDashboardStats();
                break;
            case 'tickets':
                loadBookings();
                break;
            case 'system':
                loadSystemSettings();
                loadTimeSlots();
                loadTicketPrices();
                break;
            case 'content':
                loadContent();
                break;
            case 'checker':
                initializeScanner();
                break;
            case 'news':
                loadNews();
                break;
            case 'adminBooking':
                initializeAdminBooking();
                break;
        }
    }

    // Load initial data for the active section
    const activeSection = document.querySelector('section.active');
    if (activeSection) {
        loadSectionData(activeSection.id);
    }

    // Load bookings immediately if we're on the tickets section
    if (document.querySelector('section#tickets').classList.contains('active')) {
        loadBookings();
    }

    // Load news if we're on the news section
    if (document.querySelector('section#news').classList.contains('active')) {
        loadNews();
    }

    // Add event listener for news form
    document.getElementById('addNewsItem')?.addEventListener('click', () => {
        const text = document.getElementById('newNewsItem').value;
        if (text) {
            addNews(text);
        }
    });
});

// Booking management functions
async function viewBooking(id) {
    // Implement booking details view
}

async function cancelBooking(id) {
    if (confirm('Are you sure you want to cancel this booking?')) {
        try {
            await fetch(`http://localhost:3000/admin/bookings/${id}/cancel`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });
            loadBookings();
        } catch (error) {
            console.error('Error cancelling booking:', error);
        }
    }
}

// QR Scanner functionality
let scanner = null;

async function initializeScanner() {
    const videoElem = document.getElementById('qrScanner');
    const startButton = document.getElementById('startScan');
    const captureButton = document.getElementById('captureFrame');
    const markCompletedBtn = document.getElementById('markCompleted');

    try {
        // Initialize scanner
        scanner = new Instascan.Scanner({
            video: videoElem,
            mirror: false,
            scanPeriod: 5 // Scan every 5 ms
        });

        // Get cameras
        const cameras = await Instascan.Camera.getCameras();
        
        if (cameras.length === 0) {
            alert('No cameras found');
            return;
        }

        // Try to use the back camera if available
        const backCamera = cameras.find(camera => camera.name.toLowerCase().includes('back'));
        const selectedCamera = backCamera || cameras[0];

        startButton.addEventListener('click', () => {
            if (startButton.textContent === 'Start Scanner') {
                scanner.start(selectedCamera);
                startButton.textContent = 'Stop Scanner';
                captureButton.disabled = false;
            } else {
                scanner.stop();
                startButton.textContent = 'Start Scanner';
                captureButton.disabled = true;
            }
        });

        // Handle successful scans
        scanner.addListener('scan', async result => {
            try {
                console.log('QR Code content:', result);
                let ticketData;
                
                try {
                    ticketData = JSON.parse(result);
                } catch (e) {
                    console.error('Failed to parse QR code:', e);
                    alert('Invalid QR code format');
                    return;
                }
                
                console.log('Parsed ticket data:', ticketData);
                
                // Check if we have a valid booking ID
                const bookingId = ticketData.bookingId;
                if (!bookingId) {
                    throw new Error('No booking ID found in QR code');
                }

                try {
                    const response = await fetch(`http://localhost:3000/admin/verify-ticket/${bookingId}`, {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                        }
                    });

                    if (!response.ok) {
                        throw new Error('Failed to verify ticket');
                    }

                    const ticketInfo = await response.json();
                    console.log('Ticket info:', ticketInfo);
                    
                    // Display the ticket info
                    displayTicketInfo(ticketInfo);
                    
                    // Stop scanner after successful scan
                    scanner.stop();
                    startButton.textContent = 'Start Scanner';

                    // Play success sound
                    try {
                        const audio = new Audio('../assets/success-beep.mp3');
                        audio.play();
                    } catch (soundError) {
                        console.error('Failed to play sound:', soundError);
                    }

                } catch (verifyError) {
                    console.error('Verification error:', verifyError);
                    alert('Failed to verify ticket: ' + verifyError.message);
                }

            } catch (error) {
                console.error('Error processing QR code:', error);
                alert('Invalid QR code or format: ' + error.message);
            }
        });

        captureButton.addEventListener('click', () => {
            const canvas = document.getElementById('capturedFrame');
            const context = canvas.getContext('2d');
            
            // Set canvas dimensions to match video
            canvas.width = videoElem.videoWidth;
            canvas.height = videoElem.videoHeight;
            
            // Draw the current video frame
            context.drawImage(videoElem, 0, 0, canvas.width, canvas.height);
            
            // Hide video and show canvas
            videoElem.style.display = 'none';
            canvas.style.display = 'block';
            
            // Stop the scanner
            scanner.stop();
            startButton.textContent = 'Start Scanner';
        });

        markCompletedBtn.addEventListener('click', async () => {
            const bookingId = document.getElementById('bookingId').textContent;
            if (bookingId === '-') {
                alert('Please scan a ticket first');
                return;
            }

            try {
                const response = await markTicketCompleted(bookingId);
                if (response.ok) {
                    const updatedTicket = await response.json();
                    displayTicketInfo(updatedTicket);
                    alert('Ticket marked as completed successfully');
                    
                    // Reset the scanner view
                    videoElem.style.display = 'block';
                    document.getElementById('capturedFrame').style.display = 'none';
                } else {
                    throw new Error('Failed to mark ticket as completed');
                }
            } catch (error) {
                console.error('Error:', error);
                alert(error.message);
            }
        });

    } catch (error) {
        console.error('Error initializing scanner:', error);
        alert('Failed to initialize scanner. Please make sure you have given camera permissions.');
    }
}

async function verifyTicket(bookingId) {
    try {
        const response = await fetch(`http://localhost:3000/admin/verify-ticket/${bookingId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        return await response.json();
    } catch (error) {
        console.error('Error verifying ticket:', error);
        throw error;
    }
}

function displayTicketInfo(ticket) {
    document.getElementById('bookingId').textContent = ticket.bookingId;
    document.getElementById('customerName').textContent = ticket.username;
    document.getElementById('visitDate').textContent = new Date(ticket.visit_date).toLocaleDateString();
    document.getElementById('timeSlot').textContent = ticket.time_slot;
    document.getElementById('adultTickets').textContent = ticket.adult_tickets;
    document.getElementById('childTickets').textContent = ticket.child_tickets;
    document.getElementById('seniorTickets').textContent = ticket.senior_tickets;
    document.getElementById('ticketStatus').textContent = ticket.status;

    // Get the mark completed button
    const markCompletedBtn = document.getElementById('markCompleted');

    // Only enable the button if the ticket status is 'pending'
    if (ticket.status === 'pending') {
        markCompletedBtn.disabled = false;
        markCompletedBtn.onclick = () => markTicketCompleted(ticket.bookingId);
    } else {
        markCompletedBtn.disabled = true;
        if (ticket.status === 'completed') {
            markCompletedBtn.textContent = 'Already Completed';
        } else if (ticket.status === 'cancelled' || ticket.status === 'cancelled by admin') {
            markCompletedBtn.textContent = 'Ticket Cancelled';
        }
    }

    // Add status-based styling
    const detailsCard = document.getElementById('ticketDetails');
    detailsCard.className = 'details-card ' + ticket.status;

    const statusSpan = document.getElementById('ticketStatus');
    statusSpan.className = ticket.status;
}

async function markTicketCompleted(bookingId) {
    try {
        const response = await fetch(`http://localhost:3000/admin/complete-ticket/${bookingId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to mark ticket as completed');
        }

        const updatedTicket = await response.json();
        displayTicketInfo(updatedTicket);
        alert('Ticket marked as completed successfully');
        
        // Reset the button text
        const markCompletedBtn = document.getElementById('markCompleted');
        markCompletedBtn.textContent = 'Already Completed';
        markCompletedBtn.disabled = true;
    } catch (error) {
        console.error('Error marking ticket as completed:', error);
        alert('Error updating ticket status');
    }
}

// Add some styling to make the video visible
const style = document.createElement('style');
style.textContent = `
    #qrScanner {
        width: 100%;
        max-width: 400px;
        height: 300px;
        border: 2px solid #ccc;
        border-radius: 8px;
        margin-bottom: 1rem;
    }
    
    .scanner-controls {
        display: flex;
        gap: 1rem;
        margin-bottom: 1rem;
    }
    
    .scan-btn {
        flex: 1;
    }
`;
document.head.appendChild(style); 

// Add these functions for news management
async function loadNews() {
    try {
        // Load news items
        const newsResponse = await fetch('http://localhost:3000/admin/news', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        const news = await newsResponse.json();
        displayNews(news);

        // Load ticker status
        const statusResponse = await fetch('http://localhost:3000/admin/news-ticker-status', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        const status = await statusResponse.json();
        document.getElementById('newsTickerToggle').checked = status.enabled;
    } catch (error) {
        console.error('Error loading news:', error);
    }
}

function displayNews(news) {
    const newsList = document.getElementById('newsItemsList');
    newsList.innerHTML = '';
    
    news.forEach(item => {
        const li = document.createElement('li');
        li.className = 'news-item';
        li.innerHTML = `
            <span>${item.text}</span>
            <button class="delete-news" onclick="deleteNews(${item.id})">
                <i class="fas fa-trash"></i>
            </button>
        `;
        newsList.appendChild(li);
    });
}

async function addNews(text) {
    try {
        const response = await fetch('http://localhost:3000/admin/news', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            },
            body: JSON.stringify({ text })
        });
        
        if (response.ok) {
            loadNews();
            document.getElementById('newNewsItem').value = '';
        }
    } catch (error) {
        console.error('Error adding news:', error);
    }
}

async function deleteNews(id) {
    if (confirm('Are you sure you want to delete this news item?')) {
        try {
            const response = await fetch(`http://localhost:3000/admin/news/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });
            
            if (response.ok) {
                loadNews();
            }
        } catch (error) {
            console.error('Error deleting news:', error);
        }
    }
}

// Add event listeners
document.getElementById('addNewsItem')?.addEventListener('click', () => {
    const text = document.getElementById('newNewsItem').value;
    if (text) {
        addNews(text);
    }
}); 

// Add these functions for time slot management
async function loadTimeSlots() {
    try {
        const response = await fetch('http://localhost:3000/admin/slots', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        const slots = await response.json();
        displayTimeSlots(slots);
    } catch (error) {
        console.error('Error loading time slots:', error);
    }
}

function displayTimeSlots(slots) {
    const tbody = document.getElementById('timeSlotsTableBody');
    tbody.innerHTML = '';

    slots.forEach(slot => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="slot-time">${formatTime(slot.slot_time)}</td>
            <td class="slot-capacity">${slot.max_capacity}</td>
            <td class="slot-actions">
                <button class="edit-slot" onclick="editSlot(${slot.id}, this)">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-slot" onclick="deleteSlot(${slot.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function formatTime(timeString) {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

async function addSlot() {
    const timeInput = document.getElementById('newSlotTime');
    const capacityInput = document.getElementById('newSlotCapacity');
    
    const time = timeInput.value;
    const capacity = parseInt(capacityInput.value);

    if (!time || !capacity) {
        alert('Please fill in both time and capacity');
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/admin/slots', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            },
            body: JSON.stringify({ time, capacity })
        });

        if (response.ok) {
            timeInput.value = '';
            capacityInput.value = '';
            loadTimeSlots();
        } else {
            alert('Failed to add time slot');
        }
    } catch (error) {
        console.error('Error adding slot:', error);
        alert('Error adding time slot');
    }
}

async function editSlot(slotId, button) {
    const row = button.closest('tr');
    const timeCell = row.querySelector('.slot-time');
    const capacityCell = row.querySelector('.slot-capacity');

    if (button.innerHTML.includes('fa-edit')) {
        // Switch to edit mode
        const currentTime = timeCell.textContent;
        const currentCapacity = capacityCell.textContent;

        timeCell.innerHTML = `<input type="time" value="${currentTime}" step="1800">`;
        capacityCell.innerHTML = `<input type="number" value="${currentCapacity}" min="1">`;
        button.innerHTML = '<i class="fas fa-save"></i>';
    } else {
        // Save changes
        const newTime = row.querySelector('.slot-time input').value;
        const newCapacity = row.querySelector('.slot-capacity input').value;

        try {
            const response = await fetch(`http://localhost:3000/admin/slots/${slotId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({ time: newTime, capacity: newCapacity })
            });

            if (response.ok) {
                loadTimeSlots();
            } else {
                alert('Failed to update time slot');
            }
        } catch (error) {
            console.error('Error updating slot:', error);
            alert('Error updating time slot');
        }
    }
}

async function deleteSlot(slotId) {
    if (confirm('Are you sure you want to delete this time slot?')) {
        try {
            const response = await fetch(`http://localhost:3000/admin/slots/${slotId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });

            if (response.ok) {
                loadTimeSlots();
            } else {
                alert('Failed to delete time slot');
            }
        } catch (error) {
            console.error('Error deleting slot:', error);
            alert('Error deleting time slot');
        }
    }
}

// Add event listener for the add slot button
document.getElementById('addSlotBtn')?.addEventListener('click', addSlot); 

// Add these functions for ticket price management
async function loadTicketPrices() {
    try {
        const response = await fetch('http://localhost:3000/admin/prices', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        const prices = await response.json();
        displayTicketPrices(prices);
    } catch (error) {
        console.error('Error loading ticket prices:', error);
    }
}

function displayTicketPrices(prices) {
    const tbody = document.getElementById('pricingTableBody');
    tbody.innerHTML = '';

    prices.forEach(price => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="price-type">${capitalizeFirst(price.ticket_type)}</td>
            <td class="price-amount">${price.price}</td>
            <td class="price-actions">
                <button class="edit-price" onclick="editPrice(${price.id}, this)">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-price" onclick="deletePrice(${price.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function capitalizeFirst(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

async function addPrice() {
    const typeSelect = document.getElementById('newTicketType');
    const priceInput = document.getElementById('newTicketPrice');
    
    const type = typeSelect.value;
    const price = parseInt(priceInput.value);

    if (!type || !price) {
        alert('Please fill in both type and price');
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/admin/prices', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            },
            body: JSON.stringify({ type, price })
        });

        if (response.ok) {
            typeSelect.value = 'adult';
            priceInput.value = '';
            loadTicketPrices();
        } else {
            alert('Failed to add ticket price');
        }
    } catch (error) {
        console.error('Error adding price:', error);
        alert('Error adding ticket price');
    }
}

async function editPrice(priceId, button) {
    const row = button.closest('tr');
    const typeCell = row.querySelector('.price-type');
    const priceCell = row.querySelector('.price-amount');

    if (button.innerHTML.includes('fa-edit')) {
        // Switch to edit mode
        const currentPrice = priceCell.textContent;
        priceCell.innerHTML = `<input type="number" value="${currentPrice}" min="0">`;
        button.innerHTML = '<i class="fas fa-save"></i>';
    } else {
        // Save changes
        const newPrice = row.querySelector('.price-amount input').value;

        try {
            const response = await fetch(`http://localhost:3000/admin/prices/${priceId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({ price: newPrice })
            });

            if (response.ok) {
                loadTicketPrices();
            } else {
                alert('Failed to update ticket price');
            }
        } catch (error) {
            console.error('Error updating price:', error);
            alert('Error updating ticket price');
        }
    }
}

async function deletePrice(priceId) {
    if (confirm('Are you sure you want to delete this price?')) {
        try {
            const response = await fetch(`http://localhost:3000/admin/prices/${priceId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });

            if (response.ok) {
                loadTicketPrices();
            } else {
                alert('Failed to delete ticket price');
            }
        } catch (error) {
            console.error('Error deleting price:', error);
            alert('Error deleting ticket price');
        }
    }
}

// Add event listener for the add price button
document.getElementById('addPriceBtn')?.addEventListener('click', addPrice); 

// Add this function to load system settings
async function loadSystemSettings() {
    try {
        const response = await fetch('http://localhost:3000/admin/system-settings', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        const settings = await response.json();
        
        // Update toggle states
        document.getElementById('bookingSystemToggle').checked = settings.bookingEnabled;
        document.getElementById('newsTickerToggle').checked = settings.newsTickerEnabled;
    } catch (error) {
        console.error('Error loading system settings:', error);
    }
}

// Add event listener for news ticker toggle
document.getElementById('newsTickerToggle')?.addEventListener('change', async (e) => {
    try {
        const response = await fetch('http://localhost:3000/admin/news-ticker-status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            },
            body: JSON.stringify({
                enabled: e.target.checked
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update news ticker status');
        }
    } catch (error) {
        console.error('Error toggling news ticker:', error);
        // Revert toggle if failed
        e.target.checked = !e.target.checked;
        alert('Failed to update news ticker status');
    }
});

// Update the viewBookingDetails function
async function viewBookingDetails(bookingId) {
    try {
        const response = await fetch(`http://localhost:3000/admin/bookings/${bookingId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch booking details');
        }
        
        const booking = await response.json();
        console.log('Booking details:', booking);

        // Populate modal with booking details
        document.getElementById('modalUserName').textContent = booking.username || '-';
        document.getElementById('modalUserEmail').textContent = booking.email || '-';
        document.getElementById('modalUserPhone').textContent = booking.phone || '-';
        document.getElementById('modalBookingId').textContent = booking.id || '-';
        document.getElementById('modalVisitDate').textContent = booking.visit_date ? new Date(booking.visit_date).toLocaleDateString() : '-';
        document.getElementById('modalTimeSlot').textContent = booking.slot_time || '-';
        document.getElementById('modalStatus').textContent = booking.status || '-';
        document.getElementById('modalAdultTickets').textContent = booking.adult_tickets || '0';
        document.getElementById('modalChildTickets').textContent = booking.child_tickets || '0';
        document.getElementById('modalSeniorTickets').textContent = booking.senior_tickets || '0';
        document.getElementById('modalAmount').textContent = booking.amount || '0';
        document.getElementById('modalPaymentId').textContent = booking.razorpay_payment_id || '-';
        document.getElementById('modalOrderId').textContent = booking.razorpay_order_id || '-';
        document.getElementById('modalPaymentStatus').textContent = booking.payment_status || '-';

        // Update cancel button state
        const cancelBtn = document.getElementById('cancelBookingBtn');
        cancelBtn.disabled = booking.status === 'cancelled' || booking.status === 'completed';
        
        // Add cancel button event listener
        cancelBtn.onclick = async () => {
            if (confirm('Are you sure you want to cancel this booking?')) {
                try {
                    const response = await fetch(`http://localhost:3000/admin/bookings/${booking.id}/cancel`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ status: 'cancelled by admin' })
                    });

                    if (response.ok) {
                        alert('Booking cancelled successfully');
                        document.getElementById('modalStatus').textContent = 'cancelled by admin';
                        cancelBtn.disabled = true;
                        loadBookings(); // Refresh the bookings table
                    } else {
                        throw new Error('Failed to cancel booking');
                    }
                } catch (error) {
                    console.error('Error cancelling booking:', error);
                    alert('Failed to cancel booking');
                }
            }
        };

        // Show modal
        const modal = document.getElementById('bookingModal');
        modal.style.display = 'block';
    } catch (error) {
        console.error('Error fetching booking details:', error);
        alert('Failed to load booking details');
    }
}

// Add these event listeners for the modal
document.querySelector('.close')?.addEventListener('click', () => {
    document.getElementById('bookingModal').style.display = 'none';
});

window.onclick = function(event) {
    const modal = document.getElementById('bookingModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

// Add admin booking functions
async function initializeAdminBooking() {
    try {
        // Load time slots
        const timeSlotSelect = document.getElementById('adminBookingTimeSlot');
        const response = await fetch('http://localhost:3000/admin/slots', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        const slots = await response.json();
        
        timeSlotSelect.innerHTML = '<option value="">Select Time Slot</option>';
        slots.forEach(slot => {
            const option = document.createElement('option');
            option.value = slot.slot_time;
            option.textContent = new Date(`2000-01-01T${slot.slot_time}`).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            timeSlotSelect.appendChild(option);
        });

        // Load ticket prices
        const pricesResponse = await fetch('http://localhost:3000/prices');
        const prices = await pricesResponse.json();
        window.ticketPrices = prices.reduce((acc, price) => {
            acc[price.ticket_type] = price.price;
            return acc;
        }, {});

        // Add event listeners for ticket quantity changes
        const ticketInputs = ['adminAdultTickets', 'adminChildTickets', 'adminSeniorTickets'];
        ticketInputs.forEach(id => {
            const input = document.getElementById(id);
            input.addEventListener('input', updateAdminBookingSummary);
            input.addEventListener('change', updateAdminBookingSummary);
        });

        // Add form submit handler
        document.getElementById('adminBookingForm').addEventListener('submit', handleAdminBooking);

        // Initial summary update
        updateAdminBookingSummary();

    } catch (error) {
        console.error('Error initializing admin booking:', error);
    }
}

function updateAdminBookingSummary() {
    const adultTickets = parseInt(document.getElementById('adminAdultTickets').value) || 0;
    const childTickets = parseInt(document.getElementById('adminChildTickets').value) || 0;
    const seniorTickets = parseInt(document.getElementById('adminSeniorTickets').value) || 0;

    const totalTickets = adultTickets + childTickets + seniorTickets;

    // Calculate total amount using the prices from server
    const totalAmount = (adultTickets * (window.ticketPrices?.adult || 0)) +
                       (childTickets * (window.ticketPrices?.child || 0)) +
                       (seniorTickets * (window.ticketPrices?.senior || 0));

    // Update the summary display
    document.getElementById('adminTotalTickets').textContent = totalTickets;
    document.getElementById('adminTotalAmount').textContent = totalAmount;

    console.log('Summary updated:', { totalTickets, totalAmount, prices: window.ticketPrices });
}

async function handleAdminBooking(e) {
    e.preventDefault();

    const bookingData = {
        username: document.getElementById('adminBookingName').value,
        email: document.getElementById('adminBookingEmail').value,
        phone: document.getElementById('adminBookingPhone').value,
        visitDate: document.getElementById('adminBookingDate').value,
        timeSlot: document.getElementById('adminBookingTimeSlot').value,
        adultTickets: parseInt(document.getElementById('adminAdultTickets').value) || 0,
        childTickets: parseInt(document.getElementById('adminChildTickets').value) || 0,
        seniorTickets: parseInt(document.getElementById('adminSeniorTickets').value) || 0
    };

    try {
        const response = await fetch('http://localhost:3000/admin/create-booking', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            },
            body: JSON.stringify(bookingData)
        });

        if (!response.ok) {
            throw new Error('Failed to create booking');
        }

        const result = await response.json();
        alert('Booking created successfully! Booking ID: ' + result.bookingId);
        e.target.reset();
        updateAdminBookingSummary();
    } catch (error) {
        console.error('Error creating booking:', error);
        alert('Failed to create booking: ' + error.message);
    }
}