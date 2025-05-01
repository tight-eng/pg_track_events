# Tight Benchmarks

Run the Tight trigger benchmarks on Docker postgres.

```bash
# Ensure docker is up and running
docker info

cd benchmark

# Deps
go mod download

# Run benchmarks
go run ./...
```

