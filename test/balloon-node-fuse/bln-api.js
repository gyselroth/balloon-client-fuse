var blnApiRequest = require('./bln-api-request.js');
var logger = require('./logger.js');

var blnApi = {
  getChildren: function(id, params, callback) {
    if(!!(params && params.constructor && params.call && params.apply)) {
      callback = params;
      params = {};
    }

    params.id = null;

    return blnApiRequest.sendRequest('get', '/collections/children', params);
  },

  getQuotaUsage: function(callback) {
    blnApiRequest.sendRequest('get', '/user/quota-usage', (err, result) => {
      if(err) return callback(err);

      callback(null, result.data);
    })
  },

  whoami: function(callback) {
    blnApiRequest.sendRequest('get', '/user/whoami', (err, result) => {
      if(err) return callback(err);

      callback(null, result.data);
    })
  },

  createMetaAttributes: function(nodeId, params, callback) {
    blnApiRequest.sendRequest('post', '/node/meta-attributes?id=' + nodeId, {sendAsForm: true, form: params}, (err, result) => {
      if(err) return callback(err);

      callback(null, result);
    });
  },

  createCollection: function(node, callback) {
    var nodePath = utility.joinPath(node.parent, node.name);

    blnApiRequest.sendRequest('post', '/collections', {p: nodePath}, (err, result) => {
      if(err) return callback(err);

      callback(null, result.data);
    });
  },

  getAttributes: function(node, attributes, callback) {
    var params = {};
    if (node.useId === true) {
      params.id = node.id;
    } else {
      params.p = node.path ? node.path.replace(/\\/g , "/") : utility.joinPath(node.parent, node.name);
    }

    if(!!(attributes && attributes.constructor && attributes.call && attributes.apply)) {
      callback = attributes;
    } else if(attributes) {
      params.attributes = attributes;
    }

    blnApiRequest.sendRequest('get', '/node/attributes', params, (err, result) => {
      if(err) return callback(err);

      callback(null, result.data);
    });
  },

  /**
   * @param {(string|string[])} id - Single node id or an array of node ids
   * @param {string[]} [attributes] - array of attributes to return
   * @param {Function} callback - callback function
   * @return {undefined}
   *
   * Get attributes for multiple nodes
   */
  getAttributesByIds: function(id, attributes, callback) {
    if(id.constructor === String) {
      id = [id];
    }

    //if id is an empty array no round trip to server needed
    if(id.length === 0) return callback(null, []);

    var params = {
      id: id
    }

    if(!!(attributes && attributes.constructor && attributes.call && attributes.apply)) {
      callback = attributes;
    } else if(attributes) {
      params.attributes = attributes;
    }

    blnApiRequest.sendRequest('get', '/node/attributes', params, (err, result) => {
      if(err) return callback(err);

      callback(null, result.data);
    });
  },

  renameNode: function(node, callback) {
    blnApiRequest.sendRequest('post', '/node/name', {id: node.remoteId, name: node.name}, (err, result) => {
      if(err) return callback(err);

      callback(null);
    });
  },

  moveNode: function(node, callback) {
    blnApiRequest.sendRequest('post', '/node/move', {id: node.remoteId, destp: node.parent}, (err, result) => {
      if(err) return callback(err);

      callback(null);
    });
  },

  deleteNode: function(node, callback) {
    blnApiRequest.sendRequest('delete', '/node', {id: node.remoteId}, (err, result) => {
      if(err) return callback(err);

      callback(null);
    });
  },

  uploadFile: function(node, callback) {
    var currentReq;
    var activeTransfer;
    var nodePath = utility.joinPath(node.parent, node.name);
    var progress = new BlnApiProgress();

    try {
      var stat = fsWrap.lstatSync(nodePath);
    } catch(e) {
      return callback(e);
    }

    var bytesTotal = stat.size;
    var bytesSent = 0;
    var chunkSize = 8388608; //8M 8*1024*1024
    var totalChunks = bytesTotal === 0 ? 1 : Math.ceil(bytesTotal / chunkSize);
    var chunksComplete;
    var chunkgroup;
    var finalResult;
    var uploadAborted = false;

    var transferId = [stat.ino, stat.mtime.getTime(), stat.size].join('-');

    var stopListener = function(forceQuit) {
      logger.info('BLN-API: Got sync stop event, aborting upload with chunkgroup: ' + chunkgroup, {forceQuit});
      uploadAborted = true;

      if(forceQuit && currentReq) {
        currentReq.abort();
        process.nextTick(() => {
          endRequest(null);
        });
      }
    };

    syncEvents.once(syncEvents.STOP, stopListener);

    var interval = setInterval(function() {
      logger.debug('Upload progress for', nodePath, ':', (chunksComplete * chunkSize + bytesSent) + '/' + bytesTotal);
    }, 1000);

    transferDb.getUploadByTransferId(transferId, (err, foundTransfer) => {
      if(err) return callback(err);

      activeTransfer = foundTransfer;
      chunkgroup = foundTransfer.chunkgroup;
      chunksComplete = foundTransfer.chunksComplete;

      startRequest();
    });

    function endRequest(err) {
      if(!err && uploadAborted && chunksComplete < totalChunks) {
        var err = new BlnApiError('Upload has been aborted', 'E_BLN_API_UPLOAD_ABORTED');
      }

      syncEvents.removeListener(syncEvents.STOP, stopListener);

      clearInterval(interval);

      if(!err || (err.code !== 'E_BLN_API_UPLOAD_ABORTED' && err.code !== 'E_BLN_API_REQUEST_UNAUTHORIZED')) {
        transferDb.remove(activeTransfer._id, (dbErr) => {
          if(err) return callback(err);
          callback(null, finalResult);
        });
      } else {
        callback(err);
      }
    }

    function startRequest() {
      async.whilst(
        () => {
          return uploadAborted === false && chunksComplete < totalChunks;
        },
        (cb) => {
          var chunkId = chunksComplete+1;

          var params = {
            p: nodePath,
            index: chunkId,
            chunks: totalChunks,
            chunkgroup: chunkgroup,
            size: bytesTotal
          };

          var start = chunksComplete === 0 ? 0 : (chunksComplete*chunkSize) + 1;
          var end = chunksComplete + 1 === totalChunks ? bytesTotal : ((chunksComplete + 1) * chunkSize);

          if(fsWrap.existsSync(nodePath) === false) {
            var err = new BlnApiError('Upload has been aborted the source file \'' + nodePath + '\' doesn\'t exist.', 'E_BLN_API_UPLOAD_SRC_NOTEXISTS');

            return cb(err);
          }

          var src = fsWrap.createReadStream(nodePath, {start, end});

          var req = blnApiRequest.sendRequest('put', '/file/chunk', params, (err, result) => {
            if(!err && !result) {
              err = new BlnApiError('API: got neither error nor result', 'E_BLN_API_NO_RESULT');
            } else if(err && result && result.status === 400 && result.data.code === 275) {
              //chunks lost, reupload all chunks
              chunksComplete = 0;
            } else if(!err) {
              chunksComplete++;
              bytesSent = 0;
            }

            activeTransfer.chunksComplete = chunksComplete;

            transferDb.update(activeTransfer._id, activeTransfer, (dbErr) => {
              if(err && result && result.status === 400 && result.data.code === 275) {

                //chunks lost, reupload all chunks
                return cb(null);
              } else if(err) {
                return cb(err);
              } if(result.status !== 206) {
                finalResult = result;
              } else if(chunkId !== result.data) {
                err = new BlnApiError('API: got status 206 but chunkId \'' + result.data + '\' in response doesn\'t match submited chunkId \'' + chunkId + '\'', 'E_BLN_API_INVALID_CHUNKID');
                return cb(err);
              }

              cb(null);
            });
          });

          currentReq = req;

          src.pipe(req);

          req.on('drain', function() {
            try {
              bytesSent = req.req.connection.bytesWritten;
              progress.emit('progress', (100 / bytesTotal * (chunksComplete * chunkSize + bytesSent)));
            } catch(err) {
              /* seems to happen on the very beginning of an upload if the network lags.
              As bytesSent is only used for debugging no need to handle the error*/
            }
          });

        },
        endRequest
      );
    }

    return progress;
  },

  downloadFile: function(remoteId, version, node, callback) {
    var req;
    var tempName;
    var activeTransfer;
    var callbackCalled = false;
    var aborted = false;
    var bytesRecieved = 0;
    var bytesTotal = 0;
    var targetPath = utility.joinPath(node.parent, node.name);

    var transferId = remoteId + '-' + version;

    var progress = new BlnApiProgress();

    transferDb.getDownloadByTransferId(transferId, (err, foundTransfer) => {
      if(err) return callback(err);

      activeTransfer = foundTransfer.activeTransfer;
      tempName = activeTransfer.tempName;

      startRequest(foundTransfer.offset);
    });

    var stopListener = function(forceQuit) {
      //Abort currently running download
      logger.info('BLN-API: Got sync stop event, aborting download of: ' + remoteId);
      abortRequest(null);
    };

    syncEvents.once(syncEvents.STOP, stopListener);

    var interval = setInterval(function() {
      logger.debug('Download progress for', remoteId, ':', bytesRecieved + '/' + bytesTotal);
    }, 1000);

    function abortRequest(err) {
      aborted = true;
      if(req) req.abort();
      process.nextTick(() => {
        endRequest(err);
      });
    }

    function endRequest(err) {
      if(callbackCalled) return;
      callbackCalled = true;

      clearInterval(interval);

      syncEvents.removeListener(syncEvents.STOP, stopListener);

      if(!err && aborted && (bytesRecieved < bytesTotal || bytesTotal === 0)) {
        err = new BlnApiError('Download has been aborted', 'E_BLN_API_DOWNLOAD_ABORTED');
      }

      if(err && !aborted && fsWrap.existsSyncTemp(tempName)) {
        //delete temporary file if there was an error
        process.nextTick(() => {
          fsWrap.unlinkSyncTemp(tempName);
        });
      }

      if(!err) {
        try {
          fsWrap.moveTempFile(tempName, targetPath);
          transferDb.remove(activeTransfer._id);
        } catch(e) {
          err = e;
        }
      }

      callback(err);
    }

    function startRequest(offset) {
      req = blnApiRequest.sendStreamingRequest('get', '/node', {id: remoteId, download: true, offset});
      //wait with processing incoming data until WritableStream has been attached.
      //writableStream should only be attached if statusCode === 200
      req.pause();

      req.on('error', function(err) {
        if(aborted === false) endRequest(err);
      });

      req.on('bln-response', function(response) {
        var options = {};
        if(offset > 0) options.flags = 'a';

        try {
          var file = fsWrap.createWriteStreamTemp(tempName, options);

          file.on('finish', function(){
            if(aborted === false) endRequest();
          });

          file.on('error', function(err) {
            abortRequest(err);
          });

          req.pipe(file);
          req.resume();

          if(response.headers && response.headers['content-length']) {
            bytesTotal = response.headers['content-length'];
          }
        } catch(err) {
          abortRequest(err);
        }
      });

      req.on('data', function(chunk) {
        bytesRecieved += chunk.length;

        var percent = bytesTotal === 0 ? 0 : (100 / bytesTotal * bytesRecieved);
        progress.emit('progress', percent);
      });
    }

    return progress;
  },

  nodeDelta: function(params, callback) {
    var requestParams = {attributes: ['parent', 'hash', 'version', 'size', 'shared', 'reference']};

    if(!!(params && params.constructor && params.call && params.apply)) {
      callback = params;
    } else if(params) {
      Object.assign(requestParams, params);
    }

    if(requestParams.cursor === undefined) delete requestParams.cursor;

    blnApiRequest.sendRequest('get', '/node/delta', requestParams, (err, result) => {
      if(err) return callback(err);

      callback(null, result.data);
    });
  }
}

module.exports = blnApi;
