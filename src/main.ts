import * as commandpost from 'commandpost';
import {mount} from '@gyselroth/balloon-node-fuse';

console.log(mount);

var config = {
    mountPath: process.platform !== 'win32' ? '/mnt/mount1' :  'M:\\',
    complete: function (err) {
        console.log(err);
        if (err) throw err
        console.log('filesystem mounted on ')
    }
};

console.log(mount(config));
