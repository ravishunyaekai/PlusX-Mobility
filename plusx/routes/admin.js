import { Router } from "express";
import { authenticate, authenticateAdmin } from "../../middleware/admin/authenticationMiddleware.js";

import { adminAuthorization } from "../../middleware/admin/authorizeMiddleware.js";
// import { login, logout, forgotPassword, updatePassword } from "../controller/admin/AuthController.js";
import { getDashboardData, riderList, riderDetails, deleteRider, notificationList, locationList, areaList, deletedRiderList, bookingAreaList } from "../controller/admin/AdminController.js";
import {
    chargerList, addCharger, editCharger, deleteCharger, chargerBookingList, chargerBookingDetails, assignBooking, chargerDetails, invoiceList, invoiceDetails, slotList, addSlot, editSlot, deleteSlot, slotDetails, subscriptionList, subscriptionDetail, adminCancelPCBooking, customerChargerBookingList, failedChargerBookingList, failedchargerBookingDetails
} from "../controller/admin/PortableChargerController.js";
import { handleFileUpload } from "../../fileUpload.js";
import {
    bookingDetails, bookingList, pdAddSlot, pdDeleteSlot, pdEditSlot, pdInvoiceDetails, pdInvoiceList, pdSlotList, PodAssignBooking as pdAssignBooking, pdSlotDetails,
    adminCancelCSBooking, failedBookingList, failedbookingDetails
} from "../controller/admin/PickAndDropController.js";
import { addPublicCharger, editPublicCharger, stationDetail, stationList, deletePublicCharger, deletePublicChargerGallery, stationData } from "../controller/admin/PublicChargerController.js";
import { riderDetailsElectricDB } from "../../mobility/controller/admin/UserController.js";

import { chargerInstallationDetails, chargerInstallationList, eVChargerAdd, eVChargerList, chargerBrandList, chargerBrandCreate, chargerBrandUpdate, allChargerBrand, evChargerDetails, eVChargerEdit, AccessoriesAdd, AccessoriesList, AccessoriesDetails, AccessoriesEdit, deleteEVChargerGallery, PurchaseHistoryAdd, PurchaseHistoryList, PurchaseHistoryDetails, PurchaseHistoryEdit, eVChargerCoverImgDelete } from "../controller/admin/ChargerInstallationController.js";

import {
    storeList, storeData, storeAdd, storeView, storeUpdate, storeDelete, serviceList, serviceCreate, serviceUpdate, serviceDelete, brandList, brandCreate, brandUpdate, brandDelete,
    deleteStoreGallery
} from "../controller/admin/ShopController.js";
import { rsaList, rsaData, rsaAdd, rsaUpdate, rsaDelete, rsaStatusChange, driverBookingList, allRsaList, driverLocationList, riderBookingLists } from "../controller/admin/RsaController.js";
import { clubList, clubData, clubCreate, clubUpdate, clubDelete, clubDeleteImg } from "../controller/admin/RiderClubController.js"
import { carsList, carDetail, carAdd, carEdit, carDelete, carGalleryDelete } from "../controller/admin/ElectriCarLeasingController.js";
import { bikeDetail, bikesList, bikeAdd, bikeEdit, bikeDelete, bikeGalleryDelete } from "../controller/admin/ElectricBikeRentalController.js";

import {
    bookingData, bookingList as evRoadAssistanceBooking, invoiceList as evRoadAssistanceInvoice, invoiceData, evRoadAssistanceCancelBooking, rsaAssignBooking, failedRSABookingList, failedRSABookingDetails, rsaSlotList, rsaSlotDetails, rsaSlotAdd, rsaSlotEdit, rsaDeleteSlot, addOfflineRSABooking, editOfflineRSABooking, offlineRSABookingList, offlineRSABookingData, offlineRSAVehicleList, offlineRSARiderLookup,vehicleBrandList, bikeVehicleBrandList
} from '../controller/admin/EvRoadAssistanceController.js'

