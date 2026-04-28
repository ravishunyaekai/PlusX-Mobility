import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import db from '../../../config/indiadb.js';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { formatDateTimeInQuery, generateRandomPassword } from '../../../utils.js';
dotenv.config();

var transporter = nodemailer.createTransport({
    host : process.env.MAIL_HOST,
    port : process.env.MAIL_PORT,
    auth : {
        user : process.env.MAIL_USERNAME,
        pass : process.env.MAIL_PASSWORD
    }
});
