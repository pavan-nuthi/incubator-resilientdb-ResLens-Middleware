const express = require("express");
const { getContainerStats } = require("../controllers/containerStats");
const router = express.Router();

/**
 * Container Stats route
 * @route GET /
 * @returns {Object} 200 - { cpu: "0.00", memory: "0.00" }
 */
router.get("/", getContainerStats);

module.exports = router;
