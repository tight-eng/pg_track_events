package agent

import (
	"time"

	"github.com/typeeng/pg_track_events/agent/pkg/eventmodels"
)

// GenerateEventErrorUpdate creates a DBEventUpdate for a failed event
// It increments retries, sets the error, last retry time, and calculates next retry time
func GenerateEventErrorUpdate(eventID int64, currentRetries int, err error) *eventmodels.DBEventUpdate {
	now := time.Now()
	errStr := err.Error()

	// Calculate next retry time with exponential backoff
	// Base delay is 1 minute, doubled for each retry up to a reasonable maximum
	var processAfter time.Time
	delayMinutes := 1 << uint(currentRetries) // 2^retries minutes (1, 2, 4, 8, 16...)
	if delayMinutes > 60 {
		delayMinutes = 60 // Cap at 60 minutes
	}
	processAfter = now.Add(time.Duration(delayMinutes) * time.Minute)

	return &eventmodels.DBEventUpdate{
		ID:           eventID,
		Retries:      currentRetries + 1,
		LastError:    &errStr,
		LastRetryAt:  &now,
		ProcessAfter: &processAfter,
	}
}

// GenerateEventErrorUpdates creates DBEventUpdates for multiple failed events with the same error
func GenerateEventErrorUpdates(eventIDs []int64, currentRetries map[int64]int, err error) []*eventmodels.DBEventUpdate {
	updates := make([]*eventmodels.DBEventUpdate, 0, len(eventIDs))

	for _, id := range eventIDs {
		retries := 0
		if count, ok := currentRetries[id]; ok {
			retries = count
		}
		updates = append(updates, GenerateEventErrorUpdate(id, retries, err))
	}

	return updates
}

// MergeEventErrorUpdates merges multiple updates for the same event ID into a single update
// It combines error messages and takes the highest retry count
func MergeEventErrorUpdates(updates []*eventmodels.DBEventUpdate) []*eventmodels.DBEventUpdate {
	if len(updates) == 0 {
		return updates
	}

	// Map to track the latest update for each event ID
	mergedUpdates := make(map[int64]*eventmodels.DBEventUpdate)

	for _, update := range updates {
		if existingUpdate, ok := mergedUpdates[update.ID]; ok {
			// Already have an update for this ID, merge them

			// Use the higher retry count
			if update.Retries > existingUpdate.Retries {
				existingUpdate.Retries = update.Retries
			}

			// Combine error messages if different
			if update.LastError != nil && existingUpdate.LastError != nil && *update.LastError != *existingUpdate.LastError {
				combinedErr := *existingUpdate.LastError + "; " + *update.LastError
				existingUpdate.LastError = &combinedErr
			} else if update.LastError != nil && existingUpdate.LastError == nil {
				existingUpdate.LastError = update.LastError
			}

			// Use the earliest next retry time
			if update.ProcessAfter != nil &&
				(existingUpdate.ProcessAfter == nil ||
					update.ProcessAfter.Before(*existingUpdate.ProcessAfter)) {
				existingUpdate.ProcessAfter = update.ProcessAfter
			}

			// Keep the latest retry attempt time
			if update.LastRetryAt != nil &&
				(existingUpdate.LastRetryAt == nil ||
					update.LastRetryAt.After(*existingUpdate.LastRetryAt)) {
				existingUpdate.LastRetryAt = update.LastRetryAt
			}
		} else {
			// First update for this ID
			mergedUpdates[update.ID] = update
		}
	}

	// Convert map back to slice
	result := make([]*eventmodels.DBEventUpdate, 0, len(mergedUpdates))
	for _, update := range mergedUpdates {
		result = append(result, update)
	}

	return result
}
