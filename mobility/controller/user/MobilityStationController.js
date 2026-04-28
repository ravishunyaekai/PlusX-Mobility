import { asyncHandler, getMultipleRoute, getOpenAndCloseTimings, getSingleRoute, mergeParam, normalizeSchedule } from "../../../utils.js";
import validateFields from "../../../validation.js";
import db from "../../../config/indiadb.js";
import { queryDB } from "../../../dbUtils.js";

import { configDotenv } from "dotenv";
configDotenv

export const cycleStationList = asyncHandler(async (req, resp) => {
    
    const {rider_id, latitude, longitude, page_no=1, sort_by="a" } = mergeParam(req);
    
    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id: ["required"], latitude: ["required"], longitude: ["required"] 
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const limit = 10;
    const start = (page_no * limit) - limit;
    
    let countQuery      = `SELECT COUNT(*) AS total FROM mobility_station_list`;
    const [[{ total }]] = await db.execute(countQuery);
    const total_page    = Math.ceil(total / limit) || 1;
    
    let query = `
        SELECT 
            station_id, station_name, station_image, latitude, longitude,station_image,available_for,
            (6367 * ACOS(COS(RADIANS(?)) * COS(RADIANS(latitude)) * COS(RADIANS(longitude) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(latitude))) ) AS distance,
            (SELECT COUNT(id) FROM cycle_list WHERE station_id = mobility_station_list.station_id AND status= '1' and cycle_type = 'ecycle') AS ecycle_count,
            (SELECT COUNT(id) FROM cycle_list WHERE station_id = mobility_station_list.station_id  and status= '1' AND cycle_type = 'cycle') AS cycle_count, always_open, open_time, close_time
        FROM mobility_station_list
    `;
    let queryParams = [latitude, longitude, latitude];
    
    const sortOrder = (sort_by === 'd') ? 'DESC' : 'ASC';
    
    query += ` HAVING distance <= 10`;
    query += ` ORDER BY distance ${sortOrder} LIMIT ${start}, ${limit}`;
    const [stations] = await db.execute(query, queryParams);
    
    const origin       = `${latitude}, ${longitude}`;
    const routeResults = await getMultipleRoute(origin, stations);

    return resp.json({
        message  : ["Cycle Station List fetched successfully!"],
        stations : routeResults,
        base_url : `${process.env.DIR_UPLOADS}cycle-station-images/`,
        total_page,
        status   : 1,
        code     : 200,
    }); 
});

export const cycleStationDetails = asyncHandler(async (req, resp) => {
    
    const {rider_id, station_id, latitude, longitude } = mergeParam(req);

    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id   : ["required"], 
        station_id : ["required"], 
        latitude   : ["required"], 
        longitude  : ["required"]
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    const station = await queryDB(`
        SELECT 
            msl.university , msl.station_id, msl.station_name, msl.station_image, msl.latitude , 
            msl.longitude, msl.price AS price_type, msl.status AS station_status, msl.always_open, 
            msl.open_time, msl.close_time, msl.available_for, msl.address, msl.building_name,
            (SELECT COUNT(*) FROM cycle_list WHERE station_id = msl.station_id AND cycle_type = 'ecycle') AS ecycle_count,
            (SELECT COUNT(*) FROM cycle_list WHERE station_id = msl.station_id AND cycle_type = 'cycle') AS cycle_count,
            cp1.base_price AS ecycle_base_price,
            cp1.base_duration AS ecycle_base_duration,
            cp1.post_price AS ecycle_post_price,

            cp2.base_price AS cycle_base_price,
            cp2.base_duration AS cycle_base_duration,
            cp2.post_price AS cycle_post_price
        FROM 
            mobility_station_list msl
        LEFT JOIN cycle_pricing cp1 
            ON cp1.station_id = msl.station_id AND cp1.type_of_cycle = 'ecycle'

        LEFT JOIN cycle_pricing cp2 
            ON cp2.station_id = msl.station_id AND cp2.type_of_cycle = 'cycle'
        WHERE msl.station_id = ? `, [ station_id ]
    );
    const [area_price] =await db.execute(`
        SELECT 
            MAX(CASE WHEN cap.cycle_type = 'ecycle' THEN cap.base_duration END) AS ecycle_base_duration,
            MAX(CASE WHEN cap.cycle_type = 'ecycle' THEN cap.post_price END)     AS ecycle_post_price,
            MAX(CASE WHEN cap.cycle_type = 'cycle' THEN cap.base_duration END)   AS cycle_base_duration,
            MAX(CASE WHEN cap.cycle_type = 'cycle' THEN cap.post_price END)      AS cycle_post_price
        FROM cycle_area_price cap
        JOIN mobility_station_list msl 
            ON msl.country_id = cap.country_id 
            OR msl.city_id = cap.city_id
        WHERE msl.station_id = ?
        AND cap.status = 1`, [ station_id ]
    );
    if(area_price.length > 0 ) {
        station.ecycle_base_duration = area_price[0].ecycle_base_duration ?? station.ecycle_base_duration;
        station.ecycle_post_price    = area_price[0].ecycle_post_price ?? station.ecycle_post_price
        station.cycle_post_price     = area_price[0].cycle_post_price ??  station.cycle_post_price
        station.cycle_base_duration  = area_price[0].cycle_base_duration ?? station.cycle_base_duration
    }
    const origin       = `${latitude}, ${longitude}`;
    const destination  = `${station.latitude}, ${station.longitude}`;
    
    const distancedata = await getSingleRoute(origin, destination)
    station.distance   =  parseFloat(distancedata.distance);

    // const normalized = normalizeSchedule(station);  open_time, msl.close_time
    station.open_days   = ['Mon - Sun']; //normalized.open_days;
    station.open_timing = [`${station.open_time} - ${station.close_time}`];

    const [gallery] = await db.execute(`
        SELECT image_name 
        FROM mobility_station_gallery 
        WHERE station_id = ? 
        ORDER BY id DESC 
        LIMIT 5`, [station_id]
    );
    const imgName = gallery.map(row => row.image_name);
    let data = {
        station,
        gallery_data : imgName,
        base_url     : `${process.env.DIR_UPLOADS}cycle-station-images/`,
    };
    return resp.json({
        status  : 1,
        code    : 200,
        message : ["Cycle Station Details fetched successfully!"],
        data
    });
});

