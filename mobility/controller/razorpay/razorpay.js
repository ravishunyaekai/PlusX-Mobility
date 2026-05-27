import crypto from "crypto";
import axios from "axios";
// import * as RazorpayLib from "razorpay";
// const Razorpay = RazorpayLib.default || RazorpayLib;
import Razorpay from "razorpay";
import { NOTIFICATION_CONTENT } from "../../../common/controller/notificationContent.js";
import { asyncHandler, generateRandomCode, mergeParam } from "../../../utils.js";
import { formatFloatInQuery, insertRecord, queryDB, updateRecord } from "../../../dbUtils.js";
import moment from "moment";
import  db  from "../../../config/indiadb.js";
import validateFields from "../../../validation.js";
import emailQueue from "../../../emailQueue.js";
// import cards from "razorpay/dist/types/cards.js";

export const verifyPaymentByOrderId = async (order_id) => {
  try {
    const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
   if (!order_id) {
      console.log(" Missing order_id in verifyPaymentByOrderId");
      return false;
    }
    // Fetch all payments associated with this order
    const payments = await razorpay.orders.fetchPayments(order_id);

    if (!payments.items.length) {
      console.log(" No payments found for order:", order_id);
      return false;
    }

    // Check if any payment is successfully captured
    const successfulPayment = payments.items.find(p => p.status === "captured");

    if (successfulPayment) {
      console.log(" Payment captured for order:", order_id);
      return {
        success: true,
        payment_id: successfulPayment.id,
        method: successfulPayment.method,
        amount: successfulPayment.amount / 100,
        email: successfulPayment.email,
      };
    } else {
      console.log(" Payment not captured yet for order:", order_id);
      return false;
    }
  } catch (err) {
    console.error("Error verifying payment via order ID:", err);
    return false;
  }
};

export const verifyPayment = async (payment_id) => {
  // try {
    const razorpay = new Razorpay({ 
      key_id: process.env.RAZORPAY_KEY_ID, 
      key_secret: process.env.RAZORPAY_KEY_SECRET 
    });

    

    const payment = await razorpay.payments.fetch(payment_id);

    if (!payment || payment.status !== "captured" || !payment.captured) {

      return false;
    }

    return true;
  // } catch (error) {
  //   console.error("Razorpay verifyPayment error:", error);
  //   return false;
  // }
};
export const oldverifyPayment = async (payment_id, order_id, razorpay_signature) => {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    // Verify signature
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(order_id + "|" + payment_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      console.error("Invalid payment signature");
      return false;
    }

    // Fetch payment details
    const payment = await razorpay.payments.fetch(payment_id);

    if (!payment || payment.status !== "captured" || !payment.captured) {
      console.error("Payment not captured or failed");
      return false;
    }

    return true;
  } catch (err) {
    console.error("Razorpay verifyPayment error:", err);
    return false;
  }
};

export const oldcreateOrder = async (req, resp) => {
    try {
       const { amount ,rider_id} = req.body; // amount in paise
       const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

 const rider=await queryDB(`SELECT customer_id ,rider_email, rider_name, rider_mobile
       from riders   
         where  rider_id= ? `,[rider_id]);
         let customer_id;
         console.log("rider.customer_id",rider.customer_id);
         if(rider.customer_id!='' || rider.customer_id!=null ){
         
            customer_id=  rider.customer_id;
  
  }

        
  const customer = await razorpay.customers.create({
      name:rider.rider_name,
      email:rider.rider_email,
      contact:rider.rider_mobile,
      fail_existing: false, // true will return existing if same email/contact
      notes: {
        purpose: "Card Tokenization Setup"
      }
    });
     customer_id=customer.customer_id;
     console.log("customer_id",customer_id)

      const options = {
            amount: Number(amount)*100,   // e.g., 50000 paise = ₹500
            currency: "INR",
            receipt: "receipt_" + Date.now(),
            payment_capture: 1, // auto-capture payment,
            customer_id:customer_id
        };  
    
        
       

        const order = await razorpay.orders.create(options);
        resp.json({ status: 1, key: process.env.RAZORPAY_KEY_ID, order_id: order.id });
    } catch (error) {
        console.error(error);
        resp.json({ status: 0, message: "Order creation failed" });
    }
};

