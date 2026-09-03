import generateUniqueId from "generate-unique-id";
import { asyncHandler, createNotification, formatDateTimeInQuery, mergeParam } from "../../../utils.js";
import validateFields from "../../../validation.js";
import { getPaginatedData, insertRecord, queryDB, updateRecord } from "../../../dbUtils.js";
import db from '../../../config/indiadb.js';
import { io } from "../../../server.js";

export const addChargShare = async (req, resp) => {
    try {
       const  { city,state,rider_name,rider_id,email, mobile, charger_name, description, charger_type, output, connector_type, compatible,address_id ,address, park_no, park_floor, open_days, open_timing,latitude,longitude, accessPermit = 0, chargeRecomendRate = null }=mergeParam(req);
       
        const uploadedFiles = req.files;
        let charger_image      = '';
       

        if(req.files && req.files['charger_image']) { 
            charger_image = uploadedFiles ? uploadedFiles['charger_image'][0].filename : '';
        }

        
        const { isValid, errors } = validateFields(mergeParam(req), { 
            rider_id         : ["required"], 
            mobile           : ["required"], 
            charger_name     : ["required"], 
            description      : ["required"], 
            charger_type     : ["required"], 
            output           : ["required"], 
            connector_type   : ["required"], 
            // address          : ["required"],
            // park_no          : ["required"], 
            // park_floor       : ["required"], 
            open_days        : ["required"], //array
            open_timing      : ["required"], //array
            compatible       : ["required"],//array
            latitude         : ["required"],
            longitude        : ["required"],
            email            :['required'],
            rider_name       :['required'],
            city             :['required'],
            state            :['required'],
            address_id       :['required']
            


        });
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
         if ( open_days.length === 0 || open_timing.length === 0|| compatible.length === 0) {
      return resp.json({
    status: 0, 
    code: 422,
    message: "open_days ,open_timing, compatible is required and must be a non-empty array"
    });
    }


//         if (!Array.isArray(open_days) || !Array.isArray(open_timing)) {
//     return resp.json({
//         status: 0,
//         code:200,
//         message: ['open_days and open_timing must be arrays']
//     });
// }

    const formattedOpenDays = Array.isArray(open_days)? JSON.stringify(open_days): open_days;
    const formattedOpenTiming = Array.isArray(open_timing)? JSON.stringify(open_timing): open_timing;
    const formatted_compatible = Array.isArray(compatible)? JSON.stringify(compatible): compatible;

// const formatted_compatible = normalizeJsonArray(compatible);
// const formattedOpenDays = normalizeJsonArray(open_days);
// const formattedOpenTiming = normalizeJsonArray(open_timing);

       const address_check= await queryDB(`SELECT JSON_OBJECT(

    'building_name',  COALESCE(building_name, ''),
    'street_name',    COALESCE(street_name, ''),
    'landmark',       COALESCE(landmark, ''),
    'city',           COALESCE(city, ''),
    'state',          COALESCE(state, ''),
    'pincode',        COALESCE(pincode, '')
) AS  address_data  FROM rider_address WHERE address_id =  ?`,[address_id]);
        

    const charger_id = `MCS-${generateUniqueId({ length:4 })}`;  
        console.log(rider_id,rider_name,email,charger_id, mobile, charger_name, description, charger_type, output, connector_type, compatible, address, park_no, park_floor,formattedOpenDays, 
        formattedOpenTiming, charger_image,latitude,longitude)
         const insert = await insertRecord('charge_share',
        ['rider_id','rider_name','email','charger_id', 'mobile', 'charger_name', 'description', 'charger_type', 'output','connector_type', 'compatible', 'park_no', 'park_floor','open_days',
        'open_timing', 'charger_image','latitude','longitude','city','state','address_data','accessPermit', 'chargeRecomendRate'], 
             [ rider_id,rider_name,email,charger_id, mobile, charger_name, description, charger_type, output, connector_type, formatted_compatible, park_no, park_floor,formattedOpenDays, 
        formattedOpenTiming, charger_image,latitude,longitude,city,state,address_check.address_data, accessPermit, chargeRecomendRate]);

        if(insert.affectedRows == 0) return resp.json({status:0, message: "Failed to add Charge share! Please try again after some time."});

       //
        // await pushNotification(user_details.fcm_token, charger_details.charger_name, 'Your EV share listing has been Rejected', 'RDRFCM', href );
       const href=`/electric/charge-share/charge-share-details/${charger_id}`
              await createNotification(charger_name, "Charge Share Listing",'charge share' , 'Admin', 'Rider', rider_id, "", href);
         io.emit('plusx-notification-list', {msCount : 1});

        return resp.json({ status  : 1,code:200, message :[ "Your listing has been submitted successfully. You will be notified once your listing is approved."] });

    } catch (error) {
        console.error('Something went wrong in add charge share', error);
        resp.status(500).json({ message: 'Something went wrong' });
    }
};

