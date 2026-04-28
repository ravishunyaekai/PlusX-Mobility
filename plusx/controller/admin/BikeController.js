import db from '../../../config/indiadb.js';
import dotenv from 'dotenv';
import moment from "moment";
import { queryDB, getPaginatedData, insertRecord, updateRecord } from '../../../dbUtils.js';
import validateFields from "../../../validation.js";
import generateUniqueId from 'generate-unique-id';
import { formatDateTimeInQuery, asyncHandler } from '../../../utils.js';
dotenv.config();

export const bikeList = async (req, resp) => {
    try {
        const {page_no, search_text = '' } = req.body;
        const { isValid, errors } = validateFields(req.body, {page_no: ["required"]});
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const result = await getPaginatedData({
            tableName        : 'ev_bike',
            columns          : `bike_id, bike_brand_name, bike_number, service_for, regs_date`,
            sortColumn       : 'id',
            sortOrder        : 'DESC',
            page_no,
            limit            : 10,
            liveSearchFields : ['bike_brand_name', 'bike_number'],
            liveSearchTexts  : [search_text, search_text],
            whereField       : 'status',
            whereValue       : 1
        });
        return resp.json({
            status     : 1,
            code       : 200,
            message    : ["Bike List fetch successfully!"],
            data       : result.data,
            total_page : result.totalPage,
            total      : result.total,
        });
    } catch (error) {
        console.error('Error fetching device list:', error);
        resp.status(500).json({ message: 'Error fetching device lists' });
    }
};

export const bikeDetails = async (req, resp) => {
    try {
        const { bike_id, }        = req.body;
        const { isValid, errors } = validateFields( req.body, { bike_id : ["required"] } );
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const bikeDetails = await queryDB(`
            SELECT 
                bike_id, bike_brand_name, bike_number, service_for, regs_date, created_at, status 
            FROM 
                ev_bike 
            WHERE 
                bike_id = ?`, 
            [bike_id]
        );
        const serviceFor = [
            { label : 'Talabat', value : 'Talabat' },
            { label : 'Careem', value : 'Careem' },
            { label : 'Noon', value : 'Noon' }
        ];  
        return resp.json({
            status  : 1,
            code    : 200,
            message : ["Bike Details fetched successfully!"],
            data    : bikeDetails,
            serviceFor
        });
    } catch (error) {
        console.error('Error fetching device details:', error);
        return resp.status(500).json({ status: 0, message: 'Error fetching device details' });
    }
};

export const addBike = asyncHandler(async (req, resp) => {
    
    try {
        const { bikeBrandName, bikeNumber, bikeService} = req.body;
        
        const { isValid, errors } = validateFields({ 
            bikeBrandName, bikeNumber, bikeService
        }, {
            bikeBrandName : ["required"],
            bikeNumber    : ["required"] ,
            bikeService   : ["required"],
            // regsDate   : ["required"]  
        });
        if (!isValid) return resp.json({ status : 0, code : 422, message : errors });

        const [isExist] = await db.execute(`
            SELECT 
                id 
            FROM 
                ev_bike
            Where 
                bike_number = ? 
            LIMIT 1
        `, [bikeNumber]);

        if( isExist.length ) return resp.json({ status : 0, code : 422, message : 'Bike Number is already registered.'});
        
        const registrationDate = moment().format('YYYY-MM-DD');
        const insert = await insertRecord('ev_bike', [
            'bike_id', 'bike_brand_name', 'bike_number', 'service_for', 'regs_date', 'status'
        ],[
            `EVB-${generateUniqueId({length:8})}`, bikeBrandName, bikeNumber, bikeService.value, registrationDate, 1
        ]);
        console.log(insert)
        const lastId  = insert.insertId;
        console.log(lastId)
        const bike_id = `BK-${String(lastId).padStart(4, "0")}`; // "BK-0005"
        await updateRecord('ev_bike', {bike_id}, ['id'], [lastId]);

        return resp.json({
            code    : 200,
            message : insert.affectedRows > 0 ? ['Bike added successfully!'] : ['Oops! Something went wrong. Please try again.'],
            status : insert.affectedRows > 0 ? 1 : 0
        });
    } catch (error) {
        console.error('Something went wrong:', error);
        resp.status(500).json({ message: 'Something went wrong' });
    }
});

