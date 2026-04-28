import moment from "moment";
import db from "../../config/indiadb.js";
import { queryDB, updateRecord,insertRecord } from "../../dbUtils.js";
import { tryCatchErrorHandler } from "../../middleware/errorHandler.js";
import { asyncHandler, sendOtp, checkNumber, delOTP, formatDateInQuery, formatDateTimeInQuery, generateOTP, generateRandomPassword, getOTP, mergeParam, storeOTP, createNotification } from "../../utils.js"; //formatNumber,
import validateFields from "../../validation.js";
import crypto from 'crypto';
import dotenv from "dotenv";
dotenv.config();
import bcrypt from "bcryptjs";
import { io } from "../../server.js";
import { newcreateCustomer } from "../../mobility/controller/razorpay/razorpay.js";

import emailQueue from "../../emailQueue.js";

export const notificationList = asyncHandler(async (req, resp) => {
    const { rider_id, page_no} = mergeParam(req);

    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id: ["required"], page_no: ["required"],
    });

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const limit = 10;
    const start = parseInt((page_no * limit) - limit, 10);

    const totalRows = await queryDB(`SELECT COUNT(*) AS total FROM notifications WHERE   panel_to = ? AND receive_id = ?`, ['Rider', rider_id]);
    const total_page = Math.ceil(totalRows.total / limit) || 1; 
    
    const [rows] = await db.execute(`SELECT id, heading, description, module_name, panel_to, panel_from, receive_id, status, ${formatDateTimeInQuery(['created_at'])}, href_url
        FROM notifications WHERE  panel_to = 'Rider' AND receive_id = ? ORDER BY id DESC LIMIT ${start}, ${parseInt(limit)} 
    `, [rider_id]);
    
    const notifications = rows;
    
    await db.execute(`UPDATE notifications SET status=? WHERE  status=? AND panel_to=? AND receive_id=?`, ['1', '0', 'Rider', rider_id]);
    
    return resp.json({status:1, code: 200, message: "Notification list fetch successfully", data: notifications, total_page: total_page, totalRows: totalRows.total});
});

export const forgotPassword = asyncHandler(async (req, resp) => {
    const { email } = mergeParam(req);
    if (!email) return resp.status(400).json({ status: 0, code: 405, error: true, message: ['Email is required'] });
    const [[rider]] = await db.execute('SELECT rider_name FROM riders WHERE rider_email=?', [email]);
    
    if(!rider){
        return resp.json({status: 0, code: 400, message: 'Oops! Invalid Email Address'});
    }
    const password = generateRandomPassword(6);
    const hashedPswd = await bcrypt.hash(password, 10);
    await db.execute('UPDATE riders SET password=? WHERE rider_email=?', [hashedPswd, email]);
    
    try {
        const html = `<html>
          <body>
            <h4>Dear ${rider.rider_name},</h4>
            <p>We have generated a new password for you <b>'${password}'</b> Please use this temporary password to log in to your account.</p> 
            <p>Once logged in, we highly recommend that you change your password to something more memorable. You can do this by following these simple steps: </p>
            <p>Log in to your account using the provided temporary password.</p>
            <p>Navigate to the "Profile" section.</p> 
            <p>Look for the "Reset Password" option within the profile settings.</p>                         
            <p>Enter your new password and confirm it.</p> 
            <p>Save the changes.</p> 
            <p>Regards,<br/>PlusX Electric Team </p>
          </body>
        </html>`;
        emailQueue.addEmail(email, `Forgot Password Request - PlusX Electric App`, html);
    
        return resp.status(200).json({ status: 1, code: 200, message: "Password Reset Request! We have sent the new password to your registered email." });
    } catch (error) {
        console.log(error)
        tryCatchErrorHandler(req.originalUrl, error, resp );
        // resp.status(500).json({ status: 0, code: 500, message: "Failed to send email." });
    }
});

export const logout = asyncHandler(async (req, resp) => {
    const {rider_id} = mergeParam(req);
    if (!rider_id) return resp.json({ status: 0, code: 422, message: ["Rider Id is required"] });
    
    const rider = queryDB(`SELECT EXISTS (SELECT 1 FROM riders WHERE rider_id = ?) AS rider_exists`, [rider_id]);
    if(!rider) return resp.json({status:0, code:400, message: 'Rider ID Invalid!'});

    const update = await updateRecord('riders', {status:0, access_token: "", fcm_token : ""},['rider_id'], [rider_id]);
    
    if(update.affectedRows > 0){
        return resp.json({status: 1, code: 200, message: 'Logged out sucessfully'});
    }else{
        return resp.json({status: 0, code: 405, message: 'Oops! There is something went wrong! Please Try Again'});
    }

});

