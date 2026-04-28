// import generateUniqueId from "generate-unique-id";
import { getPaginatedData, queryDB, updateRecord, formatFloatInQuery, insertRecord } from "../../../dbUtils.js";
import { asyncHandler, EncryptToBase64, formatDateTimeInQuery, formatDateInQuery, generateQRCode, mergeParam, sqlCase } from "../../../utils.js";
import validateFields from "../../../validationForAdmin.js";
import moment from "moment";
import db from "../../../config/indiadb.js"
import client from '../../../server.js';

import { tryCatchErrorHandler } from "../../../middleware/errorHandler.js";

export const addCycle = asyncHandler(async(req,resp) => {
    const {
        cycle_id, cycle_brand, station_id, cycle_type, country_id, used_for, base_price, qr_image, qr_code,userId, city_id, cycle_name 
    } = mergeParam(req);
    
    const { isValid, errors } = validateFields  (req.body, { 
        station_id   : ["required"], 
        cycle_brand  : ["required"], 
        cycle_type   : ["required"], 
        used_for     : ["required"], 
        base_price   : ["required"],
        qr_code      : ["required"],
        qr_image     : ["required"],
        cycle_id     :["required"]       
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    if(qr_code == 'undefined'){
        return resp.json({ status: 0, code: 422, message: "qr code can not be blank" });
    } 
    const uploadedFiles = req.files; 
    let cover_image     = '';
    if(req.files && req.files['cover_image']) { 
           
        const files   = req.files;
        cover_image = files ? files['cover_image'][0].filename : '';
    }
    const shop_gallery = uploadedFiles['shop_gallery']?.map(file => file.filename) || [];
    let row_select;
    switch(cycle_type){
        case 'ecycle':
            row_select = 'no_ecyle'
            break;
        case 'cycle':
            row_select = 'no_cycle'
            break;
        default  : return resp.json({status: 0,code:400,message: "Invalid cycle type"});
    }
    const conn = await db.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.execute(`
        SELECT 
            (SELECT COUNT(id) FROM cycle_list WHERE cycle_type=? AND station_id = ? ) AS cycle_count,
            (SELECT ${row_select} FROM mobility_station_list WHERE station_id = ? ) AS cycle_limit`,
        [cycle_type, station_id, station_id]
    );
    const { cycle_count, cycle_limit } = rows[0];

    if (Number(cycle_count) >= Number(cycle_limit)) {
        return resp.json({ 
            status : 0, code : 400, message : "Cannot add more cycles. Station limit reached!"
        });
    }
    try { 
        const [check_cycle] = await conn.execute(`
            SELECT id 
            FROM cycle_list 
            where qrcode = ? OR cycle_id = ? `, [ qr_code, cycle_id ] 
        );
        if( check_cycle.length > 0 ) {
            return resp.json({ status: 0, code:400, message: "This Cycle ID or QR Code already exists." });
        }
        const [insert] = await conn.execute(`
            INSERT INTO cycle_list (cycle_id, station_id, brand, cycle_type, used_for, created_by, qr_image, qrcode, cover_image, country_id,city_id,cycle_name) 
            VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )`,
            [ cycle_id, station_id, cycle_brand, cycle_type, used_for, userId, qr_image, qr_code, cover_image, country_id, city_id, cycle_name ]
        );        
        const [existingPrice] = await conn.execute(`SELECT id FROM cycle_pricing WHERE station_id = ? AND type_of_cycle = ? LIMIT 1`,[station_id, cycle_type]);
    
        if (existingPrice.length === 0) {
            const [insert_cycle_price] = await conn.execute( `INSERT INTO cycle_pricing (station_id, type_of_cycle, base_price, created_by) VALUES (?, ?, ?, ?)`,
            [station_id,  cycle_type, base_price, userId] );
            if(insert_cycle_price.affectedRows===0){  await conn.rollback(); return resp.json({status:0, message: "Failed to add  Cycle! Please try again after some time."});    }
        } else {
           const [updated_cycle_price] = await conn.execute(`UPDATE cycle_pricing set base_price=? where station_id=? and type_of_cycle = ? `, [ base_price, station_id, cycle_type ] );
        
            if(updated_cycle_price.affectedRows === 0){  
                await conn.rollback(); 
                return resp.json({status:0, message: "Failed to add  Cycle! Please try again after some time."});
            }
        }
       if(shop_gallery.length > 0){
            const values       = shop_gallery.map(filename => [station_id,cycle_id,cycle_type, filename]);
            const placeholders = values.map(() => '(?,?,?,?)').join(', ');
            await conn.execute(`INSERT INTO cycle_gallery (station_id,cycle_id,cycle_type, image) VALUES ${placeholders}`, values.flat());
        }          
        await conn.commit();
        return resp.json({
            status:1,
            code :200,
            message:"New Mobility Cycle added successfully!"
        })
    } catch(err) {
        await conn.rollback();
        console.error("Transaction failed:", err);
        return resp.status(500).json({ status: 0, message: "Internal server error." });
    } finally { 
        conn.release();
    }
})

export const editCycle = asyncHandler( async ( req, resp ) => { 
    const { 
        cycle_brand, station_id, cycle_type, used_for, base_price, userId, cycle_name, cycle_id, price_id
    } = req.body;
    
    const { isValid, errors } = validateFields  (req.body, { 
        station_id  : ["required"], 
        cycle_brand : ["required"], 
        cycle_type  : ["required"], 
        used_for    : ["required"], 
        base_price  : ["required"],        
    });     
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const uploadedFiles = req.files;     
    let cover_image     = '';
    
    if(req.files && req.files['cover_image']) { 
           
        const files = req.files;
        cover_image = files ? files['cover_image'][0].filename : '';
    }
    const cycle_gallery = uploadedFiles['shop_gallery']?.map(file => file.filename) || [];
    const conn = await db.getConnection();
    try { 
        await conn.beginTransaction();
        
        const [cycle_list] = await conn.execute(`SELECT * FROM cycle_list where cycle_id=? limit 1`, [cycle_id]);
        if (cycle_list.length === 0) throw new Error("Cycle not found ");

        const [cycle_backup] = await conn.execute(`
            INSERT INTO db_logs (table_name, action_type, user_type, created_by, changed_data,ref_id) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            ["cycle_list" , "UPDATE", "admin", userId, JSON.stringify(cycle_list[0]), cycle_id ]
        );
        if (cycle_backup.affectedRows === 0) throw new Error(" log for cycle_list insert failed!");

        const [price_data] = await conn.execute(`
            SELECT 
                station_id, type_of_cycle, base_price, base_duration, post_price, min_price, created_by,created_at, updated_at
            FROM cycle_pricing 
            WHERE id = ? limit 1 `, [ price_id ] 
        );
        if (price_data.length === 0) throw new Error("cycle pricing not found ");
       
        const price_backup = await conn.execute(`
            INSERT INTO db_logs (table_name, action_type, user_type, created_by, changed_data,ref_id) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            ["cycle_pricing", "UPDATE", "admin", userId, JSON.stringify(price_data), cycle_id ]
        );
        if (price_backup.affectedRows === 0) throw new Error("Log for cycle_pricing insert failed!");
        
        let updates_params = {
            station_id, brand : cycle_brand, cycle_type, used_for, created_by : userId, cycle_name
        }
        if(station_id !== cycle_list[0].station_id ) updates_params.lock_number = ''
        if(cover_image) updates_params.cover_image = cover_image

        await updateRecord( "cycle_list", updates_params, ['cycle_id'], [cycle_id], conn );
        
        const [[check_pricing]] = await conn.execute(`
            SELECT id 
            from cycle_pricing 
            where station_id = ? and type_of_cycle = ? `, [ station_id, cycle_type ] 
        );
        if( check_pricing ) { 
            await conn.execute(`UPDATE cycle_pricing set base_price=? where station_id=? and type_of_cycle=? `,[base_price,station_id,cycle_type]);
        } else {
           await conn.execute(`INSERT INTO cycle_pricing(base_price,station_id,type_of_cycle)  values(?,?,?) `,[base_price,station_id,cycle_type]);
        }
        if( cycle_gallery.length > 0 ) { 
            const values       = cycle_gallery.map(filename => [station_id,cycle_id,cycle_type, filename]);
            const placeholders = values.map(() => '(?,?,?,?)').join(', ');
            await conn.execute(`INSERT INTO cycle_gallery (station_id,cycle_id,cycle_type, image) VALUES ${placeholders}`, values.flat());
        }
        await conn.commit();
        return resp.json({ status:1, code :200, message:" Cycle Details updated  successfully!"})
    
    } catch( err ) { 
        await conn.rollback();
        console.error("Transaction failed:", err);
        return resp.status(500).json({ status: 0, message: "Internal server error." });
    } finally {
        conn.release();
    }
})

export const deletefromTable=  asyncHandler(async(req,resp)=>{
    try{
        const{id, tb}  = req.body();
        const delelted = db.execute('DELETE FROM  cycle_gallery where id=?',[id]);
        if(!delelted) resp.json({ status:0, code:400, message:"Image was not deleted!"});

        return resp.json({ status:0, code:422, message:"image deleted successfully"});
    
    } catch(error) {
        return resp.json({ status:0, code:422, message:error});
    }
})

export const StationcycleList = asyncHandler(async (req, resp) => {
    const { station_id, page_no = 1, search_text = '', cycle_type, rowSelected } = req.body; 

    const params = {
        tableName: 'cycle_list cl',
        columns: `
            EXISTS (select 1 from cycle_booking cb where cb.cycle_id=cl.cycle_id and status='ON' ) as     on_going_cycle, cl.station_id, cl.lock_number, cl.cycle_device_id, cl.brand, cl.cycle_id, 
           CASE 
                WHEN cl.cycle_type = 'ecycle' THEN 'E-cycle'
                WHEN cl.cycle_type = 'cycle' THEN 'Cycle'
                ELSE cl.cycle_type
            END AS cycle_type , cl.price, msl.station_name,
           ( SELECT cp.base_price FROM cycle_pricing cp WHERE cp.type_of_cycle = cl.cycle_type AND cp.station_id = cl.station_id LIMIT 1) AS base_price, cl.device_status`,
        joinTable     : "mobility_station_list msl",
        joinCondition : "msl.station_id=cl.station_id",
        sortColumn    : 'cl.id',
        sortOrder     : 'DESC',
        page_no,
        limit            : rowSelected || 10,
        liveSearchFields : ['cl.brand', 'msl.station_name','cl.cycle_id','cl.cycle_name'],
        liveSearchTexts  : [search_text, search_text,search_text,search_text],
        whereField       : ['cl.station_id'],
        whereValue       : [station_id],
        whereOperator    : ['=']
    };
    if (cycle_type ){
        params.whereField.push('cl.cycle_type');
        params.whereValue.push(cycle_type);
        params.whereOperator.push('=');
    } 
    const result = await getPaginatedData(params);
    const updatedData = result.data.map(item => ({
        ...item,
        base_price: item.base_price !== null ? `${item.base_price} INR` : null
    }));
    return resp.json({
        status     : 1,
        code       : 200,
        message    : ["cycle List fetched successfully!"],
        data       : updatedData,
        total_page : result.totalPage,
        total      : result.total,
        currency   : "INR",
        base_url   : `${process.env.DIR_UPLOADS}cycle-station-images/`
    });
});

export const cycleList = asyncHandler(async (req, resp) => {
    
    const { page_no = 1, start_date ='', end_date ='', search_text ='', cycle_type, rowSelected } = req.body; 
     
    const params = {
        tableName: 'cycle_list cl',
        columns: `
            EXISTS (select 1 from cycle_booking cb where cb.cycle_id=cl.cycle_id and status='ON' ) as on_going_cycle, cl.station_id,cl.lock_number, cl.cycle_device_id, cl.brand, cl.cycle_id, 
            CASE 
                WHEN cl.cycle_type = 'ecycle' THEN 'E-cycle'
                WHEN cl.cycle_type = 'cycle' THEN 'Cycle'
                ELSE cl.cycle_type
            END AS cycle_type , cl.price, msl.station_name,
            ( SELECT cp.base_price  FROM cycle_pricing cp WHERE cp.type_of_cycle = cl.cycle_type AND cp.station_id = cl.station_id LIMIT 1) AS base_price, cl.device_status`,
        joinTable     : "mobility_station_list msl",
        joinCondition : "msl.station_id = cl.station_id",
        sortColumn    : 'cl.id',
        sortOrder     : 'DESC',
        page_no,
        limit            : rowSelected || 10,
        liveSearchFields : [ 'cl.brand', 'msl.station_name', 'cl.cycle_id', 'cl.cycle_name' ],
        liveSearchTexts  : [search_text, search_text, search_text, search_text],
        whereField       : [],
        whereValue       : [],
        whereOperator    : []
    }; 
    if (cycle_type ){
        params.whereField.push('cl.cycle_type');
        params.whereValue.push(cycle_type);
        params.whereOperator.push('=');
    }
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

        params.whereField = ['created_at', 'created_at'];
        params.whereValue = [start, end];
        params.whereOperator = ['>=', '<='];
    }
    const result = await getPaginatedData(params);
    const updatedData = result.data.map(item => ({
        ...item,
        base_price: item.base_price !== null ? `${item.base_price} INR` : null
    }));  
    return resp.json({
        status     : 1,
        code       : 200,
        message    : ["cycle List fetched successfully!"],
        data       : updatedData,
        total_page : result.totalPage,
        total      : result.total,
        currency   : "INR",
        base_url   : `${process.env.DIR_UPLOADS}cycle-station-images/`
    });
});

export const cycleDelete = asyncHandler(async(req,resp)=>{
    const { cycle_id, userId } = req.body;
    
    const [cycleRows] = await db.execute("SELECT * FROM cycle_list where cycle_id=?",[cycle_id]);
    if (cycleRows.length === 0) {
        return resp.json({ status: 0, code: 404, message: "Cycle not found." });
    }
    const cycleData = cycleRows[0];

    await db.execute(`INSERT INTO db_logs (table_name, action_type, user_type, created_by, changed_data) 
    VALUES (?, ?, ?, ?, ?)`, [ "Deleted Cycle", "deleted", "admin", userId, JSON.stringify(cycleData), ] );

    const delte_cycle  = await db.execute(`DELETE FROM cycle_list WHERE cycle_id = ?`, [cycle_id]);
    const deltegallery = await db.execute(`DELETE FROM cycle_gallery WHERE cycle_id = ?`, [cycle_id]);

    if(delte_cycle && deltegallery){
        resp.json({status:1,code:200,message:"This Cycle Deleted Successfully!"});
    }
});

export const qrCode = asyncHandler(async(req,resp)=>{
    const {cycle_id}    = req.body;
    const [check_cycle] = await db.execute(`SELECT id FROM cycle_list where  cycle_id=? `,[cycle_id] );
       
    if(check_cycle.length>0){
        return resp.json({ status: 0, code:400, message: "This Cycle ID or QR Code already exists." });
    }
    const forQr_code = EncryptToBase64(`${cycle_id}`)
    const qr_image   = await generateQRCode (`${forQr_code}`);
    
    return resp.json({ status:1, code:200, message:["success"], data:{qrcode:forQr_code,qr_image} })
});

export const cycledetails = asyncHandler(async (req, resp) => {
    const { cycleId }      = req.body;
     
    const { isValid, errors } = validateFields(req.body, { cycleId: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
    const cycle = await queryDB (`
        SELECT 
            cl.battery_health, cp.id as price_id, ROUND(cp.base_price) as base_price, msl.station_name,
            cl.used_for, cl.station_id, cl.qr_image, cl.cycle_id, cl.brand, cl.cover_image, cl.cycle_name,
            ${sqlCase('cl.cycle_type', {ecycle: "E-cycle", cycle: "Cycle" },'cycle_type' )}
        FROM cycle_list cl
        LEFT JOIN mobility_station_list msl ON msl.station_id = cl.station_id
        LEFT JOIN cycle_pricing cp on cp.type_of_cycle = cl.cycle_type  and cp.station_id = cl.station_id
        WHERE cl.cycle_id = ? limit 1 `, [cycleId]
    ); 
    if (!cycle) return resp.status(404).json({status: 0, code: 404, message: 'Cycle not found.'});
    
    let gallery   = [];
    [gallery] = await db.execute(`
        SELECT id, image
        FROM cycle_gallery 
        WHERE cycle_id = ? 
        ORDER BY id DESC `,  [cycleId]
    );
    const imgName     = gallery.map(row => row.image);
    const imgId       = gallery.map(row => row.id);
   
    let data = {
        cycle, imgName, imgId,
        base_url : `${process.env.DIR_UPLOADS}cycle-station-images/`    
    };
    return resp.json({
        status  : 1,
        code    : 200,
        message : ["Cycle Details fetched successfully!"],
        data    : data,
    });
});

export const cycleBookingList = async (req, resp) => {
    try {
         
        const { page_no,  status, start_date, end_date, search_text = '', scheduleFilters, areaSelected, rowSelected ,city_id,country_id,handover_type} = mergeParam(req);
        
        let query = '';
        let queryParams = [];

        switch (true) {
        case !!country_id && !!city_id:
            query = `
            SELECT cs.name AS city, c.name AS country
            FROM cities cs
            JOIN country c ON c.country_id = ?
            WHERE cs.city_id = ?`;
            queryParams = [country_id, city_id];
            break;

        case !!city_id:
            query = `
            SELECT cs.name AS city, c.name AS country
            FROM cities cs
            JOIN country c ON cs.country_id = c.country_id
            WHERE cs.city_id = ?`;
            queryParams = [city_id];
            break;

        case !!country_id:
            query = `
            SELECT '' AS city, c.name AS country
            FROM country c
            WHERE c.country_id = ?`;
            queryParams = [country_id];
            break;

        default:
            return resp.json({ status: 0, message: "city_id or country_id is required" });
        }
        const CityCountry = await queryDB(query, queryParams);
        const city        = CityCountry?.city || '';
        const country     = CityCountry?.country || '';
           
        const { isValid, errors } = validateFields(req.body, { page_no : ["required"] });
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const params = {
          
            tableName : 'cycle_booking',
            columns   : `lock_number, cycle_id, handover_type, booking_id, cycle_id, rider_id, user_name, status, ${sqlCase('cycle_type',{ecycle: "E-cycle", cycle: "Cycle" } )}, pickup_station AS station_name, 
            ${formatDateTimeInQuery(['created_at'])}, account_type`,
            sortColumn : 'created_at DESC',
            sortOrder  : '',
            page_no,
            limit            : rowSelected || 10,
            liveSearchFields : ['booking_id', 'user_name' ],
            liveSearchTexts  : [search_text, search_text ],
            whereField       : ['status'],
            whereValue       : ['PNR'],
            whereOperator    : ["!="],
            
        };
        if(city) {
            params.whereField.push('city');
            params.whereValue.push(city);
            params.whereOperator.push('=');
        }
        if(country) {
            
            params.whereField.push('country');
            params.whereValue.push(country);
            params.whereOperator.push('=');
        }

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
        if (scheduleFilters.start_date && scheduleFilters.end_date) {
            
            const schStart = moment(scheduleFilters.start_date).format("YYYY-MM-DD");
            const schEnd = moment(scheduleFilters.end_date, "YYYY-MM-DD").format("YYYY-MM-DD");
            
            // params.whereField.push('slot_date', 'slot_date');
            params.whereValue.push(schStart, schEnd);
            params.whereOperator.push('>=', '<=');
        }
        if(status) {
            params.whereField.push('status');
            params.whereValue.push(status);
            params.whereOperator.push('=');
        }

         
        if(handover_type) {
            params.whereField.push('handover_type');
            params.whereValue.push(handover_type);
            params.whereOperator.push('=');
        }
        // console.log("params",params)
        const result = await getPaginatedData(params);

        return resp.json({
            status     : 1,
            code       : 200,
            message    : ["cycle  Booking List fetched successfully!"],
            data       : result.data,
            total_page : result.totalPage,
            total      : result.total,
        });
    } catch (error) {
        console.error('Error fetching cycle booking list:', error);
        return resp.json({ status: 0, message: 'Error fetching cycle booking lists' });
    }
};

export const cycleBookinghistory = async (req, resp) => {
    try {
         
        const { 
            page_no, riderId, status,search_text = '',start_date,end_date, scheduleFilters, rowSelected ,city_id,country_id
        } = mergeParam(req);

        const { isValid, errors } = validateFields(req.body, { page_no : ["required"] });
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
        
        const rider_id  = riderId;
        let query       = '';
        let queryParams = [];

        switch (true) {
        case !!country_id && !!city_id:
            query = `
            SELECT cs.name AS city, c.name AS country
            FROM cities cs
            JOIN country c ON c.country_id = ?
            WHERE cs.city_id = ?`;
            queryParams = [country_id, city_id];
            break;

        case !!city_id:
            query = `
            SELECT cs.name AS city, c.name AS country
            FROM cities cs
            JOIN country c ON cs.country_id = c.country_id
            WHERE cs.city_id = ?`;
            queryParams = [city_id];
            break;

        case !!country_id:
            query = `
            SELECT '' AS city, c.name AS country
            FROM country c
            WHERE c.country_id = ?`;
            queryParams = [country_id];
            break;

        default:
            return resp.json({ status: 0, message: "city_id or country_id is required" });
        }
        const CityCountry = await queryDB(query, queryParams);

        const city    = CityCountry?.city || '';
        const country = CityCountry?.country || '';
        
        const params = {
          
            tableName : 'cycle_booking',
            columns   : `booking_id, rider_id, user_name as rider_name, status, ${sqlCase('cycle_type',{ecycle: "E-cycle", cycle: "Cycle" } )}, 
                ${formatDateTimeInQuery(['created_at'])},pickup_station,dropoff_station,account_type`,
            sortColumn : 'created_at DESC',
            sortOrder  : '',
            page_no,
            limit            : rowSelected || 10,
            liveSearchFields : ['booking_id', 'user_name' ],
            liveSearchTexts  : [search_text, search_text ],
            whereField       : ['status'],
            whereValue       : ['CMP'],
            whereOperator    : ["="]
        };
       
        if(rider_id) {
           
            params.whereField.push('rider_id');
            params.whereValue.push(rider_id);
            params.whereOperator.push('=');
        }
        if(city) {
           
            params.whereField.push('city');
            params.whereValue.push(city);
            params.whereOperator.push('=');
        }
        if(country) {
            
            params.whereField.push('country');
            params.whereValue.push(country);
            params.whereOperator.push('=');
        }

        if(status) {
            params.whereField.push('status');
            params.whereValue.push(status);
            params.whereOperator.push('=');
        }
        const cycle_booking_history = await getPaginatedData(params);
      
        return resp.json({
            status     : 1,
            code       : 200,
            message    : ["cycle  Booking List fetched successfully!"],
            data       :  cycle_booking_history.data,
            total_page :  cycle_booking_history.totalPage,
            total      :  cycle_booking_history.total,
        });
    } catch (error) {
        console.log('Error fetching cycle booking list:', error);
        return resp.json({ status: 0, message: 'Error fetching cycle booking lists' });
    }
};

export const FaildcycleBookingList = async (req, resp) => {
    try {
        const { page_no = 1, search_text = ''} = mergeParam(req);

        const params = {
            tableName : 'cycle_booking',
            columns   : `booking_id, cycle_id, user_name, contact_no, pickup_station, city, 
                ${formatDateTimeInQuery(['created_at'])} `,
            sortColumn : 'created_at DESC',
            sortOrder  : '',
            page_no,
            limit            : 10,
            liveSearchFields : ['booking_id', 'user_name' ],
            liveSearchTexts  : [search_text, search_text ],
            whereField       : ['status'],
            whereValue       : ['PNR'],
            whereOperator    : ["="]
        };
        const result = await getPaginatedData(params);
        return resp.json({
            status     : 1,
            code       : 200,
            message    : ["failed booking List fetched successfully!"],
            data       : result.data,
            total_page : result.totalPage,
            total      : result.total,
        });
    } catch (error) {
        console.error('Error fetching failed booking  list:', error);
        return resp.json({ status: 0, message: 'Error fetching failed booking list' });
    }
};

export const cyclePrice = async (req, resp) => {
    const { station_id, cycle_type } = req.body;
    const cycle = await queryDB(
        "SELECT base_price FROM cycle_pricing WHERE station_id=? AND type_of_cycle=? LIMIT 1",
        [station_id, cycle_type]
    );
    const basePrice = cycle?.base_price ?? 0;

    return resp.json({
        status: 1,
        code: 1,
        base_price: basePrice,
        Message: ["cycle price fetch successfully"],
    });
};

export const cycleInvoiceList = async (req, resp) => {
    try {
         
        const { page_no = 1, start_date = null, end_date = null, search_text = ''} = mergeParam(req);
        
        const params = {
          
            tableName : 'cycle_booking',
            columns   : `booking_id, user_name, price, ${formatDateTimeInQuery(['created_at'])}, contact_no`,
            sortColumn : 'created_at DESC',
            sortOrder  : '',
            page_no,
            limit            : 10,
            liveSearchFields : ['booking_id', 'user_name' ],
            liveSearchTexts  : [search_text, search_text ],
            whereField       : ['status'],
            whereValue       : ['CMP'],
            whereOperator    : ["="],
        };
        if (start_date ){
            const startDate = moment(start_date, "YYYY-MM-DD", "Asia/Kolkata")
                .startOf("day").subtract(5.5, 'hours'); 
                
            params.whereField.push('created_at' );
            params.whereValue.push( startDate.format("YYYY-MM-DD HH:mm:ss") );
            params.whereOperator.push('>=');
        }
        if (end_date ) {
            const endDate = moment(end_date, "YYYY-MM-DD", "Asia/Kolkata")
                .endOf("day").subtract(5.5, 'hours');
            
            params.whereField.push('created_at' );
            params.whereValue.push( endDate.format("YYYY-MM-DD HH:mm:ss") );
            params.whereOperator.push('<=');
        } 
        const result = await getPaginatedData(params);

        return resp.json({
            status     : 1,
            code       : 200,
            message    : ["cycle Invoice List fetched successfully!"],
            data       : result.data,
            total_page : result.totalPage,
            total      : result.total,
        });
    } catch (error) {
        console.error('Error fetching cycle invoice list:', error);
        return resp.json({ status: 0, message: 'Error fetching cycle invoice lists' });
    }
};

export const cycleInvoiceDetails = asyncHandler(async(req,resp)=>{
    let { booking_id } = req.body;
    if (!booking_id) return resp.status(200).json({ status : 0, code : 400, message :'Booking ID is required'});
    try {
        let cycle_booking = await queryDB(`
            SELECT 
                booking_id, time_taken, price,  ${formatDateInQuery(['updated_at'])}, 
                user_name, user_email, contact_no, time_taken,  
                ${formatFloatInQuery('per_min_cost')} as base_price,
                ${formatFloatInQuery('post_price')} as post_price,
                ${formatFloatInQuery('base_duration')} as base_duration, 
                ${formatFloatInQuery('price')} as price
            FROM cycle_booking
            WHERE booking_id = ?`, [ booking_id ]
        );
        if(!cycle_booking) return resp.json({ status : 0, code : 400, message : ['Booking does not found'] });
        
        const time_taken    = cycle_booking.time_taken;
        const base_duration = Number(cycle_booking.base_duration);
        const base_price    = parseFloat(cycle_booking.base_price);
        const post_price    = parseFloat(cycle_booking.post_price);
        
        let total_cost      = base_price;
        let additionalPrice = 0;
        if( time_taken > base_duration ){  
            const time_after_base_duration = time_taken - base_duration;
            total_cost                     = base_price + (time_after_base_duration * post_price);
            additionalPrice                = time_after_base_duration * post_price;
        }
        cycle_booking.additionalPrice = additionalPrice.toFixed(2);
        cycle_booking.taxPrice        = (total_cost.toFixed(2) == cycle_booking.price.toFixed(2) ) ? 0 : (total_cost * 0.18).toFixed(2); 

        cycle_booking.additional_price_text = `${cycle_booking.post_price} per minutes after base period`;
        cycle_booking.tax_text              = (total_cost.toFixed(2) == cycle_booking.price.toFixed(2) ) ? `0%` : `18%`

        return resp.json({ status : 1, message: 'Cycle invoice lists', data : cycle_booking })
    } catch (error) {
        console.log('Error fetching cycle invoice list:', error);
        return resp.json({ status: 0, message: 'Error fetching cycle invoice lists' });
    }
});

export const IssuecycleBookingList = async (req, resp) => {
    try {
        const { page_no = 1, search_text = ''} = mergeParam(req);

        const params = {
            tableName : 'cycle_booking_issue',
            columns   : `booking_id, user_name, contact_no, pickup_station, status, issue_text, 
                ${formatDateTimeInQuery(['created_at'])} `,
            sortColumn : 'created_at DESC',
            sortOrder  : '',
            page_no,
            limit            : 10,
            liveSearchFields : ['booking_id', 'user_name' ],
            liveSearchTexts  : [search_text, search_text ],
            whereField       : [],
            whereValue       : [],
            whereOperator    : []
        };
        const result = await getPaginatedData(params);
        return resp.json({
            status     : 1,
            code       : 200,
            message    : ["Issue booking List fetched successfully!"],
            data       : result.data,
            total_page : result.totalPage,
            total      : result.total,
        });
    } catch (error) {
        console.log('Error fetching failed booking  list:', error);
        return resp.json({ status: 0, message: 'Error fetching failed booking list' });
    }
};

export const IssuecycleBookingDetails = asyncHandler(async(req,resp)=>{
    let { booking_id } = req.body;
    if (!booking_id) return resp.status(200).json({ status : 0, code : 400, message : ['booking ID is required'] });
     
    // issue_text
    // lock_number,
    let cycle_booking = await queryDB(`
        SELECT 
            ${formatDateInQuery(['cbi.created_at'])}, cbi.booking_id, cbi.user_name, cbi.contact_no, cbi.city,
            cb.pickup_station, cb.dropoff_station, cb.cycle_type, cb.cycle_id, cb.price, cbi.status,
            cb.handover_type, cb.time_taken, cb.hand_over_station as handover_station, cb.country_code, 
            cbi.issue_text,
            DATE_FORMAT(cb.pick_time, '%h:%i %p') AS pick_time, 
            DATE_FORMAT(cb.drop_time, '%h:%i %p') AS drop_time
        FROM cycle_booking_issue cbi
        LEFT JOIN cycle_booking cb ON cb.booking_id = cbi.booking_id
        WHERE cbi.booking_id = ?`, [ booking_id ]
    );
    if(!cycle_booking) return resp.json({ status : 0, code : 400, message : ['Booking does not found'] });
    
    const data = { cycle_booking, currency : "INR" } 
    return resp.json({ status : 1, code : 200, data })
});


export const IssuecycleBookingComments = async (req, resp) => {
    const { booking_id } = req.body;
    if (!booking_id) return resp.json({ status : 0, code : 400, message :'Booking ID is required'});

    try {
        const { page_no = 1 } = mergeParam(req);

        const params = {
            tableName : 'cycle_booking_issue_comments',
            columns   : `booking_id, issue_text, ${formatDateTimeInQuery(['created_at'])} `,
            sortColumn : 'created_at DESC',
            sortOrder  : '',
            page_no,
            limit            : 10,
            liveSearchFields : [],
            liveSearchTexts  : [],
            whereField       : ["booking_id"],
            whereValue       : [booking_id],
            whereOperator    : ["="]
        };
        const result = await getPaginatedData(params);
        return resp.json({
            status     : 1,
            code       : 200,
            message    : ["Issue comments List fetched successfully!"],
            data       : result.data,
            total_page : result.totalPage,
            total      : result.total,
        });
    } catch (error) {
        console.log('Error fetching failed booking  list:', error);
        return resp.json({ status: 0, message: 'Error fetching failed booking list' });
    }
};


export const addBookingComment = async(req,resp) => {
    const { booking_id, comment } = mergeParam(req);
    
    const { isValid, errors } = validateFields (req.body, { 
        booking_id : ["required"], 
        comment    : ["required"]
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
    try { 
        const cycleBooking = await queryDB(`
            SELECT rider_id, status as issue_status, pickup_station 
            FROM cycle_booking_issue
            WHERE booking_id = ? AND status != 3`, [ booking_id ]
        );
        if(!cycleBooking) return resp.json({ status : 0, code : 400, message : ['Comments cannot be added for this booking ID, as the issue appears to have been resolved.'] });

        const { rider_id, pickup_station, issue_status } = cycleBooking

        const insert  = await insertRecord('cycle_booking_issue_comments', [
            'booking_id', 'rider_id', 'pickup_station', 'issue_text', 'status'
        ], [
            booking_id, rider_id, pickup_station, comment, issue_status
        ]);
        if(insert.affectedRows == 0) return resp.json({ status:0, message: "Oops! There is something went wrong! Please Try Again."});
                 
        return resp.json({
            status:1,
            code :200,
            message:"New comment added successfully!"
        })
    } catch(err) {
        console.log("Transaction failed:", err);
        tryCatchErrorHandler('add comment on' + booking_id, err, []);
        return resp.json({ status: 0, message: "Oops! There is something went wrong! Please Try Again." });
    }
}


export const IssueBookingUpdate = async(req,resp) => {
    const { booking_id, status } = mergeParam(req);
    
    const { isValid, errors } = validateFields (req.body, { 
        booking_id : ["required"], 
        status     : ["required"]
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
    try { 
        const cycleBooking = await queryDB(`
            SELECT rider_id, status as issue_status, pickup_station 
            FROM cycle_booking_issue
            WHERE booking_id = ? AND status != 3`, [ booking_id ]
        );
        if(!cycleBooking) return resp.json({ status : 0, code : 400, message : ['Comments cannot be change status of this booking ID, as the issue appears to have been resolved.'] });

        const { rider_id, pickup_station, issue_status } = cycleBooking

        await updateRecord( "cycle_booking_issue", { status : status }, ['booking_id'], [booking_id] );

        // const insert  = await insertRecord('cycle_booking_issue_comments', [
        //     'booking_id', 'rider_id', 'pickup_station', 'issue_text', 'status'
        // ], [
        //     booking_id, rider_id, pickup_station, comment, issue_status
        // ]);
        // if(insert.affectedRows == 0) return resp.json({ status:0, message: "Oops! There is something went wrong! Please Try Again."});
                 
        return resp.json({
            status  : 1,
            code    : 200,
            message : "Status updated successfully!"
        })
    } catch(err) {
        console.log("Transaction failed:", err);
        tryCatchErrorHandler('add comment on' + booking_id, err, []);
        return resp.json({ status: 0, message: "Oops! There is something went wrong! Please Try Again." });
    }
}

export const cycleOnOff = asyncHandler(async (req, resp) => {
    const { cycle_id, device_status = 0 } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), { 
        cycle_id : ["required"],
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
    const cycleData = await queryDB(`
        SELECT 
            station_id, 
            (SELECT gateway_id from cycle_locker lc WHERE lc.station_id = cl.station_id ) as gateway_id
        FROM cycle_list as cl
        WHERE cl.cycle_id = ? `, [ cycle_id ] 
    );
    if(!cycleData) return resp.json({status : 0, code : 201, message : ['The Cycle ID is incorrect!']});
                
    await updateRecord('cycle_list', { device_status }, [ 'cycle_id' ], [ cycle_id ] );  

    const payload = (device_status == 1 ) ? `ON,${cycle_id}` : `OFF,${cycle_id}`;
    client.publish(`/supro/GW/${cycleData.gateway_id}/UP`, payload, { qos: 0, retain: false });
         
    const msgT = (device_status == 1 ) ? `unlocked` : `locked`;
    return resp.json({ status: 1, code: 200, message: `Cycle ${msgT} successfully!` });
});

export const lockerOpen = asyncHandler(async (req, resp) => {
    const { station_id, lock_number } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), { 
        station_id  : ["required"],
        lock_number : ["required"],
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
    const locker_data = await queryDB(`
        SELECT solenoid_id
        FROM cycle_locker      
        WHERE station_id = ? `, [ station_id ]
    );
    if(!locker_data) return resp.json({status : 0, code : 201, message : ['The Lock no. is incorrect!']});
            
    client.publish(`/supro/plusxm/slock/${locker_data.solenoid_id}/${lock_number}`, "ON", { qos: 0, retain: false });
         
    return resp.json({ status: 1, code: 200, message: `Locker opened successfully!` });
});