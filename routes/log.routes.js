const { Log } = require('../database/index.js');

const MAX_PAYLOAD_BYTES = 64 * 1024; // 64 KB (65,536 bytes)

/**
 * Safely read raw body and JSON in uWebSockets.js with payload size tracking
 * @param {import('uWebSockets.js').HttpResponse} res
 * @returns {Promise<{ data: any, rawBytes: number, aborted: boolean }>}
 */
function readJsonBody(res) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    let isAborted = false;

    res.onAborted(() => {
      isAborted = true;
      resolve({ data: null, rawBytes: 0, aborted: true });
    });

    res.onData((chunk, isLast) => {
      buffer = Buffer.concat([buffer, Buffer.from(chunk)]);

      if (isLast) {
        if (isAborted) return;
        const rawBytes = buffer.length;
        try {
          const text = buffer.toString('utf8');
          const data = text.trim() ? JSON.parse(text) : {};
          resolve({ data, rawBytes, aborted: false });
        } catch (err) {
          reject(err);
        }
      }
    });
  });
}

/**
 * Register Log REST API routes on uWebSockets app
 * @param {import('uWebSockets.js').TemplatedApp} app
 */
function registerLogRoutes(app) {
  // CORS Preflight handler
  app.options('/api/logs', (res) => {
    res.writeStatus('204 No Content');
    res.writeHeader('Access-Control-Allow-Origin', '*');
    res.writeHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.writeHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end();
  });

  /**
   * POST /api/logs
   * Ingest and persist log batch with strict 64 KB payload validation
   */
  app.post('/api/logs', async (res) => {
    let isAborted = false;
    res.onAborted(() => {
      isAborted = true;
    });

    try {
      const { data, rawBytes, aborted } = await readJsonBody(res);
      if (aborted || isAborted) return;

      // Enforce strict 64 KB limit
      if (rawBytes > MAX_PAYLOAD_BYTES) {
        res.cork(() => {
          res.writeStatus('413 Payload Too Large');
          res.writeHeader('Content-Type', 'application/json');
          res.writeHeader('Access-Control-Allow-Origin', '*');
          res.end(
            JSON.stringify({
              error: 'Payload Too Large',
              message: `Payload of ${rawBytes} bytes exceeds the maximum allowed 64 KB (${MAX_PAYLOAD_BYTES} bytes).`,
              maxAllowedBytes: MAX_PAYLOAD_BYTES,
              actualBytes: rawBytes,
            })
          );
        });
        return;
      }

      // Extract entries array
      let entries = [];
      let connectionId = null;

      if (Array.isArray(data)) {
        entries = data;
      } else if (data && typeof data === 'object') {
        connectionId = data.connectionId || null;
        if (Array.isArray(data.entries)) {
          entries = data.entries;
        } else if (Array.isArray(data.logs)) {
          entries = data.logs;
        } else if (data.entry) {
          entries = [String(data.entry)];
        }
      }

      if (!entries || entries.length === 0) {
        res.cork(() => {
          res.writeStatus('400 Bad Request');
          res.writeHeader('Content-Type', 'application/json');
          res.writeHeader('Access-Control-Allow-Origin', '*');
          res.end(
            JSON.stringify({
              error: 'Bad Request',
              message: 'No log entries provided in request payload.',
            })
          );
        });
        return;
      }

      // Persist completely to MongoDB
      const savedDoc = await Log.create({
        connectionId,
        entries,
        totalEntries: entries.length,
        payloadSizeBytes: rawBytes,
        timestamp: new Date(),
      });

      console.log(
        `📝 Saved log batch: ${entries.length} entries (${rawBytes} bytes) [ID: ${savedDoc._id}]`
      );

      res.cork(() => {
        res.writeStatus('201 Created');
        res.writeHeader('Content-Type', 'application/json');
        res.writeHeader('Access-Control-Allow-Origin', '*');
        res.end(
          JSON.stringify({
            success: true,
            message: 'Logs successfully captured and persisted to database.',
            id: savedDoc._id,
            savedCount: entries.length,
            payloadSizeBytes: rawBytes,
            timestamp: savedDoc.timestamp,
          })
        );
      });
    } catch (err) {
      console.error('Error ingesting logs:', err);
      if (!isAborted) {
        res.cork(() => {
          res.writeStatus(err instanceof SyntaxError ? '400 Bad Request' : '500 Internal Server Error');
          res.writeHeader('Content-Type', 'application/json');
          res.writeHeader('Access-Control-Allow-Origin', '*');
          res.end(
            JSON.stringify({
              error: err instanceof SyntaxError ? 'Invalid JSON' : 'Server Error',
              message: err.message,
            })
          );
        });
      }
    }
  });

}

module.exports = {
  registerLogRoutes,
  MAX_PAYLOAD_BYTES,
};
