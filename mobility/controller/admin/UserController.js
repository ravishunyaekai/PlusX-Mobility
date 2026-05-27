import db from '../../../config/indiadb.js';
import { queryDB, getPaginatedData, insertRecord, updateRecord } from '../../../dbUtils.js';
import { asyncHandler, formatDateInQuery, formatDateTimeInQuery, pushNotification, sendNotification } from '../../../utils.js';
import validateFields from "../../../validation.js";

// Param Code
import { NOTIFICATION_CONTENT } from '../../../common/controller/notificationContent.js';
import emailQueue from '../../../emailQueue.js';
import client from '../../../server.js';
import moment from "moment-timezone";

export const riderList = async (req, resp) => {
    let { page_no = 1, addedFrom, emirates, start_date, end_date, search_text = ''} = req.body;

    try {
        const params = {
            tableName: 'riders',
            columns: `rider_id, rider_name, rider_email, country_code, rider_mobile, emirates, profile_img, vehicle_type, status, ${formatDateTimeInQuery(['created_at', 'updated_at'])},city,state,account_type`,
            sortColumn: 'id',
            sortOrder : "DESC",
            page_no : page_no,
            limit: 10,
            liveSearchFields: ['rider_name', 'rider_id', 'rider_email', 'rider_mobile',],
            liveSearchTexts: [search_text, search_text, search_text, search_text,],
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
            params.whereOperator.push('=');
        }
        if(emirates) {
            params.whereField.push('emirates');
            params.whereValue.push(emirates);
            params.whereOperator.push('=');
        }

        const result = await getPaginatedData(params);
        const [emiratesResult] = await db.query('SELECT DISTINCT emirates FROM riders');
        
        return resp.json({
            status     : 1,
            code       : 200,
            message    : ["Rider list fetched successfully!"],
            data       : result.data,
            emirates   : emiratesResult,
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

export const riderDetails = async (req, resp) => {
    const { riderId } = req.body;

    if (!riderId) return resp.status(200).json({ status : 0, code : 400, message : ['Rider ID is required'] });
    
    try {
        let [userRows] = await db.execute(`
            SELECT 
                concat (added_from,'-',device_name) as added_from_data, out_standing_cost, 
                amount as wallet_money, rider_id, rider_name, last_name, rider_email, country_code, 
                rider_mobile, ${formatDateTimeInQuery(['created_at', 'updated_at'])},
                account_type, student_id, state, id_image,university, 
                (SELECT name from cities where city_id = riders.city_id ) as city,
                (SELECT name from university where university_id = riders.university ) as university_name
            FROM riders
            WHERE  rider_id = ?`, [riderId]
        );
        if (userRows.length === 0) {
            return resp.json({ status : 0, code : 404, message : ['Rider not found'] });
        }
        let data = {
            rider    : userRows[0],
            base_url : `${process.env.DIR_UPLOADS}student_id_image/`
        };       
        return resp.json({ status : 1, code : 200, data });
    } catch (error) {
        console.log('Error fetching rider details:', error);
        return resp.json({ status : 0, code : 500, message : ['Error fetching rider details'], });
    }
};

export const studentDetails = async (req, resp) => {
    const { riderId } = req.body;

    if (!riderId) {
        return resp.status(200).json({ status : 0, code : 400, message : ['Rider ID is required'] });
    }
    try {
        let [userRows] = await db.execute(`
            SELECT 
                rider_id, rider_name, last_name, rider_email, country_code, rider_mobile, created_at,
                account_type, student_id, state, id_image, university,
                (SELECT name from cities where city_id = riders.city_id ) as city
            FROM riders
            WHERE rider_id = ?`,  [riderId]
        );
        if (userRows.length === 0) {
            return resp.json({ status : 0, code : 404, message : ['Rider not found'] });
        }
        let data = {
            rider    : userRows[0],
            base_url : `${process.env.DIR_UPLOADS}student_id_image/`
        };
        return resp.json({ status : 1, code : 200, data });
    } catch (error) {
        console.log('Error fetching rider details:', error);
        return resp.json({ status : 0, code : 500, message : ['Error fetching rider details'], });
    }
};

export const deleteRider = async (req, resp) => {
    const {rider_id} = req.body 
    if (!rider_id) return resp.json({ status: 0, code: 422, message: "Rider ID is required" });

    try {
        const db =callDatabase(req.db)
        
        const [[rider]] = await db.execute('SELECT profile_img, rider_name, last_name, rider_email, country_code, rider_mobile, emirates, area, country, date_of_birth, added_from FROM riders WHERE rider_id = ?', [rider_id]);
        if (rider.length === 0) return resp.json({ status: 0, message: 'Rider not found.' });

        const deleteQueries = [
            // 'DELETE FROM notifications                         WHERE receive_id = ?',
            // 'DELETE FROM road_assistance                       WHERE rider_id   = ?',
            // 'DELETE FROM order_assign                          WHERE rider_id   = ?',
            // 'DELETE FROM order_history                         WHERE rider_id   = ?',
            // 'DELETE FROM charging_installation_service         WHERE rider_id   = ?',
            // 'DELETE FROM charging_installation_service_history WHERE rider_id   = ?',
            // 'DELETE FROM charging_service                      WHERE rider_id   = ?',
            // 'DELETE FROM charging_service_history              WHERE rider_id   = ?',
            // 'DELETE FROM portable_charger_booking              WHERE rider_id   = ?',
            // 'DELETE FROM portable_charger_history              WHERE rider_id   = ?',
            // 'DELETE FROM discussion_board                      WHERE rider_id   = ?',
            // 'DELETE FROM board_comment                         WHERE rider_id   = ?',
            // 'DELETE FROM board_comment_reply                   WHERE rider_id   = ?',
            // 'DELETE FROM board_likes                           WHERE rider_id   = ?',
            // 'DELETE FROM board_poll                            WHERE rider_id   = ?',
            // 'DELETE FROM board_poll_vote                       WHERE rider_id   = ?',
            // 'DELETE FROM board_share                           WHERE sender_id  = ?',
            // 'DELETE FROM board_views                           WHERE rider_id   = ?',
            'DELETE FROM riders                                WHERE rider_id   = ?'
        ];
        // Execute each delete query
        for (const query of deleteQueries) {
            await db.execute(query, [rider_id]);
        }
        await insertRecord('deleted_riders', [
            'rider_id', 'rider_name', 'last_name', 'rider_email', 'country_code', 'rider_mobile', 'emirates', 'area', 'country', 'profile_img', 'date_of_birth', 'added_from' 
        ],[
            rider_id, rider.rider_name, rider.last_name, rider.rider_email, rider.country_code, rider.rider_mobile,  rider.emirates, rider.area, rider.country, rider.profile_img, rider.date_of_birth, rider.added_from 
        ]);

        return resp.json({ status: 1, code: 200, error: false, message: ['Rider account deleted successfully!'] });
    } catch (err) {
        
        console.error('Error deleting rider account:', err.message);
        return resp.json({ status: 1, code: 500, error: true, message: ['Something went wrong. Please try again!'] });
    } finally {
    
    }
};

export const deletedRiderList = async (req, resp) => {
    let { page_no=1, addedFrom, emirates, start_date, end_date, search_text = '' } = req.body;

    try {
        const params = {
            tableName : 'deleted_riders',
            columns   : `rider_id, rider_name, last_name, rider_email, country_code, rider_mobile, emirates, profile_img, ${formatDateTimeInQuery(['created_at'])}`,
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
        if(emirates) {
            params.whereField.push('emirates');
            params.whereValue.push(emirates);
            params.whereOperator.push('=');
        }
        const result           = await getPaginatedData(params);
        const [emiratesResult] = await db.query('SELECT DISTINCT emirates FROM riders');
        return resp.json({
            status     : 1,
            code       : 200,
            message    : ["Deleted Rider list fetched successfully!"],
            data       : result.data,
            emirates   : emiratesResult,
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

export const cycleBookingDetails = asyncHandler(async(req,resp)=>{
    let { booking_id } = req.body;
    if (!booking_id) return resp.status(200).json({ status : 0, code : 400, message : ['booking ID is required'] });
    
    let cycle_booking = await queryDB(`
        SELECT 
            cycle_id, booking_id, lock_number, hand_over_station as handover_station, handover_type, cycle_type,
            ${formatDateInQuery(['created_at'])}, pickup_station, dropoff_station, account_type, user_name, user_email, price, status, contact_no, country_code, city, per_min_cost, time_taken, university,
            start_lat, start_long, ROUND(distance, 2) as distance,
            DATE_FORMAT(pick_time, '%h:%i %p') AS pick_time, 
            DATE_FORMAT(drop_time, '%h:%i %p') AS drop_time
        FROM cycle_booking
        WHERE booking_id = ?`, [ booking_id ]
    );
    if(!cycle_booking) return resp.json({ status : 0, code : 400, message : ['Booking does not found'] });
    
    const data = { cycle_booking, currency : "INR" } 
    return resp.json({ status : 1, code : 200, data })
});


// Code By ravi
export const userTransactionList = async (req, resp) => {
    try {
        
        const { riderId, page_no = 1, start_date = '', end_date = '' } = req.body;
        if (!riderId)  return resp.json({ status : 0, code : 400, message : ['Rider ID is required'] });

        const params = {
            tableName  : 'transaction_history',
            columns    : `order_id, amount, payment_type, outstanding, current_balance, ${formatDateTimeInQuery(['created_at'])}`,
            sortColumn : 'created_at DESC',
            sortOrder  : '',
            page_no,
            limit            : 10,
            liveSearchFields : [],
            liveSearchTexts  : [],
            whereField       : ['rider_id'],
            whereValue       : [riderId],
            whereOperator    : ["="],
        };
        if (start_date && end_date) {
            
            const startToday = new Date(start_date);
            const startFormattedDate = `${startToday.getFullYear()}-${(startToday.getMonth() + 1).toString()
                .padStart(2, '0')}-${startToday.getDate().toString().padStart(2, '0')}`;
                        
            const givenStartDateTime    = startFormattedDate+' 00:00:01';
            const modifiedStartDateTime = moment(givenStartDateTime).subtract(5.5, 'hours');
            const start                 = modifiedStartDateTime.format('YYYY-MM-DD HH:mm:ss');
            
            const endToday = new Date(end_date);
            const formattedEndDate = `${endToday.getFullYear()}-${(endToday.getMonth() + 1).toString()
                .padStart(2, '0')}-${endToday.getDate().toString().padStart(2, '0')}`;
            const end = formattedEndDate+' 18:29:59';  //19:59:59

            params.whereField.push('created_at', 'created_at');
            params.whereValue.push(start, end);
            params.whereOperator.push('>=', '<=');
        }
        const result = await getPaginatedData(params);

        return resp.json({
            status     : 1,
            code       : 200,
            message    : ["User Transaction List fetched successfully!"],
            data       : result.data,
            total_page : result.totalPage,
            total      : result.total,
        });
    } catch (error) {
        console.error('Error Transaction List:', error);
        return resp.json({ status: 0, message: 'Error Transaction List' });
    }
};

export const addRefundAmount = asyncHandler( async (req, resp ) => {

    const { riderId, payment_type, amount } = req.body;
    const { isValid, errors } = validateFields(req.body, {
        riderId      : ["required"], 
        payment_type : ["required"],
        amount       : ["required"]
    });
    if (!isValid) {   return resp.json({ status: 0, code: 422, message: errors });}
        
    const rider = await queryDB(`
        SELECT r.out_standing_cost, r.amount, r.fcm_token
        FROM riders r
        WHERE rider_id = ? `, [riderId]
    );
    const wallet_balance   = parseFloat(rider?.amount || 0);
    const out_standing_bal = parseFloat(rider?.out_standing_cost || 0);
    let totalAmount        = parseFloat( amount ) + parseFloat(wallet_balance );

    let out_standing_cost = out_standing_bal;
    if( totalAmount < out_standing_cost ) {
        
        out_standing_cost = out_standing_cost - totalAmount;
        totalAmount = 0 ;

    } else {
        totalAmount       = totalAmount - out_standing_cost;
        out_standing_cost = 0 ;
    }
    await insertRecord('transaction_history',
        ['rider_id', 'amount', 'payment_type', 'outstanding', 'current_balance', 'prev_balance'], 
        [ riderId, amount, payment_type, out_standing_bal, totalAmount, wallet_balance ]
    );
    const updtObj = {
        amount            : totalAmount, 
        out_standing_cost : out_standing_cost
    }
    await updateRecord('riders', updtObj , ['rider_id'], [riderId] );

    const msg = ( payment_type == 'refund' ) ? 'Refunded' : 'Added';
    // Title: Refund Credited
    // Message: ₹XXX added to your wallet.
    
    await sendNotification("REFUND_AMOUNT_WALLET", { amount, riderId }, riderId, riderId);  
    const template = NOTIFICATION_CONTENT["REFUND_AMOUNT_WALLET"];
    await pushNotification(rider.fcm_token, template.heading, template.desc({amount}), 'RDRFCM', template.href({riderId}) );

    return resp.json({
        status  : 1, 
        code    : 200,
        message : `Amount has been ${msg} successfully!`,
    })
})

// Param Code 
export const bookngCompleteByadmin = asyncHandler(async(req,resp)=>{
    const { station_id, booking_id, lock_number} = req.body;
    const { isValid, errors } = validateFields(req.body, {       
        station_id  : ["required"],
        booking_id  : ["required"],
        lock_number : ["required"]
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const result = await completeride(booking_id, station_id, "manual", lock_number); 
    return resp.json({message: result.message, status: result.status, code: result.code});
})

const completeride = async (booking_id, station_id, handover_type, lock_number) => {
    try {
        const bookingDetail = await queryDB(`
            SELECT
                cb.per_min_cost, cb.pick_time, cb.cycle_id, cb.post_price, cb.base_duration, 
                r.rider_email, CONCAT(r.rider_name, ' ', r.last_name) AS rider_name, r.fcm_token, 
                cb.rider_id, r.amount as wallet_balance, cb.status, cb.price
            FROM cycle_booking cb
            JOIN riders r on r.rider_id = cb.rider_id
            WHERE cb.booking_id = ?
            LIMIT 1`, [booking_id]
        );
        if(!bookingDetail) return { status: 0, code: 422, message: "Booking not found!" };
        if(bookingDetail.status === "CMP" ) return { status: 0, code: 422, message: "This ride has been already completed!"};
        const rider_id     = bookingDetail.rider_id; 
        
        const pick_db_ime = bookingDetail.pick_time;
        const pickMoment  = moment(pick_db_ime, "YYYY-MM-DD HH:mm:ss", "Asia/Kolkata");
        const nowMoment   = moment().add(5, 'hours').add(30, 'minutes');
        // difference
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
            const time_after_base_duration = diffInMinutes-base_duration;
            total_cost                     = base_price + (time_after_base_duration * post_price);
        }
        total_cost         = parseFloat(total_cost.toFixed(2));
        // const gst       = total_cost * 0.18;
        const gst          = (bookingDetail.price != total_cost) ? total_cost * 0.18 : 0 ;
        const final_amount = (total_cost + gst).toFixed(2);
        
        const remaning_cost = wallet_balance - final_amount < 0 ? 0 : wallet_balance - final_amount;
      
        const total_taken_time = `${min_before_add}:${remainingSeconds}`;
     
        const remaining_due = wallet_balance - final_amount;
        await db.execute(` UPDATE riders SET amount = ?, out_standing_cost = 0 WHERE rider_id = ?`,[parseFloat(remaining_due), rider_id]);

        await insertRecord('transaction_history',
        ['rider_id', 'amount', 'status', 'payment_type', 'reference_id', 'order_id'],
        [rider_id, final_amount,'OUT','debt', 'Ride Charge',booking_id]
        );
        // await insertRecord('transaction_history', 
        //     ['rider_id', 'amount', 'payment_type', 'order_id'], 
        //     [rider_id, final_amount, 'debt',  booking_id]
        // );
        // if(out_standing_cost > 0 ) {  
        //     await insertRecord('transaction_history', 
        //         ['rider_id', 'amount', 'status', 'reference_id', 'order_id'], 
        //         [ rider_id, parseFloat( out_standing_cost.toFixed(2) ), "OUT", "out_standing_cost", booking_id ]
        //     );
        // }

        // await db.execute(`
        //     UPDATE riders 
        //     SET out_standing_cost = out_standing_cost + ? 
        //     WHERE rider_id = ?`, 
        //     [ parseFloat( final_amount), rider_id]
        // );
        const drop_station = await queryDB(`
            SELECT 
                msl.station_id, msl.latitude, msl.longitude , msl.station_name as dropoff_station, msl.address
            FROM mobility_station_list msl 
            WHERE station_id = ? `, [station_id]
        );
        const station = await queryDB(`SELECT station_name from mobility_station_list where station_id=?  `,[station_id]);
        const bookingParams = { 
            status           : "CMP",
            end_lat          : drop_station.latitude, 
            end_long         : drop_station.longitude,
            dropoff_station  : drop_station.dropoff_station,
            drop_address     : drop_station.address,
            price            : final_amount,
            time_taken       : diffInMinutes,
            drop_time        : end_time,
            handover_type    : handover_type,
            hand_over_station: station.station_name,
            total_time       : total_taken_time,
            lock_number      : lock_number
        }
        const update_booking = await updateRecord('cycle_booking', bookingParams , ['booking_id'], [booking_id] );
     
        if( !update_booking) return { status:0, code: 201, message: `Booking was not created!` }
 
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
        ); //cycle_locker
        const db_logs_data = await queryDB(`
            SELECT description 
            from booking_history 
            where rider_id = ? and booking_id = ? and status = 'ON' `,[rider_id,booking_id]
        );
        const description =  typeof db_logs_data.description === "string"
        ? JSON.parse(db_logs_data.description)
        : db_logs_data.description;
        if( station_id !== description.station_id ) {
            
            const updtObj = { station_id : drop_station.station_id, lock_number : lock_number} ;
            await updateRecord('cycle_list', updtObj, ['cycle_id'], [bookingDetail.cycle_id] );          
        }        
        await updateRecord('cycle_list', 
            { status : 1, lock_number : lock_number, device_status : 0 }, ['cycle_id'], [bookingDetail.cycle_id] 
        );
        await sendNotification("USER_COMPLETE_RIDES",{ booking_id, amount : final_amount }, rider_id, rider_id);
        // await sendNotification("ADMIN_COMPLETE_RIDE",{ booking_id }, rider_id, '' )
        // io.emit('notification-list', {msCount : 1});
        const template = NOTIFICATION_CONTENT["USER_COMPLETE_RIDES"];
 
        await pushNotification(bookingDetail.fcm_token, template.heading({booking_id}), template.desc({amount : final_amount}), 'RDRFCM', `mobility_booking_details/${booking_id}` );
       
        const payload = `OFF,${bookingDetail.cycle_id}`;
        const check_locker = await queryDB(`
            SELECT gateway_id 
            FROM cycle_locker 
            WHERE station_id = ? `, [station_id]
        );
        client.publish( `/supro/GW/${check_locker.gateway_id}/UP`, payload, { qos: 0, retain: false });
        const mail_template = NOTIFICATION_CONTENT["SECURITY_DEPOSIT_DEDUCT_EMAILS"];
    
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
        return { status:1, code: 200, message: ` ride is complete. ₹${remaining_due} deducted from Customer wallet` };
    
    } catch(error) {
        console.log(error);
        return { status:0, code: 500, message: "Something went wrong." };
    } 
}

export const bookngIncompleteByadmin = asyncHandler(async(req,resp)=>{
    const { station_id, booking_id, lock_number, end_time, comment} = req.body;
    const { isValid, errors } = validateFields(req.body, {       
        station_id  : ["required"],
        booking_id  : ["required"],
        lock_number : ["required"],
        end_time    : ["required"]
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const result = await incompletecompleteride(booking_id, station_id, "manual", lock_number, end_time, comment); 
    return resp.json({message: result.message, status: result.status, code: result.code});
})

const incompletecompleteride = async (booking_id, station_id, handover_type, lock_number, end_time, comment) => {
    try {
        
        const bookingDetail = await queryDB(`
            SELECT
                cb.per_min_cost, cb.pick_time, cb.cycle_id, cb.post_price, cb.base_duration, 
                r.rider_email, CONCAT(r.rider_name, ' ', r.last_name) AS rider_name, r.fcm_token, 
                cb.rider_id, r.amount as wallet_balance, cb.status, cb.price
            FROM cycle_booking cb
            JOIN riders r on r.rider_id = cb.rider_id
            WHERE cb.booking_id = ? AND cb.status = ?
            LIMIT 1`, [booking_id, 'PNR']
        );
         
        if(!bookingDetail) return { status: 0, code: 422, message: "Ride completion failed. Booking not found or rider account unavailable." };
         
        const rider_id    = bookingDetail.rider_id; 
        const pick_db_ime = bookingDetail.pick_time;
        const pickMoment  = moment(pick_db_ime, "YYYY-MM-DD HH:mm:ss", "Asia/Kolkata");
         
        const pickDate = pickMoment.format("YYYY-MM-DD");
 
        const nowMoment = moment.tz(`${pickDate} ${end_time}`,"YYYY-MM-DD hh:mm A","Asia/Kolkata");
        if (nowMoment.isBefore(pickMoment)) {
            return { status: 0, code: 422, message: "End time cannot be earlier than pick time." };
        }
        // difference
        const diffInSeconds = nowMoment.diff(pickMoment, "seconds");
        let diffInMinutes   = nowMoment.diff(pickMoment, "minutes");
        
        const min_before_add   = diffInMinutes;
        const remainingSeconds = diffInSeconds % 60;
 
        if (remainingSeconds > 14) {
            diffInMinutes += 1;
        }
        const base_duration  = Number(bookingDetail.base_duration);
        const base_price     = parseFloat(bookingDetail.per_min_cost);
        const post_price     = parseFloat(bookingDetail.post_price);
        const wallet_balance = parseFloat(bookingDetail.wallet_balance); //
 
        let total_cost = base_price
        if(diffInMinutes > base_duration){
            const time_after_base_duration = diffInMinutes-base_duration;
            total_cost                     = base_price + (time_after_base_duration * post_price);
        }
        total_cost         = parseFloat(total_cost.toFixed(2));
        const gst          = (bookingDetail.price != total_cost) ? total_cost * 0.18 : 0 ;
        const final_amount = (total_cost + gst).toFixed(2);;
        const total_taken_time = `${min_before_add}:${remainingSeconds}`;
         
        const remaining_due =  wallet_balance - final_amount;
        await db.execute(` UPDATE riders SET amount = ?, out_standing_cost = 0 WHERE rider_id = ?`,[parseFloat(remaining_due), rider_id])
        
        await insertRecord('transaction_history',
            ['rider_id', 'amount', 'status', 'payment_type', 'reference_id', 'order_id'],
            [rider_id, final_amount, 'OUT', 'debt', 'Ride Charge', booking_id ]
        );
 
        if(comment){
            await insertRecord( "booking_comments", ["booking_id","comment"], [booking_id, comment] );
        }
        const drop_station = await queryDB(`
            SELECT 
                msl.station_id, msl.latitude, msl.longitude , msl.station_name as dropoff_station, msl.address
            FROM mobility_station_list msl 
            WHERE station_id = ? `, [station_id]
        );
        if(!drop_station){
            return {  status:0, code:422, message:"Drop station not found" }
        }
        await updateRecord('cycle_list', 
            { status : 1, station_id : drop_station.station_id, lock_number : lock_number, device_status : 0 }, ['cycle_id'], [bookingDetail.cycle_id] 
        );
        const station = await queryDB(`SELECT station_name from mobility_station_list where station_id=?  `,[station_id]);
 
        const bookingParams = { 
            status           : "CMP",
            end_lat          : drop_station.latitude, 
            end_long         : drop_station.longitude,
            dropoff_station  : drop_station.dropoff_station,
            drop_address     : drop_station.address,
            price            : final_amount,
            time_taken       : diffInMinutes,
            drop_time        : nowMoment.format("YYYY-MM-DD HH:mm:ss"),
            handover_type    : handover_type,
            hand_over_station: station.station_name,
            total_time       : total_taken_time,
            lock_number      : lock_number
        }
        const update_booking = await updateRecord('cycle_booking', bookingParams , ['booking_id'], [booking_id] );
     
        if( !update_booking) return { status:0, code: 201, message: `Booking was not created!` }
 
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
        await sendNotification("USER_COMPLETE_RIDES",{ booking_id, amount : final_amount }, rider_id, rider_id);
        // await sendNotification("ADMIN_COMPLETE_RIDE",{ booking_id }, rider_id, '' )
        // io.emit('notification-list', {msCount : 1});
        const template = NOTIFICATION_CONTENT["USER_COMPLETE_RIDES"];
 
        await pushNotification(bookingDetail.fcm_token, template.heading({booking_id}), template.desc({amount : final_amount}), 'RDRFCM', `mobility_booking_details/${booking_id}` );
       
        const payload = `OFF,${bookingDetail.cycle_id}`;
        const check_locker = await queryDB(`
            SELECT gateway_id 
            FROM cycle_locker 
            WHERE station_id = ? `, [station_id]
        );
        client.publish( `/supro/GW/${check_locker.gateway_id}/UP`, payload, { qos: 0, retain: false });
        const mail_template = NOTIFICATION_CONTENT["SECURITY_DEPOSIT_DEDUCT_EMAILS"];
    
        emailQueue.addEmail(
            bookingDetail.rider_email, 
            mail_template.subject({booking_id}), 
            mail_template.content({
                rider_name : bookingDetail.rider_name, 
                booking_id, 
                cycle_id   : bookingDetail.cycle_id, 
                pick_time  : moment(bookingDetail.pick_time).format('hh:mm A'),
                drop_time  : nowMoment.format("hh:mm A"),
                time_taken : diffInMinutes,
                amount     : final_amount
            })
        );
        return { status:1, code: 200, message: ` ride is complete. ₹${final_amount} deducted from Customer wallet` };
    
    } catch(error) {
        console.log(error);
        return { status:0, code: 500, message: "Something went wrong." };
    } 
}