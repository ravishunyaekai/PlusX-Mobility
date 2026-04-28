import moment from "moment";
import dotenv from 'dotenv';
import db from "../../../../config/indiadb.js";
import emailQueue from "../../../../emailQueue.js";
import validateFields from "../../../../validation.js";
import generateUniqueId from 'generate-unique-id';
import { insertRecord, queryDB, getPaginatedData, updateRecord } from '../../../../dbUtils.js';
import { asyncHandler, createNotification, formatDateInQuery, formatDateTimeInQuery, mergeParam, pushNotification } from "../../../../utils.js";
dotenv.config();
// import fs from "fs";
// import path from "path";
import { tryCatchErrorHandler } from "../../../../middleware/errorHandler.js";
import { io } from '../../../../server.js';

export const addInsurance = asyncHandler(async (req, resp) => {
    try { 
        const {  vehicle_id,rider_id, owner_name, country_code, mobile_no, notionality, date_of_birth, ev_type,  chassis_number, current_insurance_expiry, new_policy_start_date, old_policy_type, claim, driving_experience, vehile_register_year, mortgage, vehicle_value, type_of_insurance, insurance_expired,


         } = mergeParam(req);
       
        const { isValid, errors } = validateFields(mergeParam(req), {
            rider_id              : ["required"],
            owner_name            : ["required"], 
            country_code          : ["required"],
            mobile_no             : ["required"],
            vehicle_id            : ["required"],
            // insurance_expiry_date : ["required"],
        });
        /*imags
        Front
Driving Licence, Back
Driving Licence,
Previous
Insurance,
No Claim Letter,

        */
      
       if(Number(claim)!==0 && Number(claim) !==1)        return resp.json({ status: 0, code: 422, message: ["Clam  must be 0 or 1"] });



        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });   
    
        if (!req.files || !req.files['prev_insurance']) return resp.json({ status: 0, code: 422, message: ["Previous Insurance is required."] });

        if (!req.files || !req.files['driving_licence']) return resp.json({ status: 0, code: 422, message: ["Driving Licence is required."] });

        // if (!req.files || !req.files['emirates_id']) return resp.json({ status: 0, code: 422, message: ["Emirates ID is required."] });

        const riderVehicle = await queryDB(`
            SELECT 
               CONCAT(vehicle_make, ", ", vehicle_model, ", ",  vehicle_number) as vehicle_data,vehicle_type
            FROM 
                riders_vehicles
            WHERE 
                rider_id = ? and vehicle_id = ?
            LIMIT 1 `,
        [ rider_id, vehicle_id ]);
        if(!riderVehicle) return resp.json({ message : ["Vehicle Id not valid!"], status: 0, code: 422, error: true });

        const all_prev_insurance   = req.files['prev_insurance'].map(file => file.filename).join('*');
        const driving_licence_image  = req.files['driving_licence'].map(file => file.filename).join('*');
        const all_claim_letter_image  = req.files['claim_letter_image'].map(file => file.filename).join('*');


        // const emirates_id      = req.files['emirates_id'].map(file => file.filename).join('*');
        const formated_current_insurance_expiry = moment(current_insurance_expiry, 'YYYY-MM-DD').format('YYYY-MM-DD');
       const dob= moment(date_of_birth, 'YYYY-MM-DD').format('YYYY-MM-DD');
      const form_new_policy_start_date=  moment(new_policy_start_date, 'YYYY-MM-DD').format('YYYY-MM-DD');
        const form_vehile_register_year=moment(vehile_register_year, 'YYYY-MM-DD').format('YYYY-MM-DD');
        // const vehicle_data     = riderVehicle.vehicle_make + ", " + riderVehicle.vehicle_model+ "-" + riderVehicle.vehicle_number + "-"+ riderVehicle.vehicle_number ;
//insurance_id, rider_id, owner_name, country_code, mobile_no, notionality, date_of_birth, ev_type, vehicle_data, vehicle, chassis_number, current_insurance_expiry, new_policy_start_date, old_policy_type, claim, driving_experience, vehile_register_year, mortgage, vehicle_value, type_of_insurance, insurance_expired, driving_licence, prev_insurance_image, claim_letter_image
//insurance_id, 
// //rider_id, owner_name, country_code, mobile_no, vehicle_id, riderVehicle.vehicle_data,
//             fInsuranceExpiry, driving_licence, prev_insurance,dob,vehicle_type,chassis_number,vehicle_value
            // old_policy_type,claim,nationality,new_polcy_date ,rider_email,old_insurance_image,claim_letter_image

        const insert = await insertRecord('ev_insurance', [
            'insurance_id','rider_id','owner_name','country_code','mobile_no','notionality','date_of_birth','ev_type','vehicle_data','vehicle'
            ,'chassis_number','current_insurance_expiry','new_policy_start_date','old_policy_type','claim','driving_experience','vehile_register_year',
            'mortgage','vehicle_value','driving_licence','prev_insurance_image','claim_letter_image','vehicle_type'

        ], [
            'EVI', rider_id, owner_name, country_code, mobile_no, notionality, date_of_birth, ev_type, riderVehicle.vehicle_data, vehicle_id, chassis_number,
             formated_current_insurance_expiry, form_new_policy_start_date, old_policy_type, claim, driving_experience, form_vehile_register_year, mortgage,
             vehicle_value, driving_licence_image, all_prev_insurance, all_claim_letter_image,riderVehicle.vehicle_type
        ]);
        //date_of_birth,vehicle_type,chassis_number,
           
        if(insert.affectedRows === 0 ) return resp.json({status:0, code:200, error: true, message: ['Oops! There is something went wrong! Please Try Again']});
        const lastId       = insert.insertId;
        const insurance_id = `EVI-${String(lastId).padStart(4, "0")}`;
        await updateRecord('ev_insurance', {insurance_id}, ['id'], [lastId]);
        console.log(`${process.env.DIR_UPLOADS}insurance-images/`)
        const href    = 'ev_insurance_booking/' + insurance_id;
        const heading = 'EV Insurance Booking!';
        const desc    = `EV Insurance Booking Received - ID: ${insurance_id}`;
        createNotification(heading, desc, 'EV Insurance', 'Admin', 'Rider',  rider_id, '', href);
        const html = `<html>
            <body>
                <h4>Dear Admin,</h4>
                <p>We have received a new lead for the EV Insurance service. Please find the details below:</p>
                <p>Customer Name : ${owner_name}</p> 
                <p>Contact No. : ${country_code} - ${mobile_no}</p> 
                <p>Vehicle Details : ${riderVehicle.vehicle_data}</p> 
                <p>Insurance Expires On : ${moment(current_insurance_expiry, 'YYYY-MM-DD').format('DD MMM YYYY')}</p>
                <br /> <br /> 
                <p> Best regards,<br/> PlusX Electric Team </p>
            </body>
        </html>`;
       
        const allFiles = [
            ...(req.files['prev_insurance'] || []),
            ...(req.files['driving_licence'] || []),
            ...(req.files['claim_letter_image'] || [])
        ];
        //   const url = `${process.env.DIR_UPLOADS}insurance-images/${allFiles}`;
        const attachments = allFiles.map(file => ({
            filename : file.filename,   // send with original name
            content: file.buffer,          // 🔥 correct for memoryStorage
            contentType: file.mimetype
            // content  : file.buffer, //fs.createReadStream(file.path)
        }));
        console.log("allFiles",allFiles)
        const adminEmails = [ process.env.MAIL_ADMIN_PLUSX ];
              

        emailQueue.addEmail(adminEmails, `EV Insurance Lead : ${insurance_id}`, html, null, attachments);
        io.emit('notification-list', {msCount : 1});
        return resp.json({
            status  : 1,
            code    : 200,
            error   : false,
            message : ["Thank you! We've received your details. Our team will contact you shortly."],
        });

    } catch(err) {
        console.log(err);
        tryCatchErrorHandler(req.originalUrl, err, resp);
        // return resp.status(500).json({status: 0, code: 500, message: "Oops! There is something went wrong! Please Try Again" });
    }
});

