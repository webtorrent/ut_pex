/*! ut_pex. MIT License. WebTorrent LLC <https://webtorrent.io/opensource> */

const EventEmitter = require('events').EventEmitter
const compact2string = require('compact2string')
const string2compact = require('string2compact')
const bencode = require('bencode')

const PEX_INTERVAL = 65000 // just over one minute
const PEX_MAX_PEERS = 50 // max number of peers to advertise per PEX message
const PEX_MIN_ALLOWED_INTERVAL = 60000 // should not receive messages below this interval

module.exports = () => {
  class utPex extends EventEmitter {
    constructor (wire) {
      super()

      this._wire = wire
      this._intervalId = null
      this._lastMessageTimestamp = 0

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
     * Adds a IPv4 peer to the locally discovered peer list for the next PEX message.
     */
    addPeer (peer, flags = 0x00) {
      this._addPeer(peer, flags, 4)
    }

    addPeer6 (peer, flags = 0x00) {
      this._addPeer(peer, flags, 6)
    }

    _addPeer (peer, flags, version) {
      if (peer.indexOf(':') < 0) return // disregard invalid peers
      if (peer in this._remoteAddedPeers) return // never advertise peer the remote wire already sent us
      if (peer in this._localDroppedPeers) delete this._localDroppedPeers[peer]
      this._localAddedPeers[peer] = { ip: version, flags: flags }
    }

    /**
     * Adds a IPv4 peer to the locally dropped peer list for the next PEX message.
     */
    dropPeer (peer) {
      this._dropPeer(peer, 4)
    }

    dropPeer6 (peer) {
      this._dropPeer(peer, 6)
    }

    _dropPeer (peer, version) {
      if (peer.indexOf(':') < 0) return // disregard invalid peers
      if (peer in this._remoteDroppedPeers) return // never advertise peer the remote wire already sent us
      if (peer in this._localAddedPeers) delete this._localAddedPeers[peer]
      this._localDroppedPeers[peer] = { ip: version }
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
     *  '0x04      : peer supports uTP
     *  '0x08      : peer supports ut_holepunch
     *  '0x10      : peer is reachable
     * 'dropped'   : array of peers locally dropped from swarm since last PEX message
     * 'added6'    : ipv6 version of 'added'
     * 'added6.f'  : ipv6 version of 'added.f'
     * 'dropped6'  : ipv6 version of 'dropped'
     *
     * @param {Buffer} buf bencoded PEX dictionary
     */
    onMessage (buf) {
      // check message rate
      const currentMessageTimestamp = Date.now()

      if (currentMessageTimestamp - this._lastMessageTimestamp < PEX_MIN_ALLOWED_INTERVAL) {
        this.reset()
        this._wire.destroy()
        return this.emit('warning', new Error('Peer disconnected for sending PEX messages too frequently'))
      } else {
        this._lastMessageTimestamp = currentMessageTimestamp
      }

      let message

      try {
        message = bencode.decode(buf)
      } catch (err) {
        // drop invalid messages
        return
      }

      if (message.added) {
        try {
          compact2string.multi(message.added).forEach((peer, idx) => {
            delete this._remoteDroppedPeers[peer]
            if (!(peer in this._remoteAddedPeers)) {
              const flags = message['added.f'][idx]
              this._remoteAddedPeers[peer] = { ip: 4, flags: flags }
              this.emit('peer', peer, flags)
            }
          })
        } catch (err) {
          // drop invalid messages
          return
        }
      }

      if (message.added6) {
        try {
          compact2string.multi6(message.added6).forEach((peer, idx) => {
            delete this._remoteDroppedPeers[peer]
            if (!(peer in this._remoteAddedPeers)) {
              const flags = message['added6.f'][idx]
              this._remoteAddedPeers[peer] = { ip: 6, flags: flags }
              this.emit('peer', peer, flags)
            }
          })
        } catch (err) {
          // drop invalid messages
          return
        }
      }

      if (message.dropped) {
        try {
          compact2string.multi(message.dropped).forEach(peer => {
            delete this._remoteAddedPeers[peer]
            if (!(peer in this._remoteDroppedPeers)) {
              this._remoteDroppedPeers[peer] = { ip: 4 }
              this.emit('dropped', peer)
            }
          })
        } catch (err) {
          // drop invalid messages
          return
        }
      }

      if (message.dropped6) {
        try {
          compact2string.multi6(message.dropped6).forEach(peer => {
            delete this._remoteAddedPeers[peer]
            if (!(peer in this._remoteDroppedPeers)) {
              this._remoteDroppedPeers[peer] = { ip: 6 }
              this.emit('dropped', peer)
            }
          })
        } catch (err) {
          // drop invalid messages
        }
      }
    }

    /**
     * Sends a PEX message to the remote peer including information about any locally
     * added / dropped peers.
     */
    _sendMessage () {
      const localAdded = Object.keys(this._localAddedPeers).slice(0, PEX_MAX_PEERS)
      const localDropped = Object.keys(this._localDroppedPeers).slice(0, PEX_MAX_PEERS)

      const _isIPv4 = (peers, addr) => peers[addr].ip === 4
      const _isIPv6 = (peers, addr) => peers[addr].ip === 6
      const _flags = (peers, addr) => peers[addr].flags

      const added = localAdded
        .filter(k => _isIPv4(this._localAddedPeers, k))
        .map(string2compact)
        .reduce((acc, cur) => Buffer.concat([acc, cur]), Buffer.alloc(0))

      const added6 = localAdded
        .filter(k => _isIPv6(this._localAddedPeers, k))
        .map(string2compact)
        .reduce((acc, cur) => Buffer.concat([acc, cur]), Buffer.alloc(0))

      const dropped = localDropped
        .filter(k => _isIPv4(this._localDroppedPeers, k))
        .map(string2compact)
        .reduce((acc, cur) => Buffer.concat([acc, cur]), Buffer.alloc(0))

      const dropped6 = localDropped
        .filter(k => _isIPv6(this._localDroppedPeers, k))
        .map(string2compact)
        .reduce((acc, cur) => Buffer.concat([acc, cur]), Buffer.alloc(0))

      const addedFlags = localAdded
        .filter(k => _isIPv4(this._localAddedPeers, k))
        .map(k => _flags(this._localAddedPeers, k))
        .reduce((acc, cur) => Buffer.from([cur]), Buffer.alloc(0))

      const added6Flags = localAdded
        .filter(k => _isIPv6(this._localAddedPeers, k))
        .map(k => _flags(this._localAddedPeers, k))
        .reduce((acc, cur) => Buffer.from([cur]), Buffer.alloc(0))

      // update local deltas
      localAdded.forEach(peer => delete this._localAddedPeers[peer])
      localDropped.forEach(peer => delete this._localDroppedPeers[peer])

      // send PEX message
      this._wire.extended('ut_pex', {
        added: added,
        'added.f': addedFlags,
        dropped: dropped,
        added6: added6,
        'added6.f': added6Flags,
        dropped6: dropped6
      })
    }
  }

  utPex.prototype.name = 'ut_pex'

  return utPex
}