export const nearByStaion = asyncHandler(async (req, resp) => {
     
    const { rider_id, latitude, longitude} = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id  : ["required"],
        latitude  : ["required"],
        longitude : ["required"],
    });
    if (!isValid) {
        return resp.json({ status: 0, code: 422, message: errors });
    }
    const [stationList] = await db.execute(`
        SELECT 
            msl.station_id, msl.station_name, msl.latitude, msl.longitude, COUNT(cl.id) AS cycle_count,
            (
                6371 * ACOS(
                    COS(RADIANS(?)) * COS(RADIANS(msl.latitude)) * COS(RADIANS(msl.longitude) - RADIANS(?)) +
                    SIN(RADIANS(?)) * SIN(RADIANS(msl.latitude))
                )
            ) AS distance
        FROM 
            mobility_station_list msl   
        LEFT JOIN  cycle_list cl ON cl.station_id = msl.station_id 
        GROUP BY msl.station_name, msl.latitude, msl.longitude
        HAVING  cycle_count > 0 
        ORDER BY distance ASC `, [ latitude, longitude, latitude]
    );
    return resp.json({
        status : 1,
        code   : 200,
        data   : stationList
    });
});

export const nearByStaionDetails = asyncHandler(async (req, resp) => {
    const params = mergeParam(req);
    const { rider_id, latitude, longitude, station_id } = params;
      
    const { isValid, errors } = validateFields(params, {
        rider_id  : ["required"],
        latitude  : ["required"],
        longitude : ["required"],
        station_id   : ['required'],
    });
    if (!isValid) {
        return resp.json({ status: 0, code: 422, message: errors });
    }
    const [station] = await db.execute(`
        SELECT 
            msl.station_name, msl.station_image , msl.latitude, msl.longitude,COUNT(cl.id) AS cycle_count,
            (
                6371 * ACOS(
                    COS(RADIANS(?)) * COS(RADIANS(msl.latitude)) * COS(RADIANS(msl.longitude) - RADIANS(?)) +
                    SIN(RADIANS(?)) * SIN(RADIANS(msl.latitude))
                )
            ) AS distance
        FROM 
            mobility_station_list msl
        LEFT JOIN  cycle_list cl ON cl.station_id = msl.station_id 
        WHERE msl.station_id=? GROUP BY msl.station_name, msl.latitude, msl.longitude
        HAVING cycle_count > 0 ORDER BY distance ASC `, [ latitude, longitude, latitude, station_id ] 
    );
    const data = { 
        station,
        base_url : `${process.env.DIR_UPLOADS}cycle-station-images/`
    }
    return resp.json({ status: 1, code: 200, data });
});

export const nearestChargerList = asyncHandler(async (req, resp) => {
    const {rider_id, latitude, longitude } = mergeParam(req);
        
    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id: ["required"], latitude: ["required"], longitude: ["required"]
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const [chargers] = await db.execute(`
        SELECT 
            station_id, station_name, address, status, station_image, latitude, longitude, description, 
            , price, status, always_open, 
            REPLACE(open_days, "_", ", ") AS open_days, 
            REPLACE(open_timing, "_", ", ") AS open_timing,
            (6367 * ACOS(COS(RADIANS(?)) * COS(RADIANS(latitude)) * COS(RADIANS(longitude) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(latitude))) ) AS distance  
        ,( SELECT COUNT(id) FROM cycle_list where station_id=mobility_station_list.station_id 
            FROM 
            public_charging_station_list 
        ORDER BY 
            distance ASC 
        LIMIT 20
        `,[latitude, longitude ,latitude] 
    );
    const origin       = `${latitude}, ${longitude}`;
    const routeResults = await getMultipleRoute(origin, chargers);
    return resp.json({
        status  : 1 ,
        code    : 200, 
        message : ['Nearest Portable Charger List fetch successfully!'],
        data    : routeResults
    });
});
