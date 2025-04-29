package logger

import (
	"log/slog"
	"os"
)

var logger *slog.Logger

func Logger() *slog.Logger {
	if logger == nil {
		logger = slog.New(slog.NewTextHandler(os.Stdout, nil))
	}
	return logger
}
