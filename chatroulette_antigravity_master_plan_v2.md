# Production-Grade Random Video Chat Platform
## Antigravity Architecture & Phased Implementation Specification

> **Purpose:** Use this document as the master planning prompt for Antigravity.  
> **Critical rule:** Plan and architect the system before writing substantial code. Maintain this document throughout implementation.

---

## 1. Mission

Build a production-grade random video/audio chat platform similar in concept to Chatroulette.

The platform must support:

- Real two-way video transmission.
- Real two-way audio transmission.
- Random matchmaking.
- Skip/rematch.
- Reliable WebRTC signaling.
- STUN/TURN NAT traversal.
- Connection recovery.
- Camera/microphone permission handling.
- Device switching.
- Reporting and blocking.
- Abuse prevention and rate limiting.
- Anonymous sessions with server-side safety controls.
- Horizontal scalability.
- Observability and production monitoring.
- Automated tests.
- Production deployment.

This is **not a prototype**. Do not fake core functionality.

---

# 2. Non-Negotiable Development Rule

## PLAN FIRST — CODE SECOND

Before substantial implementation:

1. Inspect the existing repository.
2. Identify constraints and reusable code.
3. Define functional requirements.
4. Define non-functional requirements.
5. Design the complete architecture.
6. Design WebRTC signaling.
7. Design matchmaking state machines.
8. Design database and Redis usage.
9. Design security and abuse controls.
10. Design observability.
11. Design testing.
12. Design deployment.
13. Identify race conditions and failure scenarios.
14. Create a phased implementation plan.

Create and maintain:

`PLANNING.md`

This is the authoritative architecture and execution plan.

Do not start by generating hundreds of files.

---

# 3. Recommended Technology Stack

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- Zustand or equivalent lightweight state manager
- Zod
- WebRTC browser APIs
- Playwright for E2E

## Backend

Recommended:

- Node.js
- TypeScript
- Fastify

NestJS is acceptable if the project benefits from its stronger conventions.

Backend responsibilities:

- Session management
- Presence
- Matchmaking
- WebSocket signaling
- Reports
- Blocks
- Moderation
- Rate limiting
- TURN credential generation
- Observability

**Do not route normal media through the application backend.**

## Data

- PostgreSQL for durable data.
- Redis for ephemeral distributed state.

Redis should handle:

- Matchmaking queues
- Presence
- Distributed locks
- Rate limits
- Pub/Sub
- Temporary signaling state

## WebRTC

- Native browser WebRTC APIs
- STUN
- TURN
- coturn for self-hosted TURN

Use short-lived TURN credentials.

## Infrastructure

A cloud provider such as AWS, GCP, Azure, Cloudflare, Fly.io, Hetzner, Render, or equivalent may be used.

Choose based on:

- WebSocket support
- TURN networking
- bandwidth cost
- observability
- scalability
- operational simplicity

---

# 4. High-Level Architecture

```text
                         ┌───────────────────────┐
                         │       Browser A       │
                         │ Camera + Microphone   │
                         └───────────┬───────────┘
                                     │
                                     │ WebSocket
                                     ▼
                         ┌───────────────────────┐
                         │ Signaling / API Layer │
                         │                       │
                         │ Sessions              │
                         │ Presence              │
                         │ Matchmaking           │
                         │ WebRTC Signaling      │
                         │ Reports / Moderation  │
                         └───────────┬───────────┘
                                     │
                     ┌───────────────┼───────────────┐
                     ▼                               ▼
              ┌─────────────┐                 ┌──────────────┐
              │    Redis    │                 │  PostgreSQL  │
              │             │                 │              │
              │ Queue       │                 │ Reports      │
              │ Presence    │                 │ Blocks       │
              │ Locks       │                 │ Bans         │
              │ Rate limits │                 │ Audit logs   │
              │ Pub/Sub     │                 │ Analytics    │
              └─────────────┘                 └──────────────┘

Browser A  <========== WebRTC Media ==========>  Browser B
             Video + Audio

                         TURN
              used when direct P2P fails
```

The backend is primarily a **control/signaling plane**.

The video/audio media path should be:

```text
Browser A <---- WebRTC ----> Browser B
```

with TURN relaying media only when required.