export const vcreateOrder = async (req, res) => {
  try {
    const { rider_id, amount, currency = "INR" } = req.body;

    // Step 1: Fetch rider details
    const rider = await queryDB(`SELECT rider_name, rider_email, rider_mobile, customer_id
       FROM riders WHERE rider_id = ?`, [rider_id]);
    if (!rider) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }
     const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    let customerId = rider.razorpay_customer_id;

    // Step 2: If no Razorpay customer ID, create new customer
    if (!customerId) {
      const customer = await razorpay.customers.create({
        name: rider.rider_name,
        email: rider.rider_email,
        contact: rider.rider_mobile,
        fail_existing: true, // will return existing if same email/contact
        notes: {
          purpose: "Card Tokenization / Order Payment",
        },
      });

      customerId = customer.id;
console.log("customerId",customerId)
      // Step 3: Save Razorpay customer ID in your database
      await updateRecord(
        "riders",
        { customer_id: customerId },
        ["rider_id"],
        [rider_id]
      );
    }

    // Step 4: Create Razorpay order
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // in paise
      currency,
      receipt: `order_rcpt_${Date.now()}`,
      notes: {
        rider_id,
        rider_email: rider.rider_email,
      },
      customer_id: customerId, // optional but useful for linking
    });

    // Step 5: Return order details
    return res.json({
      success: true,
      order_id: order.id,
      customer_id: customerId,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    return res.status(500).json({
      success: false,
      message: error.error?.description || error.message,
    });
  }
};
export const createOrder = async (req, res) => {
  try {
    const { rider_id, amount, } = req.body;

    //  Get rider info
    const rider = await queryDB("SELECT * FROM riders WHERE rider_id = ?", [rider_id]);
    if (!rider) return res.status(404).json({ success: false, message: "Rider not found" });

    let customerId = rider.customer_id;
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

    //  If not exist in DB → Create or fetch from Razorpay
    if (!customerId) {
      try {
        const customer = await razorpay.customers.create({
          name: rider.rider_name,
          email: rider.rider_email,
          contact: rider.rider_mobile,
          fail_existing: true, // tell Razorpay to prevent duplicate
          notes: { purpose: "Card Tokenization Setup" },
        });

        customerId = customer.id;
        await updateRecord("riders", { customer_id: customerId }, ["rider_id"], [rider_id]);

      } catch (err) {
        //  Handle “already exists” case
        if (err.error?.description?.includes("Customer already exists")) {
          // Fetch customer list (Razorpay doesn’t give direct fetch-by-email API)
          const customers = await razorpay.customers.all({ email: rider.rider_email });
          if (customers?.items?.length > 0) {
            customerId = customers.items[0].id;

            // save in DB for future reuse
            await updateRecord("riders", { customer_id: customerId }, ["rider_id"], [rider_id]);
          } else {
            throw new Error("Customer exists but could not fetch existing record from Razorpay");
          }
        } else {
          throw err; // rethrow other errors
        }
      }
    }

    // Create order
    const order = await razorpay.orders.create({
      // amount: Math.round(amount * 100),
      amount: amount*1000,
      currency:"INR",
      receipt: `receipt_${Date.now()}`,
      notes: { rider_id, rider_email: rider.rider_email },
      // customer_id: customerId,
       notes: { rider_id, purpose: "Tokenized card payment" },
      payment_capture: 1,
    });
      return res.json({
            status: 1,
            code:200,
            order_id: order.id,
            customer_id: customerId,
            amount: amount,
            currency: order.currency,
          });
   

  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    return res.status(500).json({
      success: false,
      message: error.error?.description || error.message,
    });
  }
};
export const addmoneyINWallet = asyncHandler(async(req,resp)=>{
    const { rider_id, amount } = mergeParam(req);
    const numericAmount = parseFloat(amount);    
    const { isValid, errors } = validateFields(mergeParam(req), { 
        rider_id : ["required"],
        amount   : ["required"]
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors }); 
    if(amount < 1 ) return resp.json({ status: 0, code: 422, message: ["Amount can be less than 1 INR"] });
    
    const receipt = `${numericAmount}_RS_by_${rider_id}_${moment().format("YY-MM-DD_HH:mm:ss")}`;
    const rider   = await queryDB(`
        SELECT 
            r.amount, r.out_standing_cost, ${formatFloatInQuery('cn.min_wallet_price ')} as min_wallet_price
        FROM riders r
        JOIN country cn on cn.country_id = r.country_id   
        Where r.rider_id = ?  `, [ rider_id ] 
    );         
    console.log("---------",rider.min_wallet_price)
        console.log("---------",rider.amount)

    console.log(numericAmount)
    const minWallet = parseFloat(rider.min_wallet_price || 200);
    const seqamount = parseFloat(rider.amount || 0);
    //const amounts = 30
    const effectiveBalance =   parseFloat((minWallet - seqamount).toFixed(2));
        console.log(effectiveBalance)

console.log(numericAmount < effectiveBalance)
    if (numericAmount < effectiveBalance) {
        return resp.json({
            status: 0,
            code: 200,
            message: [
            `Minimum wallet balance is ₹${minWallet}. Your current balance is ₹${seqamount.toFixed(2)}.  Please add ₹${effectiveBalance.toFixed(2)} more to continue.`
            ]
        });
    }

   //  if( numericAmount < rider.min_wallet_price ) { 
   //      return resp.json({ 
   //          status  : 0, 
   //          code    : 200, 
   //          message : [`Minimum required balance is ₹${rider.min_wallet_price}. Kindly add money to your wallet to continue.`]
   //      });
   //  }   
   //  const out_standing_cost = parseFloat(rider.out_standing_cost);
   //  if( numericAmount < out_standing_cost ) {
   //      return resp.json({
   //          status  : 0,
   //          code    : 200, 
   //          message : [`Your outstanding balance is ${out_standing_cost.toFixed(2)}. Kindly make the payment first.`]
   //      })
   //  }

    const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET});

    const order = await razorpay.orders.create({
        amount   : Math.round(Number(numericAmount) * 100), // in paise
        currency : "INR",
        receipt ,
        notes : {
            rider_id     : rider_id.toString(),
            booking_type : "MOBILITY",
            amount       : Number(numericAmount)
        }
    });
    // if(!insert_transacstion){resp.json({status:0,code:400,message:["payment was not completed!"]}) }
      
    const customer_id = await createCustomer(rider_id)
     
    resp.json({
        status  : 1,
        code    : 200,
        orderId : order.id,
        customer_id,
        message  : ["Order Created successfully"],
        amount   : numericAmount,
        currency : "INR",
        key_id   : process.env.RAZORPAY_KEY_ID
    });
});

 
export const Paymentsucceed = asyncHandler( async ( req, resp ) => {
     
    const { rider_id, payment_id, razorpay_signature, razorpay_order_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), { 
        rider_id           : ["required"],
        payment_id         : ["required"],
        razorpay_signature : ["required"],
        razorpay_order_id  : ["required"],
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
 
    const checkTransaction = await queryDB(`
        SELECT amount, current_balance
        FROM transaction_history
        WHERE payment_id = ? AND status = ? `, [payment_id, "CNF"]
    );
    if(checkTransaction) {
        return resp.json({
            status        : 1,
            code          : 200,
            wallet_amount : checkTransaction.current_balance,
            message       : [`Payment of ${(parseFloat(checkTransaction.amount)).toFixed(2)} INR Completed successfully`],
        });
    }
    const generated_signature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(razorpay_order_id + "|" + payment_id)
        .digest("hex");
 
    const razorpay = new Razorpay({ 
        key_id: process.env.RAZORPAY_KEY_ID, 
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    const payment  = await razorpay.payments.fetch(payment_id);
    let paidAmount = payment.amount / 100; 
  
    if (generated_signature !== razorpay_signature) {
        return resp.json({status: 1, code:400, message:["Invalid payment signature"],})
    } 
    if( !payment ) {
      return resp.json({status: 1, code:400, message:["invalid Payment"],})
    }
    if( payment.status !== "captured" ) {
        return resp.json({status: 0, code:400, message:["Payment not captured"],})
    }
    const riders = await queryDB(`
        SELECT r.amount, r.out_standing_cost, r.rider_name, r.rider_email, c.min_wallet_price, cb.booking_id
        FROM riders r JOIN country c ON r.country_code = c.country_code
        LEFT JOIN cycle_booking cb 
        ON cb.booking_id = (
            SELECT booking_id 
            FROM cycle_booking 
            WHERE rider_id = r.rider_id
            ORDER BY created_at DESC 
        LIMIT 1)
       WHERE r.rider_id = ?`, [rider_id]
    );
 
    let outstandingAmount = parseFloat(riders.out_standing_cost || 0);
    let out_standing_cost = parseFloat(0);
    let riderAmount       = parseFloat(riders.amount);
    let paymentAmount     = parseFloat(riders.min_wallet_price);
 
    let orderIdToSave = razorpay_order_id;
    if ( riderAmount < paymentAmount ) {
        riderAmount = riderAmount + paidAmount; 
        orderIdToSave = riders.booking_id;   
    }   
 
    let queryParams = `amount = ?, out_standing_cost = 0 `; 
               
    let query = `UPDATE riders SET  ${queryParams} WHERE rider_id = ?`;
    const update_rider = await db.execute( query, [riderAmount, rider_id]);
        
    if(!update_rider) return resp.json({ status : 0, code : 400, message : ["Amount was not added on wallet!"]});
        
        
    await insertRecord('transaction_history', 
        [
            'rider_id', 'amount', 'payment_type', 'order_id', "outstanding", "current_balance",
            "prev_balance", "status", "payment_id",
        ], [
            rider_id, paidAmount, 'debt',  orderIdToSave, out_standing_cost, riderAmount, 
            riders.amount, "CNF", payment_id, 
        ]
    ); 

    
    return resp.json({
        status        : 1,
        code          : 200,
        wallet_amount : riderAmount,
        message       : [`Payment of ${(paidAmount).toFixed(2)} INR Completed successfully`],
    });
    
}); 


// export const verifyPayment=async(payment_id)=> {
 
//     const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET});

//   const payment = await razorpay.payments.fetch(payment_id);
//    if(!payment){
//       // resp.json({status: 1, code:400, message:["invalid Payment"],})
//       return false
      
//     }
//     if(payment.status !== "captured"){
//       return false
    
//     }
//     return true
// }



export const addCardToCustomer = asyncHandler(async (req, resp) => {
  
    const {rider_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), { rider_id: ["required"] });

  if (!isValid) {  return resp.json({ status: 0, code: 422, message: errors });}

   

    const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET});
    const riders=await queryDB('SELECT   rider_mobile ,rider_name , rider_email, customer_id from riders where rider_id=?',[rider_id]);
      
     try{
       
        const customer_id=await createCustomer(rider_id)
       
      const order = await razorpay.orders.create({
      amount: 100,
      currency:"INR",
      receipt: `receipt_${Date.now()}`,
      customer_id: customer_id,
       notes: { rider_id:rider_id, purpose: "Tokenized card || UPI payment" },
          // purpose: payment_method === "upi" ? "UPI payment" : "Tokenized card payment",

      payment_capture: 1,
    });
     return resp.json({
      status: 1,
      code: 200,
      message: ["Order created successfully"],
      customer_id: customer_id,
      order_id:order.id,
      amount: 1,
      key_id: process.env.RAZORPAY_KEY_ID,
      
    });
     
  }catch(error){
    console.log(error)
  }
  
});

