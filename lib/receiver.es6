export default class Receiver {

  constructor(fn) {
    this._fn = fn;
    this._result = {};
  }

  end() {
    this._fn(this._result);
  }

  error(err) {
    this._fn(this._result, {err});
    this.end();
  }

  timeout() {
    this._fn(this._result, {code: 'ECONNTIMEOUT'});
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