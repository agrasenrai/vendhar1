const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const Razorpay = require('razorpay');
const postmark = require("postmark");
const client = new postmark.ServerClient("c1d4e6bd-4f3b-4c1b-9c3e-aeddd7f63c6b");
const QRCode = require('qrcode');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3000';
const JWT_SECRET = "your_secret";

// Add these global variables
let systemSettings = {
    bookingEnabled: true,
    newsTickerEnabled: true
};

// Middleware
app.use(bodyParser.json());
app.use(cors({
    origin: FRONTEND_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.static('public'));
app.use('/uploads', express.static('server/uploads'));

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: 'rzp_test_By6MGs32I1BlAz',
    key_secret: '7lknLnTLwkfMZwDw0ESFPT9L'
});

// MySQL connection setup
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'qwertyuioP',
    database: 'MuseumBooking'
});

// Add error handling for database connection
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        return;
    }
    console.log('Connected to database successfully');
});

// Add error handler for lost connections
connection.on('error', (err) => {
    console.error('Database error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('Reconnecting to database...');
        connection.connect();
    } else {
        throw err;
    }
});

// Add this function to send emails
async function sendTicketEmail(bookingData) {
    try {
        // Generate QR code as base64 image
        const qrData = JSON.stringify({
            bookingId: bookingData.id,
            visitDate: bookingData.visit_date,
            timeSlot: bookingData.time_slot,
            totalTickets: bookingData.adult_tickets + bookingData.child_tickets + bookingData.senior_tickets
        });

        const qrCodeImage = await QRCode.toDataURL(qrData);
        // Remove the data:image/png;base64, prefix
        const qrCodeBase64 = qrCodeImage.split(',')[1];

        const emailContent = `
            <h1>Your SRMIST Museum Tickets</h1>
            <div style="margin: 20px 0;">
                <h2>Booking Details</h2>
                <p><strong>Booking ID:</strong> ${bookingData.id}</p>
                <p><strong>Visit Date:</strong> ${new Date(bookingData.visit_date).toLocaleDateString()}</p>
                <p><strong>Time Slot:</strong> ${bookingData.time_slot}</p>
                <h3>Tickets</h3>
                <p>Adult Tickets: ${bookingData.adult_tickets}</p>
                <p>Child Tickets: ${bookingData.child_tickets}</p>
                <p>Senior Tickets: ${bookingData.senior_tickets}</p>
                <p><strong>Total Amount Paid:</strong> ₹${bookingData.amount}</p>
            </div>
            <div style="margin: 20px 0;">
                <h3>Entry QR Code</h3>
                <img src="cid:qrcode" alt="Entry QR Code" style="max-width: 200px;"/>
                <p>Please show this QR code at the museum entrance.</p>
                <p>Thank you for choosing SRMIST Museum!</p>
            </div>
        `;

        await client.sendEmail({
            "From": "yr4232@srmist.edu.in",
            "To": bookingData.email,
            "Subject": "Your SRMIST Museum Tickets",
            "HtmlBody": emailContent,
            "TextBody": "Your museum tickets are confirmed.",
            "MessageStream": "vendhar",
            "Attachments": [
                {
                    "Name": "qrcode.png",
                    "Content": qrCodeBase64,
                    "ContentType": "image/png",
                    "ContentID": "qrcode"
                }
            ]
        });

        console.log('Ticket email sent successfully');
    } catch (error) {
        console.error('Error sending ticket email:', error);
    }
}

