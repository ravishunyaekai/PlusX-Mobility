
import mqtt from 'mqtt';
import { insertRecord, queryDB } from '../dbUtils.js';
import db from '../config/indiadb.js'
import moment from 'moment';
import { asyncHandler } from '../utils.js';



let mqqtClient = mqtt.connect("mqtt://supro.shunyaekai.tech:1883", {
  clientId: "mobility001",
  username:"sukarn",
  password:"123456",
  keepalive: 60,
  reconnectPeriod: 1000,
  clean: true,
});

mqqtClient.on("connect", () => {
 
});

//recive data from  mqqtt



//   mqqtClient.on("message", async (topic, message) => {


//    const str = message.toString();
//             const explode   = str.split(',');
            

//             if(str !=''){
//                 let locker_status = explode[0].trim();
//                 let topic_array=topic.split('/');
//                 const locker_id='lock1'; //topic_array[5];
//                 const station_id='c0cdd6cf3914';//topic_array[4].trim();

//                 console.log("recived data",locker_status);
//                 console.log("station_id:", station_id);
//                 console.log("locker_id:", locker_id);

//           // await  UpdateLocker(locker_status, station_id, locker_id)


//       }       
  
// });


//    const  UpdateLocker = async(locker_status, station_id, locker_id)=>{
//   const updateDB=await db.execute(`UPDATE locker SET lock_status = ?  , cloud_command=5    WHERE station_id = ? AND locker_id = ?`,[locker_status, station_id, locker_id]);
//   if(updateDB){
//     console.log("updated successfully status= ",locker_status)
//     return true;
//   }
// }
// /supro/plusxm/slock/a842e34083a0/lock/state

//c0cdd6cf3914
 export const mqqtSuccess = (station_id,locker_id) => {
    
 mqqtClient.publish(
            `/supro/plusxm/slock/${station_id}/${locker_id}`,
            
            "ON",
            { qos: 0, retain: false },
            
        )
        console.log("published mqqt")
        return true;
};



export const oldmqqtSuccess = (station_id, locker_id) => {
  return new Promise((resolve, reject) => {
    mqqtClient.publish(
      `/supro/plusxm/slock/${station_id}/${locker_id}`,
      "ON",
      { qos: 0, retain: false },
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(true); // broker ACK received
        }
      }
    );
  });
};
export default mqqtClient;