export const editChargShare = async (req, resp) => {
    try {
       const  { charger_id,city,state,rider_name,rider_id,email, mobile, charger_name, description, charger_type, output, connector_type, compatible, address_id, park_no, park_floor, open_days, open_timing,latitude,longitude}=mergeParam(req);
       
        const uploadedFiles = req.files;
        let charger_image      = '';
       

        if(req.files && req.files['charger_image']) { 
            charger_image = uploadedFiles ? uploadedFiles['charger_image'][0].filename : '';
        }
       
        
        const { isValid, errors } = validateFields(mergeParam(req), { 
            rider_id         : ["required"], 
            mobile           : ["required"], 
            charger_name     : ["required"], 
            description      : ["required"], 
            charger_type     : ["required"], 
            output           : ["required"], 
            connector_type   : ["required"], 
            address_id          : ["required"],
            // park_no          : ["required"], 
            // park_floor       : ["required"], 
            open_days        : ["required"], //array
            open_timing      : ["required"], //array
            compatible       : ["required"],//array
            latitude         : ["required"],
            longitude        : ["required"],
            email            :['required'],
            rider_name       :['required'],
            city             :['required'],
            state            :['required'],             
            charger_id       :['required']  

        });
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    //      if ( open_days.length === 0 || open_timing.length === 0|| compatible.length === 0) {
    //   return resp.json({
    // status: 0, 
    // code: 422,
    // message: "open_days ,open_timing, compatible is required and must be a non-empty array"
    // });
    // }

    const formattedOpenDays = Array.isArray(open_days)? JSON.stringify(open_days): open_days;
    const formattedOpenTiming = Array.isArray(open_timing)? JSON.stringify(open_timing): open_timing;
    const formatted_compatible = Array.isArray(compatible)? JSON.stringify(compatible): compatible;

  const address_check= await queryDB(`SELECT JSON_OBJECT(
        
        'building_name',  COALESCE(building_name, ''),
        'street_name',    COALESCE(street_name, ''),
        'landmark',       COALESCE(landmark, ''),
        'city',           COALESCE(city, ''),
        'state',          COALESCE(state, ''),
        'pincode',        COALESCE(pincode, '')
        ) AS  address_data  FROM rider_address WHERE address_id =  ?`,[address_id]);
     

const chargeShareCheck=await queryDB(`SELECT id from charge_share where  charger_id=? and rider_id=?`,[charger_id,rider_id]);
     if(!chargeShareCheck) return resp.json({status:0, message: "Invailed charger "});
     let updates={rider_name,email, charger_id, mobile, 
        charger_name, description, charger_type, output, 
        connector_type, 
        compatible:formatted_compatible, 
        address,
         park_no, 
         park_floor,
         open_days:formattedOpenDays, 
        open_timing:formattedOpenTiming, 
        charger_image,latitude,longitude,city,state,
        address_data:address_check.address_data
     };
    //  (rider.rider_email!==rider_email ) ? updates.rider_email=rider_email : null;
    //    (first_name!==rider.rider_name)? updates.rider_name=first_name:null;
       
    //     (last_name!==rider.last_name)?updates.last_name=last_name:null;

    //     ( city_id  &&  city_id!==rider.city_id )? updates.city_id=city_id:null;
         const insert = await insertRecord('db_logs', 
                    [ 'table_name', 'action_type', 'created_by', 'changed_data' ],
                    [ 'charge_share', 'updated by user', rider_id, updates ]
                );
                if( insert.affectedRows == 0 ){ 
                    return resp.json({ status: 0, code: 400, message: ['Charger was not updated!'] });
                }
                if(insert.affectedRows == 0) return resp.json({status:0, message: "Failed to edit Charge share! Please try again after some time."});
                
            
        
                await updateRecord('charge_share', updates, ['rider_id','charger_id'], [rider_id,charger_id]);

       
        return resp.json({ status  : 0,code:200, message :[ "Charge details updated successfully."] });

    } catch (error) {
        console.error('Something went wrong in add charge share', error);
        resp.status(500).json({ message: 'Something went wrong' });
    }
};

