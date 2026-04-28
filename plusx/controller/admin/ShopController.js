import db from '../../../config/indiadb.js';
import validateFields from "../../../validation.js";
import generateUniqueId from 'generate-unique-id';
import { getPaginatedData, insertRecord, queryDB, updateRecord } from '../../../dbUtils.js';
import { formatOpenAndCloseTimings, asyncHandler, deleteFile, getOpenAndCloseTimings, formatDateTimeInQuery } from '../../../utils.js';

export const storeList = asyncHandler(async (req, resp) => {
    const { search_text, page_no } = req.body;
    const result = await getPaginatedData({
        tableName        : 'service_shops',
        columns          : `shop_id, shop_name, contact_no, address `,
        liveSearchFields : ['shop_id', 'shop_name', 'contact_no'],
        liveSearchTexts  : [search_text, search_text, search_text],
        sortColumn       : 'id',
        sortOrder        : 'DESC',
        page_no,
        limit            : 10,
    });
    return resp.json({
        status     : 1,
        code       : 200,
        message    : ["Shop List fetch successfully!"],
        data       : result.data,
        total_page : result.totalPage,
        total      : result.total,
    });
});

export const storeData = asyncHandler(async (req, resp) => {
    const { shop_id } = req.body;
    
    const [services]   = await db.execute(`SELECT service_name FROM store_services ORDER BY service_name ASC`);
    const serviceNames = services.map(service => service.service_name);
    const [brands]     = await db.execute(`SELECT brand_name FROM store_brands ORDER BY brand_name ASC`);
    const brandNames   = brands.map(brand => brand.brand_name);
    
    const result = {
        status    : 1,
        code      : 200,
        services  : serviceNames,
        brands    : brandNames,
        base_url  : `${process.env.DIR_UPLOADS}shop-images/`,
    }
    if(shop_id) { 
        // const days = [ 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday' ];
        const shop = await queryDB(`
            SELECT 
                shop_id, shop_name, contact_no, description, offer_details, address, latitude, longitude, services, brands, always_open, open_days, open_timing, status, cover_image 
            FROM 
                service_shops 
            WHERE 
                shop_id = ? 
            LIMIT 1`, 
        [shop_id]); 
        const [gallery] = await db.execute(`
            SELECT 
                id, image_name 
            FROM 
                store_gallery 
            WHERE 
                store_id = ? 
            ORDER BY id DESC`, 
        [shop_id]);
    
        const imgName = gallery.map(image => image.image_name);
        const imgId   = gallery?.map(image => image.id);

        // result.days        = days;
        result.galleryData = imgName;
        result.galleryId   = imgId;
        result.shop        = shop;
    }
    return resp.status(200).json(result);
});

