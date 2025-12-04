const express = require("express");
const router = express.Router();
const axios = require('axios');
const { buildUrl } = require('../utils/urlHelper');
const { getEnv } = require('../utils/envParser');
const logger = require('../utils/logger');

// In-memory storage for prompts (circular buffer style)
const MAX_PROMPTS = 100;
const prompts = [];

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { fetchContainerMetrics } = require('../controllers/containerStats');

/**
 * Helper to fetch current system metrics from Docker container
 */
async function fetchSystemMetrics() {
  return await fetchContainerMetrics();
}

/**
 * POST /api/v1/mcp/prompts
 * Receive a new prompt execution log
 */
router.post("/prompts", async (req, res) => {
  const { tool, args, result, timestamp, duration, resdb_metrics } = req.body;

  if (!tool) {
    return res.status(400).json({ error: "Missing tool name" });
  }

  // Fetch metrics at the moment of logging
  const metrics = await fetchSystemMetrics();

  const newPrompt = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    tool,
    args: args || {},
    result: result || null,
    timestamp: timestamp || new Date().toISOString(),
    duration: duration || 0,
    receivedAt: new Date().toISOString(),
    metrics,
    resdb_metrics: resdb_metrics || {}
  };

  // Add to beginning of array
  prompts.unshift(newPrompt);

  // Trim if exceeds max
  if (prompts.length > MAX_PROMPTS) {
    prompts.length = MAX_PROMPTS;
  }

  res.status(201).json({ message: "Prompt logged", id: newPrompt.id });
});

/**
 * GET /api/v1/mcp/prompts
 * Retrieve recent prompts
 */
router.get("/prompts", (req, res) => {
  res.json(prompts);
});

module.exports = router;