// Create order endpoint
app.post("/create-order", async (req, res) => {
    try {
        const { amount, booking_id } = req.body;
        
        const options = {
            amount: amount * 100,
            currency: "INR",
            receipt: `booking_${booking_id}`
        };
        
        const order = await razorpay.orders.create(options);
        
        // Store order details in database
        const query = `
            INSERT INTO Orders (
                razorpay_order_id, 
                booking_id,
                amount, 
                amount_due, 
                amount_paid,
                attempts,
                currency,
                receipt,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
            order.id,
            booking_id,
            amount,
            amount,
            0,
            0,
            'INR',
            `booking_${booking_id}`,
            'created'
        ];

        connection.query(query, values, (err, result) => {
            if (err) {
                console.error('Error storing order details:', err);
                return res.status(500).json({ error: "Failed to store order details" });
            }
            res.json(order);
        });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: "Failed to create order" });
    }
});

// Verify payment endpoint
app.post("/verify-payment", (req, res) => {
    const { 
        razorpay_order_id, 
        razorpay_payment_id, 
        razorpay_signature,
        booking_id
    } = req.body;
    
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const crypto = require('crypto');
    const expectedSignature = crypto
        .createHmac("sha256", "7lknLnTLwkfMZwDw0ESFPT9L")
        .update(body.toString())
        .digest("hex");

    if (expectedSignature === razorpay_signature) {
        // Update booking status to 'pending' instead of 'completed'
        const updateBookingQuery = "UPDATE Bookings SET status = 'pending' WHERE id = ?";
        connection.query(updateBookingQuery, [booking_id], (err, result) => {
            if (err) {
                console.error('Error updating booking status:', err);
                return res.status(500).json({ error: "Failed to update booking status" });
            }

            // Fetch booking details for email
            const bookingQuery = `
                SELECT 
                    b.*,
                    u.email,
                    s.slot_time as time_slot,
                    o.amount
                FROM Bookings b
                JOIN Users u ON b.user_id = u.id
                JOIN Slots s ON b.slot_id = s.id
                JOIN Orders o ON b.id = o.booking_id
                WHERE b.id = ?
            `;

            connection.query(bookingQuery, [booking_id], async (err, results) => {
                if (err) {
                    console.error('Error fetching booking details:', err);
                    return res.status(500).json({ error: "Failed to fetch booking details" });
                }

                if (results.length > 0) {
                    // Send confirmation email
                    await sendTicketEmail(results[0]);
                }

                res.status(200).json({ message: "Payment verified successfully" });
            });
        });
    } else {
        res.status(400).json({ error: "Payment verification failed" });
    }
});

// User registration endpoint
app.post("/register", (req, res) => {
    const { username, email, phone } = req.body;

    if (!username || !email || !phone) {
        return res.status(400).send("Username, email, and phone number are required.");
    }

    // Check if the user already exists
    // const checkUserQuery = "SELECT * FROM Users WHERE phone = ?";
    // connection.query(checkUserQuery, [phone], (err, results) => {
    //     if (err) {
    //         console.error(err);
    //         return res.status(500).send("Server error.");
    //     }

        // if (results.length > 0) {
        //     return res.status(400).send("User already exists with this phone number.");
        // }

        // Insert new user into the database
        const insertUserQuery = "INSERT INTO Users (username, phone, email) VALUES (?, ?, ?)";
        connection.query(insertUserQuery, [username, phone, email], (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Failed to register user.");
            }

            // Generate JWT token
            const token = jwt.sign({ id: results.insertId }, JWT_SECRET, { expiresIn: "1h" });
            res.status(201).json({ token });
        });
    });
// });


// Update the booking endpoint
app.post("/book", (req, res) => {
    const { visitDate, timeSlot, numTickets, adultTickets, childTickets, seniorTickets } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error(err);
            return res.status(401).json({ error: "Unauthorized" });
        }

        const userId = decoded.id;

        if (!visitDate || !timeSlot || !numTickets) {
            return res.status(400).json({ error: "All fields are required" });
        }

        // First get the slot ID
        const slotQuery = 'SELECT id, max_capacity FROM Slots WHERE slot_time = ?';
        connection.query(slotQuery, [timeSlot], (err, slotResults) => {
            if (err || !slotResults.length) {
                console.error('Error finding slot:', err);
                return res.status(400).json({ error: "Invalid time slot" });
            }

            const slotId = slotResults[0].id;

            // Check slot availability
            const checkAvailabilityQuery = `
                SELECT 
                    (? - COALESCE(SUM(b.num_tickets), 0)) AS available_tickets
                FROM Slots s
                LEFT JOIN Bookings b ON s.id = b.slot_id 
                    AND b.visit_date = ? 
                    AND b.status != 'cancelled'
                WHERE s.id = ?
                GROUP BY s.id
            `;

            connection.query(checkAvailabilityQuery, [slotResults[0].max_capacity, visitDate, slotId], (err, availResults) => {
                if (err) {
                    console.error('Error checking availability:', err);
                    return res.status(500).json({ error: "Error checking availability" });
                }

                const availableTickets = availResults[0]?.available_tickets ?? slotResults[0].max_capacity;

                if (numTickets > availableTickets) {
                    return res.status(400).json({ 
                        error: `Only ${availableTickets} tickets available for this slot` 
                    });
                }

                // Insert booking
                const bookingQuery = `
                    INSERT INTO Bookings (
                        user_id, 
                        slot_id,
                        visit_date,
                        num_tickets,
                        adult_tickets,
                        child_tickets,
                        senior_tickets,
                        status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
                `;

                connection.query(
                    bookingQuery,
                    [userId, slotId, visitDate, numTickets, adultTickets, childTickets, seniorTickets],
                    (err, result) => {
                        if (err) {
                            console.error('Error creating booking:', err);
                            return res.status(500).json({ error: "Booking failed" });
                        }

                        console.log('Booking created:', result);
                        res.status(201).json({ 
                            message: "Booking created",
                            id: result.insertId
                        });
                    }
                );
            });
        });
    });
});

// Add handler for payment cancellation
app.post("/cancel-booking", (req, res) => {
    const { booking_id } = req.body;

    const updateQuery = `
        UPDATE Bookings 
        SET status = 'cancelled' 
        WHERE id = ?
    `;

    connection.query(updateQuery, [booking_id], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Failed to cancel booking" });
        }
        res.json({ message: "Booking cancelled successfully" });
    });
});

// Fetch user data and ticket history
app.get("/dashboard", (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).send("Unauthorized.");
    }

    const token = authHeader.split(" ")[1];

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error(err);
            return res.status(401).send("Unauthorized.");
        }

        const userId = decoded.id;

        // Query for user information
        const userQuery = "SELECT id, username, email FROM Users WHERE id = ?";
        connection.query(userQuery, [userId], (err, userResults) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Failed to fetch user data.");
            }

            if (userResults.length === 0) {
                return res.status(404).send("User not found.");
            }

            const userInfo = userResults[0];

            // Query for ticket history, without QR code
            const ticketsQuery = `
                SELECT 
                    booking_date AS bookingDate, 
                    visit_date AS visitDate, 
                    time_slot AS timeSlot, 
                    status 
                FROM Bookings 
                WHERE user_id = ? 
                ORDER BY booking_date DESC
            `;
            connection.query(ticketsQuery, [userId], (err, ticketsResults) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send("Failed to fetch ticket history.");
                }

                // Return null for QR code in the response
                const ticketHistory = ticketsResults.map(ticket => ({
                    ...ticket,
                    qrCode: null // Set qrCode as null
                }));

                res.json({
                    user: userInfo,
                    tickets: ticketHistory,
                });
            });
        });
    });
});

// Add this endpoint for fetching available slots
app.get('/slots', (req, res) => {
    const visitDate = req.query.date;

    if (!visitDate) {
        return res.status(400).json({ error: "Visit date is required" });
    }

    const query = `
        SELECT 
            s.slot_time, 
            (s.max_capacity - COALESCE(SUM(CASE WHEN b.status != 'cancelled' THEN b.num_tickets ELSE 0 END), 0)) AS available_tickets
        FROM Slots s
        LEFT JOIN Bookings b ON s.id = b.slot_id AND b.visit_date = ?
        GROUP BY s.id, s.slot_time
        ORDER BY s.slot_time
    `;

    connection.query(query, [visitDate], (error, results) => {
        if (error) {
            console.error("Database query failed:", error);
            return res.status(500).json({ error: "Database query failed" });
        }

        const slots = results.reduce((acc, row) => {
            acc[row.slot_time] = Math.max(row.available_tickets, 0);
            return acc;
        }, {});

        res.json({ date: visitDate, slots });
    });
});

// Admin login endpoint
app.post("/admin/login", (req, res) => {
    const { username, password } = req.body;

    // For demonstration, using hardcoded credentials
    // In production, use database and proper password hashing
    if (username === "admin" && password === "admin123") {
        const token = jwt.sign(
            { id: 1, isAdmin: true },
            JWT_SECRET,
            { expiresIn: "24h" }
        );
        res.json({ token });
    } else {
        res.status(401).json({ error: "Invalid credentials" });
    }
});

// Verify ticket endpoint
app.get("/admin/verify-ticket/:bookingId", async (req, res) => {
    const { bookingId } = req.params;

    const query = `
        SELECT 
            b.id as bookingId,
            b.visit_date,
            b.adult_tickets,
            b.child_tickets,
            b.senior_tickets,
            b.status,
            u.username,
            s.slot_time as time_slot
        FROM Bookings b
        JOIN Users u ON b.user_id = u.id
        JOIN Slots s ON b.slot_id = s.id
        WHERE b.id = ?
    `;

    connection.query(query, [bookingId], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Database error" });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: "Ticket not found" });
        }

        const ticketData = results[0];
        res.json(ticketData);
    });
});

// Mark ticket as completed endpoint
app.post("/admin/complete-ticket/:bookingId", async (req, res) => {
    const { bookingId } = req.params;

    // First get the booking details including the slot time
    const getBookingQuery = `
        SELECT 
            b.id,
            b.visit_date,
            b.status,
            s.slot_time,
            TIME_FORMAT(s.slot_time, '%H:%i') as formatted_time
        FROM Bookings b
        JOIN Slots s ON b.slot_id = s.id
        WHERE b.id = ?
    `;

    connection.query(getBookingQuery, [bookingId], (err, results) => {
        if (err) {
            console.error('Error fetching booking:', err);
            return res.status(500).json({ error: "Database error" });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: "Booking not found" });
        }

        const booking = results[0];
        const visitDate = new Date(booking.visit_date);
        const currentDate = new Date();

        // Check if it's the same day
        if (visitDate.toDateString() !== currentDate.toDateString()) {
            return res.status(400).json({ 
                error: "Tickets can only be marked as completed on the day of visit" 
            });
        }

        // Get slot time in minutes since midnight
        const [slotHours, slotMinutes] = booking.formatted_time.split(':').map(Number);
        const slotTimeInMinutes = slotHours * 60 + slotMinutes;

        // Get current time in minutes since midnight
        const currentTimeInMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();

        // Calculate time difference in minutes
        const timeDifference = currentTimeInMinutes - slotTimeInMinutes;

        // Only allow completion between 15 minutes before and 75 minutes after slot time
        if (timeDifference < -15) {
            return res.status(400).json({ 
                error: `Too early to mark as completed. Please wait until 15 minutes before the slot time (${booking.formatted_time})` 
            });
        }

        if (timeDifference > 75) {
            return res.status(400).json({ 
                error: `Too late to mark as completed. Tickets can only be marked as completed within 75 minutes after the slot time (${booking.formatted_time})` 
            });
        }

        // If time is valid, proceed with marking as completed
        const updateQuery = `
            UPDATE Bookings 
            SET status = 'completed',
                completed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        connection.query(updateQuery, [bookingId], (err) => {
            if (err) {
                console.error('Error updating booking status:', err);
                return res.status(500).json({ error: "Failed to update ticket status" });
            }

            // Return updated booking details
            const selectQuery = `
                SELECT 
                    b.id as bookingId,
                    b.visit_date,
                    b.adult_tickets,
                    b.child_tickets,
                    b.senior_tickets,
                    b.status,
                    b.completed_at,
                    u.username,
                    s.slot_time as time_slot
                FROM Bookings b
                JOIN Users u ON b.user_id = u.id
                JOIN Slots s ON b.slot_id = s.id
                WHERE b.id = ?
            `;

            connection.query(selectQuery, [bookingId], (err, results) => {
                if (err) {
                    console.error('Error fetching updated ticket:', err);
                    return res.status(500).json({ error: "Failed to fetch updated ticket" });
                }

                if (results.length === 0) {
                    return res.status(404).json({ error: "Ticket not found" });
                }

                res.json({
                    message: "Ticket marked as completed successfully",
                    ticket: results[0]
                });
            });
        });
    });
});

