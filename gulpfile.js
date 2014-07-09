
var _ = require('lodash');
var changelog = require('conventional-changelog');
var dgeni = require('dgeni');
var glob = require('glob').sync;
var gulp = require('gulp');
var karma = require('karma').server;
var pkg = require('./package.json');
var fs = require('fs');

var argv = require('minimist')(process.argv.slice(2));

var concat = require('gulp-concat');
var footer = require('gulp-footer');
var gulpif = require('gulp-if');
var header = require('gulp-header');
var jshint = require('gulp-jshint');
var minifyCss = require('gulp-minify-css');
var rename = require('gulp-rename');
var sass = require('gulp-sass');
var stripDebug = require('gulp-strip-debug');
var template = require('gulp-template');
var uglify = require('gulp-uglify');
var gutil = require('gulp-util');
var replace = require('gulp-replace');
var uncss = require('gulp-uncss');

var buildConfig = require('./config/build.config');
var karmaConf = require('./config/karma.conf.js');

var IS_RELEASE_BUILD = !!argv.release;
if (IS_RELEASE_BUILD) {
  console.log(
    gutil.colors.red('--release:'),
    'Building release version (minified, debugs stripped)...'
  );
}

gulp.task('default', ['build']);
gulp.task('build', ['scripts', 'sass']);
gulp.task('validate', ['jshint', 'karma']);

gulp.task('watch', ['build'], function() {
  gulp.watch(['src/**/*.{scss,js,html}'], ['build']);
});


/**
 * Docs
 */
gulp.task('docs', ['docs-scripts', 'docs-css', 'docs-html', 'docs-app'], function() {
});

gulp.task('docs-scripts', ['demo-scripts'], function() {
  return gulp.src(buildConfig.docsAssets.js)
    .pipe(concat('docs.js'))
    .pipe(gulpif(IS_RELEASE_BUILD, uglify())
    .pipe(gulp.dest(buildConfig.docsDist)));
});

// demo-scripts: runs after scripts and docs-generate so both the docs-generated js
// files and the source-generated material files are done
gulp.task('demo-scripts', ['scripts', 'docs-generate'], function() {
  return gulp.src(buildConfig.demoAssets.js)
    .pipe(concat('demo.js'))
    .pipe(gulpif(IS_RELEASE_BUILD, uglify()))
    .pipe(gulp.dest(buildConfig.docsDist));
});

gulp.task('docs-css', ['demo-css'], function() {
  return gulp.src(buildConfig.docsAssets.css)
    .pipe(concat('docs.css'))
    .pipe(gulpif(IS_RELEASE_BUILD, minifyCss()))
    .pipe(gulp.dest(buildConfig.docsDist));
});

gulp.task('demo-css', ['sass'], function() {
  return gulp.src(buildConfig.demoAssets.css)
    .pipe(concat('demo.css'))
    .pipe(gulpif(IS_RELEASE_BUILD, minifyCss()))
    .pipe(gulp.dest(buildConfig.docsDist));
});

gulp.task('docs-html', function() {
  return gulp.src('docs/app/**/*.html', { base: 'docs/app' })
    .pipe(gulpif(IS_RELEASE_BUILD,
        replace(/material-design\.(js|css)/g, 'material-design.min.$1')))
    .pipe(gulp.dest(buildConfig.docsDist));
});

gulp.task('docs-generate', function() {
  return dgeni.generator(__dirname + '/docs/index.js')();
});

gulp.task('docs-app', function() {
  return gulp.src(['docs/app/**/*', '!docs/app/**/*.html'], { base: 'docs/app' })
    .pipe(gulp.dest(buildConfig.docsDist));
});

/**
 * JSHint
 */
gulp.task('jshint', function() {
  return gulp.src(
      buildConfig.paths.js.concat(buildConfig.paths.test)
    )
    .pipe(jshint('.jshintrc'))
    .pipe(jshint.reporter(require('jshint-summary')({
      fileColCol: ',bold',
      positionCol: ',bold',
      codeCol: 'green,bold',
      reasonCol: 'cyan'
    })))
    .pipe(jshint.reporter('fail'));
});

/**
 * Karma Tests
 */
argv.browsers && (karmaConf.browsers = argv.browsers.trim().split(','));
gulp.task('karma', function(done) {
  karma.start(_.assign({}, karmaConf, {singleRun: true}), done);
});

gulp.task('karma-watch', function(done) {
  karma.start(_.assign({}, karmaConf, {singleRun: false}), done);
});

/**
 * Build material-design.js
 */
//TODO build components individually
//Factor scripts and scss out into a task that works on either
//an individual component or the whole bundle
gulp.task('scripts', function() {
  return gulp.src(buildConfig.paths.js)
    .pipe(concat('material-design.js'))
    .pipe(header(_.template(buildConfig.componentsModule, {
      components: buildConfig.components.map(enquote)
    })))
    .pipe(header(buildConfig.closureStart))
    .pipe(footer(buildConfig.closureEnd))
    .pipe(header(buildConfig.banner))
    .pipe(gulp.dest(buildConfig.dist))
    .pipe(gulpif(IS_RELEASE_BUILD, uglify({
      preserveComments: 'some' //preverse banner
    })))
    .pipe(rename({ extname: '.min.js' }))
    .pipe(gulp.dest(buildConfig.dist));
});

gulp.task('components', function() {
  var exclude = ['animate'];
  var entries = fs.readdirSync('src/components');
  var components = _.xor(exclude, entries);
  components.forEach(function(component) {
    sass(component,
      ['src/main.scss', 'src/components/' + component + '/*.scss'],
      buildConfig.dist + '/components/' + component + '/');
  })
});

var sass = function(component, sources, destination) {
  return gulp.src(sources)
    .pipe(header(buildConfig.banner))
    .pipe(sass({
      // Normally, gulp-sass exits on error. This is good during normal builds.
      // During watch builds, we only want to log the error.
      errLogToConsole: argv._.indexOf('watch') > -1
    }))
    .pipe(concat(component + '.css'))
    .pipe(gulp.dest(destination))
    .pipe(gulpif(IS_RELEASE_BUILD, minifyCss()))
    .pipe(rename({ extname: '.min.css' }))
    .pipe(gulp.dest(destination));
};

/**
 * Build material-design.css
 */
gulp.task('sass', function() {
  return sass('material-design', buildConfig.paths.scss, buildConfig.dist);
});

function enquote(str) {
  return '"' + str + '"';
}
