
import { Router } from "express";
import { handleFileUpload } from "../../../fileUpload.js";
import multer from "multer";
import { apiAuthorization } from '../../../middleware/apiAuthorizationMiddleware.js';
import { apiAuthentication } from '../../../middleware/apiAuthenticationMiddleware.js';
//
import { 
    chargerList, chargerBooking, chargerBookingList,chargerBookingDetail,  getPcSlotList, getPcSubscriptionList, userCancelPCBooking,
    reScheduleBooking, userFeedbackPCBooking, getPcSlotDateList,
    podInvoiceDetails
} from '../controller/user/PortableChargerController.js';
import rateLimit from 'express-rate-limit';
import { portableChargerInvoice } from "../controller/user/InvoiceController.js";
const router = Router();

// const limiter = rateLimit({
//     windowMs     : 70 * 1000,  //15 * 
//     max          : 4,
//     keyGenerator : (req) => req.body.device_id || req.ip, //req.headers['device_id'] || req.ip,
//     handler      : (req, res, next, options) => {
//         // console.log(req.body.device_id || req.ip);
//         console.error('Rate limit exceeded:', req.body.device_id || req.ip);
//         return res.json({ status : 0, code : options.statusCode, message : [`You have already requested the OTP twice. Please wait for 1 minutes before trying again.`,  ]});
//     },
// });

/* -- Api Auth Middleware -- */
const authzRoutes = [
    /* API Routes */
    
    /* Dynamic List */
   
    
];
authzRoutes.forEach(({ method, path, handler }) => {
    
    const middlewares = [apiAuthorization];  // rateLimit
    
    
    router[method](path, ...middlewares, handler);
});

/* -- Api Auth & Api Authz Middleware -- */
const authzAndAuthRoutes = [
    
   /* Portable charger */
    { method: 'get',  path: '/portable-charger-list',            handler: chargerList },
    { method: 'post', path: '/portable-charger-booking',         handler: chargerBooking },
        { method: 'post', path: '/create-portable-charger-invoice',     handler: portableChargerInvoice },
    { method: 'get',  path: '/portable-charger-booking-list',    handler: chargerBookingList },
    { method: 'get',  path: '/portable-charger-booking-detail',  handler: chargerBookingDetail },
    { method: 'get',  path: '/portable-charger-slot-list',       handler: getPcSlotList },
    { method: 'get',  path: '/portable-charger-subscription',    handler: getPcSubscriptionList },
    { method: 'get',  path: '/portable-charger-cancel',          handler: userCancelPCBooking }, 
    { method: 'post', path: '/reschedule-portable-charger-booking', handler: reScheduleBooking },
    { method: 'post', path: '/feedback-portable-charger-booking', handler: userFeedbackPCBooking },
    { method: 'get',  path: '/portable-charger-slot-date-list',     handler: getPcSlotDateList },
     { method: 'get',  path: '/portable-charger-invoice',            handler: podInvoiceDetails },

];

// Define your upload rules in a config map
const uploadRules = {//rider_profile
   
   
};
authzAndAuthRoutes.forEach(({ method, path, handler }) => {
    const middlewares = []; 

    const rule = uploadRules[path];
    if (rule) {
        middlewares.push(handleFileUpload(rule.folder, rule.fields, rule.maxCount));

    } 
    middlewares.push(apiAuthorization);
    middlewares.push(apiAuthentication);
    router[method](path, ...middlewares, handler);
});

export default router;