export const chargeShareList = async (req, resp) => {
    try {
        const { page_no = 1, search_text = '',longitude,latitude,rider_id,requirement} = mergeParam(req);
       
        if(Number(requirement)!==0 && Number(requirement)!==1){
             return resp.json({
            status     : 0,
            code       :422,
            message    : [" requirement must be 0 or 1"],
        });
        }
        

        const params = {
            tableName  : ' charge_share',
            columns    : `rider_id, '${requirement}' as own_charge_share, address_data->>'$.building_name' AS building_name,latitude,
    longitude,(
        6371 * ACOS(
            COS(RADIANS(${latitude})) * COS(RADIANS(latitude)) * COS(RADIANS(longitude) - RADIANS(${longitude})) +
            SIN(RADIANS(${latitude})) * SIN(RADIANS(latitude))
        )
    ) AS distance, charger_id, mobile, charger_name, description, charger_type, output, connector_type, compatible, CONCAT_WS(', ',
   
    NULLIF(address_data->>'$.building_name', ''),
    NULLIF(address_data->>'$.street_name', ''),
    NULLIF(address_data->>'$.landmark', ''),
    NULLIF(address_data->>'$.city', ''),
    NULLIF(address_data->>'$.state', ''),
    NULLIF(address_data->>'$.pincode', '')
) AS address, park_no, park_floor, open_days, open_timing,charger_image`,
            sortColumn : 'distance',
            sortOrder  : 'ASC',
            page_no,
            liveSearchFields : ['compatible', 'charger_name' ],
            liveSearchTexts  : [search_text, search_text],
            limit            : 10,
            whereField       : ['charger_status'],
            whereValue       : ['1'],
            whereOperator    : ["="],
            
         
           
        }


        if(requirement==1){
            params.whereField.push('rider_id');
            params.whereValue.push(rider_id);
            params.whereOperator.push('=');
        //    own_charge_share=1
        }
        const result = await getPaginatedData(params);
        
        
        return resp.json({
            status     : 1,
            code       :200,
            message    : [" Charger share List fetch successfully!"],
            data       : result.data,
            total_page : result.totalPage,
            total      : result.total,
            base_url    : `${process.env.DIR_UPLOADS}charge-share-images/`,
            // own_charge_share,
        });

    } catch (error) {
        console.error('Error fetching station list:', error);
        return resp.json({
            status  : 0,
            code    : 500,
            message : 'Error fetching station list'

        });
    }
};

export const chargeShareDetail = asyncHandler(async (req, resp) => {
    const { charger_id ,rider_id,requirement=0}      = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), { charger_id: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
    const charger = await queryDB(`SELECT address_data->>'$.building_name' AS building_name,charger_id,rider_name,email, mobile, charger_name, description,
        charger_type, output, connector_type, compatible,
        CONCAT_WS(', ',
   
    NULLIF(address_data->>'$.building_name', ''),
    NULLIF(address_data->>'$.street_name', ''),
    NULLIF(address_data->>'$.landmark', ''),
    NULLIF(address_data->>'$.city', ''),
    NULLIF(address_data->>'$.state', ''),
    NULLIF(address_data->>'$.pincode', '')
) AS address, park_no, park_floor, open_days,
        open_timing, term_condition,charger_image, latitude, longitude, chargeRecomendRate,accessPermit , ${formatDateTimeInQuery(['created_at', 'updated_at'])} FROM charge_share WHERE charger_id = ?`, [charger_id]); 
    if (!charger) return resp.status(404).json({status: 0, code: 404, message: 'Charge share Product not found.'});
    return resp.json({
        status       : 1,
        code         : 200,
        message      : ["Charge share Details fetched successfully!"],
        data         : charger,
     
      base_url    : `${process.env.DIR_UPLOADS}charge-share-images/`,
    });
});

export const chargeShareDelete = asyncHandler(async (req, resp) => {
    const { charger_id ,rider_id}      = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), { charger_id: ["required"],rider_id :["required"]});
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
    const charger = await db.execute(`DELETE FROM charge_share WHERE charger_id = ? and rider_id=?`, [charger_id,rider_id]); 
    if (!charger) return resp.status(404).json({status: 0, code: 404, message: 'Charge share could not deleted.'});
    
    return resp.json({
        status       : 1,
        code         : 200,
        message      : ["Charge share Deleted successfully!"],
       
    });
});


