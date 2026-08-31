import crypto from "crypto";
import logger from "../../logger.js";

import { io } from "../../server.js";
import db from "../../config/indiadb.js";

import emailQueue from "../../emailQueue.js";
import { insertRecord, queryDB, updateRecord } from "../../dbUtils.js";
import { NOTIFICATION_CONTENT } from "../../common/controller/notificationContent.js";
import { verifyPayment } from "../../mobility/controller/razorpay/razorpay.js";
import dotenv from "dotenv";
dotenv.config();
import { createNotification, pushNotification, sendNotification } from "../../utils.js";
import moment from "moment";
import Razorpay from "razorpay";

export const razorpayWebhook = async (req, res) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const signature = req.headers["x-razorpay-signature"];

        // Verify Razorpay signature
        const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(req.body).digest("hex");

        if (signature !== expectedSignature) { return res.status(200).send("ok"); }

        const event = JSON.parse(req.body.toString());

        console.log("Webhook Event:", event.event);

        // REFUND EVENTS
        if (event.event === "refund.processed") {
            const refund = event.payload.refund.entity;

            const refundRequestId = refund.notes?.refund_request_id;

            await updateRecord(
                "refund_requests",
                { refund_status: "processed", status: "approved" },
                ["id"],
                [refundRequestId],
            );
            await updateRecord(
                "riders",
                { amount: 0 },
                ["rider_id"],
                [refund.notes?.rider_id],
            );
            await insertRecord(
                "transaction_history",
                [
                    "order_id",
                    "rider_id",
                    "amount",
                    "status",
                    "payment_type",
                    "payment_id",
                    "reference_id",
                ],

                [
                    refund.notes?.booking_id || refund.payment_id,
                    refund.notes?.rider_id,
                    refund.amount / 100,
                    "CNF",
                    "refund",
                    refund.payment_id,
                    refund.id,
                ],
            );
            const riderData = await queryDB(
                `SELECT fcm_token FROM riders WHERE rider_id = ? LIMIT 1`,
                [refund.notes?.rider_id],
            );

            const template = NOTIFICATION_CONTENT["USER_REFUND_APPROVED"];

            if (riderData?.fcm_token) {
                await pushNotification(
                    riderData.fcm_token,
                    template.heading,
                    template.desc({
                        amount: refund.amount / 100,
                    }),
                    "RDRFCM",
                    template.href({
                        rider_id: refund.notes?.rider_id,
                    }),
                );
            }
            return res.status(200).send("ok");
        }

        if (event.event === "refund.failed") {
            const refund = event.payload.refund.entity;

            await updateRecord(
                "refund_requests",
                { refund_status: "failed", status: "failed" },
                ["id"],
                [refund.notes?.refund_request_id],
            );

            return res.status(200).send("ok");
        }

        // PAYMENT EVENTS

        const payment = event.payload.payment.entity;

        //  setImmediate(async()=>{
        switch (payment.notes.booking_type) {
            case "RSA":
                if (event.event === "payment.captured") {
                    await rsaInvoice(
                        payment.notes.rider_id,
                        payment.notes.booking_id,
                        payment.id,
                        payment.notes.coupon_code,
                    );
                } else {
                    await updateRecord(
                        "road_assistance",
                        { order_status: "PNR" },
                        ["request_id"],
                        [payment.notes.booking_id],
                    );
                }
                break;

            case "MOBILITY":
                if (event.event === "payment.captured") {
                    await addMoneywebhook(
                        payment.notes.rider_id,
                        payment.id,
                        payment.order_id,
                        payment.notes.amount,
                    );
                }
                break;
            case "PCB":
                if (event.event === "payment.captured") {
                    console.log("PCB case hit, calling portableChargerBookingConfirm");
                    await portableChargerBookingConfirm(
                        payment.notes.booking_id,
                        payment.id,
                        payment.notes.coupon_code,
                    );
                } else {
                    await updateRecord(
                        "portable_charger_booking",
                        { status: "PNR" },
                        ["booking_id"],
                        [payment.notes.booking_id],
                    );
                }
                break;
            case "HEV":
                if (event.event === "payment.captured") {
                    console.log("HEV case hit, calling portableChargerBookingConfirm");
                    await portableChargerBookingConfirm(
                        payment.notes.booking_id,
                        payment.id,
                        payment.notes.coupon_code,
                    );
                } else {
                    await updateRecord(
                        "portable_charger_booking",
                        { status: "PNR" },
                        ["booking_id"],
                        [payment.notes.booking_id],
                    );
                }
                break;

            case "BOOKING":
                console.log("BOOKING case hit");

                if (event.event === "payment.captured") {
                    await confirmCycleBookingPayment(
                        payment.notes.rider_id,
                        payment.notes.booking_id,
                        payment,
                    );
                }
                break;

             

            default:
                // console.log("Unhandled booking_type");
                return res.status(200).send("ok");
                break;
        }
        //  })
    } catch (error) {
        console.log(" Webhook error:", error);
        return res.status(200).send("ok");
    }
    return res.status(200).send("ok");
};

