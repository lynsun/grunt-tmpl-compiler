/**
 * @module tmplcompiler task
 * @author sunjianpeng@yy.com
 * @date 2014-07-13
 */

module.exports = function (grunt) {
    'use strict';
    var compiler = require('./compiler')
    var wrap = require('./wrap')
	var cheerio	= require('cheerio')
	
    grunt.registerMultiTask('tmplcompiler', 'tmpl compiler', function () {
        var options = this.options({
            wrap: 'default',
            lineNumber: false
        });
		
		
		var dest = '{',
			destSrc = '',
			beforeCompileTimeStamp  = new Date(), 
			tmplMap = {};
			
        this.files.forEach(function (file) {
            file.src.map(function (filepath) {
                // Warn on and remove invalid source files (if nonull was set).
                if (!grunt.file.exists(filepath)) {
                    return grunt.log.warn('Source file ' + filepath + ' not found.');
                }
				
                var src = grunt.file.read(filepath),
					$	= cheerio.load(src),
                    fileDest;

                options.filepath = filepath;
				destSrc = file.dest;
             
				$('script').each(function(index,element){
					var tmpl = $(this).text(),
						tmplFnName = $(this).attr('id');
					
					try{
						fileDest = compiler.process(tmpl, options);
					}catch(e){
						grunt.log.error('Compiled Error');
						grunt.log.warn('Source tmpl filepath: "' + filepath + '"');
						grunt.log.warn('Line Number: ' + e.line);
						grunt.log.warn(e.message);
						return;
					}
					
					tmplMap[tmplFnName]=fileDest;
					dest+='\r\n';
					dest+=tmplFnName+':';
					dest+=fileDest+',';
				});
            });
        });
		
		dest = dest.substr(0,dest.length-1);
		dest+='}'+'\r\n';
		
		dest = wrap(dest, options);
		
		if (options.banner) {
			dest = options.banner + grunt.util.linefeed + dest;
		}
		
		grunt.file.write(destSrc, dest);
		grunt.log.writeln('File ' + destSrc + 'created  (' + ( new Date() - beforeCompileTimeStamp ) / 1000 + 's)');
    });
};