'use strict';

var libpath = process.env['LIB_COV'] ? '../lib-cov' : '../lib';

var neoprene = require(libpath)
  , Schema = require(libpath + '/schema')
  , expect = require('expect.js')
  , request = require('superagent');

var testURL = 'http://localhost:7475';
neoprene.connect(testURL);

var userSchema = {
  first: {type: String},
  countSchedules: Number,
  countActivities: {type: Number, default: 0}
};

var userData = [{
    first: 'John',
    countSchedules: 1
  },{
    first: 'Jane',
    countSchedules: 5
  }
];
var user1 = {}
  , user2 = {}
  , schedule1 = {}
  , activity1 = {}
  , User
  , Schedule
  , Activity;

describe('create role', function(){
  before(function(done){
    var query = 'start n=node(*) match n-[r?]->() where id(n) <> 0 delete r,n';
    var params = {};

    //wipe models and add new ones
    neoprene.models = {};
    neoprene.modelSchemas = {};
    User = neoprene.model('User', new Schema(userSchema));
    Activity = neoprene.model('Activity', new Schema({activityName:String}, {strict: false}));
    Schedule = neoprene.model('Schedule', new Schema({scheduleName:String, activityCount: Number}));

    neoprene.query(query, params, function(err, results) {
      User.create(userData[0], function(err, user){
        expect(err).to.not.be.ok();
        user1 = user;
        expect(user.first).to.be.eql('John');
        User.create(userData[1], function(err, user){
          expect(err).to.not.be.ok();
          user2 = user;
          expect(user.first).to.be.eql('Jane');
          var options = {
            relationship: {
              nodeLabel: 'User',
              indexField: '_id',
              indexValue: user1._id,
              type: 'MEMBER',
              direction: 'to'
            },
            eventNodes: {
              user: true
            },
            counters: [{
              node: 'user',
              field: 'countSchedules'
            }],
            role :{
              roleOwner: 'user',
              name: 'Admin'
            }
          };
          Schedule.create({scheduleName: 'Schedule', activityCount: 0}, user1._id, options, function(err, schedule){
            schedule1 = schedule.node;
            expect(err).to.not.be.ok();
            expect(schedule).to.be.ok();
            var optionsA = {
              relationship: {
                nodeLabel: 'Schedule',
                indexField: '_id',
                indexValue: schedule1._id,
                type: 'CONTAINS',
                direction: 'to'
              },
              eventNodes: {
                relationshipNode: true,
                user: true
              },
              counters: [{
                node: 'relationshipNode',
                field: 'activityCount'
              }]
            };
            Activity.create({activityName: 'A1'}, user1._id, optionsA, function(err, activity){
              activity1 = activity.node;
              expect(err).to.not.be.ok();
              expect(activity).to.be.ok();
              done();
            });
          });
        });
      });
    });
  });
  describe("success", function(){
    it("should allow a role to be created: with eventNodes", function(done){
      var role = {
        name: 'Blue',
        user: user1._id,
        other: schedule1._id
      };
      // pass through to index._createRole
      Schedule.createRole(role, function(err, role){
        expect(err).to.not.be.ok();
        expect(role._doc.role).to.be.equal('Blue');
        schedule1.getIncomingRelationships('HAS_SCHEDULE', '_ScheduleRole', function(err, results){
          expect(results.nodes.length).to.be(2);
          expect(results.nodes[0]._doc.role).to.be.equal('Blue');
          schedule1.getOutgoingRelationships('LATEST_EVENT', '_ScheduleRoleCreated', function(err, results){
            expect(results.nodes.length).to.be(1);
            done();
          });
        });
      });
    });
    it("should allow a role to be created: without eventNodes", function(done){
      var role = {
        name: 'Yellow',
        user: user1._id,
        other: schedule1._id
      };
      var options = {
        eventNodes: false
      };
      // pass through to index._createRole
      Schedule.createRole(role, options, function(err, role){
        expect(err).to.not.be.ok();
        expect(role._doc.role).to.be.equal('Yellow');
        schedule1.getIncomingRelationships('HAS_SCHEDULE', '_ScheduleRole', function(err, results){
          expect(results.nodes.length).to.be(3);
          expect(results.nodes[2]._doc.role).to.be.equal('Yellow');
          schedule1.getIncomingRelationships('EVENT_SCHEDULE', function(err, results){
            expect(results.nodes.length).to.be(3);
            done();
          });
        });
      });
    });
  });
  describe("validations fail", function(){
    it("should fail with no role", function(done){
      Schedule.createRole(function(err, role){
        expect(err).to.be.ok();
        expect(role).to.not.be.ok();
        done();
      });
    });
    it("should fail with no role:user", function(done){
      var role = {
        name: 'Admin',
        other: schedule1._id
      };
      Schedule.createRole(role, function(err, role){
        expect(err).to.be.ok();
        expect(role).to.not.be.ok();
        done();
      });
    });
    it("should fail with no role:other", function(done){
      var role = {
        name: 'Admin',
        user: user1._id,
      };
      Schedule.createRole(role, function(err, role){
        expect(err).to.be.ok();
        expect(role).to.not.be.ok();
        done();
      });
    });
    it("should fail with no role:name", function(done){
      var role = {
        user: user1._id,
        other: schedule1._id
      };
      Schedule.createRole(role, function(err, role){
        expect(err).to.be.ok();
        expect(role).to.not.be.ok();
        done();
      });
    });
  });
});