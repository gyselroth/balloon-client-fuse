import * as commandpost from 'commandpost';
import { CoreV2Api, HttpBasicAuth } from '@gyselroth/balloon-sdk-node';
const path = require('path');
const fs = require('fs');
const homeDir = require('os').homedir();
const fuseLocal = path.join(homeDir, '.mount.balloon', 'fuse_bindings.node');
const nodeFs = require('node-fs');

interface Options {
  options: string[];
}

interface AvailableOptions {
  token: string;
  username: string;
  password: string;
  skipVerifyTls: boolean;
  cacheTTL: number;
  cacheDir: string;
}

interface Args {
  server: string;
  mountPoint: string;
}

switch (process.platform) {
  case 'win32':
    var fuseFromBin =
      'node_modules/@gyselroth/balloon-node-fuse/node_modules/fuse-bindings/build/Release/fuse_bindings.node';
    break;

  case 'linux':
  default:
    var fuseFromBin =
      'node_modules/@gyselroth/balloon-node-fuse/node_modules/fuse-bindings/prebuilds/linux-x64/node-57.node';
}

nodeFs.mkdirSync(path.dirname(fuseLocal), '0755', true);
fs.writeFileSync(fuseLocal, fs.readFileSync(fuseFromBin));
import { mount } from '@gyselroth/balloon-node-fuse';

function parseOptions(opts: Options): AvailableOptions {
  var options = {} as AvailableOptions;

  for(let opt of opts.options) {
    for(let sub of opt.split(',')) {
      var pair = sub.split('=');
      if(pair.length === 2) {
        options[pair[0]] = pair[1]
      } else {
        options[pair[0]] = true;
      }
    }
  }

  return options;
}

let root = commandpost
  .create<Options, Args>(' <server> <mountPoint>')
  .option('-o, --options <option>', 'Mount options (username,password,skipVerifyTls,cacheTTL,cacheDir,token)')
  .action((opts, args) => {
    var options = parseOptions(opts);
    var client = new CoreV2Api(args.server);

    var basic = new HttpBasicAuth();
    basic.username = options.username;
    basic.password = options.password;
    client.setDefaultAuthentication(basic);
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = options.skipVerifyTls === true ? '0' : '1';

    var config = {
      mountPoint: args.mountPoint,
      on: function(event) {
        console.log(event);
      }
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
