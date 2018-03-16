import MailspringStore from 'mailspring-store';
import {
  MessageStore,
  DatabaseStore,
  Message
} from 'mailspring-exports';
import Spamd from './spamd';
import {log_error} from './util';

class SpamInfoStore extends MailspringStore {
  static trustedInfo = {
    isJunk: false,
    rating: 0.0
  };

  constructor() {
    super();
    this.messages = [];
    this.spamd = new Spamd('localhost', 783);
    this._setStoreDefaults();
    this._registerListeners();
    //this.listenables = Actions;
  }

  getSpamInfo(msg) {
    if(msg.id in this.messages) {
      console.log("found spamInfo in cache")
      return Promise.resolve(this.messages[msg.id]);
    }
    return SpamInfoStore._populateBody(msg)
        .then(msg => this._evaluateMessage(msg))
        .catch(err => { console.log(err) });
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
              rating: spamInfo.evaluation
            };
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