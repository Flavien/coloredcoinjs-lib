/// <reference path="node.d.ts" />
var http = require('http');

var BlockchaininfoDataAPI = (function () {
    function BlockchaininfoDataAPI() {
    }
    BlockchaininfoDataAPI.prototype.request = function (path, cb) {
        if (path.indexOf('cors=true') === -1)
            path += (path.indexOf('?') === -1 ? '?' : '&') + 'cors=true';

        var opts = {
            path: path,
            host: 'blockchain.info',
            port: 80
        };

        http.get(opts, function (res) {
            var buf = '';

            res.on('data', function (data) {
                buf += data;
            });

            res.on('end', function () {
                cb(null, buf);
            });

            res.on('error', function (error) {
                cb(error, null);
            });
        });
    };

    BlockchaininfoDataAPI.prototype.getBlockCount = function (cb) {
        this.request('/latestblock', function (error, response) {
            if (error === null) {
                try  {
                    var lastBlock = JSON.parse(response);
                    if (lastBlock.height === undefined)
                        throw 'height not found in response';
                    else
                        cb(null, lastBlock.height);
                } catch (e) {
                    cb(error, null);
                }
            } else {
                cb(error, null);
            }
        });
    };
    return BlockchaininfoDataAPI;
})();
exports.BlockchaininfoDataAPI = BlockchaininfoDataAPI;
