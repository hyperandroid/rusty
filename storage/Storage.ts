// Store is an insecure and minimalistic data store supplied just for functionality purposes.
// Do yourself a favor, and don't deply this with your bot o production.

import {User} from "./User";
import {Team} from "./Team";

import fs = require("fs");

type TeamsMap = {[key:string]:Team};
type UserMap = {[key:string]:User};

export interface Storage {
    getTeam( id: string ) : Team;
    getUser( id: string ) : User;
}

export default class StorageImpl implements Storage {

    usersMap : UserMap = {};
    teamsMap : TeamsMap = {};

    private path_ : string;

    constructor(path:string) {
        this.path_ = path;
        this.load();
    }

    getTeam(id: string): Team {
        const ret=this.teamsMap[id];
        if (typeof ret==='undefined') {
            return null;
        }

        return ret;
    }

    getUser(id: string): User {
        const ret = this.usersMap[id];
        if (typeof ret==='undefined') {
            return null;
        }

        return ret;
    }

    load() {

        try {
            const um = JSON.parse(fs.readFileSync(this.path_ + "/users.json").toString());
            this.usersMap = um as UserMap;
        } catch (e) {
            console.info("Can't read users file.");
        }

        try {
            const tm = JSON.parse(fs.readFileSync(this.path_ + "/teams.json").toString());
            this.teamsMap = tm as TeamsMap;
        } catch (e) {
            console.info("Can't read teams file.");
        }
    }

    saveUsers() {
        fs.writeFileSync(this.path_ + "/users.json", JSON.stringify(this.usersMap, null, 2));
    }

    saveTeams() {
        fs.writeFileSync( this.path_+"/teams.json", JSON.stringify(this.teamsMap,null,2) );
    }

    addUser( user: User ) {
        this.usersMap[user.id] = user;
        this.saveUsers();
    }

    addTeam( team: Team ) {
        this.teamsMap[team.id] = team;
        this.saveTeams();
    }
}