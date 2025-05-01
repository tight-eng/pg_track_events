package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/typeeng/tight-agent/internal/agent"
	"github.com/typeeng/tight-agent/internal/config"
	"github.com/typeeng/tight-agent/internal/db"
	"github.com/typeeng/tight-agent/internal/logger"

	_ "github.com/joho/godotenv/autoload"
)

func main() {
	logger.Logger().Info("starting tightdb-agent")

	// Create a context that will be canceled on SIGINT or SIGTERM
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Setup signal handling
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		log.Println("Shutting down gracefully...")
		cancel()
	}()

	// Load configuration
	cfg := config.ConfigFromContext(ctx)

	logger.Logger().Info("loaded config", "event_streaming_config", cfg.EventStreamingConfig)

	// Connect to database
	dbConn, err := db.NewDB(ctx)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer dbConn.Close()

	// Configure and start the agent
	eventAgent, err := agent.NewAgent(ctx, dbConn)
	if err != nil {
		log.Fatalf("Failed to initialize agent: %v", err)
	}

	log.Println("Starting tightdb-agent...")
	if err := eventAgent.Start(ctx); err != nil && err != context.Canceled {
		log.Fatalf("Agent error: %v", err)
	}

	log.Println("Agent has shut down")
}
