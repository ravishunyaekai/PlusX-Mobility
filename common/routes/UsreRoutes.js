
import { Router } from "express";
import { deleteExceptGivenImages, handleFileUpload, listImagesFromS3 } from "../../fileUpload.js";
// import multer from "multer";
import { apiAuthorization } from '../../middleware/apiAuthorizationMiddleware.js';
import { apiAuthentication } from '../../middleware/apiAuthenticationMiddleware.js';

import { 
    register, forgotPassword, createOTP, verifyOTP, home, getRiderData,  deleteImg, logout, updatePassword, responseContent, countryList, stateCountry, updateProfile, deleteAccount, redeemCoupon, notificationList, uploadSImage, regsCreateOTP 
} from "../controller/UserController.js";

import rateLimit from 'express-rate-limit';
import { loggercheck } from "../controller/LoggerDownloadController.js";

const router = Router();

const limiter = rateLimit({
    windowMs     : 70 * 1000,  //15 * 
    max          : 4,
    keyGenerator : (req) => req.body.device_id || req.ip, //req.headers['device_id'] || req.ip,
    handler      : (req, res, next, options) => {
        // console.log(req.body.device_id || req.ip);
        console.error('Rate limit exceeded:', req.body.device_id || req.ip);
        return res.json({ status : 0, code : options.statusCode, message : [`You have already requested the OTP twice. Please wait for 1 minutes before trying again.`,  ]});
    },
});

/* -- Api Auth Middleware -- */
const authzRoutes = [
    
    { method: 'get',  path: '/images-list',       handler: listImagesFromS3 },
    { method: 'get',  path: '/delete-image-s3',   handler: deleteExceptGivenImages },
    { method: 'get',  path: '/logger-check',      handler: loggercheck },
    { method: 'get',  path: '/response-content',  handler: responseContent },
    { method: 'get',  path: '/state-city-list',   handler:stateCountry },
    { method: 'post', path: '/create-otp',        handler: createOTP},
    { method: 'post', path: '/verify-otp',        handler: verifyOTP},
    { method: 'post', path: '/registration',      handler: register}, 
    { method: 'get',  path: '/country-list',      handler: countryList},
    { method: 'post', path: '/regs-create-otp',   handler: regsCreateOTP},
];
authzRoutes.forEach(({ method, path, handler }) => {
    // rateLimit
    const middlewares = [apiAuthorization];
    
    if(path === '/registration'){
        middlewares.push(handleFileUpload('student_id_image', ['id_image'],1));
    }
    if(path === '/create-otp' || path === '/regs-create-otp' ){
        middlewares.push(limiter); 
    }
    router[method](path, ...middlewares, handler);
});
/* -- Api Auth & Api Authz Middleware -- */
const authzAndAuthRoutes = [
    { method: 'post', path: '/upload-s3-image',       handler: uploadSImage },
    { method: 'post', path: '/rider-profile-change',  handler: updateProfile },
    
    { method: 'get',  path: '/rider-profile-image-delete', handler: deleteImg },
    { method: 'get',  path: '/rider-account-delete',       handler: deleteAccount },
    { method: 'post', path: '/rider-logout',               handler: logout },  
    { method: 'post', path: '/rider-forgot_password',      handler: forgotPassword},

    { method: 'get',  path: '/rider-home',                 handler: home },
    { method: 'get',  path: '/get-rider-data',             handler: getRiderData },
    { method: 'get',  path: '/rider-notification-list',    handler: notificationList },
    { method: 'post', path: '/rider-change_password',      handler: updatePassword },
];
authzAndAuthRoutes.forEach(({ method, path, handler }) => {
    const middlewares = []; 
    if(path === '/rider-profile-change'){
        middlewares.push(handleFileUpload('profile-image', ['profile_image'],1));
    }
    else if(path === '/upload-s3-image'){
        
        middlewares.push(handleFileUpload('charger-installation', ['image'],1));
    }
    middlewares.push(apiAuthorization);
    middlewares.push(apiAuthentication);
    router[method](path, ...middlewares, handler);
});
router.post('/validate-coupon', redeemCoupon);

export default router;