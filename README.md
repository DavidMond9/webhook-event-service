# Webhook Event Processing Service

A production-ready webhook event processing service that receives webhooks from multiple third-party property management systems, transforms data according to client-specific rules, and reliably delivers it to various destinations.

## Features

- **Webhook Receipt**: Accepts POST requests with HMAC-SHA256 signature validation
- **Event Storage**: Persists raw events immediately to PostgreSQL
- **Data Transformation**: Transforms events based on client-specific configuration rules
- **Multi-Destination Delivery**: Delivers to HTTP webhooks and PostgreSQL tables
- **Retry Logic**: Exponential backoff with up to 5 retry attempts
- **Idempotency**: Prevents duplicate event processing
- **Admin Endpoint**: View last 100 events per client with status tracking
- **Event Tracking**: Tracks delivery status for each destination

## Architecture

### Core Components

1. **Webhook Receiver** (`src/routes/webhooks.ts`)
   - Validates HMAC-SHA256 signatures
   - Stores events in PostgreSQL immediately
   - Enqueues events for async processing

2. **Queue Worker** (`src/queue/worker.ts`)
   - Processes events from Redis queue
   - Applies transformations based on client config
   - Delivers to multiple destinations (HTTP + PostgreSQL)
   - Updates event status throughout lifecycle

3. **Transformation Engine** (`src/transforms/transformer.ts`)
   - Applies client-specific transformation rules
   - Supports nested field mapping
   - Custom transform functions

4. **Configuration System** (`src/config/loader.ts`)
   - Loads client configurations from YAML
   - Defines transformation rules and destinations per client

5. **Admin API** (`src/routes/admin.ts`)
   - Provides event history and status for debugging

### Data Flow

```
Webhook Received
    ↓
Signature Validation
    ↓
Store in PostgreSQL (RECEIVED status)
    ↓
Enqueue to Redis
    ↓
Worker picks up job
    ↓
Update status (PROCESSING)
    ↓
Transform payload
    ↓
Update status (TRANSFORMED)
    ↓
Deliver to destinations
    ├─→ HTTP webhook
    └─→ PostgreSQL table
    ↓
Update status (SUCCESS/FAILED)
    ↓
Track delivery in event_deliveries table
```

### Key Design Decisions

1. **Immediate Persistence**: Events are stored in PostgreSQL before processing to ensure no data loss, even if the queue fails.

2. **Async Processing**: Using Redis queue decouples webhook receipt from processing, allowing the API to respond quickly while processing happens asynchronously.

3. **Idempotency**: Dedup key based on SHA256 hash of raw body prevents duplicate processing across client_id and source_system.

4. **Status Tracking**: Events move through states (RECEIVED → PROCESSING → TRANSFORMED → SUCCESS/FAILED) providing visibility into the processing pipeline.

5. **Multiple Destinations**: Each client can have multiple destinations (HTTP + PostgreSQL), with independent tracking per destination.

6. **Exponential Backoff**: Retry logic uses 2^attempt seconds delay, providing increasing wait times between retries.

7. **Configuration-Driven**: Client-specific transformations and destinations are defined in YAML, allowing changes without code deployment.

8. **PostgreSQL Delivery**: Automatic schema and table creation for client-specific tables, enabling isolated data storage per client.

## Setup

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd webhook-event-service
   ```

2. **Start services**
   ```bash
   docker-compose up --build -d
   ```

3. **Verify services are running**
   ```bash
   docker-compose ps
   ```

4. **Check logs**
   ```bash
   docker-compose logs -f web
   ```

### Configuration

Edit `config/clients.yaml` to configure client-specific transformations and destinations:

```yaml
clients:
  - id: clientA
    destinations:
      - type: http
        url: https://client-a.example.com/webhook
      - type: postgres
        table: property_updates
        schema: client_a
  - id: clientB
    destinations:
      - type: http
        url: https://client-b.example.com/webhook
      - type: postgres
        table: property_updates
        schema: client_b
