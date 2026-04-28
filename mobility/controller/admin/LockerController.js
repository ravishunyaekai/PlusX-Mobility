import { response } from "express";
import db from "../../../config/indiadb.js"
import { insertRecord, queryDB, updateRecord } from "../../../dbUtils.js";
import { asyncHandler,  EncryptToBase64, generateQRCode } from "../../../utils.js";
import validateFields from "../../../validationForAdmin.js";

export const assignLocker = asyncHandler(async(req,resp)=>{
    const {lock_number, station_id, cycle_id, cycle_device_id = '', userId } = req.body;

    const { isValid, errors } = validateFields(req.body, {
        lock_number : ["required"], 
        station_id  : ["required"],
        cycle_id    : ["required"]
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors }); 
      
    const allowedLocks = ["lock1", "lock2", "lock3", "lock4","lock5","lock6","lock7"];
    if (!allowedLocks.includes(lock_number)) {
        return resp.json({ status: 0, code: 422, message: "Invalid lock_number!" });
    }
    if (!req.user.includes("locker")) {
        return resp.json({ status: 0, code: 422, message: "You don`t have permission to access this resource" });
    }
    const locker_check = await queryDB(`
        SELECT id 
        FROM cycle_locker 
        Where ${lock_number} = 1 and station_id = ? `, [ station_id ] 
    );
    if(!locker_check){ 
        return resp.json({ status:1, code:400, message:"The cycle is not locked in the locker yet." })
    }
    const station_check = await queryDB(`SELECT EXISTS(SELECT id FROM cycle_locker WHERE station_id = ?) AS existed_station `, [ station_id ] );
            
    if( station_check.existed_station == 0 ) {
        return resp.json({ status:1, code:400, message:"Locker details are missing. Please add them first!" })
    }  
    const cycle_station_wise = await queryDB(`SELECT id from cycle_list where station_id = ? and lock_number = ? `, [ station_id, lock_number ] );

    if( cycle_station_wise ) {
        return resp.json({ status:1, code:400, message:"This locker is already occupied." })
    }
    const cycle_check = await queryDB(`SELECT lock_number, cycle_device_id, created_by from cycle_list where cycle_id=? `, [ cycle_id ] );
       
    await insertRecord('db_logs',
        ['table_name', 'action_type', 'user_type', 'created_by', 'changed_data'],
        ["cycle_list", "updated locker for cycle", 'admin', userId,
            {
                lock_number     : cycle_check.lock_number,
                cycle_device_id : cycle_check.cycle_device_id,
                old_userID      : cycle_check.created_by
            }
        ]
    ); //cycle_locker
    const updtCycle = await updateRecord(
        "cycle_list", { lock_number, cycle_device_id }, ['cycle_id'], [cycle_id]
    );
    if( !updtCycle ) {
        return resp.json({ status : 1, code : 200, message : "Locker could not be assigned" })
    }
    const locker_qr_check = await queryDB(`
        SELECT id 
        FROM locker_qr_image 
        WHERE lock_number = ? and station_id = ? limit 1 `, [lock_number, station_id]
    );      
    if(!locker_qr_check){
        const forQr_code = EncryptToBase64(`${station_id}/${lock_number}`)
        const qr_image   = await generateQRCode (`${forQr_code}`);
        await db.execute(`INSERT INTO locker_qr_image SET station_id=?, lock_number = ?, qr_image = ? `,[station_id, lock_number, qr_image]);
    }
    return resp.json({
        status  : 1,
        code    : 200,
        message : "The cycle has been locked in the given locker successfully",
    });
});


export const addSolenoidId = asyncHandler(async(req,resp)=>{
    const {gateway_id='', locker_id, solenoid_id, station_id, userId}=req.body;
    const { isValid, errors } = validateFields(req.body, {
        locker_id: ["required"] , solenoid_id:["required"],station_id :["required"]
    });
    if (!isValid) {   return resp.json({ status: 0, code: 422, message: errors });}
    if (!req.user.includes("locker")) {
        return resp.json({ status: 0, code: 422, message: "You don't have permission to access this resource" });
    }
    const station_check= await queryDB(`
        SELECT created_by, gateway_id, locker_id, solenoid_id 
        FROM cycle_locker 
        WHERE station_id = ? `,[station_id]
    );
    if(!station_check){
        return resp.json({ status : 1, code : 400, message : "Locker not found for this station" }) ;
    }
   
    const lock_numbers = ["lock1", "lock2", "lock3", "lock4","lock5","lock6","lock7"];
    const [locker_qr]  = await db.execute(`SELECT id from locker_qr_image  where station_id=? `,[station_id]);

    if(locker_qr.length !== lock_numbers.length ) {
        
        for (const lock of lock_numbers) {

            const forQr_code = EncryptToBase64(`${station_id}/${lock}`)
            const qr_image   = await generateQRCode (`${forQr_code}`);
            await db.execute(`INSERT INTO locker_qr_image SET station_id=?, lock_number=?, qr_image=?`,[station_id, lock, qr_image]);
        }
    }
    insertRecord('db_logs', ['table_name','action_type','user_type','created_by','changed_data'],
        ["locker_qr_image", "updated gateway_id", 'admin', userId,
            {
                gateway_id  : station_check.gateway_id,
                locker_id   : station_check.locker_id,
                solenoid_id : station_check.solenoid_id,
                old_userID  : station_check.created_by,
                station_id  : station_id    
            }
        ]
    );
    updateRecord('cycle_locker',{gateway_id,locker_id,solenoid_id,created_by:userId},['station_id'],[station_id]);
    return resp.json({ status:1, code:200, message:"Gateway Information Updated successfully!" });   
});

