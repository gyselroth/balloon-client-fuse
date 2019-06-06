"use strict";

const        fs = require('fs');
const      fuse = require('fuse-bindings');
const      path = require('path');
const     xattr = require('fs-xattr');
const  diskfree = require('diskfree');
const argparser = require('argparse');

function mount(basedir,mountpoint) {
    const basepath = (p)=>path.join(basedir,p);
    fuse.mount(mountpoint,{
        readdir: function(path,cb) {
            console.log('readdir(%s)',path);
            fs.readdir(basepath(path),(err,files)=>{
                cb(err?err.errno:0,files);
            });
        },
        getattr: function(path,cb) {
            console.log('getattr(%s)',path);
            fs.stat(basepath(path),(err,st)=>{
                if (err)
                    cb(err.errno);
                else {
                    st.dev = 0;
                    st.ino = 0;
                    cb(0,st);
                }
            });
        },
        fgetattr: function(path,fd,cb) {
            console.log('fgetattr(%s,%d)',path,fd);
            fs.stat(basepath(path),(err,st)=>{
                if (err)
                    cb(err.errno);
                else {
                    st.dev = 0;
                    st.ino = 0;
                    cb(0,st);
                }
            });
        },
        // flush: function(path,fd,cb){
        //     console.log('flush(%s,%d,%d)',path,fd,datasync);
        //     // suggested way of doing this is close(dup(fd)) but node doesn't have dup
        // },
        fsync: function(path,fd,datasync,cb){
            console.log('fsync(%s,%d,%d)',path,fd,datasync);
            fs.fsync(fd,(err)=>cb(err?err.errno:0));
        },
        create: function(path,mode,cb) {
            //N.B.  posix says that creat should be equiv to
            //      O_CREAT|O_WRONLY|O_TRUNC
            //      but that doesn't work for e.g. git...
            //      this is a fuse-bindings issue, works from C
            console.log('create(%s,%d)',path,mode);
            const flags = fs.constants.O_CREAT|fs.constants.O_RDWR|fs.constants.O_TRUNC;
            fs.open(basepath(path),flags,mode,(err,fd)=>{
                cb(err?err.errno:0,fd);
            });
        },
        open: function(path,flags,cb) {
            console.log('open(%s,%d)',path,flags);
            fs.open(basepath(path),flags,(err,fd)=>{
                cb(err?err.errno:0,fd);
            });
        },
        read: function(path,fd,buf,len,pos,cb) {
            console.log('read(%s,%d,%d,%d)',path,fd,len,pos);
            fs.read(fd,buf,0,len,pos,(err,cRead)=>cb(err?err.errno:cRead));
        },
        write: function(path,fd,buf,len,pos,cb) {
            console.log('write(%s,%d,%d,%d)',path,fd,len,pos);
            fs.write(fd,buf,0,len,pos,(err,cWrite)=>cb(err?err.errno:cWrite));
        },
        release: function(path,fd,cb) {
            fs.close(fd,(err)=>cb(err?err.errno:0));
        },
        truncate: function(path,size,cb) {
            console.log('truncate(%s,%d)',path,size);
            fs.truncate(basepath(path),size,(err)=>cb(err?err.errno:0));
        },
        ftruncate: function(path,fd,size,cb) {
            console.log('ftruncate(%s,%d,%d)',path,size,fd);
            fs.ftruncate(fd,size,(err)=>cb(err?err.errno:0));
        },
        unlink: function(path,cb) {
            console.log('unlink(%s)',path);
            fs.unlink(basepath(path),(err)=>cb(err?err.errno:0));
        },
        mkdir: function(path,mode,cb){
            console.log('mkdir(%s)',path);
            fs.mkdir(basepath(path),mode,(err)=>cb(err?err.errno:0));
        },
        rmdir: function(path,cb){
            console.log('rmdir(%s)',path);
            fs.rmdir(basepath(path),(err)=>cb(err?err.errno:0));
        },
        rename: function(from,to,cb){
            console.log('rename(%s,%s)',from,to);
            fs.rename(basepath(from),basepath(to),(err)=>cb(err?err.errno:0));
        },
        symlink: function(src,dest,cb){
            console.log('symlink(%s,%s)',src,dest);
            fs.symlink(src[0]==='/' ? basepath(src) : src,
                      basepath(dest),
                      (err)=>cb(err?err.errno:0));
        },
        link: function(src,dest,cb){
            console.log('link(%s,%s)',src,dest);
            fs.link(src[0]==='/' ? basepath(src) : src,
                    basepath(dest),
                    (err)=>cb(err?err.errno:0));
        },
        utimens: function(path,atime,mtime,cb){
            console.log('utimens(%s,%d,%d)',path,atime,mtime);
            fs.utimes(basepath(path),atime,mtime,(err)=>cb(err?err.errno:0));
        },
        readlink: function(path,cb){
            console.log('readlink(%s)',path);
            fs.readlink(basepath(path),(err,l)=>cb(err?err.errno:0,l));
        },
        chown: function(path,uid,gid,cb){
            console.log('chown(%s,%d,%d)',path,uid,gid);
            fs.chown(basepath(path),uid,gid,(err)=>cb(err?err.errno:0));
        },
        chmod: function(path,mode,cb){
            console.log('chmod(%s,%d)',path,mode);
            fs.chmod(basepath(path),mode,(err)=>cb(err?err.errno:0));
        },
        statfs: function(path,cb){
            console.log('statfs(%s)',path);
            diskfree.check(basepath(path),(err,info)=>{
                if (err) {
                    if (diskfree.isErrBadPath(err)) {
                        cb(fuse.EINVAL);
                    } else if (diskfree.isErrDenied(err)) {
                        cb(fuse.EPERM);
                    } else if (diskfree.isErrIO(err)) {
                        cb(fuse.EIO);
                    } else
                        cb(fuse.EINVAL);
                } else
                    cb(0,{
                        bsize:  4096,
                        frsize: 4096,
                        blocks: info.total/4096,
                        bavail: info.available/4096,
                        bfree:  info.free/4096
                    });
            });
        },
        // !!! hope `errno` is available for the xattr methods !!!
        setxattr: function(path,name,buffer,length,offset,flags,cb){
            xattr.set(path,name,buffer.slice(length,offset),(err)=>cb(err?err.errno:0));
        },
        getxattr: function(path,name,buffer,length,offset,cb){
            xattr.get(path,name,(err,val)=>{
                if (!err)
                    cb(err.errno);
                else if (!val)
                    cb(fuse.ENOATTR);
                else if (val.length+1>length)
                    cb(fuse.E2BIG);
                else {
                    buffer.write(val,offset,Math.min(val.length,length));
                    cb(0);
                }
            });
        },
        options:[]
    },(err)=>{
        if (err)
            throw err;
        process.on('SIGINT',function(){
            fuse.unmount(mountpoint,function(err){
                if (err)
                    throw err;
                process.exit();
            });
        });
    });

}

const argparse = new argparser.ArgumentParser({
    addHelp:     true,
    description: require('./package.json').description
});

argparse.addArgument(['basedir'],
                     {
                         action:       'store',
                         help:         "base directory"
                     });
argparse.addArgument(['mountpoint'],
                     {
                         action:       'store'
                     });

const args = argparse.parseArgs();

mount(args.basedir,args.mountpoint);
