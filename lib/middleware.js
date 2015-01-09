'use strict';

var path = require( 'path' ),
	stream = require( 'stream' ),
	mime = require( 'mime' ),
	util = require( 'util' ),
	request = require( 'request' ),
	preprocessor = require( './preprocessor' );

module.exports = {

	name: 'bender-middleware-coverage',

	attach: function() {
		var bender = this,
			logger;

		bender.checkDeps( module.exports.name, 'conf', 'logger', 'applications', 'plugins' );

		logger = bender.logger.create( 'middleware-coverage', true );

		/**
		 * Transofrms the code from an incomming stream and outputs the code instrumented by Istanbul
		 * @param {String} file File name used by Istanbul
		 * @param {Object} res  HTTP response
		 */
		function Transformer( file, res ) {
			stream.Transform.call( this );

			this.file = file;
			this.res = res;
			this.chunks = [];
		}

		util.inherits( Transformer, stream.Transform );

		Transformer.prototype._transform = function( chunk, encoding, callback ) {
			var buffer = Buffer.isBuffer( chunk ) ? chunk : new Buffer( chunk, encoding );

			this.chunks.push( buffer );

			callback();
		};

		Transformer.prototype._flush = function( callback ) {
			var instrumented = preprocessor.processContent( Buffer.concat( this.chunks ).toString(), this.file );

			// update response headers
			if ( this.res ) {
				this.res.writeHead( 200, {
					'Content-Type': mime.lookup( this.file ),
					'Content-Length': instrumented.length
				} );
			}

			this.push( instrumented );
			callback();
		};

		function build() {
			var pattern = /^\/apps\/([\w\-_%]+\/)([\w\/\.\-_%\?=&]+)$/;

			return function( req, res, next ) {
				var match = pattern.exec( req.url ),
					filePath,
					app;

				function resume( err ) {
					if ( err && err.code !== 'ENOENT' ) {
						logger.error( String( err ) );
					}

					next();
				}

				// url doesn't match /apps/<appname> and there's no app with given url or app is not proxied
				// TODO what about job's apps?
				if ( !match || !( app = bender.applications.findOne( 'url', match[ 1 ] ) ) || !app.proxy ) {
					return resume();
				}

				filePath = match[ 2 ];

				// it's not JS
				if ( path.extname( filePath ) !== '.js' ) {
					return resume();
				}

				// proxy a request to external server
				req
					.pipe( request( app.proxy + filePath ) )
					.on( 'error', resume )
					.pipe( new Transformer( filePath, res ) )
					.pipe( res );
			};
		}

		// add coverage middleware before the applications middleware
		var priority = bender.middlewares.getPriority( 'applications' );

		bender.middlewares.add( 'coverage', build, priority - 1 );
	}
};
