'use strict';

var path = require( 'path' ),
	Instrumenter = require( 'istanbul' ).Instrumenter,
	instrumenter;

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
			if ( !paths.length ||
				path.extname( file.oldPath ) !== '.js' ||
				!bender.files.isValidPath( file.oldPath, paths ) ) {
				return file;
			}

			file.content = processContent( file.content, file.oldPath );

			return file;
		}

		bender.preprocessors.push( processFile );
	}
};
