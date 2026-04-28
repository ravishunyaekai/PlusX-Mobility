import generateUniqueId from "generate-unique-id";
import { asyncHandler, createNotification, formatDateTimeInQuery, mergeParam, pushNotification, sendNotification } from "../../../utils.js";
import validateFields from "../../../validation.js";
import { getPaginatedData, insertRecord, queryDB, updateRecord } from "../../../dbUtils.js";
import db from '../../../config/indiadb.js';

export const addChargShare = async (req, resp) => {
    try {
       const  { city,state,rider_name,rider_id,email, mobile, charger_name, description, charger_type, output, connector_type, compatible,address_id ,address, park_no, park_floor, open_days, open_timing,latitude,longitude}=mergeParam(req);
       
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
        

    const charger_id = `CS-${generateUniqueId({ length:6 })}`;  
        console.log(rider_id,rider_name,email,charger_id, mobile, charger_name, description, charger_type, output, connector_type, compatible, address, park_no, park_floor,formattedOpenDays, 
        formattedOpenTiming, charger_image,latitude,longitude)
         const insert = await insertRecord('charge_share',
        ['rider_id','rider_name','email','charger_id', 'mobile', 'charger_name', 'description', 'charger_type', 'output','connector_type', 'compatible', 'park_no', 'park_floor','open_days',
        'open_timing', 'charger_image','latitude','longitude','city','state','address_data'], 
             [ rider_id,rider_name,email,charger_id, mobile, charger_name, description, charger_type, output, connector_type, formatted_compatible, park_no, park_floor,formattedOpenDays, 
        formattedOpenTiming, charger_image,latitude,longitude,city,state,address_check.address_data]);

        if(insert.affectedRows == 0) return resp.json({status:0, message: "Failed to add Charge share! Please try again after some time."});

       
        return resp.json({ status  : 1,code:200, message :[ "Charge share product added successfully."] });

    } catch (error) {
        console.error('Something went wrong in add charge share', error);
        resp.status(500).json({ message: 'Something went wrong' });
    }
};

export const editChargShare = async (req, resp) => {
    try {

        

   const {userId,charger_id,charger_name,latitude,longitude,description,street_number,landmark,city,state,parkingNumber,compatible,Connector,open_days,outputcharger
    ,open_timing,charger_type,parking_floor, bulding_name
   }=req.body;

        const uploadedFiles = req.files;
        let charger_image      = '';
       

        if(req.files && req.files['charger_image']) { 
            charger_image = uploadedFiles ? uploadedFiles['charger_image'][0].filename : '';
        }
        // console.log("charger_image",charger_image)
//  return resp.json({status:0, message: "Failed to edit Charge share! Please try again after some time."});
 const user_details = await queryDB(`SELECT rider_id,fcm_token FROM riders WHERE rider_id = (SELECT rider_id FROM charge_share WHERE charger_id = ? )`,  [charger_id]
);
     
        
        // const { isValid, errors } = validateFields(mergeParam(req), { 
        //     // rider_id         : ["required"], 
        //     // mobile           : ["required"], 
        //     charger_name     : ["required"], 
        //     description      : ["required"], 
        //     charger_type     : ["required"], 
        //     outputcharger    : ["required"], 
        //     Connector        : ["required"], 
        //     // address_id          : ["required"],
        //     park_no          : ["required"], 
        //     park_floor       : ["required"], 
        //     open_days        : ["required"], //array
        //     open_timing      : ["required"], //array
        //     compatible       : ["required"],//array
        //     latitude         : ["required"],
        //     longitude        : ["required"],
        //     email            :['required'],
        //     rider_name       :['required'],
        //     city             :['required'],
        //     state            :['required'],             
        //     charger_id       :['required']  

        // });
        // if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
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

  
     
const chargeShareCheck=await queryDB(`SELECT id from charge_share where  charger_id=?`,[charger_id]);
     if(!chargeShareCheck) return resp.json({status:0, message: "Invailed charger "});
     let updates={
        charger_name,
        description,
        charger_type,
        output:outputcharger, 
        connector_type:Connector, 
        compatible:formatted_compatible, 
       city,
       state,
         park_no:parkingNumber, 
         park_floor:parking_floor,
         open_days:formattedOpenDays, 
        open_timing:formattedOpenTiming,        
         charger_status:1
     };
     if(charger_image){
        updates.charger_image=charger_image
     }
     const pincode="";
     const sql = `UPDATE charge_share SET address_data = JSON_SET(IFNULL(address_data, '{}'), '$.city', ?, '$.state', ?, '$.landmark', ?,'$.street_name', ?,'$.building_name', ?)
WHERE charger_id = ?
`;
await db.execute(sql, [
  city,
  state,
  landmark,
  street_number,
   bulding_name, 
  charger_id
]);
    
         const insert = await insertRecord('db_logs', 
                    [ 'table_name', 'action_type', 'created_by', 'changed_data' ],
                    [ 'charge_share', 'updated by user', userId, updates ]
                );
                if( insert.affectedRows == 0 ){ 
                    return resp.json({ status: 0, code: 400, message: ['Charger was not updated!'] });
                }
                if(insert.affectedRows == 0) return resp.json({status:0, message: "Failed to edit Charge share! Please try again after some time."});
                
            
        
                await updateRecord('charge_share', updates, ['charger_id'], [charger_id]);
               
                  
                    const href    = 'charge_share_accept/' + charger_id;
            const heading = `${charger_name}`;
            const desc    = 'Your listing has been approved!';
          await   pushNotification(user_details.fcm_token, heading, desc, 'RDRFCM', href);
 
             
            await createNotification(heading, desc, 'charge_share_accept', 'Rider', 'Admin','', user_details.rider_id, href);
             

        return resp.json({ status  : 0,code:200, message :[ "Charge details updated successfully."] });

    } catch (error) {
        console.error('Something went wrong in add charge share', error);
        resp.status(500).json({ message: 'Something went wrong' });
    }
};