import { interestList } from "../controller/admin/RegisterInterestController.js";
import { couponData, couponDetail, couponList, couponAdd, couponEdit, couponDelete } from "../controller/admin/CouponController.js";
import { offerDetail, offerList, offerAdd, offerEdit, offerDelete, offerClickhistory } from "../controller/admin/OfferController.js";
import { guideList, addGuide, guideDetail, editGuide, deleteGuide, deleteEvGuideGallery } from "../controller/admin/EvGuideController.js";
import {
    evInsuranceList, evInsuranceDetail, evPreSaleList, evPreSaleDetail, evPreSaleTimeSlot, evPreSaleTimeSlotAdd, evPreSaleTimeSlotEdit, evPreSaleTimeSlotDelete,
    evPreSaleTimeSlotDetails
} from "../controller/admin/EvInsuranceController.js";
import { sellVehicleDetail, sellVehicleList } from "../controller/admin/VehicleController.js";
import { discussionBoardList, discussionBoardDetail, discussionBoardDelete } from "../controller/admin/DiscussionBoardController.js";
import { donwloadPodBookingList, donwloadUserList } from "../controller/ExportController.js";

import { podDeviceList, podDeviceDetails, addPodDevice, editPodDevice, deletePodDevice, AllpodDevice, addPodBrand, podBrandList, deviceBrandList, podAreaList, addPodArea, podAreaDetails, editPodArea, AllpodArea, assignPodDeviceArea, podAreaAssignList, podDeviceStatusChange, podAreaInputList, podAreaBookingList } from "../controller/admin/PodDeviceController.js";

import { bikeList, bikeDetails, addBike, editBike, bikeSwipeData } from "../controller/admin/BikeController.js";
import { swipeStationList, stationDetails, addStation, editStation } from "../controller/admin/SwipeStationController.js";
import { addChargShare, chargeShareDetail, chargeShareList, chargeshareForMap, outputAndConnector, chargeShareDelete, editChargShare, rejectChargShare, acceptChargShare } from "../controller/admin/ChargeShareController.js";
import { RiderList } from "../../mobility/controller/admin/AdminMobilityController.js";

import { communityList, communityDetail, addCommunity, editCommunity, allCommunityList, addResidentMulti, editResidentMulti, residentListMulti, residentListMultiOld, residentDetailMulti, residentSearchMulti, communityAreaList, getInvoiceData, createScanChargeInvoice, scanChargeInvoiceList, scanChargeInvoiceDetail, sessionList, sessionDetail } from "../../mobility/controller/admin/CommunityController.js";

const router = Router();

const adminAuthRoutes = [

    { method: 'get', path: '/pod-booking-list-download', handler: donwloadPodBookingList },
    { method: 'get', path: '/user-signup-list-download', handler: donwloadUserList },
]
adminAuthRoutes.forEach(({ method, path, handler }) => {
    router[method](path, adminAuthorization, handler);
});

