'use strict';

var middleware = require( './middleware' ),
	preprocessor = require( './preprocessor' ),
	reporter = require( './reporter' );

module.exports = {
	name: 'bender-coverage',

	attach: function() {
		var bender = this;

		bender.use( middleware );
		bender.use( preprocessor );
		bender.use( reporter );
	}
};