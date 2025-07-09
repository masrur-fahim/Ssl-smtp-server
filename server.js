const express = require('express');
const SSLCommerzPayment = require('sslcommerz-lts');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());
app.use(cors());

// --- Config ---
const store_id = 'algor685c511224e18';
const store_passwd = 'algor685c511224e18@ssl';
const is_live = false; // true when you go live

// Your Render backend URL
const backendBaseUrl = 'https://ssl-smtp-server.onrender.com';
// If you know your frontend Render URL, replace below
const frontendBaseUrl = 'http://ug2002016.cse.pstu.ac.bd/';

// --- Initiate payment session ---
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

    console.log('Initiating payment with data:', JSON.stringify(orderData, null, 2));

    try {
        const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
        const apiResponse = await sslcz.init(orderData);
        console.log('SSLCommerz response:', apiResponse);

        if (apiResponse.GatewayPageURL) {
            res.json({ success: true, GatewayPageURL: apiResponse.GatewayPageURL });
        } else {
            console.error('No GatewayPageURL:', apiResponse);
            res.status(400).json({ success: false, error: apiResponse.failedreason || 'GatewayPageURL missing' });
        }
    } catch (err) {
        console.error('SSLCommerz error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- Validate payment ---
app.post('/api/validate-payment', async (req, res) => {
    const { val_id } = req.body;
    try {
        const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
        const data = await sslcz.validate({ val_id });
        res.json(data);
    } catch (err) {
        console.error('Validation error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- Test SSLCommerz gateway directly ---
app.get('/test-ssl-gateway', (req, res) => {
    const data = {
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
    sslcz.init(data).then(apiResponse => {
        if (apiResponse.GatewayPageURL) {
            console.log('Redirecting to:', apiResponse.GatewayPageURL);
            res.redirect(apiResponse.GatewayPageURL);
        } else {
            res.send('Failed to get GatewayPageURL: ' + JSON.stringify(apiResponse));
        }
    }).catch(err => {
        res.send('Error: ' + err.message);
    });
});

// --- Send OTP email ---
app.post('/api/send-otp', async (req, res) => {
    try {
        const { to, otp, type, userType, emailConfig } = req.body;
        console.log(`Sending OTP to: ${to} | type: ${type} | userType: ${userType}`);

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: emailConfig.auth.user,
                pass: emailConfig.auth.pass
            }
        });

        const actionText = type === 'signin' ? 'Sign In' : 'Account Registration';
        const accountType = userType === 'farmer' ? 'Farmer' : 'Customer';

        const html = `
            <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto; padding:20px;">
                <h2 style="color:#2c5530; text-align:center;">${actionText} Verification</h2>
                <p>Hello ${accountType},</p>
                <p>Your verification code is:</p>
                <h1 style="color:#2c5530; text-align:center;">${otp}</h1>
                <p>This code will expire in 5 minutes.</p>
                <p style="font-size:12px; color:#888;">If you didn't request this, please ignore this email.</p>
            </div>`;

        const mailOptions = {
            from: `"Next Gen Farm" <${emailConfig.auth.user}>`,
            to,
            subject: `Next Gen Farm - ${actionText} Verification Code`,
            html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);
        res.json({ success: true, messageId: info.messageId });
    } catch (err) {
        console.error('Error sending email:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- Health check ---
app.get('/', (req, res) => {
    res.send('✅ SSLCommerz & OTP backend running on Render!');
});

// --- Start server ---
const PORT = process.env.PORT || 3030;
app.listen(PORT, () => {
    console.log(`✅ Server running on Render: ${backendBaseUrl} (port ${PORT})`);
});
