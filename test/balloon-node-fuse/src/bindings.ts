const fs = require('fs');
const fuse = require('fuse-bindings');
const fspath = require('path');
const xattr = require('fs-xattr');

export default function bindings(sdk) {
  var cache = {};

  function getNode(path) {
    return cache[path];
  }

  return {
    //init: function(cb){},
    readdir: async function(path, cb) {
      console.log('readdir(%s)', path);

      if (path === '/') {
        var children = sdk.getRootChildren();
      } else {
        var parent = cache[path];
        var children = sdk.getChildren(parent.id);
      }

      children
        .then(response => {
          var nodes = [];
          for (let node of response.body.data) {
            cache[node.path] = node;
            nodes.push(node.name);
          }

          cb(0, nodes);
        })
        .catch(e => {
          console.log(e);
          cb(0);
        });
    },

    getattr: function(path, cb) {
      console.log('getattr(%s)', path);
      if (path === '/') {
        cb(0, {
          mtime: new Date(),
          atime: new Date(),
          ctime: new Date(),
          nlink: 1,
          size: 100,
          mode: 16877,
          uid: process.getuid ? process.getuid() : 0,
          gid: process.getgid ? process.getgid() : 0,
        });
      } else if (cache[path]) {
        var node = getNode(path);
        cb(0, {
          mtime: node.changed,
          atime: node.changed,
          ctime: node.created,
          nlink: 1,
          size: node.size,
          mode: node.directory === true ? 16877 : 33188,
          uid: process.getuid ? process.getuid() : 0,
          gid: process.getgid ? process.getgid() : 0,
        });
      } else {
        cb(fuse.ENOENT);
      }
    },

    fgetattr(path, fd, cb) {
      console.log('fgetarrr');
      cb(0);
    },

    release(path, fd, cb) {
      console.log('release');
      cb(0);
    },

    link(src, dest, cb) {
      console.log('link');
    },

    chmod(path, mode, cb) {
      console.log('chmod', mode);
      cb(0);
    },

    chown(path, uid, gid, cb) {
      console.log('chmod', uid, gid);
      cb(0);
    },

    utimens(path, atime, mtime, cb) {
      console.log('utimes', atime, mtime);
      cb(0);
    },

    truncate(path, size, cb) {
      console.log('truncate', size);
      cb(0);
    },

    open: function(path, flags, cb) {
      console.log('open(%s, %d)', path, flags);
      cb(0, 42); // 42 is an fd
    },

    read: function(path, fd, buf, len, pos, cb) {
      console.log('read(%s, %d, %d, %d)', path, fd, len, pos);
      var node = getNode(path);
      var stream = sdk.downloadNode(node.id);
      var size = 0;
      stream.on('data', chunk => {
        size += buf.write(chunk.toString('utf8'));
      });

      stream.on('end', () => {
        console.log(size);
        cb(size);
      });
    },

    create: function(path, mode, cb) {
      console.log('create(%s,%d)', path, mode);
      //const flags = fs.constants.O_CREAT|fs.constants.O_RDWR|fs.constants.O_TRUNC;
      cb(0, 'id');
      /*fs.open(basepath(path),flags,mode,(err,fd)=>{
                    cb(err?err.errno:0,fd);
                });*/
    },

    write: function(path, fd, buf, len, pos, cb) {
      console.log('write(%s,%d,%d,%d)', path, fd, len, pos);
      console.log(buf.toString('utf8'));
      //fs.write(fd,buf,0,len,pos,(err,cWrite)=>cb(err?err.errno:cWrite));
      cb(0);
    },
  };
}