---

# 5. Repository Structure

Recommended:

```text
/
├── apps/
│   ├── web/
│   └── server/
│
├── packages/
│   ├── shared/
│   ├── protocol/
│   └── config/
│
├── infrastructure/
│   ├── docker/
│   ├── terraform/
│   └── deployment/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docs/
│
├── PLANNING.md
├── README.md
├── .env.example
├── Dockerfile
└── docker-compose.yml
```

Adjust only when there is a documented architectural reason.

---

# 6. Core State Machines

## Session State

```text
NEW
 ↓
INITIALIZING
 ↓
READY
 ↓
DISCONNECTED
 ↓
EXPIRED
```

## Matchmaking State

```text
IDLE
 ↓
REQUESTING_MEDIA
 ↓
SEARCHING
 ↓
MATCH_FOUND
 ↓
CONNECTING
 ↓
CONNECTED
 ↓
ENDING
 ↓
IDLE
```

Possible recovery:

```text
CONNECTED
   ↓
DISCONNECTED
   ↓
RECONNECTING
   ├── CONNECTED
   └── FAILED
          ↓
        IDLE
```

No user may remain indefinitely in:

- SEARCHING
- MATCH_FOUND
- CONNECTING
- RECONNECTING
- ENDING

Every asynchronous state needs a timeout.

---

# 7. Matchmaking Design

Matchmaking must be server-authoritative.

A user can belong to only one active match.

Use atomic Redis operations or equivalent distributed locking.

Protect against:

- duplicate matches
- stale queue entries
- simultaneous skip
- simultaneous disconnect
- refresh during matching
- two browser tabs
- delayed messages
- worker races
- server restarts

Example:

```text
User A -> SEARCHING
User B -> SEARCHING

Atomic reservation

A + B -> MATCH_FOUND

Both users are removed from the queue.

Only then is signaling started.
```

Never allow:

```text
A -> B
A -> C
B -> D
```

from race conditions.

---

# 8. WebSocket Protocol

Use a versioned, validated protocol.

Client events:

```text
session:init
queue:join
queue:leave
match:accept
match:skip
webrtc:offer
webrtc:answer
webrtc:ice-candidate
match:report
heartbeat
```

Server events:

```text
session:ready
queue:joined
queue:left
match:found
match:cancelled
webrtc:offer
webrtc:answer
webrtc:ice-candidate
peer:disconnected
error
```

Every event should define:

- event name
- protocol version
- schema
- request ID where applicable
- match ID where applicable
- validation rules
- error behavior

Never trust client-provided:

- user identity
- match ownership
- peer identity
- authorization
- state transitions

---

# 9. WebRTC Architecture

Create a dedicated WebRTC service/module.

Suggested frontend structure:

```text
features/webrtc/
├── WebRTCManager.ts
├── PeerConnection.ts
├── MediaManager.ts
├── DeviceManager.ts
├── ConnectionMonitor.ts
├── SignalingClient.ts
└── types.ts
```

React components should not contain the entire WebRTC implementation.

The WebRTC layer must handle:

- getUserMedia
- MediaStream lifecycle
- RTCPeerConnection
- offer
- answer
- ICE candidates
- remote tracks
- cleanup
- connection monitoring
- ICE restart
- device replacement

---

# 10. Required WebRTC Behavior

Support:

- Video sending.
- Video receiving.
- Audio sending.
- Audio receiving.
- Camera mute.
- Microphone mute.
- Camera switching.
- Microphone switching.
- Device changes.
- Remote track changes.
- ICE restart.
- Network recovery.
- TURN fallback.

Monitor:

```text
signalingState
iceConnectionState
connectionState
iceGatheringState
```

Handle:

```text
new
checking
connected
completed
disconnected
failed
closed
```

---

# 11. STUN / TURN

Production must include TURN.

Use coturn or a managed equivalent.

Support:

- STUN
- TURN UDP
- TURN TCP
- TURN TLS where necessary

TURN credentials must be temporary.

Never expose permanent TURN secrets in frontend code.

The backend should generate or broker short-lived credentials.

Test both:

1. Direct P2P connectivity.
2. TURN-relayed connectivity.

---

# 12. Media and Device Handling