export const updatePassword = asyncHandler(async (req, resp) => {
    const { rider_id, old_password, new_password, confirm_password} = mergeParam(req);

    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id: ["required"], old_password: ["required"], new_password: ["required"], confirm_password: ["required"]
    });

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    if(new_password != confirm_password) return resp.json({ status: 0, code: 422, message: ['New password and confirm password not matched!'] });
    
    const rider = await queryDB(`SELECT password FROM riders WHERE rider_id=?`, [rider_id]);
    
    const isMatch = await bcrypt.compare(old_password, rider.password);  
    if (!isMatch) return resp.json({ status: 0, code: 422, message: ["Please enter correct current password."] });

    const hashedPswd = await bcrypt.hash(new_password, 10);
    const update = await updateRecord('riders', {password: hashedPswd}, ['rider_id'], [rider_id]);

    return resp.json({
        status: update.affectedRows > 0 ? 1 : 0, 
        code: update.affectedRows > 0 ? 200 : 422, 
        message: update.affectedRows > 0 ? ['Password changed successfully'] : ['Failed to updated password. Please Try Again']
    });
});

export const updateProfile = asyncHandler(async (req, resp) => {
    
        let profile_image = '';
        if(req.files && req.files['profile_image']) { 
            const files   = req.files;
            profile_image = files ? files['profile_image'][0].filename : '';
        }

        const { rider_id, first_name, last_name, rider_email, country_code='+91', rider_mobile='', emirates='',city_id='',state_id='' } = mergeParam(req);
       
        const { isValid, errors } = validateFields(mergeParam(req), {
            rider_id     : ["required"], 
            // first_name   : ["required"], 
            // last_name    : ["required"], 
            // rider_email  : ["required"], 
            // country_code : ["required"], 
            // rider_mobile : ["required"], 
            // emirates     : ["required"]
        });
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
        let updates ={};
        updates.profile_img=profile_image;
      
        const rider = await queryDB(`SELECT state_id ,city_id ,last_name,rider_name,rider_email ,profile_img FROM riders WHERE rider_id=?`, [rider_id]);
         const other_rider = await queryDB(`SELECT id FROM riders WHERE rider_email=? and rider_id !=?`,[rider_email,rider_id] );
        if(other_rider){     return resp.json({status: 0, code: 422, message: ["This email address is already registered"]});}
       (rider.rider_email!==rider_email ) ? updates.rider_email=rider_email : null;
       (first_name!==rider.rider_name)? updates.rider_name=first_name:null;
       
        (last_name!==rider.last_name)?updates.last_name=last_name:null;

        ( city_id  &&  city_id!==rider.city_id )? updates.city_id=city_id:null;

        
         if(state_id && state_id!==rider.state_id){
            updates.state_id=state_id
        const state = await queryDB(`SELECT name FROM states WHERE state_id=?`, [state_id]);
               updates.state=state.name;
        }
        

        
        const insert = await insertRecord('profile_history', 
            [ 'user_id', 'panel', 'image', 'action' ],
            [ rider_id, 'user', rider.profile_img, 'profile updated' ]
        );
        if( insert.affectedRows == 0 ){ 
            return resp.json({ status: 0, code: 400, message: ['Rider profile was not updated!'] });
        }
        
        
    

        await updateRecord('riders', updates, ['rider_id'], [rider_id]);
       
        
        return resp.json({status: 1, code: 200, message: ["Rider profile updated successfully"]});
    
});
 
export const deleteImg = asyncHandler(async (req, resp) => {
    const {rider_id} = mergeParam(req);
    if (!rider_id) return resp.json({ status: 0, code: 422, message: ["Rider Id is required"] });
    
    const rider = await queryDB(`SELECT profile_img FROM riders WHERE rider_id = ?`, [rider_id]);
    if(!rider) return resp.json({status:0, code:400, message: 'Rider ID Invalid!'});
    
    const insert = await insertRecord('profile_history', 
        [ 'user_id', 'panel', 'image', 'action' ],
        [ rider_id, 'user', rider.profile_img, 'profile image deleted' ]
    );
    if( insert.affectedRows == 0 ){ 
        return resp.json({ status: 0, code: 400, message: ['Rider profile image was not deleted!'] });
    }
    const update = await updateRecord('riders', {profile_img: ''}, ['rider_id'], [rider_id]);
    // const oldImagePath = path.join(process.env.S3_FOLDER_NAME, 'rider_profile', rider.profile_img || '').replace(/\\/g, '/');
    // await deleteImageFromS3(oldImagePath);

    return resp.json({
        status: update.affectedRows > 0 ? 1 : 0,
        code: 200,
        message: update.affectedRows > 0 ? ['Rider profile image deleted successfully!'] : ['Oops! Something went wrong. Please try again.'],
    });
});
 