// Admin dashboard stats
app.get("/admin/stats", (req, res) => {
    const queries = {
        todayBookings: `
            SELECT COUNT(*) as count 
            FROM Bookings 
            WHERE DATE(visit_date) = CURDATE()
        `,
        totalRevenue: `
            SELECT COALESCE(SUM(amount), 0) as total 
            FROM Orders 
            WHERE status = 'completed'
        `,
        activeBookings: `
            SELECT COUNT(*) as count 
            FROM Bookings 
            WHERE status = 'confirmed' 
            AND visit_date >= CURDATE()
        `,
        availableSlots: `
            SELECT COUNT(*) as count 
            FROM Slots 
            WHERE id NOT IN (
                SELECT slot_id 
                FROM Bookings 
                WHERE visit_date = CURDATE() 
                AND status != 'cancelled'
                GROUP BY slot_id 
                HAVING COUNT(*) >= max_capacity
            )
        `,
        visitorTrends: `
            SELECT 
                DATE(visit_date) as date,
                COUNT(*) as visitors
            FROM Bookings
            WHERE status != 'cancelled'
            AND visit_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND CURDATE()
            GROUP BY DATE(visit_date)
            ORDER BY date
        `,
        peakHours: `
            SELECT 
                TIME_FORMAT(s.slot_time, '%H:00') as time,
                COUNT(b.id) as visitors
            FROM Slots s
            LEFT JOIN Bookings b ON s.id = b.slot_id 
                AND b.status != 'cancelled'
                AND b.visit_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY s.slot_time
            ORDER BY s.slot_time
        `
    };

    const stats = {};

    connection.query(queries.todayBookings, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Database error" });
        }
        stats.todayBookings = results[0].count;

        connection.query(queries.totalRevenue, (err, results) => {
            if (err) return res.status(500).json({ error: "Database error" });
            stats.totalRevenue = results[0].total || 0;

            connection.query(queries.activeBookings, (err, results) => {
                if (err) return res.status(500).json({ error: "Database error" });
                stats.activeBookings = results[0].count;

                connection.query(queries.availableSlots, (err, results) => {
                    if (err) return res.status(500).json({ error: "Database error" });
                    stats.availableSlots = results[0].count;

                    connection.query(queries.visitorTrends, (err, results) => {
                        if (err) return res.status(500).json({ error: "Database error" });
                        stats.trends = {
                            dates: results.map(r => r.date),
                            visitors: results.map(r => r.visitors)
                        };

                        connection.query(queries.peakHours, (err, results) => {
                            if (err) return res.status(500).json({ error: "Database error" });
                            stats.peakHours = {
                                times: results.map(r => r.time),
                                visitors: results.map(r => r.visitors)
                            };

                            res.json(stats);
                        });
                    });
                });
            });
        });
    });
});

