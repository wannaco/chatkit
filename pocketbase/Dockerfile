FROM alpine:3.20
RUN apk add --no-cache unzip wget ca-certificates
WORKDIR /

ARG PB_VERSION=0.39.9
ARG TARGETARCH=amd64
RUN wget -q https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip && \
    unzip pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip pocketbase LICENSE.md && \
    mkdir -p /licenses && mv LICENSE.md /licenses/pocketbase-LICENSE.md && \
    rm pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip

COPY migrations/ /pb_migrations/
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8090

ENTRYPOINT ["/docker-entrypoint.sh"]
