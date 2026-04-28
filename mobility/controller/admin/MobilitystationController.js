
import { asyncHandler, formatAllTimeTimings, formatOpenAndCloseTimings, getOpenAndCloseTimings, deleteFile, convertTo24HourFormat } from "../../../utils.js";
import validateFields from "../../../validation.js";
import { getPaginatedData, insertRecord, queryDB, updateRecord } from "../../../dbUtils.js";
import dotenv from 'dotenv';
import db from "../../../config/indiadb.js"
// import { schedule } from "node-cron";
dotenv.config();

import { tryCatchErrorHandler } from "../../../middleware/errorHandler.js";
 
export const AddMobilityStation = asyncHandler(async (req, resp) => {
    try {
        const {
            userId, station_name, address, latitude, longitude, always_open = 0, no_ecyle, no_cycle, 
            price_type = '', available_for, country_id, station_city_id, university = '', state_id, 
            building_name, operator_name, operator_contact, operator_email, 
            service_start_time, service_end_time
        } = req.body;
    
        const { isValid, errors } = validateFields(req.body, { 
            station_name       : ["required"],  
            address            : ["required"], 
            latitude           : ["required"], 
            longitude          : ["required"], 
            available_for      : ["required"],
            no_ecyle           : ["required"],
            no_cycle           : ["required"],
            always_open        : ["required"],
            state_id           : ["required"],
            station_id         : ["required"],
            operator_name      : ["required"],
            operator_contact   : ["required"],
            operator_email     : ["required"],
            service_start_time : ["required"],
            service_end_time   : ["required"],
        });
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const uploadedFiles = req.files;
        let stationImg      = '';
        
        if(req.files && req.files['cover_image']) {
            stationImg = uploadedFiles ? uploadedFiles['cover_image'][0].filename : '';
        }
        const shop_gallery = uploadedFiles['station_gallery']?.map(file => file.filename) || [];

        const serviceStartTime = convertTo24HourFormat(service_start_time);
        const serviceEndTime   = convertTo24HourFormat(service_end_time);

        const insert = await insertRecord('mobility_station_list', [
            'station_id','station_name', 'price', 'address', 'latitude', 'longitude', 'station_image', 'always_open', 'created_by', 'available_for','country_id','city_id','university','no_ecyle','no_cycle','state_id','building_name', 'operator_name','operator_contact', 'operator_email',
            'open_time', 'close_time'
        ], [
            'station_id', station_name, price_type, address, latitude, longitude, stationImg, always_open, userId, available_for, country_id, station_city_id, university, no_ecyle, no_cycle, state_id,building_name, operator_name, operator_contact, operator_email, 
            serviceStartTime, serviceEndTime
        ]);
        if(insert.affectedRows == 0) return resp.json({ status : 0, message : "Failed to add public charger! Please try again after some time."});

        const stationId = 'S' + String(insert.insertId).padStart(4, '0');

        await db.execute(`INSERT INTO cycle_pricing (station_id, type_of_cycle) 
            VALUES (?, ?), (?, ?)`, [stationId, 'cycle', stationId, 'ecycle']
        );
        await updateRecord('mobility_station_list',{ station_id : stationId },['id'],[insert.insertId]);

        if(shop_gallery.length > 0){
            const values       = shop_gallery.map(filename => [stationId, filename]);
            const placeholders = values.map(() => '(?, ?)').join(', ');

            await db.execute(`INSERT INTO mobility_station_gallery (station_id, image_name) VALUES ${placeholders}`, values.flat());
        } 
        await insertRecord('cycle_locker',
            [ 'solenoid_id', 'locker_id', 'station_id', 'gateway_id','created_by'],
            [ '', '', stationId, '', userId ] 
        );
        return resp.json({ status  : 1, message : "Mobility station added successfully." });
       
    } catch (error) {
        console.log('Something went wrong:', error);
        tryCatchErrorHandler(req.originalUrl, error, resp );
    }
});