export const saveCardToken = asyncHandler(async (req, resp) => {
  
    const { payment_id, customer_id, rider_id } = mergeParam(req);

    const { isValid, errors } = validateFields({ payment_id, customer_id, rider_id }, {
      rider_id: ["required"],
      payment_id: ["required"],
      customer_id: ["required"],
    });

    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    // Step 1: Fetch payment details
    const payment = await razorpay.payments.fetch(payment_id);
    const { token_id } = payment;
     if (payment.status !== "captured") {
      return resp.json({
        status: 0,
        code: 200,
       message: [`Payment not captured! `],
      });
     }
    //  if (payment_method === "upi") {
   if (payment.method === "upi") {
      const vpa=payment.upi?.vpa;
      
       const rider_upi=await queryDB('SELECT id from upi_list where rider_id=? and vpa=?',[rider_id,vpa]);
       
       if(rider_upi){
  return resp.json({status:1, code:200, message:["This upi is already added!"]});

       }

    await insertRecord("upi_list",["rider_id", "vpa"],
      [rider_id,vpa]);
  return resp.json({status:1, code:200, message:["UPI added successfully"],upi: payment.upi?.vpa });

   }  

// }


      const token = await razorpay.customers.fetchToken(customer_id, token_id);
       if(!token){  resp.json({
       status: 0, code: 400,
       message: "Could not fetch the saved card details. Please try again later."

       }) }

    if (!token_id) {
      return resp.json({ status: 0, code: 400, message: ["No token found in payment"] });
    }
      const card = token.card;

    return resp.json({
      status: 1,
      code: 200,
      message: ["Card saved successfully!"],
      data: {
        token_id: token.id,
        last4: card.last4,
        network: card.network,
        type: card.type,
        expiry_month: card.expiry_month,
        expiry_year: card.expiry_year,
      },
    });

  
});




