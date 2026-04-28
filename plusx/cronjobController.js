import { verifyPaymentByOrderId } from "../mobility/controller/razorpay/razorpay.js";
import db from "../config/indiadb.js";
import { insertRecord, queryDB, updateRecord } from "../dbUtils.js";
import { createNotification, pushNotification } from "../utils.js";
import emailQueue from "../emailQueue.js";
import { tryCatchErrorHandler } from "../middleware/errorHandler.js";
import { io } from "../server.js";
 export const CronjobRsaInvoice = async () => {
   try { 
            console.log("cron job for rsa working")
        const [rows] = await db.execute(`
            SELECT 
               rsa.coupon_code, rsa.rider_id,rsa.request_id, rsa.order_id,rsa.name, rsa.country_code, rsa.contact_no, rsa.pickup_address, rsa.pickup_latitude, 
                rsa.pickup_longitude, rd.fcm_token, rd.rider_email, rsa.vehicle_data, rsa.price
            FROM 
                road_assistance as rsa
            LEFT JOIN
                riders AS rd ON rd.rider_id = rsa.rider_id
            WHERE 
                
                 rsa.order_status = 'PNR'
                AND rsa.created_at >= (NOW() - INTERVAL 5 MINUTE)
            
        `); // AND rsa.price = "0"
// const checkOrder = rows[0];

for (const checkOrder of rows) {

   const verify_payment=await verifyPaymentByOrderId(checkOrder.order_id);
 
        if(!verify_payment){
        //  return "payment does not completed"
          continue;
        }
       if (checkOrder.coupon_code && checkOrder.coupon_code.trim() !== ''){
        
        const coupon = await queryDB(`SELECT coupan_percentage FROM coupon WHERE coupan_code = ? LIMIT 1 `, [ checkOrder.coupon_code ]); 
         let coupan_percentage = coupon.coupan_percentage ;
         await insertRecord('coupon_usage', ['coupan_code', 'user_id', 'booking_id', 'coupan_percentage'], [checkOrder.coupon_code, checkOrder.rider_id, checkOrder.request_id, coupan_percentage]); //, conn
   
                             }

        // return "success";
              await updateRecord('road_assistance', { order_status : 'CNF', payment_intent_id : verify_payment.payment_id}, ['request_id', 'rider_id'],
                 [checkOrder.request_id, checkOrder.rider_id] ); 
                 

            const insert = await insertRecord('order_history', ['order_id', 'order_status', 'rider_id'], [checkOrder.request_id, 'CNF', checkOrder.rider_id]); //, conn

            const href    = 'road_assistance/' + checkOrder.request_id;
            const heading = 'EV Roadside Assistance';
            const desc    = `Booking Confirmed! ID : ${checkOrder.request_id}`;
            createNotification(heading, desc, 'Roadside Assistance', 'Rider', 'Admin','', checkOrder.request_id, href);
            createNotification(heading, desc, 'Roadside Assistance', 'Admin', 'Rider', checkOrder.request_id, '', href);
            pushNotification(checkOrder.fcm_token, heading, desc, 'RDRFCM', href);
        
            const htmlUser = `<html>
                <body>
                    <h4>Dear ${checkOrder.name},</h4>
                    <p>Thank you for choosing our Roadside Assistance service for your EV. We are pleased to confirm that your booking has been successfully received.</p>
                    <p>Booking Details:</p>
                    <p>Booking ID: ${checkOrder.request_id}</p>
                    <p>Address: ${checkOrder.pickup_address}</p>    
                    <p>We look forward to serving you and providing a seamless EV charging experience.</p>
                    <p>Best regards,<br/> PlusX Electric Team </p>
                </body>
            </html>`;
            emailQueue.addEmail(checkOrder.rider_email, 'Mobility: Booking Confirmation for EV Roadside Assistance Service', htmlUser);
            const htmlAdmin = `<html>
                <body>
                    <h4>Dear Admin,</h4>
                    <p>We have received a new booking for the EV Roadside Assistance service. Please find the details below:</p>
                    <p>Customer Name   : ${checkOrder.name}</p>
                    <p>Contact No.     : ${checkOrder.country_code}-${checkOrder.contact_no}</p>
                    <p>Address         : ${checkOrder.pickup_address}</p>
                    <p>Vechile Details : ${checkOrder.vehicle_data}</p>
                    <a href="https://www.google.com/maps?q=${checkOrder.pickup_latitude},${checkOrder.pickup_longitude}">Address Link</a><br>           
                    <p>Best regards,<br/> PlusX Electric Team </p>
                </body>
            </html>`;
            const adminEmails = [process.env.MAIL_MOBILITY_ADMIN];
            // const adminEmails = [ process.env.MAIL_POD_ADMIN, process.env.MAIL_CHINTAN, process.env.MAIL_NADIA, process.env.MAIL_JAHID, process.env.MAIL_JALAL, process.env.MAIL_ABDUR, process.env.MAIL_ZAKIR, process.env.MAIL_JAVED ];
            emailQueue.addEmail(adminEmails, `EV Roadside Assistance Booking - ${checkOrder.request_id}`, htmlAdmin);
            

             io.emit('plusx-notification-list', {msCount : 1});
              console.log(`Booking ${checkOrder.request_id} confirmed.`);

             // await commitTransaction(conn);
            // let respMsg = 'We have received your booking and our team will reach out to you soon.';
            
            // return respMsg;

            // if(insert.affectedRows == 0) return "Oops! Something went wrong. Please try again.";
}
//  return respMsg; 
 console.log(" All pending bookings processed successfully.");
       } catch(err) {
        // await rollbackTransaction(conn);
        console.error("Transaction failed:", err);
        tryCatchErrorHandler(err, resp);
    } finally {
        // if (conn) conn.release();
    }
};