Handle browser errors such as:

```text
NotAllowedError
NotFoundError
NotReadableError
OverconstrainedError
SecurityError
AbortError
```

Provide human-readable UI.

Do not expose raw browser exceptions.

Handle:

```text
navigator.mediaDevices.enumerateDevices()
navigator.mediaDevices.addEventListener("devicechange", ...)
```

Cases:

- camera removed
- microphone removed
- device added
- device permission changed
- camera already in use
- microphone already in use
- device becomes unavailable during a call

Attempt graceful fallback where possible.

---

# 13. Browser Compatibility

Test:

- Chrome
- Edge
- Firefox
- Safari
- Android Chrome
- iOS Safari

Pay special attention to:

- autoplay restrictions
- remote audio playback
- iOS WebRTC behavior
- backgrounding
- mobile network switching
- camera switching
- Bluetooth audio
- permission persistence
- device changes

A desktop-only implementation is not acceptable.

---

# 14. Audio Reliability

Audio must be treated independently from video.

Verify:

- local microphone capture
- remote audio track arrival
- remote audio playback
- mute/unmute
- device changes
- autoplay restrictions
- Bluetooth transitions

Do not assume that because the video works, audio works.

Create explicit audio tests.

---

# 15. Connection Recovery

Example:

```text
CONNECTED
   ↓
DISCONNECTED
   ↓
short recovery wait
   ↓
still disconnected?
   ↓
ICE restart
   ↓
CONNECTING
   ├── CONNECTED
   └── FAILED
          ↓
        END MATCH
          ↓
       SEARCH AGAIN
```

Do not instantly destroy a connection because of a temporary network interruption.

Do not retry forever.

Use bounded retry strategies.

---

# 16. Skip

Skip must be idempotent.

Flow:

```text
User clicks Skip
 ↓
Disable repeated action
 ↓
Server validates match ownership
 ↓
Terminate match
 ↓
Cleanup WebRTC
 ↓
Notify peer
 ↓
Return to SEARCHING
```

Handle:

- skip + disconnect
- skip + match found
- double click
- delayed skip message
- skip during reconnect

Only one terminal match transition should win.

---

# 17. Disconnect Handling

Handle:

- browser close
- tab close
- refresh
- laptop sleep
- mobile background
- Wi-Fi loss
- cellular transition
- server disconnect
- heartbeat timeout

Use heartbeat/presence.

Stale users must eventually be removed from queues and matches.

---

# 18. Multiple Tabs

Define explicit behavior.

Recommended:

- one active session per browser/device identity
- secondary tabs should be detected
- prevent duplicate matchmaking participation

Do not allow two tabs to accidentally create two independent active matches for one session.

---

# 19. Database Model

PostgreSQL tables may include:

```text
sessions
users
matches
reports
blocks
bans
moderation_actions
audit_logs
system_events
```

Use:

- UUIDs
- foreign keys
- indexes
- unique constraints
- timestamps
- retention policies

Persist only data that is actually needed.

---

# 20. Redis Design

Redis should contain ephemeral state such as:

```text
presence
waiting queues
active sessions
active matches
distributed locks
rate limits
temporary signaling state
pub/sub
```

Do not depend on process-local memory for critical distributed state.

---

# 21. Security

Implement:

- HTTPS
- WSS
- secure cookies where applicable
- strict CORS
- CSP
- security headers
- input validation
- output encoding
- rate limiting
- WebSocket message limits
- session expiration
- secret management
- least-privilege database access
- Redis authentication
- short-lived TURN credentials
- audit logging

Never commit secrets.

Provide:

`.env.example`

---

# 22. Abuse Prevention

Because this is a stranger-chat platform, abuse prevention is a core feature.

Implement:

- IP rate limiting
- session rate limiting
- matchmaking rate limiting
- skip throttling
- WebSocket message throttling
- report throttling
- connection limits
- temporary bans
- permanent bans
- moderation hooks
- abuse detection hooks

Frontend restrictions are not sufficient.

---

# 23. Reporting

Support categories such as:

- Sexual/nudity content
- Harassment
- Hate/abuse
- Threats
- Spam
- Scam
- Underage concern
- Other

Store:

