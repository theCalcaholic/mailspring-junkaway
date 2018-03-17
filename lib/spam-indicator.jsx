import {
  React,
  FocusedContactsStore,
  FocusedContentStore,
  DatabaseStore,
  Message,
  MessageBodyProcessor
} from 'mailspring-exports';
import Spamd from './spamd';
import SpamInfoStore from './spam-info-store';

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
      this.props.thread.__messages.forEach((msg) => {
        //console.log(msg ? msg : "message was undefined");

        SpamInfoStore.getSpamInfo(msg)
            .then(spamInfo => this._addSpamInfo(spamInfo))
            .catch(err => { console.log(err) });
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

  _addSpamInfo = (spamInfo) => {
      this.setState({
        isJunk: this.state.isJunk || spamInfo.isJunk,
        rating: this.state.rating !== undefined
            ? Math.max(0, this.state.rating, Number(spamInfo.rating)) : spamInfo.rating
      });
      return Promise.resolve();
  };

  render() {
    //console.log(this.state.thread);
    //const content = this.state.contact || this.state.thread ? this._renderContent() : this._renderPlaceholder();
    //console.log(this.state)
    return (
        <div style={{
          color:
              this.state && typeof this.state.rating !== 'undefined' ?
                  "hsl(" + (120 - Math.min(this.state.rating * 120 / 5, 120)).toString() + ", 100%, 50%)"
                : "#AAA",
          backgroundColor: "#101010",
          borderRadius: "5%",
          padding: "2px",
          fontSize: "0.7em",
          minWidth: "6em",
          textAlign: "center",
          minHeight: "2em",
          lineHeight: "2em"
        }}>
          {this.state && this.state.rating !== undefined ? this.state.rating > 3 ? "[SPAM]" : "[NO SPAM]" : "..."}
        </div>
    );
  }
}


// Providing container styles tells the app how to constrain
// the column your component is being rendered in. The min and
// max size of the column are chosen automatically based on
// these values.
//SpamIndicator.containerStyles = {
//  order: 1,
//  flexShrink: 0,
//};