export const failedRSABooking = async () => {
    // const conn = await db.getConnection();
    try {
       
       await db.query(`
            INSERT INTO failed_road_assistance (request_id, rider_id, vehicle_id, price, name, country_code, contact_no, pickup_address, pickup_latitude, pickup_longitude, order_status, parking_number, parking_floor, address_id, device_name, payment_intent_id, vehicle_data)

            SELECT request_id, rider_id, vehicle_id, price, name, country_code, contact_no, pickup_address, pickup_latitude, pickup_longitude, order_status, parking_number, parking_floor, address_id, device_name, payment_intent_id, vehicle_data 
            FROM 
                road_assistance
            WHERE 
                order_status = ?  AND created_at < NOW() - INTERVAL 5 MINUTE`, 
        ['PNR']);
    //payment_intent_id IS NULL OR TRIM(payment_intent_id) = '' 
        // 2. Delete from source table 
        await db.query( `DELETE FROM road_assistance WHERE order_status = ?     AND created_at < NOW() - INTERVAL 5 MINUTE`, ['PNR'] );
    
      /*  await db.query(`
            INSERT INTO failed_road_assistance (request_id, rider_id, vehicle_id, price, name, country_code, contact_no, pickup_address, pickup_latitude, pickup_longitude, order_status, parking_number, parking_floor, address_id, device_name, payment_intent_id, vehicle_data)

            SELECT request_id, rider_id, vehicle_id, price, name, country_code, contact_no, pickup_address, pickup_latitude, pickup_longitude, order_status, parking_number, parking_floor, address_id, device_name, payment_intent_id, vehicle_data 
            FROM 
                road_assistance
            WHERE 
                order_status = ?  AND payment_intent_id IS NULL OR TRIM(payment_intent_id) = ''   AND created_at < NOW() - INTERVAL 5 MINUTE`, 
        ['PNR']);
    
        // 2. Delete from source table 
        await db.query( `DELETE FROM road_assistance WHERE order_status = ?  AND payment_intent_id IS NULL OR TRIM(payment_intent_id) = ''    AND created_at < NOW() - INTERVAL 5 MINUTE`, ['PNR'] );*/
    
        // await conn.commit();
        console.log("RSA Data moved successfully!");
        return "RSA Data moved successfully!";
    
    } catch (err) {
        // await conn.rollback();
        console.error("Transaction failed:", err);
        tryCatchErrorHandler('failed-rsa-cron', err, []);
        return false;
    } finally {
        // conn.release();
        console.log("RSA Data connection released!");
        return "connection released";
    }
};


