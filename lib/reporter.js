'use strict';

var path = require( 'path' ),
	util = require( 'util' ),
	istanbul = require( 'istanbul' ),
	collectors = {},
	writers = [],
	logger,
	type,
	dir,
	db;

module.exports = {

	name: 'bender-reporter-coverage',

	collectors: collectors,

	attach: function() {
		var bender = this;

		db = bender.database.get( 'coverage' );

		logger = bender.logger.create( 'coverage', true );

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

		function listCollectors() {
			return Object.keys( collectors );
		}

		bender.on( 'job:start', function( job ) {
			// add a collector for each browser
			job.browsers.forEach( function( browser ) {
				collectors[ job._id + browser ] = new istanbul.Collector();
			} );

			// add a summary collector
			collectors[ job._id ] = new istanbul.Collector();
		} );

		bender.on( 'job:change', function( job ) {
			var existing = listCollectors()
				.filter( function( name ) {
					return name.indexOf( job.id ) === 0;
				} )
				.map( function( name ) {
					return name.replace( job.id, '' );
				} ),
				toAdd = [],
				toRemove = [];

			// TODO remove unneeded collectors and add missing ones
		} );

		bender.on( 'job:remove', function( id ) {
			listCollectors()
				.forEach( function( name ) {
					if ( name.indexOf( id ) === 0 ) {
						collectors[ name ].dispose();
						delete collectors[ name ];
					}
				} );
		} );

		bender.on( 'job:complete', function( job ) {
			var summaryCollector = collectors[ job._id ];

			job.browsers.forEach( function( browser ) {
				var collector = collectors[ job._id + browser ];

				// add each browsers coverage to the summary collector
				if ( collector ) {
					// TODO build a report based on each collector
					summaryCollector.add( collector.getFinalCoverage() );
				}
			} );

			// TODO build a report based on summary collector

		} );

		// add coverage to the collector
		bender.on( 'client:complete', function( data ) {
			var name = data.jobId + data.client.browser + data.client.version,
				collector = collectors[ name ];

			if ( !collector ) {
				name = data.jobId + data.client.browser;
				collector = collectors[ name ];
			}

			if ( collector ) {
				collector.add( data.coverage );
				saveCollector( name, collector );
			}
		} );
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
		// TODO check if all the writers are ready and then call done

		done();
	}

	// attach: function() {
	// 	var bender = this;

	// 	dir = bender.conf.coverage && bender.conf.coverage.directory || 'coverage/';
	// 	type = bender.conf.coverage && bender.conf.coverage.type || 'html';

	// 	bender.on( 'client:afterRegister', function( client ) {
	// 		var name = client.browser + '_' + client.version;

	// 		if ( !collectors[ name ] ) {
	// 			collectors[ name ] = new istanbul.Collector();
	// 		}
	// 	} );

	// 	bender.on( 'client:complete', function( data ) {
	// 		var name = data.client.browser + '_' + data.client.version;

	// 		if ( collectors[ name ] && data.coverage ) {
	// 			collectors[ name ].add( data.coverage );
	// 		}
	// 	} );
	// },

	// detach: function( done ) {
	// 	var names = Object.keys( collectors ),
	// 		bender = this;

	// 	if ( !names.length ) {
	// 		done();
	// 	}

	// 	function next( err ) {
	// 		var name = names.shift(),
	// 			directory,
	// 			collector,
	// 			reporter;

	// 		if ( err ) {
	// 			return done( err );
	// 		}

	// 		if ( !name ) {
	// 			return done();
	// 		}

	// 		directory = path.join( dir, name );
	// 		collector = collectors[ name ];

	// 		bender.utils.mkdirp( directory, function( err ) {
	// 			if ( err ) {
	// 				return done( err );
	// 			}

	// 			reporter = istanbul.Report.create( type, {
	// 				dir: directory
	// 			} );

	// 			reporter.on( 'done', next );

	// 			reporter.writeReport( collector );
	// 		} );
	// 	}

	// 	next();
	// }
};