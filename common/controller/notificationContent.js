export const NOTIFICATION_CONTENT = {
    USER_ON_GOING: {
        heading:({ booking_id }) => `Ride Started : ${booking_id}`,
        desc: 'Your ride has started successfully',
        href: ({ booking_id }) => `mobility_booking_details/${booking_id}`,
        module_name: "mobility",
        panel_to: "Rider",
        panel_from: "Admin"
    },
    ADMIN_ON_GOING: {
        heading: "Ride Started",
        desc: ({ booking_id }) => `New ride started- ${booking_id}`,
        href: ({ booking_id }) => `ride/ride-booking-details/${booking_id}`,
        module_name: "mobility",
        panel_to: "Admin",
        panel_from: "Rider"
    },
    USER_STOP_RIDE: {
        heading: "Ride Stopped Successfully",
        desc: ({ booking_id }) => `Booking ID: ${booking_id}`,
        href: ({ booking_id }) => `mobility_booking_details/${booking_id}`,
        module_name: "mobility",
        panel_to: "Rider",
        panel_from: "Admin"
    },
    ADMIN_STOP_RIDE: {
      heading: "Ride Stopped Successfully",
      desc: ({ booking_id }) => `Booking ID: ${booking_id}`,
      href: ({ booking_id }) => `/mobility/ride/ride-booking-details/${booking_id}`,
      module_name: "mobility",
      panel_to: "Admin",
      panel_from: "Rider"
    },
    ADMIN_COMPLETE_RIDE: {
        heading: "Ride Completed",
        desc: ({ booking_id }) => `Ride completed - ${booking_id} `,
        href: ({ booking_id }) => `/mobility/ride/ride-booking-details/${booking_id}`,
        module_name: "mobility",
        panel_to: "Admin",
        panel_from: "Rider"
    },
    USER_COMPLETE_RIDE: {
        heading:({ booking_id }) => `Ride ID: ${booking_id}`,
        desc: ({ amount }) => `Your ride is complete. Please pay now for smooth future rides.`, //INR ${amount} has been deducted from your wallet.`,
        href: ({ booking_id }) => `mobility_booking_details/${booking_id}`,
        module_name: "mobility",
        panel_to: "Rider",
        panel_from: "Admin"
    },
    USER_COMPLETE_RIDES: {
        heading:({ booking_id }) => `Ride ID: ${booking_id}`,
        desc: ({ amount }) => `INR ${amount} amount has been deducted from the security deposit.`, //INR ${amount} has been deducted from your wallet.`,
        href: ({ booking_id }) => `mobility_booking_details/${booking_id}`,
        module_name: "mobility",
        panel_to: "Rider",
        panel_from: "Admin"
    },
    //user home charger booking
    USER_POD_CONFIRM: {
        heading: "Portable Charging Booking!",
        desc: ({ request_id }) => `Booking Confirmed! ${request_id}`,
        href: ({ booking_id }) => `portable_charger_booking//${booking_id}`,
        module_name: "Portable Charging Booking",
        panel_to: "Rider",
        panel_from: "Admin"
    },
    ADMIN_POD_CONFIRM: {
        heading: "Portable Charging Booking!",
        desc: ({ request_id }) => `Booking Confirmed! ${request_id}`,
        href: ({ booking_id }) => `portable_charger_booking//${booking_id}`,
        module_name: "Portable Charging Booking",
        panel_to: "Admin",
        panel_from: "Rider"
    },
    ADMIN_FEEDBACK_RECEIVED: {
        heading: "New Feedback Received",
        desc: ({ booking_id}) => `Booking ID: ${booking_id} - The user has shared feedback for this booking.`,
        href: ({ booking_id }) =>`ride/ride-booking-details/${booking_id}`,
        module_name: "mobility",
        panel_to: "Admin",
        panel_from: "Rider"
    },
    SECURITY_DEPOSIT_DEDUCT_NOTIFICATION: {
        heading:"Payment Deducted",
        desc:({ amount }) =>`₹${amount} deducted from your security deposit.`,
        href:({ booking_id }) => `mobility_booking_details/${booking_id}`,
        module_name:"mobility",
        panel_to:"Rider",
        panel_from: "Admin"
    },
    USER_RIDE_COMPLETE_EMAIL:{
        subject:({ booking_id }) => `Ride ID ${booking_id}: Your PlusX Mobility Ride Is Complete`,
        content:({ rider_name,booking_id, cycle_id, pick_time,drop_time,time_taken,amount }) =>`
            <html> 
                <body> <h4>Hi ${rider_name} ,</h4>
                    <p>Your ride has been completed successfully. Below are the details of your trip :</p>
                    <b>Ride Summary</b>
                    <p><b>Ride ID</b>: ${booking_id}</p>
                    <p><b>Cycle ID</b>: ${cycle_id}</p>
                    <p><b>Start Time</b>: ${pick_time}</p>
                    <p><b>End Time</b>: ${drop_time} </p>
                    <p><b>Ride Duration</b>: ${time_taken} MIN</p>
                    <p><b>Amount Charged</b>: ${amount} INR </p>
                    <p>Thank you for choosing PlusX Mobility. We hope you enjoyed the ride and look forward to serving you again soon.</p>
                    <p>If you have any questions or need assistance, please contact us through the app.</p> <br>
                    <p>Happy Riding!</p>
                    <p>Team PlusX Mobility </p>
                <body>
            </html>
        `
    },
    ADMIN_RIDE_START_EMAIL:{
        subject:({ booking_id }) => `New Cycle Ride Booked - Ride ID  ${booking_id} `,
        content:({ booking_id,rider_name, rider_mobile , cycle_id, cycle_pick_time,pickup_station, latitude,longitude }) =>`
            <html> 
                <body> 
                    <h4>Dear Admin, </h4>
                    <p>
                        A new cycle ride has been successfully booked and started on the <b>PlusX Mobility App
                        </b>. Please find the details below:
                    </p>
                    <b>Ride Details</b>
                    <p><b>Ride ID</b>: ${booking_id}</p>
                    <p><b>Rider Name</b>: ${rider_name}</p>
                    <p><b>Contact Number</b>: ${rider_mobile}</p>
                    <p><b>Cycle ID</b>: ${cycle_id}</p>
                    <p><b>Start Time</b>: ${cycle_pick_time}</p>
                    <p> <b>Station Name</b> : <a href="https://www.google.com/maps?q=${latitude},${longitude}"> ${pickup_station}</a> </p>

                    <p>Please monitor the ride for any operational or system-related issues and assist the rider if required.</p>

                    <p>Regards,</p>
                    <p>Team PlusX Mobility </p>
                <body>
            </html>
        `
    },
    //***************Home EV Charging - Notification & Email Content*********************** */
    USER_HOME_CHARGER_CONFIRM_NOTIFICATION :{
        heading:`Home EV Charging Booking!`,
        desc: ({ booking_id }) => `Booking Confirmed! ${booking_id}`,
        href: ({ booking_id }) => `portable_charger_booking/${booking_id}`,
        module_name: "mobility",
        panel_to: "Rider",
        panel_from: "Admin"
    },
    ADMIN_FAILED_BOOKING: {
        heading     : "Incomplete Booking",
        desc        : ({ booking_id }) => `Booking ID: ${booking_id}`,
        href        : ({ booking_id }) => `ride/ride-incomplete-booking-details/${booking_id}`,
        module_name : "mobility",
        panel_to    : "Admin",
        panel_from  : "Rider"
    },
    REFUND_AMOUNT_WALLET: {
        heading     : "Refund Credited",
        desc        : ({ amount }) => `₹${amount} added to your wallet.`,
        href        : ({ riderId }) => `user_wallet/${riderId}`,
        module_name : "user_wallet",
        panel_to    : "Rider",
        panel_from  : "Admin"
    },

    PAYMENT_SUCCESS_EMAIL: {
        subject: ({ booking_id }) =>`PlusX Mobility Ride Payment Confirmation`,
        content: ({rider_name,amount,booking_id,cycle_id,time_taken}) => `
        <html>
                <body>
                    <h4>Hi ${rider_name},</h4>
                    <p>
                        Thank you for riding with PlusX Mobility.
                    </p>
                    <p>
                        We have received your payment of INR ${amount} for your recent e-cycle ride.
                    </p>
                    <h3>Ride Summary</h3>
                    <p><b>Ride ID:</b> ${booking_id}</p>
                    <p><b>Cycle ID:</b> ${cycle_id}</p>
                    <p><b>Ride Duration:</b> ${time_taken} MIN</p>
                    <br/>
                    <p>
                        Thank you for making the payment. We hope you enjoyed your ride and 
                        look forward to serving you again soon.
                    </p>
                    <p>
                        If you have any questions or need assistance, please contact us through the app.
                    </p>
                    <br/>
                    <p>Happy Riding!</p>
                    <p>
                        Team PlusX Mobility
                    </p>
                </body>
            </html>
        `
    },


    SECURITY_DEPOSIT_DEDUCT_EMAIL: {
    subject: ({ booking_id }) =>`PlusX Mobility- Ride Payment Deducted from Security Deposit`,
    content: ({rider_name,amount,booking_id,cycle_id,time_taken}) => `
    <html>
        <body>
            <p>Hi ${rider_name},</p>
            <p>
                Thank you for riding with PlusX Mobility.
            </p>
            <p>
                We noticed that the payment of INR ${amount} for your recent e-cycle ride was not completed within 24 hours.
                As per the ride payment policy, the pending amount has now been deducted from your security deposit.
            </p>
            <h3>Ride Summary</h3>
            <p><b>Ride ID:</b> ${booking_id}</p>
            <p><b>Cycle ID:</b> ${cycle_id}</p>
            <p><b>Ride Duration:</b> ${time_taken} MIN</p>
            <p><b>Amount Deducted:</b> INR ${amount}</p>
            <br/>
            <p>
                To ride again, please recharge your security deposit and maintain the required minimum balance of INR 100.
            </p>
            <p>
                If you have any questions or need assistance, please contact us through the app.
            </p>
            <br/>
            <p>Happy Riding!</p>
            <p>Team PlusX Mobility</p>

        </body>
    </html>
    `
},

SECURITY_DEPOSIT_DEDUCT_EMAILS: {
    subject: () =>
        `PlusX Mobility - Ride Payment Deducted from Security Deposit`,

    content: ({
        rider_name,
        amount,
        booking_id,
        cycle_id,
        time_taken,
        pick_time,
        drop_time
    }) => `
    <html>
        <body>
            <p>Hi ${rider_name},</p>

            <p>
                Thank you for riding with PlusX Mobility.
            </p>

            <p>
                We would like to inform you that INR ${amount} has been deducted from your security deposit for the below ride.
            </p>

            <h3>Ride Details</h3>

            <p><b>Ride ID:</b> ${booking_id}</p>
            <p><b>Cycle ID:</b> ${cycle_id}</p>
            <p><b>Ride Start Time:</b> ${pick_time}</p>
            <p><b>Ride End Time:</b> ${drop_time}</p>
            <p><b>Ride Duration:</b> ${time_taken} MIN</p>
            <p><b>Amount Deducted:</b> INR ${amount}</p>

            <br/>

            <p>
              Please maintain a minimum balance of INR 100 in your security deposit to start a new ride.
            </p>

            <p>
                If you have any questions or need assistance, please contact us through the app.
            </p>

            <br/>

            <p>Happy Riding!</p>
            <p>Team PlusX Mobility</p>

        </body>
    </html>
    `
},
};