```

### Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `WEBHOOK_SECRET`: Secret for HMAC signature validation
- `PORT`: Server port (default: 8080)
- `NODE_ENV`: Environment (development/production)

## API Endpoints

### Webhook Receipt

**POST** `/webhooks/:clientId/:sourceSystem`

Receives webhook events with signature validation.

**Headers:**
- `X-Webhook-Signature`: HMAC-SHA256 signature of request body

**Request Body:**
```json
{
  "unit_id": "bldg-123-unit-45",
  "tenant_name": "John Smith",
  "lease_start": "2024-01-01",
  "monthly_rent": 2500
}
```

**Response:**
```json
{
  "eventId": 123
}
```

**Status Codes:**
- `201`: Event stored and enqueued
- `200`: Duplicate event ignored
- `401`: Invalid signature
- `500`: Internal server error

### Admin Endpoint

**GET** `/admin/clients/:clientId/events`

Returns last 100 events for a client.

**Response:**
```json
{
  "events": [
    {
      "id": 123,
      "receivedAt": "2024-01-01T00:00:00Z",
      "clientId": "clientA",
      "sourceSystem": "propertysysA",
      "status": "SUCCESS",
      "attempts": 1,
      "lastError": null,
      "rawBody": {...},
      "transformedBody": {...}
    }
  ]
}
```

### Test Endpoint

**GET** `/webhooks/test-queue`

Enqueues a test job for development/testing.

## Testing

### Run Tests

```bash
npm test
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Test Coverage

Tests cover:
- Webhook receipt and signature validation
- Event storage and idempotency
- Transformation logic
- Configuration loading
- Admin endpoint
- Worker job enqueuing

## Development

### Local Development

1. **Start dependencies**
   ```bash
   docker-compose up -d db redis
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build TypeScript**
   ```bash
   npm run build
   ```

4. **Run tests**
   ```bash
   npm test
   ```

### Project Structure

```
.
├── src/
│   ├── routes/
│   │   ├── webhooks.ts      # Webhook receipt endpoints
│   │   └── admin.ts          # Admin endpoints
│   ├── queue/
│   │   └── worker.ts         # Queue processing worker
│   ├── transforms/
│   │   └── transformer.ts   # Data transformation logic
│   ├── config/
│   │   └── loader.ts         # Configuration loader
│   ├── db/
│   │   ├── pool.ts           # PostgreSQL connection pool
│   │   └── redisClient.ts    # Redis client
│   └── server.ts             # Express server
├── config/
│   └── clients.yaml          # Client configurations
├── db/
│   └── init.sql             # Database schema
├── test/
│   ├── webhooks.test.ts     # Webhook endpoint tests
│   ├── transformer.test.ts  # Transformation tests
│   ├── admin.test.ts        # Admin endpoint tests
│   ├── config.test.ts       # Configuration tests
│   └── worker.test.ts       # Worker tests
└── docker-compose.yml       # Docker services
```

## Database Schema

### Events Table

Tracks all received events with status and transformation data.

- `id`: Event ID
- `client_id`: Client identifier
- `source_system`: Source system identifier
- `raw_body`: Original payload
- `transformed_body`: Transformed payload
- `status`: Event status (RECEIVED, PROCESSING, TRANSFORMED, SUCCESS, FAILED, PERMANENTLY_FAILED)
- `attempts`: Number of processing attempts
- `last_error`: Last error message
- `dedup_key`: Idempotency key

### Event Deliveries Table

Tracks delivery status for each destination.

- `id`: Delivery record ID
- `event_id`: Foreign key to events
- `destination_type`: 'http' or 'postgres'
- `destination`: Destination URL or schema.table
- `status`: 'SUCCESS' or 'FAILED'
- `attempts`: Number of delivery attempts
- `last_error`: Last error message

## Example Usage

### Sending a Webhook

```bash
# Calculate signature
SECRET="test-secret"
PAYLOAD='{"unit_id":"bldg-123-unit-45","tenant_name":"John Smith"}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

# Send webhook
curl -X POST http://localhost:8080/webhooks/clientA/propertysysA \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

### Viewing Events

```bash
curl http://localhost:8080/admin/clients/clientA/events
```

## Monitoring

Event status can be monitored through:
- Admin endpoint: `/admin/clients/:clientId/events`
- Database queries on `events` and `event_deliveries` tables
- Docker logs: `docker-compose logs -f web`

## Production Considerations

1. **Secret Management**: Use environment variables or secret management service for `WEBHOOK_SECRET`
2. **Database Backups**: Implement regular backups for PostgreSQL
3. **Redis Persistence**: Configure Redis persistence for queue durability
4. **Monitoring**: Add metrics collection (Prometheus, etc.)
5. **Rate Limiting**: Add rate limiting for webhook endpoints
6. **Authentication**: Add authentication for admin endpoints
7. **Logging**: Implement structured logging with correlation IDs
8. **Health Checks**: Add health check endpoints for orchestration
