export const NOTIFICATION_CONTENT = {
  HOME_USER_SIGNUP: {
    heading: "New User Signup",
    desc: ({ user_id }) => `A new user has signed up. User ID: ${user_id}`,
    href: ({ user_id }) => `user/profile/${user_id}`
  },

  RIDE_STARTED: {
    heading: "Ride Started Successfully",
    desc: ({ booking_id }) => `Ride ongoing : ${booking_id}`,
    href: ({ booking_id }) => `ride/ride-booking-details/${booking_id}`
  },

  RIDE_STOPPED: {
    heading: "Ride Stopped Successfully",
    desc: ({ booking_id }) => `Ride completed : ${booking_id}`,
    href: ({ booking_id }) => `ride/ride-booking-details/${booking_id}`
  },

  LOCKER_UNAVAILABLE: {
    heading: "Locker Unavailable",
    desc: () => "This locker is temporarily unavailable. Please try again later.",
    href: () => ""
  }
};



