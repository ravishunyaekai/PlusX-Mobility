import multer from 'multer';
import path from 'path';
import fs from 'fs';

import AWS from 'aws-sdk';
// import { S3Client } from "@aws-sdk/client-s3";
import dotenv from 'dotenv';
dotenv.config();


// S3 Bucket CODE
    AWS.config.update({
        accessKeyId     : process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey : process.env.AWS_SECRET_ACCESS_KEY,
        region          : process.env.AWS_REGION,
    });
    const s3 = new AWS.S3();
 
    const uploadFileToS3 = async (file, dirName = 'default') => {
        // const fileName = `${Date.now()}-${file.originalname}`;
        const fileName = file.originalname;
         const bucketName = process.env.AWS_BUCKET_NAME;
    const baseFolder = process.env.S3_FOLDER_NAME;
   console.log("📂 dirName}:", dirName);
    console.log("📁 Base Folder:", baseFolder);
   
     
        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            // Key       : `uploads/${dirName}/${fileName}`,
            Key          : `${process.env.S3_FOLDER_NAME}/${dirName}/${fileName}`,
            Body         : file.buffer, //buffer memory directly
            ACL          : 'public-read',
            ContentType  : file.mimetype,
            CacheControl : 'public, max-age=31536000'
        };
        await s3.upload(params).promise();
     
        return fileName;
      };
 

    export const handleFileUpload = ( dirName, fileFields, requiredFields = [], maxFiles = 10, allowedFileTypes = ['pdf','png', 'jpeg', 'jpg'] ) => {
        
        const storage = multer.memoryStorage(); // direct to s3
      
        const fileFilter = (req, file, cb) => {
           
            const fileExtension = path.extname(file.originalname).slice(1).toLowerCase();
            if (!allowedFileTypes.includes(fileExtension)) {
                return cb(new Error(`Invalid File Type! Only ${allowedFileTypes.join(', ')}`), false);

            }
            cb(null, true);
        };
        const upload = multer({
            storage,
            limits: { fileSize: 10 * 1024 * 1024 }, //10 MB
            fileFilter,
        });
        return (req, res, next) => {
            const multerFields = fileFields.map(field => ({
                name: field,
                maxCount: maxFiles
            }));
            const uploadMethod = upload.fields(multerFields);
     
            uploadMethod(req, res, async (err) => {
                let errorMsg = {};
         
                if (err) {
                    if (err instanceof multer.MulterError) {
                        errorMsg['limit'] = err.code === 'LIMIT_FILE_SIZE'
                          ? 'File size should not exceed 10 MB.'
                          : err.message;
                    } else {
                        errorMsg[err.field || 'unknown'] = err.message || 'Unknown error';
                    }
                  return res.status(422).json({ status: 0, code: 422, message: errorMsg });
                }
                if (!req.files || Object.keys(req.files).length === 0) {
                    return next();
                }
                try {
         
                    for (const field of Object.keys(req.files)) {
                        const originalFiles = req.files[field];
             
                        for (let i = 0; i < originalFiles.length; i++) {
                            const file = originalFiles[i];
                            const s3FileName = await uploadFileToS3(file, dirName);
             
                            file.filename = s3FileName;
                            console.log(" file.filename", file.filename);
                        }
                    }
                    next();
         
                } catch (uploadErr) {
                    console.error(' S3 Upload Error:', uploadErr);
                    return res.status(500).json({ status: 0, message: 'Failed to upload to S3.' });
                }
            });
        };
    };
 
 
  // s3 image delete process
  export const deleteImageFromS3 = async (oldPath) => {
    if (!oldPath) return;
 
    const decodedFilename = decodeURIComponent(oldPath); // ← Fix here
    const key = `${decodedFilename}`;
 
 
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
    };
 
    s3.deleteObject(params, (err, data) => {
      if (err) {
        console.error(` Failed to delete image from S3: ${key}`, err);
      } else {
        console.log(` Deleted image from S3: ${key}`);
        //return "deleted image"
      }
    });
  };

 export const deleteExceptGivenImages = async () => {
  try {
    const bucketName = process.env.AWS_BUCKET_NAME;

    const keepImages = [
      '1771996238690-1.jpeg',
      '1771996426568-a.jpg'
    ];

    const prefix = '_uploads/mobility_testing/banner/'; // ✅ your folder path

    const listedObjects = await s3.listObjectsV2({
      Bucket: bucketName,
      Prefix: prefix
    }).promise();

    if (!listedObjects.Contents.length) {
      console.log("No files found in folder");
      return;
    }

    // Step 2: Filter objects NOT in keep list
    const objectsToDelete = listedObjects.Contents
      .filter(obj => {
        // ignore folder itself (sometimes appears as empty object)
        if (obj.Key === prefix) return false;

        const fileName = obj.Key.split('/').pop();
        return !keepImages.includes(fileName);
      })
      .map(obj => ({ Key: obj.Key }));

    if (objectsToDelete.length === 0) {
      console.log("Nothing to delete");
      return;
    }

    console.log("Deleting:", objectsToDelete); // ✅ safety log
 const result = await s3.deleteObjects({
      Bucket: bucketName,
      Delete: {
        Objects: objectsToDelete,
      },
    }).promise();

    console.log("Deleted files count:", result.Deleted.length);
  

  } catch (error) {
    console.error("Error deleting files:", error);
  }
};

/**uploaded imaeg
https://plusx.s3.ap-south-1.amazonaws.com/_uploads/mobility_testing/banner/1771996238690-1.jpeg
      1771996238690-1.jpeg
     1771996291014-1.jpeg
1771996426568-a.jpg
 1771996631187-1.jpeg
 https://a.co/cUPnyil

     * 
     * 
     */
export const alistImagesFromS3 = async () => {
  try {
    const bucketName = process.env.AWS_BUCKET_NAME;
    const prefix = '_uploads/mobility/charger-installation/';

    const response = await s3.listObjectsV2({
      Bucket: bucketName,
      Prefix: prefix
    }).promise();

    if (!response.Contents || response.Contents.length === 0) {
      console.log("No images found");
      return [];
    }

    // Extract file names
    const images = response.Contents.map(obj => ({
      key: obj.Key,
      fileName: obj.Key.split('/').pop(),
      size: obj.Size
    }));

    console.log("Images in folder:", images);

    return images;

  } catch (error) {
    console.error("Error listing images:", error);
  }
};
export const listImagesFromS3 = async (req, res) => {
  try {
    const bucketName = process.env.AWS_BUCKET_NAME;
    const key = "_uploads/mobility/charger-installation/"; // full S3 key

    const file = await s3.getObject({
      Bucket: bucketName,
      Key: key
    }).promise();

    res.setHeader('Content-Type', file.ContentType);
    res.setHeader('Content-Disposition', `attachment; filename="${key.split('/').pop()}"`);

    res.send(file.Body);

  } catch (error) {
    console.error(error);
    res.status(500).send("Download failed");
  }
};