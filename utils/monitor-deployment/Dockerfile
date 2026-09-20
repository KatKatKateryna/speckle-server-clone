FROM debian:12-slim@sha256:3783cc01769c7b2b1b83a5c5ad96c815348e28ed7da68e2e3687004faa906251 AS build-stage

WORKDIR /build

# install tini
ARG TINI_VERSION=v0.19.0
ENV TINI_VERSION=${TINI_VERSION}
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini ./tini
RUN chmod +x ./tini

# Add python virtual env
WORKDIR /venv
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install \
    --no-install-suggests --no-install-recommends --yes \
    python3-venv=3.11.2-1+b1 && \
    python3 -m venv /venv

COPY utils/monitor-deployment/requirements.txt /requirements.txt
RUN /venv/bin/pip install --disable-pip-version-check --requirement /requirements.txt

FROM gcr.io/distroless/python3-debian12:nonroot@sha256:7d1042ce588ab97019fe95c24ffca7bc5a82ccdac572511d5e09bda4435c89c5 as production-stage
ARG PG_CONNECTION_STRING
ARG NODE_EXTRA_CA_CERTS
ENV PG_CONNECTION_STRING=${PG_CONNECTION_STRING} \
    NODE_EXTRA_CA_CERTS=${NODE_EXTRA_CA_CERTS}

COPY --from=build-stage /venv /venv
COPY --from=build-stage /build/tini /usr/bin/tini
WORKDIR /app
COPY utils/monitor-deployment .

ENTRYPOINT [ "tini", "--", "/venv/bin/python3", "-u", "src/run.py"]
