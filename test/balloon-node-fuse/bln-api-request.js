var os = require('os');

//var request = require('request');
var logger = require('./logger.js');

var config = require('./config.js');

var BlnApiRequestError = require('./errors/bln-api-request.js');
var BlnConfigError = require('./errors/bln-config.js');
var request = require('request-promise');

var apiUrl;
function getApiUrl(endpoint) {
  var url;
  if(!apiUrl) {
    apiUrl = config.get('apiUrl');
  }

  url = apiUrl;

  if(!apiUrl) {
    throw new BlnConfigError('ApiUrl is not set', 'E_BLN_CONFIG_APIURL');
  }

  if(endpoint.indexOf('/v2') === 0) {
    url = url.replace('/v1', '');
  }

  return url;
}

function buildUri(endpoint) {
  if(endpoint[0] !== '/') endpoint = '/' + endpoint;
  return getApiUrl(endpoint) + endpoint;
}

function getAuthorizationHeader() {
  if(config.get('authMethod') === 'oidc') {
    return 'Bearer ' + config.get('accessToken');
  } else if(config.get('authMethod') === 'basic' && config.get('username')){
    return 'Basic ' + (new Buffer(config.get('username') + ':' + config.get('password')).toString('base64'));
  } else {
    throw new BlnConfigError('Neither accessToken nor username/password set', 'E_BLN_CONFIG_CREDENTIALS')
  }
}

function getReqOptions(method, endpoint, params) {
  var xClientHeader = [
    'Balloon-Desktop-App',
    config.get('version'),
    os.hostname()
  ].join('|');


  var useragent = [
    'Balloon-Desktop-App',
    config.get('version'),
    os.hostname(),
    os.platform(),
    os.release()
  ].join('|');

  var reqOptions = {
    uri: buildUri(endpoint),
    method: method.toUpperCase() || 'GET',
    headers: {
      'User-Agent': useragent,
      'X-Client': xClientHeader,
      'Authorization': getAuthorizationHeader(),
    },
    /* Send params as json encoded body instead of sending it as query string.
    Eg: filtering on GET /collection/children requires that.*/
    body: params,
    json: true,
    timeout: config.get('requestTimeout') || 30000
  };

  if(method.toLowerCase() === 'put' && (endpoint === '/file' || endpoint === '/file/chunk')) {
    /*
    If the content-type header is not set `request` sets it to `application/json` for json files
    If the content-type is set to `application/json` the body is interpreted as json on the server,
    which might lead to errors where the body overrides query paramteres
    eg. {"name": "somename"} will override the paramter `name`
    */
    reqOptions.headers['Content-Type']  = '';

    // Send params as query string for file uploads as body is reserved for file content
    reqOptions.qs = params;
    delete reqOptions.body;
  }

  logger.info('API: ' + method.toUpperCase() + ' request to ' + endpoint + ' with params: ', params);
  return reqOptions;
}

function handleResponse(response, reqOptions, body, callback) {
  if(!!(body && body.constructor && body.call && body.apply)) {
    callback = body;
    body = undefined;
  }

  if(response.statusCode === 401) {
    logger.warning('API: Got Status Code 401 Unauthorized');

    return callback(new BlnApiRequestError('User is not authenticated', 'E_BLN_API_REQUEST_UNAUTHORIZED'));
  }

  if(response.statusCode < 200 || response.statusCode > 299) {
    var errCode;
    var errMsg = 'Unknown API Error with status code: ' + response.statusCode;

    if(body && (body.error || body.message || body.code)) {
      if(body.message) {
        errMsg = body.message;
      }

      if(body.error) {
        errMsg = (errMsg ? (errMsg + ' ') : '') + '(' + body.error + ')';
      }

      if(body.code) {
        switch(body.code) {
          case 19:
            errCode = 'E_BLN_API_REQUEST_NODE_ALREADY_EXISTS';
          break;
          case 25:
            //node has readonly flag set or parent node is readonly
            errCode = 'E_BLN_API_REQUEST_NODE_READ_ONLY';
          break;
          case 34: //delete
          case 35: //update && rename
          case 38: //create
          case 39: //move
            // node is in a share with read only flag set
            errCode = 'E_BLN_API_REQUEST_READ_ONLY_SHARE';
          break;
          case 54:
            errCode = 'E_BLN_API_REQUEST_DEST_NOT_FOUND';
          break;
        }
      }
    }

    var reqOptionsForLog = Object.assign({}, reqOptions);
    if(reqOptionsForLog.headers && reqOptionsForLog.headers.Authorization) reqOptionsForLog.headers.Authorization = 'xxx';
    logger.warning('API: ' + errMsg, {category: 'api', body, reqOptions: reqOptionsForLog});

    return callback(new BlnApiRequestError(errMsg, errCode), body);
  }

  callback(null, body);
}

var blnApiRequest = {
  sendRequest: function(method, endpoint, params, callback) {
    if(!!(params && params.constructor && params.call && params.apply)) {
      callback = params;
      params = {};
    }

    var reqOptions = getReqOptions(method, endpoint, params);
    return request(reqOptions);

    /*return request(reqOptions, (err, response, body) => {
      if(err) return callback(err);
      handleResponse(response, reqOptions, body, callback);
    });*/
  },

  sendStreamingRequest: function(method, endpoint, params) {
    var reqOptions = getReqOptions(method, endpoint, params);
    var req = request(reqOptions);

    req.on('response', function(response) {
      handleResponse(response, reqOptions, function(err) {
        if(err) {
          req.emit('error', err);
        } else {
          req.emit('bln-response', response);
        }
      });
    });

    return req;
  }
}

module.exports = blnApiRequest;
