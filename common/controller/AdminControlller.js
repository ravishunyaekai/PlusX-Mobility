import { asyncHandler, formatDateTimeInQuery, mergeParam } from "../../utils.js";
import validateFields from "../../validationForAdmin.js";
import db from "../../config/indiadb.js";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { queryDB } from "../../dbUtils.js";
export const adminStateCountry = asyncHandler(async (req, resp) => {
        const {requirement,country_id,station_state_id=''}=mergeParam(req);
        
            let validationRules = {requirement   : ["required"],};
    
    const { isValid, errors } = validateFields(mergeParam(req), validationRules);
        if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
        let list;

    switch (requirement) {  
    case 'state':
        [list] = await db.execute(`SELECT state_id, name FROM states ORDER BY name ASC`);
    return resp.json({status: 1, code: 200, data: list, message: ['state List fech successfully!']});

        case 'country':
        [list] = await db.execute(`SELECT country_id, name FROM country  ORDER BY name ASC`);
    return resp.json({status: 1, code: 200, data: list, message: ['country List fech successfully!']});
   
    case 'city':
        if (!country_id) {
    return resp.json({status: 0, code: 422,list, message: ['country_id is required for city list']});
            }
    [list] = await db.execute(`SELECT city_id,name FROM cities where country_id=? and state_id=? ORDER BY name ASC`,[country_id,station_state_id]);

    return resp.json({status: 1, code: 200, data: list, message:[ 'cities List fech successfully!']});
            
    default:
    return resp.json({ status: 0, code: 400,  message: ['Invalid Requirement type'] });

            }   
});

export const login = async(req, resp) => {
    const { email, password } = req.body;
    try {

         const [users] = await db.execute(`SELECT id, name, email, phone, image,
           ${formatDateTimeInQuery(['created_at', 'updated_at'])}, password,country_id,city_id,role,panel_link,access 
           FROM users WHERE email=?`, [email]);
          
        if(users.length === 0){ 
            return resp.status(200).json({message: "Invalid email "}); 
        }
        const user    = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return resp.status(200).json({ message: 'Invalid password' });
        }
        await db.execute('UPDATE users SET status = 1 WHERE email = ?', [email]);
        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
      
        resp.cookie('authToken', token, { 
            httpOnly : true,   
            //secure : false,
            secure   : process.env.NODE_ENV === 'production', 
            sameSite : 'None',
            maxAge   : 3600000 
        });
        // console.log(" users[0]", users[0])
        resp.status(200).json({
            message     : "Login successfull",
            code        : 200, 
            userDetails : users[0], 
            base_url    : `${process.env.DIR_UPLOADS}profile-image/`,
            Token       : process.env.CUSTOM_TOKEN
        }) 
    } catch (error) {
      console.error("Database query error:", error);
      resp.status(500).json({
        message     : error,
        code        : 500, 
        userDetails : {}, 
        base_url    : `${process.env.DIR_UPLOADS}profile-image/`,
        Token       : ''
    }) 
    }
};

export const logout = async (req, resp) => {
  const { email } = req.body;
  
  if (!email) {
      return resp.status(400).json({ message: "Email is required." });
  }

  try {
      const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);

      if (users.length === 0) {
          return resp.status(404).json({ message: "User not found." });
      }

      await db.execute('UPDATE users SET status = 0 WHERE email = ?', [email]);
      resp.status(200).json({status:0, message: "Logged out successfully." });
  } catch (error) {
      console.error("Error during logout:", error);
      resp.status(500).json({ message: "Logout failed." });
  }
};

export const forgotPassword = async (req, resp) => {
    const { email } = req.body;
  
    const [users] = await db.execute('SELECT * FROM users WHERE email=?', [email]);
    if (users.length === 0) {
      return resp.status(404).json({ message: "Entered email is not registered with us, try with another one" });
    }
  
    const user = users[0];
    const pswd = generateRandomPassword();
    const hashedPswd = await bcrypt.hash(pswd, 10);

    await db.execute('UPDATE users SET password=? WHERE id=?', [hashedPswd, user.id]);
  
    try {
      await transporter.sendMail({
        from: `"Easylease Admin" <admin@easylease.com>`,
        to: email,
        subject: 'Forgot password Request',
        html: `
          <html>
            <body>
              <h4>Hello ${user.name},</h4>
              <p>We have received a request for a forgotten password. So we are sharing one random password here, with this password you can log in to your Easylease account.</p>
              <p>Password - <b>${pswd}</b></p>
              <p>Note: For security and your convenience, we recommend that you change your password once you log in to your account.</p>
              <br/>
              <p>Regards,<br/>Easylease Admin Team</p>
            </body>
          </html>
        `,
      });
  
      resp.status(200).json({ message: "An email has been sent to your entered registered email address. Please check that!" });
    } catch (error) {
      resp.status(500).json({ message: "Failed to send email." });
    }
};