//cron job with transaction
/*

 export const CronjobRsaInvoice = async () => {
   try { 
    //check last 6 min booking and getverfiy via order id.

           
         const connection=await db.getConnection();
         await connection.beginTransaction();
            
        const [rows] = await connection.execute(`
            SELECT 
                rsa.rider_id,rsa.request_id, rsa.order_id,rsa.name, rsa.country_code, rsa.contact_no, rsa.pickup_address, rsa.pickup_latitude, 
                rsa.pickup_longitude, rd.fcm_token, rd.rider_email, rsa.vehicle_data, rsa.price
            FROM 
                road_assistance as rsa
            LEFT JOIN
                riders AS rd ON rd.rider_id = rsa.rider_id
            WHERE 
                
                 rsa.order_status = 'PNR'
                AND rsa.created_at >= (NOW() - INTERVAL 120 MINUTE)
                 ORDER BY rsa.created_at ASC
      LIMIT 1 FOR UPDATE `); // AND rsa.price = "0"
const checkOrder = rows[0];


        if (!checkOrder  ) {

           console.log("No pending bookings remaining in the last 10 minutes.");
           await connection.rollback();
          connection.release();
            return false
        }


        const verify_payment=await verifyPaymentByOrderId(checkOrder.order_id);
        if(!verify_payment){
         return "payment does not completed"
        }

 await connection.execute(` SELECT * FROM road_assistance  WHERE request_id = ? AND order_status = 'PNR' FOR UPDATE`, [checkOrder.request_id]);
        console.log("verify_payment",verify_payment)
        // return "success";
        connection.execute(`UPDATE road_assistance set order_status='CNF', payment_intent_id=? where  request_id=? and  rider_id=?  `,
            [verify_payment.payment_id,checkOrder.request_id,checkOrder.rider_id])    
        //   await updateRecord('road_assistance', { order_status : 'CNF', payment_intent_id : verify_payment.payment_id}, ['request_id', 'rider_id'],
                //  [checkOrder.request_id, checkOrder.rider_id] ); //, conn

           await connection.execute(`INSERT INTO order_history (order_id, order_status, rider_id) VALUES (?, ?, ?)`,  [checkOrder.request_id, 'CNF', checkOrder.rider_id]);

            const href    = 'road_assistance/' + checkOrder.request_id;
            const heading = 'EV Roadside Assistance';
            const desc    = `Booking Confirmed! ID : ${checkOrder.request_id}`;
            createNotification(heading, desc, 'Roadside Assistance', 'Rider', 'Admin','', checkOrder.request_id, href);
            await connection.execute(`INSERT INTO notifications (heading, description, module_name, panel_to, panel_from, created_by, receive_id, status, href_url) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,[heading,desc,'Roadside Assistance', 'Rider','Admin',checkOrder.rider_id,checkOrder.request_id, '0', href] );


          
            await connection.execute(`INSERT INTO notifications (heading, description, module_name, panel_to, panel_from, created_by, receive_id, status, href_url) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,[heading,desc,'Roadside Assistance', 'Admin','Rider',checkOrder.rider_id,checkOrder.request_id, '0', href] );
            
            pushNotification(checkOrder.fcm_token, heading, desc, 'RDRFCM', href);
        
            const htmlUser = `<html>
                <body>
                    <h4>Dear ${checkOrder.name},</h4>
                    <p>Thank you for choosing our Roadside Assistance service for your EV. We are pleased to confirm that your booking has been successfully received.</p>
                    <p>Booking Details:</p>
                    <p>Booking ID: ${checkOrder.request_id}</p>
                    <p>Address: ${checkOrder.pickup_address}</p>    
                    <p>We look forward to serving you and providing a seamless EV charging experience.</p>
                    <p>Best regards,<br/> PlusX Electric Team </p>
                </body>
            </html>`;
            emailQueue.addEmail(checkOrder.rider_email, 'Mobility: Booking Confirmation for EV Roadside Assistance Service', htmlUser);
            const htmlAdmin = `<html>
                <body>
                    <h4>Dear Admin,</h4>
                    <p>We have received a new booking for the EV Roadside Assistance service. Please find the details below:</p>
                    <p>Customer Name   : ${checkOrder.name}</p>
                    <p>Contact No.     : ${checkOrder.country_code}-${checkOrder.contact_no}</p>
                    <p>Address         : ${checkOrder.pickup_address}</p>
                    <p>Vechile Details : ${checkOrder.vehicle_data}</p>
                    <a href="https://www.google.com/maps?q=${checkOrder.pickup_latitude},${checkOrder.pickup_longitude}">Address Link</a><br>           
                    <p>Best regards,<br/> PlusX Electric Team </p>
                </body>
            </html>`;
            const adminEmails = [process.env.MAIL_MOBILITY_ADMIN];
            // const adminEmails = [ process.env.MAIL_POD_ADMIN, process.env.MAIL_CHINTAN, process.env.MAIL_NADIA, process.env.MAIL_JAHID, process.env.MAIL_JALAL, process.env.MAIL_ABDUR, process.env.MAIL_ZAKIR, process.env.MAIL_JAVED ];
            emailQueue.addEmail(adminEmails, `EV Roadside Assistance Booking - ${checkOrder.request_id}`, htmlAdmin);
            

             io.emit('notification-list', {msCount : 1});
            // await commitTransaction(conn);
            let respMsg = 'We have received your booking and our team will reach out to you soon.'; 
             await connection.commit();
             console.log("Booking confirmed successfully: booking_id: ",checkOrder.request_id);
            connection.release();
            return respMsg;

            // if(insert.affectedRows == 0) return "Oops! Something went wrong. Please try again.";

           

          
        
    } catch(err) {
         await connection.rollback();
        connection.release();
        console.error("Transaction failed:", err);
        tryCatchErrorHandler(err, resp);
    } finally {
           if (connection) connection.release(); // always release even on error

    }
};
*/