export const payWithSavedCard = asyncHandler(async (req, res) => {
  
    const { amount,order_id, customer_id, token_id,rider_id } = req.body;
   
     const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
       });
       console.log("",razorpay.payments)
      //  console.log(typeof razorpay.payments.createRecurringPayment);
       const tokens = await razorpay.customers.fetchTokens(customer_id);
       console.log("tokens",tokens)
       const activeCardTokens = tokens.items.filter(
  t => t.method === "card" && t.status === "active"
);
     console.log("Active tokenized cards:", activeCardTokens);



    //  const payment = await razorpay.payments.createRecurringPayment({
    //   amount: Number(amount) * 100, // in paise
    //   currency: "INR",
    //   customer_id,
    //   token: token_id,
    //   order_id,
    //   method: "card",
    // });

    res.json(payment);
  
});
export const v1razorpaycardList = asyncHandler(async (req, resp) => {
  
    const { rider_id,payment_method='' } = mergeParam(req)
     const { isValid, errors } = validateFields(mergeParam(req), {
       rider_id: ["required"]
      });

  if (!isValid) {  return resp.json({ status: 0, code: 422, message: errors });}

    

     const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
       });
        const customer_id=await createCustomer(rider_id)
        

   const paycardsRes =await razorpay.customers.fetchTokens(customer_id)
   
  const rawCards = (paycardsRes.items || [])
  // keep only active tokens
  .filter(token => token.status === 'active' )
  .map(token => ({
    customer_id: customer_id,
    token_id: token.id,
    last4: token.card?.last4,
    network: token.card?.network,
    card_type: token.card?.type,
    status: token.status
  }));