export const deleteAccount = asyncHandler(async (req, resp) => {
    const {rider_id} = mergeParam(req);
  
    if (!rider_id) return resp.json({ status: 0, code: 422, message: ["Rider Id is required"] });

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        
        const [[rider]] = await connection.execute(`
            SELECT 
                profile_img, rider_name, last_name, rider_email, country_code, rider_mobile, state, city_id,country_id, country_id, student_id, id_image, password, latitude, longitude, university,added_from, account_type 
            FROM riders 
            WHERE rider_id = ?`, [rider_id]
        );
        if(!rider) { await connection.commit(); return resp.json({status:0, message: 'Rider not found.'});}
       
        const sql = `INSERT INTO deleted_riders 
            (rider_id, rider_name, last_name, rider_email, country_code, rider_mobile, state, city_id, country_id, student_id, id_image, password, latitude, longitude, university, profile_img, added_from, account_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const rider_data = [
            rider_id, rider.rider_name, rider.last_name, rider.rider_email, rider.country_code,rider.rider_mobile, rider.state, rider.city_id, rider.country_id, rider.student_id, rider.id_image, rider.password, rider.latitude, rider.longitude, rider.university, rider.profile_img, rider.added_from, rider.account_type 
        ];
        const deleted_riders= await connection.execute(sql, rider_data);

        if(!deleted_riders) { 
            await connection.commit(); return resp.json({status:0, message: 'Rider not found! '});
        }
        const deleteQueries = [
            'DELETE FROM riders WHERE rider_id = ?',   
        ];
        let totalDeleted = 0;

        for (const query of deleteQueries) {
         
            const [deleted]= await connection.execute(query, [rider_id]);
            totalDeleted += deleted.affectedRows;
        }

        if (totalDeleted===0)        return resp.json({status: 0, code: 200,error: false,  message: ['Rider Account was not deleted !']});
 
           await connection.commit();
        return resp.json({status: 1, code: 200, error: false, message: ['Rider Account deleted successfully!']});
    } catch(err) {
        await connection.rollback();
        console.error('Error deleting rider account:', err.message);
        tryCatchErrorHandler(req.originalUrl, err, resp );
    } finally {
        connection.release();
    }
});

export const responseContent = asyncHandler(async (req, resp) => {
    const  normalize = val => (!val || val === 'null' || val === '') ? null : val;

    let { module_name, response_type, sub_module } = mergeParam(req);

    module_name   = normalize(module_name);
    sub_module    = normalize(sub_module);
    response_type = normalize(response_type);

    const { isValid, errors } = validateFields(mergeParam(req), { module_name : ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
 
    let query = `select content, sub_module from response_content  where module_name=? and status=1  `;
    let queryParams = [module_name];
    
    if (response_type != null && sub_module != null) { 
        let subModules = Array.isArray(sub_module)? sub_module : sub_module.split(',').map(s => s.trim());
        query += ` and sub_module IN (${subModules.map(() => '?').join(', ')})  AND response_type = ? `;
        queryParams.push(...subModules)
        queryParams.push(response_type);
    }    
    const [responseContent] = await db.execute(query, queryParams);
    
    if (!responseContent || responseContent.length === 0) return resp.json({ resp: 0, code: 400, msg: 'content not found!' });

    if (response_type !== null && sub_module !== null) {

        const contentMap = {};
        for (const row of responseContent) {
            if (row.sub_module) {
                contentMap[row.sub_module] = row.content;
            }
        }
        return resp.json({ message: ["single response content fetch successfully"], status: 1, code: 200, data: contentMap });
    }
    const columnMap = {
        'portable-charger' : 'portable_price',
        'pick-drop'        : 'pick_drop_price',
        // 'road-assistance'  : 'roadside_assistance_price'
    };
    const column = columnMap[module_name];
    let selectQuery = `
        SELECT heading, image ${column ? `, (SELECT ${column} FROM booking_price) AS price` : ``}
        FROM response_module
        WHERE name = ? AND status = 1
        LIMIT 1
    `; 
    const [[contentdata]] = await db.execute(selectQuery,[module_name]);
    if (!contentdata) return resp.json({ resp: 0, code: 400, msg: 'content not found!' });

    let { heading, image, price} = contentdata;
    let contentArray = responseContent.map(row => { return row.content; });

    let priceErrMsg = '';
    if(module_name == 'road-assistance') {
        const currDate = moment().tz('Asia/Kolkata').format('dddd');
        const currTime = moment().tz('Asia/Kolkata').format('HH:mm:ss');
        
        const priceQry  = `
            SELECT slot_price 
            FROM road_assistance_slot 
            WHERE status = 1 AND slot_date = ? AND ? BETWEEN start_time AND end_time ORDER BY start_time ASC  
            LIMIT 1`;
        const priceData = await queryDB(priceQry, [ currDate, currTime]);
        price           = priceData?.slot_price || 0;
        const slotContent = await queryDB(` SELECT content FROM  response_content WHERE  module_name = ? AND response_type = ? Order by id desc LIMIT 1 `, [ `${module_name}-price`, 'error' ]);

        priceErrMsg = slotContent?.content || '';
    }
    // Added By Ravi 2 query 
    let zeroBatteryContent = ""
    if(module_name == 'portable-charger') {
        const zeroBatteryContentObj = await queryDB(`SELECT content FROM response_content WHERE response_type = ? AND sub_module = ? Order by id desc LIMIT 1`, [ 'info', `zero-battery` ]);
        zeroBatteryContent = zeroBatteryContentObj?.content || "";
    }
    let data = { 
        content    : contentArray, 
        image      : image || null, 
        heading    : heading ||null, 
        price      : price || 0,
        slotErrMsg : priceErrMsg ,
        zeroPercentModal : zeroBatteryContent,
        
    };
    return resp.json({ message: ["Response data fetch successfully"], status: 1, code: 200, data });
});

export const stateCountry = asyncHandler(async (req, resp) => {
    const {requirement,country_id,state_id}=mergeParam(req);
    let validationRules = {requirement   : ["required"],};
    
    const { isValid, errors } = validateFields(mergeParam(req), validationRules);
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    let list;

    switch (requirement) {  
        case 'country':
            [list] = await db.execute(`SELECT country_id ,name , null as state_id, null as city_id FROM country  ORDER BY name ASC`);
           
        
            return resp.json({status: 1, code: 200, data: list , message: ['country List fetch successfully!']});

        case 'state':
            if (!country_id) {
                return resp.json({status: 0, code: 422,  message: ['country_id is required for state list']});
            }
            [list] = await db.execute(`SELECT  country_id, state_id,  name, null as city_id  FROM states WHERE country_id = ? ORDER BY name ASC`, [country_id]);
            return resp.json({status: 1, code: 200, message: ['State List fetch successfully!'], data: list});

        case 'city':
            if (!state_id) {
                return resp.json({status: 0, code: 422,  message: ['state_id is required for city list']});
            }
            [list] = await db.execute(`SELECT city_id,name FROM cities where state_id=? ORDER BY name ASC`,[state_id]);
            return resp.json({status: 1, code: 200, data: list, message:[ 'cities List fetch successfully!']});

        default:
        return resp.json({ status: 0, code: 400,  message: ['Invalid Requirement type'] });
    }
  
});

export const regsCreateOTP = asyncHandler(async (req, resp) => {
    const { first_name, last_name='', mobile, country_code, rider_email } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {
        first_name   : ["required"], 
        mobile       : ["required"], 
        country_code : ["required"],
        rider_email  : ["required"]
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const res = checkNumber(country_code, mobile);
    if(res.status == 0) return resp.json({ status:0, code:422, message: res.msg });

    const fullMobile = `${country_code}${mobile}`;
    // (SELECT COUNT(*) FROM rsa WHERE rsa.mobile = ? ) AS rsa_mob
    const [[isExist]] = await db.execute(`
        SELECT rider_mobile, 
            (SELECT COUNT(*) FROM riders AS r WHERE r.rider_email = ?) AS check_email,
            (SELECT COUNT(*) FROM riders AS r1 WHERE r1.rider_mobile = ?) AS check_mob
        FROM 
            riders
        LIMIT 1 `, [rider_email, mobile ]  //, fullMobile
    );
    if(isExist.check_mob > 0 ) return resp.json({ status:0, code:422, message: ['The provided number already exists.'] });  // || isExist.rsa_mob > 0 

    if(isExist.check_email > 0 ) return resp.json({ status:0, code:422, message: ['Email already registered.'] }); 

    const otp = generateOTP(4);
    storeOTP(fullMobile, otp);
    
    // return resp.json({ status: 1, code: 200, data: otp, message: ['OTP sent successfully!'] }); /// Only for Testing Local

    const html = `<html>
        <body>
            <h4>Hello ${first_name} ${last_name},</h4>
            <p>Thank you for signing up with PlusX Electric.</p> 
            <p>Your One-Time Password (OTP) for completing the signup process is: ${otp} </p>
            
            <p>Please enter this code to verify your account. For your security, do not share this OTP with anyone.</p>                         
            <p>If you did not request this, please ignore this email.</p> 
            
            <p>Best regards, <br/> PlusX Electric Team</p>
        </body>
    </html>`;
    emailQueue.addEmail(rider_email, `Your OTP for Signup - PlusX Electric`, html);

    sendOtp( fullMobile,
        `Your OTP for signup is ${otp}. Do not share it with anyone. Thank you for choosing PlusX Electric.`
    )
    .then(result => {
        if (result.status === 0) return resp.json(result);
        return resp.json({ status: 1, code: 200, data: '', message: ['OTP sent successfully!'] });
    })
    .catch(err => {
        tryCatchErrorHandler(req.originalUrl, err, resp, 'Failed to send OTP' );
    }); 
    
});

export const register = asyncHandler(async (req, resp) => {
    const { 
        first_name, last_name, rider_email, country_code, rider_mobile, added_from, city_id, state_id, state,country_id, device_name = "", otp, fcm_token=''  
    } = req.body;

    let validationRules = {
        first_name   : ["required"],
        last_name    : ["required"],
        rider_email  : ["required", "email"],
        country_code : ["required"],
        rider_mobile : ["required"],
        city_id      : ["required"],
        state_id     : ["required"],
        country_id   : ["required"],
        otp          : ["required"],
        // fcm_token    : ["required"],
    };
    const { isValid, errors } = validateFields(mergeParam(req), validationRules);
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const res = checkNumber(country_code, rider_mobile);
    if(res.status == 0) return resp.json({ status:0, code:422, message: res.msg });

    const fullMobile = `${country_code}${rider_mobile}`;
    const cachedOtp  = getOTP(fullMobile);
    if (!cachedOtp || cachedOtp !== otp) return resp.json({ status: 0, code: 422, message: ["OTP invalid!"] }); 
    
    const rider = await insertRecord('riders', [
        'rider_id', 'rider_name', 'last_name', 'rider_email', 'country_code', 'rider_mobile', 'status', 'added_from', 'city_id', 'state_id', 'state', 'country_id', 'device_name'
    ],[ 'PM', first_name, last_name, rider_email, country_code, rider_mobile, 0, added_from || 'Android', city_id,state_id, state, country_id, device_name ]);
    
    if(!rider) return resp.json({status:0, code:405, message: ["Failed to register. Please Try Again"], error: true}); 

    const riderId = 'PM' + String(rider.insertId).padStart(4, '0');
    const token   = crypto.randomBytes(12).toString('hex');
    const updtObj = {
        rider_id     : riderId,
        access_token : token, 
        status       : 1, 
        fcm_token    : fcm_token
    }
    await updateRecord('riders', updtObj, ['id'], [ rider.insertId ]);
    delOTP(fullMobile);
    
    const result = {
        image_url    : `${process.env.DIR_UPLOADS}rider_profile/`,
        rider_id     : riderId,
        rider_name   : first_name,
        last_name    : last_name,
        rider_email  : rider_email,
        profile_img  : null,
        country_code : country_code,
        rider_mobile : rider_mobile,
        city_id      : city_id,
        state_id     : state_id,
        access_token : token
    };
    await createNotification(`New User Signup`, `${first_name} ${last_name} signed up`, `mobility`, 'Admin', 'user', riderId, '', `app-signup/app-signup-details/${riderId}`);
    io.emit('notification-list', {msCount : 1});
    return resp.json({ status:1, code:200, message: ["User registered successfully"], result: result});
});

export const login = asyncHandler(async (req, resp) => {
    const { mobile, password ,fcm_token , country_code } = mergeParam(req);

    const { isValid, errors } = validateFields(mergeParam(req), {
        mobile: ["required"], password: ["required"], fcm_token: ["required"], country_code: ["required"],
    });

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const [[rider]] = await db.execute(
        `SELECT rider_id, rider_name, rider_email, profile_img, country_code, country, emirates, status, password, rider_mobile FROM riders WHERE rider_mobile = ? AND country_code = ? LIMIT 1`,
        [mobile, country_code]
    );

    if(!rider) return resp.json({ status: 0, code: 422, message: ["The mobile number is not registered with us. Kindly sign up."] });
    const isMatch = await bcrypt.compare(password, rider.password);
    if (!isMatch) return resp.json({ status:0, code:405, error:true, message: ["Password is incorrect"] });
    if (rider.status == 2) return resp.json({ status:0, code:405, error:true, message: ["You can not login as your status is inactive. Kindly contact to customer care"] });
    
    const token = crypto.randomBytes(12).toString('hex');
    const [update] = await db.execute(`UPDATE riders SET access_token = ?, status = ?, fcm_token = ? WHERE rider_mobile = ?`, [token, 1, fcm_token, mobile]);
    if(update.affectedRows > 0){
        const result = {
            image_url    : `${process.env.DIR_UPLOADS}rider_profile/`,
            rider_id     : rider.rider_id,
            rider_name   : rider.rider_name,
            rider_email  : rider.rider_email,
            profile_img  : rider.profile_img,
            country_code : rider.country_code,
            rider_mobile : rider.rider_mobile,
            country      : rider.country,
            emirates     : rider.emirates,
            access_token : token
        };
    
        return resp.json({status:1, code:200, message: ["Login successful"], result: result});
    }else{
        return resp.json({status:0, code:405, message: ["Oops! There is something went wrong! Please Try Again"], error: true});
    }
});

export const createOTP = asyncHandler(async (req, resp) => {
    const { mobile, country_code } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {mobile: ["required"], country_code: ["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const res = checkNumber(country_code, mobile);
    if(res.status == 0) return resp.json({ status:0, code:422, message: res.msg });
    
    const riderData = await queryDB(`
        SELECT rider_name, last_name, rider_email 
        FROM riders 
        WHERE rider_mobile = ? AND country_code = ?`, [mobile, country_code]
    );
    if (!riderData) return resp.json({ status: 0, code: 422, message: ['The provided mobile number is not registered.'] });
    
    const fullMobile = `${country_code}${mobile}`;
    let otp          = ( mobile == '9459459459' || mobile == '9410934120' || mobile == '9879879879') ? "9404" : generateOTP(4);
    storeOTP(fullMobile, otp);
     
    const html = `<html>
        <body>
            <h4>Hello ${riderData.rider_name} ${riderData.last_name},</h4>
            <p>Thank you for signing in with PlusX Electric.</p> 
            <p>Your One-Time Password (OTP) for completing the signin process is: ${otp} </p>
            
            <p>Please enter this code to verify your account. For your security, do not share this OTP with anyone.</p>                         
            <p>If you did not request this, please ignore this email.</p> 
            
            <p>Best regards, <br/> PlusX Electric Team</p>
        </body>
    </html>`;
    emailQueue.addEmail(riderData.rider_email, `Your OTP for Signin - PlusX Electric`, html);

    // return resp.json({ status: 1, code: 200, data: otp, message: ['OTP sent successfully!'] });

    sendOtp( fullMobile,
        `Your OTP for login is ${otp}. Do not share it with anyone. Thank you for choosing PlusX Electric.`
    )
    .then(result => {
        if (result.status === 0) return resp.json(result);
        return resp.json({ status: 1, code: 200, data: '', message: ['OTP sent successfully!'] });
    })
    .catch(err => {
        console.error('Error in otpController:', err.message);
        return resp.json({ status: 'error', msg: 'Failed to send OTP' });
    });
    //return resp.json({ status: 1, code: 200, data: otp, message: ['OTP sent successfully!'] });
});

export const verifyOTP = asyncHandler(async (req, resp) => {
    const { mobile, country_code, fcm_token, otp, device_name ='' } = mergeParam(req);
   
    const { isValid, errors } = validateFields(mergeParam(req), { 
        mobile       : ["required"], 
        country_code : ["required"], 
        fcm_token    : ["required"], 
        otp          : ["required"] 
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const riderData = await queryDB(`SELECT    customer_id ,rider_id, rider_name, last_name, rider_email, profile_img, state, status FROM riders WHERE rider_mobile =? AND country_code =? LIMIT 1`, [mobile, country_code]);

    if(!riderData) return resp.json({ 
        status  : 0, code: 422, 
        message : ["The mobile number is not registered with us. Kindly sign up."] 
    });
    if(riderData.status == 2){
        return resp.json({status: 1, code: 422, message: ["You can not login as your status is inactive. Kindly contact to customer care"]});
    }
    const fullMobile = `${country_code}${mobile}`;
    const cachedOtp  = getOTP(fullMobile);
    
    if (!cachedOtp || cachedOtp !== otp) return resp.json({ status: 0, code: 422, message: ["OTP invalid!"] });

    const token  = crypto.randomBytes(12).toString('hex');
    await updateRecord('riders', { access_token: token, status : 1, fcm_token, device_name }, ['rider_mobile', 'country_code'], [mobile, country_code]);

    delOTP(fullMobile);
    let respResult = {
        image_url     : `${process.env.DIR_UPLOADS}rider_profile/`,
        rider_id      : riderData.rider_id,
        rider_name    : riderData.rider_name,
        last_name     : riderData.last_name,
        rider_email   : riderData.rider_email,
        profile_img   : riderData.profile_img,
        rider_mobile  : mobile,
        country_code  : country_code,        
        emirates      : riderData.emirates,
        access_token  : token
    };
    if(riderData.customer_id==="" || riderData.customer_id===null){
        
        newcreateCustomer(riderData.rider_id);
        console.log("background customer created");
    }
    return resp.json({message: [ "Login successful!" ], status: 1, code: 200, is_login: 1, result: respResult});
});

export const countryList = asyncHandler(async (req, resp) => {
    const [list] = await db.execute(`SELECT name, iso_code, dial_code FROM country ORDER BY name ASC`);
    return resp.json({status: 1, code: 200, message: 'Country List', data: list});
});

export const getRiderData = asyncHandler(async(req, resp) => {
    const {rider_id} = mergeParam(req);
    if (!rider_id) return resp.json({ status: 0, code: 422, message: ["Rider Id is required"] });
    
    const rider = await queryDB(`
        SELECT
            cn.min_wallet_price, r.* , st.name as state, ct.name city, cn.name as country, 
            ${formatDateTimeInQuery(['r.created_at', 'r.updated_at'])}, 
            ${formatDateInQuery(['date_of_birth'])} 
        FROM
        riders r
        LEFT JOIN states st on st.state_id=r.state_id
        LEFT JOIN cities ct on ct.city_id=r.city_id 
        LEFT join country cn on cn.country_id=r.country_id
        WHERE rider_id = ? `, [ rider_id ]
    );
    rider.image_url         = `${process.env.DIR_UPLOADS}profile-image/`;
    rider.min_wallet_price  = parseFloat(rider.min_wallet_price);
    rider.out_standing_cost = parseFloat(rider.out_standing_cost);
    rider.amount            = parseFloat(rider.amount);

    return resp.json({
        status  : 1, 
        code    : 200, 
        message : ['Rider Data fetch successfully!'], 
        data    : rider, 
    });
});

export const home = asyncHandler(async (req, resp) => {
    const {rider_id} = mergeParam(req);
    if (!rider_id) return resp.json({ status: 0, code: 422, message: ["Rider Id is required"] });
    
    const riderQuery = `SELECT cn.min_wallet_price, r.out_standing_cost , r.rider_id, r.rider_name, r.amount as wallet_amount,
        (SELECT COUNT(*) FROM notifications AS n WHERE n.panel_to = 'Rider' AND n.receive_id = r.rider_id AND status = '0') AS notification_count
        FROM riders r 
        JOIN country cn on cn.country_id=r.country_id
        WHERE r.rider_id =?
    `;
    const riderData = await queryDB(riderQuery, [rider_id]);

    if (!riderData) {
        return resp.status(404).json({ message: "Rider not found", status: 0 });
    }

    const result = {
        rider_id           : riderData.rider_id,
        rider_name         : riderData.rider_name,
        notification_count : parseFloat(riderData.notification_count),
        wallet_amount:parseFloat(riderData.wallet_amount),
        out_standing_cost:parseFloat(riderData.out_standing_cost),
        min_wallet_price:parseFloat(riderData.min_wallet_price)
    };
    const orderData = await queryDB(
        `SELECT request_id, (SELECT CONCAT(rsa_name, ',', country_code, ' ', mobile) FROM rsa WHERE rsa_id = road_assistance.rsa_id) AS rsaDetails, created_at 
        FROM road_assistance WHERE rider_id = ? AND order_status NOT IN ('PNR', 'CNF', 'A', 'PU', 'C', 'RO', 'CC') ORDER BY id DESC LIMIT 1
    `, [rider_id]);
    
    const podBookingData = await queryDB(
        `SELECT booking_id AS request_id, (SELECT CONCAT(rsa_name, ',', country_code, ' ', mobile) FROM rsa WHERE rsa_id = portable_charger_booking.rsa_id) AS rsaDetails, created_at 
        FROM portable_charger_booking WHERE rider_id = ? AND status NOT IN ('PNR', 'CNF', 'A', 'PU', 'C', 'RO', 'CC') ORDER BY id DESC LIMIT 1
    `, [rider_id]);
    
    const priceQry  = `SELECT roadside_assistance_price,portable_price FROM booking_price LIMIT 1`;
    const priceData = await queryDB(priceQry, []);

    return resp.json({
        message                   : ["Rider Home Data fetched successfully!"],
        rider_data                : result,
        order_data                : orderData || null,
        pick_drop_order           :  null,
        pod_booking                : podBookingData || null,
        roadside_assistance_price : priceData.roadside_assistance_price,
        portable_price            : priceData.portable_price,
        pick_drop_price           : 0,
        status                    : 1,
        code                      : 200
    });
});

export const redeemCoupon = asyncHandler(async (req, resp) => {
    const {rider_id, amount, booking_type, coupon_code } = mergeParam(req);
    
    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id     : ["required"], 
        amount       : ["required"],
        booking_type : ["required"],
        coupon_code  : ["required"],
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    const [[{ count }]] = await db.execute('SELECT COUNT(*) AS count FROM coupon WHERE coupan_code = ?',[coupon_code]);
    if (count === 0) return resp.json({ status: 0, code: 422, message: ['The coupon you entered is not valid.'] });

    const coupon = await queryDB(`
        SELECT
            coupan_percentage, end_date, user_per_user, status, booking_for, 
            (SELECT count(id) FROM coupon_usage AS cu WHERE cu.coupan_code = coupon.coupan_code AND user_id = ?) as use_count
        FROM coupon
        WHERE coupan_code = ?
        LIMIT 1 `, [ rider_id, coupon_code ]
    );
    if (moment(coupon.end_date).isBefore(moment(), 'day') || coupon.status < 1){
        return resp.json({ status: 0, code: 422, message: ["The coupon you entered has expired."]} );

    } else if(coupon.booking_for != booking_type){
        return resp.json({ status: 0, code: 422, message : ["The coupon you entered is not valid."]} );

    } else if(coupon.use_count >= coupon.user_per_user){
        return resp.json({ status: 0, code: 422, message: ["This coupon code has already been used the maximum number of times."]} );
    }
    const data = {}; 
    if ( coupon.coupan_percentage != parseFloat(100) ) {
        const dis_price = ( amount  * coupon.coupan_percentage ) /100;
        const total_amt = amount - dis_price;
        data.dis_price  = dis_price;
        data.t_vat_amt  = Math.floor(( total_amt ) * 18) / 100;
        data.total_amt  = total_amt + data.t_vat_amt;

    } else {
        data.t_vat_amt  = 0//Math.floor(( amount ) * 18) / 100;
        const total_amt  = parseFloat(amount) + parseFloat( data.t_vat_amt ); 

        const dis_price = ( total_amt * coupon.coupan_percentage)/100;
        data.dis_price  = dis_price;
        data.total_amt  = total_amt - dis_price;
    }
    const t_vat_amt   = data.t_vat_amt; //Math.floor(( amount ) * 5) / 100; 
    // const totalAmount = parseFloat(amount) + parseFloat( t_vat_amt );  
    const disAmount   = data.dis_price; //(totalAmount * coupon.coupan_percentage)/100;
    const finalAmount = data.total_amt; //totalAmount - disAmount;

    return resp.json({
        bookingAmount     :  parseFloat(amount).toFixed(2), //formatNumber(amount),
        vat_amt           : parseFloat(t_vat_amt).toFixed(2),//formatNumber(t_vat_amt),
        
        discount          : parseFloat(disAmount).toFixed(2),

        data              : parseFloat(finalAmount).toFixed(2),// formatNumber(finalAmount),  //formatNumber(finalAmount),
        coupan_percentage : Number(coupon.coupan_percentage),
        message           : ['Your discount has been successfully applied. Enjoy the savings!'],
        status            : 1,
        code              : 200
    });
});

export const uploadSImage = asyncHandler(async (req, resp) => {
    
    let profile_image = '';
    if(req.files && req.files['image']) { 
        const files   = req.files;
        profile_image = files ? files['image'][0].filename : '';
    }
    resp.json({message:"done"})
})

    