#!/bin/bash

export PATH=/usr/local/bin:$PATH

consul() {
    export CONSUL_AGENT_BIND_ADDR=$(ip addr show eth0 | grep "inet\b" | awk '{print $2}' | cut -d/ -f1)
    echo "Exported CONSOUL_AGENT_BIND_ADDR to $CONSUL_AGENT_BIND_ADDR ..."

    wait-for-http.sh http://$CONSUL_SERVER:8500
    run-consul-agent.sh $CONSUL_AGENT_BIND_ADDR $CONSUL_SERVER
}

onStart() {
    logDebug "onStart"

    host="$1"

    until /usr/bin/curl -o /dev/null --fail -s $KONG_API_URL/apis; do
      >&2 echo "Kong is unavailable - sleeping"
      sleep 1
    done

    >&2 echo "Kong is up!"

    exit 0
}

onChange() {
    logDebug "onChange"
}

health() {
    logDebug "health"

    /usr/bin/curl -o /dev/null --fail -s http://127.0.0.1:3000/checks/health
    if [[ $? -ne 0 ]]; then
        echo "Service monitor endpoint failed"
        exit 1
    fi
}

logDebug() {
    if [[ "${LOG_LEVEL}" == "DEBUG" ]]; then
        echo "containerpilot.sh: $*"
    fi
}

until
    cmd=$1
    if [[ -z "$cmd" ]]; then
        help
    fi
    shift 1
    $cmd "$@"
    [ "$?" -ne 127 ]
do
    help
    exit
done
