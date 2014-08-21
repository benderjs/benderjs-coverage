'use strict';

var path = require( 'path' ),
	stream = require( 'stream' ),
	mime = require( 'mime' ),
	fs = require( 'fs' ),
	util = require( 'util' ),
	request = require( 'request' ),
	instrumenter = new( require( 'istanbul' ).Instrumenter )();

module.exports = {

	name: 'bender-middleware-coverage',

	attach: function() {
		var bender = this,
			logger;

		bender.checkDeps( module.exports.name, 'logger', 'applications', 'plugins' );

		logger = bender.logger.create( 'middleware-coverage', true );

		function Instrumenter( file, res ) {
			stream.Transform.call( this );

			this.file = file;
			this.res = res;
			this.chunks = [];
		}

		util.inherits( Instrumenter, stream.Transform );

		Instrumenter.prototype._transform = function( chunk, encoding, callback ) {
			var buffer = Buffer.isBuffer( chunk ) ? chunk : new Buffer( chunk, encoding );

			this.chunks.push( buffer );

			callback();
		};

		Instrumenter.prototype._flush = function( callback ) {
			var instrumented = instrumenter.instrumentSync( Buffer.concat( this.chunks ).toString(), this.file );

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
					/* istanbul ignore if:not much to test */
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

				if ( path.extname( filePath ) !== '.js' ) {
					return resume();
				}

				// TODO use file module and cached instrumented code if available
				if ( app.proxy ) {
					// proxy request to external server
					req
						.pipe( request( app.proxy + filePath ) )
						.pipe( new Instrumenter( filePath, res ) )
						.pipe( res );
				} else {
					filePath = path.relative(
						process.cwd(), path.join( app.path, bender.utils.stripParams( filePath ) )
					);

					// server file from local file system
					fs.createReadStream( filePath )
						.on( 'error', resume )
						.pipe( new Instrumenter( filePath, res ) )
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