export const insuranceList = asyncHandler(async (req, resp) => {
    const {rider_id, page_no=1, mobile_no, vehicle } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), { rider_id : ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    let whereField = ['rider_id'];
    let whereValue = [rider_id];

    if(mobile_no){
        whereField.push('mobile_no');
        whereValue.push(`%${mobile_no}%`);
    }
    if(vehicle){
        whereField.push('vehicle');
        whereValue.push(`%${vehicle}%`);
    }
    const result = await getPaginatedData({
        tableName: 'ev_insurance',
        columns: `insurance_id, owner_name, country_code, mobile_no,
            ${formatDateTimeInQuery(['created_at'])}, vehicle_data`,
        sortColumn : 'id',
        sortOrder  : 'DESC',
        limit      : 10,
        page_no,
        whereField,
        whereValue,
        whereOperator: ['=', 'LIKE', 'LIKE'],
    });
    return resp.json({
        status     : 1,
        code       : 200,
        message    : ["Insurance list fetch successfully!"],
        data       : result.data,
        total_page : result.totalPage,
        total      : result.total,
        base_url   : `${process.env.DIR_UPLOADS}insurance-images/`,
        noResultMsg : 'Secure your EV today – get insured and drive worry-free.'
    });
});

export const insuranceDetails = asyncHandler(async (req, resp) => {
    const {rider_id, insurance_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], insurance_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    //insurance_expiry
    const insurance = await queryDB(`
        SELECT 
            rider_id, owner_name, country_code, mobile_no, notionality, date_of_birth, ev_type,vehicle_data, vehicle, chassis_number,
             current_insurance_expiry, new_policy_start_date, old_policy_type, claim, driving_experience, vehile_register_year, mortgage,
             vehicle_value, driving_licence,prev_insurance_image,claim_letter_image,vehicle_type, 
            ${formatDateTimeInQuery(['created_at', 'updated_at'])}
            
        FROM 
            ev_insurance AS ev
        WHERE
            rider_id = ? AND insurance_id = ?
        LIMIT 1
    `, [rider_id, insurance_id]);

    return resp.json({
        message        : [ "Insurance details fetch successfully!" ],
        insurance_data : insurance,
        status         : 1, 
        code           : 200, 
        base_url    : `${process.env.DIR_UPLOADS}insurance-images/`,
        
    });
});

