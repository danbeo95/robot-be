# Robot Fleet Management Backend

A high-performance real-time backend service powering the Robot Fleet Management Dashboard. Built with **Node.js**, **uWebSockets.js**, **MongoDB (Mongoose)**, and **Pub/Sub WebSocket architecture** for high-throughput robot telemetry streaming and historical data analytics.

---

## 🚀 Priority: How to Run

### 1. Prerequisites

- **Node.js**: **LTS 18.x or 20.x** *(uWebSockets.js uses precompiled native binaries for glibc on macOS/Linux/Windows; Node 18/20 LTS is required).*
- **MongoDB**: Running locally on `mongodb://localhost:27017` or via Docker.
- **Git**: Installed (required for fetching git dependencies).

### 2. Environment Variables

Create or configure your `.env` file in the `backend/` folder (optional, defaults provided):

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `8080` | Port for HTTP REST API and WebSocket server |
| `MONGODB_URI` | `mongodb://localhost:27017/robot-fleet` | MongoDB connection string |
| `NODE_ENV` | `development` | Application environment (`development` / `production`) |

### 3. Installation

From the `backend` directory:

```bash
cd backend
npm install
```

### 4. Database Setup & Seeding

Seed the database with 5 default robots and sample historical telemetry:

```bash
# Seed default robots (00001 to 00005)
npm run seed

# Seed with --clean flag to wipe and re-seed
node scripts/seed-robots.js --clean

# Seed historical telemetry records (20 data points per robot)
npm run seed:history
```

### 5. Running the Backend Server

```bash
# Development mode (with nodemon auto-reloading)
npm run dev

# Production mode
npm start
```

When started, the server listens at:
- **HTTP REST API**: `http://localhost:8080`
- **WebSocket Gateway**: `ws://localhost:8080`

### 6. Running the Robot Telemetry Simulator

In a separate terminal, launch the simulator to simulate 5 active robots transmitting telemetry every second:

```bash
cd backend
npm run simulator
```

### 7. Running with Docker

You can build and run the backend container using the provided `Dockerfile`:

```bash
# Build the Docker image
docker build -t robot-fleet-backend .

# Run container (connecting to host MongoDB)
docker run -p 8080:8080 -e MONGODB_URI="mongodb://host.docker.internal:27017/robot-fleet" robot-fleet-backend
```

---

## 🗄️ Priority: Schema Definition

