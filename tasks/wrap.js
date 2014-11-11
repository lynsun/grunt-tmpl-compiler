/**
 * @Module wrap
 * @Author sunjianpeng@yy.com
 * @Date 2014-07-16.
 */

'use strict';

var wrapMap = {
    seajs: {
        before: 'define(function (require, exports, module) {\n return ',
        after: '});'
    },
    nodejs: {
        before: 'module.exports = ',
        after: ''
    },
    default: {
        before: 'define(function (require, exports, module) {\n return',
        after: '});'
    }
};

module.exports = function (code, options) {
    options = options || {};
    var wrap = options.wrap || 'default',
        wrapConfig;

    if (typeof wrap == 'string') {
        wrapConfig = wrapMap[wrap];
    }
    else if(typeof wrap == 'function') {
        code = wrap(code);
    }
    else if (typeof wrap == 'object') {
        wrapConfig = wrap;
    }

    if (wrapConfig) {
        code = (wrapConfig.before || '') + code;
        code += (wrapConfig.after || '');
    }

    return code;
};