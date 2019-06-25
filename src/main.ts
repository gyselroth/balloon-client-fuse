import * as commandpost from 'commandpost';
import { CoreV2Api, HttpBasicAuth, localVarRequest } from '@gyselroth/balloon-sdk-node';
import * as winston from 'winston';

const util = require('util');
const path = require('path');
const fs = require('fs');
const homeDir = require('os').homedir();
const fuseLocal = path.join(homeDir, '.balloonfs', 'fuse_bindings.node');
const nodeFs = require('node-fs');
const exec = util.promisify(require('child_process').exec);

interface Options {
  options: string[];
}

interface AvailableOptions {
  token: string;
  username: string;
  password: string;
  noverifytls: boolean;
  installfuse: boolean;
  cachettl: number;
  cachedir: string;
  loglevel: string;
}

interface Args {
  server: string;
  mountPoint: string;
}

nodeFs.mkdirSync(path.dirname(fuseLocal), '0755', true);

function installFuse() {
  switch (process.platform) {
    case 'win32':
      var dokanFromBin = 'node_modules/@gyselroth/balloon-node-fuse/assets/Dokan_x64.msi';
      var dokanLocal = path.join(homeDir, '.balloonfs', 'Dokan_x64.msi');

      if(!fs.existsSync(dokanLocal)) {
        fs.writeFileSync(dokanLocal, fs.readFileSync(dokanFromBin));
      }

      return exec('msiexec.exe /i ' + dokanLocal + ' /quiet /qn /norestart');
    break;

    case 'darwin':
      var osxfuseFromBin = 'node_modules/@gyselroth/balloon-node-fuse/assets/osxfuse-3.9.2.pkg';
      var osxfuseLocal = path.join(homeDir, '.balloonfs', 'osxfuse.pkg');

      if(!fs.existsSync(osxfuseLocal)) {
        fs.writeFileSync(osxfuseLocal, fs.readFileSync(osxfuseFromBin));
      }

      return exec('installer -pkg ' + osxfuseLocal + ' -target /Applications');

    default:
    case 'linux':
      return Promise.resolve();
    //skip install, lets asume we have fuse support built in into the kernel
  }
}

switch (process.platform) {
  case 'win32':
    var fuseFromBin = 'node_modules/fuse-bindings/build/Release/fuse_bindings.node';
    break;

  case 'darwin':
    var fuseFromBin = 'node_modules/fuse-bindings/build/Release/fuse_bindings.node';
  break;

  case 'linux':
  default:
    var fuseFromBin = 'node_modules/fuse-bindings/prebuilds/linux-x64/node-57.node';
}

if(!fs.existsSync(fuseLocal)) {
  fs.writeFileSync(fuseLocal, fs.readFileSync(fuseFromBin));
}

function verifyFuse(): boolean {
  switch (process.platform) {
    case 'win32':
      var fuse = '';
      if(!fs.existsSync(fuse)) {
        console.log("balloonfs requires dokany, either download it from: https://github.com/dokan-dev/dokany/releases or execute balloonfs with -o installfuse to try an auto install.");
        return false;
      }

      break;

    case 'darwin':
      var fuse = '/usr/local/lib/libosxfuse.2.dylib';
      if(!fs.existsSync(fuse)) {
        console.log("balloonfs requires osxfuse, either download it from: https://github.com/osxfuse/osxfuse/releases or execute balloonfs with -o installfuse to try an auto install.");
        return false;
      }
    break;

    case 'linux':
    default:
      var fuse = '/usr/lib/x86_64-linux-gnu/libfuse.so';
      if(!fs.existsSync(fuse)) {
        console.log("balloonfs requires fuse support, install libfuse from your distribution mirrors.");
        return false;
      }
  }

  return true;
}

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
var fuse;
var mount;

const loggerFormat = winston.format.printf(({ timestamp, level, message, ...meta}) => {
  return `${timestamp} [${level}]: ${message} ;${meta? JSON.stringify(meta) : ''}`;
});

let root = commandpost
  .create<Options, Args>(' <server> <mountPoint>')
  .option('-o, --options <option>', 'Mount options (username,password,noverifytls,installfuse,cachettl,cachedir,token,loglevel)')
  .action(async (opts, args) => {
    var options = parseOptions(opts);
    if(options.installfuse === true) {
      installFuse().then(() => {

      }).catch(error => {
        console.log(error);
      });
    }

    if(verifyFuse()) {
      mount = require('@gyselroth/balloon-node-fuse').mount;
      fuse = require('fuse-bindings');
    } else {
      return;
    }

    const logger = winston.createLogger({
      level: options.loglevel,
      format: winston.format.combine(winston.format.timestamp({
          format: "YYYY-MM-DD HH:mm:ss"
        }),winston.format.splat(),loggerFormat),
      transports: [
        new winston.transports.Console({ level: options.loglevel }),
      ]
    });

    console.error = function(d) {
      logger.debug(d, util.format.apply(null, arguments));
    };

    if(options.loglevel === 'debug') {
      localVarRequest.debug = true;
    }

    var client = new CoreV2Api(args.server);
    var basic = new HttpBasicAuth();
    basic.username = options.username;
    basic.password = options.password;
    client.setDefaultAuthentication(basic);
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = options.noverifytls === true ? '0' : '1';

    config = {
      mountPoint: args.mountPoint,
      on: function(event) {
        console.log(event);
      },
    };

    mount(client, config, logger).catch(error => {
      console.log(error);
      process.exit(1);
    });
  });

commandpost.exec(root, process.argv).catch(err => {
  console.error(err);
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
