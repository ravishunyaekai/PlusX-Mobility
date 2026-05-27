import { Router } from "express";
import { authenticateAdmin } from "../../middleware/admin/authenticationMiddleware.js";
import { adminAuthorization } from "../../middleware/admin/authorizeMiddleware.js";
import { notificationList } from "../controller/admin/AuthController.js";

import { handleFileUpload } from "../../fileUpload.js";

import { addCycle, cycleBookinghistory, cycleBookingList, getCityList, getStationList, cycleDelete, cycledetails, cycleList, cyclePrice, editCycle, FaildcycleBookingList, qrCode, StationcycleList, cycleInvoiceList, cycleInvoiceDetails, IssuecycleBookingList, IssuecycleBookingComments, addBookingComment, IssuecycleBookingDetails, IssueBookingUpdate, cycleOnOff, lockerOpen } from "../controller/admin/CycleController.js";

import { AddMobilityStation, deletemobilityStation, editMobilityStation, mobilityStaionListforselectBox, mobilitystationDetails, mobilitystationList, stationlistforlockAssign } from "../controller/admin/MobilitystationController.js";

import { mobilityDashboardData, DeletedRiderList, addUsers, RiderList, usersList } from "../controller/admin/AdminMobilityController.js";

import { addUnversity, universityListSelect,universityList, addstudent, studentList, universitydetail, universityStudent, editStudent, editUniversity } from "../controller/admin/UninversityController.js";

import { riderDetails, cycleBookingDetails, userTransactionList, addRefundAmount, bookngCompleteByadmin, bookngIncompleteByadmin } from "../controller/admin/UserController.js"; 

// import { stateCountry } from "../../common/controller/UserController.js";

import { addSolenoidId, assignLocker, assignLockTobooking, availableLocker } from "../controller/admin/LockerController.js";

const router = Router();

