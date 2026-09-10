const qs = require('node:querystring');
const { RobotHistory } = require('../database/index.js');

/**
 * Helper to safely read JSON body in uWebSockets.js
 * @param {import('uWebSockets.js').HttpResponse} res
 * @returns {Promise<{ data: any, aborted: boolean }>}
 */
function readJsonBody(res) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    let isAborted = false;

    res.onAborted(() => {
      isAborted = true;
      resolve({ data: null, aborted: true });
    });

    res.onData((chunk, isLast) => {
      buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
      if (isLast) {
        if (isAborted) return;
        try {
          const text = buffer.toString('utf8');
          const data = text.trim() ? JSON.parse(text) : {};
          resolve({ data, aborted: false });
        } catch (err) {
          reject(err);
        }
      }
    });
  });
}

/**
 * Register History REST API routes on uWebSockets app
 * @param {import('uWebSockets.js').TemplatedApp} app
 */
function registerHistoryRoutes(app) {
  // CORS Preflight handler for history routes
  app.options('/api/history/*', (res) => {
    res.writeStatus('204 No Content');
    res.writeHeader('Access-Control-Allow-Origin', '*');
    res.writeHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.writeHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end();
  });

  app.options('/api/history', (res) => {
    res.writeStatus('204 No Content');
    res.writeHeader('Access-Control-Allow-Origin', '*');
    res.writeHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.writeHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end();
  });

  app.options('/api/robots/:id/history', (res) => {
    res.writeStatus('204 No Content');
    res.writeHeader('Access-Control-Allow-Origin', '*');
    res.writeHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.writeHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end();
  });

  /**
   * Handler for listing history with filtering & pagination
   * GET /api/history (supports ?robot_id=00001&limit=50&page=1&sort=desc&startDate=...&endDate=...)
   */
  const handleGetHistory = async (res, req, forcedRobotId = null) => {
    // Read query and parameters synchronously before any async call
    const query = qs.parse(req.getQuery()) || {};
    const robotId = forcedRobotId || query.robot_id || query.robotId;
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 1000);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;
    const sortOrder = query.sort === 'asc' ? 1 : -1;

    // Optional date filtering
    const dateFilter = {};
    if (query.startDate) {
      dateFilter.$gte = new Date(query.startDate);
    }
    if (query.endDate) {
      dateFilter.$lte = new Date(query.endDate);
    }

    let isAborted = false;
    res.onAborted(() => {
      isAborted = true;
    });

    try {
      const filter = {};
      if (robotId) {
        filter.$or = [{ robot_id: robotId }, { robotId: robotId }];
      }
      if (Object.keys(dateFilter).length > 0) {
        filter.timestamp = dateFilter;
      }

      const [history, totalCount] = await Promise.all([
        RobotHistory.find(filter)
          .sort({ timestamp: sortOrder })
          .skip(skip)
          .limit(limit)
          .lean(),
        RobotHistory.countDocuments(filter),
      ]);

      if (!isAborted) {
        res.cork(() => {
          res.writeStatus('200 OK');
          res.writeHeader('Content-Type', 'application/json');
          res.writeHeader('Access-Control-Allow-Origin', '*');
          res.writeHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.writeHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.writeHeader('X-Total-Count', String(totalCount));
          res.writeHeader('X-Page', String(page));
          res.writeHeader('X-Limit', String(limit));

          // If client requested wrapper format: ?format=wrapped
          if (query.format === 'wrapped') {
            res.end(
              JSON.stringify({
                success: true,
                total: totalCount,
                page,
                limit,
                data: history,
              })
            );
          } else {
            // Default standard REST array output
            res.end(JSON.stringify(history));
          }
        });
      }
    } catch (error) {
      console.error('Error fetching robot history:', error);
      if (!isAborted) {
        res.cork(() => {
          res.writeStatus('500 Internal Server Error');
          res.writeHeader('Content-Type', 'application/json');
          res.writeHeader('Access-Control-Allow-Origin', '*');
          res.end(
            JSON.stringify({
              error: 'Failed to fetch robot history',
              message: error.message,
            })
          );
        });
      }
    }
  };

  // GET /api/history - List history (filter by ?robot_id=...)
  app.get('/api/history', (res, req) => handleGetHistory(res, req));

  // GET /api/robot-history - Alias
  app.get('/api/robot-history', (res, req) => handleGetHistory(res, req));

  // GET /api/robots/:id/history - List history specifically for one robot
  app.get('/api/robots/:id/history', (res, req) => {
    const robotId = req.getParameter(0);
    handleGetHistory(res, req, robotId);
  });

  /**
   * POST /api/history - Insert new telemetry record
   */
  const handlePostHistory = async (res, req, forcedRobotId = null) => {
    try {
      const { data, aborted } = await readJsonBody(res);
      if (aborted) return;

      const robot_id = forcedRobotId || data.robot_id || data.robotId;

      if (!robot_id) {
        res.cork(() => {
          res.writeStatus('400 Bad Request');
          res.writeHeader('Content-Type', 'application/json');
          res.writeHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ error: 'robot_id is required' }));
        });
        return;
      }

      if (
        data.batteryPercentage === undefined ||
        data.wifiSignalStrength === undefined ||
        data.temperature === undefined ||
        data.memoryUsage === undefined
      ) {
        res.cork(() => {
          res.writeStatus('400 Bad Request');
          res.writeHeader('Content-Type', 'application/json');
          res.writeHeader('Access-Control-Allow-Origin', '*');
          res.end(
            JSON.stringify({
              error:
                'Missing required fields: batteryPercentage, wifiSignalStrength, temperature, memoryUsage',
            })
          );
        });
        return;
      }

      const newHistory = await RobotHistory.create({
        robot_id,
        robotId: robot_id,
        batteryPercentage: Number(data.batteryPercentage),
        wifiSignalStrength: Number(data.wifiSignalStrength),
        isCharging: Boolean(data.isCharging),
        temperature: Number(data.temperature),
        memoryUsage: Number(data.memoryUsage),
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      });

      res.cork(() => {
        res.writeStatus('201 Created');
        res.writeHeader('Content-Type', 'application/json');
        res.writeHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify(newHistory));
      });
    } catch (error) {
      console.error('Error inserting robot history:', error);
      res.cork(() => {
        res.writeStatus('500 Internal Server Error');
        res.writeHeader('Content-Type', 'application/json');
        res.writeHeader('Access-Control-Allow-Origin', '*');
        res.end(
          JSON.stringify({
            error: 'Failed to create robot history record',
            message: error.message,
          })
        );
      });
    }
  };

  // POST /api/history - Insert telemetry data
  app.post('/api/history', (res, req) => handlePostHistory(res, req));

  // POST /api/robot-history - Alias
  app.post('/api/robot-history', (res, req) => handlePostHistory(res, req));

  // POST /api/robots/:id/history - Insert telemetry for specific robot
  app.post('/api/robots/:id/history', (res, req) => {
    const robotId = req.getParameter(0);
    handlePostHistory(res, req, robotId);
  });
}

module.exports = { registerHistoryRoutes };
