'use strict';

var middleware = require( './middleware' ),
	reporter = require( './reporter' );

module.exports = {
	name: 'bender-coverage',

	attach: function() {
		var bender = this;

		bender.use( middleware );
		bender.use( reporter );
	}
};