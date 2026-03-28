# Slack Integration Plan

## Goal

Add optional Slack notifications for important background events without making Slack a required dependency for the main app.

Slack should be a delivery channel layered on top of the app's internal notification system, not a separate event source.

## Events To Send

Send Slack notifications for:

- download completed
- download failed
- tracked series has new chapter queued
- tracked series check failed repeatedly
- destination or Komga import issues that need user attention

Do not send a Slack message for every minor progress update.

## Delivery Model

- the app creates internal notification events first
- Slack delivery workers consume those events based on user preferences
- failed Slack delivery does not mark the core app event as failed
- Slack is best-effort and retryable

## Configuration Model

Add user-configurable Slack settings in app settings:

- `isEnabled`
- `webhookUrl`
- `notifyOnDownloadCompleted`
- `notifyOnDownloadFailed`
- `notifyOnTrackedSeriesUpdate`
- `notifyOnSystemWarning`

Store these in a dedicated table or a notification endpoint table keyed by user.

## Security Rules

- treat `webhookUrl` as sensitive data
- never expose full webhook values back to the client after save
- validate Slack webhook format on save
- redact webhook values from logs and error messages

## Backend Design

### Data Flow

1. Worker or server creates an internal notification record.
2. Notification dispatch logic evaluates the user's delivery preferences.
3. If Slack is enabled, a Slack delivery job is queued.
4. The worker posts a formatted message to the webhook.
5. Delivery success or failure is recorded for observability.

### Suggested Tables Or Fields

- `notificationEndpoint` for Slack channel configuration
- optional `notificationDelivery` table for attempts, status, and errors

### Worker Behavior

- use short retries with backoff for temporary failures
- stop retrying on clear permanent webhook errors
- avoid duplicate sends by tracking delivery status per notification

## Message Format

Keep messages concise and scannable.

### Download Completed

- title: `Download completed`
- body includes series name, chapter name, destination name, and completion time

### Download Failed

- title: `Download failed`
- body includes series name, chapter name, retry state, and short error reason

### Tracked Series Update

- title: `New chapter queued`
- body includes series name, chapter name, source name, and destination

### System Warning

- title: `Action needed`
- body includes a short explanation and the next place to check in the app

## Product Behavior

- users can test Slack delivery from settings
- users can enable or disable event categories individually
- the in-app notification should still exist even if Slack delivery fails
- queue and tracking pages should link back to the root event context mentioned in Slack

## API Plan

Add settings endpoints for:

- save Slack webhook settings
- update Slack event preferences
- send test Slack notification
- fetch masked Slack configuration state

All request and response fields should use `camelCase`.

## UI Plan

In the settings page, include:

- Slack enable toggle
- webhook input field
- event preference toggles
- test notification button
- delivery status summary and last error preview

## Failure Handling

- if Slack fails, keep the core notification record
- show Slack delivery issues in the app settings UI
- avoid noisy repeated failures by rate-limiting repeated identical errors
- allow users to disable Slack quickly without affecting in-app notifications

## Phased Delivery

### Phase 1

- webhook storage
- test message endpoint
- completed and failed download notifications

### Phase 2

- tracked series notifications
- delivery attempt tracking and last error state

### Phase 3

- richer formatting and grouped summary messages if needed

## Out Of Scope For The First Version

- full Slack OAuth app installation flow
- slash commands
- interactive Slack buttons
- bidirectional Slack control of the queue

The first version should stay webhook-based and operationally simple.
