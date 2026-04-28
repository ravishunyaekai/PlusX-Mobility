import moment from "moment-timezone";
import db from "../../../config/indiadb.js";
import validateFields from "../../../validation.js";
import { getPaginatedData, queryDB } from '../../../dbUtils.js';  //,  updateRecord 
import { formatDateTimeInQuery, asyncHandler }from '../../../utils.js';

import dotenv from 'dotenv';
dotenv.config();
import { tryCatchErrorHandler } from "../../../middleware/errorHandler.js";

export const userTransactionList = asyncHandler(async (req, resp) => {
    try {
        const { 
            rider_id, page_no = 1, start_date = '', end_date = '', limit = "", transaction_type = "" 
        } = req.body;
        const { isValid, errors } = validateFields(req.body, { 
            rider_id : ["required"],
        });
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const params = {
            tableName  : 'transaction_history',
            columns    : `order_id, current_balance, outstanding, amount, payment_type, ${formatDateTimeInQuery(['created_at'])}`,
            sortColumn : 'created_at', 
            sortOrder  : 'DESC',
            page_no,
            limit            : limit == "" ? 10 : limit,
            liveSearchFields : [],
            liveSearchTexts  : [],
            whereField       : ['rider_id'],
            whereValue       : [rider_id],
            whereOperator    : ["="],
        };
        if (start_date ){
            const startDate = moment(start_date, "YYYY-MM-DD", "Asia/Kolkata")
                               .startOf("day").subtract(5.5, 'hours'); 
             
            params.whereField.push('created_at' );
            params.whereValue.push(startDate.format("YYYY-MM-DD HH:mm:ss") );
            params.whereOperator.push('>=');
        }
        if (end_date ) {
            const endDate = moment(end_date, "YYYY-MM-DD", "Asia/Kolkata")
                            .endOf("day").subtract(5.5, 'hours');
            
            params.whereField.push('created_at' );
            params.whereValue.push(endDate.format("YYYY-MM-DD HH:mm:ss") );
            params.whereOperator.push('<=');
        }   
        if(transaction_type) {
            const filterOject =  { RC : "debt", WC : "crd", RBW : "fn_refund" };

            params.whereField.push( 'payment_type' );
            params.whereValue.push(filterOject[transaction_type]);
            params.whereOperator.push( '=' );
        }
        const result = await getPaginatedData(params);
        const typeOject =  { 
            crd : "Wallet Recharge", debt : "Ride", refund : "Refund to Wallet", sd_refund : "SD Refunded", fn_refund : "Refund", 
        };
        const grouped = result.data.reduce((acc, item) => {
            const date = moment(item.created_at).format('YYYY-MM-DD');
            if (!acc[date]) {
                acc[date] = [];
            }
            // Transform item
            const formattedItem = {
                ride_id      : item.payment_type == 'debt' ? item.order_id : "",
                amount       : item.amount,
                payment_type : typeOject[item.payment_type] || item.payment_type,
                time         : item.created_at.split(" ")[1]
            };
            acc[date].push(formattedItem);
            return acc;
        }, {});
        // Convert to sorted array format
        const finalData = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a)).map(date => ({
            date         : date,
            transactions : grouped[date]
        }));
        const [responseContent] = await db.execute(`
            SELECT content 
            FROM response_content 
            WHERE module_name = ? and status = 1 `, ['mobility-wallet']
        );
        let contentArray = responseContent.map(row => { return row.content; });

        const riderData = await queryDB(`
            SELECT out_standing_cost, amount 
            FROM riders 
            WHERE rider_id = ? `, [ rider_id ] 
        );
        return resp.json({
            status      : 1,
            code        : 200,
            message     : ["User Transaction List fetched successfully!"],
            current_bal : parseFloat( riderData?.amount || 0 ).toFixed(2),
            data        : finalData,
            total_page  : result.totalPage,
            total       : result.total,
            content     : contentArray, 
        });
    } catch (error) {
        console.error('Error Transaction List:', error);
        tryCatchErrorHandler('Transaction List', error, resp );
    }
});
 