export const updatePassword = async (req, resp) => {
  
  const { email, currentPassword, newPassword } = req.body;
  if (!email || !currentPassword || !newPassword) {
      return resp.status(400).json({ message: "Email, current password, and new password are required." });
  }

  try {
      const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
      
      if (users.length === 0) {
          return resp.status(404).json({ message: "Entered email is not registered with us, try with another one." });
      }

      const user = users[0];

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      
      if (!isMatch) {
          return resp.status(401).json({ message: "Current password is incorrect." });
      }

      const hashedPswd = await bcrypt.hash(newPassword, 10);

      await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPswd, user.id]);

      resp.status(200).json({ message: "Password updated successfully." });
  } catch (error) {
      console.error("Error updating password:", error);
      resp.status(500).json({ message: "Failed to update password." });
  }
};


export const deleteGalleryImage = asyncHandler(async (req, resp) => {
    const {userId,image_id,requirement} = req.body;
 
   
    const { isValid, errors } = validateFields(req.body, { image_id: ["required"],requirement:['required'] });
     
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
    let deleted_data,remaning_data,remaning_image;
    
    switch(requirement){
        case "station":
            remaning_data= await queryDB(`SELECT station_id FROM mobility_station_gallery WHERE id = ?`, [image_id]);
        
         deleted_data= await db.execute(`DELETE FROM mobility_station_gallery WHERE id = ?`, [image_id]);
            [remaning_image]= await db.execute(`SELECT id as imgId,image_name as imgName FROM mobility_station_gallery WHERE station_id = ?`, [remaning_data.station_id]);
           
            if(deleted_data)     return resp.json({ status: 1,images:remaning_image, code: 200, message: "Image deleted successfully!" });
            break;
          
        case "cycle":
        remaning_data= await queryDB(`SELECT station_id,cycle_id FROM cycle_gallery WHERE id = ?`, [image_id]);
        

        deleted_data= await db.execute(`DELETE FROM cycle_gallery WHERE id = ? and station_id=? and cycle_id=?  `,
                 [image_id,remaning_data.station_id,remaning_data.cycle_id]);

        [remaning_image]= await db.execute(`SELECT id as imgId,image as imgName FROM cycle_gallery WHERE station_id = ? and cycle_id=?`, [remaning_data.station_id,remaning_data.cycle_id]);
        
        if(deleted_data)     return resp.json({ status: 1, code: 200,images:remaning_image, message: "Image deleted successfully!" });
           
             break;
        case "public-charger":
            remaning_data= await queryDB(`SELECT station_id FROM cycle_gallery WHERE id = ?`, [image_id]);
        

            deleted_data= await db.execute(`DELETE FROM public_charging_station_gallery WHERE id = ? and station_id=?`, [image_id,remaning_data.station_id]);
            [remaning_image]= await db.execute(`SELECT id as imgId,image_name as imgName FROM public_charging_station_gallery WHERE station_id = ?`, [remaning_data.station_id]);

            
            if(deleted_data)     return resp.json({ status: 1, code: 200, images:remaning_image,message: "Image deleted successfully!" });

        default :
            
            return resp.json({ status: 1, code: 200, message: "Invalied Requirement" });


    }
      
  
    //await db.execute(`DELETE FROM mobility_station_list WHERE station_id = ?`, [station_id]);
   

});



export const uploadSImage = asyncHandler(async (req, resp) => {
    
        let profile_image = '';
        if(req.files && req.files['image']) { 
            const files   = req.files;
            profile_image = files ? files['image'][0].filename : '';
        }
    })