package main

import (
	"context"
	"math/rand"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func main() {
	conn, err := pgx.Connect(context.Background(),
		os.Getenv("DATABASE_URL"))
	if err != nil {
		panic(err)
	}
	defer conn.Close(context.Background())

	const rows = 1_000_000 // change as needed
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))

	batch := make([][]interface{}, 0, rows)
	for i := 0; i < rows; i++ {
		// choose event type
		et := []string{"insert", "update", "delete"}[rng.Intn(3)]

		loggedAt := time.Now().Add(-time.Duration(rng.Intn(7*24*3600)) * time.Second)

		// determine process_after
		var processAfter pgtype.Timestamptz
		if rng.Float32() < 0.8 {
			processAfter.Time = time.Now().Add(time.Duration(rng.Intn(7200)) * time.Second) // within 2 h
			processAfter.Valid = true
		} else {
			processAfter.Time = loggedAt
			processAfter.Valid = true
		}

		var lastError pgtype.Text
		if rng.Float32() < 0.1 {
			lastError.String = "error-code-" + strconv.Itoa(100+rng.Intn(900))
			lastError.Valid = true
		}

		// Create mock data objects based on event type
		var oldRow, newRow interface{}

		mockData := map[string]interface{}{ // will be jsonb
			"ref":  pgtype.UUID{Bytes: [16]byte{}, Valid: false},
			"id":   rng.Intn(10000),
			"name": "item-" + strconv.Itoa(rng.Intn(1000)),
		}

		switch et {
		case "insert":
			// Inserts have new_row but no old_row
			oldRow = nil
			newRow = mockData
		case "update":
			// Updates have both old_row and new_row
			oldRow = map[string]interface{}{
				"ref":  pgtype.UUID{Bytes: [16]byte{}, Valid: false},
				"id":   rng.Intn(10000),
				"name": "old-item-" + strconv.Itoa(rng.Intn(1000)),
			}
			newRow = mockData
		case "delete":
			// Deletes have old_row but no new_row
			oldRow = mockData
			newRow = nil
		}

		// oldRowStr, _ := json.Marshal(oldRow)
		// newRowStr, _ := json.Marshal(newRow)

		batch = append(batch, []interface{}{
			et,
			[]string{"users", "orders", "payments", "products"}[rng.Intn(4)],
			loggedAt,    // logged_at
			rng.Intn(6), // retries
			lastError,
			time.Now().Add(-time.Duration(rng.Intn(3600)) * time.Second), // last_retry_at
			processAfter,
			oldRow, // old_row directly as map
			newRow, // new_row directly as map
		})
		// fmt.Println(batch[i])
	}

	_, err = conn.CopyFrom(
		context.Background(),
		pgx.Identifier{"schema_pg_track_events", "event_log"}, // schema.table
		[]string{
			"event_type", "row_table_name", "logged_at", "retries",
			"last_error", "last_retry_at", "process_after",
			"old_row", "new_row",
		},
		pgx.CopyFromRows(batch),
	)
	if err != nil {
		panic(err)
	}
}
