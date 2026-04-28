import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import db from '../../../config/indiadb.js';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { asyncHandler, formatDateTimeInQuery, generateRandomPassword, mergeParam } from '../../../utils.js';
import validateFields from '../../../validationForAdmin.js';
import { queryDB } from '../../../dbUtils.js';

dotenv.config();

var transporter = nodemailer.createTransport({
    host : process.env.MAIL_HOST,
    port : process.env.MAIL_PORT,
    auth : {
        user : process.env.MAIL_USERNAME,
        pass : process.env.MAIL_PASSWORD
    }
});

export const notificationList = asyncHandler(async (req, resp) => {
    const { page_no, getCount } = mergeParam(req);
    const { isValid, errors }   = validateFields(mergeParam(req), { page_no: ["required"],});

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const limit = 10;
    const start = parseInt((page_no * limit) - limit, 10);

    const totalRows  = await queryDB(`SELECT COUNT(*) AS total FROM notifications WHERE module_name in ('mobility') and panel_to = ? and status = '0' `, ['Admin']);
    if(getCount){
     
        return resp.json({ 
            status : 1, 
            code       : 200, 
            message    : ["Notification Count Only"], 
            data       : [], 
            total_page : 0, 
            totalRows  : totalRows.total
        });
    }
    const total_page = Math.ceil(totalRows.total / limit) || 1; 
    const [rows] = await db.execute(`SELECT id, heading, description, module_name, panel_to, panel_from, receive_id, status, ${formatDateTimeInQuery(['created_at'])}, href_url
        FROM notifications WHERE module_name in ('mobility') and panel_to = 'Admin' ORDER BY id DESC LIMIT ${start}, ${parseInt(limit)} 
    `, []);
    
    const notifications = rows;  // and status = 0 
    await db.execute(`UPDATE notifications SET status=? WHERE module_name in ('mobility') and status=? AND panel_to=?`, ['1', '0', 'Admin']);
    
    return resp.json({ 
        status     : 1, 
        code       : 200, 
        message    : ["Notification list fetch successfully"], 
        data       : notifications, 
        total_page : total_page, 
        totalRows  : totalRows.total
    });
});


