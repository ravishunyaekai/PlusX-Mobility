import dotenv from 'dotenv';
import db from "../../../config/indiadb.js";
import emailQueue from "../../../emailQueue.js";
import validateFields from "../../../validation.js";
import { insertRecord, queryDB, getPaginatedData, updateRecord } from '../../../dbUtils.js';
import { asyncHandler, createNotification, formatDateTimeInQuery, mergeParam, pushNotification } from "../../../utils.js";
import { io } from '../../../server.js';
dotenv.config();

export const withStateserviceRequest = asyncHandler(async (req, resp) => {

    const { rider_id, name, country_code, contact_no, email, looking_for, used_for, address, latitude, longitude, description, charger_id='',state='',city='' } = mergeParam(req);

    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id      : ["required"], 
        name          : ["required"], 
        country_code  : ["required"], 
        contact_no    : ["required"], 
        email         : ["required"], 
        looking_for   : ["required"], 
        used_for      : ["required"], 
        address       : ["required"], 
        latitude      : ["required"], 
        longitude     : ["required"], 
        description   : ["required"],
    }); 
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const rider = await queryDB(`
        SELECT 
            fcm_token, 
            (SELECT MAX(id) FROM charging_installation_service) AS last_index 
        FROM 
            riders 
        WHERE 
            rider_id = ? LIMIT 1`, 
    [rider_id ]);

    let chargerName = '';
    if(charger_id) { 
        const chargerData = await queryDB(`
        SELECT 
           charger_name AS chargerName  
        FROM 
            ev_charger 
        WHERE 
            charger_id = ? LIMIT 1`, 
        [charger_id ]);

        if(!chargerData) { return resp.json({status : 0, code : 200, message: ['Invalid Charger/ Accessories ID!']});}
        chargerName = chargerData.chargerName;       
    }
    const start     = (!rider.last_index) ? 0 : rider.last_index; 
    const nextId    = start + 1;
    const requestId = 'CIS' + String(nextId).padStart(4, '0');
    
    const insert = await insertRecord('charging_installation_service', [
        'request_id', 'rider_id', 'name', 'country_code', 'contact_no', 'email', 'looking_for', 'resident_type', 'address', 'latitude', 'longitude', 'description', 'order_status', 'charger_id'
   ,'state','city' ], [
        requestId, rider_id, name, country_code, contact_no, email, looking_for, used_for, address, latitude, longitude, description, 'P', charger_id,state,city]);
    
    if(insert.affectedRows > 0){
        await insertRecord('charging_installation_service_history', ['service_id', 'rider_id', 'order_status'], [requestId, rider_id, 'P']);
        
        if(charger_id) {
            const href    = 'charging_installation_service/' + requestId;
            const heading = 'EV Charger Booking!';
            const desc    = `EV Charger Booking Booking ID: ${requestId}`;
            createNotification(heading, desc, 'EV Charger Booking', 'Admin', 'Rider', rider_id, '', href);

            createNotification(heading, desc, 'EV Charger Booking', 'Rider', 'Admin', '', rider_id, href);
            const desc1    = `PlusX ${chargerName} - Booking ID : ${requestId}`;
            pushNotification(rider.fcm_token, heading, desc1, 'RDRFCM', href);

            const htmlUser = `<html>
                <body>
                    <h4>Dear ${name},</h4>
                    <p>We have successfully received your details, and our team will be connecting with you shortly to guide you through the next steps.</p>
                    <p>Here are your booking details: </p>
                    <p>Booking ID   : ${requestId}</p>
                    <p>Product Name : ${chargerName}</p>
                    
                    <p>If you have any questions in the meantime, feel free to reach out to us at +971 54 279 6424.</p>
                    <p>Best Regards,<br/>PlusX Electric Team </p>
                </body>
            </html>`;
            emailQueue.addEmail(email, `PlusX Electric EV Charger - ${requestId}`, htmlUser);

            const htmlAdmin = `<html>
                <body>
                    <h4>Hi Admin,</h4>
                    <p>A new booking has been received. Please find the details below:</p>
                    <p>Booking ID     : ${requestId}</p>
                    <p>Customer Name  : ${name}</p>
                    <p>Contact Number : ${country_code} - ${contact_no}</p> <br/>   
                    <p>Product Name   : ${chargerName}</p> <br/>     
                    <p>Kindly connect with the customer and proceed with the next steps.</p>                          
                    <p>Best regards,<br/>PlusX Electric Team </p>
                </body>
            </html>`;
            const adminEmails = [process.env.MAIL_ADMIN, process.env.MAIL_CHINTAN, process.env.MAIL_NADIA];
            emailQueue.addEmail(adminEmails, `New EV Charger Booking - ${requestId}`, htmlAdmin);
        } else {
            const href    = 'charging_installation_service/' + requestId;
            const heading = 'Charging Installation Booking!';
            const desc    = `New Booking : EV Charger Installation. ID : ${requestId}, User: ${name}`;
            createNotification(heading, desc, 'Charging Installation Service', 'Admin', 'Rider', rider_id, '', href);
            
            const desc1    = `EV Charger Installation Booking - ${requestId}`;
            pushNotification(rider.fcm_token, heading, desc1, 'RDRFCM', href);
            
            const now               = new Date();
            const formattedDateTime = now.toISOString().replace('T', ' ').substring(0, 19);

            const htmlUser = `<html>
                <body>
                    <h4>Dear ${name},</h4>
                    <p>Thank you for booking our Charger Installation service. We are pleased to confirm that we have successfully received your booking.</p>
                    <p>Booking Details : </p>
                    <p>Service    : EV Charger Installation</p>
                    <p>Booking ID : ${requestId}</p>
                    <p>Our team will get in touch with you shortly to coordinate the installation and ensure a smooth experience.</p>
                    <p>If you have any questions or need assistance, feel free to reach out to us. We're here to help!</p>
                    <p>Thank you for choosing PlusX Electric. We look forward to serving you soon.</p>
                    <p>Best Regards,<br/>PlusX Electric Team </p>
                </body>
            </html>`;
            emailQueue.addEmail(email, 'PlusX Electric App: EV Charger Installation Booking Confirmation', htmlUser);

            const htmlAdmin = `<html>
                <body>
                    <h4>Dear Admin,</h4>
                    <p>We have received a new booking for our Charging Installation service. Below are the details:</p>
                    <p>Customer Name  : ${name}</p>
                    <p>Address        : ${address}</p>
                    <p>Booking Time   : ${formattedDateTime}</p> <br/>                        
                    <p>Best regards,<br/>PlusX Electric Team </p>
                </body>
            </html>`;
            const adminEmails = [process.env.MAIL_ADMIN, process.env.MAIL_CHINTAN, process.env.MAIL_NADIA];
            emailQueue.addEmail(adminEmails, `Charging Installation Booking - ${requestId}`, htmlAdmin);
        }
        return resp.json({
            status  : 1, 
            code    : 200, 
            message : ['Thank you! We have received your booking for EV Charger Installation. Our team will get in touch with you soon.'],
            service_id : requestId,
            rsa_id     : ''
        });       
    } else {
        return resp.json({status:0, code:200, message: ['Oops! There is something went wrong! Please Try Again']});
    }
});
export const serviceRequest = asyncHandler(async (req, resp) => {

    const { rider_id, name, country_code, contact_no, email, looking_for, used_for, address, latitude, longitude, description, charger_id=''
        ,city,state,country,pincode
    } = mergeParam(req);

    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id      : ["required"], 
        name          : ["required"], 
        country_code  : ["required"], 
        contact_no    : ["required"], 
        email         : ["required"], 
        looking_for   : ["required"], 
        used_for      : ["required"], 
        address       : ["required"], 
        latitude      : ["required"], 
        longitude     : ["required"], 
        description   : ["required"],
        city          : ["required"],
        state         : ["required"],
        country       : ["required"],
        pincode       : ["required"],


    }); 
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const rider = await queryDB(`
        SELECT 
            fcm_token, 
            (SELECT MAX(id) FROM charging_installation_service) AS last_index 
        FROM 
            riders 
        WHERE 
            rider_id = ? LIMIT 1`, 
    [rider_id ]);

    let chargerName = '';
    if(charger_id) { 
        const chargerData = await queryDB(`
        SELECT 
           charger_name AS chargerName  
        FROM 
            ev_charger 
        WHERE 
            charger_id = ? LIMIT 1`, 
        [charger_id ]);

        if(!chargerData) { return resp.json({status : 0, code : 200, message: ['Invalid Charger/ Accessories ID!']});}
        chargerName = chargerData.chargerName;       
    }
    const start     = (!rider.last_index) ? 0 : rider.last_index; 
    const nextId    = start + 1;
    const requestId = 'CIS' + String(nextId).padStart(4, '0');
    
    const insert = await insertRecord('charging_installation_service', [
        'request_id', 'rider_id', 'name', 'country_code', 'contact_no', 'email', 'looking_for', 'resident_type', 'address', 'latitude', 'longitude', 'description', 'order_status', 'charger_id'
    ,'city','state','country','pincode'], [
        requestId, rider_id, name, country_code, contact_no, email, looking_for, used_for, address, latitude, longitude, description, 'P', charger_id,
    city,state,country,pincode]);
    
    if(insert.affectedRows > 0){
        await insertRecord('charging_installation_service_history', ['service_id', 'rider_id', 'order_status'], [requestId, rider_id, 'P']);
        
        if(charger_id) {
            const href    = 'charging_installation_service/' + requestId;
            const heading = 'EV Charger Booking!';
            const desc    = `EV Charger Booking, Booking ID: ${requestId}`;
            createNotification(heading, desc, 'EV Charger Booking', 'Admin', 'Rider', rider_id, '', href);
            createNotification(heading, desc, 'EV Charger Booking', 'Rider', 'Admin', '', rider_id, href);
            const desc1    = `PlusX ${chargerName} - Booking ID : ${requestId}`;
            pushNotification(rider.fcm_token, heading, desc1, 'RDRFCM', href);
            io.emit('plusx-notification-list', {msCount : 1});

            const htmlUser = `<html>
                <body>
                    <h4>Dear ${name},</h4>
                    <p>We have successfully received your details, and our team will be connecting with you shortly to guide you through the next steps.</p>
                    <p>Here are your booking details: </p>
                    <p>Booking ID   : ${requestId}</p>
                    <p>Product Name : ${chargerName}</p>
                    
                    <p>If you have any questions in the meantime, feel free to reach out to us at +971 54 279 6424.</p>
                    <p>Best Regards,<br/>PlusX Electric Team </p>
                </body>
            </html>`;
            emailQueue.addEmail(email, `PlusX Electric EV Charger - ${requestId}`, htmlUser);

            const htmlAdmin = `<html>
                <body>
                    <h4>Hi Admin,</h4>
                    <p>A new booking has been received. Please find the details below:</p>
                    <p>Booking ID     : ${requestId}</p>
                    <p>Customer Name  : ${name}</p>
                    <p>Contact Number : ${country_code} - ${contact_no}</p> <br/>   
                    <p>Product Name   : ${chargerName}</p> <br/>     
                    <p>Kindly connect with the customer and proceed with the next steps.</p>                          
                    <p>Best regards,<br/>PlusX Electric Team </p>
                </body>
            </html>`;
            const adminEmails = [process.env.MAIL_ADMIN, process.env.MAIL_CHINTAN, process.env.MAIL_NADIA];
            emailQueue.addEmail(adminEmails, `New EV Charger Booking - ${requestId}`, htmlAdmin);
        } else {
            const href    = 'charging_installation_service/' + requestId;
            const heading = 'EV Charger Booking!';
             const desc    = `EV Charger Booking, Booking ID: ${requestId}`;
            createNotification(heading, desc, 'EV Charger Booking', 'Admin', 'Rider', rider_id, '', href);
            createNotification(heading, desc, 'EV Charger Booking', 'Rider', 'Admin', '', rider_id, href);
            const desc1    = `PlusX ${chargerName} - Booking ID : ${requestId}`;
            pushNotification(rider.fcm_token, heading, desc1, 'RDRFCM', href);
            io.emit('plusx-notification-list', {msCount : 1});
            
            const now               = new Date();
            const formattedDateTime = now.toISOString().replace('T', ' ').substring(0, 19);

            const htmlUser = `<html>
                <body>
                    <h4>Dear ${name},</h4>
                    <p>Thank you for booking our Charger Installation service. We are pleased to confirm that we have successfully received your booking.</p>
                    <p>Booking Details : </p>
                    <p>Service    : EV Charger Installation</p>
                    <p>Booking ID : ${requestId}</p>
                    <p>Our team will get in touch with you shortly to coordinate the installation and ensure a smooth experience.</p>
                    <p>If you have any questions or need assistance, feel free to reach out to us. We're here to help!</p>
                    <p>Thank you for choosing PlusX Electric. We look forward to serving you soon.</p>
                    <p>Best Regards,<br/>PlusX Electric Team </p>
                </body>
            </html>`;
            emailQueue.addEmail(email, 'PlusX Electric App: EV Charger Installation Booking Confirmation', htmlUser);

            const htmlAdmin = `<html>
                <body>
                    <h4>Dear Admin,</h4>
                    <p>We have received a new booking for our Charging Installation service. Below are the details:</p>
                    <p>Customer Name  : ${name}</p>
                    <p>Address        : ${address}</p>
                    <p>Booking Time   : ${formattedDateTime}</p> <br/>                        
                    <p>Best regards,<br/>PlusX Electric Team </p>
                </body>
            </html>`;
            const adminEmails = [process.env.MAIL_ADMIN, process.env.MAIL_CHINTAN, process.env.MAIL_NADIA];
            emailQueue.addEmail(adminEmails, `Charging Installation Booking - ${requestId}`, htmlAdmin);
        }
        return resp.json({
            status  : 1, 
            code    : 200, 
            message : ['Thank you! We have received your booking for EV Charger Installation. Our team will get in touch with you soon.'],
            service_id : requestId,
            rsa_id     : ''
        });       
    } else {
        return resp.json({status:0, code:200, message: ['Oops! There is something went wrong! Please Try Again']});
    }
});