const rsaInvoice = async (
    rider_id,
    request_id,
    payment_intent_id,
    coupon_code,
) => {
    try {
        const checkOrder = await queryDB(
            `
            SELECT 
                 current_percent, rsa.name, rsa.country_code, rsa.contact_no, rsa.pickup_address, rsa.pickup_latitude, 
                rsa.pickup_longitude, rd.fcm_token, rd.rider_email, rsa.vehicle_data, rsa.price
            FROM 
                road_assistance as rsa
            LEFT JOIN
                riders AS rd ON rd.rider_id = rsa.rider_id
            WHERE 
                rsa.request_id = ? AND rsa.rider_id = ? AND rsa.order_status = 'PNR'
            LIMIT 1
        `,
            [request_id, rider_id],
        ); // AND rsa.price = "0"



        if (!checkOrder) {


            return false;
        }
        const ordHistoryCount = await queryDB(
            'SELECT COUNT(*) as count FROM order_history WHERE order_id = ? AND order_status = "CNF"', [request_id]
        );
        if (ordHistoryCount.count === 0) {

            const insert = await insertRecord('order_history', ['order_id', 'order_status', 'rider_id'], [request_id, 'CNF', rider_id]); //, conn

            if (insert.affectedRows == 0) {
                console.log("order_history insert failed for request_id:", request_id);
                return false;
            }
            if (coupon_code) {
                const coupon = await queryDB(`SELECT coupan_percentage FROM coupon WHERE coupan_code = ? LIMIT 1 `, [coupon_code]);
                let coupan_percentage = coupon.coupan_percentage;
                await insertRecord('coupon_usage', ['coupan_code', 'user_id', 'booking_id', 'coupan_percentage'], [coupon_code, rider_id, request_id, coupan_percentage]); //, conn

            }
            const battery_percent = checkOrder.current_percent > 0 ? "More than 10 %" : "0 %";



            await updateRecord('road_assistance', { order_status: 'CNF', payment_intent_id: payment_intent_id }, ['request_id', 'rider_id'], [request_id, rider_id]); //, conn

            const href = 'road_assistance/' + request_id;
            const heading = 'EV Roadside Assistance';
            const desc = `Booking Confirmed! ID : ${request_id}`;
            createNotification(heading, desc, 'Roadside Assistance', 'Rider', 'Admin', '', rider_id, href);
            createNotification(heading, desc, 'Roadside Assistance', 'Admin', 'Rider', rider_id, '', href);
            pushNotification(checkOrder.fcm_token, heading, desc, 'RDRFCM', href);

            const htmlUser = `<html>
                <body>
                    <h4>Dear ${checkOrder.name},</h4>
                    <p>Thank you for choosing our Roadside Assistance service for your EV. We are pleased to confirm that your booking has been successfully received.</p>
                    <p>Booking Details:</p>
                    <p>Booking ID: ${request_id}</p>
                     <p> Vehicle Battery % : ${battery_percent}  </p>     
                    <p>Address: ${checkOrder.pickup_address}</p>    
                    <p>We look forward to serving you and providing a seamless EV charging experience.</p>
                    <p>Best regards,<br/> PlusX Electric Team </p>
                </body>
            </html>`;
            emailQueue.addEmail(checkOrder.rider_email, 'PlusX Electric App: Booking Confirmation for EV Roadside  Assistance Service', htmlUser);
            const htmlAdmin = `<html>
                <body>
                    <h4>Dear Admin,</h4>
                    <p>We have received a new booking for the EV Roadside Assistance service. Please find the details below:</p>
                    <p>Customer Name   : ${checkOrder.name}</p>
                    <p>Contact No.     : ${checkOrder.country_code}-${checkOrder.contact_no}</p>
                    <p>Address         : ${checkOrder.pickup_address}</p>
                     <p> Vehicle Battery % : ${battery_percent}  </p>    
                    <p>Vechile Details : ${checkOrder.vehicle_data}</p>
                    <a href="https://www.google.com/maps?q=${checkOrder.pickup_latitude},${checkOrder.pickup_longitude}">Address Link</a><br>           
                    <p>Best regards,<br/> PlusX Electric Team </p>
                </body>
            </html>`;
            const adminEmails = [process.env.MAIL_ADMIN_PLUSX];
            // const adminEmails = [ process.env.MAIL_POD_ADMIN, process.env.MAIL_CHINTAN, process.env.MAIL_NADIA, process.env.MAIL_JAHID, process.env.MAIL_JALAL, process.env.MAIL_ABDUR, process.env.MAIL_ZAKIR, process.env.MAIL_JAVED ];
            emailQueue.addEmail(adminEmails, `EV Roadside Assistance Booking - ${request_id}`, htmlAdmin);


            io.emit('plusx-notification-list', { msCount: 1 });
            // await commitTransaction(conn);
            return true;
            // let respMsg = 'We have received your booking and our team will reach out to you soon.'; 
            // return respMsg;
        } else {
            return false;
        }
    } catch (err) {
        // await rollbackTransaction(conn);

        console.error("Transaction failed:", err);

        webHooktryCatchErrorHandler("RSA Webhook Error", err);

    } finally {
        // if (conn) conn.release();
        return false;
    }
};
const portableChargerBookingConfirmOld = async (booking_id, payment_intent_id, couponCode) => {
    // const conn = await startTransaction();

    try {
        const checkOrder = await queryDB(`
              SELECT   pcb.current_percent, pcb.rider_id, pcb.user_name, pcb.country_code, pcb.contact_no, pcb.slot_date, pcb.slot_time, pcb.address, pcb.latitude, pcb.longitude,
            pcb.service_type, rd.fcm_token, rd.rider_email, pcb.vehicle_data
            FROM 
                portable_charger_booking as pcb
            LEFT JOIN
                riders AS rd ON rd.rider_id = pcb.rider_id
            WHERE 
                pcb.booking_id = ? AND pcb.status = 'PNR'
            LIMIT 1
        `, [booking_id]);
        const battery_percent = checkOrder.current_percent > 0 ? "More than 10 %" : "0 %";

        if (!checkOrder) {
            return false;
        }
        const ordHistoryCount = await queryDB(
            'SELECT COUNT(*) as count FROM portable_charger_history WHERE booking_id = ? AND order_status = "CNF"', [booking_id]
        );
        if (ordHistoryCount.count === 0) {

            const insert = await insertRecord('portable_charger_history', ['booking_id', 'rider_id', 'order_status'], [booking_id, checkOrder.rider_id, 'CNF']);

            if (insert.affectedRows == 0) return false;
            await updateRecord('portable_charger_booking', { status: 'CNF', payment_intent_id }, ['booking_id', 'rider_id'], [booking_id, checkOrder.rider_id]);

            if (couponCode) {
                const coupon = await queryDB(`SELECT coupan_percentage FROM coupon WHERE coupan_code = ? LIMIT 1 `, [couponCode]);

                let coupan_percentage = coupon.coupan_percentage;
                await insertRecord('coupon_usage', ['coupan_code', 'user_id', 'booking_id', 'coupan_percentage'], [couponCode, checkOrder.rider_id, booking_id, coupan_percentage]);
            }
            if (checkOrder.service_type.toLowerCase() === "get monthly subscription") {
                await db.execute('UPDATE portable_charger_subscriptions SET total_booking = total_booking + 1 WHERE rider_id = ?', [checkOrder.rider_id]);
            }
            const href = 'portable_charger_booking/' + booking_id;
            const heading = 'Mobile EV Charging Booking!';
            const desc = `Booking Confirmed! ${booking_id}`;
            createNotification(heading, desc, 'Portable Charging Booking', 'Rider', 'Admin', '', checkOrder.rider_id, href);
            createNotification(heading, desc, 'Portable Charging Booking', 'Admin', 'Rider', checkOrder.rider_id, '', href);
            pushNotification(checkOrder.fcm_token, heading, desc, 'RDRFCM', href);

            const htmlUser = `<html>
                <body>
                    <h4>Dear ${checkOrder.user_name},</h4>
                    <p>Thank you for choosing our Mobile EV Charging  service for your EV. We are pleased to confirm that your booking has been successfully received.</p> 
                    <p>Booking Details:</p>
                    <p>Booking ID: ${booking_id}</p>
                    <p>Vehicle Battery %  : ${battery_percent}   </p>
                    <p>Date and Time of Service: ${moment(checkOrder.slot_date, 'YYYY MM DD').format('D MMM, YYYY,')} ${moment(checkOrder.slot_time, 'HH:mm').format('h:mm A')}</p>
                    <p>We look forward to serving you and providing a seamless EV charging experience.</p>
                    <p> Best regards,<br/>PlusX Electric Team </p>
                </body>
            </html>`;
            emailQueue.addEmail(checkOrder.rider_email, 'PlusX Electric App: Booking Confirmation for Your Mobile EV Charging', htmlUser);

            const htmlAdmin = `<html>
                <body>
                    <h4>Dear Admin,</h4>
                    <p>We have received a new booking for our Mobile EV Charging service. Please find the details below:</p> 
                    <p>Customer Name : ${checkOrder.user_name}</p>
                    <p>Contact No.   : ${checkOrder.country_code}-${checkOrder.contact_no}</p>
                    <p>Vehicle Battery % : ${battery_percent}   </p>
                    <p>Address       : ${checkOrder.address}</p>            
                    <p>Service Date & Time : ${moment(checkOrder.slot_date, 'YYYY MM DD').format('D MMM, YYYY,')} ${moment(checkOrder.slot_time, 'HH:mm').format('h:mm A')}</p>       
                    <p>Vechile Details  :  ${checkOrder.vehicle_data}</p> 
                    <a href="https://www.google.com/maps?q=${checkOrder.latitude},${checkOrder.longitude}">Address Link</a><br>
                    <p> Best regards,<br/>PlusX Electric Team </p>
                </body>
            </html>`;
            emailQueue.addEmail(process.env.MAIL_POD_ADMIN, `Mobile EV Charging  Booking - ${booking_id}`, htmlAdmin);

            io.emit('plusx-notification-list', { msCount: 1 });

            return true;
        } else {
            return false;
        }

    } catch (err) {
        // await rollbackTransaction(conn);
        console.error("Transaction failed:", err);

        webHooktryCatchErrorHandler("POD  Webhook Error", err);
    } finally {
        // if (conn) conn.release();
        return false;
    }
};
export const portableChargerBookingConfirm = async (booking_id, payment_intent_id, couponCode) => {
    // const conn = await startTransaction();
    // const { booking_id, payment_intent_id, couponCode } = req.body;
    try {
        console.log("function called", booking_id, payment_intent_id, couponCode);
        // PCB0049 pay_TK3XElf3IAL2yA
        const checkOrder = await queryDB(`
          SELECT 
            pcb.current_percent, 
            pcb.rider_id, 
            pcb.user_name, 
            pcb.country_code, 
            pcb.contact_no, 
            pcb.slot_date, 
            pcb.slot_time, 
            pcb.address, 
            pcb.latitude, 
            pcb.longitude,
            pcb.service_type, 
            rd.fcm_token, 
            rd.rider_email, 
            pcb.vehicle_data
        FROM 
            portable_charger_booking as pcb
        LEFT JOIN
            riders AS rd ON rd.rider_id = pcb.rider_id
        WHERE 
            pcb.booking_id = ? AND pcb.status = 'PNR'
        LIMIT 1
    `, [booking_id]);

        if (!checkOrder) {
            console.log("No order found for booking_id:", booking_id);
            return res.status(404).json({ success: false, message: "Booking not found or already confirmed." });
        }
        console.log("Order found:", checkOrder);
        const battery_percent = checkOrder?.current_percent > 0 ? "More than 10 %" : "0 %";

        const ordHistoryCount = await queryDB(
            `SELECT COUNT(*) as count 
            FROM portable_charger_history 
            WHERE booking_id = ? 
            AND order_status = "CNF"`, [booking_id]
        );
        console.log("Order history count:", ordHistoryCount.count);
        if (ordHistoryCount.count === 0) {

            const insert = await insertRecord('portable_charger_history', ['booking_id', 'rider_id', 'order_status'], [booking_id, checkOrder.rider_id, 'CNF']);

            if (insert.affectedRows == 0) return false;
            await updateRecord('portable_charger_booking', { status: 'CNF', payment_intent_id }, ['booking_id', 'rider_id'], [booking_id, checkOrder.rider_id]);

            if (couponCode) {
                const coupon = await queryDB(`SELECT coupan_percentage FROM coupon WHERE coupan_code = ? LIMIT 1 `, [couponCode]);

                let coupan_percentage = coupon.coupan_percentage;
                await insertRecord('coupon_usage', ['coupan_code', 'user_id', 'booking_id', 'coupan_percentage'], [couponCode, checkOrder.rider_id, booking_id, coupan_percentage]);
            }
            if (checkOrder.service_type.toLowerCase() === "get monthly subscription") {
                await db.execute('UPDATE portable_charger_subscriptions SET total_booking = total_booking + 1 WHERE rider_id = ?', [checkOrder.rider_id]);
            }
            const href = 'portable_charger_booking/' + booking_id;
            const heading = 'Mobile EV Charging Booking!';
            const desc = `Booking Confirmed! ${booking_id}`;
            createNotification(heading, desc, 'Portable Charging Booking', 'Rider', 'Admin', '', checkOrder.rider_id, href);
            createNotification(heading, desc, 'Portable Charging Booking', 'Admin', 'Rider', checkOrder.rider_id, '', href);
            pushNotification(checkOrder.fcm_token, heading, desc, 'RDRFCM', href);

            const htmlUser = `<html>
                <body>
                    <h4>Dear ${checkOrder.user_name},</h4>
                    <p>Thank you for choosing our Mobile EV Charging  service for your EV. We are pleased to confirm that your booking has been successfully received.</p> 
                    <p>Booking Details:</p>
                    <p>Booking ID: ${booking_id}</p>
                    <p>Vehicle Battery %  : ${battery_percent}   </p>
                    <p>Date and Time of Service: ${moment(checkOrder.slot_date, 'YYYY MM DD').format('D MMM, YYYY,')} ${moment(checkOrder.slot_time, 'HH:mm').format('h:mm A')}</p>
                    <p>We look forward to serving you and providing a seamless EV charging experience.</p>
                    <p> Best regards,<br/>PlusX Electric Team </p>
                </body>
            </html>`;
            emailQueue.addEmail(checkOrder.rider_email, 'PlusX Electric App: Booking Confirmation for Your Mobile EV Charging', htmlUser);

            const htmlAdmin = `<html>
                <body>
                    <h4>Dear Admin,</h4>
                    <p>We have received a new booking for our Mobile EV Charging service. Please find the details below:</p> 
                    <p>Customer Name : ${checkOrder.user_name}</p>
                    <p>Contact No.   : ${checkOrder.country_code}-${checkOrder.contact_no}</p>
                    <p>Vehicle Battery % : ${battery_percent}   </p>
                    <p>Address       : ${checkOrder.address}</p>            
                    <p>Service Date & Time : ${moment(checkOrder.slot_date, 'YYYY MM DD').format('D MMM, YYYY,')} ${moment(checkOrder.slot_time, 'HH:mm').format('h:mm A')}</p>       
                    <p>Vechile Details  :  ${checkOrder.vehicle_data}</p> 
                    <a href="https://www.google.com/maps?q=${checkOrder.latitude},${checkOrder.longitude}">Address Link</a><br>
                    <p> Best regards,<br/>PlusX Electric Team </p>
                </body>
            </html>`;
            emailQueue.addEmail(process.env.MAIL_POD_ADMIN, `Mobile EV Charging  Booking - ${booking_id}`, htmlAdmin);

            io.emit('plusx-notification-list', { msCount: 1 });

            return true;
        } else {
            return false;
        }

    } catch (err) {
        // await rollbackTransaction(conn);
        console.error("Transaction failed:", err);

        webHooktryCatchErrorHandler("POD  Webhook Error", err);
    } finally {
        // if (conn) conn.release();
        return false;
    }
};




