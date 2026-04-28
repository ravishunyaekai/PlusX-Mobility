
import mqtt from 'mqtt';
import { insertRecord } from '../dbUtils.js';
import db from '../config/indiadb.js'
import moment from 'moment';



let mqqtClient = mqtt.connect("mqtt://broker.hivemq.com:1883", {
  clientId: "mobility001",
  keepalive: 60,
  reconnectPeriod: 1000,
  clean: true,
});

mqqtClient.on("connect", () => {
  // console.log(" Connected to MQTT broker");
  mqqtClient.subscribe("/supro/CYCLE/#", () => {
    // console.log(" Subscribed to /supro/CYCLE/#");
  });
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

export const mqqtSuccess = () => {
       const current_time = moment().format("YYYY-MM-DD HH:mm:ss");
  
    return new Promise((resolve, reject) => {
        mqqtClient.publish(
            "/supro/CYCLE/S001",
            JSON.stringify({ status: "success", time:current_time }),
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