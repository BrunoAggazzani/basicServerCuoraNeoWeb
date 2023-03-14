import { Client } from 'pg';
import * as test from "../controllers/test.controllers";

const configDB = {
    user: 'systel',
    host: 'localhost',
    port: '5432',
    password: 'Systel#4316',
    database: 'cuora',
    statement_timeout: 20000        
}

export const pool = new Client(configDB);
pool
    .connect()
    .then(() => {
        console.log('DB connectedx!!!');
        test.updaterSQLserver();
    })
    //.then(() => test.updaterSQLserver)
    .catch((err) => console.error('DB Connected error!!!'))



