// Admin bookings list
app.get('/admin/bookings', (req, res) => {
    const { search, status, date, timeSlot } = req.query;
    
    let query = `
        SELECT 
            b.*,
            u.username,
            u.email,
            u.phone,
            s.slot_time as time_slot,
            o.amount,
            o.razorpay_order_id,
            o.razorpay_payment_id,
            o.status as payment_status
        FROM Bookings b
        JOIN Users u ON b.user_id = u.id
        JOIN Slots s ON b.slot_id = s.id
        LEFT JOIN Orders o ON b.id = o.booking_id
        WHERE 1=1
    `;
    
    const params = [];
    
    if (search) {
        query += ` AND (u.username LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR b.id LIKE ?)`;
        const searchParam = `%${search}%`;
        params.push(searchParam, searchParam, searchParam, searchParam);
    }
    
    if (status) {
        query += ` AND b.status = ?`;
        params.push(status);
    }
    
    if (date) {
        query += ` AND DATE(b.visit_date) = ?`;
        params.push(date);
    }
    
    if (timeSlot) {
        query += ` AND s.slot_time = ?`;
        params.push(timeSlot);
    }
    
    query += ` ORDER BY b.visit_date DESC, s.slot_time ASC`;

    connection.query(query, params, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});

// Add endpoint to get single booking details
app.get('/admin/bookings/:id', (req, res) => {
    const { id } = req.params;
    
    const query = `
        SELECT 
            b.*,
            u.username,
            u.email,
            u.phone,
            s.slot_time,
            o.amount,
            o.razorpay_order_id as order_id,
            o.razorpay_payment_id as payment_id,
            o.status as payment_status
        FROM Bookings b
        JOIN Users u ON b.user_id = u.id
        JOIN Slots s ON b.slot_id = s.id
        LEFT JOIN Orders o ON b.id = o.booking_id
        WHERE b.id = ?
    `;
    
    connection.query(query, [id], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Database error" });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: "Booking not found" });
        }
        
        res.json(results[0]);
    });
});

