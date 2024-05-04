// Creator: Grafana k6 Browser Recorder 1.0.1

import http from 'k6/http'
import { check, fail, sleep } from 'k6';
import exec from 'k6/execution';
import { getCookies, login } from "./rancher_utils.js";
import * as k8s from './k8s.js'

const configMapCount = __ENV.CONFIG_MAP_COUNT
const vus = 1
const configMapData = open('./964KB.txt')
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
      executor: 'per-vu-iterations',
      exec: 'createConfigMaps',
      vus: vus,
      iterations: configMapCount,
      maxDuration: '1h',
    }
  },
  thresholds: {
    checks: ['rate>0.99']
  }
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
    // console.log("CONFIGMAP DELETE: \n", res)
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

  let data = {
    cookies: cookies,
    principalIds: getPrincipalIds(cookies),
    myId: getMyId(cookies),
    clusterIds: getClusterIds(cookies)
  }

  createNamespace()
  // return data that remains constant throughout the test
  return data
}

export function createConfigMaps(data) {
  const i = exec.scenario.iterationInTest
  const configMapName = `test-config-maps-${i}`
  const body = {
    "apiVersion": "v1",
    "kind": "ConfigMap",
    "metadata": {
      "name": configMapName,
      "namespace": namespace
    },
    "data": { "964KB.txt": configMapData }
  }

  let response = http.post(
    `${baseUrl}/v1/configmaps`,
    JSON.stringify(body),
    {
      headers: {
        accept: 'application/json',
        'content-type': 'application/yaml',
        referer:
          `${baseUrl}/dashboard/c/local/explorer/configmap/create`,
      },
      cookies: data.cookies
    }
  )
  // console.log(response.request)
  // console.log("\n\nRESPONSE:\n")
  // console.log(response)
  check(response, {
    '/v1/configmaps returns status 201': (r) => r.status === 201,
  })
}

// function deleteConfigMap() {
//   response = http.del(
//     `${baseUrl}/v1/configmaps/default/${configMapName}`,
//     null,
//     {
//       headers: {
//         accept: 'application/json',
//         referer:
//           `${baseUrl}/dashboard/c/local/explorer/configmap?q=${configMapName}`,
//       },
//       cookies: cookies
//     }
//   )
// }