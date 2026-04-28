import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
    host               : process.env.DB_HOST_INDIA,
    user               : process.env.DB_USER_INDIA,
    password           : process.env.DB_PASSWORD_INDIA,
    database           : process.env.DB_NAME_INDIA,
    port               : 3306,
    waitForConnections : true,
    // queueLimit         : 0
    // connectTimeout     : 10000,
});
export const startTransaction = async () => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    return connection;
};
export const commitTransaction = async (connection) => {
    await connection.commit();
    connection.release();
};
export const rollbackTransaction = async (connection) => {
    await connection.rollback();
    connection.release();
};
console.log("india databse")
export default pool;
