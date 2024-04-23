#!/usr/bin/env bash

env_file=${1:-"./.env"}
test_file=${2}

# shellcheck disable=SC1090
source "${env_file}" && k6 run "${test_file}"
