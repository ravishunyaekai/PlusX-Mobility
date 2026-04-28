import { asyncHandler, mergeParam } from "../../../utils.js";
import db from "../../../config/indiadb.js";
import validateFields from "../../../validation.js";
import dotenv from 'dotenv';
dotenv.config();

export const cycleList = asyncHandler(async(req,resp)=>{
    const {rider_id} = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id  : ["required"]
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const query = `
        SELECT
            cl.name, cl.cycle_type, cl.image, cl.availability, cl.latitude as cycle_latitude, 
            cl.longitude as cycle_longitude, msl.station_name, msl.latitude as station_latitude,
            msl.longitude as station_longitude
        FROM cycle_list cl
        JOIN mobility_station_list msl ON cl.station_id = msl.station_id
        WHERE cl.status = 1
    `;
    const [cycleList] = await db.execute(query);
    if(!cycleList) return resp.json({ status : 0, code : 422, message : "invalid Cycle List" }) ;
     
    let data = {};
    data.cycle_list = cycleList;
    data.base_url   = `${process.env.DIR_UPLOADS}cycle-images/`
    return resp.json({ status : 1, code : 200, data, message : ["cycle List fetch successfully!"] });
});

// export const cycleDetail



