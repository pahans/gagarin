var Promise = require('es6-promise').Promise;
var either  = require('./index').either;

module.exports = function genericPromiseChain(methods, myPrototype, defaultAction) {

  if (typeof defaultAction !== 'function') {
    defaultAction = canonical;
  }

  function GenericPromiseChain (operand) {
    "use strict";

    var self = this;

    this._operand = operand;
    this._promise = typeof operand === 'function' ? operand() : operand;
  }

  GenericPromiseChain.prototype = Object.create(myPrototype);

  [ 'then', 'catch' ].forEach(function (name) {

    GenericPromiseChain.prototype[name] = function () {
      "use strict";
      this._promise = this._promise[name].apply(this._promise, arguments);
      return this;
    };

  });

  GenericPromiseChain.prototype.always = function (callback) {
    "use strict";

    return this.then(function (result) { callback(null, result) }, callback);
  };

  GenericPromiseChain.prototype.sleep = function (timeout) {
    "use strict";

    var self = this;
    return self.then(function () {
      return new Promise(function (resolve) {
        setTimeout(resolve, timeout);
      });
    });
  };

  GenericPromiseChain.prototype.expectError = function (callback) {
    "use strict";

    var self = this;
    return self.then(function () {
      throw new Error('exception was not thrown');
    }, callback);
  };

  GenericPromiseChain.prototype.noWait = function () {
    "use strict";
    
    return new GenericPromiseChain(this._operand);
  };

  GenericPromiseChain.prototype.branch = function () {
    "use strict";
    
    return new GenericPromiseChain(this._operand, this._promise);
  };

  GenericPromiseChain.prototype.yet = function (code, args) {
    "use strict";

    var args = Array.prototype.slice.call(arguments, 0);
    var self = this;
    //--------------------------------
    return self.catch(function (err) {
      return self.noWait().execute(code, args).then(function (errMessage) {
        throw new Error(err.message + ' ' + errMessage);
      });
    });
  };

  GenericPromiseChain.prototype.methods = methods.concat([
    '__custom__',
    'catch',
    'then',
    'always',
    'sleep',
    'expectError',
    'noWait',
    'branch',
    'yet',
  ]);

  GenericPromiseChain.prototype.__custom__ = function (action) {
    var self = this;
    self._promise = Promise.all([
      typeof self._operand === 'function' ? self._operand() : self._operand, self._promise
    ]).then(function (all) {
      return new Promise(function (resolve, reject) {
        var operand = all[0];
        if (!operand || typeof operand !== 'object') {
          reject(new Error('GenericPromiseChain: invalid operand'));
        }
        action(operand, either(cleanError(reject)).or(resolve));
      });
    });
    return self;
  };



  methods.forEach(function (name) {
    "use strict";

    /**
     * Update the current promise and return this to allow chaining.
     */
    GenericPromiseChain.prototype[name] = function () {
      var args = Array.prototype.slice.call(arguments, 0);
      return this.__custom__(function (operand, done) {
        defaultAction(operand, name, args, done);
      });
    };

  });

  function canonical (operand, name, args, done) {
    if (!operand[name]) {
      done(new Error('GenericPromiseChain: operand does not implement method: ' + name));
    } else {
      args.push(done);
      operand[name].apply(operand, args);
    }
  }

  return GenericPromiseChain;

}

function cleanError(reject) {
  return function (err) {
    if (err && !(err instanceof Error)) {
      err = new Error(err.message || err.toString());
    }
    reject(err);
  }
}
