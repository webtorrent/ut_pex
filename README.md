# ut_pex [![travis](https://img.shields.io/travis/fisch0920/ut_pex.svg)](https://travis-ci.org/fisch0920/ut_pex) [![npm](https://img.shields.io/npm/v/ut_pex.svg)](https://npmjs.org/package/ut_pex) [![gittip](https://img.shields.io/gittip/fisch0920.svg)](https://www.gittip.com/fisch0920/)

### BitTorrent Extension for Peer Discovery (PEX)

[![browser support](https://ci.testling.com/fisch0920/ut_pex.png)](https://ci.testling.com/fisch0920/ut_pex)

Node.js implementation of the [ut_pex protocol](http://www.rasterbar.com/products/libtorrent/extension_protocol.html), which is the most popular PEX (peer exchange) protocol used by bittorrent clients.

The purpose of this extension is to allow peers to exchange known peers directly with each other, thereby facilitating more efficient peer discovery and healthier swarms.

Works in the browser with [browserify](http://browserify.org/)! This module is used by [WebTorrent](http://webtorrent.io).

## install

```
npm install ut_pex
```

## usage

This package should be used with [bittorrent-protocol](https://github.com/feross/bittorrent-protocol), which supports a plugin-like system for extending the protocol with additional functionality.

Say you're already using `bittorrent-protocol`. Your code might look something like this:

```js
var Protocol = require('bittorrent-protocol')
var net = require('net')

net.createServer(function (socket) {
  var wire = new Protocol()
  socket.pipe(wire).pipe(socket)

  // handle handshake
  wire.on('handshake', function (infoHash, peerId) {
    wire.handshake(new Buffer('my info hash'), new Buffer('my peer id'))
  })

}).listen(6881)
```

To add support for PEX, simply modify your code like this:

```js
var Protocol = require('bittorrent-protocol')
var net = require('net')
var ut_pex = require('ut_pex')

net.createServer(function (socket) {
  var wire = new Protocol()
  socket.pipe(wire).pipe(socket)

  // initialize the extension
  wire.use(ut_pex())

  // all `ut_pex` functionality can now be accessed at wire.ut_pex

  // (optional) start sending peer information to remote peer
  wire.ut_pex.start()

  // 'peer' event will fire for every new peer sent by the peer
  wire.ut_pex.on('peer', function (peer) {
    // got a peer

    // Note: the event will not fire if the peer does not support ut_pex or if they
    // simply don't respond.
  })

  // handle handshake
  wire.on('handshake', function (infoHash, peerId) {
    wire.handshake(new Buffer('my info hash'), new Buffer('my peer id'))
  })

}).listen(6881)
```

## methods

### start

Start sending regular PEX updates to the remote peer. Use `addPeer` and `dropPeer` to control the 
content of PEX messages. PEX messages will be sent a little less than once per minute.

```js
wire.ut_pex.start()
```

Note that ut_pex may be used for one-way peer discovery without sending PEX updates to the remote peer, 
but this use case is discouraged because PEX, like bottorrent is more efficient through altruism.

### stop

Stop sending PEX updates to the remote peer.

```js
wire.ut_pex.stop()
```

### reset

Stops sending updates to the remote peer and resets internal state of peers seen.

```js
wire.ut_pex.reset()

### addPeer

Adds a peer to the locally discovered peer list to send with the next PEX message.

```js
wire.ut_pex.addPeer('127.0.0.1:6889')
```

### dropPeer

Adds a peer to the locally dropped peer list to send with the next PEX message.

```js
wire.ut_pex.dropPeer('127.0.0.1:6889')
```

### event: 'peer'

Fired for every new peer received from PEX.

```js
wire.ut_pex.on('peer', function (peer) {
  var parts = peer.split(':')
  var ip = parts[0]
  var port = parts[1]
  // ...
})
```

Note: the event will not fire if the peer does not support ut_pex or if they don't respond.

### event: 'dropped'

Fired for every peer dropped from the swarm notified via PEX.

```js
wire.ut_pex.on('dropped', function (peer) {
  var parts = peer.split(':')
  var ip = parts[0]
  var port = parts[1]
  // ...
})
```

Note: the event will not fire if the peer does not support ut_pex or if they don't respond.

## license

MIT. Copyright (c) Travis Fischer
