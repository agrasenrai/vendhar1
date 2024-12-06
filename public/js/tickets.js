document.addEventListener('DOMContentLoaded', () => {
    const BOOK_URL = "http://localhost:3000/book";
    const SLOTS_URL = "http://localhost:3000/slots";

    // Check if the user is logged in by verifying the token
    const authToken = localStorage.getItem("authToken");
    const ticketsContent = document.getElementById('ticketsContent');
    const loginMessage = document.getElementById('loginMessage');

    if (!authToken) {
        ticketsContent.style.display = 'none';
        return;
    }

    ticketsContent.style.display = 'block';

    const ticketForm = document.getElementById('ticketForm');
    const confirmBtn = document.getElementById('confirmBooking');

    // Set minimum date to today and maximum date to 5 days from today
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 4); // +4 because today counts as day 1

    document.getElementById('visitDate').min = today.toISOString().split('T')[0];
    document.getElementById('visitDate').max = maxDate.toISOString().split('T')[0];

    // Update confirm button state when any input changes
    ticketForm.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', () => {
            if (ticketForm.checkValidity()) {
                const totalTickets = parseInt(document.getElementById('adultTickets').value || 0) + 
                                   parseInt(document.getElementById('childTickets').value || 0) + 
                                   parseInt(document.getElementById('seniorTickets').value || 0);
                confirmBtn.disabled = totalTickets === 0;
            }
        });
    });

    // Handle booking confirmation
    confirmBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const totalTickets = parseInt(document.getElementById('adultTickets').value || 0) + 
                            parseInt(document.getElementById('childTickets').value || 0) + 
                            parseInt(document.getElementById('seniorTickets').value || 0);
        
        if (!totalTickets) {
            alert('Please select at least one ticket');
            return;
        }

        try {
            const response = await fetch(BOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    visitDate: document.getElementById('visitDate').value,
                    timeSlot: document.getElementById('timeSlot').value,
                    numTickets: totalTickets,
                    adultTickets: parseInt(document.getElementById('adultTickets').value || 0),
                    childTickets: parseInt(document.getElementById('childTickets').value || 0),
                    seniorTickets: parseInt(document.getElementById('seniorTickets').value || 0)
                })
            });
            
            const bookingData = await response.json();
            
            if (response.ok) {
                // Store booking details
                const bookingDetails = {
                    bookingId: bookingData.id,
                    visitDate: document.getElementById('visitDate').value,
                    timeSlot: document.getElementById('timeSlot').value,
                    adultTickets: document.getElementById('adultTickets').value,
                    childTickets: document.getElementById('childTickets').value,
                    seniorTickets: document.getElementById('seniorTickets').value
                };
                localStorage.setItem('bookingDetails', JSON.stringify(bookingDetails));
                
                window.location.href = '/booking-success';
            } else {
                throw new Error(bookingData.error || 'Booking failed');
            }
        } catch (error) {
            console.error('Error creating booking:', error);
            alert(error.message || 'Failed to create booking');
        }
    });

    // Add after setting minimum date
    const visitDateInput = document.getElementById('visitDate');
    visitDateInput.addEventListener('change', async () => {
        const selectedDate = visitDateInput.value;
        const timeSlotDropdown = document.getElementById('timeSlot');

        // Clear previous time slot options
        timeSlotDropdown.innerHTML = '<option value="">Choose a time slot</option>';

        if (selectedDate) {
            try {
                const response = await fetch(`${SLOTS_URL}?date=${selectedDate}`);
                if (response.ok) {
                    const data = await response.json();
                    Object.entries(data.slots).forEach(([time, ticketsLeft]) => {
                        const option = document.createElement('option');
                        option.value = time;
                        option.textContent = `${time} (${ticketsLeft} tickets left)`;
                        option.disabled = ticketsLeft === 0;
                        timeSlotDropdown.appendChild(option);
                    });
                } else {
                    console.error("Failed to fetch slots:", response.statusText);
                    alert("Unable to fetch available slots. Please try again later.");
                }
            } catch (error) {
                console.error("Error fetching slots:", error);
                alert("An error occurred while fetching available slots.");
            }
        }
    });

    // Add this function to update summary with translations
    async function updateSummaryWithTranslations() {
        const elements = document.querySelectorAll('[data-translate]');
        for (const element of elements) {
            if (element.parentElement.id.startsWith('summary')) {
                const originalText = element.getAttribute('data-translate');
                const translatedText = await window.translator.translateText(originalText);
                element.textContent = translatedText;
            }
        }
    }

    // Call this after updating the summary
    updateSummary().then(() => {
        if (window.translator) {
            updateSummaryWithTranslations();
        }
    });
});
