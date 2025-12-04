const express = require("express");
const router = express.Router();
const axios = require('axios');
const { buildUrl } = require('../utils/urlHelper');
const { getEnv } = require('../utils/envParser');
const logger = require('../utils/logger');

// In-memory storage for prompts (circular buffer style)
const MAX_PROMPTS = 100;
const prompts = [];

/**
 * Helper to fetch current system metrics
 */
async function fetchSystemMetrics() {
  try {
    const baseUrl = getEnv("NODE_EXPORTER_BASE_URL", "http://localhost:9100");

    // CPU Query: 1 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[1m])))
    // Simplified: 100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[1m])) * 100)
    const cpuQuery = '100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[1m])) * 100)';

    // Memory Query: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100
    const memQuery = '(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100';

    const [cpuRes, memRes] = await Promise.all([
      axios.get(buildUrl(baseUrl, { query: cpuQuery })),
      axios.get(buildUrl(baseUrl, { query: memQuery }))
    ]);

    const cpu = parseFloat(cpuRes.data?.data?.result?.[0]?.value?.[1] || 0).toFixed(2);
    const memory = parseFloat(memRes.data?.data?.result?.[0]?.value?.[1] || 0).toFixed(2);

    return { cpu, memory };
  } catch (error) {
    logger.error("Failed to fetch metrics for MCP prompt:", error.message);
    return { cpu: "N/A", memory: "N/A" };
  }
}

/**
 * POST /api/v1/mcp/prompts
 * Receive a new prompt execution log
 */
router.post("/prompts", async (req, res) => {
  const { tool, args, result, timestamp, duration } = req.body;

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
    metrics
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
