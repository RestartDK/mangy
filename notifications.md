# Notifications Integration Plan

## Goal

Build notifications as a shared delivery system with multiple channels layered on top of the app's internal notification records.

The app should always create internal notification events first. Delivery channels then consume those events based on user preferences.

## Current Status

### Implemented

- internal notification records remain the source of truth
- browser push delivery exists as a notification channel
- browser push settings exist in the settings page
- browser push subscriptions are stored per browser
- browser push deliveries are queued and processed by the worker
- delivery status and errors are recorded for browser push

### Pending

- Slack integration

Slack is the next notification channel to add on top of the same pipeline.

## Delivery Model

- the app creates internal notification events first
- channel-specific delivery workers consume those events based on user preferences
- failed channel delivery does not mark the core app event as failed
- each channel is best-effort and retryable

## Implemented Browser Push Channel

### Product Behavior

- users can enable notifications for the current browser from settings
- users can send a browser push test notification
- users can enable or disable event categories individually
- the in-app notification still exists even if browser push delivery fails

### Current Limitations

- browser push requires `https://` or the browser's `localhost` exception
- plain HTTP IP access like `http://100.91.192.69:3001` will not show the native browser permission prompt

## Pending Slack Channel

### Goal

Add optional Slack notifications for important background events without making Slack a required dependency for the main app.

Slack should be a delivery channel layered on top of the app's internal notification system, not a separate event source.

### Events To Send

Send Slack notifications for:

- download completed
- download failed
- tracked series has new chapter queued
- tracked series check failed repeatedly
- destination or Komga import issues that need user attention

Do not send a Slack message for every minor progress update.

### Configuration Model

Add user-configurable Slack settings in app settings:

- `isEnabled`
- `webhookUrl`
- `notifyOnDownloadCompleted`
- `notifyOnDownloadFailed`
- `notifyOnTrackedSeriesUpdate`
- `notifyOnSystemWarning`

Store these in the existing notification channel model keyed by user.

### Security Rules

- treat `webhookUrl` as sensitive data
- never expose full webhook values back to the client after save
- validate Slack webhook format on save
- redact webhook values from logs and error messages

### Backend Design

1. Worker or server creates an internal notification record.
2. Notification dispatch logic evaluates the user's delivery preferences.
3. If Slack is enabled, a Slack delivery job is queued.
4. The worker posts a formatted message to the webhook.
5. Delivery success or failure is recorded for observability.

### Worker Behavior

- use short retries with backoff for temporary failures
- stop retrying on clear permanent webhook errors
- avoid duplicate sends by tracking delivery status per notification

### Message Format

Keep messages concise and scannable.

- `Download completed`: include series name, chapter name, destination name, and completion time
- `Download failed`: include series name, chapter name, retry state, and short error reason
- `New chapter queued`: include series name, chapter name, source name, and destination
- `Action needed`: include a short explanation and the next place to check in the app

### API Plan

Add settings endpoints for:

- save Slack webhook settings
- update Slack event preferences
- send test Slack notification
- fetch masked Slack configuration state

All request and response fields should use `camelCase`.

### UI Plan

In the settings page, include:

- Slack enable toggle
- webhook input field
- event preference toggles
- test notification button
- delivery status summary and last error preview

### Phased Delivery

#### Phase 1

- webhook storage
- test message endpoint
- completed and failed download notifications

#### Phase 2

- tracked series notifications
- delivery attempt tracking and last error state

#### Phase 3

- richer formatting and grouped summary messages if needed

### Out Of Scope For The First Version

- full Slack OAuth app installation flow
- slash commands
- interactive Slack buttons
- bidirectional Slack control of the queue

The first Slack version should stay webhook-based and operationally simple.