- report ID
- reporter/session
- reported session/user
- match ID
- timestamp
- category
- optional description

Avoid recording video/audio unless the product intentionally adopts the required privacy, consent, retention, and legal framework.

---

# 24. Blocking

Implement blocking.

A blocked peer should not be matched again.

Design this for scalability.

Do not perform expensive full-table scans on every matchmaking request.

---

# 25. Safety and Product Pages

Include:

```text
/privacy
/terms
/community-guidelines
/safety
```

Clearly explain:

- camera/microphone usage
- privacy
- prohibited behavior
- reporting
- blocking
- moderation

Design an age/safety strategy appropriate for a random stranger-chat product.

---

# 26. UI States

The UI must have explicit states:

```text
initial
requesting-media
permission-denied
media-error
ready
searching
match-found
connecting
connected
reconnecting
peer-disconnected
skipped
reporting
error
```

Core controls:

- microphone
- camera
- skip
- report
- block where appropriate
- settings/device selection

---

# 27. UX for Permissions

Explain why camera and microphone are required before requesting permission.

Handle:

- camera denied
- microphone denied
- both denied
- device unavailable
- permission revoked later

Do not leave the user staring at an infinite spinner.

---

# 28. Observability

Implement structured logs.

Useful fields:

```text
requestId
sessionId
matchId
event
severity
timestamp
```

Never log:

- raw audio
- raw video
- unnecessary sensitive information

Metrics:

```text
active_sessions
waiting_users
matches_per_minute
match_success_rate
average_match_latency
webrtc_success_rate
webrtc_failure_rate
average_connection_duration
turn_usage
signaling_errors
socket_disconnects
reports_per_minute
```

Provide:

```text
/health
/ready
```

with proper liveness/readiness semantics.

---

# 29. Error Tracking

Use Sentry or equivalent.

Capture:

- frontend errors
- backend errors
- WebRTC errors
- signaling errors
- matchmaking failures

Sanitize sensitive data.

---

# 30. Testing Strategy

## Unit Tests

Test:

- state machines
- matchmaking
- validation
- rate limits
- session lifecycle
- match lifecycle

## Integration Tests

Test:

- PostgreSQL
- Redis
- WebSocket protocol
- matchmaking
- signaling

## E2E Tests

Use Playwright.

Minimum scenario:

```text
Browser A opens
Browser B opens
Both grant camera/microphone
Both join queue
Match occurs
Offer exchanged
Answer exchanged
ICE exchanged
Video appears
Audio works
A clicks Skip
A returns to queue
New match occurs
B receives disconnect
```

---

# 31. WebRTC Test Matrix

Explicitly test:

- direct connection
- TURN connection
- ICE failure
- ICE restart
- temporary network loss
- Wi-Fi → cellular
- camera removal
- microphone removal
- permission denial
- browser refresh
- browser close
- remote peer disconnect
- server reconnect

The most important manual test:

> Two real browser instances on different networks must establish a real bidirectional WebRTC video/audio session.

---

# 32. Performance

Measure:

- concurrent WebSocket connections
- matchmaking latency
- signaling latency
- Redis throughput
- database load
- CPU
- memory
- TURN bandwidth
- WebRTC connection success

Load test the matchmaking and signaling layers separately from media.

---

# 33. Horizontal Scaling

Architecture must support:

```text
                    Load Balancer
                         |
          +--------------+--------------+
          |              |              |
       Server A       Server B       Server C
          |              |              |
          +--------------+--------------+
                         |
                       Redis
                         |
                    PostgreSQL
```

WebSocket scaling must use either:

- appropriate sticky-session strategy, or
- shared pub/sub/session architecture.

Do not rely on process memory.

---

# 34. Failure Scenarios

Explicitly design behavior for:

- Redis unavailable
- PostgreSQL unavailable
- TURN unavailable
- signaling server restart
- server crash
- browser crash
- network loss
- stale queue entry
- stale match
- duplicate message
- delayed ICE candidate
- late answer
- duplicate skip
- duplicate match
- two tabs
- refresh during WebRTC setup

Every failure must have a defined outcome.

---

# 35. Docker and Local Development

Provide:

```text
Dockerfile
docker-compose.yml
docker-compose.dev.yml
```

