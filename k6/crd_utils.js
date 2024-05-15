import { check, fail, sleep } from 'k6';
import http, { del } from 'k6/http'
import { getCookies, login, retryUntilExpected, retryExpectedAfterDelay, pollTimeoutUntilExpected } from "./rancher_utils.js";
import { Counter, Trend } from 'k6/metrics';
import * as YAML from './lib/js-yaml-4.1.0.mjs'
import { setTimeout, setInterval, clearTimeout, clearInterval } from 'k6/timers'

export const baseCRDPath = "v1/apiextensions.k8s.io.customresourcedefinitions"
export const schemasTag = { url: `/v1/schemas/<schemaID>` }
export const schemaDefinitionTag = { url: `/v1/schemaDefinitions/<schemaID>` }
export const crdTag = { url: `/v1/apiextensions.k8s.io.customresourcedefinitions/<CRD ID>` }
export const crdsTag = { url: `/v1/apiextensions.k8s.io.customresourcedefinitions` }
export const putCRDTag = { url: `/v1/apiextensions.k8s.io.customresourcedefinitions/<CRD Name>` }

export const crdRefreshDelaySeconds = 2
export const crdRefreshDelayMs = crdRefreshDelaySeconds * 1000
export const backgroundRefreshSeconds = 10
export const backgroundRefreshMs = backgroundRefreshSeconds * 1000


export function cleanupMatchingCRDs(baseUrl, cookies, namePrefix) {
  let res = http.get(`${baseUrl}/${baseCRDPath}`, { cookies: cookies })
  check(res, {
    '/v1/apiextensions.k8s.io.customresourcedefinitions returns status 200': (r) => r.status === 200,
  })
  JSON.parse(res.body)["data"].filter(r => r["metadata"]["name"].startsWith(namePrefix)).forEach(r => {
    res = http.del(`${baseUrl}/${baseCRDPath}/${r["id"]}`, { cookies: cookies })
    check(res, {
      'DELETE /v1/apiextensions.k8s.io.customresourcedefinitions returns status 204': (r) => r.status === 204,
    })
  })
}

export function getRandomArrayItems(arr, numItems) {
  var len = arr.length
  if (numItems > len)
    throw new RangeError("getRandomItems: more elements taken than available");
  var result = new Array(numItems),
    taken = new Array(len);
  while (numItems--) {
    var x = Math.floor(Math.random() * len);
    result[numItems] = arr[x in taken ? taken[x] : x];
    taken[x] = --len in taken ? taken[len] : len;
  }
  return result;
}

export function sizeOfHeaders(hdrs) {
  return Object.keys(hdrs).reduce((sum, key) => sum + key.length + hdrs[key].length, 0);
}

export function trackDataMetricsPerURL(res, tags, headerDataRecv, epDataRecv) {
  // Add data points for received data
  headerDataRecv.add(sizeOfHeaders(res.headers));
  if (res.hasOwnProperty('body') && res.body) {
    epDataRecv.add(res.body.length, tags);
  } else {
    epDataRecv.add(0, tags)
  }
}

// export function trackMetricsForTags(res, tags, metric) {
//   metric.add()
// }

export function getCRD(baseUrl, cookies, id) {
  let res = http.get(`${baseUrl}/${baseCRDPath}/${id}`, { cookies: cookies, tag: crdTag })
  let criteria = []
  criteria[`GET /${baseCRDPath}/<CRD ID> returns status 200`] = (r) => r.status === 200
  check(res, criteria)
  // console.log(`GET CRD status: ${res.status}`)
  return res
}

export function getCRDs(baseUrl, cookies) {
  let res = http.get(`${baseUrl}/${baseCRDPath}`, { cookies: cookies, tags: crdsTag })
  check(res, {
    'GET /v1/apiextensions.k8s.io.customresourcedefinitions returns status 200': (r) => r.status === 200,
  })
  return res
}

