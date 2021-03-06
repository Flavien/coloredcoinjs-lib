var assert = require('assert')

var _ = require('lodash')
var Q = require('q')

var ColorDefinition = require('./ColorDefinition')
var ColorValue = require('./ColorValue')
var ColorDataStorage = require('./ColorDataStorage')
var Transaction = require('./Transaction')


/**
 * @class ColorData
 *
 * @param {ColorDataStorage} storage
 */
function ColorData(storage) {
  assert(storage instanceof ColorDataStorage,
    'Expected storage instance of ColorDataStorage, got ' + storage)

  this.storage = storage
}

/**
 * Return ColorValue currently present in ColorDataStorage
 *
 * @param {string} txId
 * @param {number} outIndex
 * @param {ColorDefinition} colorDefinition
 * @return {?ColorValue}
 */
ColorData.prototype.fetchColorValue = function(txId, outIndex, colorDefinition) {
  assert(Transaction.isTxId(txId), 'Expected transactionId txId, got ' + txId)
  assert(_.isNumber(outIndex), 'Expected number outIndex, got ' + outIndex)
  assert(colorDefinition instanceof ColorDefinition,
    'Expected ColorDefinition colorDefinition, got ' + colorDefinition)

  var colorValue = null

  var colorData = this.storage.get({
    colorId: colorDefinition.getColorId(),
    txId: txId,
    outIndex: outIndex
  })
  if (colorData !== null)
    colorValue = new ColorValue(colorDefinition, colorData.value)

  return colorValue
}

/**
 * @callback ColorData~scanTx
 * @param {?Error} error
 */

/**
 * Scan transaction to obtain color data for its outputs
 *
 * @param {Transaction} tx
 * @param {?number[]} outputIndices
 * @param {ColorDefinition} colorDefinition
 * @param {function} getTxFn
 * @param {ColorData~scanTx} cb Called on finished with params (error)
 */
ColorData.prototype.scanTx = function(tx, outputIndices, colorDefinition, getTxFn, cb) {
  assert(tx instanceof Transaction, 'Expected Transaction tx, got ' + tx)
  assert(_.isArray(outputIndices) || _.isNull(outputIndices), 'Expected Array|null outputIndices, got ' + outputIndices)
  if (_.isArray(outputIndices))
    assert(outputIndices.every(function(oi) { return _.isNumber(oi) }),
      'Expected outputIndices Array numbers, got ' + outputIndices)
  assert(colorDefinition instanceof ColorDefinition,
    'Expected ColorDefinition colorDefinition, got ' + colorDefinition)
  assert(_.isFunction(cb), 'Expected function cb, got ' + cb)

  var self = this

  Q.fcall(function() {
    var inColorValues = []
    var empty = true

    tx.ins.forEach(function(input) {
      var colorData = self.storage.get({
        colorId: colorDefinition.getColorId(),
        txId: Array.prototype.reverse.call(new Buffer(input.hash)).toString('hex'),
        outIndex: input.index
      })

      var colorValue = null
      if (colorData !== null) {
        empty = false
        colorValue = new ColorValue(colorDefinition, colorData.value)
      }
      inColorValues.push(colorValue)
    })

    if (empty && !colorDefinition.isSpecialTx(tx))
      return

    return Q.ninvoke(colorDefinition, 'runKernel', tx, inColorValues, getTxFn).then(function(outColorValues) {
      outColorValues.forEach(function(colorValue, index) {
        var skipAdd = colorValue === null || (outputIndices !== null && outputIndices.indexOf(index) === -1)

        if (!skipAdd)
          self.storage.add({
            colorId: colorDefinition.getColorId(),
            txId: tx.getId(),
            outIndex: index,
            value: colorValue.getValue()
          })
      })
    })

  }).done(function(){ cb(null) }, function(error) { cb(error) })
}

/**
 * @callback ColorData~getColorValue
 * @param {?Error} error
 * @param {?ColorValue} colorValue
 */

/**
 * For a given txId, outIndex and colorDefinition return ColorValue or null if
 *  colorDefinition not represented in given txOut
 *
 * @param {string} txId
 * @param {number} outIndex
 * @param {ColorDefinition} colorDefinition
 * @param {function} getTxFn
 * @param {ColorData~getColorValue} cb
 */
ColorData.prototype.getColorValue = function(txId, outIndex, colorDefinition, getTxFn, cb) {
  assert(Transaction.isTxId(txId), 'Expected transactionId txId, got ' + txId)
  assert(_.isNumber(outIndex), 'Expected number outIndex, got ' + outIndex)
  assert(colorDefinition instanceof ColorDefinition,
    'Expected ColorDefinition colorDefinition, got ' + colorDefinition)
  assert(_.isFunction(cb), 'Expected function cb, got ' + cb)

  var self = this

  Q.fcall(function() {
    var scannedOutputs = []

    function processOne(txId, outIndex) {
      if (scannedOutputs.indexOf(txId + outIndex) !== -1)
        return

      scannedOutputs.push(txId + outIndex)

      var colorValue = self.fetchColorValue(txId, outIndex, colorDefinition)
      if (colorValue !== null)
        return

      function processTx(tx) {
        return Q.nfcall(colorDefinition.constructor.getAffectingInputs, tx, [outIndex], getTxFn)
          .then(function(inputs) {
            var promise = Q()

            inputs.forEach(function(input) {
              var txId = Array.prototype.reverse.call(new Buffer(input.hash)).toString('hex')
              promise = promise.then(function() {
                return Q.fcall(processOne, txId, input.index)
              })
            })

            promise = promise.then(function() {
              return Q.ninvoke(self, 'scanTx', tx, null, colorDefinition, getTxFn)

            })

            return promise
          })
      }

      return Q.nfcall(getTxFn, txId).then(processTx)
    }

    return Q.fcall(processOne, txId, outIndex)

  }).then(function() {
    return self.fetchColorValue(txId, outIndex, colorDefinition)

  }).done(function(colorValue) { cb(null, colorValue) }, function(error) { cb(error) })
}


module.exports = ColorData