export const editMobilityStation = asyncHandler(async (req, resp) => {
    try {
        const {
            userId, station_id, station_name, building_name, address, latitude, longitude, always_open = 0,
            no_ecyle, no_cycle, price_type = '', available_for, country_id, station_city_id, university = '',state_id, operator_name, operator_contact, operator_email, 
            service_start_time = null, service_end_time = null
        } = req.body;
        const { isValid, errors } = validateFields(req.body, { 
            station_name       : ["required"],  
            address            : ["required"], 
            latitude           : ["required"], 
            longitude          : ["required"], 
            available_for      : ["required"],
            no_ecyle           : ["required"],
            no_cycle           : ["required"],
            always_open        : ["required"],
            state_id           : ["required"],
            service_start_time : ["required"],
            service_end_time   : ["required"],
        });
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const stationData = await queryDB(`
            SELECT station_image
            FROM mobility_station_list
            WHERE station_id = ? `, [station_id]
        ); 
        if(!stationData) return resp.json({status: 0, code: 404, message: 'Station not found on given station id.'});

        const serviceStartTime = convertTo24HourFormat(service_start_time);
        const serviceEndTime   = convertTo24HourFormat(service_end_time);
        
        const uploadedFiles = req.files;
        let stationImg      = '';
         
        if(req.files && req.files['cover_image']) { 
            stationImg = uploadedFiles ? uploadedFiles['cover_image'][0].filename : '';
        }
        const shop_gallery = uploadedFiles['station_gallery']?.map(file => file.filename) || [];

        const updates = {
            station_name,
            price          : price_type,
            address,
            latitude,
            longitude,
            always_open,
            created_by     :    userId,
            available_for  :    available_for,
            country_id     :    country_id,
            state_id       :    state_id,
            city_id        :    station_city_id,
            no_ecyle       :    no_ecyle,
            no_cycle       :    no_cycle,
            building_name,
            operator_name, 
            operator_contact,
            operator_email,
            open_time  : serviceStartTime,
            close_time : serviceEndTime,
        };
        if(stationImg) updates.station_image = stationImg;
        if(university) updates.university    = university;
    
        const updated_data = updateRecord('mobility_station_list', updates, [ 'station_id' ], [ station_id ] );
        
        if( updated_data.affectedRows == 0 ) return resp.json({ status : 0, message : "Failed to edit mobility staton! Please try again after some time."});
        
        if( shop_gallery.length > 0 ) { 
            const values       = shop_gallery.map(filename => [station_id, filename]);
            const placeholders = values.map(() => '(?, ?)').join(', ');
            await db.execute(`INSERT INTO mobility_station_gallery (station_id, image_name) VALUES ${placeholders}`, values.flat());
        }
        if(stationImg) deleteFile('cycle-station-images', stationData.station_image);
        return resp.json({ status : 1, message : "Mobility station edit successfully." });

    } catch (error) {
        console.log('Something went wrong:', error);
        tryCatchErrorHandler(req.originalUrl, error, resp );
    }
});

export const mobilitystationList = asyncHandler(async (req, resp) => {
    try {
        const { page_no, start_date, end_date, search_text ='', city_id, state_id, rowSelected } = req.body;
       
        const { isValid, errors } = validateFields(req.body, { page_no: ["required"] });
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
         
        const params = {
            tableName : `mobility_station_list msl`,
            columns   : `
                clock.solenoid_id, clock.locker_id, clock.gateway_id, msl.station_id,msl.city_id, msl.station_name, msl.available_for, msl.address,
                (SELECT name from cities ct where msl.city_id = ct.city_id) as city,
                ( select count(id) from cycle_list cl where cl.station_id = msl.station_id and cl.status = 1) as cycle_count `,
            joinTable     : "cycle_locker clock"  ,  
            joinCondition : "clock.station_id=msl.station_id",
            joinType      : "LEFT JOIN",
            sortColumn    : 'msl.id',
            sortOrder     : 'DESC',
            page_no,
            limit           : rowSelected || 10,
           liveSearchFields : [ 'msl.station_name','msl.station_id'],
            liveSearchTexts : [ search_text, search_text ],
             whereField     : [ 'msl.status' ],
            whereValue      : [ '0' ],
            whereOperator   : [ "!=" ]
        };
        if(city_id) {
            params.whereField.push('city_id');
            params.whereValue.push(city_id);
            params.whereOperator.push('=');
        }
        if (state_id){
             params.whereField.push('msl.state_id');
            params.whereValue.push(state_id);
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

            params.whereField = ['msl.created_at', 'msl.created_at'];
            params.whereValue = [start, end];
            params.whereOperator = ['>=', '<='];
        }
        const result = await getPaginatedData(params);

        return resp.json({
            status     : 1,
            code       : 200,
            message    : ["mobility Station List fetched successfully!"],
            data       : result.data,
            total_page : result.totalPage,
            total      : result.total,
            base_url   : `${process.env.DIR_UPLOADS}cycle-station-images/`
        });

    } catch (error) {
        console.log('Error fetching station list:', error);
        return resp.json({ status  : 0, code    : 500, message : 'Error fetching station list' });
    }
});