const adminRoutes = [

    { method: 'post', path: '/dashboard', handler: getDashboardData },
    { method: 'post', path: '/electric-customer-list', handler: RiderList },
    { method: 'post', path: '/plusx-notification-list', handler: notificationList },
    { method: 'post',   path: '/rider-details-electric-dashboard',                handler: riderDetailsElectricDB},

    { method: 'post', path: '/location-list', handler: locationList },
    { method: 'post', path: '/location-area-list', handler: areaList },
    { method: 'post', path: '/deleted-rider-list', handler: deletedRiderList },
    { method: 'post', path: '/all-area-list', handler: bookingAreaList },


    /* Public Charger */
    { method: 'post', path: '/public-charger-station-list', handler: stationList },
    { method: 'post', path: '/public-charger-station-details', handler: stationDetail },
    { method: 'post', path: '/public-charger-station-data', handler: stationData },
    { method: 'post', path: '/public-charger-add-station', handler: addPublicCharger },
    { method: 'post', path: '/public-charger-edit-station', handler: editPublicCharger },
    { method: 'post', path: '/public-chargers-delete', handler: deletePublicCharger },
    { method: 'post', path: '/chargers-gallery-del', handler: deletePublicChargerGallery },

    /* Charger Installation */
    { method: 'post', path: '/charger-installation-list', handler: chargerInstallationList },
    { method: 'post', path: '/charger-installation-details', handler: chargerInstallationDetails },



    /* RSA Routes */
    { method: 'post', path: '/rider-booking-list', handler: riderBookingLists },
    { method: 'post', path: '/rsa-list', handler: rsaList },
    { method: 'post', path: '/rsa-data', handler: rsaData },

    { method: 'post', path: '/rsa-add', handler: rsaAdd },
    { method: 'post', path: '/rsa-update', handler: rsaUpdate },
    { method: 'post', path: '/rsa-delete', handler: rsaDelete },
    { method: 'post', path: '/rsa-status-change', handler: rsaStatusChange },
    { method: 'post', path: '/rsa-booking-list', handler: driverBookingList },
    { method: 'post', path: '/all-rsa-list', handler: allRsaList },
    { method: 'post', path: '/rsa-location-list', handler: driverLocationList },


    /* EV Road Assistance */
    { method: 'post', path: '/ev-road-assistance-booking-list', handler: evRoadAssistanceBooking },
    { method: 'post', path: '/ev-road-assistance-booking-details', handler: bookingData },
    // { method: 'post', path: '/ev-road-assistance-confirm-booking', handler: evRoadAssistanceConfirmBooking },
    { method: 'post', path: '/ev-road-assistance-add-offline-booking', handler: addOfflineRSABooking },
    { method: 'post', path: '/ev-road-assistance-edit-offline-booking', handler: editOfflineRSABooking },
    { method: 'post', path: '/ev-road-assistance-offline-booking-list', handler: offlineRSABookingList },
    { method: 'post', path: '/ev-road-assistance-offline-booking-details', handler: offlineRSABookingData },
    { method: 'post', path: '/ev-road-assistance-offline-rider-lookup', handler: offlineRSARiderLookup },
    { method: 'post', path: '/ev-road-assistance-offline-vehicle-list', handler: offlineRSAVehicleList },
    { method: 'post', path: '/ev-road-assistance-cancel-booking', handler: evRoadAssistanceCancelBooking },
    { method: 'post', path: '/ev-road-assistance-invoice-list', handler: evRoadAssistanceInvoice },
    { method: 'post', path: '/ev-road-assistance-invoice-data', handler: invoiceData },
    { method: 'post', path: '/ev-road-assistance-assign', handler: rsaAssignBooking },
    { method: 'post', path: '/failed-road-assistance-list', handler: failedRSABookingList },
    { method: 'post', path: '/failed-road-assistance-details', handler: failedRSABookingDetails },
    { method: 'post', path: '/vehicle-brand-list',      handler: vehicleBrandList },
    { method: 'post', path: '/vehicle-bike-brand-list', handler: bikeVehicleBrandList },

    { method: 'post', path: '/road-assistance-slot-list', handler: rsaSlotList },
    { method: 'post', path: '/road-assistance-slot-details', handler: rsaSlotDetails },
    { method: 'post', path: '/road-assistance-add-time-slot', handler: rsaSlotAdd },
    { method: 'post', path: '/road-assistance-edit-time-slot', handler: rsaSlotEdit },
    { method: 'post', path: '/road-assistance-delete-time-slot', handler: rsaDeleteSlot },



    /* Coupon */
    { method: 'post',   path: '/coupon-list',     handler: couponList },
    { method: 'post', path: '/coupon-detail', handler: couponDetail },
    { method: 'post', path: '/coupon-data', handler: couponDetail },
    { method: 'post', path: '/add-coupan', handler: couponAdd },
    { method: 'post', path: '/edit-coupan', handler: couponEdit },
    { method: 'post', path: '/delete-coupan', handler: couponDelete },

    /* Offer */
    { method: 'post', path: '/offer-list', handler: offerList },
    { method: 'post', path: '/offer-detail', handler: offerDetail },
    { method: 'post', path: '/add-offer', handler: offerAdd },
    { method: 'post', path: '/edit-offer', handler: offerEdit },
    { method: 'post', path: '/delete-offer', handler: offerDelete },
    { method: 'post', path: '/offer-click-history', handler: offerClickhistory },


    /* EV Insurance */
    { method: 'post', path: '/ev-insurance-list', handler: evInsuranceList },
    { method: 'post', path: '/ev-insurance-detail', handler: evInsuranceDetail },


    { method: 'post', path: '/ev-charger-add', handler: eVChargerAdd },
    { method: 'post', path: '/ev-charger-list', handler: eVChargerList },
    { method: 'post', path: '/charger-brand-list', handler: chargerBrandList },
    { method: 'post', path: '/charger-brand-create', handler: chargerBrandCreate },
    { method: 'post', path: '/charger-brand-update', handler: chargerBrandUpdate },
    { method: 'post', path: '/ev-all-charger-list', handler: allChargerBrand },
    { method: 'post', path: '/ev-charger-details', handler: evChargerDetails },
    { method: 'post', path: '/ev-charger-edit', handler: eVChargerEdit },

    { method: 'post', path: '/del-ev-charger-cover-n-pdf', handler: eVChargerCoverImgDelete },


    { method: 'post', path: '/ev-accessories-add', handler: AccessoriesAdd },
    { method: 'post', path: '/ev-accessories-list', handler: AccessoriesList },
    { method: 'post', path: '/ev-accessories-details', handler: AccessoriesDetails },
    { method: 'post', path: '/ev-accessories-edit', handler: AccessoriesEdit },
    { method: 'post', path: '/ev-charger-gallery-del', handler: deleteEVChargerGallery },

    //Purchase History routes
    { method: 'post', path: '/add-purchase-history', handler: PurchaseHistoryAdd },
    { method: 'post', path: '/purchase-history-list', handler: PurchaseHistoryList },
    { method: 'post', path: '/purchase-history-details', handler: PurchaseHistoryDetails },
    { method: 'post', path: '/purchase-history-edit', handler: PurchaseHistoryEdit },


    //charge-share
    { method: 'post', path: '/output-power-and-connector-list', handler: outputAndConnector },

    { method: 'post', path: '/add-charge-share', handler: addChargShare },
    { method: 'post', path: '/charge-share-edit', handler: editChargShare },

    { method: 'post', path: '/charge-share-reject', handler: rejectChargShare },
    { method: 'post', path: '/charge-share-accept', handler: acceptChargShare },


    { method: 'post', path: '/charge-share-list', handler: chargeShareList },
    { method: 'post', path: '/charge-share-delete', handler: chargeShareDelete },



    { method: 'post', path: '/charge-share-detail', handler: chargeShareDetail },
    // Community Routes
    { method: 'post',  path: '/community-add',       handler: addCommunity },
    { method: 'post',  path: '/community-edit',      handler: editCommunity },
    { method: 'post',  path: '/community-list',      handler: communityList },
    { method: 'post',  path: '/community-details',   handler: communityDetail },
    { method: 'post',  path: '/all-community-list',  handler: allCommunityList },
    { method: 'post',  path: '/community-area-list', handler: communityAreaList },
 
    // Resident Routes -- existing routes
    // { method: 'post',  path: '/resident-add',     handler: addResidentMulti },
    // { method: 'post',  path: '/resident-edit',    handler: editResidentMulti },
    // { method: 'post',  path: '/resident-list',    handler: residentListMulti },
    // { method: 'post',  path: '/resident-details', handler: residentDetailMulti },
    // { method: 'post',  path: '/resident-search',            handler : residentSearchMulti },
 
    // Resident Routes (multi-community — CommunityControllerNew)
    { method: 'post',  path: '/resident-add',     handler: addResidentMulti },
    { method: 'post',  path: '/resident-edit',    handler: editResidentMulti },
    { method: 'post',  path: '/resident-list',    handler: residentListMulti },
    { method: 'post',  path: '/resident-list-old', handler: residentListMultiOld },
    // { method: 'post',  path: '/resident-list-single-old', handler: residentListOld }, // handler commented out in CommunityController
    { method: 'post',  path: '/resident-details', handler: residentDetailMulti },
    { method: 'post',  path: '/resident-search',  handler: residentSearchMulti },

    { method: 'post',  path: '/get-invoice-data',           handler : getInvoiceData }, 
    { method: 'post',  path: '/create-scan-charge-invoice', handler : createScanChargeInvoice },
    { method: 'post',  path: '/scan-charge-invoice-list',   handler : scanChargeInvoiceList },
    { method: 'post',  path: '/scan-charge-invoice-detail', handler : scanChargeInvoiceDetail },

    { method: 'post',  path: '/session-list',    handler : sessionList },
    { method: 'post',  path: '/session-detail',  handler : sessionDetail },


];

