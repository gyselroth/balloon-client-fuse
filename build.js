const nexe = require('nexe');
const fs = require('fs');
const replace = require('replace-in-file');
const promisify = require('util').promisify;
const copyFile = promisify(fs.copyFile);
const replaceOptions = {
  files: "node_modules/@gyselroth/balloon-node-fuse/node_modules/fuse-bindings/index.js",
  from: "var fuse = require('node-gyp-build')(__dirname)",
  to: "var fuse = require(require('path').join(require('os').homedir(), '.mount.balloon', 'fuse_bindings.node'))",
};

(async () => {
  await copyFile(replaceOptions.files, replaceOptions.files+'.orig');
  await replace(replaceOptions);

  var compileOptions = {
    logLevel: 'verbose',
    input: 'build/main.js',
  };

  switch(process.platform) {
    case 'win32':
      compileOptions.target = 'windows-x64-8.15.0';
      compileOptions.output = 'dist/mount.balloon-win-x64';
      compileOptions.resources = [
        'node_modules/@gyselroth/balloon-node-fuse/node_modules/fuse-bindings/build/Release/fuse_bindings.node'
      ];
    break;

    case 'darwin':
    break;

    case 'linux':
    default:
      compileOptions.target = 'linux-x64-8.15.0';
      compileOptions.output = 'dist/mount.balloon-linux-x64';
      compileOptions.resources = [
        'node_modules/@gyselroth/balloon-node-fuse/node_modules/fuse-bindings/prebuilds/linux-x64/node-57.node'
      ];
  }

  nexe.compile(compileOptions);
})();
