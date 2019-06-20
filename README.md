# balloonfs

[![Build Status](https://travis-ci.org/gyselroth/balloon-client-fuse.svg)](https://travis-ci.org/gyselroth/balloon-client-fuse)
[![Coverage Status](https://coveralls.io/repos/github/gyselroth/balloon-client-fuse/badge.svg?branch=master)](https://coveralls.io/github/gyselroth/balloon-client-fuse?branch=master)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub release](https://img.shields.io/github/release/gyselroth/balloon-client-fuse.svg)](https://github.com/gyselroth/balloon-client-fuse/releases)

balloonfs :ship:ed for Linux, Windows and OS X.

Usage:
```
mount -t balloon <server_url> <mountpoint> -o username=admin,password=admin
```

## Options
| Option | Default | Description |
| ---------- | ------------------ | --- |
| username | `null` | balloon username. |
| password | `null` | balloon password. |
| cachedir | `null` | Local directory to use as direct storage. |
| cachettl | `5` | Cache time in seconds for node response TTL. |
| nofuseinstall | <null> | Skip fuse installation. |
| noverifytls | <null> | Allow insecure ssl certificates. |
