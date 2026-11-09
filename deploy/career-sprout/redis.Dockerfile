FROM redis:7.4-alpine
COPY redis-entrypoint.sh /usr/local/bin/career-sprout-redis-entrypoint.sh
RUN chmod 0755 /usr/local/bin/career-sprout-redis-entrypoint.sh