// Update the translation endpoint
app.get('/translate', async (req, res) => {
    const { text, targetLang } = req.query;
    
    if (!text || !targetLang) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    try {
        console.log('Translation request:', { text, targetLang });
        
        // Using a free translation API
        const response = await axios.get('https://translate.googleapis.com/translate_a/single', {
            params: {
                client: 'gtx',
                sl: 'en',
                tl: targetLang,
                dt: 't',
                q: text
            },
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });

        if (response.data && response.data[0] && response.data[0][0]) {
            const translatedText = response.data[0][0][0];
            console.log('Translation successful:', translatedText);
            res.json({ translatedText });
        } else {
            throw new Error('Invalid translation response');
        }
    } catch (error) {
        console.error('Translation error:', error);
        res.status(500).json({ 
            error: 'Translation failed',
            details: error.message
        });
    }
});

// Add these endpoints for news management
app.get('/admin/news', (req, res) => {
    const query = 'SELECT * FROM News ORDER BY id DESC';
    connection.query(query, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});

app.post('/admin/news', (req, res) => {
    const { text } = req.body;
    const query = 'INSERT INTO News (text) VALUES (?)';
    connection.query(query, [text], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Failed to add news" });
        }
        res.status(201).json({ id: result.insertId });
    });
});

app.delete('/admin/news/:id', (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM News WHERE id = ?';
    connection.query(query, [id], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Failed to delete news" });
        }
        res.status(200).json({ message: "News deleted successfully" });
    });
});

