const fuse = require('fuse-bindings');
import bindings from './bindings';
const { V2Api, HttpBasicAuth } = require('@gyselroth/balloon-sdk-node');

var server = 'https://localhost:8081';
console.log(V2Api);
var client = new V2Api(server);
var basic = new HttpBasicAuth();
basic.username = 'admin';
basic.password = 'admin';
client.setDefaultAuthentication(basic);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export function mount(config) {
  // var sdk = new Balloon(config.balloon);
  console.log(fuse.mount);
  console.log(config.mountPath);
  console.log(bindings(client));
  return fuse.mount(config.mountPath, bindings(client), config.complete);
}

/*var config = {
  mountPath: '/mnt/mount1',
  complete: function(err) {
    console.log(err);
    if (err) throw err;
    console.log('filesystem mounted on ');
  },
};

console.log(mount(config));*/
