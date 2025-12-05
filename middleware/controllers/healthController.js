const { exec } = require('child_process');
const net = require('net');

// Helper to check TCP connection
const checkPort = (port, host = '127.0.0.1') => {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        const start = Date.now();

        socket.setTimeout(2000); // 2s timeout

        socket.on('connect', () => {
            const latency = Date.now() - start;
            socket.destroy();
            resolve({ status: 'healthy', latency });
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve({ status: 'down', error: 'timeout' });
        });

        socket.on('error', (err) => {
            socket.destroy();
            resolve({ status: 'down', error: err.message });
        });

        socket.connect(port, host);
    });
};

// Helper to check replicas via Docker
const checkReplicas = () => {
    return new Promise((resolve) => {
        // Check for contract_service processes inside the container
        exec('docker exec resilientdb-container ps aux', (error, stdout, stderr) => {
            if (error) {
                console.error(`Docker exec error: ${error.message}`);
                return resolve({
                    status: 'down',
                    count: 0,
                    message: 'Failed to execute docker command',
                    details: error.message
                });
            }

            // Count lines containing 'contract_service'
            const lines = stdout.split('\n');
            const serviceLines = lines.filter(line => line.includes('contract_service'));
            const count = serviceLines.length;

            resolve({
                status: count >= 4 ? 'healthy' : 'degraded', // Assuming 4 replicas + 1 client = 5 is ideal, but >=4 is operational
                count: count,
                message: `${count} replica processes running`,
                details: serviceLines
            });
        });
    });
};

exports.getSystemHealth = async (req, res) => {
    try {
        const [replicas, graphql, http] = await Promise.all([
            checkReplicas(),
            checkPort(8000),
            checkPort(18000)
        ]);

        // Determine overall status
        let overallStatus = 'healthy';
        if (replicas.status === 'down' || http.status === 'down') {
            overallStatus = 'down';
        } else if (graphql.status === 'down' || replicas.status === 'degraded') {
            overallStatus = 'degraded';
        }

        res.json({
            overall_status: overallStatus,
            timestamp: new Date().toISOString(),
            components: {
                replicas,
                graphql_api: {
                    ...graphql,
                    url: 'http://127.0.0.1:8000'
                },
                http_api: {
                    ...http,
                    url: 'http://127.0.0.1:18000'
                }
            }
        });
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(500).json({
            overall_status: 'down',
            error: error.message
        });
    }
};
