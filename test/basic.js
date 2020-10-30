/* jshint camelcase: false */

const Protocol = require('bittorrent-protocol')
const utPex = require('../')
const test = require('tape')
const string2compact = require('string2compact')
const bencode = require('bencode')

test('wire.use(ut_pex())', (t) => {
  const wire = new Protocol()
  wire.pipe(wire)

  wire.use(utPex())

  t.ok(wire.ut_pex)
  t.ok(wire.ut_pex.start)
  t.ok(wire.ut_pex.stop)
  t.ok(wire.ut_pex.reset)
  t.ok(wire.ut_pex.addPeer)
  t.ok(wire.ut_pex.dropPeer)
  t.ok(wire.ut_pex.on)
  t.notOk(wire.ut_pex.peers)
  t.end()
})

// addPeer

test('should ignore when addPeer receives an invalid peer', t => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire)

  const peer = '?'
  pex.addPeer(peer)

  t.notOk(pex._localAddedPeers[peer])
  t.end()
})

test('should ignore when addPeer receives a peer that remote wire already sent us', t => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire)

  const peer = '127.0.0.1:6889'
  pex._remoteAddedPeers[peer] = { ip: 4 }
  pex.addPeer(peer)

  t.notOk(pex._localAddedPeers[peer])
  t.end()
})

test('should add to localAddedPeers when addPeer', t => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire)

  const peer = '127.0.0.1:6889'
  pex.addPeer(peer)

  t.ok(pex._localAddedPeers[peer])
  t.equal(pex._localAddedPeers[peer].flags, 0x00)
  t.end()
})

test('should add to localAddedPeers when addPeer with flags', t => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire)

  const peer = '127.0.0.1:6889'
  const encodedFlags = 0x06
  const decodedFlags = {
    prefersEncryption: false,
    isSender: true,
    supportsUtp: true,
    supportsUtHolepunch: false,
    isReachable: false
  }

  pex.addPeer(peer, decodedFlags)

  t.ok(pex._localAddedPeers[peer])
  t.equal(pex._localAddedPeers[peer].flags, encodedFlags)
  t.end()
})

test('should add to localAddedPeers when addPeer6', t => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire)

  const peer = '[::1]:6889'
  pex.addPeer6(peer)

  t.ok(pex._localAddedPeers[peer])
  t.equal(pex._localAddedPeers[peer].flags, 0x00)
  t.end()
})

test('should add to localAddedPeers when addPeer6 with flags', t => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire)

  const peer = '[::1]:6889'
  const encodedFlags = 0x06
  const decodedFlags = {
    prefersEncryption: false,
    isSender: true,
    supportsUtp: true,
    supportsUtHolepunch: false,
    isReachable: false
  }

  pex.addPeer6(peer, decodedFlags)

  t.ok(pex._localAddedPeers[peer])
  t.equal(pex._localAddedPeers[peer].flags, encodedFlags)
  t.end()
})

test('should add to localAddedPeers and remove from localDroppedPeers when addPeer', t => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire)

  const peer = '127.0.0.1:6889'
  pex._localDroppedPeers[peer] = { ip: 4 }
  pex.addPeer(peer)

  t.notOk(pex._localDroppedPeers[peer])
  t.ok(pex._localAddedPeers[peer])
  t.end()
})

// dropPeer

test('should ignore when dropPeer receives an invalid peer', t => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire)

  const peer = '?'
  pex.dropPeer(peer)

  t.notOk(pex._localDroppedPeers[peer])
  t.end()
})

test('should ignore when dropPeer receives a peer that remote wire already sent us', t => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire)

  const peer = '127.0.0.1:6889'
  pex._remoteDroppedPeers[peer] = { ip: 4 }
  pex.dropPeer(peer)

  t.notOk(pex._localDroppedPeers[peer])
  t.end()
})

test('should add to localDroppedPeers when dropPeer', t => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire)

  const peer = '127.0.0.1:6889'
  pex.dropPeer(peer)

  t.ok(pex._localDroppedPeers[peer])
  t.end()
})

test('should add to localDroppedPeers when dropPeer6', t => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire)

  const peer = '[::1]:6889'
  pex.dropPeer6(peer)

  t.ok(pex._localDroppedPeers[peer])
  t.end()
})

test('should add to localDroppedPeers and remove from localAddedPeers when dropPeer', t => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire)

  const peer = '127.0.0.1:6889'
  pex._localAddedPeers[peer] = { ip: 4 }
  pex.dropPeer(peer)

  t.notOk(pex._localAddedPeers[peer])
  t.ok(pex._localDroppedPeers[peer])
  t.end()
})

// onExtendedHandshake

test('should emit warning when onExtendedHandshake receives an invalid handshake', t => {
  t.plan(1)
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire)

  pex.on('warning', (err) => {
    t.ok(err)
  })

  const handshake = {}
  pex.onExtendedHandshake(handshake)
})

