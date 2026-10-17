# Development image: Vite dev server with hot reload. Production gets a static build later.
FROM node:24-alpine

WORKDIR /app
RUN chown node:node /app
USER node

# Dependencies first: this layer is rebuilt only when package.json or the lockfile change.
COPY --chown=node:node package.json package-lock.json ./
RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 npm ci --no-fund --no-audit

COPY --chown=node:node . .

EXPOSE 5173

# --host binds to all interfaces, so the published port is reachable from the phone.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
