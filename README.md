# pg_track_events

**Your database knows what happened — why aren’t you listening?**

`pg_track_events` emits analytics events as your data changes. This repo has the tools you need to map row changes into analytics events, and then stream them to tools like PostHog, Mixpanel, Segment, and BigQuery.

## Features

Reliable, accurate, backend analytics without a bunch of `.track()` code.

🔄 **Emit events as your data changes** — no more duplicating logic across backend and tracking code.

🛡️ **Secure and self-hosted** — runs in your VPC, no SaaS relay.

🧠 **Semantic events, not raw logs** — transform DB changes into intelligible events with simple logic (Google CEL).

⚡️ **Easy setup, then scalable** — start with Postgres triggers ([1-3% slower writes - benchmarks](/benchmarks/README.md)), scale to WAL and replicas if needed.

## How it works

![alt](https://raw.githubusercontent.com/tight-eng/pg_track_events/refs/heads/main/docs/public/diagram.svg)

1. Use our CLI to add change triggers to selected Postgres tables (either directly or by dumping a `migration.sql` file)
1. Define how these changes are transformed into analytics events in `pg_track_events.config.yaml`
1. Run a Docker container that reads changes from an outbox table ('schema_pg_track_events.event_log`), processes them into analytics events, and forwards them to your desintations.

## Quick Start

### Add Triggers

Install the CLI

```bash
curl -sSL https://tight.sh/install | bash
```

Initialize in your backend

```bash
pg_track_events init
```

Select tables you wish to track
![alt](https://raw.githubusercontent.com/tight-eng/pg_track_events/refs/heads/main/docs/public/table-choices-with-selections.jpg?raw=true)

The CLI will output the triggers, functions and tables it plans to add.
![alt](https://raw.githubusercontent.com/tight-eng/pg_track_events/refs/heads/main/docs/public/planned-queries.jpg?raw=true)

### Apply the changes

Directly to the database you have connected by typing (`y/yes`) or by outputting a migration file to review / apply the changes yourself (`o/out`).

| Note: All tables, functions and triggers are added to the `schema_pg_track_events` schema. If you ever want to uninstall the triggers and functions you can run `pg_track_events drop` or run `DROP SCHEMA schema_pg_track_events CASCADE` yourself.

### Configure Tracked Events

Add your own trackers and configure destinations in the `pg_track_events.config.yaml`file. [Full specification](/)

```yaml
track:
  user.insert:
    event: "user_signup"
    properties:
      id: "new.id"
      email: "new.email"
      name: "new.name"

  user.update:
    cond: "old.email != new.email ? events.user_changed_email : events.user_updated"
    "user_changed_email":
      id: "new.id"
      previous_email: "old.email"
      new_email: "new.email"

destinations:
  posthog:
    filter: "*"
    apiKey: "$POSTHOG_API_KEY"

ignore:
  auth_authenticator: "*" # This ignores the auth_authenticator table
  user: ["hashed_password"] # This ignores the "hased_password" column
```

### Deploy a worker

Deploy a worker to your infrastructure. The Docker container created by `init` command should be ready to build and deploy, but you can customize it if you need to.

```bash
# Build image
docker build -t pg_track_events_agent .

# Run image (interactive mode, for testing)
# The POSTHOG_API_KEY is just an example, you'll need to pass in whatever env vars you're referencing from your pg_track_events.config.yaml file
docker run -it -e DATABASE_URL="..." -e POSTHOG_API_KEY="..." pg_track_events_agent
```

Watch the events flow!

## License

MIT License

---

Created by [@acunnife](https://github.com/acunniffe) and [@svarlamov](https://github.com/svarlamov) to help them build better products.
