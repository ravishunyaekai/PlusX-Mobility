
import mqtt from 'mqtt';
import express from 'express';
import bodyParser from 'body-parser';
import mobilityAdminRoutes from './mobility/routes/admin.js';
import plusxdriverRoutes from './plusx/driver/routes/driver.js';
  
import homeChargeradminRoute from './plusx/home Charging/routes/admin.js' 
import homeChargerUserRoutes from './plusx/home Charging/routes/user.js'

import mobilityApiRoutes from './mobility/routes/user.js';

import plusxAdminRoutes from './plusx/routes/admin.js';
import plusxUserRoutes from './plusx/routes/user.js';

import commonUserRoutes from './common/routes/UsreRoutes.js';
import commonAdminRoutes from './common/routes/adminRoutes.js';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { errorHandler } from './middleware/errorHandler.js';
import dotenv from 'dotenv';
dotenv.config();
import cron from 'node-cron';

const app  = express();

const PORT = process.env.PORT || 3333;

import { Server } from 'socket.io'; 
import http from 'http';
// import { testFunction } from './plusx/controller/TestController.js';
// import mqqtClient from './mqtt/index.js';
import { razorpayWebhook } from './common/controller/webhookController.js';
// import { CronjobRsaInvoice, failedRSABooking } from './plusx/cronjobController.js';
// import { cronjobAddMoney, mobilitynotification } from './mobility/controller/user/cronjobController.js';
// import { failedPODBooking } from './plusx/home Charging/controller/user/PortableChargerController.js';
 import {  deductOutstandingAmount } from './mobility/controller/user/cronjobController.js';

import { payWithSavedCard } from './mobility/controller/razorpay/razorpay.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const corsOptions = {
    origin : [
        'http://localhost:2425',
        'https://plusxmobility.shunyaekai.com',
        'https://swapping.shunyaekai.com',
    ],
    methods: 'GET, POST, PUT, DELETE',
    credentials: true
};
// cron.schedule('*/6 * * * *', async () => {
//     await failedRSABooking(); 
//     await failedPODBooking()
//     console.log('This runs every 1 minutes', new Date().toISOString());
// });
// cron.schedule('* * * * *', async () => {
//     await mobilitynotification();
// });

//Every 5 minutes
// cron.schedule('*/5 * * * *', async () => {

//     console.log('Outstanding deduction cron started');

//     try {

//         await deductOutstandingAmount();

//     } catch (error) {

//         console.log('Cron Error:', error.message);

//     }

// });

app.use(cors(corsOptions));
app.post("/razorpay/webhook",  bodyParser.raw({ type: "application/json" }), razorpayWebhook);
app.post("/pay-with-saved-card",  bodyParser.raw({ type: "application/json" }), payWithSavedCard);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());


// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
  
app.use('/api', mobilityApiRoutes);
app.use('/admin', mobilityAdminRoutes);
app.use('/driver', plusxdriverRoutes);

app.use('/api', plusxUserRoutes);
app.use('/admin', plusxAdminRoutes);
app.use('/admin', homeChargeradminRoute);
app.use('/api', homeChargerUserRoutes);

app.use('/api', commonUserRoutes);
app.use('/admin', commonAdminRoutes);

app.use(errorHandler);

// Socket Code Here 
// Socket Code Here 
const server = http.createServer(app);

export const io = new Server(server, {
    cors : corsOptions,
});

// React build
app.use(express.static(path.join(__dirname, 'build')));
app.get('/*', function (req, res) {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

server.listen(PORT, () => {
    console.log(` Server is running on http://localhost:${PORT}`);
});

//mqqt code 
const client = mqtt.connect(process.env.MQTT_URL, {
    clientId  : process.env.MQTT_CILENT_ID,
    username  : process.env.MQTT_USERNAME,
    password  : process.env.MQTT_PASSWORD,
    keepalive : 3600,  // auto reconnect every 5 sec
    will: {
        topic   : 'device/status',
        payload : 'offline',
        retain  : true
    }
});

client.on('connect', () => {
    console.log('mqtt Connected');
    client.publish('device/status', 'online', { retain: true });
    client.subscribe('device/cmd');
});

client.on('message', (topic, msg) => {
  console.log(topic, msg.toString());
});

client.on('reconnect', () => console.log('Reconnecting...'));
client.on('close', () => console.log('Disconnected'));
client.on('error', err => console.log('Error', err.message));

export default client;
