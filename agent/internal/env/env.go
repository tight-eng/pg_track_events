// Package env implements environment related functionality.
package env

import (
	"fmt"
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

// ValueOrRequiredEnvVar returns the value of the plain string or, if the string starts with "$", the value of the environment variable.
// If the environment variable is not set, ValueOrRequiredEnvVar returns an error.
func ValueOrRequiredEnvVar(str string) (string, error) {
	str = strings.TrimSpace(str)
	if str == "" {
		return "", fmt.Errorf("no value or environment variable provided")
	}
	if strings.HasPrefix(str, "$") {
		envVarName := strings.TrimPrefix(str, "$")
		val, ok := os.LookupEnv(envVarName)
		if !ok {
			return "", fmt.Errorf("environment variable %s is not set", envVarName)
		}
		if val == "" {
			return "", fmt.Errorf("environment variable %s is empty", envVarName)
		}
		val = strings.TrimSpace(val)
		return val, nil
	}
	return str, nil
}