export const editBike = asyncHandler(async (req, resp) => {
    try {
        const { bike_id, bikeBrandName, bikeNumber, bikeService } = req.body;
       
        const { isValid, errors } = validateFields({ 
            bike_id, bikeBrandName, bikeNumber, bikeService
        }, {
            bike_id       : ["required"],
            bikeBrandName : ["required"],
            bikeNumber    : ["required"] ,
            bikeService   : ["required"],
            // regsDate   : ["required"]  
        });
        if (!isValid) return resp.json({ status : 0, code : 422, message : errors });

        const [isExist] = await db.execute(`
            SELECT 
                (SELECT COUNT(id) FROM ev_bike where bike_number = ? and bike_id != ? ) AS check_bike
            FROM 
                ev_bike
            WHERE 
                bike_id = ? 
            LIMIT 1
        `, [bikeNumber, bike_id, bike_id]);

        if( isExist.length == 0 ) return resp.json({ status : 0, code : 422, message : 'Bike Id is not registered.'});
        if( isExist[0].check_bike ) return resp.json({ status : 0, code : 422, message : 'Bike Number is already registered.'});

        const registrationDate = moment().format('YYYY-MM-DD');
        const updates = { 
            bike_brand_name : bikeBrandName,
            bike_number     : bikeNumber,
            service_for     : bikeService.value, 
            regs_date       : registrationDate
        };
        const update = await updateRecord('ev_bike', updates, ['bike_id'], [bike_id]);

        return resp.json({
            status  : update.affectedRows > 0 ? 1 : 0,
            code    : 200,
            message : update.affectedRows > 0 ? ['Bike updated successfully!'] : ['Oops! Something went wrong. Please try again.'],
        });

    } catch (error) {
        console.error('Something went wrong:', error);
        resp.status(500).json({ message: 'Something went wrong' });
    }
});

export const deleteBike = async (req, resp) => {
    try {
        const { deviceId }        = req.body; 
        const { isValid, errors } = validateFields(req.body, {
            deviceId : ["required"]
        });
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const [del] = await db.execute(`DELETE FROM pod_devices WHERE device_id = ?`, [deviceId]);
        return resp.json({
            code    : 200,
            message : del.affectedRows > 0 ? ['POD Device deleted successfully!'] : ['Oops! Something went wrong. Please try again.'],
            status: del.affectedRows > 0 ? 1 : 0
        });
    } catch (err) {
        console.error('Error deleting portable charger', err);
        return resp.json({ status: 0, message: 'Error deleting portable charger' });
    }
};

export const bikeSwipeHhistory = async (req, resp) => {
    try {
        const { truckId, page_no, search_text = '', start_date='', end_date='' } = req.body;
        const { isValid, errors } = validateFields(req.body, {truckId: ["required"], page_no: ["required"]});
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

        const params = {
            tableName        : 'truck_fuel_history',
            columns          : `truck_id, amount, fuel_litter, meter_reading, ${formatDateTimeInQuery(['created_at'])}, 
            (select rsa.rsa_name from rsa where rsa.rsa_id = truck_fuel_history.driver_id) as rsa_name, truck_image, invoice_image`,
            sortColumn       : 'created_at',
            sortOrder        : 'DESC',
            page_no,
            limit            : 10,
            liveSearchFields : [], 
            liveSearchTexts  : [],
            whereField       : [],  
            whereValue       : [],
            whereOperator    : []
        };
        if (start_date && end_date) {
            
            const startToday = new Date(start_date);
            const startFormattedDate = `${startToday.getFullYear()}-${(startToday.getMonth() + 1).toString()
                .padStart(2, '0')}-${startToday.getDate().toString().padStart(2, '0')}`;
                        
            const givenStartDateTime    = startFormattedDate+' 00:00:01'; // Replace with your datetime string
            const modifiedStartDateTime = moment(givenStartDateTime).subtract(4, 'hours'); // Subtract 4 hours
            const start        = modifiedStartDateTime.format('YYYY-MM-DD HH:mm:ss')
            
            const endToday = new Date(end_date);
            const formattedEndDate = `${endToday.getFullYear()}-${(endToday.getMonth() + 1).toString()
                .padStart(2, '0')}-${endToday.getDate().toString().padStart(2, '0')}`;
            const end = formattedEndDate+' 19:59:59';

            params.whereField.push('created_at', 'created_at');
            params.whereValue.push(start, end);
            params.whereOperator.push('>=', '<=');
        }
        const result = await getPaginatedData(params);
        return resp.json({
            status     : 1,
            code       : 200,
            message    : ["Fuel History List fetch successfully!"],
            data       : result.data,
            total_page : result.totalPage,
            total      : result.total,
            image_url: `${req.protocol}://${req.get('host')}/uploads/truck-images/`
        });
    } catch (error) {
        console.error('Error fetching device list:', error);
        resp.status(500).json({ message: 'Error fetching device lists' });
    }
};

export const bikeSwipeData = asyncHandler(async (req, resp) => {
    
    const serviceFor = [
        { label : 'Talabat', value : 'Talabat' },
        { label : 'Careem',  value : 'Careem' },
        { label : 'Noon',    value : 'Noon' }
    ]; 
    return resp.json({ status : 1, code : 200, data : serviceFor });
});