All models are defined with **Mongoose** under [`backend/database/models/`](file:///Users/danbn/Desktop/source_code/backend/database/models).

### 1. Robot Model (`robots` collection)
Defined in [`backend/database/models/robot.model.js`](file:///Users/danbn/Desktop/source_code/backend/database/models/robot.model.js). Stores robot registry information and latest status.

| Field | Type | Required | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `String` | Yes | Unique, Indexed | Unique robot identifier (e.g. `"00001"`) |
| `descriptions` | `String` | Yes | Synchronized with `description` | Primary description of the robot unit |
| `description` | `String` | No | Synchronized with `descriptions` | Backward-compatibility mirror field |
| `batteryPercentage` | `Number` | No | `min: 0`, `max: 100` | Battery state of charge in % |
| `wifiSignalStrength`| `Number` | No | `min: -100`, `max: 0` | Signal strength in dBm |
| `isCharging` | `Boolean`| No | `default: false` | Charging indicator |
| `temperature` | `Number` | No | - | Internal CPU/core temperature in °C |
| `memoryUsage` | `Number` | No | `min: 0`, `max: 100` | System RAM usage in % |
| `createdAt` | `Date` | Auto | `timestamps: true` | Record creation timestamp |
| `updatedAt` | `Date` | Auto | `timestamps: true` | Record update timestamp |

> **Virtual Fields:**
> - `robot_id`: Virtual getter & setter mapping to `id`.
> - `robotId`: Virtual getter & setter mapping to `id`.

---

### 2. RobotHistory Model (`robot_history` collection)
Defined in [`backend/database/models/robot-history.model.js`](file:///Users/danbn/Desktop/source_code/backend/database/models/robot-history.model.js). Stores time-series telemetry data points emitted by robots.

| Field | Type | Required | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- | :--- |
| `robot_id` | `String` | Yes | Indexed | Robot identifier (synced with `robotId`) |
| `robotId` | `String` | No | Indexed | Backward-compatibility robot identifier |
| `batteryPercentage` | `Number` | Yes | `min: 0`, `max: 100` | Telemetry battery percentage |
| `wifiSignalStrength`| `Number` | Yes | `min: -100`, `max: 0` | Telemetry signal strength (dBm) |
| `isCharging` | `Boolean`| Yes | `default: false` | Telemetry charging status |
| `temperature` | `Number` | Yes | - | Telemetry temperature (°C) |
| `memoryUsage` | `Number` | Yes | `min: 0`, `max: 100` | Telemetry memory utilization (%) |
| `timestamp` | `Date` | Yes | `default: Date.now`, Indexed | Event timestamp |
| `createdAt` | `Date` | Auto | `timestamps: true` | Mongo record creation timestamp |
| `updatedAt` | `Date` | Auto | `timestamps: true` | Mongo record update timestamp |

> **Compound Indexes:**
> - `{ robot_id: 1, timestamp: -1 }`
> - `{ robotId: 1, timestamp: -1 }`

---

### 3. Log Model (`logs` collection)
Defined in [`backend/database/models/log.model.js`](file:///Users/danbn/Desktop/source_code/backend/database/models/log.model.js). Ingests frontend/client diagnostics logs with payload size tracking.

| Field | Type | Required | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- | :--- |
| `connectionId` | `String` | No | Indexed | Client session/connection identifier |
| `entries` | `[String]` | Yes | Array of log lines | Log entries |
| `totalEntries` | `Number` | Yes | - | Total count of entries in the batch |
| `payloadSizeBytes` | `Number` | Yes | Max `65,536` bytes (64 KB) | Serialized size of request body |
| `timestamp` | `Date` | Yes | `default: Date.now`, Indexed | Timestamp of batch ingestion |
| `createdAt` | `Date` | Auto | `timestamps: true` | Mongo record creation timestamp |
| `updatedAt` | `Date` | Auto | `timestamps: true` | Mongo record update timestamp |

---

## 🌐 Priority: API Routes

The backend uses **uWebSockets.js** for high-performance HTTP and WebSocket routing.

### Summary Table

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/robots` *(alias `/robots`)* | List all registered robots enriched with latest telemetry |
| `GET` | `/api/robots/:id` | Get single robot details enriched with latest telemetry |
| `GET` | `/api/history` *(alias `/api/robot-history`)* | List telemetry history (supports filtering, pagination, sorting) |
| `GET` | `/api/robots/:id/history` | List telemetry history for a specific robot |
| `POST`| `/api/history` *(alias `/api/robot-history`)* | Manually insert a historical telemetry entry |
| `POST`| `/api/robots/:id/history` | Insert telemetry for a specific robot |
| `POST`| `/api/logs` | Ingest batch diagnostic logs (strict 64 KB payload limit) |
| `WS` | `/robots?robotId=:id` | WebSocket telemetry streaming & Pub/Sub broadcast |
| `WS` | `/dashboard` | WebSocket client subscription to robot broadcasts |

---

### REST Endpoints Detail

#### 1. List All Robots
```http
GET /api/robots
GET /robots
```
Returns all robots sorted by ID ascending, automatically merged with their most recent telemetry data point from `robot_history`.

**Response `200 OK`:**
```json
[
  {
    "_id": "6aa0d3d7b2ded5ae3264e825",
    "id": "00001",
    "descriptions": "Autonomous warehouse logistics unit...",
    "description": "Autonomous warehouse logistics unit...",
    "batteryPercentage": 85.5,
    "wifiSignalStrength": -55,
    "isCharging": false,
    "temperature": 45.2,
    "memoryUsage": 62,
    "lastSeen": "2026-09-11T01:25:39.000Z",
    "createdAt": "2026-09-09T03:34:47.650Z",
    "updatedAt": "2026-09-09T06:54:54.559Z"
  }
]
```

---

#### 2. Get Single Robot by ID
```http
GET /api/robots/:id
```

- **Path Parameter**: `id` - Robot ID (e.g. `00001`).
- **Response `200 OK`**: Single robot object enriched with latest telemetry.
- **Response `404 Not Found`**:
  ```json
  { "error": "Robot not found", "id": "99999" }
  ```

---

#### 3. Query Telemetry History
```http
GET /api/history
GET /api/robots/:id/history
```

**Query Parameters:**
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `robot_id` / `robotId` | `string` | optional | Filter by robot ID (implicit in `/api/robots/:id/history`) |
| `limit` | `number` | `50` | Records per page (min: `1`, max: `1000`) |
| `page` | `number` | `1` | Page number |
| `sort` | `string` | `desc` | `asc` for chronological or `desc` for newest first |
| `startDate` | `ISO8601 string` | optional | Filter `>=` date |
| `endDate` | `ISO8601 string` | optional | Filter `<=` date |
| `format` | `string` | optional | Set to `wrapped` for metadata envelope |

**Response Headers:**
- `X-Total-Count`: Total matched records
- `X-Page`: Current page
- `X-Limit`: Current limit

**Default Response `200 OK` (Standard Array):**
```json
[
  {
    "_id": "6732a1e...",
    "robot_id": "00001",
    "robotId": "00001",
    "batteryPercentage": 85.5,
    "wifiSignalStrength": -55,
    "isCharging": false,
    "temperature": 45.2,
    "memoryUsage": 62,
    "timestamp": "2026-09-11T01:25:39.000Z"
  }
]
```

**Wrapped Format Response `200 OK` (`?format=wrapped`):**
```json
{
  "success": true,
  "total": 1200,
  "page": 1,
  "limit": 50,
  "data": [ /* Array of records */ ]
}
```

---

#### 4. Ingest Historical Telemetry
```http
POST /api/history
POST /api/robots/:id/history
```

**Request Body (`application/json`):**
```json
{
  "robot_id": "00001",
  "batteryPercentage": 85.5,
  "wifiSignalStrength": -55,
  "isCharging": false,
  "temperature": 45.2,
  "memoryUsage": 62,
  "timestamp": "2026-09-11T01:25:39.000Z"
}
```

- **Response `201 Created`**: Returns created `RobotHistory` document.
- **Response `400 Bad Request`**: Missing required fields.

---

#### 5. Ingest Diagnostic Logs
```http
POST /api/logs
```

Ingests client batch logs with strict **64 KB maximum payload limit**.

**Request Body (`application/json`):**
```json
{
  "connectionId": "client-uuid-12345",
  "entries": [
    "2026-09-11T01:20:00.000Z [INFO] Initialized dashboard connection",
    "2026-09-11T01:20:05.000Z [WARN] Robot 00001 battery below 20%"
  ]
}
```
*(Supports raw array format `["log 1", "log 2"]` or object format).*

- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "message": "Logs successfully captured and persisted to database.",
    "id": "6732a1...",
    "savedCount": 2,
    "payloadSizeBytes": 248,
    "timestamp": "2026-09-11T01:25:40.000Z"
  }
  ```
- **Response `413 Payload Too Large`**: If request body exceeds 64 KB (65,536 bytes).
- **Response `400 Bad Request`**: If payload contains no log entries or invalid JSON.

---

### WebSocket Endpoints

#### 1. Robot Telemetry Ingestion & Broadcast
- **URL**: `ws://localhost:8080/robots?robotId=00001`
- **Role**: Connected robots stream JSON telemetry every second.
- **Incoming Frame Format (from Robot)**:
  ```json
  {
    "batteryPercentage": 85.5,
    "wifiSignalStrength": -45,
    "isCharging": false,
    "temperature": 42.3,
    "memoryUsage": 67,
    "timestamp": "2026-09-11T01:25:39.000Z"
  }
  ```
- **Action**:
  1. The server injects `robotId` and persists the record to the `robot_history` collection.
  2. The server broadcasts the enriched payload to all subscribers on the `'robots'` topic.

#### 2. Dashboard Real-time Subscription
- **URL**: `ws://localhost:8080/dashboard` or `ws://localhost:8080/robots`
- **Role**: Clients connect to receive live pub/sub telemetry broadcasts from all robots.
- **Broadcasted Frame Format**:
  ```json
  {
    "robotId": "00001",
    "id": "00001",
    "batteryPercentage": 85.5,
    "wifiSignalStrength": -45,
    "isCharging": false,
    "temperature": 42.3,
    "memoryUsage": 67,
    "timestamp": "2026-09-11T01:25:39.000Z"
  }
  ```
