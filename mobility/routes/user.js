
import { Router } from "express";
import { apiAuthorization } from '../../middleware/apiAuthorizationMiddleware.js';
import { apiAuthentication } from '../../middleware/apiAuthenticationMiddleware.js';

import {bookingList, cycleBookingDetail, routeLogs, fetchRouteLogs} from "../controller/user/RiderController.js";

import {
    startScanCycleQr, stopeRide, startScanLocker, completeCycleQr, completeLockerQr, lockerAvailable, lockerUpdate, manualRideCreateOTP, nearByStaionLocker, manualVerifyOTP, startBooking, havingIssueBooking, feedbackBooking, stationLockerUpdate
} from "../controller/user/BookingController.js";

import { cycleStationDetails, cycleStationList, nearByStaion, nearByStaionDetails } from "../controller/user/MobilityStationController.js";

import { cycleList } from "../controller/user/CycleController.js";

import { addCardToCustomer, addmoneyINWallet,  addMoneyForCycleBooking, createOrder, deleteCard, Paymentsucceed, razorpaycardList, saveCardToken } from "../controller/razorpay/razorpay.js";

import { userTransactionList } from "../controller/user/ContentController.js";

const router = Router();
 
const authzAndAuthRoutes = [

    { method: 'get',  path: '/cycle-station-list',                 handler: cycleStationList},    
    { method: 'get',  path: '/cycle-station-details',              handler: cycleStationDetails },
    { method: 'get',  path: '/station-list-near-user',             handler: nearByStaion },
    { method: 'get',  path: '/station-details-near-user',          handler: nearByStaionDetails },
    { method: 'post', path: '/create-route-logs',                  handler: routeLogs },
    { method: 'get',  path: '/fetch-route-logs',                   handler: fetchRouteLogs },
    { method: 'post', path: '/start-scan-cycle-qr',                handler: startScanCycleQr }, 
    { method: 'post', path: '/start-scan-locker-qr',               handler: startScanLocker },
    { method: 'post', path: '/start-cycle-booking',                handler: startBooking },  
    { method: 'post', path: '/stop-ride',                          handler: stopeRide },
    { method: 'post', path: '/complete-cycle-qr',                  handler: completeCycleQr },
    { method: 'post', path: '/check-locker-availability',          handler: lockerAvailable }, 
    { method: 'post', path: '/complete-locker-qr',                 handler: completeLockerQr },
    { method: 'get',  path: '/cycle-booking-list',                 handler: bookingList },
    { method: 'get',  path: '/cycle-booking-details',              handler: cycleBookingDetail },
    { method: 'post', path: '/add-money-in-wallet',                handler: addmoneyINWallet },
    { method: 'post', path: '/add-money-for-cycle-booking',        handler: addMoneyForCycleBooking },  
    { method: 'post', path: '/payment-success',                    handler: Paymentsucceed }, 
    { method: 'post', path: '/create-razorapay-order',             handler: createOrder},
    { method: 'post', path: '/add-card',                           handler: addCardToCustomer },
    { method: 'post', path: '/save-card',                          handler: saveCardToken },
    { method: 'get',  path: '/card-list',                          handler: razorpaycardList }, 
    { method: 'post', path: '/remove-card',                        handler: deleteCard }, 

    // manual locker hander process
    { method: 'get', path: '/near-by-station-locker',  handler: nearByStaionLocker},
    { method: 'post', path: '/manual-ride-create-otp', handler: manualRideCreateOTP },
    { method: 'post', path: '/verify-manual-otp',      handler: manualVerifyOTP },
    { method: 'get', path: '/cycle-list',              handler: cycleList },

    { method: 'post', path: '/transaction-list',        handler: userTransactionList },
    { method: 'post', path: '/cycle-booking-issue',     handler: havingIssueBooking },
    { method: 'post', path: '/cycle-booking-feedback',  handler: feedbackBooking },
];
authzAndAuthRoutes.forEach(({ method, path, handler }) => {
    const middlewares = []; 
    middlewares.push(apiAuthorization);
    middlewares.push(apiAuthentication);
    router[method](path, ...middlewares, handler);
});
const authzRoutes = [
    { method: 'post', path: '/locker-update', handler: lockerUpdate },
    { method: 'post', path: '/station-locker-update',   handler: stationLockerUpdate },

];
authzRoutes.forEach(({ method, path, handler }) => {
    const middlewares = [apiAuthorization];
    router[method](path, ...middlewares, handler);
});
export default router;