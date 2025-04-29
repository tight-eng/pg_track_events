// Package env implements environment related functionality.
package env

import (
	"os"
	"strings"
)

// FirstOrDefault retrieves the value of the first present environment variable
// named by the keys. In case no variable is present, FirstOrDefault returns
// def.
func FirstOrDefault(def string, keys ...string) string {
	for _, key := range keys {
		if v, ok := os.LookupEnv(key); ok {
			return v
		}
	}

	return def
}

// First is shorthand for FirstOrDefault("", keys...).
func First(keys ...string) string {
	return FirstOrDefault("", keys...)
}

// IsTruthy reports whether any of the values of the environment variables named
// by the keys evaluates to true.
func IsTruthy(keys ...string) bool {
	for _, key := range keys {
		v, ok := os.LookupEnv(key)
		if !ok {
			continue
		}

		switch strings.ToLower(v) {
		case "1", "ok", "t", "true":
			return true
		}
	}

	return false
}

// IsSet reports whether any of the environment variables named by the keys
// is set.
func IsSet(keys ...string) bool {
	for _, key := range keys {
		if _, ok := os.LookupEnv(key); ok {
			return true
		}
	}

	return false
}
