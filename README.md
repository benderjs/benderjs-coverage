# benderjs-coverage

Code coverage plugin for Bender.js.

Generates code coverage reports using [Istanbul](http://gotwarlost.github.io/istanbul/).

Works in `bender run` mode and for bender jobs.

Links to the detailed coverage reports are available on the job's page after it's completed.

## Install

```
npm install benderjs-coverage
```

## Usage

Add `benderjs-coverage` to the plugins array in your `bender.js` configuration file:

```js
var config = {
    applications: {...}

    browsers: [...],

    plugins: ['benderjs-jasmine', 'benderjs-coverage'], // load the plugin

    tests: {...}
};

module.exports = config;
```

Add coverage configuration:

```js
var config = {
    applications: {...},

    // add your coverage configuration
    coverage: {
        paths: [
            'lib/**/*.js'
        ]
    },

    browsers: [...],

    plugins: ['benderjs-jasmine', 'benderjs-coverage'], // load the plugin

    tests: {...}
};

module.exports = config;
```

## Configuration options

### paths

*(Required)*

An array of file path matchers used to mark which files should be preprocessed by this plugin.
It provides globstar matching using [minimatch](https://github.com/isaacs/minimatch).

### outputDirectory

*(Optional)*

**Default:** 'coverage/'

A path to the directory where the coverage reports will be put.

### type

*(Optional)*

**Default:** 'html'

A type of the coverage report. Check [Istanbul website](http://gotwarlost.github.io/istanbul/) for available values.

### options

*(Optional)*

Configuration options for the Istanbul Instrumenter. Check [Istanbul website](http://gotwarlost.github.io/istanbul/) for more information.

## License

MIT, for license details see: [LICENSE.md](https://github.com/benderjs/benderjs-coverage/blob/master/LICENSE.md).