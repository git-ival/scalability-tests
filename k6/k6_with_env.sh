#!/usr/bin/env bash

env_file=${1:-"./.env"}
test_file=${2}
iters=${3:-1}
delay=${4:-15} # in minutes
address=${5:-"localhost:6565"}

counter=1
sleepDuration=$((delay * 60))
while [ ${counter} -le "${iters}" ]; do
  iterStart=$(date -u '+%FT%T%:z')
  echo "Started iteration at: ${iterStart}"
  # shellcheck disable=SC1090
  source "${env_file}" && k6 run -a "${address}" --out json="${test_file%.js*}-output${counter}.json" "${test_file}"
  kubectl -n cattle-system logs -l status.phase=Running -l app=rancher -c rancher --timestamps --since-time="${iterStart}" --tail=9999999 >"rancher_logs-test_${test_file}.txt"
  if [[ ${iters} -ge 2 ]]; then
    sleep ${sleepDuration}
  fi
  counter=$((counter + 1))
done