export const outputAndConnector = asyncHandler(async (req, resp) => {
    // const { requirement}      = mergeParam(req);
   
   const [AC_output]=await db.execute(`SELECT id,value FROM output_connector where status='ac-output' ORDER BY CAST(
            REGEXP_SUBSTR(value, '^[0-9]+(\\.[0-9]+)?')
            AS DECIMAL(10,2)
        ) ASC `);
        const [DC_output]=await db.execute(`SELECT id,value FROM output_connector where status='dc-output' order by sequence asc `);

     const    [connector]=await db.execute(`SELECT id,value FROM output_connector where status='connector' order by id asc `);
       const [make_list] = await db.execute(`SELECT DISTINCT make FROM vehicle_brand_list where status=1 ORDER BY  make ASC`);
        const makes = make_list.map(row => row.make);
        const finalMakeList = [
  { make: 'All EVs' },
  ...makes.map(m => ({ make: m })),
  { make: 'Other' }
];
   
    return resp.json({
        status       : 1,
        code         : 200,
        message      : ["out put , connector  data fetched successfully!"],
        AC_output,
        DC_output,
        // output,
        connector,
        make_list:finalMakeList,
        weeks : ["All Days","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
       

    });    

});

export const chargeshareForMap = asyncHandler(async (req, resp) => {
    const {rider_id } = mergeParam(req);
        
    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id: ["required"]
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const [chargers] = await db.execute(`
        SELECT 
            address,charger_id, charger_name,latitude, longitude 
        FROM 
            charge_share 
        ORDER BY 
            id ASC 
        LIMIT 20
        `);
    // const origin       = `${latitude}, ${longitude}`;
    // const routeResults = await getMultipleRoute(origin, chargers);
    return resp.json({
        status  : 1 ,
        code    : 200, 
        message : ['Charge share list fetch successfully!'],
        data    : chargers
    });
});

export const packageList = asyncHandler(async (req, resp) => {
    const { rider_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id: ["required"]
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const [packages] = await db.execute(`
        SELECT
            id, package_id, package_name,
            CAST(charging_capacity AS UNSIGNED) AS charging_capacity,
            CAST(price_per_unit AS UNSIGNED) AS price_per_unit,
            ROUND((charging_capacity * price_per_unit), 2) AS charging_fee,
            service_fee, description
        FROM home_ev_charging_packages
        WHERE status = 1 AND is_deleted = 0
        ORDER BY charging_capacity ASC;
    `);

    return resp.json({
        status: 1,
        code: 200,
        message: ["Charging package list fetched successfully."],
        result: packages
    });

});

export const packageVehicleList = asyncHandler(async (req, resp) => {

    const { rider_id } = mergeParam(req);

    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id: ["required"]
    });

    if (!isValid) {
        return resp.json({
            status: 0,
            code: 422,
            message: errors
        });
    }

    const [vehicles] = await db.execute(`
        SELECT
            id,
            vehicle_id,
            vehicle_make,
            vehicle_model,
            vehicle_number,
            default_vehicle
        FROM riders_vehicles
        WHERE rider_id = ?
        ORDER BY default_vehicle DESC, id DESC
    `, [rider_id]);

    return resp.json({
        status: 1,
        code: 200,
        message: ["Vehicle list fetched successfully."],
        result: vehicles
    });

});

export const addressList = asyncHandler(async (req, resp) => {

    const { rider_id } = mergeParam(req);

    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id: ["required"]
    });

    if (!isValid) {
        return resp.json({
            status: 0,
            code: 422,
            message: errors
        });
    }

    const [addresses] = await db.execute(`
        SELECT
            id, address_id, nick_name, building_name, unit_no, street_name, area, city, state, pincode, latitude, longitude, default_add
        FROM rider_address
        WHERE rider_id = ?
        ORDER BY default_add DESC, id DESC
    `, [rider_id]);

    return resp.json({
        status: 1,
        code: 200,
        message: ["Address list fetched successfully."],
        result: addresses
    });

});

import moment from "moment";

export const timeSlotList = asyncHandler(async (req, resp) => {

    const { rider_id, slot_date } = mergeParam(req);

    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id: ["required"],
        slot_date: ["required"]
    });

    if (!isValid) {
        return resp.json({
            status: 0,
            code: 422,
            message: errors
        });
    }

    // Convert selected date into weekday
    const dayName = moment(slot_date, "YYYY-MM-DD").format("dddd");

    const [slots] = await db.execute(`
        SELECT
            slot_id,
            slot_date,
            TIME_FORMAT(start_time,'%h:%i %p') AS start_time,
            TIME_FORMAT(end_time,'%h:%i %p') AS end_time,
            slot_price
        FROM road_assistance_slot
        WHERE slot_date = ?
        AND status = 1
        ORDER BY start_time ASC
    `, [dayName]);

    return resp.json({
        status: 1,
        code: 200,
        message: ["Time slot list fetched successfully."],
        result: slots
    });

});