export const requestList = asyncHandler(async (req, resp) => {
    const {rider_id, page_no, sort_by } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], page_no: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const result = await getPaginatedData({
        tableName: 'charging_installation_service',
        columns: `request_id, name, email, country_code, contact_no, service_type, company_name, address, charger_for, vehicle_model, latitude, longitude, 
            order_status,  ${formatDateTimeInQuery(['created_at'])}`,
        sortColumn: 'id',
        sortOrder: 'DESC',
        page_no,
        limit: 10,
        whereField: ['rider_id'],
        whereValue: [rider_id]
    });

    return resp.json({
        status      : 1,
        code        : 200,
        message     : ["Charging Installation Service List fetch successfully!"],
        data        : result.data,
        total_page  : result.totalPage,
        total       : result.total,
        noResultMsg : "There are no recent bookings. Please schedule your booking now."
    });

});

export const requestDetails = asyncHandler(async (req, resp) => { 
    const {rider_id, request_id } = mergeParam(req);     
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], request_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const [orderData] = await db.execute(`
        SELECT *, ${formatDateTimeInQuery(['created_at', 'updated_at'])} FROM charging_installation_service WHERE request_id = ? LIMIT 1
    `, [request_id]);

    orderData[0].invoice_url = '';
    
    const [history] = await db.execute(`
        SELECT *, ${formatDateTimeInQuery(['created_at', 'updated_at'])} FROM charging_installation_service_history WHERE service_id = ?
    `, [request_id]);

    return resp.json({
        message: ["Charging Installation Service fetched successfully!"],
        service_data: orderData[0],
        order_history: history,
        status: 1,
        code: 200,
    });
});


