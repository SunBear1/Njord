# Njord Backend (Go)

Minimal HTTP backend scaffold introduced in **Story 0.2**.

## Layout

```
backend/
├── cmd/server/        # main package — HTTP server entrypoint
├── go.mod             # module github.com/SunBear1/Njord/backend
└── Dockerfile         # multi-stage build → distroless final image
```

## Endpoints (current)

| Method | Path              | Description                |
|--------|-------------------|----------------------------|
| GET    | `/api/v1/health`  | Liveness probe (200 + JSON)|

Real API endpoints are ported from `functions/` in Stories 0.6–0.8.

## Local development

```bash
cd backend
go run ./cmd/server
curl http://localhost:8080/api/v1/health
# {"status":"ok"}
```

Environment variables:

| Name                  | Default | Purpose                               |
|-----------------------|---------|---------------------------------------|
| `NJORD_BACKEND_ADDR`  | `:8080` | Listen address override (host:port).  |

## Tests

```bash
cd backend
go test ./...
```

## Container image

```bash
docker build -t njord-backend:dev backend/
```

Final image is `gcr.io/distroless/static-debian12:nonroot` based and runs as
non-root by default. Per Story 0.2 acceptance criteria, the built image must
stay under 20 MB.
