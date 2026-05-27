import moment from "moment-timezone";
import db from "../../../config/indiadb.js";

import validateFields from "../../../validation.js";
import { insertRecord, queryDB, updateRecord } from '../../../dbUtils.js';
import { mergeParam, checkNumber, generateOTP, storeOTP, getOTP, delOTP, sendOtp, formatDateInQuery, asyncHandler, pushNotification, sendNotification }from '../../../utils.js';

import client, { io } from "../../../server.js";
import { NOTIFICATION_CONTENT } from "../../../common/controller/notificationContent.js";
import emailQueue from "../../../emailQueue.js";
import dotenv from 'dotenv';
dotenv.config();

import { tryCatchErrorHandler } from "../../../middleware/errorHandler.js";

export const lockerUpdate = asyncHandler(async (req, resp) => {
    try {
        const [lockers] = await db.execute(`
            SELECT station_id, lock_number, qr_image 
            FROM locker_qr_image 
            ORDER BY id DESC`
        );
        return resp.json({ status: 1, message: 'locker data', lockers, });
    } catch (error) {
        console.log("Locker Update Error:", error);
        return resp.json({ status: 0, message: "Error updating locker", error: error.message });
    }
});

export const startScanCycleQr = asyncHandler(async (req, resp) => {
    const { rider_id, qrcode} = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), { 
        rider_id : ["required"],
        qrcode   : ["required"],   
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
    const pricing_details = await queryDB(`
        SELECT 
            coun.min_wallet_price as min_price, cl.battery_health, r.out_standing_cost, r.rider_email, 
            r.rider_mobile, r.university, r.device_name, ct.name AS city, cl.cycle_id, r.rider_name,
            r.account_type, coun.name AS country_name, msl.station_name as pickup_station, msl.address, 
            cl.cycle_type, cl.id, cl.station_id, r.amount AS wallet_balance, cp.base_price, cp.base_duration,
            cp.post_price, msl.open_time, msl.close_time
        FROM cycle_list cl
        JOIN riders r ON r.rider_id = ?
        JOIN mobility_station_list msl ON msl.station_id = cl.station_id
        JOIN country coun ON coun.country_id = cl.country_id
        JOIN cities ct ON cl.city_id = ct.city_id 
        JOIN cycle_pricing cp ON cp.type_of_cycle = cl.cycle_type and cl.station_id=cp.station_id
        WHERE cl.cycle_id = ? and cl.lock_number != '' limit 1 `, [ rider_id, qrcode ]
    );
    console.log("pricing_details",pricing_details)
    if (!pricing_details) return resp.json({ status: 0,error_type : 'invaild-QR', code: 201, message: ['The cycle QR code is incorrect. Please scan the correct QR code.'] });

    // const currTime  = moment().tz('Asia/Kolkata').format('HH:mm:ss');
    const currTime = moment().add(5, 'hours').add(30, 'minutes').format('HH:mm:ss');
    
    if (currTime < pricing_details.open_time || currTime > pricing_details.close_time) {

        const formatTime = (time) => {
            const [hour, minute] = time.split(':');
            let h = parseInt(hour);
            const ampm = h >= 12 ? 'PM' : 'AM';

            h = h % 12 || 12;

            return minute === "00"
                ? `${h} ${ampm}`
                : `${h}:${minute} ${ampm}`;
        };
        const open_time  = pricing_details.open_time;
        const close_time = pricing_details.close_time;

        const errContent= await queryDB(`
            SELECT content 
            FROM response_content 
            WHERE sub_module = ? AND module_name = ? `, ["slot-error", "mobility-slot-booking"]
        );
        errContent.content = errContent.content.replace("10 AM", formatTime(open_time)) .replace("7 PM", formatTime(close_time));

        return resp.json({ status: 0, code : 201, error_type : 'invalid slot', message: [errContent.content || ""] });
    }
    const [booking] = await db.execute(`
        SELECT status, created_at
        FROM cycle_booking
        WHERE rider_id = ?
        AND (
                status IN ('ON', 'END')
                OR (status = 'PNR' AND created_at >= NOW() - INTERVAL 2 MINUTE)
            )
        `, [rider_id]
    );
    if(booking.length > 0 ) {

        const errContent= await queryDB(`
            SELECT content 
            FROM response_content 
            WHERE sub_module = ? AND module_name = ? `, ["cycle-scan-error", "mobility-scan-booking"]
        );
        return resp.json({ status: 0, code: 201, error_type : 'hold for 2 min', message: [errContent.content || ""] });
    }
    const out_standing_cost = parseFloat(pricing_details.out_standing_cost);
        
    if(out_standing_cost > 0){
        return resp.json({ status: 0, code: 201, error_type:'balance', message: [`Please clear your pending balance to start a new ride.`] });
    }

    // if (Number(pricing_details.wallet_balance) < pricing_details.min_price) {
    //     return resp.json({ status: 0, code: 201, error_type : 'balance', message: ['Please recharge your wallet to continue.'] });
    // }
    return resp.json({ status: 1, code: 200, cycle_id : pricing_details.cycle_id, message : ['Cycle verified successfully.'] });
});

