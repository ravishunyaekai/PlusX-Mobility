import { getPaginatedData, insertRecord, queryDB } from "../../../dbUtils.js";
import { asyncHandler, checkNumber, mergeParam, sqlCase } from "../../../utils.js";
import validateFields from "../../../validation.js";
import db from '../../../config/indiadb.js';

export const addUnversity = asyncHandler(async (req, resp) => {
   const {university_name, address, country_id, station_city_id, station_state_id}=req.body;
   
   const { isValid, errors } = validateFields  (req.body, { 
                    university_name        : ["required"], 
                    address       : ["required"], 
                    country_id        : ["required"], 
                    station_city_id          : ["required"], 
                    station_state_id        : ["required"],
                    
                });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
         const unversity_data = await queryDB(`SELECT st.name as state  ,
            (SELECT name  FROM cities WHERE city_id =?)AS city
               FROM states st  where st.state_id=?
        `,[station_city_id,station_state_id]);


    const unversity = await insertRecord('university', [
        'university_id', 'name', 'address', 'country_id', 'state', 'city' ],
        [ 'U', university_name, address, country_id, unversity_data.state, unversity_data.city]);
    
    if(!unversity) return resp.json({status:0, code:405, message: ["Failed to register. Please Try Again"], error: true}); 

    const university_id = 'U' + String(unversity.insertId).padStart(4, '0');
    await db.execute('UPDATE university SET university_id = ? WHERE id = ?', [university_id, unversity.insertId]);
   
   
    return resp.json({status: 1, code: 200, message: 'New University added successfully! '});
});

export const editUniversity = asyncHandler(async (req, resp) => {
        const { university_id, university_name, address, country_id="CN001", station_city_id, station_state_id } = req.body;

        // Validate required fields
        const { isValid, errors } = validateFields(req.body, {
            university_id: ["required"],
            university_name: ["required"],
            address: ["required"],
            // country_id: ["required"],
            station_city_id: ["required"],
            station_state_id: ["required"],
        });

        if (!isValid) {
            return resp.json({ status: 0, code: 422, message: errors });
        }

        //  Fetch city & state names
        const univ_data = await queryDB(
            `SELECT st.name AS state, 
                    (SELECT name FROM cities WHERE city_id = ?) AS city
            FROM states st
            WHERE st.state_id = ?
            LIMIT 1`,
            [station_city_id, station_state_id]
        );
       

        if (!univ_data || !univ_data.state || !univ_data.city) {
            return resp.json({ status: 0, code: 400, message: "Invalid city or state provided." });
        }

        //  Prevent duplicate university name (excluding this university)
        const [duplicate] = await db.execute(
            `SELECT id FROM university WHERE name = ? AND university_id != ? LIMIT 1`,
            [university_name, university_id]
        );

        if (duplicate.length > 0) {
            return resp.json({
            status: 0,
            code: 422,
            message: "University name already exists!",
            });
        }

        //  Perform update
        const [updateRes] = await db.execute(
            `UPDATE university 
                SET name = ?, address = ?, state = ?, city = ?
            WHERE university_id = ?`,
            [
            university_name,
            address,
            univ_data.state,
            univ_data.city,
            university_id,
            ]
        );

        if (updateRes.affectedRows === 0) {
            return resp.json({
            status: 0,
            code: 404,
            message: "University not found!",
            });
        }

        // 5️⃣ Success
        return resp.json({
            status: 1,
            code: 200,
            message: "University updated successfully!",
        });
});

export const universityList = asyncHandler(async (req, resp) => {
    try {
        /*
        ifnull((select base_price from cycle_pricing cp where cp.station_id=cycle_list.station_id  and cp.type_of_cycle=cycle_list.cycle_type
             and cp.type_of_cycle=cycle_list.cycle_type ),0)as base_price
        */
        const { page_no, search, sort_by = 'd', start_date, end_date, search_text='',country_id,city_id,rowSelected,state_id} = req.body;
        console.log("req.body,",req.body);
       
        const { isValid, errors } = validateFields(req.body, { page_no: ["required"] });
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

     const params = {
            tableName: 'university ',
           columns: `university_id, name , state, city`,
        // joinTable:"mobility_station_list msl",
        // joinCondition:"msl.station_id=cl.station_id",
        sortColumn:'id',
        sortOrder: 'DESC',
        page_no,
        limit: rowSelected || 10,
        liveSearchFields: ['name', 'state', 'city'],
        liveSearchTexts: [search_text, search_text,search_text],
        whereField: ['status'],
        whereValue: [1],
        whereOperator: ['=']
        };
        if (country_id ){
         params.whereField.push('country_id');
            params.whereValue.push(country_id);
            params.whereOperator.push('=');
          }

          if (state_id ){
            const state_data=await queryDB('SELECT name  FROM states where state_id=?',[state_id]);
           
         params.whereField.push('state');
            params.whereValue.push(state_data.name);
            params.whereOperator.push('=');
          }
          if (city_id ){
            const city_data=await queryDB('SELECT name  FROM cities where city_id=?',[city_id]);
           
         params.whereField.push('city');
            params.whereValue.push(city_data.name);
            params.whereOperator.push('=');
          }
                   
          


        if (start_date && end_date) {
            // const start = moment(start_date, "YYYY-MM-DD").format("YYYY-MM-DD");
            // const end = moment(end_date, "YYYY-MM-DD").format("YYYY-MM-DD");
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
            // base_price: item.base_price !== null ? `${item.base_price} INR` : null
            }));
            //  result.data={currency:"INR"}
           

        return resp.json({
            status: 1,
            code: 200,
            message: ["University list fetched successfully!"],
            data: updatedData,
            total_page: result.totalPage,
            total: result.total,
            // currency:"INR",
            // base_url: `${process.env.DIR_UPLOADS}cycle-station-images/`
        });//

    } catch (error) {
        console.error('Error fetching cycle List:', error);
        return resp.status(500).json({
            status: 0,
            code: 500,
            message: 'Error fetching cycle List'
        });
    }
});

