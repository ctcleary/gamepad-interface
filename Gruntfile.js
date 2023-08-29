module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    connect: {
      server: {
        options: {
          port: 8000
        }
      }
    },
    watch: {
      gruntfile: {
        files: ['Gruntfile.js'],
        options: {
          livereload: true
        },
      },
      all: {
        files: [
          '/*.html',
          'css/**/*.css',

          'src/**/*.js',
          'js/*.js',
          '**/*.html',

          'public/**/*.jpg',
          'public/**/*.png',
          'img/**/*.jpg',
          'img/**/*.png'
        ],
        options: {
          livereload: true
        },
      },
    },
    copy: {
      'build': {
        files: [
          // {expand: true, src: ['js/**/*.js'], dest: 'static-build/'},
          // {expand: true, src: ['css/**/*.css*'], dest: 'static-build/'},
          // {expand: true, src: ['config/**/*.js'], dest: 'static-build/'},
          // {expand: true, src: ['dist/**/*.js'], dest: 'static-build/'},
          // {expand: true, src: ['fonts/**/*.*'], dest: 'static-build/'},
          // {expand: true, src: ['index.html'], dest: 'static-build/'},
        ]
      }
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
      },
      build: {
        src: 'src/<%= pkg.name %>.js',
        dest: 'build/<%= pkg.name %>.min.js'
      }
    }
  });

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-connect');
  // grunt.loadNpmTasks('grunt-contrib-sass');
  // grunt.loadNpmTasks('grunt-autoprefixer');
  grunt.loadNpmTasks('grunt-contrib-watch');
  // grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');
  // grunt.loadNpmTasks('grunt-contrib-cssmin');
  // grunt.loadNpmTasks('grunt-contrib-uglify');
  // grunt.loadNpmTasks('grunt-preprocess');
  // grunt.loadNpmTasks('grunt-riot');

  // Default task(s).
  grunt.registerTask('default', [
    'connect',
    'watch'
  ]);

};