export function verifyCRDs(baseUrl, cookies, namePrefix, expectedLength, timeoutMs) {
  const timeWas = new Date();
  let timeSpent = null
  let res = null
  let criteria = []
  let currentLength = -1
  // Poll schemaDefinition until receiving a 200
  console.log("STARTED POLLING")
  while (new Date() - timeWas < timeoutMs) {
    res = retryUntilExpected(200, () => { return getCRDs(baseUrl, cookies) })
    timeSpent = new Date() - timeWas
    if (res.status === 200) {
      let data = JSON.parse(res.body)["data"]
      data = data.filter(r => r["metadata"]["name"].startsWith(namePrefix))
      currentLength = data.length
      if (currentLength == expectedLength) {
        console.log("Polling conditions met after ", timeSpent, "ms");
        break;
      }
    } else {
      console.log("Polling CRDs failed to receive 200 status")
    }
  }
  criteria[`detected the expected # of CRDs "${expectedLength}" matches the received # of CRDs "${currentLength}"`] = (r) => currentLength == expectedLength
  check(res, criteria)
  return { res: res, timeSpent: timeSpent }
}

export function createCRD(baseUrl, cookies, suffix) {
  const namePattern = `-test-${suffix}`
  const res = http.post(
    `${baseUrl}/${baseCRDPath}`,
    `apiVersion: apiextensions.k8s.io/v1\nkind: CustomResourceDefinition\nmetadata:\n  name: crontabs${namePattern}.stable.example.com\nspec:\n  group: stable.example.com\n  versions:\n    - name: v1\n      served: true\n      storage: false\n      schema:\n        openAPIV3Schema:\n          type: object\n          properties:\n            spec:\n              type: object\n              properties:\n                cronSpec:\n                  type: string\n                image:\n                  type: string\n                replicas:\n                  type: integer\n    - name: v2\n      served: true\n      storage: true\n      schema:\n        openAPIV3Schema:\n          type: object\n          properties:\n            spec:\n              type: object\n              properties:\n                cronSpec:\n                  type: string\n                newField:\n                  type: string\n                image:\n                  type: string\n                replicas:\n                  type: integer\n  scope: Namespaced\n  names:\n    plural: crontabs${namePattern}\n    singular: crontab${namePattern}\n    kind: CronTab${namePattern}\n    shortNames:\n      - ct${namePattern}\n`,
    {
      headers: {
        "content-type": "application/yaml",
      },
      cookies: cookies,
      tags: crdsTag,
    }
  )
  check(res, {
    'CRD post returns 201 (created)': (r) => r.status === 201,
  })
  return res
}

export function deleteCRD(baseUrl, cookies, id) {
  let res = http.del(`${baseUrl}/${baseCRDPath}/${id}`, null, { cookies: cookies, tags: crdTag })

  check(res, {
    'DELETE /v1/apiextensions.k8s.io.customresourcedefinitions returns status 200': (r) => r.status === 200 || r.status === 204,
  })
  return res
}

export function getCRDsMatchingName(baseUrl, cookies, namePrefix) {
  let res = getCRDs(baseUrl, cookies)
  if (!Object.hasOwn(res, 'body') || !Object.hasOwn(JSON.parse(res.body), 'data')) {
    console.log("Res doesn't have body");
    return { res: res, crdArray: [] };
  }
  let crdArray = []
  crdArray = JSON.parse(res.body)["data"]
  crdArray = crdArray.filter(r => r["metadata"]["name"].startsWith(namePrefix))
  return { res: res, crdArray: crdArray }
}

export function getCRDsMatchingNameVersions(baseUrl, cookies, namePrefix, numVersions) {
  let res = getCRDs(baseUrl, cookies)
  if (!Object.hasOwn(res, 'body') || !Object.hasOwn(JSON.parse(res.body), 'data')) {
    console.log("Res doesn't have body");
    return { res: res, crdArray: [] };
  }
  let crdArray = JSON.parse(res.body)["data"]
  crdArray = crdArray.filter(r => r["metadata"]["name"].startsWith(namePrefix) && r["spec"]["versions"].length == numVersions)
  return crdArray
}

export function selectCRDs(crdArray, numVersions) {
  let modifyCRDs = getRandomArrayItems(crdArray, numVersions)
  return modifyCRDs
}

export function teardown(data) {
  cleanup(data.cookies)
}

export function getSchema(baseUrl, cookies, existingID) {
  let res = http.get(
    `${baseUrl}/v1/schemas/${existingID}`,
    {
      cookies: cookies,
      tags: schemasTag,
    }
  )
  return res
}

