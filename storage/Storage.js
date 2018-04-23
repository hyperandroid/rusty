"use strict";
// Store is an insecure and minimalistic data store supplied just for functionality purposes.
// Do yourself a favor, and don't deply this with your bot o production.
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var StorageImpl = /** @class */ (function () {
    function StorageImpl(path) {
        this.usersMap = {};
        this.teamsMap = {};
        this.path_ = path;
        this.load();
    }
    StorageImpl.prototype.getTeam = function (id) {
        var ret = this.teamsMap[id];
        if (typeof ret === 'undefined') {
            return null;
        }
        return ret;
    };
    StorageImpl.prototype.getUser = function (id) {
        var ret = this.usersMap[id];
        if (typeof ret === 'undefined') {
            return null;
        }
        return ret;
    };
    StorageImpl.prototype.load = function () {
        try {
            var um = JSON.parse(fs.readFileSync(this.path_ + "/users.json").toString());
            this.usersMap = um;
        }
        catch (e) {
            console.info("Can't read users file.");
        }
        try {
            var tm = JSON.parse(fs.readFileSync(this.path_ + "/teams.json").toString());
            this.teamsMap = tm;
        }
        catch (e) {
            console.info("Can't read teams file.");
        }
    };
    StorageImpl.prototype.saveUsers = function () {
        fs.writeFileSync(this.path_ + "/users.json", JSON.stringify(this.usersMap, null, 2));
    };
    StorageImpl.prototype.saveTeams = function () {
        fs.writeFileSync(this.path_ + "/teams.json", JSON.stringify(this.teamsMap, null, 2));
    };
    StorageImpl.prototype.addUser = function (user) {
        this.usersMap[user.id] = user;
        this.saveUsers();
    };
    StorageImpl.prototype.addTeam = function (team) {
        this.teamsMap[team.id] = team;
        this.saveTeams();
    };
    return StorageImpl;
}());
exports.default = StorageImpl;
//# sourceMappingURL=Storage.js.map