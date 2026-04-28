
import mqtt from 'mqtt';
import { insertRecord } from '../dbUtils.js';
import db from '../config/indiadb.js'
import moment from 'moment';



let mqqtClient = mqtt.connect("mqtt://supro.shunyaekai.tech:1883", {
  clientId: "mobility001",
  username:"sukarn",
  password:"123456",
  keepalive: 60,
  reconnectPeriod: 1000,
  clean: true,
});

mqqtClient.on("connect", () => {
  console.log(" Connected to MQTT broker");
  // mqqtClient.subscribe("/supro/CYCLE/#", () => {
  //   // console.log(" Subscribed to /supro/CYCLE/#");
  // });
});

//recive data from  mqqtt
/*
mqqtClient.on("message", (topic, message) => {


   const str = message.toString();
            const explode   = str.split(',');
            
            // if(str){
            //     let station_id = explode[0].trim();
            //     let cycle_id  = explode[1].trim();
            //     let lock_status = explode[2].trim();
            //     // let status    = (speed >  2) ? 'R' : 'S';
                    
           
            // if(lock_status!==2){
            //   const insert=  db.execute(`INSERT INTO locker(station_id,cycle_id,lock_status) values(?,?,?) `,[station_id,cycle_id,lock_status]);
            //     if(insert){console.log("inserted")}
            // }
            // }
  
});
*/
// /supro/plusxm/slock/a842e34083a0/lock/state

//c0cdd6cf3914
export const mqqtSuccess = (station_id,locker_id) => {
 -- console.log("mqqt -station_id,locker_id",station_id,locker_id)
      //  const current_time = moment().format("YYYY-MM-DD HH:mm:ss");
  
    return new Promise((resolve, reject) => {
        mqqtClient.publish(
            `/supro/plusxm/slock/${station_id}/${locker_id}`,
            // "/supro/CYCLE/S001",
            "ON",
            // JSON.stringify({ status: "on", time:current_time }),
            { qos: 1, retain: false },
            (err) => {
                if (err) {
                    console.error("Failed to publish:", err);
                    reject(err);
                } else {
                    // console.log(" Publish success message sent");
                    resolve(true);
                }
            }
        );
    });
};


export default mqqtClient;