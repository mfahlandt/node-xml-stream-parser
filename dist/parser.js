"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.EVENTS = undefined;

var _createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();

var _stream = require("stream");

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

function _possibleConstructorReturn(self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }
  return call && ((typeof call === "undefined" ? "undefined" : _typeof(call)) === "object" || typeof call === "function") ? call : self;
}

function _inherits(subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + (typeof superClass === "undefined" ? "undefined" : _typeof(superClass)));
  }
  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
}

/**
 * A fast XML parser for NodeJS using Writable streams.
 *
 * What this is:
 * Simple and fast XML parser purley written for NodeJS. No extra production dependencies.
 * A handy way parse ATOM/RSS/RDF feeds and such. No validation is made on the document that is parsed.
 *
 * Motivation
 * There is already quite a few parsers out there. I just wanted a parser that was as tiny and fast as possible to handle easy parsing of
 * RSS/ATOM/RDF feeds using streams, no fancy stuff needed. If you want more functionality you should check out other recommended parsers (see below)
 *
 * Usage
 * Just #pipe() a <stream.Readable> and you are ready to listen for events.
 * You can also use the #write() method to write directly to the parser.
 *
 * The source is written using ES2015, babel is used to translate to the dist.
 *
 * Other recommended parsers for node that are great:
 * https://github.com/isaacs/sax-js
 * https://github.com/xmppjs/ltx
 *
 * Events:
 * - text
 * - instruction
 * - opentag
 * - closetag
 * - cdata
 *
 * Comments are ignored, so there is no events for them.
 *
 */