export const startScanLocker = asyncHandler(async (req, resp) => {
    const { rider_id, station_id, cycle_id, lock_number } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), { 
        rider_id    : ["required"],
        cycle_id    : ["required"],
        station_id  : ["required"],
        lock_number : ['required']
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const [booking] = await db.execute(`
        SELECT status, created_at
        FROM cycle_booking
        WHERE rider_id = ?
        AND (
                status IN ('ON', 'END')
                OR (status = 'PNR' AND created_at >= NOW() - INTERVAL 2 MINUTE)
            )
        `, [rider_id]
    );
    if(booking.length > 0 ) {

        const errContent= await queryDB(`
            SELECT content 
            FROM response_content 
            WHERE sub_module = ? AND module_name = ? `, ["cycle-scan-error", "mobility-scan-booking"]
        );
        return resp.json({ status: 0, code: 201, error_type : 'hold for 2 min', message: [errContent.content || ""] });
    }
    const locker_available = await queryDB(`
        SELECT id 
        from cycle_locker 
        where station_id = ? and updated_at >= NOW() - INTERVAL 5 MINUTE `, [ station_id ] 
    );
    if(!locker_available) return resp.json( { status : 0, code : 201, message : [ 'Lockers are currently offline. Please try again shortly' ] } );
    
    const locker_data = await queryDB(`
        SELECT
            cl.gateway_id, cls.lock_number, cl.solenoid_id, msl.latitude, msl.longitude, 
            msl.station_name as pickup_station, msl.address, ct.name AS city
        FROM cycle_locker cl
        JOIN mobility_station_list msl ON msl.station_id = cl.station_id
        LEFT JOIN cities ct ON ct.city_id = msl.city_id
        LEFT JOIN cycle_list cls ON cls.cycle_id = ? AND cls.lock_number = ?
        WHERE cl.station_id = ?
        ORDER BY cl.id DESC 
        LIMIT 1`, [ cycle_id, lock_number, station_id ]
    );
    if(!locker_data) return resp.json({status : 0, code : 201, error_type : 'invaild-QR', message : ['The locker QR code is incorrect. Please scan the correct QR code.']});
            
    if( locker_data.lock_number != lock_number ) return resp.json({status:0 ,code:201,message:['This cycle is not parked at given locker!']})

    const pricing_details = await queryDB( `
        SELECT 
            CONCAT(r.rider_name, ' ', r.last_name) AS rider_name, r.rider_mobile, r.account_type, r.university,
            r.amount AS wallet_balance, ct.name AS city, coun.name AS country_name, cl.cycle_type,
            cp.base_price, cp.min_price, cp.base_duration, cp.post_price 
        FROM cycle_list cl
        JOIN riders r ON r.rider_id = ?
        JOIN country coun ON coun.country_id = cl.country_id
        JOIN cities ct ON cl.city_id = ct.city_id 
        LEFT JOIN cycle_pricing cp ON cp.type_of_cycle = cl.cycle_type and cl.station_id = cp.station_id
        WHERE cl.cycle_id = ? limit 1 `, [ rider_id, cycle_id ]
    );
    const area_price = await queryDB(`
        SELECT 
            cap.min_price, cap.base_duration, cap.post_price
        FROM cycle_area_price cap
        JOIN cycle_list cl 
            ON cl.cycle_type = cap.cycle_type and (cl.country_id = cap.country_id OR cap.city_id  = cl.city_id  )
        WHERE cap.status = 1 AND cl.cycle_id = ?
        LIMIT 1`, [cycle_id]
    );
    const min_price  = area_price ? area_price.min_price  : pricing_details.min_price;
    if (Number(pricing_details.wallet_balance) < Number(min_price)) {
        return resp.json({ status : 0, code : 201, error_type : 'balance', message : ['Please recharge your wallet to start your ride.'] });
    }
    const post_price    = area_price ? area_price.post_price : pricing_details.post_price;
    const base_duration = area_price ? area_price.base_duration : pricing_details.base_duration;

    const insertParams   = {
        rider_id,
        country        : pricing_details.country_name,
        cycle_type     : pricing_details.cycle_type,
        cycle_id       : cycle_id,
        price          : 0,
        user_name      : pricing_details.rider_name,
        contact_no     : pricing_details.rider_mobile,
        pickup_station : locker_data.pickup_station,
        pick_address   : locker_data.address,  
        status         : "PNR",
        city           : locker_data.city,
        account_type   : pricing_details.account_type,
        university     : pricing_details.university,
        pick_time      : moment().tz('Asia/Kolkata').format("YYYY-MM-DD HH:mm:ss"),
        base_duration  : base_duration,
        start_lat      : locker_data.latitude,
        start_long     : locker_data.longitude,
        per_min_cost   : pricing_details.base_price,
        post_price     : post_price
    }
    const columns = Object.keys(insertParams);
    const values  = Object.values(insertParams);
    const insert  = await insertRecord('cycle_booking', columns, values);

    if(insert.affectedRows == 0) return resp.json({status:0, message: "Something went wrong!"});
    
    const booking_id = 'PMB' + String(insert.insertId).padStart(4, '0');
    await updateRecord('cycle_booking', { booking_id : booking_id }, ['id'], [insert.insertId] ); 
    
    await updateRecord('cycle_list', { device_status : 1 }, [ 'cycle_id' ], [ cycle_id ] ); 

    client.publish(`/supro/plusxm/slock/${locker_data.solenoid_id}/${lock_number}`, "ON", { qos: 0, retain: false });

    const payload = `ON,${cycle_id}`;

    let count = 0;
    const interval = setInterval(() => {
        client.publish(`/supro/GW/${locker_data.gateway_id}/UP`, payload, { qos: 0, retain: false });
        count++;
        if (count === 3) {
            clearInterval(interval); // stop after 3 times
        }
    }, 1000); // 1 second gap

    setTimeout(() => {
        startBookingCheck (rider_id, booking_id, station_id, lock_number) ;   //rider_id, station_id, lock_number 

    }, 60000); // 60 seconds

    return resp.json({ status: 1, code: 200, booking_id, station_name : locker_data.pickup_station, message: ['Locker unlocked successfully'] });
});