// Update the news endpoint
app.get('/news', (req, res) => {
    // First check if news ticker is enabled
    const statusQuery = 'SELECT setting_value FROM SystemSettings WHERE setting_name = "news_ticker_enabled"';
    connection.query(statusQuery, (err, statusResults) => {
        if (err) {
            console.error('Error checking news ticker status:', err);
            return res.status(500).json({ error: "Database error" });
        }

        // If news ticker is disabled, return early
        if (!statusResults[0]?.setting_value) {
            return res.json({ enabled: false, items: [] });
        }

        // If enabled, get news items
        const newsQuery = 'SELECT * FROM News ORDER BY id DESC';
        connection.query(newsQuery, (err, newsResults) => {
            if (err) {
                console.error('Error fetching news:', err);
                return res.status(500).json({ error: "Database error" });
            }

            res.json({
                enabled: true,
                items: newsResults
            });
        });
    });
});

// Update the news ticker status endpoint
app.post('/admin/news-ticker-status', (req, res) => {
    const { enabled } = req.body;
    const query = 'UPDATE SystemSettings SET setting_value = ? WHERE setting_name = "news_ticker_enabled"';
    
    connection.query(query, [enabled], (err) => {
        if (err) {
            console.error('Error updating news ticker status:', err);
            return res.status(500).json({ error: "Failed to update news ticker status" });
        }
        res.json({ success: true, enabled: enabled });
    });
});

// Add these endpoints for time slot management
app.get('/admin/slots', (req, res) => {
    const query = 'SELECT * FROM Slots ORDER BY slot_time';
    connection.query(query, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});

app.post('/admin/slots', (req, res) => {
    const { time, capacity } = req.body;
    const query = 'INSERT INTO Slots (slot_time, max_capacity) VALUES (?, ?)';
    connection.query(query, [time, capacity], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Failed to add slot" });
        }
        res.status(201).json({ id: result.insertId });
    });
});

app.put('/admin/slots/:id', (req, res) => {
    const { id } = req.params;
    const { time, capacity } = req.body;
    const query = 'UPDATE Slots SET slot_time = ?, max_capacity = ? WHERE id = ?';
    connection.query(query, [time, capacity, id], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Failed to update slot" });
        }
        res.json({ message: "Slot updated successfully" });
    });
});

app.delete('/admin/slots/:id', (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM Slots WHERE id = ?';
    connection.query(query, [id], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Failed to delete slot" });
        }
        res.json({ message: "Slot deleted successfully" });
    });
});

