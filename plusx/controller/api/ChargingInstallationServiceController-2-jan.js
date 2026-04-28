import dotenv from 'dotenv';
import db from "../../../config/indiadb.js";
import emailQueue from "../../../emailQueue.js";
import validateFields from "../../../validation.js";
import { insertRecord, queryDB, getPaginatedData, updateRecord } from '../../../dbUtils.js';
import { asyncHandler, createNotification, formatDateInQuery, formatDateTimeInQuery, mergeParam, pushNotification } from "../../../utils.js";
import { io } from '../../../server.js';
dotenv.config();

export const serviceRequest = asyncHandler(async (req, resp) => {

    const { rider_id, name, country_code, contact_no, email, looking_for, used_for, address, latitude, longitude, description, charger_id='', booking_type, city,state,country,pincode } = mergeParam(req);
 
    let validationRules = {
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
         city         : ["required"],
        state         : ["required"],
        country       : ["required"],
        pincode       : ["required"],
    };
    if (booking_type != "CIS")  validationRules = { ...validationRules, charger_id : ["required"] };

    const { isValid, errors } = validateFields(mergeParam(req), validationRules);

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    switch (booking_type) {
        case 'FCB':
            return await chargerBooking(req, resp);//FIX CHARGER BOOKING
            
        case 'AB':
            return await accessoriesBooking(req, resp);
            
        case 'CIS':
            return await installationBooking(req, resp);// CHARGER ISNTALLATON
            
        default:
            return resp.json({status:0, code:200, message: ['The provided booking type is invalid.']});
    }    
});

