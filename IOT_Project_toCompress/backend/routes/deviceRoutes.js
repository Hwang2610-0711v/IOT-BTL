const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');

router.get('/', deviceController.getDevices);
router.post('/:id/control', deviceController.controlDevice);

module.exports = router;