# balloon node.js SDK with typescript support

[![Build Status](https://travis-ci.org/gyselroth/balloon-sdk-node.svg?branch=master)](https://travis-ci.org/gyselroth/balloon-sdk-typescript-node)
[![GitHub release](https://img.shields.io/github/release/gyselroth/balloon-sdk-node.svg)](https://github.com/gyselroth/balloon-sdk-typescript-node/releases)
[![npm](https://img.shields.io/npm/v/@gyselroth/balloon-sdk-node.svg)](https://www.npmjs.com/package/@gyselroth/balloon-sdk-node)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/gyselroth/balloon-sdk-typescript-node/master/LICENSE) 

Provides a node.js SDK for balloon. Including typescript definition.
>**Note** This SDK is mostly generated from the balloon [OpenAPI](https://github.com/OAI/OpenAPI-Specification) specs.

## Install
```
npm install --save @gyselroth/balloon-sdk-node
```

## Usage

### Example request

```javascript
const { V2Api, HttpBasicAuth } = require('@gyselroth/balloon-sdk-node');

var server = 'https://localhost';
var client = new V2Api(server);
var basic = new HttpBasicAuth('admin', 'admin');
client.setDefaultAuthentication(basic);

client.getUsers().then((response) => {
  console.log(response.body);
}).catch((error) => {
  console.log(error);
});
```
