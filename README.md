## Readme

**Merative<sup>®</sup> Digital Health Pass**

# Generic Issuer Manager Service

**Version 1.0, November 2022**   © Copyright Merative US L.P. and others 2020-2022

[↳ Introduction](#introduction)

[↳ Postman](#postman)

[↳ Installation](#installation)

[↳ General Environment Variables](#general-environment-variables)

[↳ IBM Cloud Environment Variables](#ibm-cloud-environment-variables)

[↳ Azure Environment Variables](#azure-environment-variables)

[↳ Local Environment Variables](#local-environment-variables)

[↳ Testing Environment Variables](#testing-environment-variables)

[↳ Roles and Scopes](#roles-and-scopes)

[↳ Library Licenses](#library-licenses)

## Introduction

Merative<sup>®</sup> provides this service for use by [Digital Health Pass](https://www.ibm.com/products/digital-health-pass/ "Digital Health Pass") customers that want to issue and verify credentials.  This service provides the ability to query DCC and VCI issuers.  This service is designed to operate in IBM Cloud, Azure, or in a stand-alone local configuration by setting environment variables.

[↑ Top](#readme)

## Postman

A Postman collection and environment are provided in the `/postman` folder which demonstrates all the functionality of this service, including creating, retrieving, updating and deleting a DCC or VCI issuer.  To use the collection and environment you must first import them into Postman.  More information on postman can be found [here](https://www.postman.com/) and [here](https://learning.postman.com/docs/getting-started/introduction/).

[↑ Top](#readme)

## Installation

It is recommended to use [Node.js](https://nodejs.org/) v16

To install the dependencies and run the service perform the following from a command line.
Note: Environment variables must be set, as described in following sections, before starting the service. 

```
git clone git@github.com:WH-HealthPass/dhp-generic-issuer-service.git
cd dhp-generic-issuer-service
npm install
node start
```

To verify the API server is running, bring up the swagger (localhost:3000/{CONTEXT_ROOT}/api-docs) in a browser or run the following command from another terminal:
```
curl -X GET "http://localhost:3000/{CONTEXT_ROOT}/ping"
```

To execute all tests run the following from a command line.

```
npm run test
```

To execute only unit tests run the following from a command line.

```
npm run test-unit
```

To execute only integration tests run the following from a command line.

```
npm run test-integration
```


## Docker Build & Run Section

### Build and Push Image 
```bash
# GH ssh key for npm dependancies 
GUTHUB_SSH_KEY=$(cat ~/.ssh/id_rsa | base64 | tr -d \\n) # a valid GH ssh key
IMAGE_TAG=foo  # Docker image tag

# Build image (passing required SSH key)
docker build --build-arg GITHUB_SSH_KEY="${GITHUB_SSH_KEY}" -t us.icr.io/dev-hpass-rns/dhp-generic-issuer-manager-api:${IMAGE_TAG} .
```

### Docker Registry

Example of build and pushing to IBM Cloud registry.

- Login to IBM Cloud and ICR
```bash
ibmcloud login --sso
ibmcloud cr login

echo -n "<API-KEY>" |docker login us.icr.io --username iamapikey --password-stdin

# Push image to registry
docker push us.icr.io/dev-hpass-rns/dhp-generic-issuer-manager-api:${IMAGE_TAG}
```

## Kubernetes Deploy and Run

- (Delete Existing and) Install Helm Release
```bash
helm delete hpass-sandbox-ns-01-01-dhp-generic-issuer-manager-api

helm upgrade --install -f ./chart/dhp-generic-issuer-manager-api/override.yaml hpass-sandbox-ns-01-01-dhp-generic-issuer-manager-api ./chart/01-dhp-generic-issuer-manager-api --set image.pullSecret=ibmcloud-toolchain-wh-hpass-us.icr.io --set annotations.TOOLCHAIN_ID=tekton --set annotations.GIT_URL=https://github.com/WH-HealthPass/healthpass-cicd-toolchain-umbrella --set annotations.GIT_BRANCH=verifier-admin-ui --set annotations.USER_NAME=f-whblocsolutions_merative.com --set annotations.GIT_COMMIT=45c0e1d7ea2bae4cfbf9ec877eebb0bacb4cd943 --set annotations.APPLICATION_VERSION=v_20221025151251 --set image.repository=us.icr.io/dev-hpass-rns/dhp-generic-issuer-manager-api --set image.tag=<IMAGE_TAG> --namespace hpass-sandbox-ns-01
```

- Flip to a Newly Pushed Image for Existing Helm Release/Deployment
```bash
kubectl set image deployment/dhp-generic-issuer-manager-api 01-dhp-generic-issuer-manager-api=us.icr.io/dev-hpass-rns/dhp-generic-issuer-manager-api:${IMAGE_TAG}
```

[↑ Top](#readme)

## General Environment Variables

The following environment variables must be set before starting the application regardless of the executing environment.

| Environment Variable | Value                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| LOG_LEVEL            | Standard log4js log levels.  debug, info, error, etc.                                          |
| CONTEXT_ROOT         | The context root for all endpoints.  e.g. /api/v1/credential-issuer                            |
| USE_HTTPS            | true or false.  If true, then endpoints must be accessed via https, otherwise http             |
| SESSION_SECRET       | A random session secret used by [cookie-session](https://www.npmjs.com/package/cookie-session) |

[↑ Top](#readme)

## IBM Cloud Environment Variables

The following environment variables must be set to execute the service in IBM Cloud

| Environment Variable    | Value                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| AUTH_STRATEGY_FILE_NAME | app-id-auth-strategy.js                                                                             |
| KEY_STORE_FILE_NAME     | key-protect.js                                                                                      |
| APP_ID_URL              | The App ID URL found in IBM Cloud service credentials oauthServerUrl value                          |
| APP_ID_IAM_KEY          | The App ID URL found in IBM Cloud service credentials apikey value                                  |
| APP_ID_TENANT_ID        | The App ID URL found in IBM Cloud service credentials tenantId value                                | 
| APP_ID_AUTH_SERVER_HOST | The App ID URL found in IBM Cloud service credentials appidServiceEndpoint value                    |
| APP_ID_CLIENT_ID        | TODO: How to get this                                                                               | 
| APP_ID_SECRET           | TODO: How to get this                                                                               | 
| KEY_PROTECT_URL         | Key Protect URL found in IBM Cloud service endpoints.  The URL must be post-fixed with /api/v2/keys |
| KEY_PROTECT_GUID        | TODO: How to get this                                                                               | 
| KEY_PROTECT_IAM_KEY     | TODO: How to get this                                                                               | 


[↑ Top](#readme)

## Azure Environment Variables

The following environment variables must be set to execute the service in Azure

| Environment Variable    | Value                                                       |
| ----------------------- | ----------------------------------------------------------- |
| AUTH_STRATEGY_FILE_NAME | azure-auth-strategy.js                                      |
| KEY_STORE_FILE_NAME     | nosql-store.js                                              |
| KEY_VAULT_URL           | Key Vault URL found in the subscription's overview          |
| AZURE_TENANT_ID         | Tenant ID found in the Azure AD registered app              |
| AZURE_CLIENT_ID         | Client ID found in the Azure AD registered app              |
| AZURE_CLIENT_SECRET     | Client secret found in the Azure AD registered app          |
| AZURE_AUDIANCE          | Audiance found in the Azure AD registered app               |
| AZURE_SCOPE             | Scope found in the Azure AD registered app                  |


[↑ Top](#readme)

## Local Environment Variables
The service can run locally and point to any of the configurable IBM Cloud or Azure services, but to run in a stand-alone local mode you must install [CouchDB](https://couchdb.apache.org/) locally.  The following environment variables for a stand-alone local configuration

| Environment Variable    | Value                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| AUTH_STRATEGY_FILE_NAME | no-auth-strategy.js                                                                               |
| KEY_STORE_FILE_NAME     | nosql-store.js                                                                                    |

[↑ Top](#readme)


## Testing Environment Variables
The following environment variables must be set to run integration tests.

IBM Cloud integration tests environment variables.

| Environment Variable              | Value                                                                     |
| --------------------------------- | ------------------------------------------------------------------------- |
| INTEGRATION_TESTS_IBM_EMAIL       | The email address of an IBM App ID user with the scope `healthpass.admin` | 
| INTEGRATION_TESTS_IBM_PASSWORD    | The user's password                                                       |

Azure integration tests environment variables.

| Environment Variable              | Value                                                                         |
| --------------------------------- | ----------------------------------------------------------------------------- |
| INTEGRATION_TESTS_AZURE_EMAIL     | The email address of an Azure Cosmos DB user with the role `healthpass.admin` |
| INTEGRATION_TESTS_AZURE_PASSWORD  |   The user's password                                                         |

[↑ Top](#readme)


## Roles and Scopes

IBM Cloud requires all the scopes below to be created, assigned to roles, and then those roles be assigned to users.
Azure requires the following roles to be created within a registered app then assigned to users.

| Scopes/Roles            | Purpose                          |
| ----------------------- | -------------------------------- |
| issuers.read            | Access for reading issuers       |
| issuers.write           | Access for writing issuers       |
| healthpass.admin        | Access to all endpoints          |

[↑ Top](#readme)


## Library Licenses

This section lists open source libraries used in this application. 

**Table 3: Libraries and sources for this application** 

| Library                   | Source                                                                |
| ------------------------- | --------------------------------------------------------------------- |
| `@azure/cosmos`           | MIT License (https://www.npmjs.com/package/@azure/cosmos)             |
| `@azure/identity`         | MIT License (https://www.npmjs.com/package/@azure/identity)           |
| `@azure/keyvault-secrets` | MIT License (https://www.npmjs.com/package/@azure/keyvault-secrets)   |
| `axios`                   | MIT License (https://www.npmjs.com/package/axios)                     |
| `body-parser`             | MIT License (https://www.npmjs.com/package/body-parser)               |
| `cookie-session`          | MIT License (https://www.npmjs.com/package/cookie-session)            |
| `express`                 | MIT License (https://www.npmjs.com/package/express)                   |
| `helmet`                  | MIT License (https://www.npmjs.com/package/helmet)                    |
| `ibmcloud-appid`          | Apache License 2.0 (https://www.npmjs.com/package/ibmcloud-appid)     |
| `jsonwebtoken`            | MIT License (https://www.npmjs.com/package/jsonwebtoken)              |
| `jwt-decode`              | MIT License (https://www.npmjs.com/package/jwt-decode)                |
| `log4js`                  | Apache License 2.0 (https://www.npmjs.com/package/log4js)             |
| `morgan`                  | MIT License (https://www.npmjs.com/package/morgan)                    |
| `passport`                | MIT License (https://www.npmjs.com/package/passport)                  |
| `passport-azure-ad`       | MIT License (https://www.npmjs.com/package/passport-azure-ad)         |
| `retry-axios`             | Apache License 2.0 (https://www.npmjs.com/package/retry-axios)        |
| `swagger-ui-express`      | MIT License (https://www.npmjs.com/package/swagger-ui-express)        |
| `uuid`                    | MIT License (https://www.npmjs.com/package/uuid)                      |

[↑ Top](#readme)