export const startBooking = asyncHandler(async (req, resp) => {
    const { rider_id, station_id, lock_number, booking_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), { 
        rider_id    : ["required"],
        station_id  : ["required"],
        lock_number : ['required'],
        booking_id  : ['required']
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const locker_data = await queryDB(`
        SELECT station_id, ${lock_number} 
        FROM cycle_locker
        WHERE station_id = ?
        ORDER BY id DESC 
        LIMIT 1`, [station_id ] 
    );
    // if( locker_data[lock_number] != 0 ) { 
    //     return resp.json({status : 0, code : 201, message : [`Cycle still in the dock? Looks like the cycle wasn't removed within 60 seconds.`]});
    // }
    const bookingData = await queryDB( `
        SELECT 
            b.user_name, b.contact_no, b.cycle_id, b.pick_time, b.pickup_station, 
            b.start_lat, b.start_long, r.fcm_token
        FROM cycle_booking b 
        JOIN riders r ON r.rider_id = b.rider_id
        WHERE booking_id = ? AND b.rider_id = ? AND b.status = ? 
        LIMIT 1 `, [ booking_id, rider_id, 'PNR' ]
    );
    if(!bookingData) return resp.json({status : 1, code : 200, message : ['Your ride has started successfully!']});
     
    await updateRecord('cycle_booking', { status : "ON" }, ['booking_id'], [booking_id] );  

    await insertRecord('booking_history',
        ['booking_id', 'rider_id', 'status', 'description'],
        [booking_id, rider_id, "ON", { station_id : locker_data.station_id, cycle_id : bookingData.cycle_id, lock_number } ]
    );
    await updateRecord('cycle_list', { status : 0, lock_number : null }, ['cycle_id'], [bookingData.cycle_id] );  

    await sendNotification("USER_ON_GOING", { booking_id }, rider_id, rider_id )
    await sendNotification("ADMIN_ON_GOING", { booking_id }, rider_id, '' )
    io.emit('notification-list', { msCount : 1 } );

    const template = NOTIFICATION_CONTENT["USER_ON_GOING"];
    
    await pushNotification(bookingData.fcm_token, template.heading({booking_id}), template.desc, 'RDRFCM', template.href({booking_id}) );
  
    const admin_mail_template = NOTIFICATION_CONTENT["ADMIN_RIDE_START_EMAIL"];

    emailQueue.addEmail(process.env.MAIL_MOBILITY_ADMIN, admin_mail_template.subject({booking_id}), admin_mail_template.content({
        booking_id,
        rider_name      : bookingData.user_name, 
        rider_mobile    : bookingData.contact_no, 
        cycle_id        : bookingData.cycle_id, 
        cycle_pick_time : moment(bookingData.pick_time).format("hh:mm A"),
        pickup_station  : bookingData.pickup_station,
        latitude        : bookingData.start_lat,
        longitude       : bookingData.start_long
    }));
    return resp.json({ status: 1, code: 200, booking_id, message: ['Your ride has started successfully!'] });
});

export const stopeRide = asyncHandler(async (req, resp) => {
    const { rider_id, booking_id, latitude, longitude} = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), { 
        booking_id : ["required"],
        latitude   : ["required"],
        longitude  : ["required"],    
    });        
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    const oldBooking = await queryDB(
        `SELECT EXISTS ( SELECT 1 FROM cycle_booking WHERE status = 'END' AND booking_id = ?
        ) AS active`, [booking_id]
    );
    if(oldBooking.active === 1 ) { 
        return resp.json({ status: 0, code: 422, message: ["Your ride has been already Ended!"] });
    }
    const bookingDetail = await queryDB(`
        SELECT 
           r.fcm_token, cb.base_duration, cb.post_price, cb.rider_id, r.amount as wallet_balance, cb.start_lat,cb.per_min_cost, cb.start_long, cb.pick_time, cb.cycle_id, cb.booking_id
        FROM cycle_booking cb
        JOIN riders r on r.rider_id = cb.rider_id  
        WHERE cb.booking_id = ?`, [booking_id]
    );
    const pick_time  = bookingDetail.pick_time; 
    const pickMoment = moment(pick_time, "YYYY-MM-DD HH:mm:ss", "Asia/Kolkata");
    const end_time   = moment().tz('Asia/Kolkata').format("YYYY-MM-DD HH:mm:ss");
    const now        = moment().tz('Asia/Kolkata');
    pickMoment.set({ year : now.year(), month: now.month(), date: now.date()});
    const diffInMinutes = now.diff(pickMoment, 'minutes');
    
    const base_duration  = Number(bookingDetail.base_duration);
    const base_price     = parseFloat(bookingDetail.per_min_cost);
    const post_price     = parseFloat(bookingDetail.post_price);
    const wallet_balance = parseFloat(bookingDetail.wallet_balance)

    let total_cost = base_price
    if(diffInMinutes > base_duration ) {
        const time_after_base_duration = diffInMinutes - base_duration;
        total_cost = base_price + time_after_base_duration * post_price;  
    }
    total_cost          = parseFloat(total_cost.toFixed(2));
    const gst          = total_cost * 0.18;
    const final_amount = (total_cost + gst).toFixed(2); 

    const remaning_cost = wallet_balance - final_amount < 0 ? 0 : wallet_balance - final_amount;
    let out_standing_cost = 0;
     
    if( wallet_balance < final_amount ) {
        out_standing_cost = final_amount - wallet_balance;
    }
    const bookingParams = {
        price      : final_amount,
        status     : "END",
        end_lat    : latitude, 
        end_long   : longitude,
        drop_time  : end_time,
        time_taken : diffInMinutes,
    }
    const update_booking = await updateRecord('cycle_booking', bookingParams , ['booking_id'], [booking_id] );
    
    await insertRecord('transaction_history', 
        ['rider_id', 'amount', 'payment_type', 'order_id', "outstanding", "current_balance", "prev_balance"], 
        [rider_id, final_amount, 'debt',  booking_id, out_standing_cost, remaning_cost, wallet_balance]
    );         
    // await db.execute(`insert into transaction_history (rider_id,amount,payment_type,order_id) values(?,?,?,?)`,[rider_id,total_cost,'debt',booking_id])

    const update_rider = await db.execute(`
        UPDATE riders 
        SET amount = ?, out_standing_cost = out_standing_cost + ? 
        WHERE rider_id = ?`, 
        [parseFloat(remaning_cost.toFixed(2)), parseFloat(out_standing_cost.toFixed(2)), rider_id]
    );
    if(!update_rider && !update_booking ){
        return resp.json({ status:0, code: 400, message: ['Booking was not Stopped !'] });
    }  
    await insertRecord('booking_history', ['booking_id', 'rider_id', 'status'],[booking_id, rider_id, "END"]);
     
    // const heading = 'Ride Stopped Successfully';
    // const desc = `Booking ID: ${booking_id}`;
    // const href=`ride/ride-booking-details/${booking_id}`;
    return resp.json({ status:1, code: 200, message: ['Booking has been stoped successfully!'] });

});
 
