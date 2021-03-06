'use strict';

var async = require('async');
var	assert = require('assert');
var nconf = require('nconf');
var path = require('path');

var db = require('./mocks/databasemock');
var categories = require('../src/categories');
var topics = require('../src/topics');
var user = require('../src/user');
var groups = require('../src/groups');
var privileges = require('../src/privileges');
var meta = require('../src/meta');
var helpers = require('./helpers');


describe('Upload Controllers', function () {
	var tid;
	var cid;
	var pid;
	var adminUid;
	var regularUid;

	before(function (done) {
		async.series({
			category: function (next) {
				categories.create({
					name: 'Test Category',
					description: 'Test category created by testing script',
				}, next);
			},
			adminUid: function (next) {
				user.create({ username: 'admin', password: 'barbar' }, next);
			},
			regularUid: function (next) {
				user.create({ username: 'regular', password: 'zugzug' }, next);
			},
		}, function (err, results) {
			if (err) {
				return done(err);
			}
			adminUid = results.adminUid;
			regularUid = results.regularUid;
			cid = results.category.cid;

			topics.post({ uid: adminUid, title: 'test topic title', content: 'test topic content', cid: results.category.cid }, function (err, result) {
				tid = result.topicData.tid;
				pid = result.postData.pid;
				done(err);
			});
		});
	});

	describe('regular user uploads', function () {
		var jar;
		var csrf_token;

		before(function (done) {
			helpers.loginUser('regular', 'zugzug', function (err, _jar, io, _csrf_token) {
				assert.ifError(err);
				jar = _jar;
				csrf_token = _csrf_token;
				privileges.categories.give(['upload:post:file'], cid, 'registered-users', done);
			});
		});

		it('should upload a profile picture', function (done) {
			helpers.uploadFile(nconf.get('url') + '/api/user/regular/uploadpicture', path.join(__dirname, '../test/files/test.png'), {}, jar, csrf_token, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(Array.isArray(body));
				assert.equal(body.length, 1);
				assert.equal(body[0].url, nconf.get('relative_path') + '/assets/uploads/profile/' + regularUid + '-profileavatar.png');
				done();
			});
		});

		it('should upload an image to a post', function (done) {
			helpers.uploadFile(nconf.get('url') + '/api/post/upload', path.join(__dirname, '../test/files/test.png'), { cid: cid }, jar, csrf_token, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(Array.isArray(body));
				assert(body[0].path);
				assert(body[0].url);
				done();
			});
		});

		it('should resize and upload an image to a post', function (done) {
			var oldValue = meta.config.maximumImageWidth;
			meta.config.maximumImageWidth = 10;
			helpers.uploadFile(nconf.get('url') + '/api/post/upload', path.join(__dirname, '../test/files/test.png'), { cid: cid }, jar, csrf_token, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(Array.isArray(body));
				assert(body[0].path);
				assert(body[0].url);
				meta.config.maximumImageWidth = oldValue;
				done();
			});
		});


		it('should upload a file to a post', function (done) {
			meta.config.allowFileUploads = 1;
			helpers.uploadFile(nconf.get('url') + '/api/post/upload', path.join(__dirname, '../test/files/503.html'), { cid: cid }, jar, csrf_token, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(Array.isArray(body));
				assert(body[0].path);
				assert(body[0].url);
				done();
			});
		});

		it('should fail if topic thumbs are disabled', function (done) {
			helpers.uploadFile(nconf.get('url') + '/api/topic/thumb/upload', path.join(__dirname, '../test/files/test.png'), {}, jar, csrf_token, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 500);
				assert.equal(body.error, '[[error:topic-thumbnails-are-disabled]]');
				done();
			});
		});

		it('should fail if file is not image', function (done) {
			meta.config.allowTopicsThumbnail = 1;
			helpers.uploadFile(nconf.get('url') + '/api/topic/thumb/upload', path.join(__dirname, '../test/files/503.html'), {}, jar, csrf_token, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 500);
				assert.equal(body.error, '[[error:invalid-file]]');
				done();
			});
		});

		it('should upload topic thumb', function (done) {
			meta.config.allowTopicsThumbnail = 1;
			helpers.uploadFile(nconf.get('url') + '/api/topic/thumb/upload', path.join(__dirname, '../test/files/test.png'), {}, jar, csrf_token, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(Array.isArray(body));
				assert(body[0].path);
				assert(body[0].url);
				done();
			});
		});
	});


	describe('admin uploads', function () {
		var jar;
		var csrf_token;

		before(function (done) {
			helpers.loginUser('admin', 'barbar', function (err, _jar, io, _csrf_token) {
				assert.ifError(err);
				jar = _jar;
				csrf_token = _csrf_token;
				groups.join('administrators', adminUid, done);
			});
		});

		it('should upload site logo', function (done) {
			helpers.uploadFile(nconf.get('url') + '/api/admin/uploadlogo', path.join(__dirname, '../test/files/test.png'), {}, jar, csrf_token, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(Array.isArray(body));
				assert.equal(body[0].url, nconf.get('relative_path') + '/assets/uploads/system/site-logo.png');
				done();
			});
		});

		it('should upload category image', function (done) {
			helpers.uploadFile(nconf.get('url') + '/api/admin/category/uploadpicture', path.join(__dirname, '../test/files/test.png'), { params: JSON.stringify({ cid: cid }) }, jar, csrf_token, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(Array.isArray(body));
				assert.equal(body[0].url, nconf.get('relative_path') + '/assets/uploads/category/category-1.png');
				done();
			});
		});

		it('should upload favicon', function (done) {
			helpers.uploadFile(nconf.get('url') + '/api/admin/uploadfavicon', path.join(__dirname, '../test/files/favicon.ico'), {}, jar, csrf_token, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(Array.isArray(body));
				assert.equal(body[0].url, '/assets/uploads/system/favicon.ico');
				done();
			});
		});

		it('should upload touch icon', function (done) {
			helpers.uploadFile(nconf.get('url') + '/api/admin/uploadTouchIcon', path.join(__dirname, '../test/files/test.png'), {}, jar, csrf_token, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(Array.isArray(body));
				assert.equal(body[0].url, '/assets/uploads/system/touchicon-orig.png');
				done();
			});
		});
	});


	after(function (done) {
		db.emptydb(done);
	});
});
