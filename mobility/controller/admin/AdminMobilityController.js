import db from "../../../config/indiadb.js  ";
import { asyncHandler, formatDateTimeInQuery, mergeParam } from "../../../utils.js";
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { getPaginatedData, insertRecord, queryDB } from "../../../dbUtils.js";

// import jwt from 'jsonwebtoken';
import validateFields from "../../../validation.js";
import { io } from "../../../server.js";
import moment from "moment";

//AdminMobilityController.js";
export const RiderList = async (req, resp) => {
    let { page_no, sortBy, addedFrom='admin',  start_date, end_date, search_text = '' ,country_id,city_id} = req.body;
    // console.log(" req.body", req.body)

    // if(!req.db){console.log("databse required")}
    // const db=req.db;
    // const db =callDatabase(req.db)

    page_no = parseInt(page_no, 10);
    if (isNaN(page_no) || page_no < 1) {
        page_no = 1;
    }
    

    const sortOrder = sortBy === 'd' ? 'DESC' : 'ASC';

    try {
        const params = {
            tableName: 'riders',
            columns: `rider_id, CONCAT(rider_name, ' ', COALESCE(last_name, '')) AS rider_name, rider_email, country_code, rider_mobile,  profile_img, status, ${formatDateTimeInQuery(['created_at', 'updated_at'])},state,account_type
            ,(SELECT name from cities where city_id=riders.city_id and country_id=riders.country_id )as city `,
            sortColumn: 'id',
            sortOrder : "DESC",
            page_no : page_no,
            limit: 10,
            liveSearchFields: ["CONCAT(rider_name, ' ', COALESCE(last_name, ''))", 'rider_id', 'rider_email', 'rider_mobile',],
            liveSearchTexts: [search_text,search_text, search_text, search_text,],
            whereField: [],
            whereValue: [],
            whereOperator: []
        };
        if (start_date && end_date) {
            
            const startToday = new Date(start_date);
            const startFormattedDate = `${startToday.getFullYear()}-${(startToday.getMonth() + 1).toString()
                .padStart(2, '0')}-${startToday.getDate().toString().padStart(2, '0')}`;
                        
            const givenStartDateTime    = startFormattedDate+' 00:00:01';
            const modifiedStartDateTime = moment(givenStartDateTime).subtract(4, 'hours');
            const start        = modifiedStartDateTime.format('YYYY-MM-DD HH:mm:ss')
            
            const endToday = new Date(end_date);
            const formattedEndDate = `${endToday.getFullYear()}-${(endToday.getMonth() + 1).toString()
                .padStart(2, '0')}-${endToday.getDate().toString().padStart(2, '0')}`;
            const end = formattedEndDate+' 19:59:59';

            params.whereField.push('created_at', 'created_at');
            params.whereValue.push(start, end);
            params.whereOperator.push('>=', '<=');
        }
        if(addedFrom) {
            params.whereField.push('added_from');
            params.whereValue.push(addedFrom);
            params.whereOperator.push('!=');
        }
        
        if (country_id){
            params.whereField.push('country_id');
            params.whereValue.push(country_id);
            params.whereOperator.push('=');

        }
        if (city_id){
            params.whereField.push('city_id');
            params.whereValue.push(city_id);
            params.whereOperator.push('=');

        }
        // if(emirates) {
        //     params.whereField.push('emirates');
        //     params.whereValue.push(emirates);
        //     params.whereOperator.push('=');
        // }

        const result = await getPaginatedData (params);
       
        // const [emiratesResult] = await db.query('SELECT DISTINCT emirates FROM riders');
        
        return resp.json({
            status     : 1,
            code       : 200,
            message    : ["Rider list fetched successfully!"],
            data       : result.data,
            // emirates   : emiratesResult,
            total_page : result.totalPage,
            total      : result.total,
        });
    } catch (error) {
        console.error('Error fetching rider list:', error);
        return resp.status(500).json({
            status  : 0,
            code    : 500,
            message : ['Error fetching rider list'],
        });
    }
};