const adminRoutes = [
    { method: 'post',   path: '/notification-list',            handler:notificationList },
    { method: 'post',   path: '/mobility-dashboard',           handler: mobilityDashboardData},

    { method: 'post',   path: '/mobility-deleted-rider-list',  handler: DeletedRiderList},
    { method: 'post',   path: '/mobility-rider-list',          handler: RiderList},
    { method: 'post',   path: '/rider-details',                handler: riderDetails},

    // mobility station add,list, detail
    { method: 'post',   path: '/add-mobility-station',     handler: AddMobilityStation },
    { method: 'post',   path: '/edit-mobility-station',    handler: editMobilityStation },
    { method: 'post',   path: '/mobility-station-delete',  handler: deletemobilityStation },
    { method: 'post',   path: '/mobility-station-list',    handler: mobilitystationList },
    { method: 'post',   path: '/mobility-station-details', handler: mobilitystationDetails },
     
    { method: 'post',   path: '/cycle-booking-list',         handler: cycleBookingList },
    { method: 'post',   path: '/city-list',                  handler: getCityList },
    { method: 'post',   path: '/station-list',               handler: getStationList },
    { method: 'post',   path: '/cycle-booking-details',      handler: cycleBookingDetails },
    { method: 'post',   path: '/cycle-booking-history',      handler: cycleBookinghistory },
    { method: 'post',   path: '/cycle-price-detail',         handler: cyclePrice },
    { method: 'post',   path: '/failed-cycle-booking-list',  handler: FaildcycleBookingList },
    { method: 'post',   path: '/issue-cycle-booking-list',   handler: IssuecycleBookingList },
    { method: 'post',   path: '/issue-cycle-booking-detail', handler: IssuecycleBookingDetails },
    { method: 'post',   path: '/issue-status-update',        handler: IssueBookingUpdate },
    
    { method: 'post',   path: '/issue-comments-list',        handler: IssuecycleBookingComments },
    { method: 'post',   path: '/issue-comments-add',        handler: addBookingComment },

    { method: 'post',   path: '/cycle-invoice-list',         handler: cycleInvoiceList }, 
    { method: 'post',   path: '/cycle-invoice-details',      handler: cycleInvoiceDetails }, 

    { method: 'post',   path: '/add-university',              handler: addUnversity},
    { method: 'post',   path: '/edit-university',             handler: editUniversity},
    { method: 'post',   path: '/university-list',             handler: universityList},
    { method: 'post',   path: '/university-details',          handler: universitydetail},
    { method: 'post',   path: '/university-student-list',     handler: universityStudent},
    { method: 'post',   path: '/university-list-for-select',  handler: universityListSelect},

    { method: 'post',   path: '/add-student',   handler: addstudent},
    { method: 'post',   path: '/edit-student',  handler: editStudent},
    { method: 'post',   path: '/student-list',  handler: studentList},

    { method: 'post',   path: '/add-cycle',                   handler: addCycle },
    { method: 'post',   path: '/edit-cycle',                  handler: editCycle },
    { method: 'post',   path: '/generate-qr-code',            handler: qrCode },
    { method: 'post',   path: '/station-cycle-list',          handler: StationcycleList },
    { method: 'post',   path: '/cycle-list',                  handler: cycleList },
    { method: 'post',   path: '/cycle-delete',                handler: cycleDelete},
    { method: 'post',   path: '/cycle-details',               handler: cycledetails },
    { method: 'post',   path: '/station-list-for-select-box', handler: mobilityStaionListforselectBox },
    { method: 'post',   path: '/assign-locker',               handler: assignLocker },
    { method: 'post',   path: '/add-solenoid-detail',         handler: addSolenoidId },
    { method: 'post',   path: '/cycle-on-off',                handler: cycleOnOff }, 
    { method: 'post',   path: '/locker-open',                 handler: lockerOpen }, 
    //assignLockTobooking
    { method: 'post',   path: '/assign-locker-booking',      handler: assignLockTobooking },
    { method: 'post',   path: '/available-locker-list',      handler: availableLocker },
    { method: 'post',   path: '/station-list-locker-assign', handler: stationlistforlockAssign},

    { method: 'post',   path: '/add-users',  handler: addUsers },
    { method: 'post',   path: '/user-list',  handler: usersList }, 
    
    // Added by ravi 3 Mrch 
    { method: 'post',   path: '/user-transaction-list',     handler: userTransactionList }, 
    { method: 'post',   path: '/add-refund-amount',         handler: addRefundAmount },
    { method: 'post',   path: '/complete-booking-by-admin', handler: bookngCompleteByadmin }, 
    { method: 'post',   path: '/incomplete-booking-by-admin', handler: bookngIncompleteByadmin }, 
]; 

const uploadRules = {
    '/add-mobility-station' : { 
        folder: 'cycle-station-images', fields: ['cover_image', 'station_gallery'], maxCount: 5 
    },
    '/edit-mobility-station' : { 
        folder: 'cycle-station-images', fields: ['cover_image', 'station_gallery'], maxCount:10 
    },
    '/add-cycle'    : { folder: 'cycle-station-images', fields: ['cover_image', 'shop_gallery'], maxCount: 5 },
    '/edit-cycle'   : { folder: 'cycle-station-images', fields: ['cover_image', 'shop_gallery'], maxCount: 5 },
    '/add-student'  : { folder: 'student_id_image',     fields: ['id_image'],                    maxCount: 1 },
    '/edit-student' : { folder: 'student_id_image',     fields: ['id_image'],                    maxCount: 1 },   
}
adminRoutes.forEach(({ method, path, handler }) => {
    const middlewares = [adminAuthorization];

    // Apply middleware based on current path
    const rule = uploadRules[path];
    if (rule) {
        middlewares.push(handleFileUpload(rule.folder, rule.fields, rule.maxCount));
    }
    middlewares.push(authenticateAdmin);

    router[method](path, ...middlewares, handler);
});
export default router;