# pg_track_events Benchmarks

Run the pg_track_events trigger benchmarks on Docker postgres.

```bash
# Ensure docker is up and running
docker info

cd benchmarks

# Deps
go mod download

# Run benchmarks
go run ./...
```