export const assignLockTobooking = asyncHandler(async(req,resp)=>{
    const {lock_number, cycle_id, userId, station_id, booking_id, userID } = req.body;
    const { isValid, errors } = validateFields(req.body, {
        booking_id  : ["required"],
        station_id  : [" is required"],
        lock_number : ["required"] ,
        cycle_id    : ["required"]
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors }); 
     
    const allowedLocks = ["lock1", "lock2", "lock3", "lock4","lock5","lock6","lock7"];
    if (!allowedLocks.includes(lock_number)) {
        return resp.json({ status: 0, code: 422, message: "Invalid lock_number!" });
    }
    if (!req.user.includes("locker")) {
        return resp.json({
            status  : 0,
            code    : 422,
            message : "You don`t have permission to access this resource"
        });
    }
    const cycle_check = await queryDB(`
        SELECT lock_number, station_id, created_by 
        from cycle_list 
        where cycle_id = ? `, [ cycle_id ] 
    ); 
    const station_check = await queryDB(`SELECT EXISTS(SELECT id FROM cycle_locker WHERE station_id = ?) AS existed_station`, [ station_id ] );
            
    if(station_check.existed_station==0){
        return resp.json({ status:1, code:400, message:"Locker details are missing. Please add them first!"});
    }  
    const cycle_station_wise = await queryDB(`
        SELECT id 
        FROM cycle_list 
        where station_id = ? and lock_number = ? `, [station_id, lock_number ] 
    );
    if(cycle_station_wise){
        return resp.json({ status:1, code:400, message:"This locker is already occupied.", })
    }
    const locker_check = await queryDB(`
        SELECT id 
        FROM cycle_locker 
        Where ${lock_number} = 1 and station_id = ? `, [ station_id ] 
    );
    if(!locker_check){
        return resp.json({ status:1, code:400, message:"The cycle is not locked in the locker yet.", })
    }
    const station = await queryDB(`SELECT station_name from mobility_station_list where station_id=?  `,[station_id]);

    await insertRecord('db_logs',
        ['table_name', 'action_type', 'user_type', 'created_by', 'changed_data'],
        ["handover_cycle", "updated locker for cycle manually", 'admin', userId,
            {
                lock_number      : cycle_check.lock_number,
                old_userID       : userId,
                handover         : "manual",
                handover_station : station.station_name
            }
        ]
    )
    const update_cycle_list = await updateRecord("cycle_list",{lock_number,station_id},['cycle_id'],[cycle_id]);
    if(!update_cycle_list){
        return resp.json({ status:1, code:200, message:"Locker does not found! ", })
    }
    await updateRecord(
        "cycle_booking", {lock_number,hand_over_station:station.station_name}, ['booking_id'], [booking_id]
    );
    return resp.json({
        status  : 1,
        code    : 200,
        message : "The locker has been successfully assigned.",
    });
})

export const availableLocker = asyncHandler(async(req,resp)=>{
    const { station_id, userId } = req.body;
    const { isValid, errors } = validateFields(req.body, {station_id: ["required"] });
    if (!isValid) { return resp.json({ status: 0, code: 422, message: errors });}
      
    const [locker_list] = await db.execute(`
        SELECT lock_number 
        FROM cycle_list
        WHERE station_id = ?`, [ station_id ] 
    );
    const allowedLocks   = ["lock1", "lock2", "lock3", "lock4","lock5","lock6","lock7"];
    const usedLocks      = locker_list.map(row => row.lock_number);
    const availableLocks = allowedLocks.filter(lock=>!usedLocks.includes(lock))

    const availableLockerOptions = availableLocks.map(lock=>({
        label : `Lock ${lock.replace("lock","")}`,
        value : lock
    }));
    return resp.json({
        status  : 1,
        code    : 200,
        data    : availableLockerOptions,
        message : "The locker has been successfully assigned.",
    });
})