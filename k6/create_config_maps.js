// Creator: Grafana k6 Browser Recorder 1.0.1

import http from 'k6/http'
import { check, fail, sleep } from 'k6';
import exec from 'k6/execution';
import { getCookies, login } from "./rancher_utils.js";
import * as k8s from './k8s.js'

const configMapCount = __ENV.CONFIG_MAP_COUNT
const vus = __ENV.K6_VUS || 20
const rate = 5
const configMapData = open('./964KB.txt')
const nameScheme = __ENV.NAME_SCHEME
const namespace = "vai-test"

const kubeconfig = k8s.kubeconfig(__ENV.KUBECONFIG, __ENV.CONTEXT)
const baseUrl = __ENV.BASE_URL
const username = __ENV.USERNAME
const password = __ENV.PASSWORD

// Option setting
export const options = {
  // insecureSkipTLSVerify: true,
  tlsAuth: [
    {
      cert: kubeconfig["cert"],
      key: kubeconfig["key"],
    },
  ],
  setupTimeout: '8h',
  scenarios: {
    createConfigMaps: {
      executor: 'shared-iterations',
      exec: 'createConfigMaps',
      vus: vus,
      iterations: configMapCount,
      maxDuration: `${configMapCount}s`,
    }
  },
  thresholds: {
    checks: ['rate>0.99'], // the rate of successful checks should be higher than 99%
    http_req_failed: ['rate<=0.01'], // http errors should be less than 1%
    http_req_duration: ['p(99)<=500'], // 95% of requests should be below 500ms
  },
  teardownTimeout: '5m',
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(95)', 'p(99)', 'count'],
}

function createNamespace() {
  // delete leftovers, if any
  let res = k8s.del(`${baseUrl}/api/v1/namespaces/${namespace}`)

  // create empty namespace
  const body = {
    "metadata": {
      "name": namespace,
    },
  }
  res = k8s.create(`${baseUrl}/api/v1/namespaces`, body)
  check(res, {
    'CREATE /api/v1/namespaces returns status 201': (r) => r.status === 201,
  })
}

function cleanup(cookies) {
  let res = http.get(`${baseUrl}/v1/configmaps`, { cookies: cookies })
  check(res, {
    '/v1/configmaps returns status 200': (r) => r.status === 200,
  })
  JSON.parse(res.body)["data"].filter(r => r["metadata"]["name"].startsWith("test-")).forEach(r => {
    res = http.del(`${baseUrl}/v1/configmaps/${r["id"]}`, { cookies: cookies })
    check(res, {
      'DELETE /v1/configmaps returns status 204': (r) => r.status === 204,
    })
  })
}

export function setup() {
  // log in
  if (!login(baseUrl, {}, username, password)) {
    fail(`could not login into cluster`)
  }
  const cookies = getCookies(baseUrl)

  // delete leftovers, if any
  cleanup(cookies)

  createNamespace()
  // return data that remains constant throughout the test
  return cookies
}

export function createConfigMaps(cookies) {
  // const i = exec.scenario.iterationInTest
  const namePrefix = `${nameScheme}` || `test-config-map-${exec.scenario.name}`
  const name = `${namePrefix}-${exec.scenario.iterationInTest}`.toLowerCase()
  const body = {
    "apiVersion": "v1",
    "kind": "ConfigMap",
    "metadata": {
      "name": name,
      "namespace": namespace
    },
    "data": { "964KB.txt": configMapData }
  }

  let response = http.post(
    `${baseUrl}/v1/configmaps`,
    JSON.stringify(body),
    { cookies: cookies }
  )

  check(response, {
    '/v1/configmaps returns status 201': (r) => r.status === 201,
  })
  sleep(1.0 / rate)
}

// function teardown(cookies) {
//   response = http.del(
//     `${baseUrl}/v1/configmaps/default/${name}`,
//     null,
//     {
//       headers: {
//         accept: 'application/json',
//         referer:
//           `${baseUrl}/dashboard/c/local/explorer/configmap?q=${name}`,
//       },
//       cookies: cookies,
//     }
//   )
// }