// Add these endpoints for ticket price management
app.get('/admin/prices', (req, res) => {
    const query = 'SELECT * FROM TicketPrices ORDER BY id';
    connection.query(query, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});

app.post('/admin/prices', (req, res) => {
    const { type, price } = req.body;
    const query = 'INSERT INTO TicketPrices (ticket_type, price) VALUES (?, ?)';
    connection.query(query, [type, price], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Failed to add price" });
        }
        res.status(201).json({ id: result.insertId });
    });
});

app.put('/admin/prices/:id', (req, res) => {
    const { id } = req.params;
    const { price } = req.body;
    const query = 'UPDATE TicketPrices SET price = ? WHERE id = ?';
    connection.query(query, [price, id], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Failed to update price" });
        }
        res.json({ message: "Price updated successfully" });
    });
});

app.delete('/admin/prices/:id', (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM TicketPrices WHERE id = ?';
    connection.query(query, [id], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Failed to delete price" });
        }
        res.json({ message: "Price deleted successfully" });
    });
});

// Add this endpoint to get ticket prices for public page
app.get('/prices', (req, res) => {
    const query = 'SELECT ticket_type, price FROM TicketPrices';
    connection.query(query, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});

// Update the booking system toggle endpoint
app.post("/admin/system/toggle", async (req, res) => {
    const { enabled } = req.body;
    const query = 'UPDATE SystemSettings SET setting_value = ? WHERE setting_name = "booking_system_enabled"';
    
    connection.query(query, [enabled], (err) => {
        if (err) {
            console.error('Error updating booking system status:', err);
            return res.status(500).json({ error: "Failed to update booking system status" });
        }
        res.json({ success: true, enabled: enabled });
    });
});

// Update the booking status endpoint
app.get('/booking-status', (req, res) => {
    const query = 'SELECT setting_value FROM SystemSettings WHERE setting_name = "booking_system_enabled"';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error checking booking system status:', err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json({ enabled: results[0]?.setting_value ?? true });
    });
});

// Update system settings endpoint
app.get('/admin/system-settings', (req, res) => {
    const query = 'SELECT setting_name, setting_value FROM SystemSettings';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching system settings:', err);
            return res.status(500).json({ error: "Database error" });
        }

        const settings = results.reduce((acc, setting) => {
            acc[setting.setting_name === 'booking_system_enabled' ? 'bookingEnabled' : 'newsTickerEnabled'] = setting.setting_value;
            return acc;
        }, {});

        res.json(settings);
    });
});

// Add this endpoint for admin cancellation
app.post('/admin/bookings/:id/cancel', (req, res) => {
    const { id } = req.params;
    const query = 'UPDATE Bookings SET status = "cancelled by admin" WHERE id = ?';
    
    connection.query(query, [id], (err) => {
        if (err) {
            console.error('Error cancelling booking:', err);
            return res.status(500).json({ error: "Failed to cancel booking" });
        }
        res.json({ message: "Booking cancelled successfully" });
    });
});