// Step 2: Remove duplicates by (last4 + network + card_type)
const seen = new Set();
const paycards = rawCards.filter(card => {
  const key = `${card.last4}_${card.network}_${card.card_type}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

if(payment_method="upi"){


const seenVpa = new Set();

const uniqueUpiList = (paycardsRes.items || [])
  .filter(token => token.method === 'upi' && token.status === 'active')
  .filter(token => {
    const vpa = token.upi?.vpa;
    if (!vpa || seenVpa.has(vpa)) return false;
    seenVpa.add(vpa);
    return true;
  })
  .map(token => ({
    customer_id: customer_id,
    token_id: token.id,
    vpa: token.upi.vpa,
    status: token.status
  }));

  return resp.json({
      status: 1,
      code: 200,
      message: ["UPi  fetched successfully"],
      data:uniqueUpiList||[],
    });

} 
    return resp.json({
      status: 1,
      code: 200,
      message: ["Cards fetched successfully"],
      data: paycards,
    });

  
});
//14-nov

export const old1razorpaycardList = asyncHandler(async (req, resp) => {
  
    const { rider_id,payment_method } = mergeParam(req)
     const { isValid, errors } = validateFields(mergeParam(req), {
       rider_id: ["required"]
      });
      console.log("payment_method",payment_method)

  if (!isValid) {  return resp.json({ status: 0, code: 422, message: errors });}
      if(payment_method==="upi"){
        const [upis]=await db.execute('SELECT vpa as upi from upi_list where rider_id=?',[rider_id]);
        console.log("upis",upis)
          return resp.json({
      status: 1,
      code: 200,
      message: ["UPIS fetched successfully"],
      data: upis,
    });

      }
    

     const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
       });
      const customer_id=await createCustomer(rider_id)
        // console.log("customer_id",customer_id)

   const paycardsRes =await razorpay.customers.fetchTokens(customer_id)
   
  const rawCards = (paycardsRes.items || [])
  // keep only active tokens
  .filter(token => token.status === 'active' || token.status !== 'active')
  .map(token => ({
    customer_id: customer_id,
    token_id: token.id,
    last4: token.card?.last4,
    network: token.card?.network,
    card_type: token.card?.type,
    status: token.status
  }));

// Step 2: Remove duplicates by (last4 + network + card_type)
const seen = new Set();
const paycards = rawCards.filter(card => {
  const key = `${card.last4}_${card.network}_${card.card_type}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});


// console.log("paycards",paycards)
    return resp.json({
      status: 1,
      code: 200,
      message: ["Cards fetched successfully"],
      data: paycards,
    });

  
});
export const razorpaycardList = asyncHandler(async (req, resp) => {
  
    const { rider_id,payment_method="all" } = mergeParam(req)
     const { isValid, errors } = validateFields(mergeParam(req), {
       rider_id: ["required"]
      });


  if (!isValid) {  return resp.json({ status: 0, code: 422, message: errors });}
                let response_data={
                status: 1,
                code: 200,
                  message: ["details fetched successfully"],

                }; 
                const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });

  const customer_id = await createCustomer(rider_id);
