const { Robot, RobotHistory } = require('../database/index.js');

/**
 * Register REST API routes for robots on the uWebSockets.js app instance.
 * @param {import('uWebSockets.js').TemplatedApp} app 
 */
function registerRobotRoutes(app) {
  // CORS Preflight handler
  app.options('/api/*', (res) => {
    res.writeHeader('Access-Control-Allow-Origin', '*');
    res.writeHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.writeHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end();
  });

  // Handler function for listing robots
  const handleGetRobots = async (res) => {
    let isAborted = false;
    res.onAborted(() => {
      isAborted = true;
    });

    try {
      const robots = await Robot.find({}).sort({ id: 1 }).lean();

      // Enrich each robot with its latest telemetry from RobotHistory
      const enrichedRobots = await Promise.all(
        robots.map(async (robot) => {
          const robotId = robot.id || robot.robot_id;
          const latest = await RobotHistory.findOne({
            $or: [{ robot_id: robotId }, { robotId: robotId }, { id: robotId }],
          })
            .sort({ timestamp: -1 })
            .lean();

          if (latest) {
            return {
              ...robot,
              batteryPercentage: latest.batteryPercentage,
              wifiSignalStrength: latest.wifiSignalStrength,
              isCharging: latest.isCharging,
              temperature: latest.temperature,
              memoryUsage: latest.memoryUsage,
              lastSeen: latest.timestamp,
            };
          }
          return robot;
        })
      );

      if (!isAborted) {
        res.cork(() => {
          res.writeHeader('Content-Type', 'application/json');
          res.writeHeader('Access-Control-Allow-Origin', '*');
          res.writeHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.writeHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.end(JSON.stringify(enrichedRobots));
        });
      }
    } catch (error) {
      console.error('Error fetching robots list:', error);
      if (!isAborted) {
        res.cork(() => {
          res.writeStatus('500 Internal Server Error');
          res.writeHeader('Content-Type', 'application/json');
          res.writeHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ error: 'Failed to fetch robots', message: error.message }));
        });
      }
    }
  };

  // GET /api/robots - List all robots
  app.get('/api/robots', handleGetRobots);

  // GET /robots - Convenience alias for listing robots
  app.get('/robots', handleGetRobots);

  // GET /api/robots/:id - Get specific robot by ID
  app.get('/api/robots/:id', async (res, req) => {
    // Synchronously read parameters before entering any async operation
    const targetId = req.getParameter(0);
    let isAborted = false;
    res.onAborted(() => {
      isAborted = true;
    });

    try {
      const robot = await Robot.findOne({
        $or: [{ robot_id: targetId }, { id: targetId }, { robotId: targetId }],
      }).lean();

      if (robot) {
        const robotId = robot.id || robot.robot_id;
        const latest = await RobotHistory.findOne({
          $or: [{ robot_id: robotId }, { robotId: robotId }, { id: robotId }],
        })
          .sort({ timestamp: -1 })
          .lean();

        if (latest) {
          robot.batteryPercentage = latest.batteryPercentage;
          robot.wifiSignalStrength = latest.wifiSignalStrength;
          robot.isCharging = latest.isCharging;
          robot.temperature = latest.temperature;
          robot.memoryUsage = latest.memoryUsage;
          robot.lastSeen = latest.timestamp;
        }
      }

      if (!isAborted) {
        res.cork(() => {
          if (!robot) {
            res.writeStatus('404 Not Found');
            res.writeHeader('Content-Type', 'application/json');
            res.writeHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ error: 'Robot not found', id: targetId }));
          } else {
            res.writeStatus('200 OK');
            res.writeHeader('Content-Type', 'application/json');
            res.writeHeader('Access-Control-Allow-Origin', '*');
            res.writeHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.writeHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.end(JSON.stringify(robot));
          }
        });
      }
    } catch (error) {
      console.error(`Error fetching robot ${targetId}:`, error);
      if (!isAborted) {
        res.cork(() => {
          res.writeStatus('500 Internal Server Error');
          res.writeHeader('Content-Type', 'application/json');
          res.writeHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ error: 'Failed to fetch robot', message: error.message }));
        });
      }
    }
  });
}

module.exports = { registerRobotRoutes };