export function verifySchemaExistsPolling(baseUrl, cookies, existingID, expectedVersion, timeoutMs) {
  const timeWas = new Date();
  let timeSpent = null
  let res = null
  let currentVersion = ""
  // Poll schemaDefinition until receiving a 200
  console.log("STARTED POLLING")
  while (new Date() - timeWas < timeoutMs) {
    res = retryUntilExpected(200, () => { return getSchema(baseUrl, cookies, existingID) })
    timeSpent = new Date() - timeWas
    console.log("SCHEMA STATUS: ", res.status)
    // console.log("GOT SCHEMA RESPONSE: ", res)
    if (res.status === 200) {
      currentVersion = JSON.parse(res.body).attributes.version
      if (currentVersion === expectedVersion) {
        console.log("Polling conditions met after ", timeSpent, "ms");
        break;
      }
    }
  }

  // let res = getSchema(baseUrl, cookies, existingID)
  // let currentVersion = JSON.parse(res.body).attributes.version
  // console.log("SCHEMA:\n", JSON.stringify(JSON.parse(res.body), null, 2))
  // console.log("VERIFY STATUS: ", res.status)
  // console.log(`VERIFY VERSION MATCHES (${currentVersion} === ${expectedVersion}): `, currentVersion === expectedVersion)
  const criteria = {}
  criteria[`GET /v1/schemas/<schemaID> returns status 200`] = (r) => r.status === 200
  criteria[`detected the expected schema version "${expectedVersion}" matches the received version`] = (r) => currentVersion === expectedVersion
  check(res, criteria)
  return { res: res, timeSpent: timeSpent }
}

export function getSchemaDefinition(baseUrl, cookies, existingID) {
  let res = http.get(
    `${baseUrl}/v1/schemaDefinitions/${existingID}`,
    {
      cookies: cookies,
      tags: schemaDefinitionTag,
    }
  )
  // console.log(`GET schemaDefinition return ${res.status}`)
  return res
}

export function verifySchemaDefinitionExistsPolling(baseUrl, cookies, existingID, expectedVersion, timeoutMs) {
  const criteria = {}
  let definitionType = ""
  criteria[`GET /v1/schemaDefinitions/<schemaID> returns status 200`] = (r) => r.status === 200
  criteria[`verify the definitionType includes ${expectedVersion}`] = (r) => JSON.parse(r.body).definitionType.includes(expectedVersion)

  const timeWas = new Date();
  let timeSpent = null
  let res = null
  // Poll schemaDefinition until receiving a 200
  console.log("STARTED POLLING")
  while (new Date() - timeWas < timeoutMs) {
    res = retryUntilExpected(200, () => { return getSchemaDefinition(baseUrl, cookies, existingID) })
    timeSpent = new Date() - timeWas
    console.log("SCHEMADEFINITION STATUS: ", res.status)
    // console.log("GOT SCHEMA DEF RESPONSE: ", JSON.stringify(res.body, null, 2))
    if (res.status === 200) {
      definitionType = JSON.parse(res.body).definitionType
      if (definitionType.includes(expectedVersion)) {
        // console.log("GOT SCHEMA DEF: ", res)
        console.log("Polling conditions met after ", timeSpent, "ms");
        break;
      }
    }
  }
  // let { res, timeSpent } = pollTimeoutUntilExpected(200, timeoutMs, () => getSchemaDefinition(baseUrl, cookies, existingID))
  console.log("FINISHED POLLING AFTER", new Date() - timeWas)

  // console.log("SCHEMADEFINITION:\n", JSON.stringify(JSON.parse(res.body), null, 2))
  // console.log("VERIFY STATUS: ", res.status)
  // if (res.status === 200) {
  //   definitionType = JSON.parse(res.body).definitionType
  // }
  console.log(`VERIFY DEFINITIONTYPE (${definitionType} includes ${expectedVersion}): `, definitionType.includes(expectedVersion))
  check(res, criteria)
  return { res: res, timeSpent: timeSpent }
}

export function updateCRD(baseUrl, cookies, crd) {
  let body = YAML.dump(crd)
  let res = http.put(
    `${baseUrl}/${baseCRDPath}/${crd.metadata.name}`,
    body,
    {
      headers: {
        accept: 'application/json',
        'content-type': 'application/yaml',
      },
      cookies: cookies,
      tags: putCRDTag,
    }
  )
  // console.log("REQUEST BODY:\n", body)
  // console.log("UPDATE STATUS: ", res.status)
  // console.log("RESPONSE VERSIONS:\n", JSON.stringify(JSON.parse(res.body).versions, null, 2))
  check(res, {
    'PUT /v1/apiextensions.k8s.io.customresourcedefinitions returns status 200': (r) => r.status === 200,
  })
  return res
}
