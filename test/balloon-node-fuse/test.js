const fuse = require('fuse-bindings')
const balloonApi = require('./bln-api');
const config = require('./config');
config.setAll({
  apiUrl: 'https://balloonstage.tam.ch/api/v2',
  authMethod: 'basic',
  username: "gradmin.bzu",
  password: "yotata.Tosani"
});

var fs = require('fs');
var p = '/tmp/'+Math.random().toString(36);
fs.mkdirSync(p);
console.log(p);
var mountPath = process.platform !== 'win32' ? p :  'M:\\'

fuse.mount(mountPath, {
  readdir: async function (path, cb) {
    console.log('readdir(%s)', path)
    balloonApi.getChildren(path, {}).then((response) => {
      var nodes = [];
      for(let node of response.data) {
        nodes.push(node.name);
      }
      cb(0, nodes);
    }).catch((err) => {
console.log(err);
      cb(0);
    });
    /*if (path === '/') return cb(0, ['test'])
    cb(0)*/
  },
  getattr: function (path, cb) {
    console.log('getattr(%s)', path)
    if (path === '/') {
      cb(0, {
        mtime: new Date(),
        atime: new Date(),
        ctime: new Date(),
        nlink: 1,
        size: 100,
        mode: 16877,
        uid: process.getuid ? process.getuid() : 0,
        gid: process.getgid ? process.getgid() : 0
      })
      return
    }

      cb(0, {
        mtime: new Date(),
        atime: new Date(),
        ctime: new Date(),
        nlink: 1,
        size: 0,
        mode: 33188,
        uid: process.getuid ? process.getuid() : 0,
        gid: process.getgid ? process.getgid() : 0
      })

    //cb(fuse.ENOENT)
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
console.log("link");
},
chmod(path, mode, cb) {
console.log("chmod", mode);
cb(0);
},
chown(path, uid, gid, cb) {
console.log("chmod", uid, gid);
  cb(0);
},
utimens(path, atime, mtime, cb) {
console.log("utimes", atime, mtime);
  cb(0);
},
truncate(path, size, cb) {
  console.log("truncate", size);
  cb(0);
},
  open: function (path, flags, cb) {
    console.log('open(%s, %d)', path, flags)
    cb(0, 42); // 42 is an fd
  },
  read: function (path, fd, buf, len, pos, cb) {
    console.log('read(%s, %d, %d, %d)', path, fd, len, pos)
    var str = 'hello world\n'.slice(pos, pos + len)
    if (!str) return cb(0)
    buf.write(str)
    return cb(str.length)
  },
        create: function(path,mode,cb) {
            console.log('create(%s,%d)',path,mode);
            //const flags = fs.constants.O_CREAT|fs.constants.O_RDWR|fs.constants.O_TRUNC;
cb(0, "id");
            /*fs.open(basepath(path),flags,mode,(err,fd)=>{
                cb(err?err.errno:0,fd);
            });*/
        },
        write: function(path,fd,buf,len,pos,cb) {
            console.log('write(%s,%d,%d,%d)',path,fd,len,pos);
            console.log(buf.toString('utf8'));
            //fs.write(fd,buf,0,len,pos,(err,cWrite)=>cb(err?err.errno:cWrite));
            cb(0);
        }
}, function (err) {
  if (err) throw err
  console.log('filesystem mounted on ' + mountPath)
})

process.on('SIGINT', function () {
  fuse.unmount(mountPath, function (err) {
    if (err) {
      console.log('filesystem at ' + mountPath + ' not unmounted', err)
    } else {
      console.log('filesystem at ' + mountPath + ' unmounted')
    }
  })
});