Local development should be as close as practical to production.

Services:

- frontend
- backend
- PostgreSQL
- Redis
- TURN where practical

---

# 36. CI/CD

Pipeline:

```text
install
 ↓
lint
 ↓
typecheck
 ↓
unit tests
 ↓
integration tests
 ↓
build
 ↓
security checks
 ↓
E2E
 ↓
deploy
```

Broken builds must not reach production.

---

# 37. Implementation Phases

## Phase 0 — Discovery and Architecture

Deliver:

- repository assessment
- requirements
- architecture
- diagrams
- state machines
- data model
- WebSocket protocol
- WebRTC design
- security model
- testing plan
- deployment plan
- risk register

No substantial application coding yet.

---

## Phase 1 — Foundation

Implement:

- repository structure
- frontend
- backend
- shared types
- environment config
- logging
- error handling
- PostgreSQL
- Redis
- health checks
- Docker
- CI foundation

---

## Phase 2 — Session and Presence

Implement:

- anonymous sessions
- session expiration
- heartbeats
- presence
- disconnect detection
- reconnect
- multi-tab handling

---

## Phase 3 — Matchmaking

Implement:

- waiting queue
- atomic matching
- match lifecycle
- skip
- disconnect
- stale cleanup
- race-condition protection

---

## Phase 4 — WebRTC

Implement:

- media capture
- local preview
- peer connection
- offer/answer
- ICE
- STUN
- TURN
- remote video
- remote audio
- connection monitoring
- ICE restart
- cleanup

---

## Phase 5 — Device and Recovery

Implement:

- device selection
- camera switching
- microphone switching
- devicechange
- permission errors
- network recovery
- reconnection

---

## Phase 6 — Safety

Implement:

- reporting
- blocking
- rate limiting
- bans
- moderation workflow
- safety pages

---

## Phase 7 — Observability

Implement:

- metrics
- structured logs
- error tracking
- dashboards
- alerts

---

## Phase 8 — Testing and Hardening

Run:

- unit tests
- integration tests
- E2E
- WebRTC test matrix
- load testing
- security testing
- failure testing

---

## Phase 9 — Production Deployment

Implement:

- production infrastructure
- TLS
- WAF/CDN where appropriate
- load balancing
- Redis
- PostgreSQL
- TURN
- monitoring
- backups
- deployment automation

---

# 38. Definition of Done

A feature is not complete merely because:

- the page renders
- the button works
- TypeScript compiles
- a local mock works

A feature is complete only when:

1. It is implemented.
2. Error handling exists.
3. Edge cases are handled.
4. State transitions are correct.
5. Tests exist.
6. Tests pass.
7. Security implications are reviewed.
8. Observability is appropriate.
9. Production-like behavior is verified.
10. Documentation is updated.

---

# 39. Do Not Fake Core Functionality

Never use fake implementations for production behavior:

```text
setTimeout(() => connected = true)
mockVideoStream()
fakeMatch()
fakePeer()
```

Mocks are acceptable only in tests.

Real implementations are required for:

- WebRTC
- video
- audio
- matchmaking
- signaling
- STUN/TURN
- Redis
- PostgreSQL
- reporting
- blocking
- rate limiting
- session lifecycle

---

# 40. Final Acceptance Test

The final system must demonstrate:

```text
Browser A
    |
    | camera + microphone
    v
SEARCHING
    |
    v
MATCHED
    |
    v
WEBRTC CONNECTING
    |
    v
CONNECTED
    |
    +----> Video A → B
    |
    +----> Video B → A
    |
    +----> Audio A → B
    |
    +----> Audio B → A
    |
    v
SKIP
    |
    v
SEARCHING AGAIN
```

Then verify:

- peer disconnect
- reconnection
- network interruption
- ICE restart
- TURN fallback
- refresh
- camera removal
- microphone removal
- permission denial
- duplicate actions
- stale sessions

---


---

# HARD REQUIREMENT — STATELESS BACKEND & KUBERNETES READINESS

This requirement is mandatory from the beginning.

Assume production will eventually run multiple backend pods:

```text
1 pod → 3 pods → 10 pods → 50+ pods
```

The application must remain correct regardless of which pod handles a request or WebSocket connection.