const addMoneywebhook = async (rider_id, payment_intent_id, razorpay_order_id, amount) => {
    try {
        const paidAmount = amount; // / 100;
        const riders = await queryDB(`
            SELECT amount, out_standing_cost 
            FROM riders 
            WHERE rider_id = ?`, [rider_id]
        );
        let current_balance = parseFloat(riders.amount) + parseFloat(paidAmount);

        let queryParams = `amount = ? `;  // amount +
        let out_standing_cost = parseFloat(riders.out_standing_cost);

        if (out_standing_cost > 0) {
            current_balance = current_balance - out_standing_cost
            queryParams += ` , out_standing_cost = 0 `;
            out_standing_cost = 0;
        }
        let query = `UPDATE riders SET  ${queryParams}  WHERE rider_id = ?`;
        await db.execute(query, [current_balance, rider_id]);

        await insertRecord('transaction_history',
            [
                'rider_id', 'amount', 'payment_type', 'order_id', "outstanding", "current_balance",
                "prev_balance", "status", "payment_id",
            ], [
            rider_id, paidAmount, 'crd', razorpay_order_id, out_standing_cost, current_balance,
            riders.amount, "CNF", payment_intent_id,
        ]
        );
        // await updateRecord('transaction_history',{status:"CNF",payment_id:payment_intent_id,payment_type:"crd"}, ['order_id'],[razorpay_order_id] )

        return true;
    } catch (err) {
        webHooktryCatchErrorHandler("mobility add money webhook error", err)

    } finally {
        // if (conn) conn.release();
        return false;
    }
}

