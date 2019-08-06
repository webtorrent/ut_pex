// TODO: ipv6 support
// TODO: parse and send peer flags (currently unused)
// NOTE: addPeer should take in an optional second argument, flags
// TODO: destroy wire if peer sends PEX messages too frequently

var EventEmitter = require('events').EventEmitter
var compact2string = require('compact2string')
var string2compact = require('string2compact')
var bencode = require('bencode')

var PEX_INTERVAL = 65000 // just over one minute
var PEX_MAX_PEERS = 50 // max number of peers to advertise per PEX message

module.exports = () => {
  class utPex extends EventEmitter {
    constructor (wire) {
      super()

      this._wire = wire
      this._intervalId = null

      this.reset()
    }

    /**
     * Start sending regular PEX updates to remote peer.
     */
    start () {
      clearInterval(this._intervalId)
      this._intervalId = setInterval(() => this._sendMessage(), PEX_INTERVAL)
      if (this._intervalId.unref) this._intervalId.unref()
    }

    /**
     * Stop sending PEX updates to the remote peer.
     */
    stop () {
      clearInterval(this._intervalId)
      this._intervalId = null
    }

    /**
     * Stops sending updates to the remote peer and resets internal state of peers seen.
     */
    reset () {
      this._remoteAddedPeers = {}
      this._remoteDroppedPeers = {}
      this._localAddedPeers = {}
      this._localDroppedPeers = {}
      this.stop()
    }

    /**
     * Adds a peer to the locally discovered peer list for the next PEX message.
     */
    addPeer (peer) {
      if (peer.indexOf(':') < 0) return // disregard invalid peers
      if (peer in this._remoteAddedPeers) return // never advertise peer the remote wire already sent us
      if (peer in this._localDroppedPeers) delete this._localDroppedPeers[peer]
      this._localAddedPeers[peer] = true
    }

    /**
     * Adds a peer to the locally dropped peer list for the next PEX message.
     */
    dropPeer (peer) {
      if (peer.indexOf(':') < 0) return // disregard invalid peers
      if (peer in this._remoteDroppedPeers) return // never advertise peer the remote wire already sent us
      if (peer in this._localAddedPeers) delete this._localAddedPeers[peer]
      this._localDroppedPeers[peer] = true
    }

    onExtendedHandshake (handshake) {
      if (!handshake.m || !handshake.m.ut_pex) {
        return this.emit('warning', new Error('Peer does not support ut_pex'))
      }
    }

    /**
     * PEX messages are bencoded dictionaries with the following keys:
     * 'added'     : array of peers met since last PEX message
     * 'added.f'   : array of flags per peer
     *  '0x01'     : peer prefers encryption
     *  '0x02'     : peer is seeder
     * 'dropped'   : array of peers locally dropped from swarm since last PEX message
     * 'added6'    : ipv6 version of 'added'
     * 'added6.f'  : ipv6 version of 'added.f'
     * 'dropped.f' : ipv6 version of 'dropped'
     *
     * @param {Buffer} buf bencoded PEX dictionary
     */
    onMessage (buf) {
      var message

      try {
        message = bencode.decode(buf)
      } catch (err) {
        // drop invalid messages
        return
      }

      if (message.added) {
        compact2string.multi(message.added).forEach(peer => {
          delete this._remoteDroppedPeers[peer]
          if (!(peer in this._remoteAddedPeers)) {
            this._remoteAddedPeers[peer] = true
            this.emit('peer', peer)
          }
        })
      }

      if (message.dropped) {
        compact2string.multi(message.dropped).forEach(peer => {
          delete this._remoteAddedPeers[peer]
          if (!(peer in this._remoteDroppedPeers)) {
            this._remoteDroppedPeers[peer] = true
            this.emit('dropped', peer)
          }
        })
      }
    }

    /**
     * Sends a PEX message to the remote peer including information about any locally
     * added / dropped peers.
     */
    _sendMessage () {
      var localAdded = Object.keys(this._localAddedPeers).slice(0, PEX_MAX_PEERS)
      var localDropped = Object.keys(this._localDroppedPeers).slice(0, PEX_MAX_PEERS)

      var added = Buffer.concat(localAdded.map(string2compact))
      var dropped = Buffer.concat(localDropped.map(string2compact))

      var addedFlags = Buffer.concat(localAdded.map(() => {
        // TODO: support flags
        return Buffer.from([0])
      }))

      // update local deltas
      localAdded.forEach(peer => delete this._localAddedPeers[peer])
      localDropped.forEach(peer => delete this._localDroppedPeers[peer])

      // send PEX message
      this._wire.extended('ut_pex', {
        added: added,
        'added.f': addedFlags,
        dropped: dropped,
        added6: Buffer.alloc(0),
        'added6.f': Buffer.alloc(0),
        dropped6: Buffer.alloc(0)
      })
    }
  }

  utPex.prototype.name = 'ut_pex'

  return utPex
}