// Add admin booking endpoint
app.post('/admin/create-booking', async (req, res) => {
    const {
        username,
        email,
        phone,
        visitDate,
        timeSlot,
        adultTickets,
        childTickets,
        seniorTickets
    } = req.body;

    try {
        // First create or get user
        const userQuery = 'INSERT INTO Users (username, email, phone) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)';
        connection.query(userQuery, [username, email, phone], async (err, userResult) => {
            if (err) {
                console.error('Error creating user:', err);
                return res.status(500).json({ error: "Failed to create user" });
            }

            const userId = userResult.insertId;
            const totalTickets = adultTickets + childTickets + seniorTickets;

            // Get slot ID
            const slotQuery = 'SELECT id FROM Slots WHERE slot_time = ?';
            connection.query(slotQuery, [timeSlot], async (err, slotResults) => {
                if (err || !slotResults.length) {
                    return res.status(400).json({ error: "Invalid time slot" });
                }

                const slotId = slotResults[0].id;

                // Create booking
                const bookingQuery = `
                    INSERT INTO Bookings (
                        user_id, 
                        slot_id,
                        visit_date,
                        num_tickets,
                        adult_tickets,
                        child_tickets,
                        senior_tickets,
                        status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed')
                `;

                connection.query(
                    bookingQuery,
                    [userId, slotId, visitDate, totalTickets, adultTickets, childTickets, seniorTickets],
                    async (err, bookingResult) => {
                        if (err) {
                            console.error('Error creating booking:', err);
                            return res.status(500).json({ error: "Failed to create booking" });
                        }

                        // Send confirmation email
                        const bookingData = {
                            id: bookingResult.insertId,
                            visit_date: visitDate,
                            time_slot: timeSlot,
                            adult_tickets: adultTickets,
                            child_tickets: childTickets,
                            senior_tickets: seniorTickets,
                            email: email
                        };

                        try {
                            await sendTicketEmail(bookingData);
                        } catch (emailError) {
                            console.error('Error sending email:', emailError);
                        }

                        res.status(201).json({ 
                            message: "Booking created successfully",
                            bookingId: bookingResult.insertId
                        });
                    }
                );
            });
        });
    } catch (error) {
        console.error('Error in admin booking:', error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Add this endpoint to your server code
app.post('/api/validate-ticket/:ticketId', async (req, res) => {
    try {
        const ticketId = req.params.ticketId;
        
        // Get ticket details from database
        const [ticket] = await pool.query(`
            SELECT 
                b.id,
                b.visit_date,
                b.status,
                s.slot_time,
                TIME_FORMAT(s.slot_time, '%H:%i') as formatted_time
            FROM Bookings b
            JOIN Slots s ON b.slot_id = s.id
            WHERE b.id = ?
        `, [ticketId]);

        if (!ticket) {
            return res.json({ success: false, message: 'Invalid Ticket ID' });
        }

        if (ticket.status === 'claimed') {
            return res.json({ success: false, message: 'Ticket already claimed!' });
        }

        // Get current date and time
        const currentDate = new Date();
        const ticketDate = new Date(ticket.visit_date);

        // Compare dates
        if (ticketDate < currentDate.setHours(0,0,0,0)) {
            return res.json({ success: false, message: 'Not Valid - Ticket is for a past date!' });
        }

        if (ticketDate > currentDate.setHours(23,59,59,999)) {
            return res.json({ success: false, message: 'Not Valid - Ticket is for a future date!' });
        }

        // Compare times
        const currentTime = currentDate.getHours() * 60 + currentDate.getMinutes();
        const [ticketHour, ticketMinute] = ticket.formatted_time.split(':').map(Number);
        const ticketTimeInMinutes = ticketHour * 60 + ticketMinute;

        // Allow entry 30 minutes before and 2 hours after slot time
        if (currentTime < (ticketTimeInMinutes - 30) || currentTime > (ticketTimeInMinutes + 120)) {
            return res.json({ 
                success: false, 
                message: `Not Valid - Wrong Time Slot!<br>Valid time slot: ${ticket.formatted_time}` 
            });
        }

        // Update ticket status to claimed
        await pool.query(`
            UPDATE Bookings 
            SET status = 'claimed', 
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [ticketId]);

        res.json({ 
            success: true, 
            message: 'Valid Ticket! Marked as claimed.',
            slot_time: ticket.formatted_time 
        });

    } catch (error) {
        console.error('Error validating ticket:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error validating ticket' 
        });
    }
});

// Serve index page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/pages/index.html'));
});

// Serve admin pages
app.get('/admin/adminlogin', (req, res) => {
    console.log('Serving adminlogin page');
    res.sendFile(path.join(__dirname, 'views/admin/adminlogin.html'));
});

app.get('/admin/logout', (req, res) => {
    res.redirect('/admin/adminlogin');
});

app.get('/admin/dashboard', (req, res) => {
    console.log('Serving dashboard page');
    res.sendFile(path.join(__dirname, 'views/admin/dashboard.html'));
});

app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/admin/login.html'));
});

app.get('/admin/bookings-closed', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/admin/bookings-closed.html'));
});

// Serve other pages
app.get('/booking-success', (req, res) => {
    console.log('Serving booking-success.html from:', path.join(__dirname, 'views', 'pages', 'booking-success.html'));
    res.sendFile(path.join(__dirname, 'views', 'pages', 'booking-success.html'));
});

app.get('/tickets', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'pages', 'tickets.html'));
});

// 404 handler should be last
app.use((req, res, next) => {
    console.log('Request URL:', req.url);
    next();
});

app.use((req, res) => {
    res.status(404).json({ error: "Endpoint not found" });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
