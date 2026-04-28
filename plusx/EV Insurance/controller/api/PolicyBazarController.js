// import db from "../config/db.js";
// import { tryCatchErrorHandler } from "../middleware/errorHandler.js";

import axios from "axios";
 
export const getTokenPolicyBazar = async (req, resp) => {
    try {
        const url = "https://apiqa.policybazaar.ae/car-consumers/token";
        const body = {
            partnerId: "PB_1049",
            username: "PlusX_Qa",
            password: "AvDD@12_26"
        };
        const headers = {
            "Content-Type"   : "application/json",
            // "Accept"         : "application/json",
            // "PB-API-VERSION" : "1.0",     // REQUIRED
            // "PB-CHANNEL-ID"  : "WEB",      // REQUIRED
            // "PB-PARTNER-ID"  : "PB_1049",  // REQUIRED
        };
        const response = await axios.post(url, body, { headers });
         
        return resp.json({ status : response.data.success, response : response.data.authorization });  

    } catch (err) {
        console.log("Error:", err.response?.data || err.message);
        return resp.json( {
            status  : 0,
            error   : err.message,
            details : err.response?.data
        });
    }
};

export const createQuote = async (req, resp) => {
    try {
        const url  = "https://apiqa.policybazaar.ae/car-consumers/quote";
        const body = {
            "name": "string",
            "email": "user@example.com",
            "mobileNumber": 0,
            "dateOfBirth": "string",        //$dd/mm/yyyy  
            "makeId": 0,                // optional
            "modelId": 0,               // optional
            "variantId": 0,         // optional  
            "cover": 0,             //car idv  
            "modelYear": 0,
            "registrationYear": 0,
            "registrationCity": 1,   //1, 2, 3, 4, 5, 6, 7, 8
            "isBrandNew": 0,
            "isSecondHand": 0,
            "isModified": 0,
            "haveOtherVehicle": 0,
            "hasMortgage": 0,
            "newPolicyStartDate": "string",  /// $dd/mm/yyyy
            "chassisNumber": "strings",         // optional
            "uaeDrivingExperience": 0,      ////////////////////////////////matched
            "internationalDrivingExperience": 0,
            "homeCountry": 0,                   ////////////////////////////////matched  as nationality
            "isClaimMade": 0,
            "previousPolicyType": 1,    ////////////////////////////////matched
            "noOfProofs": 0,            // optional [  0, 1, 2, 3, 4, 5, 6  ]
            "proofType": 0      // 0, 1, 2
        };
        const headers = {
            "Content-Type"  : "application/json",
            "authorization" : "",
        };
        const response = await axios.post(url, body, { headers });
         
        return resp.json({ status : 1, response : response.data });

    } catch (err) {
        console.log("Error:", err.response?.data || err.message);
        return resp.json( {
            status  : 0,
            error   : err.message,
            details : err.response?.data
        });
    }
};

export const getQuote = async (req, resp) => {
    try {
        const url  = "https://apiqa.policybazaar.ae/car-consumers/getQuote";
        const body = {
            "quoteId": "string",
            "getSelectedPlan": "true"
        };
        const headers = {
            "Content-Type"  : "application/json",
            "authorization" : "",
        };
        const response = await axios.post(url, body, { headers });
         
        return resp.json({ status : 1, response : response.data });

    } catch (err) {
        console.log("Error:", err.response?.data || err.message);
        return resp.json( {
            status  : 0,
            error   : err.message,
            details : err.response?.data
        });
    }
};

export const updateQuote = async (req, resp) => {
    try {
        const url  = "https://apiqa.policybazaar.ae/car-consumers/updateQuote";
        const body = {
            "quoteId"             : "string",   /// req
            "name"                : "string",
            "gender"              : 1,
            "dateOfBirth"         : "string",
            "email"               : "string",
            "durationInUae"       : "string",
            "isClaimMade"         : 0,
            "noOfProofs"          : 0,
            "homeCountry"         : 0,
            "registrationCity"    : 1,
            "mortgageBank"        : 4,
            "newPolicyStartDate"  : "string",  //$dd/mm/yyyy)
            "additionalProp1"     : {}
        };
        const headers = {
            "Content-Type"  : "application/json",
            "authorization" : "",
        };
        const response = await axios.post(url, body, { headers });
         
        return resp.json({ status : 1, response : response.data });

    } catch (err) {
        console.log("Error:", err.response?.data || err.message);
        return resp.json( {
            status  : 0,
            error   : err.message,
            details : err.response?.data
        });
    }
};