export const webHooktryCatchErrorHandler = (action, err) => {
    try {
        const stackLine = err.stack?.split("\n")[1]?.trim() || "Webhook api";
        logger.error(`[Webhook Error] Action: ${action}, Message: ${err.message}, At: ${stackLine}`);
    } catch (logError) {
        logger.error(`[Webhook Error Logging Failed] ${logError}`);
    }

    return false; // signal failure to inner function
};

const confirmCycleBookingPaymentOld = async (rider_id, booking_id, payment) => {
    try {
        const payment_id = payment.id;
        const order_id = payment.order_id;
        const paidAmount = payment.amount / 100;

        const paymentDate = moment
            .unix(payment.created_at)
            .format("YYYY-MM-DD HH:mm:ss");

        const rider = await queryDB(
            `SELECT 
            r.amount, 
            r.out_standing_cost, 
            r.rider_name, 
            r.rider_email, 
            cb.cycle_id, 
            cb.booking_id,
            cb.time_taken 
       FROM riders r
       LEFT JOIN cycle_booking cb 
       ON cb.booking_id = (
            SELECT booking_id
            FROM cycle_booking
            WHERE rider_id = r.rider_id
            ORDER BY created_at DESC
            LIMIT 1
        ) 
        WHERE r.rider_id = ?`,
            [rider_id],
        );

        const prev_balance = parseFloat(rider.amount || 0);
        let outstanding = parseFloat(rider.out_standing_cost || 0);

        let remainingPayment = paidAmount;
        let new_balance = prev_balance;

        if (outstanding > 0) {
            if (remainingPayment >= outstanding) {
                remainingPayment -= outstanding;
                outstanding = 0;
            } else {
                outstanding -= remainingPayment;
                remainingPayment = 0;
            }

            new_balance = prev_balance + remainingPayment;

            await updateRecord(
                "riders",
                {
                    amount: new_balance,
                    out_standing_cost: outstanding,
                },
                ["rider_id"],
                [rider_id],
            );

            await insertRecord(
                "transaction_history",
                [
                    "rider_id",
                    "order_id",
                    "amount",
                    "payment_type",
                    "payment_id",
                    "reference_id",
                    "status",
                    "prev_balance",
                    "current_balance",
                    "outstanding",
                ],
                [
                    rider_id,
                    booking_id,
                    paidAmount,
                    "debt",
                    payment_id,
                    order_id,
                    "CNF",
                    prev_balance,
                    new_balance,
                    outstanding,
                ],
            );
            const mail_template = NOTIFICATION_CONTENT["PAYMENT_SUCCESS_EMAIL"];
            emailQueue.addEmail(
                rider.rider_email,
                mail_template.subject({
                    booking_id: rider.booking_id,
                }),
                mail_template.content({
                    rider_name: rider.rider_name,
                    amount: paidAmount,
                    booking_id: rider.booking_id,
                    cycle_id: rider.cycle_id,
                    time_taken: rider.time_taken,
                }),
            );
        }
        return true;
    } catch (err) {
        console.log(err);
        webHooktryCatchErrorHandler("cycle booking webhook error", err);
    }
};