export const universitydetail = asyncHandler(async (req, resp) => {
    const {universityId}=req.body;
    
    const [[university]] = await db.execute(`SELECT  ct.state_id, ct.city_id, un.university_id, un.name , un.state, un.city ,un.address FROM university un
                                JOIN cities ct on ct.name=un.city
                                where university_id=?`,[universityId]);
        
      return resp.json({status: 1,
         code: 200,
         message: 'University data fetched successfully! ', 
         university,
            base_url: `${process.env.DIR_UPLOADS}student_id_image/`

    });

});

export const universityListSelect = asyncHandler(async (req, resp) => {
    const {country_id}=req.body;

    const [list] = await db.execute(`SELECT university_id, name , state, city  
       
        FROM university
       ORDER BY id ASC`);
    return resp.json({status: 1, code: 200, message: '', data: list});
});

export const addstudent= asyncHandler(async (req, resp) => {
    const { first_name, rider_email, country_code='+91', rider_mobile, account_type='Student',
        university_id='',student_id='',
         added_from='admin'} =req.body;// mergeParam(req);
       
   //state_id,state,city,country_id,city_id
    let validationRules = {
        first_name   : ["required"],
        // last_name    : ["required"],
        rider_email  : ["required", "email"],
        // country_code : ["required"],
        rider_mobile : ["required"],
        // state        : ["required"],
university_id        : ["required"],
        // user_type : ["required"],
        // city_id      : ["required"],
       
        // latitude     : ["required"],
        // longitude    : ["required"],
        // unversity    : ["required"],
        // student_id   : ["required"],
        // id_image      : ["required"],
    };

        



    const { isValid, errors } = validateFields(req.body, validationRules);
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    if(account_type!=='Individual' &&  account_type!=='Student'){
        return resp.json({ status:0, code:422, message: ["Invalid User type!"] });
    }
    const res = checkNumber(country_code, rider_mobile);
    const [results] = await db.execute(`SELECT 'email' AS type FROM riders WHERE rider_email = ? 
            UNION ALL
        SELECT 'mobile' AS type FROM riders WHERE rider_mobile = ?
    `, [rider_email, rider_mobile]);

        let hasEmail = false;
        let hasMobile = false;

        for (const row of results) {
        if (row.type === 'email') hasEmail = true;
        if (row.type === 'mobile') hasMobile = true;
        }

        if (hasEmail && hasMobile) {
        return resp.json({ status: 0, code: 422, message: "Email and mobile number are already registered !" });
        } else if (hasEmail) {
        return resp.json({ status: 0, code: 422, message: "Email already registered !" });
        }else if (hasMobile) {
        return resp.json({ status: 0, code: 422, message: "Mobile Number already registered !" });
        }

    if(res.status == 0) return resp.json({ status:0, code:422, message: res.msg });
    let id_image = '';
            if(req.files && req.files['id_image']) { 
                const files   = req.files;
                id_image = files ? files['id_image'][0].filename : '';
            }

     const unversity_data = await queryDB(`SELECT un.state,c.city_id, c.state_id, un.country_id from university un
        JOIN cities c ON un.city=c.name

        where un.university_id=?  limit 1
        `,[university_id]);
        
    //const token  = crypto.randomBytes(12).toString('hex');
    console.log('PM', first_name,  rider_email, country_code, rider_mobile,
            0, added_from || 'Android', account_type, unversity_data.state,student_id, id_image,university_id
            ,unversity_data.city_id,unversity_data.country_id,unversity_data.state_id);
        const rider = await insertRecord('riders',
        [
            'rider_id', 'rider_name','rider_email', 'country_code', 'rider_mobile',
            'status', 'added_from', 'account_type', 'state', 'student_id', 'id_image', 'university'
            , 'city_id','country_id','state_id' 
        ],
        ['PM', first_name , rider_email, country_code, rider_mobile,
            0, added_from || 'Android', account_type, unversity_data.state,student_id, id_image,university_id
            ,unversity_data.city_id,unversity_data.country_id,unversity_data.state_id]);
            if (!rider) {
        return resp.json({
            status: 0,
            code: 405,
            message: "Failed to register. Please Try Again",
            error: true
        });
    }
    if(!rider) return resp.json({status:0, code:405, message: "Failed to register. Please Try Again", error: true}); 

    const riderId = 'PM' + String(rider.insertId).padStart(4, '0');
    await db.execute('UPDATE riders SET rider_id = ? WHERE id = ?', [riderId, rider.insertId]);
         await db.execute('DELETE FROM temp_riders where rider_mobile=? and country_code=? ',[rider_mobile,country_code])  


     //    return resp.json({ status:1, code:200,result, message: ["New User registered successfully"]});

     
            return resp.json({
            status: 1,
            code: 200,
            // result:result,
            message: "New Student added successfuly!",
        });
    })
