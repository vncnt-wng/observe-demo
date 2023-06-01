#!/usr/bin/env bash

# export LS_SERVICE_NAME=hello-server2
# export LS_ACCESS_TOKEN=6FTjYBFuvKftJCAyzzOqgsK6o5wH5DOIa/7wa3lFhc5jdAjvwgh/inl33mJ8/barjhxwGdH1MkuAvJkBZfNtv2UHMIauCO0/HmQwCyA5
export FLASK_DEBUG=FALSE

# export OTEL_EXPORTER_OTLP_TRACES_HEADERS="lightstep-access-token=6FTjYBFuvKftJCAyzzOqgsK6o5wH5DOIa/7wa3lFhc5jdAjvwgh/inl33mJ8/barjhxwGdH1MkuAvJkBZfNtv2UHMIauCO0/HmQwCyA5"

opentelemetry-instrument \
  --traces_exporter otlp_proto_http,console \
  --metrics_exporter none \
  --service_name demo \
  --exporter_otlp_endpoint "http://127.0.0.1:8000" \
  --exporter_otlp_insecure true \
  python3 app.py
