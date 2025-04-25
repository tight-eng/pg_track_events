# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=22.13.1
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Next.js"

# App lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Copy package files
COPY package.json yarn.lock ./

# Install deps (and dev deps)
RUN yarn install --production=false

# Build-time env vars
# ARG NEXT_PUBLIC_REALTIME_WS_URL
# ARG NEXT_PUBLIC_REALTIME_API_BASE_URL

# ENV NEXT_PUBLIC_REALTIME_WS_URL=${NEXT_PUBLIC_REALTIME_WS_URL}
# ENV NEXT_PUBLIC_REALTIME_API_BASE_URL=${NEXT_PUBLIC_REALTIME_API_BASE_URL}

# Copy application code
COPY . .

# Build application
RUN --mount=type=secret,id=DATABASE_URL \
    DATABASE_URL="$(cat /run/secrets/DATABASE_URL)" \
    yarn build

# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/yarn.lock /app/yarn.lock
COPY --from=build /app/.next/standalone /app/.next/standalone
COPY --from=build /app/.next/static /app/.next/standalone/.next/static
COPY --from=build /app/public /app/.next/standalone/public

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD [ "yarn", "start" ]
