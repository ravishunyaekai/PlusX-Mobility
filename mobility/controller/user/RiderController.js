import moment from "moment";
import dotenv from "dotenv";
import db from "../../../config/indiadb.js";
import validateFields from "../../../validation.js";
import { formatFloatInQuery, insertRecord, queryDB, } from '../../../dbUtils.js';
import { mergeParam, formatDateTimeInQuery, formatDateInQuery, asyncHandler }from '../../../utils.js';
dotenv.config();

// import { tryCatchErrorHandler } from "../../../middleware/errorHandler.js";
 
export const routeLogs = asyncHandler(async (req, resp) => {
    const { booking_id, latitude, longitude } = req.body;

    const { isValid, errors } = validateFields(req.body, { 
        booking_id : ["required"],
        latitude   : ["required"],
        longitude  : ["required"]
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors }); 
     
    const insertParams = { booking_id, latitude, longitude }
    const columns      = Object.keys(insertParams);
    const values       = Object.values(insertParams);
    await insertRecord('route_logs', columns, values);

    return resp.json({ status: 1, code: 200, booking_id, message: 'Cycle logs created successfully.' });
});

export const fetchRouteLogs = asyncHandler(async (req, resp) => {
    const { booking_id} = req.body;
    const { isValid, errors } = validateFields(req.body, { 
        booking_id: ["required"],
    });
    if (!isValid) { return resp.json({ status: 0, code: 422, message: errors });}

    const [route_logs] = await db.execute(`
        SELECT booking_id, latitude, longitude 
        FROM route_logs 
        WHERE booking_id = ? `, [ booking_id ] 
    );
    return resp.json({ status: 1, code: 200, logs : route_logs, message: 'Cycle logs created successfully.' });
});

export const bookingList = asyncHandler(async (req, resp) => {
    const {rider_id, page_no, search_text, status='', sort_by='desc' } = mergeParam(req);
        
    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id: ["required"], page_no: ["required"]
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const limit = 10;
    const start = (page_no * limit) - limit;
    
    let countQuery = `SELECT COUNT(*) AS total FROM cycle_booking where rider_id=?`;
    let countParams = [rider_id];
    if (search_text && search_text.trim() !== '') {
        countQuery += " WHERE station_name LIKE ?";
        countParams.push(`%${search_text}%`);
    }
    const [[{ total }]] = await db.execute(countQuery, countParams);
    const total_page  = Math.ceil(total / limit) || 1;
    const statusArray = status ? status.split(',').map(s => s.trim()) : [];
     
    let query = `
        SELECT 
            booking_id, user_name, contact_no, pickup_station, dropoff_station, start_lat, 
            start_long, end_lat, end_long, created_at, account_type, distance, university, status, country, city, cycle_type, cycle_id,  
            ${formatFloatInQuery('per_min_cost')} AS base_price, 
            ${formatFloatInQuery('base_duration')} as base_duration, 
            ${formatFloatInQuery('price')} as price,
            DATE_FORMAT(pick_time, '%Y-%m-%d %H:%i:%s') AS pick_time,
            DATE_FORMAT(drop_time, '%Y-%m-%d %H:%i:%s') AS drop_time
        FROM cycle_booking
        WHERE rider_id = ? 
    `;
    let queryParams = [ rider_id ];
    
    if (status && status.trim() !== '') {
    
        const placeholders = statusArray.map(() => '?').join(','); 
        query += ` AND status IN (${placeholders})`;
        queryParams.push(...statusArray);
    }
    if (search_text && search_text.trim() !== '') {
        query += " WHERE station_name LIKE ?";
        queryParams.push(`%${search_text}%`);
    }
    const sortOrder = (sort_by === 'desc') ? 'DESC' : 'ASC';
    query += ` ORDER BY id ${sortOrder} LIMIT ${start}, ${limit}`;

    console.log(query)
    console.log(queryParams)
    const [bookings] = await db.execute(query, queryParams);

    return resp.json({
        message : ["Booking list List fetched successfully!"],
        data    : bookings,
        total_page,
        status   : 1,
        code     : 200,
    }); 
});