test('should pass when onExtendedHandshake receives a valid handshake', t => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire)

  pex.on('warning', (err) => {
    t.fail(err)
  })

  const handshake = { m: { ut_pex: 1 } }
  pex.onExtendedHandshake(handshake)

  t.end()
})

// onMessage

test('should ignore when onMessage invalid message', t => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire)

  pex.on('peer', () => {
    t.fail()
  })

  pex.on('dropped', () => {
    t.fail()
  })

  const buf = Buffer.from([0x00])
  pex.onMessage(buf)

  t.end()
})

test('hould ignore when onMessage added and address already in remoteAddedPeers', t => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire)

  const peer = '127.0.0.1:6889'
  const flags = 0x06
  pex._remoteAddedPeers[peer] = { ip: 4, flags: flags }

  pex.on('peer', () => {
    t.fail()
  })

  const message = bencode.encode({ added: string2compact(peer), 'added.f': [flags] })
  const buf = Buffer.from(message)
  pex.onMessage(buf)

  t.end()
})

test('should add to remoteAddedPeers when onMessage added', t => {
  t.plan(6)
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire)

  const peer = '127.0.0.1:6889'
  const encodedFlags = 0x06
  const decodedFlags = {
    prefersEncryption: false,
    isSender: true,
    supportsUtp: true,
    supportsUtHolepunch: false,
    isReachable: false
  }

  pex.on('peer', (_peer, _flags) => {
    t.equal(_peer, peer)
    t.deepEqual(_flags, decodedFlags)
  })

  const message = bencode.encode({ added: string2compact(peer), 'added.f': [encodedFlags] })
  const buf = Buffer.from(message)
  pex.onMessage(buf)

  t.notOk(pex._remoteDroppedPeers[peer])
  t.ok(pex._remoteAddedPeers[peer])
  t.equal(pex._remoteAddedPeers[peer].ip, 4)
  t.equal(pex._remoteAddedPeers[peer].flags, encodedFlags)
})

test('should add to remoteAddedPeers when onMessage added6', t => {
  t.plan(6)

  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire)

  const peer = '[::1]:6889'
  const encodedFlags = 0x06
  const decodedFlags = {
    prefersEncryption: false,
    isSender: true,
    supportsUtp: true,
    supportsUtHolepunch: false,
    isReachable: false
  }

  pex.on('peer', (_peer, _flags) => {
    t.equal(_peer, peer)
    t.deepEqual(_flags, decodedFlags)
  })

  const message = bencode.encode({ added6: string2compact(peer), 'added6.f': [encodedFlags] })
  const buf = Buffer.from(message)
  pex.onMessage(buf)

  t.notOk(pex._remoteDroppedPeers[peer])
  t.ok(pex._remoteAddedPeers[peer])
  t.equal(pex._remoteAddedPeers[peer].ip, 6)
  t.equal(pex._remoteAddedPeers[peer].flags, encodedFlags)
})

test('should ignore when onMessage dropped and address already in remoteDroppedPeers', t => {
  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire)

  const peer = '127.0.0.1:6889'
  pex._remoteDroppedPeers[peer] = { ip: 4 }

  pex.on('dropped', () => {
    t.fail()
  })

  const message = bencode.encode({ dropped: string2compact(peer) })
  const buf = Buffer.from(message)
  pex.onMessage(buf)

  t.end()
})

test('should add to remoteDroppedPeers when onMessage dropped', t => {
  t.plan(3)

  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire)

  const peer = '127.0.0.1:6889'
  pex._remoteAddedPeers[peer] = { ip: 4 }

  pex.on('dropped', (_peer) => {
    t.equal(_peer, peer)
  })

  const message = bencode.encode({ dropped: string2compact(peer) })
  const buf = Buffer.from(message)
  pex.onMessage(buf)

  t.notOk(pex._remoteAddedPeers[peer])
  t.ok(pex._remoteDroppedPeers[peer])
})

test('should add to remoteDroppedPeers when onMessage dropped6', t => {
  t.plan(3)

  const Extension = utPex()
  const wire = new Protocol()
  const pex = new Extension(wire)

  const peer = '[::1]:6889'
  pex._remoteAddedPeers[peer] = { ip: 6 }

  pex.on('dropped', (_peer) => {
    t.equal(_peer, peer)
  })

  const message = bencode.encode({ dropped6: string2compact(peer) })
  const buf = Buffer.from(message)
  pex.onMessage(buf)

  t.notOk(pex._remoteAddedPeers[peer])
  t.ok(pex._remoteDroppedPeers[peer])
})

// _sendMessage

test('should _sendMessage with empty added and empty dropped', t => {
  t.plan(2)

  class ProtocolMock {
    extended (ext, obj) {
      t.equal(ext, 'ut_pex')
      t.deepEqual(obj, {
        added: Buffer.alloc(0),
        'added.f': Buffer.alloc(0),
        dropped: Buffer.alloc(0),
        added6: Buffer.alloc(0),
        'added6.f': Buffer.alloc(0),
        dropped6: Buffer.alloc(0)
      })
    }
  }

  const Extension = utPex()
  const wire = new ProtocolMock()
  const pex = new Extension(wire)

  pex._sendMessage()
})

