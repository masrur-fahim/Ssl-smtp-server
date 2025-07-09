const express = require('express');
const SSLCommerzPayment = require('sslcommerz-lts');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(express.json());
// Allow CORS for frontend
app.use(cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// --- Config from .env ---
const store_id = 'algor685c511224e18';
const store_passwd =  'algor685c511224e18@ssl';
const is_live = false;

const backendBaseUrl = 'https://ssl-smtp-server-thkn.onrender.com';
const frontendBaseUrl ='http://localhost:3000';

// --- Payment Endpoint ---
app.post('/api/initiate-payment', async (req, res) => {
    const orderData = {
        ...req.body,
        store_id,
        store_passwd,
        success_url: `${frontendBaseUrl}/paymentSuccess`,
        fail_url: `${frontendBaseUrl}/paymentFailed`,
        cancel_url: `${frontendBaseUrl}/paymentCanceled`,
        ipn_url: `${backendBaseUrl}/ipn`,
        emi_option: 0,
        emi_max_inst_option: 0,
        emi_selected_inst: 0,
        shipping_method: req.body.shipping_method || 'Courier',
        product_name: req.body.product_name || 'Online Order',
        product_category: req.body.product_category || 'General',
        product_profile: req.body.product_profile || 'general'
    };

    try {
        const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
        const apiResponse = await sslcz.init(orderData);
        if (apiResponse.GatewayPageURL) {
            res.json({ success: true, GatewayPageURL: apiResponse.GatewayPageURL });
        } else {
            res.status(400).json({ success: false, error: apiResponse.failedreason || 'GatewayPageURL missing' });
        }
    } catch (err) {
        console.error('SSLCommerz error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- Validate Payment ---
app.post('/api/validate-payment', async (req, res) => {
    const { val_id } = req.body;
    try {
        const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
        const data = await sslcz.validate({ val_id });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Test Gateway ---
app.get('/test-ssl-gateway', (req, res) => {
    const testData = {
        total_amount: 100,
        currency: 'BDT',
        tran_id: 'REF' + Date.now(),
        success_url: `${backendBaseUrl}/success`,
        fail_url: `${backendBaseUrl}/fail`,
        cancel_url: `${backendBaseUrl}/cancel`,
        ipn_url: `${backendBaseUrl}/ipn`,
        emi_option: 0,
        emi_max_inst_option: 0,
        emi_selected_inst: 0,
        shipping_method: 'Courier',
        product_name: 'Test Product',
        product_category: 'Test',
        product_profile: 'general',
        cus_name: 'Test User',
        cus_email: 'test@example.com',
        cus_add1: 'Dhaka',
        cus_city: 'Dhaka',
        cus_postcode: '1000',
        cus_country: 'Bangladesh',
        cus_phone: '01711111111'
    };

    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    sslcz.init(testData).then(apiResponse => {
        if (apiResponse.GatewayPageURL) {
            res.redirect(apiResponse.GatewayPageURL);
        } else {
            res.send('Failed to get GatewayPageURL: ' + JSON.stringify(apiResponse));
        }
    }).catch(err => {
        res.send('Error: ' + err.message);
    });
});

// --- Send OTP ---
// In-memory OTP store
const otpStore = {};

app.post('/api/send-otp', async (req, res) => {
    try {
        const { to, otp, type = 'verify', userType = 'Customer' } = req.body;
        if (!to || !otp) {
            return res.status(400).json({ success: false, message: 'Missing email or OTP' });
        }

        // Store OTP with timestamp
        otpStore[to] = { otp, timestamp: Date.now() };

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'iamfahimfaisal39@gmail.com',
                pass: 'hdiuctaaqxyaxttp'
            }
        });

        const html = `
            <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto; padding:20px;">
                <h2 style="color:#2c5530; text-align:center;">${type === 'signin' ? 'Sign In' : 'Verification'} Code</h2>
                <p>Hello ${userType},</p>
                <p>Your verification code is:</p>
                <h1 style="color:#2c5530; text-align:center;">${otp}</h1>
                <p>This code will expire in 5 minutes.</p>
            </div>`;

        const mailOptions = {
            from: `"denTallo" <faisalmasrur71@gmail.com>`,
            to,
            subject: `denTallo - OTP Verification`,
            html
        };

        const info = await transporter.sendMail(mailOptions);
        res.json({ success: true, messageId: info.messageId });
    } catch (err) {
        console.error('OTP SEND ERROR:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- Verify OTP ---
app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.status(400).json({ success: false, message: 'Missing email or OTP' });
    }
    const record = otpStore[email];
    if (!record) {
        return res.status(400).json({ success: false, message: 'No OTP found for this email' });
    }
    // 5 min expiry
    if (record.otp === otp && Date.now() - record.timestamp < 5 * 60 * 1000) {
        delete otpStore[email];
        return res.json({ success: true, message: 'OTP verified' });
    } else {
        return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }
});

// --- Health Check ---
app.get('/', (req, res) => {
    res.send('✅ SSLCommerz + OTP backend is running!');
});

// --- Start Server ---
const PORT = process.env.PORT || 3030;
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