const confirmCycleBookingPayment = async (rider_id, booking_id, payment) => {
    try {
        const payment_id = payment.id;
        const order_id = payment.order_id;
        const paidAmount = payment.amount / 100;

        const paymentDate = moment
            .unix(payment.created_at)
            .format("YYYY-MM-DD HH:mm:ss");

        const rider = await queryDB(
            `SELECT
            r.amount,
            r.security_deposit,
            r.out_standing_cost,
            r.rider_name,
            r.rider_email,
            cb.cycle_id,
            cb.booking_id,
            c.min_wallet_price, 
            c.min_sec_deposit, 
            cb.time_taken
       FROM riders r
        JOIN country c 
        ON r.country_code = c.country_code
       LEFT JOIN cycle_booking cb
       ON cb.booking_id = (
            SELECT booking_id
            FROM cycle_booking
            WHERE rider_id = r.rider_id
            ORDER BY created_at DESC
            LIMIT 1
       )
       WHERE r.rider_id = ?`,
            [rider_id],
        );

        if (!rider) {
            throw new Error(`Rider not found for rider_id: ${rider_id}`);
        }

        const prev_balance = parseFloat(rider.amount || 0);
        let walletBalance = prev_balance;
        let securityDeposit = parseFloat(rider.security_deposit || 0);
        let outstanding = parseFloat(rider.out_standing_cost || 0);

        let remainingAmount = paidAmount;

        /**
         * STEP 1: Settle outstanding amount
         */
        if (outstanding > 0) {
            const outstandingPaid = Math.min(remainingAmount, outstanding);

            outstanding -= outstandingPaid;
            remainingAmount -= outstandingPaid;
        }

        /**
         * STEP 2: Complete security deposit to ₹100
         */
        const depositNeeded = Math.max(0, rider.min_sec_deposit - securityDeposit);
        const depositAdded = Math.min(depositNeeded, remainingAmount);

        securityDeposit += depositAdded;
        remainingAmount -= depositAdded;

        /**
         * STEP 3: Credit remaining amount to wallet
         */
        walletBalance += remainingAmount;

        // Update rider balances
        await updateRecord(
            "riders",
            {
                amount: walletBalance,
                security_deposit: securityDeposit,
                out_standing_cost: outstanding,
            },
            ["rider_id"],
            [rider_id],
        );

        // Save transaction
        await insertRecord(
            "transaction_history",
            [
                "rider_id",
                "order_id",
                "amount",
                "payment_type",
                "payment_id",
                "reference_id",
                "status",
                "prev_balance",
                "current_balance",
                "outstanding",
            ],
            [
                rider_id,
                booking_id,
                paidAmount,
                // "debt",
                "crd",
                payment_id,
                order_id,
                "CNF",
                prev_balance,
                walletBalance,
                outstanding,
            ],
        );

        // Send confirmation email
        const mail_template = NOTIFICATION_CONTENT["PAYMENT_SUCCESS_EMAIL"];

        emailQueue.addEmail(
            rider.rider_email,
            mail_template.subject({
                booking_id: rider.booking_id,
            }),
            mail_template.content({
                rider_name: rider.rider_name,
                amount: paidAmount,
                booking_id: rider.booking_id,
                cycle_id: rider.cycle_id,
                time_taken: rider.time_taken,
            }),
        );

        return true;
    } catch (err) {
        console.log(err);
        webHooktryCatchErrorHandler("cycle booking webhook error", err);
        return false;
    }
};
 