'use strict';

var path = require( 'path' ),
	Instrumenter = require( 'istanbul' ).Instrumenter,
	instrumenter;

/**
 * Instrument the code synchronously
 * @param  {String} content Contents of a file
 * @param  {String} file    Original file path
 * @return {String}
 */
function processContent( content, file ) {
	return instrumenter.instrumentSync( content, file );
}

module.exports = {
	name: 'bender-preprocessor-coverage',

	processContent: processContent,

	attach: function() {
		var bender = this,
			config = bender.conf.coverage || {},
			paths = config.paths || [];

		instrumenter = new Instrumenter( config.options || {} );

		function processFile( file ) {
			// no paths to instrument defined
			if ( !paths.length ||
				// orginalPath has to be a string if we want to read its extension, some _helpers and _assets has boolean value here
				typeof file.originalPath == 'boolean' ||
				// we work with JS files only
				path.extname( file.originalPath ) !== '.js' ||
				// if the path is the same as the originalPath
				// then the file wasn't copied to the job's directory
				// and we don't care about it
				file.path === file.originalPath ||
				// file doesn't match the instrumentation paths
				!bender.files.isValidPath( file.originalPath, paths ) ) {
				return file;
			}

			file.content = new Buffer( processContent( file.content.toString(), file.originalPath ), 'utf-8' );

			return file;
		}

		bender.preprocessors.add( 'coverage', processFile );
	}
};