// Define your upload rules in a config map
const uploadRules = {
    '/add-charger': { folder: 'charger-images', fields: ['charger_image'], maxCount: 1 },
    '/edit-charger': { folder: 'charger-images', fields: ['charger_image'], maxCount: 1 },
    '/rsa-add': { folder: 'rsa_images', fields: ['profile_image'], maxCount: 1 },
    '/rsa-update': { folder: 'rsa_images', fields: ['profile_image'], maxCount: 1 },
    '/shop-add': { folder: 'shop-images', fields: ['cover_image', 'shop_gallery'], maxCount: 5 },
    '/shop-update': { folder: 'shop-images', fields: ['cover_image', 'shop_gallery'], maxCount: 5 },

    '/public-charger-add-station': { folder: 'charging-station-images', fields: ['cover_image', 'shop_gallery'], maxCount: 5 },
    '/public-charger-edit-station': { folder: 'charging-station-images', fields: ['cover_image', 'shop_gallery'], maxCount: 5 },

    '/add-club': { folder: 'club-images', fields: ['cover_image', 'club_gallery'], maxCount: 5 },
    '/edit-club': { folder: 'club-images', fields: ['cover_image', 'club_gallery'], maxCount: 5 },
    '/ev-guide-add': { folder: 'vehicle-image', fields: ['cover_image', 'vehicle_gallery'], maxCount: 5 },
    '/ev-guide-update': { folder: 'vehicle-image', fields: ['cover_image', 'vehicle_gallery'], maxCount: 5 },
    '/add-offer': { folder: 'mobility-offer', fields: ['offer_image'], maxCount: 1 },
    '/edit-offer': { folder: 'offer', fields: ['offer_image'], maxCount: 1 },
    '/electric-bike-add': { folder: 'bike-rental-images', fields: ['cover_image', 'rental_gallery'], maxCount: 5 },
    '/electric-bike-edit': { folder: 'bike-rental-images', fields: ['cover_image', 'rental_gallery'], maxCount: 5 },
    '/electric-car-add': { folder: 'car-rental-images', fields: ['cover_image', 'rental_gallery'], maxCount: 5 },
    '/electric-car-edit': { folder: 'car-rental-images', fields: ['cover_image', 'rental_gallery'], maxCount: 5 },

    '/edit-pod-brand': { folder: 'pod-brand-images', fields: ['brand_image'], maxCount: 1 },
    '/ev-charger-add': { folder: 'charger-installation', fields: ['charger_image', 'specification_pdf', 'charger_gallery'], maxCount: 2 },
    '/ev-charger-edit': { folder: 'charger-installation', fields: ['charger_image', 'specification_pdf', 'charger_gallery'], maxCount: 2 },

    '/ev-accessories-add': { folder: 'charger-installation', fields: ['charger_image', 'specification_pdf', 'charger_gallery'], maxCount: 2 },
    '/ev-accessories-edit': { folder: 'charger-installation', fields: ['charger_image', 'specification_pdf', 'charger_gallery'], maxCount: 2 },

    '/ev-road-assistance-add-offline-booking': { folder: 'rsa-offline-proof', fields: ['proof_of_transaction'], maxCount: 1 },
    '/ev-road-assistance-edit-offline-booking': { folder: 'rsa-offline-proof', fields: ['proof_of_transaction'], maxCount: 1 },

    '/add-purchase-history': { folder: 'charger-installation', fields: ['purchase_invoice_pdf', 'installation_invoice_pdf', 'completion_certificate_pdf'], maxCount: 3 },
    '/purchase-history-edit': { folder: 'charger-installation', fields: ['purchase_invoice_pdf', 'installation_invoice_pdf', 'completion_certificate_pdf'], maxCount: 3 },
    '/charge-share-edit': { folder: 'charge-share-images', fields: ['charger_image'], maxCount: 1 },
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
// router.post('/coupon-list', couponList);
// router.post('/add-coupon', couponAdd );
export default router;