// let cards = [];
// let upis = [];
       switch(payment_method)
       {
        case "upi" :
        { const [upis]=await db.execute('SELECT vpa as upi from upi_list where rider_id=?',[rider_id]);
                // response_data={upis};
                response_data.upis=upis;
                console.log("response_data",response_data)
                 break;
                }
         case "cards":
          {
             const paycardsRes =await razorpay.customers.fetchTokens(customer_id)
   
        const rawCards = (paycardsRes.items || [])
        // keep only active tokens
        .filter(token => token.status === 'active' || token.status !== 'active')
        .map(token => ({
          customer_id: customer_id,
          token_id: token.id,
          last4: token.card?.last4,
          network: token.card?.network,
          card_type: token.card?.type,
          status: token.status
        }));

      // Step 2: Remove duplicates by (last4 + network + card_type)
      const seen = new Set();
      const paycards = rawCards.filter(card => {
        const key = `${card.last4}_${card.network}_${card.card_type}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      
      // response_data={cards:paycards}
       response_data.cards=paycards;
      
         break;
        }
      default:

   {
    const paycardsRes =await razorpay.customers.fetchTokens(customer_id)
   
        const rawCards = (paycardsRes.items || [])
        // keep only active tokens
        .filter(token => token.status === 'active' || token.status !== 'active')
        .map(token => ({
          customer_id: customer_id,
          token_id: token.id,
          last4: token.card?.last4,
          network: token.card?.network,
          card_type: token.card?.type,
          status: token.status
        }));

      // Step 2: Remove duplicates by (last4 + network + card_type)
      const seen = new Set();
      const paycards = rawCards.filter(card => {
        const key = `${card.last4}_${card.network}_${card.card_type}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

       const [upis]=await db.execute('SELECT vpa as upi from upi_list where rider_id=?',[rider_id]);
        //  response_data = { cards:paycards , upis };
        response_data.upis=upis;
        response_data.cards=paycards;
   }

    break;
       }

         return resp.json(response_data);

    //     return resp.json({
    //   status: 1,
    //   code: 200,
    //   message: ["details fetched successfully"],
    // // data: response_data
    // cards,
    // upis
    // });

});

