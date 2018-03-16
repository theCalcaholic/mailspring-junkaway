export default class Receiver {

  constructor(resolve, reject) {
    this.resolve = resolve;
    this.reject = reject;
    this._result = {};
  }

  end() {
    this.resolve(this._result);
  }

  error(err) {
    this.reject(err, this._result);
    this.end();
  }

  timeout() {
    this.reject(Error('ECONNTIMEOUT'), this._result);
    this.end();
  }

  data(line) {
    line = line.toString().split('\r\n');
    for ( let l in line ){

      let matches;
      if (matches = line[l].match(/Spam: (True|False) ; (-?\d+\.\d) \/ (-?\d+\.\d)/)) {

        this._result.spam = matches[1] === 'True';
        this._result.evaluation = matches[2];
        this._result.allowed = matches[3];

      }else if(line[l].indexOf(',') >= 0){

        this._result.rules = line[l].split(',');
      }
    }

  }
}