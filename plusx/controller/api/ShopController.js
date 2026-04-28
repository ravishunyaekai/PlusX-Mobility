import db from "../../../config/indiadb.js";
import { queryDB } from '../../../dbUtils.js';
import validateFields from "../../../validation.js";
import { mergeParam, getOpenAndCloseTimings, asyncHandler, getSingleRoute, getMultipleRoute } from '../../../utils.js';

export const shopList = asyncHandler(async (req, resp) => {
    const { page_no = 1, location, latitude, longitude, search_text, service, brand } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {
        latitude  : ["required"], 
        longitude : ["required"]
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const limit = 10;
    const start = parseInt((page_no * limit) - limit);

    let query = `
        SELECT 
            shop_id, shop_name, contact_no, address, latitude, longitude, cover_image AS shop_image, always_open, 
            REPLACE(open_days, "_", ", ") AS open_days,
            REPLACE(open_timing, "_", ", ") AS open_timing, 
            (6367 * ACOS(COS(RADIANS(?)) * COS(RADIANS(store_addreslatitude)) * COS(RADIANS(store_addreslongitude) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(store_addreslatitude)))) AS distance
        FROM 
            service_shops 
        WHERE 
            status = 1 `
    ;
    const queryParams = [latitude, longitude, latitude];
    
    if (search_text) {
        query += ' AND shop_name LIKE ?';
        queryParams.push(`%${search_text}%`);
    }
    if (service) {
        // const service = ["EV Service", "Tyre Change"]; this is example of filter 
        let whereClauses = service.map(() => "JSON_CONTAINS(services, ?)");
        query += ` AND  ( ${whereClauses.join(" OR ")} ) `;  ;
    }
    if (brand) {
        let whereClauses = brand.map(() => "JSON_CONTAINS(brands, ?)");
        query += ` AND  ( ${whereClauses.join(" OR ")} ) `;  ;
    }
    const totalCountQuery = `SELECT COUNT(*) AS total FROM (${query}) AS total_count`;
    const [totalRows]     = await db.execute(totalCountQuery, queryParams);
    const total           = totalRows[0].total;
    const totalPage       = Math.ceil(total / limit);

    query += ` ORDER BY distance ASC LIMIT ${start}, ${parseInt(limit, 10)}`;
    const [shopsData] = await db.execute(query, queryParams);

    const origin       = `${latitude}, ${longitude}`;
    const routeResults = await getMultipleRoute(origin, shopsData);

    const [services]   = await db.execute(`SELECT service_name FROM store_services ORDER BY service_name ASC`);
    const serviceNames = services.map(service => service.service_name);
    const [brands]     = await db.execute(`SELECT brand_name FROM store_brands ORDER BY brand_name ASC`);
    const brandNames   = brands.map(brand => brand.brand_name);

    resp.json({
        message    : ["Shop List fetched successfully!"],
        data       : routeResults,
        total      : total,
        total_page : totalPage,
        services   : serviceNames,
        brands     : brandNames,
        status     : 1,
        code       : 200,
        base_url   : `${process.env.DIR_UPLOADS}shop-images/`,
    });
});

export const shopDetail = asyncHandler(async (req, resp) => {
    const {rider_id, store_id, latitude, longitude } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id  : ["required"], 
        store_id  : ["required"], 
        latitude  : ["required"], 
        longitude : ["required"]
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    let gallery = [];

    const shop = await queryDB(`
        SELECT 
            shop_id, shop_name, contact_no, cover_image as shop_image, address, latitude, longitude, description, brands, services, offer_details, always_open, 
            REPLACE(open_days, "_", ", ") AS open_days,
            REPLACE(open_timing, "_", ", ") AS open_timing, 
            (6367 * ACOS(COS(RADIANS(?)) * COS(RADIANS(latitude)) * COS(RADIANS(longitude) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(latitude)))) AS distance
        FROM 
            service_shops
        WHERE 
            shop_id = ? AND status = ? 
        LIMIT 1
    `, [latitude, longitude, latitude, store_id, 1]);
    
    shop.schedule = getOpenAndCloseTimings(shop);

    [gallery] = await queryDB(`SELECT image_name FROM store_gallery WHERE store_id = ? ORDER BY id DESC LIMIT 5`, [store_id]);
    const imgName = gallery.map(row => row.image_name);

    const origin       = `${latitude}, ${longitude}`;
    const destination  = `${shop.latitude}, ${shop.longitude}`;
    const distancedata = await getSingleRoute(origin, destination);
    shop.distance      = parseFloat(distancedata.distance);

    return resp.json({
        message      : ["Shop Details fetch successfully!"],
        status       : 1,
        code         : 200,
        store_data   : shop,
        gallery_data : imgName,
        base_url     : `${process.env.DIR_UPLOADS}shop-images/`,
    });
});