export const evChargerList = asyncHandler(async (req, resp) => {
    const {rider_id, page_no, vehicleSpecification, vehicleBrand, vehicleModal, usedFor, propertyType } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], page_no: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const params = {
        tableName  : 'ev_charger',
        columns    : `charger_id, charger_name, charger_image, vehicle_brand, price, used_for`,
        sortColumn : 'id',
        sortOrder  : 'DESC',
        page_no,
        limit         : 10,
        whereField    : ['data_type'],
        whereValue    : ['C'],
        whereOperator : ["="]
    }
    const filters = { vehicleSpecification, vehicleBrand, vehicleModal, usedFor, propertyType }
    const filterMap = {
        vehicleSpecification : 'vehicle_specification',
        vehicleBrand         : 'vehicle_brand',
        vehicleModal         : 'vehicle_modal',
        usedFor              : 'used_for',
        propertyType         : 'property_type'
    };
    Object.entries(filterMap).forEach(([key, column]) => {
        if (filters[key]) {
            params.whereField.push(column);
            params.whereValue.push(filters[key]);
            params.whereOperator.push('=');
        }
    });
    const result = await getPaginatedData(params);
    
    const vehicle_specification = ['GCC','Non-GCC']
    const used_for              = ['Commercial','Personal', 'Fleet'];
    const property_type         = ['Warehouse', 'Hotel', 'Appartment', 'Villas', 'Malls', 'Commercial Building' ];
        
    return resp.json({
        status     : 1,
        code       : 200,
        message    : ["EV Charger List fetch successfully!"],
        data       : result.data,
        total_page : result.totalPage,
        total      : result.total,
        vehicle_specification,
        used_for,
        property_type,
        base_url   : `${process.env.DIR_UPLOADS}charger-installation/`,
    });

});

