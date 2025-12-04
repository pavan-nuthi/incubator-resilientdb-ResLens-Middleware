const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const logger = require('../utils/logger');

/**
 * Fetches system metrics from Docker container
 * @returns {Promise<{cpu: string, memory: string}>}
 */
async function fetchContainerMetrics() {
    try {
        // Fetch stats for resilientdb-container
        // Format: "CPU%,Mem%" e.g. "0.05%,0.12%"
        const { stdout } = await execPromise('docker stats resilientdb-container --no-stream --format "{{.CPUPerc}},{{.MemPerc}}"');

        const [cpuStr, memStr] = stdout.trim().split(',');

        // Remove '%' and trim
        const cpu = cpuStr ? cpuStr.replace('%', '').trim() : "0.00";
        const memory = memStr ? memStr.replace('%', '').trim() : "0.00";

        return { cpu, memory };
    } catch (error) {
        logger.error("Failed to fetch Docker metrics:", error.message);
        return { cpu: "N/A", memory: "N/A" };
    }
}

/**
 * Express handler to get container stats
 */
async function getContainerStats(req, res) {
    const metrics = await fetchContainerMetrics();
    return res.send(metrics);
}

module.exports = {
    getContainerStats,
    fetchContainerMetrics
};
