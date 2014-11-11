/**
 * @module compiler
 * @author sunjianpeng@yy.com
 * @date 2014-11-09
 */

'use strict';

var uglify = require('uglify-js');

module.exports = {
	/**
	 * process compile the codes
	 * @param code
	 * @param opts
	 * @returns {*}
	 */
	process: function (code, options) {
		//get Variables
		var Variables = [
			// Global object properties
			// (http://www.ecma-international.org/publications/standards/Ecma-262.htm) 15.1
			'NaN', 'Infinity', 'undefined',
			'eval', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'decodeURI',
			'decodeURIComponent', 'encodeURI', 'encodeURIComponent',
			'Object', 'Function', 'Array', 'String', 'Boolean', 'Number',
			'Date', 'RegExp', 'Error', 'EvalError', 'RangeError',
			'ReferenceError', 'SyntaxError', 'TypeError', 'URIError',
			'Math', 'JSON',
			//UserAgent global properties
			'Events', 'Navigator', 'Screen', 'History', 'Location', 'window', 'arguments', 'console',
			//common module argument
			'require', 'modue', 'exports',
			//try catch
			'e'
		];

		// Figure out if we're getting a template, or if we need to
		// load the template - and be sure to cache the result.
		// Generate a reusable function that will serve as a template
		// generator (and which will be cached).
		var tmp = "function anonymous(data){data = data||{};data.tmpl = this;var p = ''" + (options.lineNumber && ", line = 0, filepath = '" + options.filepath + "'" || "") + ";" +
			// Convert the template into pure JavaScript
			this.parse(code, options)
			+ "return p;}";
		var ast = uglify.parse(tmp);

		var walker = new uglify.TreeWalker(function (node) {
			//Variables
			if (node instanceof uglify.AST_Var) {
				// string_template is a cute little function that UglifyJS uses for warnings
				for (var i = 0, item; item = node.definitions[i]; i++) {
					Variables.push(item.name.name);
				}
			}

			//function name
			if (node instanceof uglify.AST_Defun) {
				Variables.push(node.name.name);
			}

			//function arguments
			if (node instanceof uglify.AST_SymbolFunarg) {
				Variables.push(node.name);
			}
		});

		ast.walk(walker);

		var symbolMap = {};

		for (var i = 0, symbol; symbol = Variables[i]; i++) {
			symbolMap[symbol] = true;
		}

		// transform and print
		var withExpression = 'data';
		var transformer = new uglify.TreeTransformer(null, function (node) {
			//clear function name
			if (node instanceof uglify.AST_Defun) {
				if (node.name.name == 'anonymous') {
					node.name.name = '';
				}
			}

			//add data scope
			if (node instanceof uglify.AST_Symbol) {
				if (!symbolMap[node.name]) {
					node.name = withExpression + '.' + node.name
				}
			}
		});

		var transformedAst = ast.transform(transformer);

		return transformedAst.print_to_string({
			beautify: true
		}) || '';
	},

	/**
	 * parse tpl to pure js
	 * @param code
	 * @param options
	 * @returns {string}
	 */
	parse: function (code, options) {
		var self = this,
			parsedCode = '',
			openTagCount = 0,
			closeTagCount = 0;

		if (options.lineNumber) {
			var codeArr = code.split(/\r?\n/);

			//parse line by line
			codeArr.forEach(function (codeSnip, index) {
                var needLine = true;

				if (/<%|%>/g.test(codeSnip)) {
					var matchedOpenTag = codeSnip.match(/<%/g),
						matchedCloseTag = codeSnip.match(/%>/g),
						openTagLen = matchedOpenTag && matchedOpenTag.length || 0,
						closeTagLen = matchedCloseTag && matchedCloseTag.length || 0;

					openTagCount += openTagLen;
					closeTagCount += closeTagLen;

					if (openTagLen > closeTagLen) {
						codeSnip += ' %>';
					}
					else if (openTagLen < closeTagLen) {
						codeSnip = '<% ' + codeSnip;
					}
				}
				else if (openTagCount != closeTagCount) {
					if (/^\s+$/g.test(codeSnip)) {
						codeSnip = false;
					}
					else {
						codeSnip = '<% ' + codeSnip + ' %>';
					}
				}
                else {
                    //pure html don't need tips of lineNumber
                    needLine = false;
                }

				if (codeSnip) {
					var codeLine = self._parseToPureJs(codeSnip);
					parsedCode += (needLine ? 'line = ' + (index + 1) + '; ' : '') + codeLine + '\n';
				}
			});

			//delete empty p += '';
			parsedCode = parsedCode.replace(/p\s*\+=\s*'';/g, "");

			//check compile error
			//tmpl syntax error
			if (openTagCount != closeTagCount) {
				var e = new Error(),
					reg = /<%|%>/g,
					matched,
					preMatchedTag,
					preLastIndex = 0;

				while ((matched = reg.exec(code)) !== null) {
					var matchedTag = matched[0],
						lastIndex = reg.lastIndex;

					if (preMatchedTag == matchedTag) {

						if (matchedTag == '<%') {
							lastIndex = preLastIndex;
							e.message = 'tmpl open Tag "<%" not closed!';
						}
						else {
							e.message = 'tmpl Tag "%>" has no open Tag!';
						}

						var lines = code.substr(0, lastIndex).match(/\n/g);
						e.line = (lines && lines.length || 0) + 1;
						break;
					}

					preMatchedTag = matchedTag;
					preLastIndex = lastIndex;
				}

				throw e;
			}
			//js syntax error
			else {
				try {
					uglify.parse(parsedCode);
				}
				catch (e) {
					throw e;
				}
			}

			//try catch
			parsedCode = 'try {' + parsedCode + '} catch(e) { if(window.console) { console.error("Source tmpl filepath: \'" + filepath + "\'"); console.error("Line Number: " + line); console.error(e.toString());} }';
		}
		else {
			parsedCode += self._parseToPureJs(code);
		}

		return parsedCode;
	},

	/**
	 * core parser
	 * @param code
	 * @returns {string}
	 * @private
	 */
	_parseToPureJs: function (code) {
		return "p +='" + code
			.replace(/[\r\t\n]/g, " ")
			.replace(/\s+/g, " ")
			.split("<%").join("\t")
			//replace str ' to \\'
			.replace(/(?:(^|%>)([^\t]*))/g, function ($0, $1, $2) {
				return $1 + $2.replace(/('|\\)/g, "\\$1")
			})
			.replace(/\t=(.*?)%>/g, "'; p+=$1; p+='")
			.split("\t").join("';")
			.split("%>").join("p +='")
			+ "';";
	}
};