var Parser = function (_Writable) {
  _inherits(Parser, _Writable);

  function Parser() {
    _classCallCheck(this, Parser);

    var _this = _possibleConstructorReturn(this, (Parser.__proto__ || Object.getPrototypeOf(Parser)).call(this));

    _this.state = STATE.TEXT;
    _this.buffer = "";
    _this.pos = 0;
    _this.prev = ""; // last character written
    _this.prev2 = ""; // second to last character written
    _this.tagType = TAG_TYPE.NONE;
    return _this;
  }

  _createClass(Parser, [{
    key: "_write",
    value: function _write(chunk, encoding, done) {
      chunk = typeof chunk !== "string" ? chunk.toString() : chunk;
      for (var i = 0; i < chunk.length; i++) {
        var c = chunk[i];
        // Track previous characters separately instead of indexing into
        // this.buffer: indexing a string built by `+=` forces V8 to flatten
        // it on every iteration, which results in quadratic runtime.
        var prev = this.prev;
        var prev2 = this.prev2;
        this.buffer += c;
        this.pos++;
        this.prev2 = prev;
        this.prev = c;

        if (this.pos > MAX_BUFFER_LENGTH) {
          this.buffer = "";
          this.pos = 0;
          this.prev = "";
          this.prev2 = "";
          this.state = STATE.TEXT;
          this.tagType = TAG_TYPE.NONE;
          return done(new Error("Max buffer length of " + MAX_BUFFER_LENGTH + " exceeded"));
        }

        switch (this.state) {
          case STATE.TEXT:
            if (c === "<") this._onStartNewTag();
            break;

          case STATE.TAG_NAME:
            if (prev === "<" && c === "?") {
              this._onStartInstruction();
            }
            if (prev === "<" && c === "/") {
              this._onCloseTagStart();
            }
            if (prev2 === "<" && prev === "!" && c === "[") {
              this._onCDATAStart();
            }
            if (prev2 === "<" && prev === "!" && c === "-") {
              this._onCommentStart();
            }
            if (c === ">") {
              if (prev === "/") {
                this.tagType = TAG_TYPE.SELF_CLOSING;
              }
              this._onTagCompleted();
            }
            break;

          case STATE.INSTRUCTION:
            if (prev === "?" && c === ">") this._onEndInstruction();
            break;

          case STATE.CDATA:
            if (prev2 === "]" && prev === "]" && c === ">") this._onCDATAEnd();
            break;

          case STATE.IGNORE_COMMENT:
            if (prev2 === "-" && prev === "-" && c === ">") this._onCommentEnd();
            break;
        }
      }
      done();
    }
  }, {
    key: "_endRecording",
    value: function _endRecording() {
      var rec = this.buffer.slice(1, this.pos - 1);
      this.buffer = this.buffer.slice(-1); // Keep last item in buffer for prev comparison in main loop.
      this.pos = 1; // Reset the position (since the buffer was reset)
      return rec;
    }
  }, {
    key: "_onStartNewTag",
    value: function _onStartNewTag() {
      var text = this._endRecording().trim();
      if (text) {
        this.emit(EVENTS.TEXT, text);
      }
      this.state = STATE.TAG_NAME;
      this.tagType = TAG_TYPE.OPENING;
    }
  }, {
    key: "_onTagCompleted",
    value: function _onTagCompleted() {
      var tag = this._endRecording();

      var _parseTagString2 = this._parseTagString(tag),
          name = _parseTagString2.name,
          attributes = _parseTagString2.attributes;

      if (name === null) {
        this.emit(EVENTS.ERROR, new Error("Failed to parse name for tag" + tag));
      }

      if (this.tagType && this.tagType == TAG_TYPE.OPENING) {
        this.emit(EVENTS.OPEN_TAG, name, attributes);
      }

      if (this.tagType && this.tagType === TAG_TYPE.CLOSING) {
        this.emit(EVENTS.CLOSE_TAG, name, attributes);
      }
      if (this.tagType && this.tagType === TAG_TYPE.SELF_CLOSING) {
        if (Object.keys(attributes).length === 0 && attributes.constructor === Object) {
          attributes = { ___selfClosing___: true };
        }
        this.emit(EVENTS.OPEN_TAG, name, attributes);
        this.emit(EVENTS.CLOSE_TAG, name, attributes);
      }

      this.state = STATE.TEXT;
      this.tagType = TAG_TYPE.NONE;
    }
  }, {
    key: "_onCloseTagStart",
    value: function _onCloseTagStart() {
      this._endRecording();
      this.tagType = TAG_TYPE.CLOSING;
    }
  }, {
    key: "_onStartInstruction",
    value: function _onStartInstruction() {
      this._endRecording();
      this.state = STATE.INSTRUCTION;
    }
  }, {
    key: "_onEndInstruction",
    value: function _onEndInstruction() {
      this.pos -= 1; // Move position back 1 step since instruction ends with '?>'
      var inst = this._endRecording();

      var _parseTagString3 = this._parseTagString(inst),
          name = _parseTagString3.name,
          attributes = _parseTagString3.attributes;

      if (name === null) {
        this.emit(EVENTS.ERROR, new Error("Failed to parse name for inst" + inst));
      }
      this.emit(EVENTS.INSTRUCTION, name, attributes);
      this.state = STATE.TEXT;
    }
  }, {
    key: "_onCDATAStart",
    value: function _onCDATAStart() {
      this._endRecording();
      this.state = STATE.CDATA;
    }
  }, {
    key: "_onCDATAEnd",
    value: function _onCDATAEnd() {
      var text = this._endRecording(); // Will return CDATA[XXX] we regexp out the actual text in the CDATA.
      text = text.slice(text.indexOf("[") + 1, text.lastIndexOf("]>") - 1);
      this.state = STATE.TEXT;

      this.emit(EVENTS.CDATA, text);
    }
  }, {
    key: "_onCommentStart",
    value: function _onCommentStart() {
      this.state = STATE.IGNORE_COMMENT;
    }
  }, {
    key: "_onCommentEnd",
    value: function _onCommentEnd() {
      this._endRecording();
      this.state = STATE.TEXT;
    }

    /**
     * Helper to parse a tag string 'xml version="2.0" encoding="utf-8"' with regexp.
     * @param  {string} str the tag string.
     * @return {object}     {name, attributes}
     */
  }, {
    key: "_parseTagString",
    value: function _parseTagString(str) {
      // parse name

      var name = void 0;
      var parsedString = /^([a-zäöüßÄÖÜA-Z0-9:_\-.\/]+?)(\s|$)/.exec(str);
      if (parsedString && parsedString.length > 0) {
        name = parsedString[1];
        var attributesString = str.substr(name.length);
        // Attributes must be preceded by whitespace and are matched greedily.
        // This prevents super-linear backtracking (ReDoS) on unterminated
        // attribute values, see GHSA-5j83-mpvp-f3gm.
        var attributeRegexp = /\s([a-zäöüßÄÖÜA-Z0-9:_\-.]+)="([^"]*)"/g;
        var match = attributeRegexp.exec(attributesString);
        var attributes = {};
        while (match != null) {
          attributes[match[1]] = match[2];
          match = attributeRegexp.exec(attributesString);
        }
        if (name[name.length - 1] === "/") {
          name = name.substr(0, name.length - 1);
        }
        return { name: name, attributes: attributes };
      }
      return { name: null, attributes: {} };
    }
  }]);

  return Parser;
}(_stream.Writable);

exports.default = Parser;

// Maximum number of characters buffered for a single text node, tag,
// instruction, CDATA section or comment.
var MAX_BUFFER_LENGTH = 1024 * 1024;

var STATE = {
  TEXT: 0,
  TAG_NAME: 1,
  INSTRUCTION: 2,
  IGNORE_COMMENT: 4,
  CDATA: 8
};

var TAG_TYPE = {
  NONE: 0,
  OPENING: 1,
  CLOSING: 2,
  SELF_CLOSING: 3
};

var EVENTS = exports.EVENTS = {
  ERROR: "error",
  TEXT: "text",
  INSTRUCTION: "instruction",
  OPEN_TAG: "opentag",
  CLOSE_TAG: "closetag",
  CDATA: "cdata"
};