/* jshint camelcase: false */

var Protocol = require('bittorrent-protocol')
var utPex = require('../')
var test = require('tape')
var net = require('net')

test.skip('should correctly add a peer', t => {
  let time
  const server = net.createServer().listen()

  var wire = new Protocol()
  wire.pipe(wire)

  wire.use(utPex())
  wire.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'))

  wire.ut_pex.on('peer', peer => {
    t.equal(peer, '127.0.0.1:6889')
    const diff = process.hrtime(time)[0]
    t.ok(diff > 60)
    t.end()
    server.close()
  })

  wire.once('extended', () => {
    time = process.hrtime()
    wire.ut_pex.start()
    wire.ut_pex.addPeer('127.0.0.1:6889')
  })
})

test.skip('should correctly drop a peer', t => {
  let time
  const server = net.createServer().listen()

  var wire = new Protocol()
  wire.pipe(wire)

  wire.use(utPex())
  wire.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'))

  wire.ut_pex.on('dropped', peer => {
    t.equal(peer, '127.0.0.1:6889')
    const diff = process.hrtime(time)[0]
    t.ok(diff > 60)
    t.end()
    server.close()
  })

  wire.once('extended', () => {
    time = process.hrtime()
    wire.ut_pex.start()
    wire.ut_pex.dropPeer('127.0.0.1:6889')
  })
})

test.skip('should ignore invalid addresses when added', t => {
  const server = net.createServer().listen()

  var wire = new Protocol()
  wire.pipe(wire)

  wire.use(utPex())
  wire.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'))

  wire.ut_pex.on('peer', peer => {
    t.fail(peer)
  })

  wire.once('extended', () => {
    wire.extended('ut_pex', { added: Buffer.from([0x7f, 0x00, 0x00, 0x01, 0x1a, 0xe9, 0xff]) })
    t.end()
    server.close()
  })
})

test.skip('should ignore invalid addresses when dropped', t => {
  const server = net.createServer().listen()

  var wire = new Protocol()
  wire.pipe(wire)

  wire.use(utPex())
  wire.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'))

  wire.ut_pex.on('peer', peer => {
    t.fail(peer)
  })

  wire.once('extended', () => {
    wire.extended('ut_pex', { dropped: Buffer.from([0x7f, 0x00, 0x00, 0x01, 0x1a, 0xe9, 0xff]) })
    t.end()
    server.close()
  })
})

test('should emit warning when peer does not support ut_pex', t => {
  const server = net.createServer().listen()

  var wire = new Protocol()
  var wire2 = new Protocol()

  wire.pipe(wire2).pipe(wire)

  wire.use(utPex())
  wire.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'))

  wire2.handshake(Buffer.from('01234567890123456789'), Buffer.from('12345678901234567890'))

  wire.ut_pex.on('warning', (err) => {
    t.fail(err)
  })

  wire.once('extended', () => {
    wire.extended('ut_pex', { dropped: Buffer.from([0x7f, 0x00, 0x00, 0x01, 0x1a, 0xe9, 0xff]) })
    t.end()
    server.close()
  })
})
