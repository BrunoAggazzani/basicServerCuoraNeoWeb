//import { connect, query, close, Request } from 'mssql'
const moment = require('moment')
const sql = require('mssql')
import { pool } from '../DB/connect';
const { execFile } = require('child_process');


let currentTime = moment().format('hh:mm:ss');
let updating = false;
let interval;


const syncTime = async(req) => {
  let syncFrec = 5;
  try {
      req = await pool.query('SELECT update_time FROM configuracion');
      console.log('Trayendo syncFrec...');
      syncFrec = parseInt(JSON.stringify(req.rows[0].update_time));
      console.log(syncFrec);      
  } catch (e){
      console.log(e);
      console.log('No se pudo traer syncTime');
  }
  if (syncFrec >= 5) {
    return syncFrec;
  } else {
    syncFrec = 5;
    return syncFrec;
  }  
}    

export const sqlServerConnect = async (req, res) => {
    console.log('Conectando SQL Server...');
    console.log('Datos para la conexion: '+JSON.stringify(req.body));
    let data = req.body;
    
    const sqlConfig = {
      user: data.user,
      password: data.pass,
      database: data.db_name,
      server: data.ip,
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
      },
      options: {
        encrypt: false, // for azure
        trustServerCertificate: false // change to true for local dev / self-signed certs
      }
    }
    let resultado = null;
    try {
        await sql.connect(sqlConfig);
        sql.query(`select ${1} as number`).then((result) => {
            resultado = JSON.stringify(result.recordset[0].number);
            console.log('Resultado: '+resultado);
            res.setHeader('Content-Type', 'application/json');
            res.send(resultado);
            sql.close();
        });      
    } catch (err) {
        console.log(err);
        console.log('Resultado: '+JSON.stringify(resultado));
        res.send(JSON.stringify(resultado));
        sql.close();
    }
    data = {};    
}




