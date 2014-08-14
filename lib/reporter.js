'use strict';

var path = require( 'path' ),
	util = require( 'util' ),
	istanbul = require( 'istanbul' ),
	Store = istanbul.Store,
	collectors = {},
	type,
	dir;

module.exports = {

	name: 'bender-reporter-coverage',

	collectors: collectors,

	attach: function() {
		var bender = this;

		dir = bender.conf.coverage && bender.conf.coverage.directory || 'coverage/';
		type = bender.conf.coverage && bender.conf.coverage.type || 'html';

		bender.on( 'client:afterRegister', function( client ) {
			var name = client.browser + '_' + client.version;
			if ( !collectors[ name ] ) {
				collectors[ name ] = new istanbul.Collector();
			}
		} );

		bender.on( 'client:complete', function( data ) {
			var name = data.client.browser + '_' + data.client.version;

			if ( collectors[ name ] && data.coverage ) {
				collectors[ name ].add( data.coverage );
			}
		} );
	},

	detach: function( done ) {
		var names = Object.keys( collectors ),
			bender = this;

		if ( !names.length ) {
			done();
		}

		function next( err ) {
			var name = names.shift(),
				directory,
				collector,
				reporter;

			if ( err ) {
				return done( err );
			}

			if ( !name ) {
				return done();
			}

			directory = path.join( dir, name );
			collector = collectors[ name ];

			bender.utils.mkdirp( directory, function( err ) {
				if ( err ) {
					return done( err );
				}

				reporter = istanbul.Report.create( type, {
					dir: directory
				} );

				reporter.on( 'done', next );

				reporter.writeReport( collector );
			} );
		}

		next();
	}
};