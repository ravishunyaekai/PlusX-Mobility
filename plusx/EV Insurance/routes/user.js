import multer from "multer";

import { handleFileUpload } from "../../../fileUpload.js";
import { apiAuthentication } from "../../../middleware/apiAuthenticationMiddleware.js";
import { apiAuthorization } from "../../../middleware/apiAuthorizationMiddleware.js";
import { getTokenPolicyBazar } from "../controller/api/PolicyBazarController.js";
import { addInsurance, insuranceList, insuranceDetails, evPreSaleBooking, evPreSaleList, evPreSaleDetails, preSaleSlotList } from '../controller/api/EvInsuranceController.js';

import { Router } from "express";
const router = Router();
const authzRoutes = [
     { method: 'post', path: '/create-quote',          handler: getTokenPolicyBazar },
];

authzRoutes.forEach(({ method, path, handler }) => {
    
    const middlewares = [apiAuthorization];  // rateLimit
    
    
    router[method](path, ...middlewares, handler);
});


const authzAndAuthRoutes = [
    /* EV Insurance */
    { method: 'post', path: '/add-insurance',          handler: addInsurance},
    { method: 'post', path: '/insurance-list',         handler: insuranceList },
    { method: 'post', path: '/insurance-details',      handler: insuranceDetails },
    { method: 'post', path: '/ev-pre-sale-testing',    handler: evPreSaleBooking },
    { method: 'get',  path: '/ev-pre-sale-list',       handler: evPreSaleList },
    { method: 'get',  path: '/ev-pre-sale-detail',     handler: evPreSaleDetails },
    { method: 'post', path: '/ev-pre-sale-slot-list',  handler: preSaleSlotList },

]


const uploadRules = {//rider_profile
       '/add-insurance'         : { folder: 'insurance-images',    fields: ['prev_insurance', 'driving_licence', 'emirates_id','claim_letter_image','old_insurance_image'], maxCount: 6 },
};

authzAndAuthRoutes.forEach(({ method, path, handler }) => {
    const middlewares = []; 

    const rule = uploadRules[path];
    if (rule) {
        middlewares.push(handleFileUpload(rule.folder, rule.fields, rule.maxCount));

    } else if(path === '/ev-pre-sale-testing' || path === '/board-vote-edit'){
        const noUpload1 = multer(); middlewares.push(noUpload1.none()); 
    }
    middlewares.push(apiAuthorization);
    middlewares.push(apiAuthentication);
    router[method](path, ...middlewares, handler);
});


export default router;