import * as commandpost from 'commandpost';
import { CoreV2Api, HttpBasicAuth } from '@gyselroth/balloon-sdk-node';
import { install } from '@gyselroth/balloon-node-fuse';

const fuse = require('fuse-bindings');
const path = require('path');
const fs = require('fs');
const homeDir = require('os').homedir();
const fuseLocal = path.join(homeDir, '.balloonfs', 'fuse_bindings.node');
const nodeFs = require('node-fs');

interface Options {
  options: string[];
}

interface AvailableOptions {
  token: string;
  username: string;
  password: string;
  noVerifyTls: boolean;
  noFuseInstall: boolean;
  cacheTTL: number;
  cacheDir: string;
}

interface Args {
  server: string;
  mountPoint: string;
}

nodeFs.mkdirSync(path.dirname(fuseLocal), '0755', true);

switch (process.platform) {
  case 'win32':
    var fuseFromBin = 'node_modules/fuse-bindings/build/Release/fuse_bindings.node';
    var dokanFromBin = 'node_modules/@gyselroth/balloon-node-fuse/assets/Dokan_x64.msi';
    var dokanLocal = path.join(homeDir, '.balloonfs', 'Dokan_x64.msi');

    if(!fs.existsSync(dokanLocal)) {
      fs.writeFileSync(dokanLocal, fs.readFileSync(dokanFromBin));
    }

    break;

  case 'linux':
  default:
    var fuseFromBin = 'node_modules/fuse-bindings/prebuilds/linux-x64/node-57.node';
}

if(!fs.existsSync(fuseLocal)) {
  fs.writeFileSync(fuseLocal, fs.readFileSync(fuseFromBin));
}

import { mount } from '@gyselroth/balloon-node-fuse';

function parseOptions(opts: Options): AvailableOptions {
  var options = {} as AvailableOptions;

  for (let opt of opts.options) {
    for (let sub of opt.split(',')) {
      var pair = sub.split('=');
      if (pair.length === 2) {
        options[pair[0]] = pair[1];
      } else {
        options[pair[0]] = true;
      }
    }
  }

  return options;
}

var config;

let root = commandpost
  .create<Options, Args>(' <server> <mountPoint>')
  .option('-o, --options <option>', 'Mount options (username,password,noVerifyTls,noFuseInstall,cacheTTL,cacheDir,token)')
  .action(async (opts, args) => {
    var options = parseOptions(opts);
    if(options.noFuseInstall !== true) {
      await install(path.join(homeDir, '.balloonfs'));
    }

    var client = new CoreV2Api(args.server);
    var basic = new HttpBasicAuth();
    basic.username = options.username;
    basic.password = options.password;
    client.setDefaultAuthentication(basic);
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = options.noVerifyTls === true ? '0' : '1';

    config = {
      mountPoint: args.mountPoint,
      on: function(event) {
        console.log(event);
      },
    };

    mount(client, config).catch(error => {
      console.log(client);
    });
  });

commandpost.exec(root, process.argv).catch(err => {
  if (err instanceof Error) {
    console.error(err.stack);
  } else {
    console.error(err);
  }
  process.exit(1);
});

process.on('SIGINT', () => {
  fuse.unmount(config.mountPoint, (err) => {
    if (err) {
      console.log('filesystem at ' + config.mountPoint + ' not unmounted', err)
    } else {
      console.log('filesystem at ' + config.mountPoint + ' unmounted')
    }
  })
});
