const config = {
    api: {
        base: process.env.API_URL || 'http://localhost:3000',
        endpoints: {
            register: '/register',
            book: '/book',
            verify: '/verify-payment',
            // ... other endpoints
        }
    },
    frontend: {
        base: process.env.FRONTEND_URL || 'http://localhost:3000',
        pages: {
            tickets: '/tickets',
            success: '/booking-success',
            // ... other pages
        }
    }
};

module.exports = config; 