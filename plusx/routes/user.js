
import { Router } from "express";
import { handleFileUpload } from "../../fileUpload.js";
import multer from "multer";
import { apiAuthorization } from '../../middleware/apiAuthorizationMiddleware.js';
import { apiAuthentication } from '../../middleware/apiAuthenticationMiddleware.js';
//

import { clubList, clubDetail } from '../controller/api/ClubController.js';
import { shopList, shopDetail } from '../controller/api/ShopController.js';
import { offerList, offerDetail, offerHistory } from '../controller/api/OfferController.js';
import {  createIntent, createPortableChargerSubscription, addCardToCustomer, customerCardsList, removeCard, autoPay, getPaymentSession, savedcardPayment  } from '../controller/PaymentController.js';
import { carList, carDetail } from '../controller/api/ElectricCarRentalController.js';
import { bikeList, bikeDetail } from '../controller/api/ElectricBikeRentalController.js';
import { stationList, stationDetail, nearestChargerList } from '../controller/api/ChargingStationController.js';
import { serviceRequest, requestList, requestDetails, evChargerList, accessoriesList, evchargerDetails, purchaseHistoryList, purchaseHistoryDetails } from '../controller/api/ChargingInstallationServiceController.js';
import { rsaInvoice,  chargerInstallationInvoice } from '../controller/InvoiceController.js';


import { 
 locationList, locationAdd,  
    addRiderAddress, riderAddressList, deleteRiderAddress, addRiderVehicle
     ,editRiderVehicle, riderVehicleList, deleteRiderVehicle, editRiderAddress, 
     defaultAddress, defaultVehicle
} from "../controller/api/RiderController.js";
import {
    addRoadAssistance, roadAssistanceList, roadAssistanceDetail, roadAssistanceInvoiceList, roadAssistanceInvoiceDetail, userFeedbacRSABooking 
} from '../controller/api/RoadAssistanceController.js';
import { 
    addDiscussionBoard, getDiscussionBoardList, getDiscussionBoardDetail, addComment, replyComment, boardLike, boardView, boardShare, votePoll, reportOnBoard, 
    boardNotInterested, boardDelete, editBoard, editPoll, deleteComment, deleteReplyComment, commentLike, replyCommentLike
} from '../controller/api/DiscussionBoardController.js';

import {vehicleList, vehicleDetail, interestedPeople, areaList, sellVehicle, allSellVehicleList, sellVehicleList,
    sellVehicleDetail, updateSellVehicle, deleteSellVehicle, soldSellVehicle, reminder_sell_vehicle_list, vehicleModelList, vehicleBrandList, updateSellVehicleImg, dubaiAreaList
} from '../controller/api/VehicleController.js';



import rateLimit from 'express-rate-limit';
import { addChargShare, chargeShareDetail, chargeShareList, chargeshareForMap, outputAndConnector ,chargeShareDelete,editChargShare} from "../controller/api/ChargeShareController.js";
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
    /* API Routes */
    
    /* Dynamic List */
    {method: 'get', path: '/location-list', handler: locationList},
    {method: 'get', path: '/location-add', handler: locationAdd},

    
    /* Vehicle Routes */
    { method: 'get',  path: '/location-area-list',         handler: areaList },
    { method: 'get',  path: '/reminder-sell-vehicle-list', handler: reminder_sell_vehicle_list },
    { method: 'post', path: '/vehicle-brand-list',         handler: vehicleBrandList },
    { method: 'post', path: '/vehicle-model-list',         handler: vehicleModelList },
    // { method: 'get',  path: '/dubai-area-list',            handler: dubaiAreaList },
    { method: 'get',  path: '/output-power-and-connector-list', handler: outputAndConnector },
    
];
authzRoutes.forEach(({ method, path, handler }) => {
    
    const middlewares = [apiAuthorization];  // rateLimit
    
    
    router[method](path, ...middlewares, handler);
});