export const addUsers = asyncHandler(async (req, resp) => {
        try {
        const data = req.body;

            const {name,user_email,password,country,city,permison = 'view'} = data;

        const { isValid, errors } = validateFields(data, {
        name: ["required"],
        user_email: ["required"],
        password: ["required"],
        permison: ["required"],
        country: ["required"],
        city: ["required"]
        });

        if (!isValid) {
        return resp.json({ status: 0, code: 422, message: errors });
        }

        // Check if user already exists
            const [existingUsers] = await db.execute(
        'SELECT id FROM users WHERE email = ?',
        [user_email]
                );

        if (existingUsers.length > 0) {
        return resp.json({ status: 0, code: 400, message: ["User already exists."] });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        await db.execute(
        `INSERT INTO users (name, email, password, access, country, city, role_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, user_email, hashedPassword, permison, country, city, 'ROLE002'] 
        );

        return resp.json({ status: 1,code:200,  message: "User added successfully." });

    } catch (error) {
        console.error('AddUsers Error:', error);
        resp.status(500).json({ message: 'Something went wrong. Please try again later.' });
    }
});



export const usersList = async (req, resp) => {
    let { page_no, addedFrom,  start_date, end_date, search_text = '' } = req.body;

    page_no = parseInt(page_no, 10);
    if (isNaN(page_no) || page_no < 1) {
        page_no = 1;
    }
    // if(!req.db){
    //     console.log("databse required")
    // };
    // const db=req.db;
    try {
        const params = {
           
            tableName : 'users',
            columns: `name,email, phone, access, country, city,panel_link  status
            (select role FROM user_roles where role_id=users.role_id)as user_role
            `,
            sortColumn : 'id',
            sortOrder  : "DESC",
            page_no    : page_no,
            limit      : 10,
            liveSearchFields : ['name', 'phone'],
            liveSearchTexts  : [search_text, search_text, search_text, search_text, search_text],
            whereField    : [],
            whereValue    : [],
            whereOperator : []
        };
        if (start_date && end_date) {
            
            const startToday         = new Date(start_date);
            const startFormattedDate = `${startToday.getFullYear()}-${(startToday.getMonth() + 1).toString()
                .padStart(2, '0')}-${startToday.getDate().toString().padStart(2, '0')}`;
                        
            const givenStartDateTime    = startFormattedDate+' 00:00:01'; // Replace with your datetime string
            const modifiedStartDateTime = moment(givenStartDateTime).subtract(4, 'hours'); // Subtract 4 hours
            const start                 = modifiedStartDateTime.format('YYYY-MM-DD HH:mm:ss')
            
            const endToday         = new Date(end_date);
            const formattedEndDate = `${endToday.getFullYear()}-${(endToday.getMonth() + 1).toString()
                .padStart(2, '0')}-${endToday.getDate().toString().padStart(2, '0')}`;
            const end = formattedEndDate+' 19:59:59';

            params.whereField.push('created_at', 'created_at');
            params.whereValue.push(start, end);
            params.whereOperator.push('>=', '<=');
        }
        if(addedFrom) {
            params.whereField.push('added_from');
            params.whereValue.push(addedFrom);
            params.whereOperator.push('=');
        }
        // if(emirates) {
        //     params.whereField.push('emirates');
        //     params.whereValue.push(emirates);
        //     params.whereOperator.push('=');
        // }
        const result  = await getPaginatedData(params);
        // const [emiratesResult] = await db.query('SELECT DISTINCT emirates FROM riders');
        return resp.json({
            status     : 1,
            code       : 200,
            message    : ["Deleted Rider list fetched successfully!"],
            data       : result.data,
            // emirates   : emiratesResult,
            total_page : result.totalPage,
            total      : result.total,
        });
    } catch (error) {
        console.error('Error fetching rider list:', error);
        return resp.status(500).json({
            status  : 0,
            code    : 500,
            message : 'Error fetching rider list',
        });
    }
};

export const oldstateCountry = asyncHandler(async (req, resp) => {
        const {requirement,country_id}=mergeParam(req);
            let validationRules = {requirement   : ["required"],};
    
    const { isValid, errors } = validateFields(mergeParam(req), validationRules);
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
        let list;

    switch (requirement) {  
    case 'country':
        [list] = await db.execute(`SELECT country_id, name FROM country  ORDER BY name ASC`);
    return resp.json({status: 1, code: 200, data: list, message: ['country List fech successfully!']});
    case 'city':
        if (!country_id) {
    return resp.json({status: 0, code: 422,list, message: ['country_id is required for city list']});
            }
    [list] = await db.execute(`SELECT city_id,name FROM cities where country_id=? ORDER BY name ASC`,[country_id]);

    return resp.json({status: 1, code: 200, data: list, message:[ 'cities List fech successfully!']});
            
    default:
    return resp.json({ status: 0, code: 400,  message: ['Invalid Requirement type'] });

            }   
});



export const DeletedRiderList = async (req, resp) => {
    let { page_no, addedFrom,  start_date, end_date, search_text = '' ,country_id,city_id} = req.body;

    page_no = parseInt(page_no, 10);
    if (isNaN(page_no) || page_no < 1) {
        page_no = 1;
    }
    // if(!req.db){
    //     console.log("databse required")
    // };
    // const db=req.db;
    try {
        const params = {
           
            tableName : 'deleted_riders',
            // columns: `rider_id, rider_name, rider_email, country_code, rider_mobile,  profile_img, ${formatDateTimeInQuery(['created_at', 'updated_at'])},city,state,account_type`,
            columns: `rider_id, rider_name, rider_email, country_code, rider_mobile,  profile_img, status, ${formatDateTimeInQuery(['created_at', 'updated_at'])},state,account_type
            ,(SELECT name from cities where city_id=deleted_riders.city_id and country_id=deleted_riders.country_id )as city `,
            sortColumn : 'id',
            sortOrder  : "DESC",
            page_no    : page_no,
            limit      : 10,
            liveSearchFields : ['rider_name', 'last_name', 'rider_id', 'rider_email', 'rider_mobile'],
            liveSearchTexts  : [search_text, search_text, search_text, search_text, search_text],
            whereField    : [],
            whereValue    : [],
            whereOperator : []
        };
        if (start_date && end_date) {
            
            const startToday         = new Date(start_date);
            const startFormattedDate = `${startToday.getFullYear()}-${(startToday.getMonth() + 1).toString()
                .padStart(2, '0')}-${startToday.getDate().toString().padStart(2, '0')}`;
                        
            const givenStartDateTime    = startFormattedDate+' 00:00:01'; // Replace with your datetime string
            const modifiedStartDateTime = moment(givenStartDateTime).subtract(4, 'hours'); // Subtract 4 hours
            const start                 = modifiedStartDateTime.format('YYYY-MM-DD HH:mm:ss')
            
            const endToday         = new Date(end_date);
            const formattedEndDate = `${endToday.getFullYear()}-${(endToday.getMonth() + 1).toString()
                .padStart(2, '0')}-${endToday.getDate().toString().padStart(2, '0')}`;
            const end = formattedEndDate+' 19:59:59';

            params.whereField.push('created_at', 'created_at');
            params.whereValue.push(start, end);
            params.whereOperator.push('>=', '<=');
        }
        if(addedFrom) {
            params.whereField.push('added_from');
            params.whereValue.push(addedFrom);
            params.whereOperator.push('=');
        }
         if (country_id){
            params.whereField.push('country_id');
            params.whereValue.push(country_id);
            params.whereOperator.push('=');

        }
        if (city_id){
            params.whereField.push('city_id');
            params.whereValue.push(city_id);
            params.whereOperator.push('=');

        }
        const result  = await getPaginatedData(params);
        // const [emiratesResult] = await db.query('SELECT DISTINCT emirates FROM riders');
        return resp.json({
            status     : 1,
            code       : 200,
            message    : ["Deleted Rider list fetched successfully!"],
            data       : result.data,
            // emirates   : emiratesResult,
            total_page : result.totalPage,
            total      : result.total,
        });
    } catch (error) {
        console.error('Error fetching rider list:', error);
        return resp.status(500).json({
            status  : 0,
            code    : 500,
            message : 'Error fetching rider list',
        });
    }
};

export const mobilityDashboardData = async (req, resp) => {
    try {
        const currentDate = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
        const adminCheck = await queryDB("SELECT access, status FROM users WHERE id = ?", [req.body.userId] );
        if(adminCheck.access === null || adminCheck.access === '' || adminCheck.status === 0 ) {
            return resp.json({ code : 401, logout : 1, message : "logout successfully", status : 0 })
        }
        // (SELECT COUNT(*) FROM failed_cycle_booking WHERE DATE(created_at) >= ?) AS failed_charging_service,
        const [counts] = await db.execute(`SELECT 
            (SELECT COUNT(*) FROM riders WHERE added_from !='admin' and DATE(created_at) >= ? ) AS total_rider,
            (SELECT COUNT(*) FROM mobility_station_list ) AS total_station,
            (SELECT COUNT(*) FROM cycle_booking WHERE status = 'ON' and DATE(created_at) >= ?) AS on_going_bookings, 
            (SELECT COUNT(*) FROM cycle_booking WHERE status = 'PNR' and DATE(created_at) >= ?) AS incomplete_bookings, 
            (SELECT COUNT(*) FROM cycle_booking_issue WHERE DATE(created_at) >= ?) AS support_bookings`, [ currentDate, currentDate, currentDate, currentDate ]
        );
        const [onGoingRide] = await db.execute(`
            SELECT 
                id,rider_id, booking_id, user_name, user_email, country_code, contact_no, status, start_lat AS lat, start_long AS lng 
            FROM cycle_booking 
            WHERE status In('ON') and created_at >= ?`, [currentDate]
        );
        const location = onGoingRide.map((onGoing, i) => ({
            key         : onGoing.booking_id,
            rider_id    : onGoing.rider_id,
            rider_name  : onGoing.user_name,
            booking_id  : onGoing.booking_id,
            email       : onGoing.user_email,
            countryCode : onGoing.country_code,
            mobile      : onGoing.contact_no,
            status      : onGoing.status,
            location    : { lat: parseFloat(onGoing.lat), lng: parseFloat(onGoing.lng) },
        }));
        const count_arr = [ 
            { module : 'App Sign Up',    count : counts[0].total_rider },
            { module : 'No Of Station',  count : counts[0].total_station },
            { module : 'No Of Support',  count : counts[0].support_bookings },
            { module : 'On Going Rides', count : counts[0].on_going_bookings },
            { module : 'Incomplete Booking', count : counts[0].incomplete_bookings },
        ];
        io.emit('notification-list', {msCount : 1});
       
        return resp.json({code : 200, data : {count_arr, location}});

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        resp.json({ status :  0, code : 500, message: 'Error fetching dashboard data' });
    }
};

export const riderDetails = async (req, resp) => {
    const { riderId } = req.body;

    if (!riderId) {
        return resp.status(200).json({ status : 0, code : 400, message : ['Rider ID is required'] });
    }
    try {

        var [rows] = await db.execute( `
            SELECT 
                rider_id, rider_name, last_name, rider_email, country_code, rider_mobile 
            FROM 
                riders 
            WHERE 
                rider_id = ?`, 
        [riderId] );
        if (rows.length === 0) {
            var [rows2] = await db.execute( `
                SELECT 
                    rider_id, rider_name, last_name, rider_email, country_code, rider_mobile
                FROM 
                    deleted_riders 
                WHERE 
                    rider_id = ?`,
            [riderId] );
            rows = rows2;
        }
        if (rows.length === 0) {
            return resp.status(200).json({ status : 0, code : 404, message : 'Rider not found' });
        }
        const [riderAddress] = await db.execute(
            `SELECT 
                address_id, street_name, emirate, area, building_name, unit_no, landmark, nick_name, latitude, longitude
            FROM 
                rider_address 
            WHERE 
                rider_id = ?`, 
            [riderId]
        );
        var [riderVehicles] = await db.execute(
            `SELECT 
                vehicle_id, vehicle_type, vehicle_number, vehicle_code, vehicle_model, vehicle_make, vehicle_specification, emirates
            FROM 
                riders_vehicles
            WHERE 
                rider_id = ?`, 
            [riderId]
        );
        const [chargerRows] = await db.execute(
            `SELECT 
                pcb.booking_id, rsa.rsa_name, pcb.vehicle_id, pcb.service_name, ROUND(pcb.service_price/100, 2) AS service_price, pcb.service_type, pcb.status, 
                ${formatDateTimeInQuery(['pcb.created_at'])}
            FROM 
                portable_charger_booking pcb
            Left JOIN 
                rsa ON pcb.rsa_id = rsa.rsa_id
            WHERE 
                pcb.rider_id = ?
            ORDER BY 
                pcb.created_at DESC
            LIMIT 5`, 
            [riderId]
        );
        const [chargingServiceRows] = await db.execute(
            `SELECT 
                cs.request_id, rsa.rsa_name, cs.vehicle_id, cs.order_status,
                ROUND(cs.price / 100, 2) AS price,
                ${formatDateTimeInQuery(['cs.created_at'])}
            FROM 
                charging_service cs
            Left JOIN 
                rsa ON cs.rsa_id = rsa.rsa_id
            WHERE 
                cs.rider_id = ?
            ORDER BY 
                cs.created_at DESC
            LIMIT 5`,
            [riderId]
        );
        const [rsaBookings] = await db.execute(
            `SELECT 
                request_id, vehicle_id, ROUND(price/100, 2) AS price, order_status, 
                ${formatDateTimeInQuery(['created_at'])}, 
                (SELECT rsa_name FROM rsa WHERE rsa_id = road_assistance.rsa_id) AS rsa_name 
            FROM 
                road_assistance 
            WHERE 
                rider_id = ?
            ORDER BY 
                created_at DESC 
            LIMIT 5`, 
            [riderId]
        );
        const rider = {
            rider_id      : rows[0].rider_id,
            rider_name    : rows[0].rider_name,
            rider_email   : rows[0].rider_email,
            rider_mobile  : rows[0].rider_mobile,
            country_code  : rows[0].country_code,
            emirates      : rows[0].emirates,

            portableChargerBookings : chargerRows,
            pickAndDropBookings     : chargingServiceRows,
            riderAddress,
            riderVehicles,
            rsaBookings 
        };
        return resp.json({ status : 1, code : 200, data : rider });
    } catch (error) {
        console.error('Error fetching rider details:', error);
        return resp.status(500).json({ status : 0, code : 500, message : ['Error fetching rider details'], });
    }
};