export const cycleBookingDetail = asyncHandler(async (req, resp) => {
    const {rider_id, booking_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], booking_id: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
    const booking = await queryDB(`
        SELECT 
            booking_id, status, country, city, cycle_type, cycle_id, time_taken, user_name, contact_no, pickup_station, dropoff_station, start_lat, start_long, end_lat, end_long, 
            account_type, distance, university, updated_at, pick_address, drop_address,
            ${formatDateTimeInQuery(['created_at'])},
            DATE_FORMAT(pick_time, '%Y-%m-%d %H:%i:%s') AS pick_time,
            DATE_FORMAT(drop_time, '%Y-%m-%d %H:%i:%s') as drop_time,
            ${formatFloatInQuery('per_min_cost')} as base_price,
            ${formatFloatInQuery('post_price')} as post_price,
            ${formatFloatInQuery('base_duration')} as base_duration, 
            ${formatFloatInQuery('price')} as price
        FROM cycle_booking
        WHERE rider_id = ? AND booking_id = ? 
        LIMIT 1`, [ rider_id, booking_id ]
    );
    const [history] = await db.execute(`
        SELECT status, ${formatDateTimeInQuery(['created_at'])}
        FROM booking_history 
        WHERE booking_id = ?`, 
        [booking_id]
    );
    const [route_logs] = await db.execute(`
        SELECT latitude, longitude 
        FROM route_logs 
        WHERE booking_id = ? `, [ booking_id ] 
    );
    const data             = { booking, history, route_logs }
    data.booking.pick_time = moment(booking.pick_time).format("YYYY-MM-DD HH:mm:ss");
    booking.drop_time ? data.booking.drop_time = moment(booking.drop_time).format("YYYY-MM-DD HH:mm:ss") : null;

    const time_taken    = booking.time_taken;
    const base_duration = Number(booking.base_duration);
    const base_price    = parseFloat(booking.base_price);
    const post_price    = parseFloat(booking.post_price);
     
    let total_cost      = base_price;
    let additionalPrice = 0;
    if( time_taken > base_duration ){  
        const time_after_base_duration = time_taken - base_duration;
        total_cost                     = base_price + (time_after_base_duration * post_price);
        additionalPrice                = time_after_base_duration * post_price;
    }
    data.booking.additionalPrice = additionalPrice.toFixed(2);
    data.booking.taxPrice        = (total_cost.toFixed(2) == booking.price.toFixed(2) ) ? 0 : (total_cost * 0.18).toFixed(2); 

    data.booking.additional_price_text = `${booking.post_price}/min`
    data.booking.tax_text              = (total_cost.toFixed(2) == booking.price.toFixed(2) ) ? `0%` : `18%` //

    return resp.json({
        message : ["Cycle Booking Details fetched successfully!"],
        data,
        status : 1,
        code   : 200,
    });
});

export const cycleBookingHistory = asyncHandler(async (req, resp) => {
    const {rider_id, page_no, bookingStatus } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id      : ["required"], 
        page_no       : ["required"],
        bookingStatus : ["required"]
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const limit           = 10;
    const start           = ( page_no * limit ) - limit;

    let statusCondition = (bookingStatus == 'CM' ) ? `status IN (?, ?, ?)` : `status IN (?)`;
    let statusParams    = (bookingStatus == 'C' ) ? ['C'] : ['RO', 'PU', 'CC'];
    statusParams        = (bookingStatus == 'S' ) ? ['CNF'] : statusParams;

    // const statusCondition = (history && history == 1) ? `status IN (?, ?, ?)` : `status NOT IN (?, ?, ?)`;
    // const statusParams    = ['PU', 'C', 'RO'];
    const orderBy = 'ORDER BY id ASC'; //(bookingStatus == 'CM' ) ? 'ORDER BY slot_date ASC, slot_time ASC' : 'ORDER BY id DESC';

    const totalQuery = `SELECT COUNT(*) AS total FROM portable_charger_booking WHERE rider_id = ? AND ${statusCondition}`;
    
    const [totalRows] = await db.execute(totalQuery, [rider_id, ...statusParams]);
    const total       = totalRows[0].total;
    const totalPage   = Math.max(Math.ceil(total / limit), 1);

    const bookingsQuery = `SELECT rescheduled_booking, booking_id, service_name, ROUND(portable_charger_booking.service_price/100, 2) AS service_price, service_type, user_name, country_code, contact_no, slot_time, status, 
        ${formatDateTimeInQuery(['created_at'])}, ${formatDateInQuery(['slot_date'])}
        FROM portable_charger_booking WHERE rider_id = ? AND ${statusCondition} ${orderBy} LIMIT ${parseInt(start)}, ${parseInt(limit)}
    `;
    const [bookingList] = await db.execute(bookingsQuery, [rider_id, ...statusParams]);

    const inProcessQuery = `SELECT rescheduled_booking, booking_id, service_name, ROUND(portable_charger_booking.service_price/100, 2) AS service_price, service_type, user_name, country_code, contact_no, slot_time, status, 
        ${formatDateTimeInQuery(['created_at'])}, ${formatDateInQuery(['slot_date'])}
        FROM portable_charger_booking WHERE rider_id = ? AND status NOT IN (?, ?, ?, ?, ?, ?) ${orderBy} LIMIT ${parseInt(start)}, ${parseInt(limit)}
    `;
    const inProcessParams    = ['CNF', 'C', 'PU', 'RO', 'PNR', 'CC'];
    const [inProcessBookingList] = await db.execute(inProcessQuery, [rider_id, ...inProcessParams]);

    return resp.json({
        message    : ["Cycle Booking List fetched successfully!"],
        data       : bookingList,
        total_page : totalPage,
        inProcessBookingList,
        status     : 1,
        code       : 200,
        base_url   : `${req.protocol}://${req.get('host')}/uploads/portable-charger/`,
        noResultMsg : 'There are no recent bookings. Please schedule your booking now.'
    });
});