test('should _sendMessage when a localAdded has an IPv4 address', t => {
  t.plan(2)

  class ProtocolMock {
    extended (ext, obj) {
      t.equal(ext, 'ut_pex')
      t.deepEqual(obj, {
        added: Buffer.from(string2compact(peer)),
        'added.f': Buffer.from([0x06]),
        dropped: Buffer.alloc(0),
        added6: Buffer.alloc(0),
        'added6.f': Buffer.alloc(0),
        dropped6: Buffer.alloc(0)
      })
    }
  }

  const Extension = utPex()
  const wire = new ProtocolMock()
  const pex = new Extension(wire)

  const peer = '127.0.0.1:6889'
  pex._localAddedPeers[peer] = { ip: 4, flags: 0x06 }

  pex._sendMessage()
})

test('should _sendMessage when multiple localAdded IPv4 addresses', t => {
  t.plan(2)

  class ProtocolMock {
    extended (ext, obj) {
      t.equal(ext, 'ut_pex')
      t.deepEqual(obj, {
        added: Buffer.from(string2compact([peerA, peerB])),
        'added.f': Buffer.from([0x06, 0x06]),
        dropped: Buffer.alloc(0),
        added6: Buffer.alloc(0),
        'added6.f': Buffer.alloc(0),
        dropped6: Buffer.alloc(0)
      })
    }
  }

  const Extension = utPex()
  const wire = new ProtocolMock()
  const pex = new Extension(wire)

  const peerA = '127.0.0.1:6889'
  pex._localAddedPeers[peerA] = { ip: 4, flags: 0x06 }

  const peerB = '127.0.0.1:6890'
  pex._localAddedPeers[peerB] = { ip: 4, flags: 0x06 }

  pex._sendMessage()
})

test('should _sendMessage when a localAdded has an IPv6 address', t => {
  t.plan(2)

  class ProtocolMock {
    extended (ext, obj) {
      t.equal(ext, 'ut_pex')
      t.deepEqual(obj, {
        added: Buffer.alloc(0),
        'added.f': Buffer.alloc(0),
        dropped: Buffer.alloc(0),
        added6: Buffer.from(string2compact(peer)),
        'added6.f': Buffer.from([0x06]),
        dropped6: Buffer.alloc(0)
      })
    }
  }

  const Extension = utPex()
  const wire = new ProtocolMock()
  const pex = new Extension(wire)

  const peer = '[::1]:6889'
  pex._localAddedPeers[peer] = { ip: 6, flags: 0x06 }

  pex._sendMessage()
})

test('should _sendMessage when multiple localAdded IPv6 addresses', t => {
  t.plan(2)

  class ProtocolMock {
    extended (ext, obj) {
      t.equal(ext, 'ut_pex')
      t.deepEqual(obj, {
        added: Buffer.alloc(0),
        'added.f': Buffer.alloc(0),
        dropped: Buffer.alloc(0),
        added6: Buffer.from(string2compact([peerA, peerB])),
        'added6.f': Buffer.from([0x06, 0x06]),
        dropped6: Buffer.alloc(0)
      })
    }
  }

  const Extension = utPex()
  const wire = new ProtocolMock()
  const pex = new Extension(wire)

  const peerA = '[::1]:6889'
  pex._localAddedPeers[peerA] = { ip: 6, flags: 0x06 }

  const peerB = '[::1]:6890'
  pex._localAddedPeers[peerB] = { ip: 6, flags: 0x06 }

  pex._sendMessage()
})

test('should _sendMessage when a localDropped has an IPv4 address', t => {
  t.plan(2)

  class ProtocolMock {
    extended (ext, obj) {
      t.equal(ext, 'ut_pex')
      t.deepEqual(obj, {
        added: Buffer.alloc(0),
        'added.f': Buffer.alloc(0),
        dropped: Buffer.from(string2compact(peer)),
        added6: Buffer.alloc(0),
        'added6.f': Buffer.alloc(0),
        dropped6: Buffer.alloc(0)
      })
    }
  }

  const Extension = utPex()
  const wire = new ProtocolMock()
  const pex = new Extension(wire)

  const peer = '127.0.0.1:6889'
  pex._localDroppedPeers[peer] = { ip: 4 }

  pex._sendMessage()
})

test('should _sendMessage when a localDropped has an IPv6 address', t => {
  t.plan(2)

  class ProtocolMock {
    extended (ext, obj) {
      t.equal(ext, 'ut_pex')
      t.deepEqual(obj, {
        added: Buffer.alloc(0),
        'added.f': Buffer.alloc(0),
        dropped: Buffer.alloc(0),
        added6: Buffer.alloc(0),
        'added6.f': Buffer.alloc(0),
        dropped6: Buffer.from(string2compact(peer))
      })
    }
  }

  const Extension = utPex()
  const wire = new ProtocolMock()
  const pex = new Extension(wire)

  const peer = '[::1]:6889'
  pex._localDroppedPeers[peer] = { ip: 6 }

  pex._sendMessage()
})