const chargerBooking = async (req, resp) => {
    const { rider_id, name, country_code, contact_no, email, looking_for, used_for, address, latitude, longitude, description, charger_id,city,state,country,pincode } = mergeParam(req);

    const rider = await queryDB(`
        SELECT 
            fcm_token, (SELECT MAX(id) FROM ev_charger_booiking) AS last_index 
        FROM  riders 
        WHERE rider_id = ? LIMIT 1`, 
    [rider_id ]);
   
    const chargerData = await queryDB(` SELECT charger_name AS chargerName , price FROM ev_charger 
        WHERE charger_id = ? LIMIT 1`, [charger_id ]
    );

    if(!chargerData) { return resp.json({status : 0, code : 200, message: ['Invalid Charger ID!']});}

    const chargerName = chargerData.chargerName;       
   
    const start     = (!rider.last_index) ? 0 : rider.last_index; 
    const nextId    = start + 1;
    const requestId = 'FCB' + String(nextId).padStart(4, '0');
    console.log(requestId, rider_id, name, country_code, contact_no, email, looking_for, used_for, address, latitude, longitude, description, 'P', charger_id,city,state,country,pincode)
    const insert = await insertRecord('ev_charger_booiking', [
        'request_id', 'rider_id', 'name', 'country_code', 'contact_no', 'email', 'looking_for', 'resident_type', 'address', 'latitude', 'longitude', 'description', 'order_status', 'charger_id'
        ,'city','state','country','pincode'
    ], [
        requestId, rider_id, name, country_code, contact_no, email, looking_for, used_for, address, latitude, longitude, description, 'P', charger_id,city,state,country,pincode
    ]);
    if( insert.affectedRows > 0 ) {
        await insertRecord('ev_charger_booiking_history', ['service_id', 'rider_id', 'order_status'], [requestId, rider_id, 'P']);
        
        const href    = 'ev_charger_booking/' + requestId;
        const heading = 'EV Charger Booking!';
        const desc    = `EV Charger Booking Booking ID: ${requestId}`;
        createNotification(heading, desc, 'EV Charger Booking', 'Admin', 'Rider', rider_id, '', href);
        io.emit('plusx-notification-list', {msCount : 1});

        createNotification(heading, desc, 'EV Charger Booking', 'Rider', 'Admin', '', rider_id, href);
        const desc1    = `PlusX ${chargerName} - Booking ID : ${requestId}`;
        pushNotification(rider.fcm_token, heading, desc1, 'RDRFCM', href);

        // const htmlUser = `<html>
        //     <body>
        //         <h4>Dear ${name},</h4>
        //         <p>We have successfully received your details, and our team will be connecting with you shortly to guide you through the next steps.</p>
        //         <p>Here are your booking details: </p>
        //         <p>Booking ID   : ${requestId}</p>
        //         <p>Product Name : ${chargerName}</p>
                
        //         <p>If you have any questions in the meantime, feel free to reach out to us at +971 54 279 6424.</p>
        //         <p>Best Regards,<br/>PlusX Electric Team </p>
        //     </body>
        // </html>`;
        // emailQueue.addEmail(email, `PlusX Electric EV Charger - ${requestId}`, htmlUser);
         const htmlUser = `<html>
            <body>
                <h4>Dear ${name},</h4>
                <p>Thank you for showing interest in our EV products. We are pleased to confirm that we have successfully received your details.</p>
                <p>Booking details: </p>

                <p>Product Name : ${chargerName}</p>
                <P>Price: ${chargerData.price}</P>
                <p>Our team will get in touch with you shortly to dispatch your product.</p>
                <p>If you have any questions or need assistance, please feel free to reach out to us. We’re here to help!</p>
                <p>Thank you for choosing PlusX Electric. We look forward to serving you soon.</p>
                <p>Best Regards,<br/>PlusX Electric Team </p>
            </body>
        </html>`;
        emailQueue.addEmail(email, `EV Products Order Confirmation`, htmlUser);

        // const htmlAdmin = `<html>
        //     <body>
        //         <h4>Hi Admin,</h4>
        //         <p>A new booking has been received. Please find the details below:</p>
        //         <p>Booking ID     : ${requestId}</p>
        //         <p>Customer Name  : ${name}</p>
        //         <p>Contact Number : ${country_code} - ${contact_no}</p> <br/>   
        //         <p>Product Name   : ${chargerName}</p> <br/>     
        //         <p>Kindly connect with the customer and proceed with the next steps.</p>                          
        //         <p>Best regards,<br/>PlusX Electric Team </p>
        //     </body>
        // </html>`;
        // const adminEmails = [process.env.MAIL_ADMIN_PLUSX];
        // emailQueue.addEmail(adminEmails, `New EV Charger Booking - ${requestId}`, htmlAdmin);
         const htmlAdmin = `<html>
            <body>
                <h4>Dear Admin,</h4>
                <p>We have received a new booking for our EV Products. Below are the details:</p>
                <p>Customer Name  : ${name}</p>
                <P>Type of Product :  EV Charger</P>
                <p>Product Name   : ${chargerName}</p> <br/>                       
                <p>Best regards,<br/>PlusX Electric Team </p>
            </body>
        </html>`;
        const adminEmails = [process.env.MAIL_ADMIN_PLUSX];
        emailQueue.addEmail(adminEmails, `EV Products Booking- ${requestId}`, htmlAdmin);
    
        return resp.json({
            status  : 1, 
            code    : 200, 
            message : ['Thank you! We have received your booking for EV Charger. Our team will get in touch with you soon.'],
            service_id : requestId,
            rsa_id     : ''
        });       
    } else {
        return resp.json({status:0, code:200, message: ['Oops! There is something went wrong! Please Try Again']});
    }
}
const accessoriesBooking = async (req, resp) => {
    const { rider_id, name, country_code, contact_no, email, looking_for, used_for, address, latitude, longitude, description, charger_id,city,state,country,pincode } = mergeParam(req);

    const rider = await queryDB(`
        SELECT fcm_token, (SELECT MAX(id) FROM ev_accessories_booiking) AS last_index 
        FROM  riders 
        WHERE rider_id = ? LIMIT 1`, 
    [rider_id ]);

    const chargerData = await queryDB(` SELECT charger_name AS chargerName, price FROM ev_charger 
        WHERE charger_id = ? LIMIT 1`, [charger_id ]
    );
    if(!chargerData) { return resp.json({status : 0, code : 200, message: ['Invalid Accessories ID!']});}
    const chargerName = chargerData.chargerName;       
   
    const start     = (!rider.last_index) ? 0 : rider.last_index; 
    const nextId    = start + 1;
    const requestId = 'AB' + String(nextId).padStart(4, '0');
    
    const insert = await insertRecord('ev_accessories_booiking', [
        'request_id', 'rider_id', 'name', 'country_code', 'contact_no', 'email', 'looking_for', 'resident_type', 'address', 'latitude', 'longitude', 'description', 'order_status', 'charger_id',
        'city','state','country','pincode'
    ], [
        requestId, rider_id, name, country_code, contact_no, email, looking_for, used_for, address, latitude, longitude, description, 'P', charger_id,city,state,country,pincode
    ]);
    if( insert.affectedRows > 0 ) {
        await insertRecord('ev_accessories_booiking_history', ['service_id', 'rider_id', 'order_status'], [requestId, rider_id, 'P']);
        
       
        const href    = 'ev_accessories_booking/' + requestId;
        const heading = 'EV Accessories Booking!';
        const desc    = `EV Accessories Booking Booking ID: ${requestId}`;
        io.emit('plusx-notification-list', {msCount : 1});
        
        createNotification(heading, desc, 'EV Accessories Booking', 'Admin', 'Rider', rider_id, '', href);

        createNotification(heading, desc, 'EV Accessories Booking', 'Rider', 'Admin', '', rider_id, href);
        const desc1    = `PlusX ${chargerName} - Booking ID : ${requestId}`;
        pushNotification(rider.fcm_token, heading, desc1, 'RDRFCM', href);

        // const htmlUser = `<html>
        //     <body>
        //         <h4>Dear ${name},</h4>
        //         <p>We have successfully received your details, and our team will be connecting with you shortly to guide you through the next steps.</p>
        //         <p>Here are your booking details: </p>
        //         <p>Booking ID   : ${requestId}</p>
        //         <p>Product Name : ${chargerName}</p>
                
        //         <p>If you have any questions in the meantime, feel free to reach out to us at +971 54 279 6424.</p>
        //         <p>Best Regards,<br/>PlusX Electric Team </p>
        //     </body>
        // </html>`;
        // emailQueue.addEmail(email, `PlusX Electric EV Accessories - ${requestId}`, htmlUser);

        // const htmlAdmin = `<html>
        //     <body>
        //         <h4>Hi Admin,</h4>
        //         <p>A new booking has been received. Please find the details below:</p>
        //         <p>Booking ID     : ${requestId}</p>
        //         <p>Customer Name  : ${name}</p>
        //         <p>Contact Number : ${country_code} - ${contact_no}</p> <br/>   
        //         <p>Product Name   : ${chargerName}</p> <br/>     
        //         <p>Kindly connect with the customer and proceed with the next steps.</p>                          
        //         <p>Best regards,<br/>PlusX Electric Team </p>
        //     </body>
        // </html>`;
        // const adminEmails = [process.env.MAIL_ADMIN_PLUSX];
        // emailQueue.addEmail(adminEmails, `New EV Accessories Booking - ${requestId}`, htmlAdmin);
        const htmlUser = `<html>
            <body>
                <h4>Dear ${name},</h4>
                <p>Thank you for showing interest in our EV products. We are pleased to confirm that we have successfully received your details.</p>
                <p>Booking Details:  </p>
                <p>Booking ID   : ${requestId}</p>
                <p>Product Name : ${chargerName}</p>
                <P>Price: ${chargerData.price}</P>
                <P>Our team will get in touch with you shortly to dispatch your product.</P>
                <p>If you have any questions or need assistance, please feel free to reach out to us. We're here to help!</p>
                <P>Thank you for choosing PlusX Electric. We look forward to serving you soon.</p>
                <p>Best Regards,<br/>PlusX Electric Team </p>
            </body>
        </html>`;
        emailQueue.addEmail(email, `EV Products Order Confirmation`, htmlUser);
        const htmlAdmin = `<html>
            <body>
                <h4>Dear Admin,</h4>
                <p>We have received a new booking for our EV Products. Below are the details:</p>
                <p>Customer Name  : ${name}</p>
                <P>Type of Product :  EV Accessories</P>
                <p>Product Name   : ${chargerName}</p> <br/>                       
                <p>Best regards,<br/>PlusX Electric Team </p>
            </body>
        </html>`;
        const adminEmails = [process.env.MAIL_ADMIN_PLUSX];
        emailQueue.addEmail(adminEmails, `EV Products Booking- ${requestId}`, htmlAdmin);

        
    
        return resp.json({
            status  : 1, 
            code    : 200, 
            message : ['Thank you! We have received your booking for EV Accessories. Our team will get in touch with you soon.'],
            service_id : requestId,
            rsa_id     : ''
        });       
    } else {
        return resp.json({status:0, code:200, message: ['Oops! There is something went wrong! Please Try Again']});
    }
}
const installationBooking = async (req, resp) => {
    const { rider_id, name, country_code, contact_no, email, looking_for, used_for, address, latitude, longitude, description, charger_id,city,state,country,pincode } = mergeParam(req);

    const rider = await queryDB(`
        SELECT  fcm_token, 
            (SELECT MAX(id) FROM charging_installation_service) AS last_index 
        FROM 
            riders 
        WHERE 
            rider_id = ? LIMIT 1`, 
    [rider_id ]);
    
    const start     = (!rider.last_index) ? 0 : rider.last_index; 
    const nextId    = start + 1;
    const requestId = 'CIS' + String(nextId).padStart(4, '0');
    
    const insert = await insertRecord('charging_installation_service', [
        'request_id', 'rider_id', 'name', 'country_code', 'contact_no', 'email', 'looking_for', 'resident_type', 'address', 'latitude', 'longitude', 'description', 'order_status',
        'city','state','country','pincode' 
    ], [
        requestId, rider_id, name, country_code, contact_no, email, looking_for, used_for, address, latitude, longitude, description, 'P',city,state,country,pincode
    ]);
    
    
    if( insert.affectedRows > 0 ) {
        await insertRecord('charging_installation_service_history', ['service_id', 'rider_id', 'order_status'], [requestId, rider_id, 'P']);
        
       
        const href    = 'charging_installation_service/' + requestId;
        const heading = 'Charging Installation Booking!';
        const desc    = `New Booking : EV Charger Installation. ID : ${requestId}, User: ${name}`;
        
        createNotification(heading, desc, 'Charging Installation Service', 'Admin', 'Rider', rider_id, '', href);
        createNotification(heading, desc, 'Charging Installation Service', 'Rider', 'Admin', '', rider_id, href);
         io.emit('plusx-notification-list', {msCount : 1});
        
        const desc1    = `EV Charger Installation Booking - ${requestId}`;
        pushNotification(rider.fcm_token, heading, desc1, 'RDRFCM', href);
        
        const now               = new Date();
        const formattedDateTime = now.toISOString().replace('T', ' ').substring(0, 19);

        // const htmlUser = `<html>
        //     <body>
        //         <h4>Dear ${name},</h4>
        //         <p>Thank you for booking our EV Charger Installation service. We are pleased to confirm that we have successfully received your booking.</p>
        //         <p>Booking Details : </p>
        //         <p>Service    : EV Charger Installation</p>
        //         <p>Booking ID : ${requestId}</p>
        //         <p>Our team will get in touch with you shortly to coordinate the installation and ensure a smooth experience.</p>
        //         <p>If you have any questions or need assistance, feel free to reach out to us. We're here to help!</p>
        //         <p>Thank you for choosing PlusX Electric. We look forward to serving you soon.</p>
        //         <p>Best Regards,<br/>PlusX Electric Team </p>
        //     </body>
        // </html>`;
        // emailQueue.addEmail(email, 'PlusX Electric App: EV Charger Installation Booking Confirmation', htmlUser);
        const htmlUser = `<html>
            <body>
                <h4>Dear ${name},</h4>
                <p>Thank you for booking our EV Charger Installation service. We are pleased to confirm that we have successfully received your booking.</p>
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
        const adminEmails = [process.env.MAIL_ADMIN_PLUSX];
        emailQueue.addEmail(adminEmails, `Charging Installation Booking - ${requestId}`, htmlAdmin);
        
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

}

// List API 
export const requestList = asyncHandler(async (req, resp) => {
    const { rider_id, page_no = 1, limit = 10 } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id: ["required"],
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const offset   = (page_no - 1) * limit;
    const [result] = await db.query(`
        SELECT * FROM (
                SELECT 
                    request_id, name, email, country_code, contact_no, address, latitude, longitude, order_status, DATE_FORMAT(CONVERT_TZ(created_at, 'UTC', 'Asia/Dubai'), '%Y-%m-%d %H:%i:%s') AS created_at, "CIS" as booking_type
                FROM charging_installation_service
                WHERE rider_id = ?
            UNION ALL
                SELECT 
                    request_id, name, email, country_code, contact_no, address, latitude, longitude, order_status, DATE_FORMAT(CONVERT_TZ(created_at, 'UTC', 'Asia/Dubai'), '%Y-%m-%d %H:%i:%s') AS created_at, "FCB" as booking_type
                FROM ev_charger_booiking
                WHERE rider_id = ?

            UNION ALL
                SELECT 
                    request_id, name, email, country_code, contact_no, address, latitude, longitude, order_status, DATE_FORMAT(CONVERT_TZ(created_at, 'UTC', 'Asia/Dubai'), '%Y-%m-%d %H:%i:%s') AS created_at, "AB" as booking_type
                FROM ev_accessories_booiking
                WHERE rider_id = ?
        ) AS combined
        ORDER BY combined.created_at DESC
        LIMIT ? OFFSET ? `, [rider_id, rider_id, rider_id, limit, offset]
    );

  const [countResult] = await db.execute(
    `
      SELECT SUM(cnt) AS total FROM (
        SELECT COUNT(*) AS cnt FROM charging_installation_service WHERE rider_id = ?
        UNION ALL
        SELECT COUNT(*) AS cnt FROM ev_charger_booiking WHERE rider_id = ?
        UNION ALL
        SELECT COUNT(*) AS cnt FROM ev_accessories_booiking WHERE rider_id = ?
      ) AS total_counts
    `,
    [rider_id, rider_id, rider_id]
  );

  const total = countResult[0]?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return resp.json({
    status: 1,
    code: 200,
    message: ["Booking list fetched successfully!"],
    data: result,
    total_page: totalPages,
    total,
    noResultMsg:
      "There are no recent bookings. Please schedule your booking now.",
  });
});

// Details API 
export const requestDetails = asyncHandler(async (req, resp) => { 
    const { rider_id, request_id, booking_type } = mergeParam(req);     
    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id     : ["required"], 
        request_id   : ["required"],
        booking_type : ["required"]
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    switch (booking_type) {
        case 'FCB':
            return await fixedchargerBookingDetails(req, resp);
            
        case 'AB':
            return await accessoriesBookingDetails(req, resp);
            
        default:
            const orderData = await queryDB(`
                SELECT request_id, name, email, country_code, contact_no, address, latitude, longitude, order_status, looking_for, resident_type, description, ${formatDateTimeInQuery(['created_at', 'updated_at'])} FROM charging_installation_service WHERE request_id = ? AND rider_id = ? LIMIT 1
            `, [request_id, rider_id]);
            
            const [history] = await db.execute(`
                SELECT *, ${formatDateTimeInQuery(['created_at', 'updated_at'])} FROM charging_installation_service_history WHERE service_id = ?
            `, [request_id]);

            return resp.json({
                message       : ["Charging Installation Service fetched successfully!"],
                service_data  : orderData || {},
                order_history : history || [],
                status        : 1,
                code          : 200,
            });
    }  
});

const fixedchargerBookingDetails = async (req, resp) => { 
    const {rider_id, request_id } = mergeParam(req);     

    const orderData = await queryDB(`SELECT request_id, name, email, country_code, contact_no, address, latitude, longitude, order_status, looking_for, resident_type, description, ${formatDateTimeInQuery(['created_at', 'updated_at'])} FROM ev_charger_booiking WHERE request_id = ? AND rider_id = ? LIMIT 1 `, [request_id, rider_id]);

    const [history] = await db.execute(`SELECT *, ${formatDateTimeInQuery(['created_at', 'updated_at'])} FROM ev_charger_booiking_history WHERE service_id = ? `, [request_id]);

    return resp.json({
        message       : ["Fixed Charger Booking fetched successfully!"],
        service_data  : orderData || {},
        order_history : history || [],
        status        : 1,
        code          : 200,
    });
};

const accessoriesBookingDetails = async (req, resp) => { 
    const {rider_id, request_id } = mergeParam(req);     
    
    const orderData = await queryDB(`SELECT request_id, name, email, country_code, contact_no, address, latitude, longitude, order_status, looking_for, resident_type, description, ${formatDateTimeInQuery(['created_at', 'updated_at'])} FROM ev_accessories_booiking WHERE request_id = ? AND rider_id = ? LIMIT 1 `, [request_id, rider_id]);

    const [history] = await db.execute(` SELECT *, ${formatDateTimeInQuery(['created_at', 'updated_at'])} FROM ev_accessories_booiking_history WHERE service_id = ?`, [request_id]);

    return resp.json({
        message       : ["Accessories Booking fetched successfully!"],
        service_data  : orderData || {},
        order_history : history || [],
        status        : 1,
        code          : 200,
    });
};

export const evChargerList = asyncHandler(async (req, resp) => {
    const {rider_id, page_no, vehicleSpecification='', vehicleBrand, vehicleModal, usedFor, propertyType } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], page_no: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    // used_for, property_type` //used_for, property_type,  
    const params = {
        tableName  : 'ev_charger',
        columns    : `charger_id, charger_name, charger_image, price, used_for, property_type`,
        sortColumn : 'id',
        sortOrder  : 'DESC',
        page_no,
        limit         : 10,
        whereField    : ['data_type', 'status'],
        whereValue    : ['C', 1],
        whereOperator : ["=", "="]
    }
    const filters = { vehicleSpecification, vehicleBrand, vehicleModal, usedFor, propertyType }
    const filterMap = {
        vehicleSpecification : 'vehicle_specification',
        // vehicleBrand         : 'vehicle_brand',
        // vehicleModal         : 'vehicle_modal',
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
   
    const formattedResponse = result.data.map(item => ({ ...item,
        used_for: Array.isArray(item.used_for)
        ? item.used_for.map(u => u.label).join(', ')
        : item.used_for || '',

        property_type: Array.isArray(item.property_type)
        ? item.property_type.map(p => p.label).join(', ')
        : item.property_type || ''
    }))

    return resp.json({
        status     : 1,
        code       : 200,
        message    : ["EV Charger List fetch successfully!"],
        data       : formattedResponse, //result.data,
        total_page : result.totalPage,
        total      : result.total,
        base_url   : `${process.env.DIR_UPLOADS}charger-installation/`,

        used_for      : ['Commercial', 'Personal', 'Fleet'],  
        property_type : ['Warehouse', 'Hotel', 'Appartment', 'Villas', 'Malls', 'Commercial Building']
    });

});

export const accessoriesList = asyncHandler(async (req, resp) => {
    const {rider_id, page_no, vehicleSpecification, vehicleBrand, vehicleModal, chargerType } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], page_no: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const params = {
        tableName  : 'ev_charger',
        columns    : `charger_id, charger_name, price, charger_image, price, charger_type, connector_type`,
        sortColumn : 'id',
        sortOrder  : 'DESC',
        page_no,
        limit         : 10,
        whereField    : ['data_type', 'status'],
        whereValue    : ['A', 1],
        whereOperator : ["=", "="]
    }
    const filters   = { vehicleSpecification, vehicleBrand, vehicleModal, chargerType }
    const filterMap = {
        vehicleSpecification : 'vehicle_specification',
        // vehicleBrand         : 'vehicle_brand',
        // vehicleModal         : 'vehicle_modal',
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
    const { isValid, errors } = validateFields(mergeParam(req), {charger_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    // vehicle_brand, vehicle_modal, charger_image,
    const chargerData = await queryDB(`
        SELECT 
            charger_id, charger_name, compatible, outputPower, warrantyType, charger_feature, description, specification_pdf, vehicle_specification, price, charger_type, connector_type, used_for, property_type, status, ${formatDateTimeInQuery(['created_at'])},
            ( SELECT COUNT(*) from charger_brands ) as brand_total
        FROM 
            ev_charger 
        WHERE 
            charger_id = ? 
        LIMIT 1`, 
    [charger_id]);

    const compatible       =  chargerData.compatible.map(item => item.label);
    chargerData.compatible = (compatible.length == chargerData.brand_total) ? 'All' : compatible.join(", "); 

    if(chargerData.used_for) {
        const usedFor        = chargerData.used_for?.map(item => item.label);
        chargerData.used_for = usedFor.join(", "); 
    }
    if(chargerData.property_type) {
        const propertyType        = chargerData.property_type?.map(item => item.label);
        chargerData.property_type = propertyType.join(", "); 
    }

    const [gallery] = await db.execute(`SELECT image_name FROM ev_charger_gallery WHERE charger_id = ? ORDER BY id DESC LIMIT 5`, [charger_id]);
    const imgName = gallery.map(row => row.image_name);
    
        
    return resp.json({
        status       : 1,
        code         : 200,
        message      : ["Details fetched successfully!"],
        chargerData : chargerData, 
        gallery_data : imgName,
        base_url     : `${process.env.DIR_UPLOADS}charger-installation/`
    });
});

// List API 
export const purchaseHistoryList = asyncHandler(async (req, resp) => {
    const { rider_id, mobile_number, page_no = 1, limit = 10, search_text=null } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id : ["required"],
        mobile_number : ["required"],
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
    // let whereField = ['customer_mobile'];
    // let whereValue = [mobile_number];
    // if(search_text){
    //     whereField.push('customer_name');
    //     whereValue.push(`%${search_text}%`);
    // }
    // if(vehicle){
    //     whereField.push('product_name');
    //     whereValue.push(`%${vehicle}%`);
    // }
    const result = await getPaginatedData({
        tableName : 'purchase_history',
        
        columns: `${formatDateInQuery(['purchase_date'])}, customer_name, customer_mobile, product_name, type_of_service, purchase_id, price, ${formatDateInQuery(['installation_date'])}`,
        sortColumn : 'id',
        sortOrder  : 'DESC',
        limit      : limit,
        page_no,
        liveSearchFields : ['customer_name', 'product_name' ],
        liveSearchTexts  : [search_text, search_text],
        whereField       : ['customer_mobile'],
        whereValue       : [mobile_number],
        whereOperator    : ['='], // 'LIKE', 'LIKE'
    });
    const newArray = result.data.map((item, index, array) => {

        const typeOfService  = item.type_of_service.map(item => item.label);
        item.type_of_service = typeOfService.join(", "); 
        return item;
    });
    return resp.json({
        status     : 1,
        code       : 200,
        message    : ["Purchase history list fetch successfully!"],
        data       : newArray, //result.data,
        total_page : result.totalPage,
        total      : result.total,
        base_url   : 'https://plusx.s3.ap-south-1.amazonaws.com/_uploads/charger-installation/' //`${process.env.DIR_UPLOADS}charger-installation/`,
        // noResultMsg : 'Secure your EV today - get insured and drive worry-free.'
    });
});

export const purchaseHistoryDetails = asyncHandler(async (req, resp) => {
    const {rider_id, purchase_id, mobile_number } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id      : ["required"], 
        purchase_id   : ["required"],
        mobile_number : ["required"],
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const purchaseDetails = await queryDB(`
        SELECT 
            purchase_id, customer_name, customer_email, customer_mobile, customer_address, 
            product_name, output_Power, price, type_of_service, purchase_invoice_pdf, installation_invoice_pdf, completion_certificate_pdf, created_at,
            ${formatDateInQuery(['purchase_date'])}, ${formatDateInQuery(['warranty_expiry_date'])}, ${formatDateInQuery(['installation_date'])}
        FROM 
            purchase_history 
        WHERE 
            purchase_id = ? AND customer_mobile = ?`, 
        [ purchase_id, mobile_number ]
    ); 
    const outputPower           = purchaseDetails.output_Power.map(item => item.label);
    purchaseDetails.outputPower = outputPower.join(", "); 

    const typeOfService           = purchaseDetails.type_of_service.map(item => item.label);
    purchaseDetails.typeOfService = typeOfService.join(", "); 

    return resp.json({
        message        : [ "Purchase histiry details fetch successfully!" ],
        purchase_data : purchaseDetails,
        status         : 1, 
        code           : 200, 
         base_url    : `${process.env.DIR_UPLOADS}charger-installation/`,
        // base_url       : 'https://plusx.s3.ap-south-1.amazonaws.com/_uploads/charger-installation/' //`${process.env.DIR_UPLOADS}charger-installation/`,
    });
});