export const completeCycleQr = asyncHandler(async (req, resp) => {
    try {
        const { rider_id, qr_code, booking_id } = mergeParam(req);
        const { isValid, errors } = validateFields(mergeParam(req), { 
            booking_id : ["required"],
            qr_code    : ["required"], 
        });
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors }); 
        
        const oldBooking=await queryDB(`
            SELECT cb.status, cb.cycle_id as booked_cycle_id, cl.cycle_id 
            FROM cycle_booking cb 
            JOIN cycle_list cl on cl.cycle_id=?
            WHERE  booking_id = ?`, [qr_code,booking_id]
        );
        if( !oldBooking ) {
            return resp.json({ status: 0, code: 201, message: ["This QR code doesn't match our system. Please scan the correct PlusX Cycle QR code."] });
        }
        if( oldBooking.booked_cycle_id !== oldBooking.cycle_id ) { 
            return resp.json({ status: 0, code: 422, message: ["This is not the same cycle you booked earlier!"] });
        }
        if( oldBooking.status === "CMP" ) {
            return resp.json({ status: 0, code: 422, message: ["Your ride has been already completed!"] });
        }
        return resp.json({ status:1, code: 200, cycle_id : oldBooking.cycle_id, message: [`Cycle verified successfully!`] });
    } catch(error) {
        return resp.json({ status : 0, code: 500, message: [`Something went wrong`] });
    }
})

