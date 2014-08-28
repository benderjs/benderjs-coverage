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
			config = bender.conf.coverage || {};

		instrumenter = new Instrumenter( config.options || {} );

		if ( config.paths ) {
			config.paths.forEach( function( coverPath ) {
				if ( coverPath[ 0 ] !== '!' ) {
					bender.files.watch( coverPath );
				}
			} );
		}

		function processFile( file ) {
			if ( !config.paths ||
				!bender.files.isValidPath( file.oldPath, config.paths ) ||
				path.extname( file.oldPath ) !== '.js' ) {
				return file;
			}

			file.content = processContent( file.content, file.oldPath );

			return file;
		}

		bender.preprocessors.push( processFile );
	}
};