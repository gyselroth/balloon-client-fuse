const nexe = require('nexe');
const fs = require('fs');
const replace = require('replace-in-file');
const promisify = require('util').promisify;
const copyFile = promisify(fs.copyFile);
const replaceOptions = {
  files: "node_modules/fuse-bindings/index.js",
  from: "var fuse = require('node-gyp-build')(__dirname)",
  to: "var fuse = require(require('path').join(require('os').homedir(), '.balloonfs', 'fuse_bindings.node'))",
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
      compileOptions.output = 'dist/balloonfs-win-x64';
      compileOptions.resources = [
        'node_modules/fuse-bindings/build/Release/fuse_bindings.node',
        'node_modules/@gyselroth/balloon-node-fuse/assets/Dokan_x64.msi'
      ];
    break;

    case 'darwin':
      compileOptions.target = 'mac-x64-8.15.0';
      compileOptions.output = 'dist/balloonfs-osx-x64';
      compileOptions.resources = [
        'node_modules/fuse-bindings/build/Release/fuse_bindings.node',
        'node_modules/@gyselroth/balloon-node-fuse/assets/osxfuse-3.9.2.pkg'
      ];
    break;

    case 'linux':
    default:
      compileOptions.target = 'linux-x64-8.15.0';
      compileOptions.output = 'dist/balloonfs-linux-x64';
      compileOptions.resources = [
        'node_modules/fuse-bindings/prebuilds/linux-x64/node-57.node'
      ];
  }

  nexe.compile(compileOptions);
})();
