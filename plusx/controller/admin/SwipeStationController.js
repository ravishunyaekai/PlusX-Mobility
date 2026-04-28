import db from '../../../config/indiadb.js';
import dotenv from 'dotenv';
import moment from "moment";
import { queryDB, getPaginatedData, insertRecord, updateRecord } from '../../../dbUtils.js';
import validateFields from "../../../validation.js";
import generateUniqueId from 'generate-unique-id';
import { formatDateTimeInQuery, asyncHandler } from '../../../utils.js';
dotenv.config();

export const swipeStationList = async (req, resp) => {
    try {
        const {page_no, search_text = '' } = req.body;
        const { isValid, errors } = validateFields(req.body, {page_no: ["required"]});
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const result = await getPaginatedData({
            tableName        : 'ev_swipe_station',
            columns          : `station_id, station_name, number_of_slot, created_at`,
            sortColumn       : 'id',
            sortOrder        : 'DESC',
            page_no,
            limit            : 10,
            liveSearchFields : ['station_id', 'station_name'],
            liveSearchTexts  : [search_text, search_text],
            whereField       : 'status',
            whereValue       : 1
        });
        return resp.json({
            status     : 1,
            code       : 200,
            message    : ["Station List fetch successfully!"],
            data       : result.data,
            total_page : result.totalPage,
            total      : result.total,
        });
    } catch (error) {
        console.error('Error fetching device list:', error);
        resp.status(500).json({ message: 'Error fetching device lists' });
    }
};

export const stationDetails = async (req, resp) => {
    try {
        const { station_id, }        = req.body;
        const { isValid, errors } = validateFields( req.body, { station_id : ["required"] } );
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const stationDetails = await queryDB(`
            SELECT 
                station_id, station_name, number_of_slot, created_at, status 
            FROM 
                ev_swipe_station 
            WHERE 
                station_id = ?`, 
            [station_id]
        );
        return resp.json({
            status  : 1,
            code    : 200,
            message : ["Station Details fetched successfully!"],
            data    : stationDetails,
        });
    } catch (error) {
        console.error('Error fetching device details:', error);
        return resp.json({ status: 0, message: 'Error fetching device details' });
    }
};

export const addStation = asyncHandler(async (req, resp) => {
    
    try {
        const { station_name, number_of_slot } = req.body;
        const { isValid, errors } = validateFields( { station_name, number_of_slot }, 
        {
            station_name   : ["required"],
            number_of_slot : ["required"] ,
        });
        if (!isValid) return resp.json({ status : 0, code : 422, message : errors });
        
        const insert = await insertRecord('ev_swipe_station', [
            'station_id', 'station_name', 'number_of_slot', 'status'
        ],[
            `SPS-${generateUniqueId({length:8})}`, station_name, number_of_slot, 1
        ]);
        const lastId     = insert.insertId;
        const station_id = `ST-${String(lastId).padStart(4, "0")}`;
        await updateRecord('ev_swipe_station', {station_id}, ['id'], [lastId]);

        return resp.json({
            code    : 200,
            message : insert.affectedRows > 0 ? ['Swipe Station added successfully!'] : ['Oops! Something went wrong. Please try again.'],
            status : insert.affectedRows > 0 ? 1 : 0
        });
    } catch (error) {
        console.error('Something went wrong:', error);
        resp.json({ message: 'Something went wrong' });
    }
});

export const editStation = asyncHandler(async (req, resp) => {
    try {
        const { station_id, station_name, number_of_slot } = req.body;
       
        const { isValid, errors } = validateFields({ 
            station_id, station_name, number_of_slot 
        }, {
            station_id     : ["required"],
            station_name   : ["required"],
            number_of_slot : ["required"]
        });
        if (!isValid) return resp.json({ status : 0, code : 422, message : errors });

        const [isExist] = await db.execute(`
            SELECT 
                id
            FROM 
                ev_swipe_station
            WHERE 
                station_id = ? 
            LIMIT 1
        `, [station_id]);

        if( isExist.length == 0 ) return resp.json({ status : 0, code : 422, message : 'Bike Id is not registered.'});
       
        const update = await updateRecord('ev_swipe_station', { station_name, number_of_slot }, ['station_id'], [station_id]);

        return resp.json({
            status  : update.affectedRows > 0 ? 1 : 0,
            code    : 200,
            message : update.affectedRows > 0 ? ['Swipe Station updated successfully!'] : ['Oops! Something went wrong. Please try again.'],
        });

    } catch (error) {
        console.error('Something went wrong:', error);
        resp.json({ message: 'Something went wrong' });
    }
});
