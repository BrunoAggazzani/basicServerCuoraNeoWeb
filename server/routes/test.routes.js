import { Router } from "express";
import * as authControll from "../controllers/test.controllers";
const router = Router();

router.post('/testSqlServer', authControll.sqlServerConnect);
router.post('/updaterSQLserver', authControll.updaterSQLserver);
router.get('/getSyncTime', authControll.getSyncTime);
router.post('/setSyncTime', authControll.setSyncTime);
router.get('/getLastUpdated', authControll.getLastUpdated);
router.post('/dateTimeUpdater', authControll.dateTimeUpdater);

export default router;