export const updaterSQLserver = async (req, res) => {
  console.log('Actualizando BBDD...'); 

  let sqlConfig = {};

  let DBext_host = '';
  //let DBext_port = 0;
  let DBext_dbName = '';
  let DBext_user = '';
  let DBext_pass = '';
  let DBext_type = '';
  let DBext_query = '';
  //let DBext_getDate = 'SELECT GETDATE()';  

  if (req != undefined && req != null && req != '') { // Los datos para la conexion remota son traidos desde el formulario web.
    let data = req.body;
    console.log('1 - Datos traidos desde el form web: '+JSON.stringify(data));
    DBext_host = data.dbExt.host;
    //DBext_port = data.dbExt.port;
    DBext_dbName = data.dbExt.dbName;
    DBext_user = data.dbExt.user;
    DBext_pass = data.dbExt.pass;
    DBext_type = data.dbExt.type;
    DBext_query = data.query;

  } else {  // Los datos para la conexion remota son traidos desde la BBDD local. 
    try {
      req = await pool.query(`SELECT db_ip, db_nombre, db_usuario, db_clave, db_tipo, query FROM configuracion`);
      console.log('2 - Trayendo datos de configuracion remota desde la base local...');
      DBext_host = req.rows[0].db_ip;
      DBext_dbName = req.rows[0].db_nombre;
      DBext_user = req.rows[0].db_usuario; 
      DBext_pass = req.rows[0].db_clave;
      DBext_type = req.rows[0].db_tipo;
      DBext_query = req.rows[0].query;
    } catch (e){
      console.log('Error trayendo datos: '+e);
      console.log('No se pudieron tarer los datos de configuracion remota desde la base local');
    }
  }

  sqlConfig = {
    user: DBext_user,
    password: DBext_pass,
    database: DBext_dbName,
    server: DBext_host,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    },
    options: {
      encrypt: false, // for azure
      trustServerCertificate: false // change to true for local dev / self-signed certs
    }
  }

  let resultado = null;
  //let dateDB ='';

  const querySQLSERVER = async(sqlConfig) => { // trae los productos de la BBDD SQL SERVER y lo almacena en la variable resultado.
    try {
      await sql.connect(sqlConfig).then(async (pool) => {
          await pool.query(DBext_query).then((result) => {
            resultado = result.recordsets[0];
          });
          /*
          await pool.query(DBext_getDate).then((result2) => {
            dateDB = result2.recordsets[0];
          });
          */
      });              
    } catch (err) {
      console.log('Error consulta BBDD SQL SERVER: '+err);
      console.log('Fallo la consulta a BBDD MS SQL SERVER');
    }
  }
 

  const isQODBC3 = async() => {
    let QODBC3 = false;
    try {
      req = await pool.query(`SELECT db_tipo FROM configuracion`);
      console.log('db_tipo es: '+req.rows[0].db_tipo);
      if (req.rows[0].db_tipo == 'QODBC3') {
        QODBC3 = true;
      } else {
        QODBC3 = false;
      }
    } catch (e){      
      console.log('Fallo la funcion "isQODBC3"');
      console.log(e);
    }
    return QODBC3;
  };

  
  const useDBext = async() => {
    let DBext = false;
    try {
      req = await pool.query(`SELECT usar_base_externa FROM configuracion`);
      console.log('usar_base_externa es: '+req.rows[0].usar_base_externa);
      if (req.rows[0].usar_base_externa) {
        DBext = true;
      } else {
        DBext = false;
      }
    } catch (e){      
      console.log('Fallo la funcion "useDBext"');
      console.log(e);
    }
    return DBext;
  };


  if (updating == true) {
    console.log('Deteniendo intervalo...');
    clearInterval(interval);
    updating = false;
  }
  
  let time = await syncTime(req);
  console.log('time is: '+time);

  interval = setInterval(async() => {
    updating = true;
    if (await useDBext() == true) { // Esto pregunta si usa BBDD externa.
      console.log('SI usa BBDD externa');
      if (await isQODBC3() == true) { // Esto pregunta si la BBDD es SQLSERVER.
        console.log('El tipo de BBDD es: QODBC3');
        querySQLSERVER(sqlConfig);
        setTimeout(() => {
          /*
          if (dateDB != null) {
            console.log('Fecha y hora de SQL Server: '+dateDB);
            let arg = [dateDB];
            execFile('./dateTimeUpdater.sh', arg, (error, stdout, stderr) => {                  
              if (error) {
                console.log(`error: ${error.message}`);
              } else if (stderr) {
                console.error(`stderr: ${stderr}`);
              } else {
                console.log(`stdout: ${stdout}`);
              }                      
            });
          } else {
            console.log('dateDB NO actualizada: No se obtuvo fecha y hora de BBDD SQL SERVER');
          }
          */
          if (resultado != null){
            for (let i = 0; i < resultado.length; i++) {
              //console.log('La consulta SQLSERVER esta compuesta por: '+JSON.stringify(Object.values(resultado[i])));
              let barcode = Object.values(resultado[i])[0];
              let nombre = Object.values(resultado[i])[1];
              let precio = Object.values(resultado[i])[2];
              try {
                req = pool.query(`select create_product_vicl(character varying '${barcode}',character varying '${nombre}', ${precio})`);
                console.log('Producto '+(i+1)+' actualizado en BBDD local');
              } catch (e){
                console.log(e);
                console.log('No se pudieron cargar los productos en la BBDD local');
              } 
            }
            console.log('Productos actualizados exitosamente!');
            currentTime = moment().format('hh:mm:ss');
            console.log(currentTime);
          } else {
            console.log('Productos NO actualizados: No se obtuvieron productos de BBDD SQL SERVER');
          }
        }, 5000);

      } else {
        console.log('El tipo de BBDD NO es QODBC3');
      }
    } else {
      console.log('NO usa BBDD externa');
    }            
  }, time * 60000);   
    
}



export const getSyncTime = async(req, res) => {
  let result = await syncTime(req);
  console.log('result is: '+result);
  res.setHeader('Content-Type', 'application/json');
  res.json(result);
}

export const setSyncTime = async(req, res) => {
  let data = req.body;
  let update_time = data.time;
  try {
      req = await pool.query('UPDATE configuracion SET update_time = '+update_time);
      console.log('Actualizando update_time...');      
  } catch (e){
      console.log(e);
      console.log('No se pudo actualizar update_time');
  }
}

export const getLastUpdated = async(req, res) => {
  let last_update;
  try {
      req = await pool.query(`SELECT to_char(updated, 'YYYY/MM/DD HH24:MI:SS') from product order by updated desc limit 1`);      
      last_update = req.rows[0].to_char;
      console.log(req.rows[0].to_char);
      //last_update = last_update.replace('"', '');
      console.log('last_updated: '+last_update); 
      res.setHeader('Content-Type', 'application/json');
      res.json(last_update);
  } catch (e){
      console.log(e);
      console.log('No se pudo traer last_updated');
  }
}

export const dateTimeUpdater = (req, res) => {
  let dateTime = JSON.stringify(req.body.date);
  console.log('dateTime: '+dateTime);
  
  let arg =['@'+dateTime];
  execFile('./dateTimeUpdater.sh', arg, (error, stdout, stderr) => {                  
    if (error) {
      console.log(`error: ${error.message}`);
    } else if (stderr) {
      console.error(`stderr: ${stderr}`);
    } else {
      console.log(`stdout: ${stdout}`);
      res
        .header('Access-Control-Allow-Origin', '*')
        .set("Content-Security-Policy", "script-src 'self' 'unsafe-inline' 'unsafe-eval'")
        .status(200);
    }                      
  });
  

}