export const oldrazorpaycardList = asyncHandler(async (req, resp) => {
  const { rider_id, payment_method = "both" } = mergeParam(req);

  const { isValid, errors } = validateFields({ rider_id }, {
    rider_id: ["required"]
  });

  if (!isValid) {
    return resp.json({ status: 0, code: 422, message: errors });
  }
        const customer_id=await createCustomer(rider_id)
console.log("customer_id",customer_id)

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });

  const tokensRes = await razorpay.customers.fetchTokens(customer_id);
  const tokens = tokensRes.items || [];

  /* =======================
     CARDS
     ======================= */
  let cards = [];
  if (payment_method === "card" || payment_method === "both") {
    const seen = new Set();

    cards = tokens
      .filter(t => t.method === "card" && t.status === "active")
      .map(t => ({
        customer_id,
        token_id: t.id,
        last4: t.card?.last4,
        network: t.card?.network,
        card_type: t.card?.type,
        status: t.status
      }))
      .filter(card => {
        const key = `${card.last4}_${card.network}_${card.card_type}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  /* =======================
     UPI
     ======================= */
  let upi = [];
  if (payment_method === "upi" || payment_method === "both") {
    const seenVpa = new Set();

    upi = tokens
      .filter(t => t.method === "upi" && t.status === "active")
      .filter(t => {
        const vpa = t.upi?.vpa;
        if (!vpa || seenVpa.has(vpa)) return false;
        seenVpa.add(vpa);
        return true;
      })
      .map(t => ({
        customer_id,
        token_id: t.id,
        vpa: t.upi.vpa,
        status: t.status
      }));
  }

  return resp.json({
    status: 1,
    code: 200,
    message: ["Payment methods fetched successfully"],
    data: {
      ...(payment_method === "card" ? { cards } : {}),
      ...(payment_method === "upi" ? { upi } : {}),
      ...(payment_method === "both" ? { cards, upi } : {})
    }
  });
});


export const deleteCard = asyncHandler(async (req, resp) => {
  
    const {  token_id,rider_id,upi } =mergeParam(req);
    
     const { isValid, errors } = validateFields(mergeParam(req), {
       rider_id: ["required"],
      //  upi     : ["required"]
      });
 console.log("",mergeParam(req))
  if (!isValid) {  return resp.json({ status: 0, code: 422, message: errors });}
   
  if (typeof upi !== "undefined" && upi !== null && upi !== "") {

     console.log("upi process")
      const delete_upi=await db.execute("DELETE FROM upi_list where rider_id=? and vpa=?",[rider_id,upi]);
      if(delete_upi) 
        {

          return resp.json({
      status: 1,
      code: 200,
      message: ["UPI deleted successfully"],
        });}
    }else if(!upi){
      console.log("card remvoe  process")

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
     const riders=await queryDB(`SELECT   customer_id 
      from riders where rider_id= ? limit 1`,[rider_id]);
  try {
    // const response = await razorpay.customers.deleteToken(riders.customer_id, token_id);
     const token = await razorpay.customers.fetchToken(riders.customer_id, token_id);
    if (!token || !token.card) return false;

    const fingerprint = token.card.fingerprint || `${token.card.network}_${token.card.last4}`;

    //  Get all tokens from Razorpay for that customer
    const tokensRes = await razorpay.customers.fetchTokens(riders.customer_id);
    const matchingTokens = (tokensRes.items || []).filter(
      t => (t.card?.fingerprint || `${t.card?.network}_${t.card?.last4}`) === fingerprint
    );

    //  Delete all matching tokens from Razorpay
    for (const t of matchingTokens) {
      await razorpay.customers.deleteToken(riders.customer_id, t.id);
    }

    // const deleteCard=db.execute("DELETE from rider_cards where token_id=?",[token_id]);
    //  if( !response){ //!deleteCard ||
    //   return resp.json({
    //       status: 0,
    //       code: 201,
    //       message: ["Card was not deleted !"],
    //     });
    // }
        return resp.json({
      status: 1,
      code: 200,
      message: ["Card deleted successfully"],
        });
  }catch (error) {
    console.error(" Error deleting token:", error);
    throw error;
  }
    }
     
     

   


    
  
});







export const oldcreateCustomer= async(rider_id)=>{
  const rider = await queryDB("SELECT customer_id, rider_name, rider_email, rider_mobile  FROM riders WHERE rider_id = ?", [rider_id]);
    if (!rider) return false;

   let customerId = rider.customer_id;
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

    if (!customerId || customerId=='') {
      try {

        const customer = await razorpay.customers.create({
          name: rider.rider_name,
          email: rider.rider_email.toLowerCase(),
          contact: rider.rider_mobile,
          fail_existing: true, // tell Razorpay to prevent duplicate
          
        });
        

        customerId = customer.id;
      
       

        await updateRecord("riders", { customer_id: customerId }, ["rider_id"], [rider_id]);
        return customerId;

      } catch (err) {
        // Handle “already exists” case
        console.log("customer already exist",err)
      
      }
    }
   
    return customerId;
}

export const createCustomer = async(rider_id)=>{
    const rider = await queryDB(`
        SELECT 
            customer_id, rider_name, rider_email, rider_mobile
        FROM riders 
        WHERE rider_id = ?`, [rider_id]
    );
    if (!rider) return false;

    let customerId = rider.customer_id;
    const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    if ( customerId ) {
        return customerId;

    } else {
        try {
            const customers        = await razorpay.customers.all({ count: 100 });
            const existingCustomer = customers.items.find(c => c.email?.toLowerCase() === rider.rider_email.toLowerCase() && c.contact === rider.rider_mobile );

            if (existingCustomer) {
                await updateRecord("riders", { customer_id: existingCustomer.id }, ["rider_id"], [rider_id]);
                return  customerId = existingCustomer.id;

            } else { 
                const customer = await razorpay.customers.create({
                    name          : rider.rider_name,
                    email         : rider.rider_email.toLowerCase(),
                    contact       : rider.rider_mobile,
                    fail_existing : true, // tell Razorpay to prevent duplicate
                });
                await updateRecord("riders", { customer_id: customer.id }, ["rider_id"], [rider_id]);
                return customer.id;
            }
        } catch (err) {
            // Handle “already exists” case
            console.log("customer already exist",err)
        }
    }
    return customerId;
}


export const newcreateCustomer= async(rider_id)=>{
  const rider = await queryDB("SELECT customer_id, rider_name, rider_email, rider_mobile  FROM riders WHERE rider_id = ?", [rider_id]);
    if (!rider) return false;

   let customerId = rider.customer_id;
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
}); 
    if (customerId){
    // return customerId;
    } else {
      try {

       
            const customers = await razorpay.customers.all({ count: 100 });
            const existingCustomer = customers.items.find(c =>
      c.email?.toLowerCase() === rider.rider_email.toLowerCase() &&
      c.contact === rider.rider_mobile
        );
        if (existingCustomer) {
           await updateRecord("riders", { customer_id: existingCustomer.id }, ["rider_id"], [rider_id]);
    //  return  customerId = existingCustomer.id;

    } else{
       const customer = await razorpay.customers.create({
          name: rider.rider_name,
          email: rider.rider_email.toLowerCase(),
          contact: rider.rider_mobile,
          fail_existing: true, // tell Razorpay to prevent duplicate
          
        });
       await updateRecord("riders", { customer_id: customer.id }, ["rider_id"], [rider_id]);
        // return customer.id;

    }
    
    

      } catch (err) {
        // Handle “already exists” case
        console.log("customer already exist",err)
      
      }
    }
   
    return customerId;
}


export const CardSave =async (payment_id,rider_id) => {
  console.log(payment_id,rider_id)
  // payment_id="",rider_id
  //  if(!payment_id && !rider_id ){
  //   return false;
  //  }
  console.log("save card hit")

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    // Step 1: Fetch payment details
    const payment = await razorpay.payments.fetch(payment_id);
    if (payment.method !== "card") return false;

    const { token_id } = payment;
     if (payment.status !== "captured") {return false}

    if (!token_id) {   console.log("no token"); return false }

    // Step 2: Ensure customer is linked
    let customer_id;
    const riders = await queryDB("SELECT customer_id FROM riders WHERE rider_id = ?", [rider_id]);
    if ( riders.customer_id === null || riders.customer_id ==='') {
       customer_id=createCustomer(rider_id)}else{
     customer_id=riders.customer_id
    }
      const token = await razorpay.customers.fetchToken(customer_id, token_id);
       if(!token) return false;
    
    const card = token.card;
        const fingerprint = card.fingerprint? card.fingerprint: `${card.network}_${card.last4}`;

    const existing_cards = await queryDB("SELECT * FROM rider_cards WHERE rider_id = ? AND fingerprint = ?",[rider_id, fingerprint]);

    if (existing_cards) {
 
      return true;
    }
    await insertRecord("rider_cards",["rider_id", "token_id", "fingerprint", "last4", "network", "card_type", "expiry_month", "expiry_year"],
      [rider_id, token_id, fingerprint, card.last4, card.network, card.type, card.expiry_month, card.expiry_year]);
    return true;

  
};

export const addMoneyForCycleBooking = asyncHandler(async (req, resp) => {
    const { rider_id, amount } = mergeParam(req);
    const numericAmount = parseFloat(amount);

    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id: ["required"],
        amount  : ["required"]
    });

    if (!isValid) {
        return resp.json({ status: 0, code: 422, message: errors });
    }
    if (numericAmount < 1) {
        return resp.json({
            status: 0,
            code: 422,
            message: ["Amount cannot be less than 1 INR"]
        });
    }
    const result = await queryDB(`
        SELECT 
            r.amount,
            r.out_standing_cost,
            ${formatFloatInQuery('cn.min_wallet_price')} as min_wallet_price,
            cb.booking_id
        FROM riders r
        JOIN country cn ON cn.country_id = r.country_id
        LEFT JOIN cycle_booking cb ON cb.booking_id = (SELECT booking_id FROM cycle_booking
        WHERE rider_id = r.rider_id
        ORDER BY created_at DESC
        LIMIT 1
        )
        WHERE r.rider_id = ? 
    `, [rider_id]);


    if (!result) {
        return resp.json({
            status: 0,
            code: 404,
            message: ["Rider not found"]
        });
    }

    // if (parseFloat(result.out_standing_cost) < 0) {
    //     return resp.json({
    //         status: 0,
    //         code: 200,
    //         message: [`Your outstanding balance is ₹${result.out_standing_cost}. Clear dues first.`]
    //     });
    // }

    const minWallet = parseFloat(result.min_wallet_price || 200);
    const currentWallet = parseFloat(result.amount || 0);

// first time security balance maintain
    if (currentWallet < minWallet) {

    const requiredAmount = minWallet - currentWallet;

    if (numericAmount < requiredAmount) {

        return resp.json({
            status: 0,
            code: 200,
            message: [
                `Please add minimum ₹${requiredAmount.toFixed(2)} to maintain security balance.`
            ]
        });
    }
}

    // if (data.status === "PAID") {
    //     return resp.json({
    //         status: 0,
    //         code: 400,
    //         message: ["Booking already paid"]
    //     });
    // }

    const receipt = `${numericAmount}_BOOKING_${rider_id}_${moment().format("YY-MM-DD_HH:mm:ss")}`;

    const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const order = await razorpay.orders.create({
        amount: Math.round(amount * 100), // paise
        currency: "INR",
        receipt,
        notes: {
            rider_id: rider_id.toString(),
            booking_id: result.booking_id?.toString(), // add this
            booking_type: "BOOKING",
            amount: numericAmount
        }
    });

    const customer_id = await createCustomer(rider_id);

    return resp.json({
        status: 1,
        code: 200,
        orderId: order.id,
        customer_id,
        message: ["Order created for booking"],
        amount: numericAmount,
        currency: "INR",
        key_id: process.env.RAZORPAY_KEY_ID
    });
});