export const mobilitystationDetails = asyncHandler(async (req, resp) => {
    const { stationId } = req.body;
    const { isValid, errors } = validateFields(req.body, { stationId : ["required"] });
    
    if (!isValid) return resp.json({ status : 0, code : 422, message : errors });
    const station_id = stationId;
    let gallery      = [];
    //  msl.open_days ,msl.open_timing, all_time
    const station = await queryDB(`
        SELECT 
            msl.station_id, msl.operator_name, msl.operator_contact, clock.locker_id, clock.solenoid_id, clock.gateway_id, msl.no_ecyle, msl.no_cycle , msl.building_name ,msl.state_id, msl.city_id , msl.station_name ,msl.address ,msl.price as price_type, msl.latitude, msl.longitude , msl.station_image,msl.always_open,  msl.available_for, msl.university, msl.created_at, st.name as state_name,  ct.name as city_name, (SELECT count(id) from cycle_list cl where cl.station_id = msl.station_id and cycle_type = 'cycle' and status = 1 ) as cycle_count,
            (SELECT count(id) from cycle_list cl where cl.station_id = msl.station_id and cycle_type = 'ecycle' and status = 1 ) as ecycle_count, msl.operator_email, msl.open_time, msl.close_time
        FROM
            mobility_station_list msl
        join states st on msl.state_id = st.state_id
        JOIN cities ct on ct.city_id = msl.city_id
        left join cycle_locker clock on clock.station_id = msl.station_id
        WHERE msl.station_id = ?`, [station_id]
    ); 
    if (!station) return resp.status(404).json({status: 0, code: 404, message: 'Station not found.'});
    
    [gallery] = await db.execute(`
        SELECT id, image_name 
        FROM mobility_station_gallery 
        WHERE station_id = ? 
        ORDER BY id DESC `, [ station_id ] 
    );
    const imgName = gallery.map(row => row.image_name);
    const imgId   = gallery.map(row => row.id);
    
    const data = {
        station,
        base_url : `${process.env.DIR_UPLOADS}cycle-station-images/`,
        imgName,
        imgId,
    }
    const [cycle_list] = await db.execute(`
        SELECT lock_number, cycle_id 
        FROM cycle_list 
        WHERE station_id = ? AND lock_number IS NOT NULL AND lock_number != '' `, [ station_id ]
    );
    data.cycle_list = cycle_list;
    return resp.json({
        status  : 1,
        code    : 200,
        message : ["mobility Station Details fetched successfully!"],
        data,
    });
});

export const mobilityStaionListforselectBox= asyncHandler(async(req,resp)=>{
     
    const [stationList] = await db.execute(`
        SELECT
            msl.city_id, msl.station_id, msl.station_name, msl.no_cycle, msl.no_ecyle,
            IFNULL(cycle_counts.cycle_count, 0) AS added_cycle,
            IFNULL(ecycle_counts.ecycle_count, 0) AS added_ecycle
        FROM mobility_station_list msl
        LEFT JOIN (
            SELECT station_id, COUNT(*) AS cycle_count
            FROM cycle_list
            WHERE cycle_type = 'cycle'
            GROUP BY station_id
        ) AS cycle_counts ON msl.station_id = cycle_counts.station_id
        LEFT JOIN (
            SELECT station_id, COUNT(*) AS ecycle_count
            FROM cycle_list
            WHERE cycle_type = 'ecycle'
            GROUP BY station_id
        ) AS ecycle_counts ON msl.station_id = ecycle_counts.station_id
        ORDER BY msl.station_name ASC `
    );
    return resp.json({
        status: 1,
        code: 200,
        message: ["Filtered stations where cycles are not fully added"],
        data: stationList,
    });
})

export const stationlistforlockAssign= asyncHandler(async(req,resp)=>{
      
    const [stationList] = await db.execute(`
        SELECT station_id, station_name
        FROM mobility_station_list
        ORDER BY station_name ASC `
    );
    return resp.json({
        status  : 1,
        code    : 200,
        message :  ["Filtered stations where cycles are not fully added"],
        data    : stationList,
    });      
});

export const deletemobilityStation = asyncHandler(async (req, resp) => {

    return resp.json({ status: 1, code: 200, message: "Station deleted successfully!" });

    const { station_id, userId } = req.body;

    const [changedData] = await db.execute("SELECT * FROM mobility_station_list where station_id=?",[station_id]);
    const cycle_list    = await db.execute("SELECT * FROM cycle_list where station_id=?",[station_id]);
    const sanitizedCycles = cycle_list.map(cycle => {
        const cleaned = {};
        for (const [key, value] of Object.entries(cycle)) {
            if (Buffer.isBuffer(value)) {
                cleaned[key] = value.toString("utf8"); // or 'base64' if it's image/file data
            } else {
                cleaned[key] = value;
            }
        }
        return cleaned;
    });
    await db.execute( `INSERT INTO db_logs 
        (table_name, action_type, user_type, created_by, changed_data)  VALUES (?, ?, ?, ?, ?)`,
        [ "cycle_list", "deleted cycle in station from admin", "admin", userId, JSON.stringify(sanitizedCycles),]
    );
    const backup = await db.execute(`INSERT INTO db_logs 
        (table_name, action_type, user_type, created_by, changed_data)  VALUES (?, ?, ?, ?, ?)`,
        ['mobility_station_list','deleted station from admin','admin',userId,JSON.stringify(changedData)]
    );   
    if(!backup) return resp.json({status:0, message: "Station data could not be backed up. Please try again."});
    
    await db.execute(`DELETE FROM mobility_station_gallery WHERE station_id = ?`, [station_id]);
    await db.execute(`DELETE FROM mobility_station_list WHERE station_id = ?`, [station_id]);
    await db.execute(`DELETE FROM cycle_locker WHERE station_id = ?`, [station_id]);
    await db.execute(`DELETE FROM locker_qr_image WHERE station_id = ?`, [station_id]);
    await db.execute(`DELETE FROM cycle_list WHERE station_id = ?`, [station_id]);
    return resp.json({ status: 1, code: 200, message: "Station deleted successfully!" });
});
