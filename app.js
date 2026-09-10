const { App } = require('uWebSockets.js');
const qs = require('node:querystring');
const { connectDB, RobotHistory } = require('./database/index.js');
const { registerRobotRoutes } = require('./routes/robot.routes.js');
const { registerHistoryRoutes } = require('./routes/history.routes.js');
const { registerLogRoutes } = require('./routes/log.routes.js');

const PORT = process.env.PORT || 8080;

const app = App({
  // Configure for production
  maxCompressedSize: 64 * 1024,
  maxBackpressure: 64 * 1024,
});

// Robot WebSocket connection handler supporting pub/sub broadcast
const robotWsHandler = {
  message: async (ws, message) => {
    try {
      const msgStr = Buffer.from(message).toString();
      const data = JSON.parse(msgStr);
      console.log(`Received data from ${ws.robotId}:`, data);

      const payload = JSON.stringify({
        robotId: ws.robotId,
        id: ws.robotId,
        ...data,
      });

      // Broadcast to global robots topic
      app.publish('robots', payload);

      // Persist incoming telemetry data to robot_history collection
      if (ws.robotId) {
        RobotHistory.create({
          robot_id: ws.robotId,
          robotId: ws.robotId,
          batteryPercentage: data.batteryPercentage,
          wifiSignalStrength: data.wifiSignalStrength,
          isCharging: Boolean(data.isCharging),
          temperature: data.temperature,
          memoryUsage: data.memoryUsage,
          timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        }).catch((err) =>
          console.error(`Error saving history for ${ws.robotId}:`, err.message)
        );
      }
    } catch (error) {
      console.error('Error processing robot message:', error);
    }
  },

  open: (ws) => {
    console.log(`Robot WebSocket connected: ${ws.robotId || 'general'}`);
    ws.subscribe('robots');
  },

  upgrade: (res, req, context) => {
    const upgradeAborted = { aborted: false };
    const secWebSocketKey = req.getHeader('sec-websocket-key');
    const secWebSocketProtocol = req.getHeader('sec-websocket-protocol');
    const secWebSocketExtensions = req.getHeader('sec-websocket-extensions');
    const query = qs.parse(req.getQuery()) || {};

    setTimeout(async () => {
      if (upgradeAborted.aborted) return;
      res.cork(async () => {
        res.upgrade(
          {
            robotId: query.robotId,
          },
          secWebSocketKey,
          secWebSocketProtocol,
          secWebSocketExtensions,
          context
        );
      });
    }, 300);

    res.onAborted(() => {
      upgradeAborted.aborted = true;
    });
  },

  close: (ws) => {
    console.log(`Robot WebSocket disconnected: ${ws.robotId || 'general'}`);
  },
};

app.ws('/robots', robotWsHandler);

app.ws('/dashboard', {
  message: (ws, message) => {
    try {
      const data = JSON.parse(Buffer.from(message).toString());
      console.log('Dashboard message:', data);
    } catch (error) {
      console.error('Error processing dashboard message:', error);
    }
  },

  open: (ws) => {
    console.log('Dashboard client connected');
    ws.subscribe('robots');
  },

  close: (ws, code, message) => {
    console.log('Dashboard client disconnected');
  },
});

// Register REST API routes
registerRobotRoutes(app);
registerHistoryRoutes(app);
registerLogRoutes(app);

app.listen(PORT, (token) => {
  if (token) {
    console.log(`🚀 Robot Fleet Server listening on port ${PORT}`);
  } else {
    console.log('❌ Failed to listen on port', PORT);
    process.exit(1);
  }
});

// Initialize database connection
connectDB().catch(console.error);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n📛 Shutting down server...');
  process.exit(0);
});

module.exports = app;