export const evPreSaleBooking = asyncHandler(async (req, resp) => {
    const { rider_id, owner_name, country, country_code, mobile_no, email, vehicle, pickup_address, reason_of_testing, pickup_latitude, pickup_longitude, 
        slot_date, slot_time_id 
    } = req.body;
    const { isValid, errors } = validateFields(req.body, {
        rider_id: ["required"],
        owner_name: ["required"],
        country: ["required"],
        country_code: ["required"],
        mobile_no: ["required"],
        email: ["required"],
        vehicle: ["required"],
        pickup_address: ["required"],
        reason_of_testing: ["required"],
        pickup_latitude: ["required"],
        pickup_longitude: ["required"],
        slot_date: ["required"],
        slot_time_id: ["required"],
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const bookingId = 'EPTS' + generateUniqueId({length:11});
    const fSlotDate = moment(slot_date, "DD-MM-YYYY").format('YYYY-MM-DD');

    const insert = await insertRecord('ev_pre_sale_testing', [
        "booking_id", "rider_id", "owner_name", "country", "country_code", "mobile_no", "email", "vehicle", "pickup_address", "reason_of_testing", "pickup_latitude", 
        "pickup_longitude", "slot_date", "slot_time_id" 
    ],[
        bookingId, rider_id, owner_name, country, country_code, mobile_no, email, vehicle, pickup_address, reason_of_testing, pickup_latitude, pickup_longitude, 
        fSlotDate, slot_time_id 
    ])

    if(insert.affectedRows === 0) return resp.json({status:0, code:200, error: true, message: ["Oops! Something went wrong. Please try again."]});

    const rider = await queryDB(`SELECT fcm_token, rider_name, rider_email FROM riders WHERE rider_id = ?`, [rider_id]);

    const href = 'pre_sale_testing/' + bookingId;
    const heading = 'EV-pre Sale booked!';
    const desc = `Your request for EV-pre sale testing booking_id: ${bookingId} has been placed.`;
    createNotification(heading, desc, 'EV-pre Sale', 'Rider', 'Admin','', rider_id, href);
    pushNotification(rider.fcm_token, heading, desc, 'RDRFCM', href);

    const formattedDateTime = moment().format('DD MM YYYY hh:mm A');

    const htmlUser = `<html>
        <body>
            <h4>Dear ${rider.rider_name},</h4>
            <p>Thank you for using the PlusX Electric App for your Valet Charging service. We have successfully received your booking request. Below are the details of your roadside assistance booking:</p>
            <p>Booking Reference      : ${bookingId}</p>
            <p>Date & Time of Request : ${formattedDateTime}</p> 
            <p>Pick Up Address        : ${pickup_address}</p>                         
            <p>Reason                 : ${reason_of_testing}</p><br/><br/>  
            <p>Best Regards,<br/> The Friendly PlusX Electric Team </p>
        </body>
    </html>`;
    emailQueue.addEmail(rider.rider_email, 'Your EV-pre Sale Booking Confirmation - PlusX Electric App', htmlUser);
    const htmlAdmin = `<html>
        <body>
            <h4>Dear Admin,</h4>
            <p>We have received a new booking for our Valet Charging service. Below are the details:</p> 
            <p>Customer Name         : ${rider.rider_name}</p>
            <p>Pickup & Drop Address : ${pickup_address}</p>
            <p>Booking Date & Time   : ${formattedDateTime}</p> <br/>                        
            <p>Best regards,<br/> PlusX Electric App </p>
        </body>
    </html>`;
    emailQueue.addEmail(process.env.MAIL_ADMIN, `EV-pre Sale Booking - ${bookingId}`, htmlAdmin);

    return resp.json({
        status: 1,
        code: 200,
        error: false,
        message: ["Thanks for Booking EV Pre Sale Testing! We`ll be in touch shortly. We appreciate your trust in PlusX electric"],
        request_id: bookingId,
    });
});

export const evPreSaleList = asyncHandler(async (req, resp) => {
    const {rider_id, page_no, mobile_no, vehicle } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], page_no: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    let whereField = ['rider_id'];
    let whereValue = [rider_id];

    if(mobile_no){
        whereField.push('mobile_no');
        whereValue.push(`%${mobile_no}%`);
    }
    if(vehicle){
        whereField.push('vehicle');
        whereValue.push(`%${vehicle}%`);
    }

    const result = await getPaginatedData({
        tableName: 'ev_pre_sale_testing',
        columns: `booking_id, owner_name, country, country_code, mobile_no, vehicle,
            ${formatDateTimeInQuery(['created_at'])}, ${formatDateInQuery(['date_of_birth', 'slot_date'])},
            (select concat(vehicle_model, "-", vehicle_make) from riders_vehicles as rv where rv.vehicle_id = ev_pre_sale_testing.vehicle) AS vehicle_data,
            (select concat(start_time, "-", end_time) from ev_pre_sale_testing_slot as slt where slt.slot_id = ev_pre_sale_testing.slot_time_id) AS slot_time
            `,
        sortColumn: 'id',
        sortOrder: 'DESC',
        page_no,
        limit: 10,
        whereField,
        whereValue,
        whereOperator: ['=', 'LIKE', 'LIKE'],
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["Ev pre sale booking list fetch successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
    });
});

export const evPreSaleDetails = asyncHandler(async (req, resp) => {
    const {rider_id, booking_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], booking_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const sale = await queryDB(`
        SELECT 
            evpst.*, ${formatDateTimeInQuery(['evpst.created_at', 'evpst.updated_at'])}, ${formatDateInQuery(['evpst.date_of_birth', 'evpst.slot_date'])},
            (select concat(vehicle_model, "-", vehicle_make) from riders_vehicles as rv where rv.vehicle_id = evpst.vehicle) as vehicle_data,
            (select concat(start_time, "-", end_time) from ev_pre_sale_testing_slot as slt where slt.slot_id = evpst.slot_time_id) AS slot_time
        FROM 
            ev_pre_sale_testing AS evpst
        WHERE
            rider_id = ? AND booking_id = ?
        LIMIT 1
    `, [rider_id, booking_id]);

    return resp.json({
        message: [ "Ev pre sale booking details fetch successfully!" ],
        sale_data: sale,
        status: 1, 
        code: 200, 
    });
});

export const preSaleSlotList = asyncHandler(async (req, resp) => {
    const [slot] = await db.execute(`SELECT slot_id, slot_name, start_time, end_time, booking_limit FROM ev_pre_sale_testing_slot WHERE status = ? ORDER BY id ASC`, [1]);

    let result = {};
    
    slot.forEach((element) => {
        if (!result[element.slot_name]) result[element.slot_name] = [];

        result[element.slot_name].push({
            slot_id: element.slot_id,
            slot_name: element.slot_name,
            slot_time: `${moment(element.start_time, 'HH:mm:ss').format('hh:mm A')} - ${moment(element.end_time, 'HH:mm:ss').format('hh:mm A')}`,
            booking_limit: element.booking_limit,
            total_booking: 0,
            start_time: moment(element.start_time, 'HH:mm:ss').format('HH:mm:ss'),
            end_time: moment(element.end_time, 'HH:mm:ss').format('HH:mm:ss')
        });
    });

    return resp.json({
        message: ["Slot List fetched successfully!"],
        data: result,
        status: 1,
        code: 200
    });
});
