import MailspringStore from 'mailspring-store';
import {
  MessageStore,
  DatabaseStore,
  Message
} from 'mailspring-exports';
import sqlite3 from 'sqlite3';
import Spamd from './spamd';
import path from 'path';

const dbPath = path.resolve(__dirname, '../db/main.db');

class SpamInfoStore extends MailspringStore {
  static trustedInfo = {
    isJunk: false,
    rating: 0.0,
    rules: [],
    manual: false
  };

  constructor() {
    super();
    this.messages = [];
    this.spamd = new Spamd('localhost', 783);
    this.queuedRequests = [];
    this.db = null;
    this.dbReady = false;
    this.dbSynced = true;
    this._setStoreDefaults();
    this._registerListeners();
    this._loadDB();
    this.saveIntervall = undefined;
    //this.listenables = Actions;
  }

  getSpamInfo(msg) {
    if(msg.id in this.messages) {
      console.log("found spamInfo in cache");
      return Promise.resolve(this.messages[msg.id]);
    }

    return this._getSpamInfoFromDB(msg)
        .then(result => result, err => {
          return SpamInfoStore._populateBody(msg)
              .then(msg => this._evaluateMessage(msg))
              .catch(err => { console.log(err) });
    });
  }

  _getSpamInfoFromDB(msg) {
    return new Promise((resolve, reject) => {
      let run = () => {
        this.db.get("select * from SpamInfo WHERE Id=?", [msg.id], (err, row) => {
          if(err) {
            console.log(err);
            reject(err);
            return;
          }
          if(row === undefined || row.length === 0) {
            reject(undefined);
            return;
          }
          console.log(row);
          this.messages[row.Id] = {
            rating: row.Rating,
            rules: row.Rules.split(","),
            isJunk: !!row.IsJunk,
            manual: !!row.Manual
          };
          resolve(this.messages[row.Id]);
        });
      };

      if( this.dbReady )
        run();
      else
        this.queuedRequests.push(run);

    });
  }

  _loadDB() {
    console.log(dbPath);
    this.db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, err => {
      if(err) {
        console.log(err);
        return;
      }
      this.db.run("CREATE table IF NOT EXISTS SpamInfo (" +
          "Id CHAR(60) NOT NULL PRIMARY KEY," +
          "Rating REAL," +
          "Rules TEXT," +
          "Manual INTEGER," +
          "IsJunk INTEGER);", undefined, err => {
        if(err) {
          console.log(err);
          return;
        }
        this.dbReady = true;
        this.saveIntervall = setInterval(this._commitToDB.bind(this), 10000);
        this._processQueued();
      });
    });
  }

  _commitToDB() {
    if(!this.dbReady || this.dbSynced) {
      return Promise.resolve();
    }

    this.dbReady = false;

    console.log("write to db...");
    let query = `INSERT OR REPLACE INTO SpamInfo 
                (Id, IsJunk, Rating, Rules, Manual) 
                VALUES`;
    Object.keys(this.messages).forEach(msgId => {
      let spamInfo = this.messages[msgId];
      query += ` (
          '${msgId}', 
          '${spamInfo.isJunk ? 1 : 0}', 
          '${spamInfo.rating}', 
          '${spamInfo.rules ? spamInfo.rules.join(",") : ""}', 
          '${spamInfo.manual ? 1 : 0}'),`;
    });
    query = query.substring(0, query.length - 1)
    console.log(query);
    return new Promise((resolve, reject) => {
      this.db.run(query, err => {
        if(err) {
          console.log(err);
          reject();
        } else {
          resolve();
        }
        if(Object.keys(this.messages).length > 500)
          this.messages.slice(499);
        this.dbReady = true;
        this._processQueued();
        this.dbSynced = true;
      });
    });
  }

  _processQueued() {
    this.queuedRequests.forEach(request => {
      request();
    });
  }

  _setStoreDefaults() {
    this.items = [];

  }

  _registerListeners() {
    //this.listenTo(MessageStore, this._onDataChanged);
    this._unsubscribe = DatabaseStore.listen(this._onDataChanged);
  }

  _onDataChanged = (change) => {
    if( change.objectClass !== "Message")
      return;
    console.log(change);
    change.objects.forEach((msg) => {
      if(! msg.id in this.messages) {
        SpamInfoStore._populateBody(msg)
            .then(this._evaluateMessage, (err) => { console.log(err) });
      }
    });
  };

  _evaluateMessage = (msg) => {
    if(msg.from.length <= 0 || msg.from[0].isMe()) {
      console.log("no sender or is me.")
      this.messages[msg.id] = Object.assign({},SpamInfoStore.trustedInfo);
    }
    if(msg.id in this.messages) {
      console.log("message already known.")
      return Promise.resolve(this.messages[msg.id]);
    }

    console.log("retrieve spam info for msg:");
    console.log(msg);
    let to = msg.to.length > 0 ? msg.to.email : '';
    return new Promise((resolve) => {
      this.spamd.evaluate(msg.from[0].email, to, msg.subject, msg.body)
          .then(spamInfo => {
            console.log("spaminfo:");
            console.log(spamInfo);
            this.messages[msg.id] = {
              isJunk: spamInfo.spam,
              rating: spamInfo.evaluation,
              rules: spamInfo.rules,
              manual: false
            };
            console.log("message count: " + Object.keys(this.messages).length);
            this.dbSynced = false;
            //if(Object.keys(this.messages).length > 50)
            //  this._commitToDB();
            resolve(this.messages[msg.id]);
          })
          .catch(err => { console.log(err)});
    });
  };

  static _populateBody(msg) {
    if(!msg.hasEmptyBody()) {
      console.log("body was not empty...");
      return Promise.resolve(msg);
    }

    return new Promise((resolve, reject) => {
      DatabaseStore.find(Message, msg.id).include(Message.attributes.body)
          .then((msg) => {
            console.log("message populated");
            resolve(msg);
          });
    });
  }
}

const store = new SpamInfoStore();
export default store;