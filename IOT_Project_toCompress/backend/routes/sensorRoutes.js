const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');

router.get('/chart', sensorController.getChartData);
router.get('/history', sensorController.getSensorHistory);
router.get('/latest', sensorController.getLatestSensorData);

module.exports = router;