
import db from "../../../config/indiadb.js";
import { queryDB, updateRecord } from "../../../dbUtils.js";
import { tryCatchErrorHandler } from "../../../middleware/errorHandler.js";
import { createNotification, pushNotification } from "../../../utils.js";
import { verifyPaymentByOrderId } from "../razorpay/razorpay.js";

export const cronjobAddMoney =async(req,resp)=>{

    try{
      console.log("cron job money working")
         const [rows] = await db.execute(`
            SELECT 
             order_id, rider_id, amount as paidAmount, status from
              transaction_history 
              WHERE  status = 'PNR' AND created_at >= (NOW() - INTERVAL 15 MINUTE)
        `); // AND rsa.price = "0"
// const checkOrder = rows[0];
for (const checkOrder of rows) {
  console.log("checkOrder",checkOrder)
     const verify_payment=await verifyPaymentByOrderId(checkOrder.order_id);
            if(!verify_payment){
            //  return "payment does not completed"
              continue;
            }
  console.log("verify_payment",verify_payment)

    const riders = await queryDB("SELECT amount,out_standing_cost FROM riders WHERE rider_id = ?",
              [checkOrder.rider_id]);
              console.log("riders",riders,"er.paidAmount",checkOrder.paidAmount)
    let queryParams=`amount = amount + ? `;
    let  paidAmount=checkOrder.paidAmount; 
    if(riders.out_standing_cost>0){
            paidAmount=checkOrder.paidAmount-riders.out_standing_cost
          queryParams +=` , out_standing_cost=0 `;
         } 
         let query=`UPDATE riders SET  ${queryParams}  WHERE rider_id = ?`;
        
         console.log("query",query,"paidAmount, checkOrder.rider_id",paidAmount, checkOrder.rider_id)

    await db.execute( query, [paidAmount, checkOrder.rider_id]);
    await updateRecord('transaction_history', { status : 'CNF', payment_id : verify_payment.payment_id}, ['order_id', 'rider_id'],[checkOrder.order_id, checkOrder.rider_id] );
              console.log(` payment for  ${checkOrder.rider_id}  is confirmed.`);

}
console.log(" All pending money  processed successfully.");

    }catch(error){
        console.error("Transaction failed:", err);
               tryCatchErrorHandler(err, resp);
    }
}

//pending 7-oct
export const failedCycleBooking = async () => {
    // const conn = await db.getConnection();
    try {
        // await conn.beginTransaction();
        // 1. Insert into destination table
        
        await db.query(`
            INSERT INTO failed_cycle_booking (booking_id, rider_id, status, country, country_code, city, cycle_id,
  cycle_type, time_taken, price, per_min_cost, base_duration, post_price,
  user_name, user_email, contact_no, pickup_station, dropoff_station,
  drop_address, pick_address, start_lat, start_long, end_lat, end_long,
  pick_time, drop_time, account_type, distance, estimate_time,
  university, device_name
            SELECT booking_id, rider_id, status, country, country_code, city, cycle_id,
  cycle_type, time_taken, price, per_min_cost, base_duration, post_price,
  user_name, user_email, contact_no, pickup_station, dropoff_station,
  drop_address, pick_address, start_lat, start_long, end_lat, end_long,
  pick_time, drop_time, account_type, distance, estimate_time,
            FROM 
                cycle_booking
            WHERE 
                status = ? AND created_at < NOW() - INTERVAL 5 MINUTE`, 
        ['PNR']);
    
        // 2. Delete from source table 
        await db.query( `DELETE FROM road_assistance WHERE order_status = ? AND created_at < NOW() - INTERVAL 5 MINUTE`, ['PNR'] );
    
        // await conn.commit();
        // console.log("RSA Data moved successfully!");
        return "RSA Data moved successfully!";
    
    } catch (err) {
        // await conn.rollback();
        console.error("Transaction failed:", err);
        tryCatchErrorHandler('failed-cycle-booking', err, []);
        return false;
    } finally {
        // conn.release();
        console.log("failed-cycle-booking!");
        return "connection released";
    }
};
export const mobilitynotificationOld = async () => {
    try {

        const [booking_data] = await db.execute(`
            SELECT 
                cb.rider_id,  r.fcm_token,
                cb.booking_id
            FROM cycle_booking cb
            JOIN riders r ON cb.rider_id = r.rider_id
            WHERE cb.status = 'ON'
              AND cb.created_at <= NOW() - INTERVAL 20 MINUTE
        `);

        if (!booking_data.length) {
       
            // return resp.json({ message: "No active bookings found" });
        }

        for (const booking of booking_data) {

            const { booking_id, fcm_token, rider_id } = booking;

            if (!fcm_token) continue;

            const href = `mobility_ongoing/${booking_id}`;
            const heading = `Ongoing Ride Alert`;
            const desc = 'The ride is ongoing. Are you still on this ride?';

            await pushNotification(
                fcm_token,
                heading,
                desc,
                'RDRFCM',
                href
            );
        createNotification(heading, desc, 'mobility_ongoing', 'Rider', 'Admin','',rider_id, href);
        }
         

       console.log("sent notifuication to booking")
        //return resp.json({ message: "Notifications sent successfully" });

    } catch (err) {
        console.error("Notification failed:", err);
        tryCatchErrorHandler(err, resp);
    }
};

export const mobilitynotification = async () => {
    try {
 
        const [booking_data] = await db.execute(`
            SELECT 
                cb.rider_id,  r.fcm_token,
                cb.booking_id
            FROM cycle_booking cb
            JOIN riders r ON cb.rider_id = r.rider_id
            WHERE cb.status = 'ON'
              AND cb.updated_at <= (NOW() - INTERVAL 20 MINUTE)
        `);
 
        if (!booking_data.length) return;
 
        for (const booking of booking_data) {
 
            const { booking_id, fcm_token, rider_id } = booking;
 
            if (!fcm_token) continue;
 
            const href = `mobility_ongoing/${booking_id}`;
            const heading = `Ongoing Ride Alert`;
            const desc = 'The ride is ongoing. Are you still on this ride?';
            
            const [result] = await db.execute(
                `UPDATE cycle_booking 
                 SET updated_at = NOW()
                 WHERE booking_id = ?
                 AND updated_at <= (NOW() - INTERVAL 20 MINUTE)`,
                [booking_id]
            );
              if (result.affectedRows === 0) continue;
 
            await pushNotification(
                fcm_token,
                heading,
                desc,
                'RDRFCM',
                href
            );
        createNotification(heading, desc, 'mobility_ongoing', 'Rider', 'Admin','',rider_id, href);
  console.log(
  `${booking_id} sent notification at ${new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: true
  })}`
);
     
 
        }      //return resp.json({ message: "Notifications sent successfully" });
 
    } catch (err) {
        console.error("Notification failed:", err);
        
    }
};