export const editStudent = asyncHandler(async (req, resp) => {
  const { rider_id,first_name,rider_email, country_code = '+91',rider_mobile, account_type = 'Student', university_id,country_id='CN001', student_id,added_from = 'admin'} = req.body;

  // Validation
  const validationRules = {
    first_name: ["required"],
    rider_email: ["required", "email"],
    rider_mobile: ["required"],
    university_id: ["required"],
    student_id:['required']
  };

  const { isValid, errors } = validateFields(req.body, validationRules);
  if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

  if ( account_type !== 'Student') {
    return resp.json({ status: 0, code: 422, message: ["Invalid User type!"] });

  }
        const [existingUser] = await db.execute(
            `SELECT rider_email, rider_mobile 
            FROM riders 
            WHERE (rider_email = ? OR rider_mobile = ?)
            AND rider_id != ? `,[rider_email, rider_mobile, rider_id]
            );

if (existingUser.length > 0) {
  const user = existingUser[0];

        if (user.rider_email === rider_email && user.rider_mobile === rider_mobile) {
            return resp.json({ status: 0, code: 422, message: "Email and Mobile number are already registered!" });
        } 
        else if (user.rider_email === rider_email) {
            return resp.json({ status: 0, code: 422, message: "Email already registered!" });
        } 
        else if (user.rider_mobile === rider_mobile) {
            return resp.json({ status: 0, code: 422, message: "Mobile number already registered!" });
        }
    }

  // Check if student exists by university_id
//   const [existingStudent] = await db.execute(
//     `SELECT id, FROM riders WHERE university = ? LIMIT 1`,
//     [university_id]
//   );

//   if (!existingStudent.length) {

//     return resp.json({
//       status: 0,
//       code: 404,
//       message: "No student found for the given university ID!",
//     });
//   }

//   const studentRow = existingStudent[0];

  // Handle image upload if any
  let id_image = '';
  if (req.files && req.files['id_image']) {
    const files = req.files;
    id_image = files ? files['id_image'][0].filename : '';
  }

  // Fetch university details
  const [universityData] = await db.execute( `SELECT un.state, c.city_id, c.state_id, un.country_id 
     FROM university un
     JOIN cities c ON un.city = c.name
     WHERE un.university_id = ?
     LIMIT 1`,[university_id] );

  if (!universityData.length) {
    return resp.json({
      status: 0,
      code: 422,
      message: "Invalid University ID provided!",
    });
  }

  const unv = universityData[0];

  // Prepare update query
  const updateQuery = ` UPDATE riders SET
      rider_name = ?,
      rider_email = ?,
      country_code = ?,
      rider_mobile = ?,
      account_type = ?,
      state = ?,
      student_id = ?,
      id_image = COALESCE(?, id_image),
      city_id = ?,
      country_id = ?,
      state_id = ?,
      university=?,
      updated_at = NOW()
    WHERE rider_id=?
  `;
                 await db.execute(updateQuery, [first_name, rider_email, country_code,
    rider_mobile,
    account_type,
   unv.state,
    student_id,
    id_image || null,
   unv.city_id,
    unv.country_id,
    unv.state_id,
    university_id,
    rider_id
  ]);

        return resp.json({
            status: 1,
            code: 200,
            message: "Student details updated successfully!",
        });
});


    export const studentList = asyncHandler(async (req, resp) => {
    try {
        /*
        ifnull((select base_price from cycle_pricing cp where cp.station_id=cycle_list.station_id  and cp.type_of_cycle=cycle_list.cycle_type
             and cp.type_of_cycle=cycle_list.cycle_type ),0)as base_price
        */
        const { page_no, search, sort_by = 'd', start_date, end_date, search_text='',country_id,state_id,city_id,rowSelected,university_id} = req.body;
      
        const { isValid, errors } = validateFields(req.body, { page_no: ["required"] });
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
//
     const params = {
            tableName: 'riders ',
           columns: `rider_id, rider_name ,(SELECT name from university where university_id=riders.university) as university , state,  (SELECT name from cities where city_id=riders.city_id) as city `,
        // joinTable:"mobility_station_list msl",
        // joinCondition:"msl.station_id=cl.station_id",
        sortColumn:'id',
        sortOrder: 'DESC',
        page_no,
        limit: rowSelected || 10,
        liveSearchFields: ['name', 'state', 'city'],
        liveSearchTexts: [search_text, search_text,search_text],
        whereField: ['account_type'],
        whereValue: ['Student'],
        whereOperator: ['=']
        };
        if (country_id ){
         params.whereField.push('country_id');
            params.whereValue.push(country_id);
            params.whereOperator.push('=');
          }

        if (state_id ){
           

         params.whereField.push('state_id');
            params.whereValue.push(state_id);
            params.whereOperator.push('=');
        }
        if (city_id ){
           
         params.whereField.push('city_id');
            params.whereValue.push(city_id);
            params.whereOperator.push('=');
          }

          if (university_id ){
           
         params.whereField.push('university');
            params.whereValue.push(university_id);
            params.whereOperator.push('=');
          }
                   
          


        if (start_date && end_date) {
            // const start = moment(start_date, "YYYY-MM-DD").format("YYYY-MM-DD");
            // const end = moment(end_date, "YYYY-MM-DD").format("YYYY-MM-DD");
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
            // base_price: item.base_price !== null ? `${item.base_price} INR` : null
            }));
            //  result.data={currency:"INR"}
            

        return resp.json({
            status: 1,
            code: 200,
            message: ["University list fetched successfully!"],
            data: updatedData,
            total_page: result.totalPage,
            total: result.total,
            // currency:"INR",
            // base_url: `${process.env.DIR_UPLOADS}cycle-station-images/`
        });//

    } catch (error) {
        console.error('Error fetching cycle List:', error);
        return resp.status(500).json({
            status: 0,
            code: 500,
            message: 'Error fetching cycle List'
        });
    }
});