/* -- Api Auth & Api Authz Middleware -- */
const authzAndAuthRoutes = [
    
    { method: 'post', path: '/rider-address-add',          handler: addRiderAddress },
    { method: 'get',  path: '/rider-address-list',         handler: riderAddressList },
    { method: 'post', path: '/rider-address-edit',          handler: editRiderAddress },
    { method: 'get',  path: '/rider-address-delete',       handler: deleteRiderAddress },
    { method: 'post', path: '/rider-vehicle-add',          handler: addRiderVehicle },
    { method: 'post', path: '/rider-vehicle-edit',         handler: editRiderVehicle },
    { method: 'get',  path: '/rider-vehicle-list',         handler: riderVehicleList },
    { method: 'get',  path: '/rider-vehicle-delete',       handler: deleteRiderVehicle },
    { method: 'post', path: '/rider-address-default',      handler: defaultAddress },
    { method: 'post', path: '/rider-vehicle-default',      handler: defaultVehicle },

    /* Public Charging Station */
    { method: 'get', path: '/charging-station-list',         handler: stationList },
    { method: 'get', path: '/nearest-charging-station-list', handler: nearestChargerList },
    { method: 'get', path: '/charging-station-detail',       handler: stationDetail },

    

    /* Road Assistance Routes */
    { method: 'post', path: '/road-assistance',                handler: addRoadAssistance },
    { method: 'get',  path: '/road-assistance-list',           handler: roadAssistanceList },
    { method: 'get',  path: '/road-assistance-details',        handler: roadAssistanceDetail },
    { method: 'get',  path: '/road-assistance-invoice-list',   handler: roadAssistanceInvoiceList },
    { method: 'get',  path: '/road-assistance-invoice-detail', handler: roadAssistanceInvoiceDetail },
    { method: 'post', path: '/feedback-road-assistance',       handler: userFeedbacRSABooking },
    /*
    { method: 'post',   path: '/road-assistance-slot-list',               handler: rsaSlotList },
    { method: 'post',   path: '/road-assistance-slot-details',            handler: rsaSlotDetails },
    { method: 'post',   path: '/road-assistance-add-time-slot',           handler: rsaSlotAdd },
    { method: 'post',   path: '/road-assistance-edit-time-slot',          handler: rsaSlotEdit },
    { method: 'post',   path: '/road-assistance-delete-time-slot',        handler: rsaDeleteSlot },
    */

    /* Installation Service Routes */
    { method: 'post', path: '/charging-installation-service',  handler: serviceRequest },
    { method: 'get',  path: '/charging-installation-list',     handler: requestList },
    { method: 'get',  path: '/charging-installation-detail',   handler: requestDetails },

    /* Club Routes */
   

    /* Vehicle Routes */
    { method: 'get',  path: '/vehicle-list',          handler: vehicleList },
    { method: 'get',  path: '/vehicle-detail',        handler: vehicleDetail },
    { method: 'post', path: '/interest-register',     handler: interestedPeople },
    { method: 'post', path: '/sell-vehicle',          handler: sellVehicle },
    { method: 'get',  path: '/all-sell-vehicle-list', handler: allSellVehicleList },
    { method: 'get',  path: '/sell-vehicle-list',     handler: sellVehicleList },
    { method: 'get',  path: '/sell-vehicle-details',  handler: sellVehicleDetail },
    { method: 'post', path: '/edit-sell-vehicle',     handler: updateSellVehicle },
    { method: 'post', path: '/edit-sell-vehicle-img', handler: updateSellVehicleImg },
    { method: 'get',  path: '/delete-sell-vehicle',   handler: deleteSellVehicle },
    { method: 'get',  path: '/sold-sell-vehicle',     handler: soldSellVehicle },

   

   

    /* Offer Routes */
    { method: 'get', path: '/offer-list',   handler: offerList },
    { method: 'get', path: '/offer-detail', handler: offerDetail },
    { method: 'post', path: '/create-offer-history', handler: offerHistory },
    

   

    /* Payment */
    { method: 'post', path: '/payment-intent',                       handler: createIntent },
   
    
    /* Invoice */ 
    { method: 'post', path: '/create-rsa-invoice',                  handler: rsaInvoice },
    
    { method: 'get',  path: '/ev-charger-list', handler: evChargerList },
    { method: 'get',  path: '/accessories-list', handler: accessoriesList },
    { method: 'get',  path: '/ev-charger-details', handler: evchargerDetails },
    // purchase-history
    { method: 'get',  path: '/purchase-history-list',   handler: purchaseHistoryList },
    { method: 'get',  path: '/purchase-history-details', handler: purchaseHistoryDetails },
    //charge-share
    //add-charge-share
    { method: 'post',  path: '/add-charge-share', handler: addChargShare },
    { method: 'post',  path: '/charge-share-edit', handler: editChargShare },
    
    { method: 'get',  path: '/charge-share-list', handler: chargeShareList },
    { method: 'post',  path: '/charge-share-delete', handler: chargeShareDelete },


    //chargeShareDetail
    { method: 'get',  path: '/charge-share-detail', handler: chargeShareDetail },
    { method: 'get', path: '/charge-share-for-map', handler: chargeshareForMap },





];

// Define your upload rules in a config map
const uploadRules = {//rider_profile
   
    '/sell-vehicle'          : { folder: 'vehicle-image', fields: ['car_images', 'car_tyre_image', 'other_images', 'image'], maxCount: 5 },
    '/edit-sell-vehicle'     : { folder: 'vehicle-image', fields: ['car_images', 'car_tyre_image', 'other_images', 'image'],   maxCount: 5 },
    '/edit-sell-vehicle-img' : { folder: 'vehicle-image', fields: ['car_images', 'car_tyre_image', 'other_images', 'image'],   maxCount: 5 },

    '/add-discussion-board'  : { folder: 'discussion-board-images',     fields: ['image'],  maxCount: 5 },
    '/discussion-board-edit' : { folder: 'discussion-board-images',     fields: ['image'],   maxCount: 5 },
    
     '/add-charge-share'  : { folder: 'charge-share-images', fields: ['charger_image'], maxCount: 1 },   
     '/charge-share-edit'  : { folder: 'charge-share-images', fields: ['charger_image'], maxCount: 1 },   

      
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