export const accessoriesList = asyncHandler(async (req, resp) => {
    const {rider_id, page_no, vehicleSpecification, vehicleBrand, vehicleModal, chargerType } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], page_no: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const params = {
        tableName  : 'ev_charger',
        columns    : `charger_id, charger_name, price, charger_image, vehicle_brand, price, charger_type, connector_type`,
        sortColumn : 'id',
        sortOrder  : 'DESC',
        page_no,
        limit         : 10,
        whereField    : ['data_type'],
        whereValue    : ['A'],
        whereOperator : ["="]
    }
    const filters   = { vehicleSpecification, vehicleBrand, vehicleModal, chargerType }
    const filterMap = {
        vehicleSpecification : 'vehicle_specification',
        vehicleBrand         : 'vehicle_brand',
        vehicleModal         : 'vehicle_modal',
        chargerType          : 'charger_type',
    };
    Object.entries(filterMap).forEach(([key, column]) => {
        if (filters[key]) {
            params.whereField.push(column);
            params.whereValue.push(filters[key]);
            params.whereOperator.push('=');
        }
    });
    const result = await getPaginatedData(params);
    return resp.json({
        status     : 1,
        code       : 200,
        message    : ["EV Charger List fetch successfully!"],
        data       : result.data,
        total_page : result.totalPage,
        total      : result.total,
        base_url   : `${process.env.DIR_UPLOADS}charger-installation/`,
    });

});

export const evchargerDetails = asyncHandler(async (req, resp) => { 
    const { charger_id }      = mergeParam(req);
    console.log("mergeParam(req)",mergeParam(req),req.body)
    const { isValid, errors } = validateFields(mergeParam(req), {charger_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const chargerData = await queryDB(`
        SELECT 
            charger_id, charger_name, compatible, outputPower, warrantyType, charger_image, charger_feature, description, specification_pdf, vehicle_specification, vehicle_brand, vehicle_modal, price, charger_type, connector_type, used_for, property_type, status, ${formatDateTimeInQuery(['created_at'])},
            ( SELECT COUNT(*) from charger_brands ) as brand_total
        FROM 
            ev_charger 
        WHERE 
            charger_id = ? 
        LIMIT 1`, 
    [charger_id]);

    const compatible       =  chargerData.compatible.map(item => item.label);
    chargerData.compatible = (compatible.length == chargerData.brand_total) ? 'All' : compatible.join(", "); 
        
    return resp.json({
        status       : 1,
        code         : 200,
        message      : ["Details fetched successfully!"],
        chargerData : chargerData, 
        base_url     : `${process.env.DIR_UPLOADS}charger-installation/`,
    });
});
