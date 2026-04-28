import { Router } from "express";
import {  authenticateAdmin } from "../../middleware/admin/authenticationMiddleware.js";
import { adminAuthorization } from "../../middleware/admin/authorizeMiddleware.js";
import { logout,login, deleteGalleryImage } from "../controller/AdminControlller.js";
import { adminStateCountry } from "../controller/AdminControlller.js";
// import { adminstat } from "../../common/controller/UserController.js";

const router = Router();

const adminAuthRoutes = [
    { method: 'post', path: '/login', handler: login }, 
]
adminAuthRoutes.forEach(({ method, path, handler }) => {
    router[method](path, adminAuthorization, handler);
});
const adminRoutes = [
    { method: 'post',  path: '/logout',               handler: logout },
    { method: 'post',   path: '/state-country-list',  handler:adminStateCountry },
    { method: 'post',   path: '/delete-image',        handler: deleteGalleryImage },
]; 

adminRoutes.forEach(({ method, path, handler }) => {
    const middlewares = [adminAuthorization];
    middlewares.push(authenticateAdmin);
    router[method](path, ...middlewares, handler);
});
export default router;