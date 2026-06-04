# syntax=docker/dockerfile:1.7

# ---- build stage ---------------------------------------------------
FROM golang:1.25-alpine AS build
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# CGO disabled + static build for distroless final image.
ARG TARGETOS=linux
ARG TARGETARCH=amd64
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath -ldflags="-s -w" -o /out/njord-backend ./cmd/server

# ---- runtime stage -------------------------------------------------
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/njord-backend /njord-backend
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/njord-backend"]