export const lockerAvailable= asyncHandler(async(req,resp)=>{
    const { station_id, lock_number, cycle_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {
        lock_number : ["required"], 
        station_id  : ["required"],
        cycle_id    : ["required"]
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
    const cycle_check = await queryDB(`
        SELECT id
        FROM cycle_list
        WHERE station_id = ? and lock_number = ? `, [ station_id, lock_number ] 
    );
    if( !cycle_check ) {
        return resp.json({ status: 1, code: 200, message: ["Locker is unoccupied ! "] });
    }
    return resp.json({ status: 0, code: 201, message: ["This locker is already in use. Please scan the correct locker to end your ride"] });  
}) 

export const completeLockerQr = asyncHandler(async (req, resp) => {

    const { rider_id, cycle_id, station_id, booking_id, latitude, longitude, lock_number } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), { 
        booking_id  : ["required"],
        latitude    : ["required"],
        longitude   : ["required"],
        station_id  : ["required"],
        lock_number : ["required"]
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    const locker_available = await queryDB(`
        SELECT id 
        from cycle_locker 
        where station_id = ? and updated_at >= NOW() - INTERVAL 5 MINUTE `, [station_id]
    );
    if(!locker_available){
        return resp.json({ status : 0, code : 201, message : ['Lockers are currently offline. Please try again shortly']}) 
    }
    const check_locker = await queryDB(`
        SELECT ${lock_number}, gateway_id 
        from cycle_locker 
        where station_id = ?`, [station_id]
    ); 
    if( !check_locker ) {
        return resp.json({status:0,code:201,error_type:"invalid-QR", message:['The locker QR code is incorrect. Please scan the correct QR code.']}) 
    }
    const bookingDetail = await queryDB(`
        SELECT
            cb.start_lat, cb.per_min_cost, cb.start_long, cb.pick_time, cb.cycle_id, cb.post_price, 
            cb.base_duration, r.rider_email, CONCAT(r.rider_name, ' ', r.last_name) AS rider_name, 
            r.fcm_token, cb.pickup_station, cb.rider_id, r.amount as wallet_balance, cb.status,   
            6371 * ACOS(
                COS(RADIANS(?)) * COS(RADIANS(cb.start_lat)) * COS(RADIANS(cb.start_long) - RADIANS(?)) +
                SIN(RADIANS(?)) * SIN(RADIANS(cb.start_lat))
            ) AS distance
        FROM cycle_booking cb
        JOIN riders r on r.rider_id = cb.rider_id
        WHERE cb.booking_id = ? limit 1`, [latitude, longitude, latitude, booking_id]
    );
    if(!bookingDetail) return resp.json({ status: 0, code: 422, message: ["Booking not found!"] });   
    if(bookingDetail.status === "CMP" ) {
        return resp.json({ status: 0, code: 422, message: ["Your ride has been already completed!"] });
    }
    const query = `
        SELECT 
            cl.station_id, msl.latitude, msl.longitude, msl.station_name as dropoff_station, msl.address,
            cl.${lock_number}, msl.state_id
        FROM cycle_locker cl
        JOIN mobility_station_list msl  on msl.station_id = cl.station_id
        WHERE cl.${lock_number} = 1 AND cl.station_id = ? AND cl.updated_at >= NOW() - INTERVAL 15 MINUTE
        ORDER BY cl.updated_at DESC 
        LIMIT 1
    `;
    const cycle_lock = await queryDB(query,[station_id]);       
    if(!cycle_lock){
        return resp.json({status:0,code:201, message:['Sorry this cycle is not locked at given locker!']})
    }
    const pick_db_ime = bookingDetail.pick_time;
    const pickMoment  = moment(pick_db_ime, "YYYY-MM-DD HH:mm:ss", "Asia/Kolkata");

    const nowMoment = moment().add(5, 'hours').add(30, 'minutes');
    
    // difference
    const diffInSeconds = nowMoment.diff(pickMoment, "seconds");
    let diffInMinutes   = nowMoment.diff(pickMoment, "minutes");
    
    // formatted times (for display/API)
    const end_time   = nowMoment.format("YYYY-MM-DD HH:mm:ss");
    // const pick_time = pickMoment.format("YYYY-MM-DD HH:mm:ss");
    
    const min_before_add   = diffInMinutes;
    const remainingSeconds = diffInSeconds % 60;
    
    if (remainingSeconds > 14) {
        diffInMinutes += 1;
    }
    let total_cost;
    const base_duration  = Number(bookingDetail.base_duration);
    const base_price     = parseFloat(bookingDetail.per_min_cost);
    const post_price     = parseFloat(bookingDetail.post_price);
    const wallet_balance = parseFloat(bookingDetail.wallet_balance)
       
    total_cost = base_price
    if(diffInMinutes > base_duration ) {
        const time_after_base_duration = diffInMinutes - base_duration;
        total_cost                     = base_price + (time_after_base_duration * post_price );
    } 
    total_cost          = parseFloat(total_cost.toFixed(2));
    
    const gst          = (cycle_lock.state_id  == "ST001") ? total_cost * 0.18 : 0 ; /// yaha lagana hai  ,
    const final_amount = (total_cost + gst).toFixed(2); 

    const remaning_cost = wallet_balance - final_amount < 0 ? 0 : wallet_balance - final_amount;

    const total_taken_time = `${min_before_add}:${remainingSeconds}`;
    let out_standing_cost = 0;
     
    if( wallet_balance < final_amount ) {
        out_standing_cost = final_amount - wallet_balance;
    }
    
    // await insertRecord('transaction_history', 
    //     ['rider_id', 'amount', 'payment_type', 'order_id', "outstanding", "current_balance", "prev_balance"], 
    //     [rider_id, final_amount, 'debt',  booking_id, final_amount, remaning_cost, wallet_balance]
    // );
    // out_standing_cost +   out_standing_cost.toFixed(2)
    await db.execute(`
        UPDATE riders SET out_standing_cost =  ? 
        WHERE rider_id = ?`,
        [ parseFloat(final_amount), rider_id]
    );
    const bookingParams = { 
        status          : "CMP",
        end_lat         : cycle_lock.latitude, 
        end_long        : cycle_lock.longitude,
        dropoff_station : cycle_lock.dropoff_station,
        drop_address    : cycle_lock.address,
        price           : final_amount,
        time_taken      : diffInMinutes,
        drop_time       : end_time,
        handover_type   : "self",
        total_time      : total_taken_time,
        lock_number     : lock_number,
        hand_over_station: cycle_lock.station_name,
    }
    const update_booking = await updateRecord('cycle_booking', bookingParams, ['booking_id'], [booking_id] );
    if( !update_booking) return resp.json({ status:0, code: 201, message: [`Booking was not created!`] })

    await insertRecord('booking_history',
        [ 'booking_id', 'rider_id', 'status', 'description' ],
        [ booking_id, rider_id, "CMP", { station_id : station_id, lock_number, cycle_id } ]
    );    
    const db_logs_data = await queryDB(`
        SELECT description 
        from booking_history 
        where rider_id = ? and booking_id = ? and status = 'ON' `, [ rider_id, booking_id ]
    );
    if(db_logs_data?.description){
    const description =  typeof db_logs_data.description === "string"
        ? JSON.parse(db_logs_data.description)
        : db_logs_data.description;
        if( station_id !== description.station_id ) {            
            db.execute(`
                UPDATE cycle_list 
                SET station_id = ?, lock_number = ? 
                WHERE cycle_id = ? `, [cycle_lock.station_id, lock_number, bookingDetail.cycle_id]
            );
        }
    }
    await updateRecord('cycle_list', { status : 1, lock_number : lock_number, device_status : 0 }, ['cycle_id'], [cycle_id] );
    
    await sendNotification("USER_COMPLETE_RIDE", { booking_id, amount : final_amount}, rider_id, rider_id)
    await sendNotification("ADMIN_COMPLETE_RIDE", { booking_id }, rider_id ,'' )
    io.emit('notification-list', { msCount : 1});
    const template = NOTIFICATION_CONTENT["USER_COMPLETE_RIDE"];

    await pushNotification(bookingDetail.fcm_token, template.heading({booking_id}), template.desc({amount : final_amount}), 'RDRFCM', `Mobility_Ride_Completed/${booking_id}` );
    
    const payload = `OFF,${cycle_id}`;
    client.publish( `/supro/GW/${check_locker.gateway_id}/UP`, payload, { qos: 0, retain: false })
    // const mail_template = NOTIFICATION_CONTENT["USER_RIDE_COMPLETE_EMAIL"];
         
    // emailQueue.addEmail(
    //     bookingDetail.rider_email, 
    //     mail_template.subject({booking_id}), 
    //     mail_template.content( {
    //         rider_name : bookingDetail.rider_name,
    //         booking_id : booking_id, 
    //         cycle_id   : bookingDetail.cycle_id, 
    //         pick_time  : moment(bookingDetail.pick_time).format('hh:mm A'), 
    //         drop_time  : moment(end_time).format('hh:mm A'), 
    //         time_taken : diffInMinutes,
    //         amount     : final_amount
    //     })
    // );
    const finalAmountNum = parseFloat(final_amount);
    return resp.json({ status : 1, code : 200, message : [`Your ride has been completed. Please pay ₹${final_amount} to clear your ride payment`],
    final_amount : finalAmountNum  });
});

export const nearByStaionLocker = asyncHandler(async (req, resp) => {
    const params = mergeParam(req); 
    const { rider_id, latitude, longitude} = params;

    const { isValid, errors } = validateFields(params, {
        rider_id  : ["required"],
        latitude  : ["required"],
        longitude : ["required"],
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
    const [stationList] = await db.execute(`
        SELECT * FROM (
            SELECT
                msl.operator_contact, msl.operator_email, msl.station_id, msl.station_name, msl.latitude, msl.longitude,
                COUNT(cl.id) AS cycle_count,
                (
                    6371 * ACOS(
                        COS(RADIANS(?)) * COS(RADIANS(msl.latitude)) *
                        COS(RADIANS(msl.longitude) - RADIANS(?)) +
                        SIN(RADIANS(?)) * SIN(RADIANS(msl.latitude))
                    )
                ) AS distance
            FROM mobility_station_list msl
            LEFT JOIN cycle_list cl ON cl.station_id = msl.station_id
            GROUP BY msl.operator_contact, msl.station_id, msl.station_name, msl.latitude, msl.longitude
        ) AS sub WHERE distance <= 50
        ORDER BY distance ASC `, [ latitude, longitude, latitude ]
    );    
    return resp.json({ status: 1, code: 200, data: stationList });
});

export const manualRideCreateOTP = asyncHandler(async(req,resp)=>{
   
    const { station_id, country_code ='+91' } = mergeParam(req);
 
    const { isValid, errors } = validateFields(mergeParam(req), { station_id : ["required"] });
    if (!isValid)  return resp.json({ status: 0, code: 422, message: errors }); 

    const station_check = await queryDB(`
        SELECT operator_name, operator_contact, operator_email 
        FROM mobility_station_list 
        WHERE station_id = ? `, [ station_id ] 
    );
    const res = checkNumber(country_code, station_check.operator_contact);
    if(res.status == 0) return resp.json({ status:0, code:422, message: res.msg })      

    if(!station_check ) return resp.json({ status: 0, code: 200, message: ["All locker is Cccupied ! "] });
    
    const fullMobile = `${country_code}${station_check.operator_contact}`.replace("+", "");
    let otp          =  generateOTP(4);
    storeOTP(fullMobile, otp);

    const html = `<html>
        <body>
            <h4>Hello ${station_check.operator_name},</h4>
            <p>Your One-Time Password (OTP) for completing the manual handover process is: ${otp} </p>
            <p>Please use this OTP to proceed. For your security, do not share this code with anyone.</p>                         
            <p>If you did not request this, please ignore this email.</p> 
            <p>Best regards, <br/> PlusX Electric Team</p>
        </body>
    </html>`;
    emailQueue.addEmail(station_check.operator_email, `Manual Handover OTP - PlusX Electric`, html);

    // return resp.json({ status: 1, code: 200, otp, message: ["OTP sent to the station operator for verification"] });   

    sendOtp(
        fullMobile,
        38,
        otp
    )
    .then(result => {
        if (result.status === 0) return resp.json(result);
        return resp.json({ status: 1, code: 200, data: '', message: ['OTP sent to the station operator for verification'] });
    })
    .catch(err => {
        console.log('Error in otpController:', err.message);
        return resp.json({ status: 'error', msg: 'Failed to send OTP' });
    });   
}); 

export const manualVerifyOTP = asyncHandler(async (req, resp) => {
    const {  country_code = '+91', station_id, booking_id, otp, rider_id} = mergeParam(req);
   
    const { isValid, errors } = validateFields(mergeParam(req), { 
        otp        : ["required"],
        station_id : ["required"],
        booking_id : ["required"]
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const station_data = await queryDB(`
        SELECT operator_contact 
        FROM mobility_station_list 
        WHERE station_id = ? 
        LIMIT 1`, [station_id]
    );
    if(!station_data) return resp.json({ status : 0, code: 422, message : ["The mobile number is not registered with us. Kindly sign up."] });
    
    const fullMobile = `${country_code}${station_data.operator_contact}`.replace("+", "");
    const cachedOtp  = getOTP(fullMobile);
 
    if (!cachedOtp || cachedOtp !== otp) return resp.json({ status: 0, code: 422, message: ["OTP invalid!"] });

    const result = await completeride(rider_id, booking_id, station_id, "manual", "");
    delOTP(fullMobile); 
    
    // return { status:1, code: 200, message: [`Your ride is complete. ₹${final_amount} deducted from your wallet`], timeObj };
    return resp.json({message : result.message, final_amount: result.final_amount, booking_id: result.booking_id, status: result.status, code: result.code });

});

const completeride = async (rider_id, booking_id, station_id, handover_type, lock_number ) => {
    try {
        const bookingDetail = await queryDB(`
            SELECT
                cb.per_min_cost, cb.pick_time, cb.cycle_id, cb.post_price, cb.base_duration, 
                r.rider_email, CONCAT(r.rider_name, ' ', r.last_name) AS rider_name, r.fcm_token, 
                cb.rider_id, r.amount as wallet_balance, cb.status, price
            FROM cycle_booking cb
            JOIN riders r on r.rider_id = cb.rider_id
            WHERE cb.booking_id = ?
            LIMIT 1`, [booking_id]
        );
        if(!bookingDetail) return { status: 0, code: 422, message: ["Booking not found!"] };
        if(bookingDetail.status === "CMP" ) return { status: 0, code: 422, message: ["Your ride has been already completed!"] };

        const pick_db_ime = bookingDetail.pick_time;
        const pickMoment  = moment(pick_db_ime, "YYYY-MM-DD HH:mm:ss", "Asia/Kolkata");
        
        const nowMoment = moment().add(5, 'hours').add(30, 'minutes');
            
        // difference  price
        const diffInSeconds = nowMoment.diff(pickMoment, "seconds");
        let diffInMinutes   = nowMoment.diff(pickMoment, "minutes");
        
        // formatted times (for display/API)
        const end_time   = nowMoment.format("YYYY-MM-DD HH:mm:ss");
        
        const min_before_add   = diffInMinutes;
        const remainingSeconds = diffInSeconds % 60;
        
        if (remainingSeconds > 14) {
            diffInMinutes += 1;
        }
        const base_duration  = Number(bookingDetail.base_duration);
        const base_price     = parseFloat(bookingDetail.per_min_cost);
        const post_price     = parseFloat(bookingDetail.post_price);
        const wallet_balance = parseFloat(bookingDetail.wallet_balance)

        let total_cost = base_price
        if(diffInMinutes > base_duration){
            const time_after_base_duration = diffInMinutes - base_duration;
            total_cost                     = base_price + (time_after_base_duration * post_price);
        }
        total_cost   = parseFloat(total_cost.toFixed(2));
        // const gst = total_cost * 0.18;
        const gst    = (bookingDetail.price != total_cost) ? total_cost * 0.18 : 0 ;

        const final_amount = (total_cost + gst).toFixed(2); //total_cost + gst;
        
        const remaning_cost = wallet_balance - final_amount < 0 ? 0 : wallet_balance - final_amount;
      
        const total_taken_time = `${min_before_add}:${remainingSeconds}`;
        let out_standing_cost  = 0;
     
        if( wallet_balance < final_amount ) { 
            out_standing_cost = final_amount - wallet_balance;
        }
        // await insertRecord('transaction_history', 
        //     ['rider_id', 'amount', 'payment_type', 'order_id', "outstanding", "current_balance", "prev_balance"], 
        //     [rider_id, final_amount, 'debt',  booking_id, out_standing_cost, remaning_cost, wallet_balance]
        // );
        await db.execute(`
            UPDATE riders 
            SET out_standing_cost = out_standing_cost + ? 
            WHERE rider_id = ?`, 
            [ parseFloat(final_amount), rider_id]
        );
        const drop_station = await queryDB(`
            SELECT 
                msl.station_id, msl.latitude, msl.longitude, msl.station_name as dropoff_station, msl.address
            FROM mobility_station_list msl 
            WHERE station_id = ? `, [station_id]
        );
        const bookingParams = { 
            status           : "CMP",
            end_lat          : drop_station.latitude, 
            end_long         : drop_station.longitude,
            dropoff_station  : drop_station.dropoff_station,
            drop_address     : drop_station.address,
            price            : final_amount,
            time_taken       : diffInMinutes,
            drop_time        : end_time,
            lock_number      : lock_number,
            handover_type    : handover_type,
            total_time       : total_taken_time,
            hand_over_station : drop_station.dropoff_station,
        }
        const update_booking = await updateRecord('cycle_booking', bookingParams , ['booking_id'], [booking_id]);
     
        if( !update_booking) return { status:0, code: 201, message: [`Booking was not created!`] }

        await insertRecord('booking_history',
            [ 'booking_id', 'rider_id', 'status', 'description' ],
            [booking_id, rider_id, "CMP", 
                { 
                    station_id    : station_id, 
                    lock_number   : lock_number, 
                    handover_type : handover_type, 
                    cycle_id      : bookingDetail.cycle_id 
                } 
            ]
        );    
        const db_logs_data = await queryDB(`
            SELECT description 
            from booking_history 
            where rider_id = ? and booking_id = ? and status = 'ON' `,[rider_id,booking_id]
        );
        if( station_id !== db_logs_data.description.station_id ) {

            const updtObj = { station_id : drop_station.station_id, lock_number : lock_number} ;
            await updateRecord('cycle_list', updtObj, ['cycle_id'], [bookingDetail.cycle_id] );      
        }
        await updateRecord('cycle_list', 
            { status : 1, lock_number : lock_number},  ['cycle_id'], [bookingDetail.cycle_id] 
        );
        await sendNotification("USER_COMPLETE_RIDE",{ booking_id, amount : final_amount }, rider_id, rider_id);
        await sendNotification("ADMIN_COMPLETE_RIDE",{ booking_id }, rider_id, '' )
        io.emit('notification-list', {msCount : 1});
        const template = NOTIFICATION_CONTENT["USER_COMPLETE_RIDE"];

        await pushNotification(bookingDetail.fcm_token, template.heading({booking_id}), template.desc({amount : final_amount}), 'RDRFCM', `Mobility_Ride_Completed/${booking_id}`); 
        //template.href({booking_id}) 
            
        const check_locker = await queryDB(`
            SELECT gateway_id 
            FROM cycle_locker 
            WHERE station_id = ? `, [station_id]
        );
        const payload = `OFF,${bookingDetail.cycle_id}`;
        client.publish( `/supro/GW/${check_locker.gateway_id}/UP`, payload, { qos: 0, retain: false });
        const mail_template = NOTIFICATION_CONTENT["USER_RIDE_COMPLETE_EMAIL"];
    
        emailQueue.addEmail(
            bookingDetail.rider_email, 
            mail_template.subject({booking_id}), 
            mail_template.content({
                rider_name : bookingDetail.rider_name, 
                booking_id, 
                cycle_id   : bookingDetail.cycle_id, 
                pick_time  : moment(bookingDetail.pick_time).format('hh:mm A'),
                drop_time  : moment(end_time).format('hh:mm A'),
                time_taken : diffInMinutes,
                amount     : final_amount
            })
        );
        const finalAmountNum = parseFloat(final_amount);
        return { status : 1, code : 200, message : [`Your ride has been completed. Please pay ₹${final_amount} to clear your ride payment`],
        final_amount : finalAmountNum,
        booking_id: booking_id  
        };
    
    } catch(err) {
        console.log(err);
        tryCatchErrorHandler('manual-verify-otp', err, []);
        return { status:0, code: 500, message: [`Oops! There is something went wrong! Please Try Again.`] };
    } 
}

// 2 Apr 
export const startBookingCheck = async (rider_id, booking_id, station_id, lock_number) => {
    try {
        const bookingData = await queryDB( `
            SELECT 
                b.user_name, b.contact_no, b.cycle_id, b.pick_time, b.pickup_station, 
                b.start_lat, b.start_long, r.fcm_token
            FROM cycle_booking b 
            JOIN riders r ON r.rider_id = b.rider_id
            WHERE booking_id = ? AND b.status = ? AND b.created_at >= NOW() - INTERVAL 2 MINUTE
            LIMIT 1 `, [ booking_id, 'PNR' ]
        );
        if(!bookingData) return false;

        const locker_data = await queryDB(`
            SELECT station_id, ${lock_number} 
            FROM cycle_locker
            WHERE station_id = ?
            ORDER BY id DESC 
            LIMIT 1`, [station_id ] 
        );
       if( locker_data[lock_number] == 0 ) {
           await updateRecord('cycle_booking', { status : "ON" }, ['booking_id'], [booking_id] );  

            await insertRecord('booking_history',
                ['booking_id', 'rider_id', 'status', 'description'],
                [booking_id, rider_id, "ON", { station_id : locker_data.station_id, cycle_id : bookingData.cycle_id, lock_number } ]
            );
            await updateRecord('cycle_list', { status : 0, lock_number : null }, ['cycle_id'], [bookingData.cycle_id] );  

            await sendNotification("USER_ON_GOING", { booking_id }, rider_id, rider_id )
            await sendNotification("ADMIN_ON_GOING", { booking_id }, rider_id, '' )
            io.emit('notification-list', { msCount : 1 } );

            const template = NOTIFICATION_CONTENT["USER_ON_GOING"];
            
            await pushNotification(bookingData.fcm_token, template.heading({booking_id}), template.desc, 'RDRFCM', template.href({booking_id}) );
        
            const admin_mail_template = NOTIFICATION_CONTENT["ADMIN_RIDE_START_EMAIL"];

            emailQueue.addEmail(process.env.MAIL_MOBILITY_ADMIN, admin_mail_template.subject({booking_id}), admin_mail_template.content({
                booking_id,
                rider_name      : bookingData.user_name, 
                rider_mobile    : bookingData.contact_no, 
                cycle_id        : bookingData.cycle_id, 
                cycle_pick_time : moment(bookingData.pick_time).format("hh:mm A"),
                pickup_station  : bookingData.pickup_station,
                latitude        : bookingData.start_lat,
                longitude       : bookingData.start_long
            }));
            return true;

        } 
       else {
            // send mail notification to admin booking issue
            // add data in table issue with booking

            await sendNotification("ADMIN_FAILED_BOOKING", { booking_id }, rider_id, '' )  //Incomplete Booking – Booking ID: XXXX
            io.emit('notification-list', { msCount : 1 } );

            return false;   /// yaha sara alert ka lagana hai
       }
    } catch(err) {
        console.log(err);
        tryCatchErrorHandler('boking check-verify-otp', err, []);
        return false; 
    } 
}

export const havingIssueBooking = asyncHandler(async (req, resp) => {
    const { rider_id, booking_id, type_of_issue  } = mergeParam(req);
    
    const { isValid, errors } = validateFields(mergeParam(req), { 
        rider_id      : ["required"],
        booking_id    : ['required'],
        type_of_issue : ['required'],
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const bookingData = await queryDB( `
        SELECT 
            user_name, user_email, contact_no, pickup_station, lock_number, university, city, start_lat, start_long
        FROM cycle_booking 
        WHERE booking_id = ? AND rider_id = ?  
        LIMIT 1 `, [ booking_id, rider_id ]
    );
    if(!bookingData) return resp.json({status : 0, code : 201, message : ['Booking Id is invalid!']});
     
    await insertRecord('cycle_booking_issue',
        [
            'booking_id', 'rider_id', 'user_name', 'user_email', 'contact_no', 
            'pickup_station', 'city', 'lock_number', 'university', 'start_lat', 'start_long', 'issue_text'
        ], [
            booking_id, rider_id, bookingData.user_name, bookingData.user_email, bookingData.contact_no,
            bookingData.pickup_station, bookingData.city, bookingData.lock_number, bookingData.university,
            bookingData.start_lat, bookingData.start_long, type_of_issue
        ]
    );
    return resp.json({ status: 1, code: 200, message: ['Issue Created Successfully!'] });
});

export const feedbackBooking = asyncHandler(async (req, resp) => {
    const { rider_id, booking_id, feedback_text = "", rating = 0  } = mergeParam(req);
    
    const { isValid, errors } = validateFields(mergeParam(req), { 
        rider_id      : ["required"],
        booking_id    : ['required'],
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const bookingData = await queryDB( `
        SELECT status
        FROM cycle_booking 
        WHERE booking_id = ? AND rider_id = ? AND status = ?
        LIMIT 1 `, [ booking_id, rider_id, "CMP" ]
    );
    if(!bookingData) return resp.json({status : 0, code : 201, message : ['Feedback submission is not allowed. The booking is not completed yet.']});
     
    await insertRecord('cycle_booking_feedback',
        [
            'booking_id', 'rider_id', 'feedback_text', 'rating',  
        ], [
            booking_id, rider_id, feedback_text, rating
        ]
    );
    await sendNotification("ADMIN_FEEDBACK_RECEIVED",{ booking_id, rating},rider_id,'');
    io.emit('notification-list', { msCount: 1 });
    return resp.json({ status: 1, code: 200, message: ['Feedback added Successfully!'] });
});

export const stationLockerUpdate = asyncHandler(async(req,resp)=>{
    const { station_id, locker_id, operation } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), { 
        station_id : ["required"],
        locker_id  : ["required"],
        operation  : ["required"],
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
 
    const updtVal = operation == 1 ? 0 : 1  
               
    let query = `UPDATE cycle_locker SET ${locker_id} = ? WHERE station_id = ? `;
         
    await db.execute( query, [ updtVal, station_id]);
     
    const message = operation == 1 ? 'Cycle out from locker' : `Cycle parked at locker` ;
        
    return resp.json({
        status        : 1,
        code          : 200,
        message       : [`${message} successfully`],
    });
});