## Stateless Pod Rules

Never store authoritative production state only in Node.js process memory.

Forbidden as authoritative state:

```text
waitingUsers
activeMatches
sessions
rateLimits
users
```

In-memory caches may only be optional performance optimizations.

Authoritative state must use shared infrastructure:

- Redis for ephemeral/distributed state.
- PostgreSQL for durable state.
- Object storage for durable objects/files where required.

## Shared State

Redis should contain:

```text
waiting queues
presence
active sessions
active matches
distributed locks
rate limits
temporary signaling state
cross-pod events
Pub/Sub
```

PostgreSQL should contain durable data such as:

```text
users
reports
blocks
bans
moderation actions
audit logs
system events
```

## Multi-Pod WebSocket Architecture

WebSocket connections are locally attached to a pod, but authoritative session/match state must be shared.

Example:

```text
User A → Pod A
User B → Pod C

A sends WebRTC offer
        ↓
Pod A validates match
        ↓
Redis Pub/Sub / Streams
        ↓
Pod C receives event
        ↓
Pod C delivers offer to User B
```

The system must work when peers are connected to different pods.

Do not make sticky sessions a correctness requirement.

If sticky sessions are used later as an optimization, document why and ensure the system still works after reconnecting to another pod.

## Distributed Matchmaking

Multiple pods may perform matchmaking concurrently.

Use Redis atomic operations, transactions, Lua scripts, or carefully designed distributed locks.

A user can belong to at most one active match.

Protect against:

- duplicate matches
- stale queue entries
- simultaneous skip/disconnect
- refresh during matching
- two browser tabs
- worker races
- delayed messages
- server restarts

## Distributed Locks

Use locks only where needed.

Locks must have:

- unique ownership tokens
- TTL/expiration
- safe release
- bounded duration
- crash recovery

Prefer atomic Redis operations when a lock is unnecessary.

## Idempotency

Important distributed operations must be safe to retry:

```text
queue:join
queue:leave
match:create
match:end
match:skip
webrtc:offer
webrtc:answer
report:create
session:disconnect
```

Use IDs such as:

```text
requestId
eventId
sessionId
matchId
```

Duplicate events must not corrupt state.

## Cross-Pod Signaling

WebRTC signaling must support:

```text
Browser A → Pod A → Redis → Pod B → Browser B
```

Signaling events should contain enough information for safe routing:

```text
eventId
sessionId
matchId
eventType
protocolVersion
payload
```

Late/stale signaling messages must be safely discarded.

## Session Recovery

If Pod A crashes and a user reconnects through Pod B, Pod B must reconstruct required state from shared infrastructure.

Do not require a user to reconnect to the same pod.

## Pod Failure

Test scenarios such as:

```text
User A → Pod A
User B → Pod B

Match created

Pod A crashes
```

Expected behavior must be explicitly defined.

The system must:

- detect stale ownership
- preserve or terminate the match safely
- notify the surviving peer
- clean stale queue entries
- allow rematching
- prevent duplicate matches

## WebRTC and Pod Independence

After WebRTC signaling has completed, application pods should not carry the normal media stream.

Therefore:

```text
Application control plane ≠ WebRTC media plane
```

A signaling pod failure should not inherently terminate a healthy peer-to-peer/TURN media connection.

If signaling/recovery is needed, the browser reconnects to another backend pod.

## Kubernetes Graceful Shutdown

Implement:

```text
SIGTERM
 ↓
mark pod unready
 ↓
stop accepting new work
 ↓
drain existing connections
 ↓
clean temporary resources
 ↓
close/reconnect WebSockets safely
 ↓
exit
```

Configure appropriate Kubernetes termination grace periods and connection draining.

## Health Checks

Provide:

```text
/health
/ready
```

Liveness determines whether the process is alive.

Readiness determines whether the pod should receive traffic.

Do not make liveness depend on every external dependency, otherwise a dependency outage could cause Kubernetes to restart every pod.

## Horizontal Pod Autoscaling

Design for HPA.

Potential scaling metrics:

```text
CPU
memory
active WebSocket connections
requests/second
signaling throughput
event-loop utilization
```

Do not rely exclusively on CPU if WebSocket/signaling traffic becomes the primary workload.