export const rejectChargShare = async (req, resp) => {
    try {



          const {charger_id,charger_name}=req.body;


 const charger_details = await queryDB(`SELECT charger_name from charge_share where charger_id=? `,  [charger_id]
);


    const user_details = await queryDB(`SELECT rider_id,fcm_token FROM riders WHERE rider_id = (SELECT rider_id FROM charge_share WHERE charger_id = ? )`,  [charger_id]
);
     
      
    
     await updateRecord('charge_share', {charger_status:0}, ['charger_id'], [charger_id]);
                
                   
                   
                     const href    = 'charge_share_reject/' + charger_id;
            const heading = `${charger_details.charger_name}`;
            const desc    = `Your listing has been rejected as it does not meet our guidelines.`;
           await  pushNotification(user_details.fcm_token, heading, desc, 'RDRFCM', href);
                    


        await createNotification(heading, desc, 'charge_share_reject', 'Rider', 'Admin','', user_details.rider_id, href);
                  
             
     
        return resp.json({ status  :1,code:200, message : "Request rejected successfully" });

    } catch (error) {
        console.error('Something went wrong in add charge share', error);
        resp.status(500).json({ message: 'Something went wrong' });
    }
};
export const chargeShareList = async (req, resp) => {
    try {
        const { page_no = 1, search_text = '',charger_status,requirement=0,} = mergeParam(req);
       
        // if(Number(requirement)!==0 && Number(requirement)!==1){
        //      return resp.json({
        //     status     : 0,
        //     code       :422,
        //     message    : [" requirement must be 0 or 1"],
        // });
        // }
        

        const params = {
            tableName  : ' charge_share',
            columns    : `rider_name,
            CONCAT_WS(', ',
   
    NULLIF(address_data->>'$.building_name', ''),
    NULLIF(address_data->>'$.street_name', ''),
    NULLIF(address_data->>'$.landmark', ''),
    NULLIF(address_data->>'$.city', ''),
    NULLIF(address_data->>'$.state', ''),
    NULLIF(address_data->>'$.pincode', '')
) AS address, 
CASE 
    WHEN charger_status = 1 THEN 'Active'
    WHEN charger_status = 2 THEN 'Rejected'
    ELSE 'In-Active'
END AS charger_status,
     charger_id, charger_name,  charger_type, compatible,  address_data->>'$.city' as city`,
            sortColumn : '(charger_status = 1) DESC,id DESC',
            sortOrder  : '',
            page_no,
            liveSearchFields : ['compatible','rider_name', 'charger_name','city' ],
            liveSearchTexts  : [search_text, search_text,search_text,search_text],
            limit            : 10,
            whereField       : [],
            whereValue       : [],
            whereOperator    : [],
            
         
           
        }


        if(charger_status===0 || charger_status===1){
            params.whereField.push('charger_status');
            params.whereValue.push(charger_status);
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
    const { charger_id ,requirement=0}      = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), { charger_id: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const charger = await queryDB(`SELECT ct.city_id, ct.state_id,cs.compatible as compatible_type, cs.charger_name,CASE WHEN cs.charger_status =1 THEN 'Active' ELSE 'In-Active' end AS charger_status,
        cs.address_data->>'$.building_name' AS building_name,cs.charger_id,cs.rider_name,cs.email, cs.mobile, cs.charger_name, cs.description,
         cs.charger_type, cs.output, cs.connector_type,
         cs.address_data->>'$.building_name' AS building_name,
cs.address_data->>'$.street_name'   AS street_name,
cs.address_data->>'$.landmark'      AS landmark,
cs.address_data->>'$.city'          AS city,
cs.address_data->>'$.state'         AS state,
cs.address_data->>'$.pincode'       AS pincode,
        CONCAT_WS(', ',
   
    NULLIF(cs.address_data->>'$.building_name', ''),
    NULLIF(cs.address_data->>'$.street_name', ''),
    NULLIF(cs.address_data->>'$.landmark', ''),
    NULLIF(cs.address_data->>'$.city', ''),
    NULLIF(cs.address_data->>'$.state', ''),
    NULLIF(cs.address_data->>'$.pincode', '')
) AS address, cs.park_no, cs.park_floor, cs.open_days,
        cs.open_timing, cs.term_condition,cs.charger_image, cs.latitude, cs.longitude, ${formatDateTimeInQuery(['cs.created_at', 'cs.updated_at'])} FROM charge_share cs
        LEFT JOIN cities ct on ct.name=cs.city
        WHERE cs.charger_id = ?`, [charger_id]); 
       
    if (!charger) return resp.status(404).json({status: 0, code: 404, message: 'Charge share Product not found.'});
    const    [connector_raw]=await db.execute(`SELECT value FROM output_connector where status='connector' order by id asc `);
       const [compatible_raw] = await db.execute(`SELECT DISTINCT make as value FROM vehicle_brand_list where status=1 ORDER BY  make ASC`);
       const connector=connector_raw.map(item=>({
        value:item.value,
        label:item.value
       }))

    //    const compatible=compatible_raw.map(item=>({
    //     value:item.value,
    //     label:item.value
    //    }))
    const compatible = [
        { value: 'All EVs', label: 'All EVs' },
        ...compatible_raw.map(item => ({
            value: item.value,
            label: item.value
        }))
    ];

       return resp.json({
        status       : 1,
        code         : 200,
        message      : ["Charge share Details fetched successfully!"],
        data         :{...charger,connector,compatible},
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
    const { requirement}      = req.body;
   let  output=[];
    switch(requirement){
        case "AC":
    [output]=await db.execute(`SELECT value FROM output_connector where status='ac-output' order by sequence asc `);

        break;
        case "DC":
    [output]=await db.execute(`SELECT value FROM output_connector where status='dc-output' order by sequence asc `);
            break ;
            default :
            console.log("default")
            break;

    }
//     const output = output_raw.map(item => ({
//   value: item.value,
//   label: item.value
//         }));

    // const [AC_output]=await db.execute(`SELECT id,value FROM output_connector where status='ac-output' order by sequence asc `);
    // const [DC_output]=await db.execute(`SELECT id,value FROM output_connector where status='dc-output' order by sequence asc `);


     const    [connector]=await db.execute(`SELECT id,value FROM output_connector where status='connector' order by id asc `);
       const [make_list] = await db.execute(`SELECT DISTINCT make FROM vehicle_brand_list where status=1 ORDER BY  make ASC`);
        const makes = make_list.map(row => row.make);
        const finalMakeList = [
  { make: 'All EVs' },
  ...makes.map(m => ({ make: m })),
  { make: 'Other' }
];
   console.log("[output]",[output])
    return resp.json({
        status       : 1,
        code         : 200,
        message      : ["out put , connector  data fetched successfully!"],
        data :output,
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