export const universityStudent = async (req, resp) => {
    try {
        // if(!req.db){console.log("database requried")}
        // const db=req.db;
        // const { page_no, booking_id, name, contact, status, start_date, end_date, search_text = '', scheduleFilters, areaSelected, rowSelected ,city_id,country_id} = mergeParam(req);
        const { universityId,page_no, riderId, status,search_text = '',start_date,end_date, scheduleFilters, rowSelected ,city_id,country_id} = mergeParam(req);
        
        const rider_id=riderId;
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

       
        const city = CityCountry?.city || '';
        const country = CityCountry?.country || '';
           



        const { isValid, errors } = validateFields(req.body, { page_no : ["required"] });
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

  
    
        const params = {
          
            tableName : 'riders',
            columns   : ` rider_id, rider_name , status, 
            rider_mobile,rider_email,student_id`,
            sortColumn : 'created_at DESC',
            sortOrder  : '',
            page_no,
            limit            : rowSelected || 10,
            // liveSearchFields : ['booking_id', 'user_name' ],
            // liveSearchTexts  : [search_text, search_text ],
            whereField       : ['university'],
            whereValue       : [universityId],
            whereOperator    : ["="]
        };
       
        // if(rider_id) {
           
        //     params.whereField.push('rider_id');
        //     params.whereValue.push(rider_id);
        //     params.whereOperator.push('=');
        // }
        // if(city) {
           
        //     params.whereField.push('city');
        //     params.whereValue.push(city);
        //     params.whereOperator.push('=');
        // }
        // if(country) {
            
        //     params.whereField.push('country');
        //     params.whereValue.push(country);
        //     params.whereOperator.push('=');
        // }

        if(status) {
            params.whereField.push('status');
            params.whereValue.push(status);
            params.whereOperator.push('=');
        }
        // if(areaSelected) {
        //     params.whereField.push('area');
        //     params.whereValue.push(areaSelected);
        //     params.whereOperator.push('=');
        // }
        const  cycle_booking_history = await getPaginatedData(params);
      

        return resp.json({
            status     : 1,
            code       : 200,
            message    : ["cycle  Booking List fetched successfully!"],
            data       :  cycle_booking_history.data,
            total_page :  cycle_booking_history.totalPage,
            total      :  cycle_booking_history.total,
        });
    } catch (error) {
        console.error('Error fetching cycle booking list:', error);
        return resp.json({ status: 0, message: 'Error fetching cycle booking lists' });
    }
};