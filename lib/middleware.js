'use strict';

var path = require( 'path' ),
	stream = require( 'stream' ),
	mime = require( 'mime' ),
	fs = require( 'fs' ),
	util = require( 'util' ),
	request = require( 'request' ),
	Instrumenter = require( 'istanbul' ).Instrumenter;

module.exports = {

	name: 'bender-middleware-coverage',

	attach: function() {
		var bender = this,
			instrumenter,
			logger;

		bender.checkDeps( module.exports.name, 'conf', 'logger', 'applications', 'plugins' );

		logger = bender.logger.create( 'middleware-coverage', true );

		instrumenter = new Instrumenter( bender.conf.coverage && bender.conf.coverage.options );

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
			var instrumented = instrumenter.instrumentSync( Buffer.concat( this.chunks ).toString(), this.file );

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

				// url doesn't match /apps/<appname> and there's no app with given url
				if ( !match || !( app = bender.applications.findOne( 'url', match[ 1 ] ) ) ) {
					return resume();
				}

				filePath = match[ 2 ];

				// it's not JS
				if ( path.extname( filePath ) !== '.js' ) {
					return resume();
				}

				// TODO use file module and cached instrumented code if available
				if ( app.proxy ) {
					// proxy a request to external server
					req
						.pipe( request( app.proxy + filePath ) )
						.on( 'error', resume )
						.pipe( new Transformer( filePath, res ) )
						.pipe( res );
				} else {
					filePath = path.relative(
						process.cwd(), path.join( app.path, bender.utils.stripParams( filePath ) )
					);

					// server a file from the local file system
					fs.createReadStream( filePath )
						.on( 'error', resume )
						.pipe( new Transformer( filePath, res ) )
						.pipe( res );
				}
			};
		}

		var appMiddleware,
			appMiddlewareIndex;

		// add coverage middleware before the applications middleware
		if ( ( appMiddleware = bender.plugins[ 'bender-middleware-applications' ] ) ) {
			if ( ( appMiddlewareIndex = bender.middlewares.indexOf( appMiddleware.build ) ) > -1 ) {
				bender.middlewares.splice( appMiddlewareIndex, 0, build );
			}
		}
	}
};