export const storeAdd = asyncHandler(async (req, resp) => {
    const { shop_name, contact_no, description, offerDetails, address, latitude, longitude, brands, services, always_open=0 } = req.body;
        
    const { isValid, errors } = validateFields(req.body, { 
        shop_name    : ["required"], 
        contact_no   : ["required"], 
        brands       : ["required"], 
        services     : ["required"], 
        description  : ["required"], 
        offerDetails : ["required"], 
        address      : ["required"], 
        latitude     : ["required"], 
        longitude    : ["required"], 
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
    const data             = req.body;
    const coverImg         = req.files?.['cover_image']?.[0]?.filename || '';
    const shopGallery      = req.files?.['shop_gallery']?.map(file => file.filename) || [];
    const {fDays, fTiming} = formatOpenAndCloseTimings(always_open, data);
    
    const insert = await insertRecord('service_shops', [
        'shop_id', 'shop_name', 'contact_no', 'brands', 'services', 'description', 'offer_details',
        'address', 'latitude', 'longitude', 'always_open', 'open_days', 'open_timing',  
        'cover_image', 'status'
    ], [
        'STOR', shop_name, contact_no, brands, services, description, offerDetails,
        address, latitude, longitude, always_open , fDays, fTiming, coverImg, 1 
    ]);
    if(insert.affectedRows == 0) return resp.json({status:0, message: "Something went wrong! Please try again after some time."});

    const lastId     = insert.insertId;
    const shop_id = `SHP-${String(lastId).padStart(4, "0")}`;
    await updateRecord('service_shops', {shop_id}, ['id'], [lastId]);

    if(shopGallery.length > 0){
        const values       = shopGallery.map(filename => [shop_id, filename]);
        const placeholders = values.map(() => '(?, ?)').join(', ');
        await db.execute(`INSERT INTO store_gallery (store_id, image_name) VALUES ${placeholders}`, values.flat());
    }
    return resp.json({status: 1, message: "EV Shop added successfully."});
});

export const storeView = asyncHandler(async (req, resp) => {
    const { shop_id } = req.body;
    
    const store = await queryDB(`
        SELECT 
            shop_id, shop_name, contact_no, description, offer_details, address, services, brands, always_open, open_days, open_timing, status, cover_image 
        FROM 
            service_shops 
        WHERE 
            shop_id = ? LIMIT 1`, 
    [shop_id]);
    
    if(!store) return resp.json({status : 0, message : "Shop Id is invalid"});
    // store.schedule = getOpenAndCloseTimings(store);

    const [gallery] = await db.execute(`
        SELECT 
            id, image_name 
        FROM 
            store_gallery 
        WHERE 
            store_id = ? 
        ORDER BY id DESC`, 
    [shop_id]);

    const imgName = gallery.map(image => image.image_name);
    const imgId   = gallery?.map(image => image.id);
      
    return resp.json({
        status      : 1,
        code        : 200,
        message     : "Shop Detail fetch successfully",
        shop        : store,
        galleryData : imgName,
        galleryId   : imgId,
        base_url    : `${process.env.DIR_UPLOADS}shop-images/`,
    });
});

export const storeUpdate = asyncHandler(async (req, resp) => {
    const { shop_id , shop_name, contact_no, description, offerDetails, address, latitude, longitude,
    status, brands, services, always_open=0 } = req.body;
    
    const { isValid, errors } = validateFields(req.body, {
        shop_id      : ["required"], 
        shop_name    : ["required"], 
        contact_no   : ["required"], 
        brands       : ["required"], 
        services     : ["required"], 
        description  : ["required"], 
        offerDetails : ["required"], 
        address      : ["required"], 
        latitude     : ["required"], 
        longitude    : ["required"],  
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    
    const data = req.body;
    const shop = await queryDB(`SELECT cover_image FROM service_shops WHERE shop_id = ? LIMIT 1`, [shop_id]);
    if(!shop) return resp.json({status:0, message: "Shop Data can not edit, or invalid shop Id"});

    const { fDays, fTiming } = formatOpenAndCloseTimings(always_open, data);
    const coverImg           = req.files?.['cover_image']?.[0]?.filename || shop.cover_image;
    const shopGallery        = req.files?.['shop_gallery']?.map(file => file.filename) || [];
    
    const updates = { shop_name, contact_no, brands, services, description, address, latitude, longitude, status,
        offer_details : offerDetails,
        always_open, 
        open_days   : fDays, 
        open_timing : fTiming, 
        cover_image : coverImg
    };
    const update = await updateRecord('service_shops', updates, ['shop_id'], [shop_id]);
    if(update.affectedRows == 0) return resp.json({status:0, message: "Failed to update! Please try again after some time."});

    if(shopGallery.length > 0){
        const values = shopGallery.map(filename => [shop_id, filename]);
        const placeholders = values.map(() => '(?, ?)').join(', ');
        await db.execute(`INSERT INTO store_gallery (store_id, image_name) VALUES ${placeholders}`, values.flat());
    }
    if(req.files && req.files['cover_image']){
        deleteFile('shop-images', shop.cover_image);
    }
    return resp.json({status:1, message: "EV Shop updated successfully"});
});

export const storeDelete = asyncHandler(async (req, resp) => {
    const {shop_id} = req.body;

    const shop = await queryDB(`SELECT cover_image FROM service_shops WHERE shop_id = ?`, [shop_id]);
    if (!shop) return resp.json({ status: 0, msg: "Shop Data cannot be deleted, or invalid" });
    const [gallery] = await db.execute(`SELECT image_name FROM store_gallery WHERE store_id = ?`, [shop_id]);
    const galleryData = gallery.map(img => img.image_name);

    if (shop.cover_image) {
        deleteFile('shop-images', shop.cover_image);
    }
    if (galleryData.length > 0) {
        galleryData.forEach(img => img && deleteFile('shop-images', img));
    }
    
    await db.execute(`DELETE FROM store_gallery WHERE store_id = ?`, [shop_id]);
    await db.execute(`DELETE FROM store_address WHERE store_id = ?`, [shop_id]);
    await db.execute(`DELETE FROM service_shops WHERE shop_id = ?`, [shop_id]);

    return resp.json({ status: 1, code: 200, message: "Shop deleted successfully!" });
});

export const deleteStoreGallery = asyncHandler(async (req, resp) => {
    const { gallery_id } = req.body;
    if(!gallery_id) return resp.json({status:0, message: "Gallery Id is required"});

    const galleryData = await queryDB(`SELECT image_name FROM store_gallery WHERE id = ? LIMIT 1`, [gallery_id]);
    
    if(galleryData){
        deleteFile('shop-images', galleryData.image_name);
        await db.execute('DELETE FROM store_gallery WHERE id = ?', [gallery_id]);
    }

    return resp.json({status: 1, code: 200,  message: "Gallery image deleted successfully"});
});

/* Shop Service */
export const serviceList = asyncHandler(async (req, resp) => {
    const { search_text, page_no } = req.body;
    const result = await getPaginatedData({
        tableName: 'store_services',
        columns: `service_id, service_name, ${formatDateTimeInQuery(['created_at'])}`,
        liveSearchFields: ['service_name', 'service_id'],
        liveSearchTexts: [search_text, search_text],
        sortColumn: 'id',
        sortOrder: 'DESC',
        page_no,
        limit: 10,
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["Shop Service List fetch successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
    });
});
export const serviceCreate = asyncHandler(async (req, resp) => {
    const { service_name } = req.body;
    const { isValid, errors } = validateFields(req.body, { service_name: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    if(service_name.length > 250) return resp.json({ status: 0, code: 422, message: "Max 250 character allowed." });

    const insert = await insertRecord('store_services', ['service_id', 'service_name'], [`STRC${generateUniqueId({length:6})}`, service_name]);

    return resp.json({
        status: insert.affectedRows > 0 ? 1 : 0 ,
        code: 200 ,
        message: insert.affectedRows > 0 ? "Store Service Added successfully." : "Failed to insert, Please Try Again." ,
    });

});
export const serviceUpdate = asyncHandler(async (req, resp) => {
    const { service_name, service_id } = req.body;
    const { isValid, errors } = validateFields(req.body, { service_name: ["required"], service_id: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    if(service_name.length > 250) return resp.json({ status: 0, code: 422, message: "Max 250 character allowed." });

    const update = await updateRecord('store_services', {service_name}, ['service_id'], [service_id]);

    return resp.json({
        status: update.affectedRows > 0 ? 1 : 0 ,
        code: 200 ,
        message: update.affectedRows > 0 ? "Store Service Updated successfully." : "Failed to update, Please Try Again." ,
    });
});
export const serviceDelete = asyncHandler(async (req, resp) => {
    const { service_id } = req.body;
    const { isValid, errors } = validateFields(req.body, { service_id: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const [del] = await db.execute(`DELETE FROM store_services WHERE service_id = ?`, [service_id]);

    return resp.json({
        status: del.affectedRows > 0 ? 1 : 0 ,
        code: 200 ,
        message: del.affectedRows > 0 ? "Store Service Deleted successfully." : "Failed to delete, Please Try Again." ,
    });
});

/* Shop Brand */
export const brandList = asyncHandler(async (req, resp) => {
    const { search_text, page_no } = req.body;
    const result = await getPaginatedData({
        tableName: 'store_brands',
        columns: `brand_id, brand_name`,
        liveSearchFields: ['brand_name', 'brand_id'],
        liveSearchTexts: [search_text, search_text],
        sortColumn: 'id',
        sortOrder: 'DESC',
        page_no,
        limit: 10,
    });

    return resp.json({
        status: 1,
        code: 200,
        message: ["Shop Brand List fetch successfully!"],
        data: result.data,
        total_page: result.totalPage,
        total: result.total,
    });
});
export const brandCreate = asyncHandler(async (req, resp) => {
    const { brand_name } = req.body;
    const { isValid, errors } = validateFields(req.body, { brand_name: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    if(brand_name.length > 250) return resp.json({ status: 0, code: 422, message: "Max 250 character allowed." });

    const insert = await insertRecord('store_brands', ['brand_id', 'brand_name'], [`STB${generateUniqueId({length:6})}`, brand_name]);

    return resp.json({
        status: insert.affectedRows > 0 ? 1 : 0 ,
        code: 200 ,
        message: insert.affectedRows > 0 ? "Store Brand Added successfully." : "Failed to insert, Please Try Again." ,
    });

});
export const brandUpdate = asyncHandler(async (req, resp) => {
    const { brand_name, brand_id } = req.body;
    const { isValid, errors } = validateFields(req.body, { brand_name: ["required"], brand_id: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    if(brand_name.length > 250) return resp.json({ status: 0, code: 422, message: "Max 250 character allowed." });

    const update = await updateRecord('store_brands', {brand_name}, ['brand_id'], [brand_id]);

    return resp.json({
        status: update.affectedRows > 0 ? 1 : 0 ,
        code: 200 ,
        message: update.affectedRows > 0 ? "Store Brand Updated successfully." : "Failed to update, Please Try Again." ,
    });
});
export const brandDelete = asyncHandler(async (req, resp) => {
    const { brand_id } = req.body;
    const { isValid, errors } = validateFields(req.body, { brand_id: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const [del] = await db.execute(`DELETE FROM store_brands WHERE brand_id = ?`, [brand_id]);

    return resp.json({
        status: del.affectedRows > 0 ? 1 : 0 ,
        code: 200 ,
        message: del.affectedRows > 0 ? "Store Brand Deleted successfully." : "Failed to delete, Please Try Again." ,
    });
});