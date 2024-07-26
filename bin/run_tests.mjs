#!/usr/bin/env node
import {
  ADMIN_PASSWORD,
  dir,
  terraformDir,
  helm_install,
  q,
  runCollectingJSONOutput,
  runCollectingOutput,
  getAppAddressesFor,
} from "./lib/common.mjs"
import { k6_run } from "./lib/k6.mjs"


// Parameters
const CONFIG_MAP_COUNT = 1000
const SECRET_COUNT = 1000
const ROLE_COUNT = 10
const USER_COUNT = 5
const PROJECT_COUNT = 20
const CRD_COUNT = 500

// Refresh k6 files on the tester cluster
const clusters = runCollectingJSONOutput(`tofu -chdir=${terraformDir()} output -json`)["clusters"]["value"]
const tester = clusters["tester"]
helm_install("k6-files", dir("charts/k6-files"), tester, "tester", {})

// Create config maps
const commit = runCollectingOutput("git rev-parse --short HEAD").trim()
const downstreams = Object.entries(clusters).filter(([k, v]) => k.startsWith("downstream"))
const upstream = clusters["upstream"]

for (const [name, downstream] of downstreams) {
  // k6_run(tester,
  //   { BASE_URL: upstream["private_kubernetes_api_url"], K6_VUS: 1, PER_VU_ITERATIONS: 1, CRD_COUNT: CRD_COUNT, USERNAME: "admin", PASSWORD: ADMIN_PASSWORD},
  //   {commit: commit, cluster: "upstream", test: "create_CRDs.mjs", ConfigMaps: CONFIG_MAP_COUNT, Secrets: SECRET_COUNT},
  //   "k6/create_CRDs.js", true
  // )

  // k6_run(tester,
  //   { BASE_URL: upstream["private_kubernetes_api_url"], K6_VUS: 1, CRD_COUNT: CRD_COUNT, USERNAME: "admin", PASSWORD: ADMIN_PASSWORD},
  //   {commit: commit, cluster: "upstream", test: "get_CRDs.mjs", ConfigMaps: CONFIG_MAP_COUNT, Secrets: SECRET_COUNT},
  //   "k6/get_CRDs.js", true
  // )

  // k6_run(tester,
  //   { BASE_URL: upstream["private_kubernetes_api_url"], K6_VUS: 1, PER_VU_ITERATIONS: 1, CRD_COUNT: CRD_COUNT, USERNAME: "admin", PASSWORD: ADMIN_PASSWORD},
  //   {commit: commit, cluster: "upstream", test: "update_destructive_CRDs.mjs", ConfigMaps: CONFIG_MAP_COUNT, Secrets: SECRET_COUNT},
  //   "k6/update_destructive_CRDs.js", true
  // )

  k6_run(tester,
    { BASE_URL: upstream["private_kubernetes_api_url"], K6_VUS: 1, PER_VU_ITERATIONS: 1, CRD_COUNT: CRD_COUNT, USERNAME: "admin", PASSWORD: ADMIN_PASSWORD },
    { commit: commit, cluster: "upstream", test: "load_CRDs.mjs", CRDs: CRD_COUNT },
    "k6/load_CRDs.js", true
  )

  // k6_run(tester,
  //   { BASE_URL: upstream["private_kubernetes_api_url"], K6_VUS: 1, PER_VU_ITERATIONS: 1, CRD_COUNT: CRD_COUNT, USERNAME: "admin", PASSWORD: ADMIN_PASSWORD },
  //   { commit: commit, cluster: "upstream", test: "verifySchemas.mjs", CRDs: CRD_COUNT },
  //   "k6/verifySchemas.js", true
  // )

  k6_run(tester,
    { BASE_URL: upstream["private_kubernetes_api_url"], K6_VUS: 1, PER_VU_ITERATIONS: 1, CRD_COUNT: CRD_COUNT, USERNAME: "admin", PASSWORD: ADMIN_PASSWORD },
    { commit: commit, cluster: "upstream", test: "verifySchemaDefinitions.mjs", CRDs: CRD_COUNT },
    "k6/verifySchemaDefinitions.js", true
  )
}

// create users and roles
const upstreamAddresses = getAppAddressesFor(upstream)
const rancherURL = upstreamAddresses.localNetwork.httpsURL
const rancherClusterNetworkURL = upstreamAddresses.clusterNetwork.httpsURL
k6_run(tester,
  { BASE_URL: rancherClusterNetworkURL, USERNAME: "admin", PASSWORD: ADMIN_PASSWORD, ROLE_COUNT: ROLE_COUNT, USER_COUNT: USER_COUNT },
  { commit: commit, cluster: "upstream", test: "create_roles_users.mjs", Roles: ROLE_COUNT, Users: USER_COUNT },
  "k6/create_roles_users.js", true
)
// create projects
k6_run(tester,
  { BASE_URL: rancherClusterNetworkURL, USERNAME: "admin", PASSWORD: ADMIN_PASSWORD, PROJECT_COUNT: PROJECT_COUNT },
  { commit: commit, cluster: "upstream", test: "create_projects.mjs", Projects: PROJECT_COUNT },
  "k6/create_projects.js", true
)
