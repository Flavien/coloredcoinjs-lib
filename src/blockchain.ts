/// <reference path="node.d.ts" />
import http = require('http')
import bitcoin = require('bitcoinjs-lib')


export class BlockchaininfoDataAPI {
  request(path: string, cb: (error: any, response: string) => void):void {
    if (path.indexOf('cors=true') === -1)
      path += (path.indexOf('?') === -1 ? '?' : '&') + 'cors=true'

    var opts = {
      path: path,
      host: 'blockchain.info',
      port: 80
    }

    http.get(opts, function(res: any): void {
      var buf: string = ''

      res.on('data', function(data: string): void {
        buf += data
      })

      res.on('end', function(): void {
        cb(null, buf)
      })

      res.on('error', function(error: any): void {
        cb(error, null)
      })
    })
  }

  getBlockCount(cb: (error: any, blockCount: number) => void): void {
    this.request('/latestblock', function(error: any, response: string) {
      if (error === null) {
        try {
          var lastBlock = JSON.parse(response)
          if (lastBlock.height === undefined)
            throw 'height not found in response'
          else
            cb(null, lastBlock.height)
        } catch (e) {
          cb(error, null)
        }
      } else {
        cb(error, null)
      }
    })
  }
}