## Background Jobs

Jobs such as:

```text
stale session cleanup
stale match cleanup
queue cleanup
analytics processing
moderation processing
```

must be safe when multiple pods run simultaneously.

Use:

- distributed locks
- job queues
- leader election
- partitioned work
- idempotent jobs

Never assume only one pod is running.

## Redis High Availability

Production Redis must have a defined availability/failover strategy.

Evaluate:

- managed Redis
- Redis Sentinel
- Redis Cluster

Document:

- failover
- connection retries
- timeouts
- memory limits
- eviction policy
- monitoring

Critical matchmaking state must not silently disappear because of an inappropriate eviction policy.

## PostgreSQL High Availability

Production PostgreSQL should have:

- automated backups
- point-in-time recovery where appropriate
- monitoring
- connection pooling
- migration strategy
- failover strategy

Use bounded application connection pools.

Consider PgBouncer for larger deployments.

Avoid a situation such as:

```text
100 pods × 50 DB connections = 5000 connections
```

## Rolling Deployments

Support Kubernetes rolling deployments.

During deployment:

```text
old pods drain
new pods become ready
users reconnect if required
shared state remains compatible
```

WebSocket protocol and database migrations must support temporary mixed-version deployments.

Prefer backward-compatible changes.

## WebSocket Protocol Versioning

Include a protocol version, for example:

```text
protocolVersion: 1
```

Design migrations so old and new pods can coexist during rolling deployments.

## Database Migration Safety

Prefer:

```text
expand
 ↓
deploy compatible code
 ↓
backfill
 ↓
switch behavior
 ↓
contract
```

Avoid destructive migrations that require every pod to update simultaneously.

## Distributed Observability

Include correlation IDs:

```text
requestId
traceId
sessionId
matchId
eventId
podId
```

This should allow tracing:

```text
User A
 → Pod A
 → Redis
 → Pod C
 → User B
```

without exposing internal infrastructure details to users.

## Mandatory Multi-Instance Test

Before production readiness, run at least:

```text
3 backend instances
+
Redis
+
PostgreSQL
+
TURN
+
multiple real browser clients
```

Verify:

```text
Client A → Pod A
Client B → Pod B
Client C → Pod C

A matches B
A/B signaling crosses pods
A/B video works
A/B audio works
A skips
A rematches with C
Pod A is terminated
A reconnects through Pod B/C
No duplicate or zombie matches appear
```

## Statelessness Acceptance Checklist

- [ ] No critical matchmaking state exists only in process memory.
- [ ] No critical session state exists only in process memory.
- [ ] No critical presence state exists only in process memory.
- [ ] No authoritative rate-limit state exists only in process memory.
- [ ] Multiple pods can perform matchmaking safely.
- [ ] Multiple pods can perform signaling safely.
- [ ] Cross-pod WebSocket signaling works.
- [ ] Redis provides shared ephemeral state.
- [ ] PostgreSQL provides durable state.
- [ ] Distributed locking/atomic operations prevent races.
- [ ] Important operations are idempotent.
- [ ] Pod crashes do not permanently corrupt matches.
- [ ] Users can reconnect to a different pod.
- [ ] Rolling deployments are safe.
- [ ] Kubernetes readiness/liveness probes exist.
- [ ] Graceful shutdown exists.
- [ ] Background jobs are multi-instance safe.
- [ ] PostgreSQL connections are bounded.
- [ ] Redis failure behavior is documented.
- [ ] PostgreSQL failure behavior is documented.
- [ ] A 3+ pod integration test passes.
- [ ] HPA scaling does not break correctness.

**Horizontal scalability is an architectural requirement, not a future refactor.**


# 41. Required Antigravity Behavior

Act as a production engineering team.

Do not optimize for generating code quickly.

Optimize for:

- correctness
- reliability
- maintainability
- security
- observability
- scalability
- recoverability

When an implementation decision changes, update `PLANNING.md`.

When an edge case is discovered, add it to the plan and tests.

When a feature is completed, mark it complete only after validation.

**Architecture first. Implementation second. Testing continuously.**

The final `PLANNING.md` must describe the architecture that is actually implemented, not an outdated original proposal.
