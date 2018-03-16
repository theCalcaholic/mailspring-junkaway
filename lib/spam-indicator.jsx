import {
  React,
  FocusedContactsStore,
  FocusedContentStore,
  DatabaseStore,
  Message,
  MessageBodyProcessor
} from 'mailspring-exports';
import Spamd from './spamd';

export default class SpamIndicator extends React.Component {
  static displayName = 'SpamIndicator';

  // This sidebar component listens to the FocusedContactStore,
  // which gives us access to the Contact object of the currently
  // selected person in the conversation. If you wanted to take
  // the contact and fetch your own data, you'd want to create
  // your own store, so the flow of data would be:

  // FocusedContactStore => Your Store => Your Component
  constructor(props) {
    super(props);
    //console.log(props);
    //this.state = this._getStateFromStores();
  }

  setupSpamd() {
    //console.log(this.props);
    if(this.props.thread && this.props.thread.__messages.length > 0) {
      let spamd = new Spamd('localhost', 783);
      this.props.thread.__messages.forEach((msg) => {
        //console.log(msg ? msg : "message was undefined");
        if (msg.from.length > 0 && !msg.from[0].isMe()) {
          console.log("evaluate message from " + msg.from[0].email);
          let to = msg.to.length > 0 ? msg.to[0].email : '';
          let evaluateMsg = (message) => {
            console.log(message);
            spamd.evaluate(message.from[0].email, to, message.subject, message.body, this._spamdCallback.bind(this));
          };
          if(msg.hasEmptyBody()) {
            DatabaseStore.find(Message, msg.id).include(Message.attributes.body)
                .then(evaluateMsg);
          } else {
            evaluateMsg(msg);
          }

        } else if (msg.from.length === 0) {
          console.log("message has no sender");
        }
      });
    }
  }

  componentDidMount() {
    this.setupSpamd();
    this.setState({
      isJunk: false,
      rating: undefined
    });
  }

  componentWillUnmount() {
  }

  _onChange = () => {
  };

  _spamdCallback = (res, err) => {
    if (err) {
      console.log("An error occured!")
      console.log(err);
    } else {
      console.log("response:");
      console.log(res);
      this.setState({
        isJunk: this.state.isJunk || res.spam,
        rating: this.state.rating !== undefined
            ? Math.max(0, this.state.rating, Number(res.evaluation)) : res.evaluation
      });
      console.log(Number(Math.max(this.state.rating, res.evaluation)));
    }
  };

  render() {
    //console.log(this.state.thread);
    //const content = this.state.contact || this.state.thread ? this._renderContent() : this._renderPlaceholder();
    //console.log(this.state)
    return (
        <div style={{color:
          this.state && typeof this.state.rating !== 'undefined' ?
                  "#"
                  + ("00" + (this.state.rating * 255 / 3).toString(16)).slice(-2)
                  + ("00" + (255 - (this.state.rating * 255 / 3)).toString(16)).slice(-2)
                  + "00"
                : "#444" }}>
          {this.state && this.state.isJunk ? "[SPAM]" : "[NO SPAM]"}
        </div>
    );
  }
}


// Providing container styles tells the app how to constrain
// the column your component is being rendered in. The min and
// max size of the column are chosen automatically based on
// these values.
SpamIndicator.containerStyles = {
//  order: 1,
//  flexShrink: 0,
};
