import { Router } from "express";
import {  authenticateAdmin } from "../../../middleware/admin/authenticationMiddleware.js";

import { adminAuthorization } from "../../../middleware/admin/authorizeMiddleware.js";

import { chargerList, addCharger, editCharger, deleteCharger, chargerBookingList, chargerBookingDetails, assignBooking, chargerDetails, invoiceList,invoiceDetails, slotList, addSlot, editSlot, deleteSlot, slotDetails, subscriptionList, subscriptionDetail, adminCancelPCBooking, customerChargerBookingList, failedChargerBookingList, failedchargerBookingDetails
} from "../controller/admin/PortableChargerController.js";
import { handleFileUpload } from "../../../fileUpload.js";
import { donwloadPodBookingList, donwloadUserList } from "../../controller/ExportController.js";
import { addPodArea, addPodBrand, addPodDevice, AllpodArea, AllpodDevice, assignPodDeviceArea, deletePodDevice, deviceBrandList, editPodArea, editPodDevice, podAreaAssignList, podAreaBookingList, podAreaDetails, podAreaInputList, podAreaList, podBrandList, podDeviceDetails, podDeviceList, podDeviceStatusChange } from "../../controller/admin/PodDeviceController.js";

const router = Router();

const adminAuthRoutes = [

    { method: 'get',  path: '/pod-booking-list-download', handler: donwloadPodBookingList },
    { method: 'get',  path: '/user-signup-list-download', handler: donwloadUserList },
]
adminAuthRoutes.forEach(({ method, path, handler }) => {
    router[method](path, adminAuthorization, handler);
});

const adminRoutes = [

  /* Portable Charger */ 
    { method: 'post',   path: '/charger-list',                    handler: chargerList },
    { method: 'post',   path: '/charger-details',                 handler: chargerDetails },
    { method: 'post',   path: '/add-charger',                     handler: addCharger },
    { method: 'post',   path: '/edit-charger',                    handler: editCharger },
    { method: 'post',   path: '/delete-charger',                  handler: deleteCharger },
    { method: 'post',   path: '/charger-booking-list',            handler: chargerBookingList },
    { method: 'post',   path: '/charger-booking-details',         handler: chargerBookingDetails },
    { method: 'post',   path: '/charger-booking-invoice-list',    handler: invoiceList },
    { method: 'post',   path: '/charger-booking-invoice-details', handler: invoiceDetails },
    { method: 'post',   path: '/charger-booking-assign',          handler: assignBooking },
    { method: 'post',   path: '/charger-slot-list',               handler: slotList },
    { method: 'post',   path: '/charger-slot-details',            handler: slotDetails },
    { method: 'post',   path: '/charger-add-time-slot',           handler: addSlot },
    { method: 'post',   path: '/charger-edit-time-slot',          handler: editSlot },
    { method: 'post',   path: '/charger-delete-time-slot',        handler: deleteSlot },
    { method: 'post',   path: '/customer-charger-booking-list',   handler: customerChargerBookingList },
    { method: 'post',   path: '/failed-charger-booking-list',     handler: failedChargerBookingList },
    { method: 'post',   path: '/failed-charger-booking-details',  handler: failedchargerBookingDetails },
   /* POD Device Routes */ 
    { method: 'post',  path: '/pod-device-list',            handler: podDeviceList },
    { method: 'post',  path: '/pod-device-add',             handler: addPodDevice },
    { method: 'post',  path: '/pod-device-details',         handler: podDeviceDetails },
    { method: 'post',  path: '/pod-device-update',          handler: editPodDevice },
    { method: 'post',  path: '/pod-device-delete',          handler: deletePodDevice },
    { method: 'post',  path: '/pod-device-status-change',   handler: podDeviceStatusChange },
   
    /* POD Device Brand Routes */
    { method: 'post',  path: '/all-pod-device',             handler: AllpodDevice},
    { method: 'post',  path: '/pod-brand-list',             handler: podBrandList },
    { method: 'post',  path: '/add-pod-brand',              handler: addPodBrand },
    { method: 'post',  path: '/pod-brand-details',          handler: podDeviceDetails },
    { method: 'post',  path: '/edit-pod-brand',             handler: editPodDevice },
    { method: 'post',  path: '/pod-brand-delete',           handler: deletePodDevice },
    { method: 'post',  path: '/device-brand-list',          handler: deviceBrandList },

    /* POD Area Routes */
    { method: 'post',  path: '/pod-area-list',            handler: podAreaList },
    { method: 'post',  path: '/pod-area-add',             handler: addPodArea },
    { method: 'post',  path: '/pod-area-details',         handler: podAreaDetails },
    { method: 'post',  path: '/pod-area-update',          handler: editPodArea },
    // { method: 'post',  path: '/pod-device-delete',     handler: deletePodDevice },
    { method: 'post',  path: '/all-pod-area',             handler: AllpodArea},
    { method: 'post',  path: '/pod-assign-area',          handler: assignPodDeviceArea},
    { method: 'post',  path: '/pod-assign-area-list',     handler: podAreaAssignList},
    { method: 'post',  path: '/pod-output-history',      handler: podAreaInputList},
    { method: 'post',  path: '/pod-booking-history',     handler: podAreaBookingList},

    
   
];

// Define your upload rules in a config map
const uploadRules = {
   
    // '/ev-accessories-edit': { folder: 'charger-installation', fields: ['charger_image', 'specification_pdf', 'charger_gallery'], maxCount: 2},
    '/add-charger'  : { folder: 'charger-images', fields: ['charger_image'],               maxCount: 1 },
    '/edit-charger' : { folder: 'charger-images', fields: ['charger_image'],               maxCount: 1 },
    '/add-pod-brand'      : { folder: 'pod-brand-images',   fields: ['brand_image'],                    maxCount: 1 },
};
adminRoutes.forEach(({ method, path, handler }) => {
    const middlewares = [adminAuthorization];

    // Apply middleware based on current path
    const rule = uploadRules[path];
    if (rule) {
      
        middlewares.push(handleFileUpload(rule.folder, rule.fields, rule.maxCount));
    }
    middlewares.push(authenticateAdmin);
    // middlewares.push(authenticate);

    router[method](path, ...middlewares, handler);
});
export default router;