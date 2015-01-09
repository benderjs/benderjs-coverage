'use strict';

var path = require( 'path' ),
	istanbul = require( 'istanbul' ),
	collectors = {},
	writeQueue = [],
	writeDone = true,
	writeCallback,
	logger,
	type,
	dir,
	db;

module.exports = {

	name: 'bender-reporter-coverage',

	collectors: collectors,

	attach: function() {
		var bender = this;

		bender.checkDeps( module.exports.name, 'database', 'logger' );

		db = bender.database.get( 'coverage' );

		logger = bender.logger.create( 'coverage', true );

		dir = bender.conf.coverage && bender.conf.coverage.outputDirectory || 'coverage/';
		type = bender.conf.coverage && bender.conf.coverage.type || 'html';

		function listCollectors() {
			return Object.keys( collectors );
		}

		function saveCollector( name, collector ) {
			var query = {
					name: name
				},
				update = {
					name: name,
					data: JSON.stringify( collector )
				},
				options = {
					upsert: true
				};

			db.update( query, update, options, function( err, count, upsert ) {
				if ( err ) {
					logger.error( String( err ) );
				}

				// compact the results to save the space
				if ( !upsert ) {
					db.persistence.compactDatafile();
				}
			} );
		}

		function writeReports( callback ) {
			writeDone = false;

			function done() {
				if ( typeof writeCallback == 'function' ) {
					writeCallback();
					writeCallback = null;
				}
			}

			function next() {
				var name = writeQueue.shift(),
					collector,
					directory,
					reporter;

				if ( !name ) {
					writeDone = true;

					if ( typeof callback == 'function' ) {
						callback( done );
					} else {
						done();
					}

					return;
				}

				if ( ( collector = collectors[ name ] ) ) {
					name = name.split( '_' );

					if ( bender.database.mode === bender.database.MODES.FILE ) {
						directory = path.join( '.bender/jobs/', name[ 0 ], '/coverage/', name[ 1 ] || 'all' );
					} else {
						if ( !name[ 1 ] ) {
							return next();
						}

						directory = path.join( dir, name[ 1 ] );
					}

					bender.utils.mkdirp( directory, function( err ) {
						if ( err ) {
							return logger.error( String( err ) );
						}

						reporter = istanbul.Report.create( type, {
							dir: directory
						} );

						reporter.on( 'done', next );

						reporter.writeReport( collector );
					} );
				} else {
					next();
				}
			}

			next();
		}

		bender.on( 'job:start', function( job ) {
			// add a collector for each browser
			job.browsers.forEach( function( browser ) {
				var name = job._id + '_' + browser;

				collectors[ name ] = new istanbul.Collector();
				saveCollector( name, collectors[ name ] );
			} );

			// add a summary collector
			collectors[ job._id ] = new istanbul.Collector();
			saveCollector( job._id, collectors[ job._id ] );
		} );

		bender.on( 'job:change', function( job ) {
			var existing = listCollectors()
				.filter( function( name ) {
					return name.indexOf( job._id + '_' ) === 0;
				} )
				.map( function( name ) {
					return name.replace( job._id + '_', '' );
				} ),
				toAdd = job.browsers.filter( function( name ) {
					return existing.indexOf( name ) === -1;
				} ).map( function( name ) {
					return job._id + '_' + name;
				} ),
				toRemove = existing.filter( function( name ) {
					return job.browsers.indexOf( name ) === -1;
				} ).map( function( name ) {
					return job._id + '_' + name;
				} ),
				query;

			// add new browser collectors
			toAdd.forEach( function( name ) {
				collectors[ name ] = new istanbul.Collector();
				saveCollector( name, collectors[ name ] );
			} );

			// remove unneeded collectors
			toRemove.forEach( function( name ) {
				if ( collectors[ name ] ) {
					collectors[ name ].dispose();
					delete collectors[ name ];
				}
			} );

			query = {
				name: {
					$in: toRemove
				}
			};

			db.remove( query, {
				multi: true
			} );
		} );

		bender.on( 'job:remove', function( id ) {
			listCollectors()
				.forEach( function( name ) {
					if ( name.indexOf( id ) === 0 ) {
						collectors[ name ].dispose();
						delete collectors[ name ];

						db.remove( {
							name: name
						} );
					}
				} );
		} );

		bender.on( 'job:complete', function( job ) {
			var summaryCollector = collectors[ job._id ],
				names = [ job._id ];

			job.browsers.forEach( function( browser ) {
				var collector = collectors[ job._id + '_' + browser ];

				names.push( job._id + '_' + browser );

				// add each browsers coverage to the summary collector
				if ( collector ) {
					summaryCollector.add( collector.getFinalCoverage() );
				}
			} );

			writeQueue = writeQueue.concat( names );

			writeReports( function( done ) {
				bender.jobs.update( job._id, {
					coverage: true
				} )
					.done( done, function( err ) {
						if ( err ) {
							logger.error( String( err ) );
						}

						done();
					} );
			} );
		} );

		// add coverage to the collector
		bender.on( 'client:complete', function( data ) {
			var name = data.jobId + '_' + data.client.browser + data.client.version,
				collector = collectors[ name ];

			if ( !collector ) {
				name = data.jobId + '_' + data.client.browser;
				collector = collectors[ name ];
			}

			if ( collector ) {
				if ( !data.coverage ) {
					return logger.warn( 'No coverage info was collected for', data.id );
				}

				collector.add( data.coverage );
				saveCollector( name, collector );
			}
		} );

		bender.reporters.add( 'coverage', this );
	},

	init: function( done ) {
		// restore the coverage results
		db.find( {}, function( err, results ) {
			results.forEach( function( result ) {
				var collector = collectors[ result.name ] = new istanbul.Collector();

				collector.store.map = JSON.parse( result.data ).store.map;
			} );

			done();
		} );
	},

	detach: function( done ) {
		if ( writeQueue.length || !writeDone ) {
			writeCallback = done;
		} else {
			done();
		}
	}
};
