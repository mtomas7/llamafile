// Copyright 2024 Mozilla Foundation
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

class HighlightMarkdown extends Highlighter {

  static NORMAL = 0;
  static TICK = 1;
  static TICK_TICK = 2;
  static LANG = 3;
  static CODE = 4;
  static CODE_TICK = 5;
  static CODE_TICK_TICK = 6;
  static STAR = 7;
  static STRONG = 8;
  static STRONG_BACKSLASH = 9;
  static STRONG_STAR = 10;
  static BACKSLASH = 11;
  static INCODE = 12;
  static INCODE2 = 13;
  static INCODE2_TICK = 14;
  static EMPHASIS = 15;
  static EMPHASIS_BACKSLASH = 16;
  static LANG2 = 17;
  static NEWLINE = 18;
  static EAT_NEWLINE = 19;

  constructor(delegate) {
    super(delegate);
    this.bol = true;
    this.tail = false;
    this.lang = '';
    this.highlighter = null;
    this.newlines = 0;
  }

  feed(input) {
    for (let i = 0; i < input.length; i += this.delta) {
      this.delta = 1;
      const c = input[i];
      switch (this.state) {

      case HighlightMarkdown.NORMAL:
        if (c == '`') {
          this.state = HighlightMarkdown.TICK;
          break;
        } else if (c == '*') {
          this.state = HighlightMarkdown.STAR;
          break;
        } else if (c == '\\') {
          // handle \*\*not bold\*\* etc.
          this.state = HighlightMarkdown.BACKSLASH;
        } else if (c == '\n') {
          this.bol = true;
          this.tail = false;
          this.state = HighlightMarkdown.NEWLINE;
          this.newlines = 1;
          break;
        } else {
          this.append(c);
        }
        this.tail = true;
        if (!isblank(c))
          this.bol = false;
        break;

      case HighlightMarkdown.NEWLINE:
        if (c == '\n') {
          ++this.newlines;
        } else {
          if (this.newlines >= 2) {
            this.push('p', '');
            this.pop();
          } else {
            this.append('\n');
          }
          this.epsilon(HighlightMarkdown.NORMAL);
        }
        break;

      case HighlightMarkdown.BACKSLASH:
        this.append(c);
        this.state = HighlightMarkdown.NORMAL;
        break;

      case HighlightMarkdown.STAR:
        if (c == '*') {
          // handle **strong** text
          this.state = HighlightMarkdown.STRONG;
          this.push('span', 'bold');
        } else if (this.bol && isblank(c)) {
          this.append('*');
          this.append(c);
          this.state = HighlightMarkdown.NORMAL;
        } else {
          // handle *emphasized* text
          // inverted because \e[3m has a poorly supported western bias
          this.push('span', 'italic');
          this.append(c);
          this.state = HighlightMarkdown.EMPHASIS;
          if (c == '\\')
            this.state = HighlightMarkdown.EMPHASIS_BACKSLASH;
        }
        break;

      case HighlightMarkdown.EMPHASIS:
        // this is for *emphasized* text
        if (c == '*') {
          this.state = HighlightMarkdown.NORMAL;
          this.pop();
        } else if (c == '\\') {
          this.state = HighlightMarkdown.EMPHASIS_BACKSLASH;
        } else {
          this.append(c);
        }
        break;

      case HighlightMarkdown.EMPHASIS_BACKSLASH:
        // so we can say *unbroken \* italic* and have it work
        this.append(c);
        this.state = HighlightMarkdown.EMPHASIS;
        break;

      case HighlightMarkdown.STRONG:
        if (c == '*') {
          this.state = HighlightMarkdown.STRONG_STAR;
        } else if (c == '\\') {
          this.state = HighlightMarkdown.STRONG_BACKSLASH;
        } else {
          this.append(c);
        }
        break;

      case HighlightMarkdown.STRONG_BACKSLASH:
        // so we can say **unbroken \*\* bold** and have it work
        this.append(c);
        this.state = HighlightMarkdown.STRONG;
        break;

      case HighlightMarkdown.STRONG_STAR:
        if (c == '*') {
          this.state = HighlightMarkdown.NORMAL;
          this.pop();
        } else if (c == '\n' && !this.tail) { // handle *** line break
          this.pop();
          this.push('hr', '');
          this.pop();
          this.epsilon(HighlightMarkdown.NORMAL);
        } else if (c == '\\') {
          this.state = HighlightMarkdown.STRONG_BACKSLASH;
        } else {
          this.append(c);
          this.state = HighlightMarkdown.STRONG;
        }
        break;

      case HighlightMarkdown.TICK:
        if (c == '`') {
          this.state = HighlightMarkdown.TICK_TICK;
        } else {
          this.push('code', '');
          this.append(c);
          this.state = HighlightMarkdown.INCODE;
        }
        break;

      case HighlightMarkdown.INCODE:
        // this is for `inline code` like that
        // no backslash escapes are supported here
        if (c == '`') {
          this.pop();
          this.state = HighlightMarkdown.NORMAL;
        } else {
          this.append(c);
        }
        break;

      case HighlightMarkdown.INCODE2:
        // this is for ``inline ` code`` like that
        // it lets you put backtick inside the code
        if (c == '`') {
          this.state = HighlightMarkdown.INCODE2_TICK;
        } else {
          this.append(c);
        }
        break;

      case HighlightMarkdown.INCODE2_TICK:
        if (c == '`') {
          this.pop();
          this.state = HighlightMarkdown.NORMAL;
        } else {
          this.append(c);
          this.state = HighlightMarkdown.INCODE2;
        }
        break;

      case HighlightMarkdown.TICK_TICK:
        if (c == '`') {
          this.state = HighlightMarkdown.LANG;
        } else {
          this.push('code', '');
          this.append(c);
          this.state = HighlightMarkdown.INCODE2;
        }
        break;

      case HighlightMarkdown.LANG:
        if (!isascii(c) || !isspace(c)) {
          this.lang += c.toLowerCase();
        } else {
          this.epsilon(HighlightMarkdown.LANG2);
        }
        break;

      case HighlightMarkdown.LANG2:
        if (c == "\n") {
          this.flush();
          let hdom = new HighlightDom(this.push('pre', ''));
          console.log(this.lang);
          if (!(this.highlighter = Highlighter.create(this.lang, hdom)))
            this.highlighter = Highlighter.create('txt', hdom);
          this.state = HighlightMarkdown.CODE;
          this.lang = '';
        }
        break;

      case HighlightMarkdown.CODE:
        if (c == '`') {
          this.state = HighlightMarkdown.CODE_TICK;
        } else {
          this.highlighter.feed(c);
        }
        break;

      case HighlightMarkdown.CODE_TICK:
        if (c == '`') {
          this.state = HighlightMarkdown.CODE_TICK_TICK;
        } else {
          this.highlighter.feed("`" + c);
          this.state = HighlightMarkdown.CODE;
        }
        break;

      case HighlightMarkdown.CODE_TICK_TICK:
        if (c == '`') {
          this.state = HighlightMarkdown.EAT_NEWLINE;
          this.highlighter.flush();
          this.highlighter = null;
          this.pop();
        } else {
          this.highlighter.feed("``" + c);
          this.state = HighlightMarkdown.CODE;
        }
        break;

      case HighlightMarkdown.EAT_NEWLINE:
        if (c != '\n') {
          this.epsilon(HighlightMarkdown.NORMAL);
        }
        break;

      default:
        throw new Error('Invalid state');
      }
    }
  }

  flush() {
    switch (this.state) {
    case HighlightMarkdown.LANG:
      this.lang = '';
      break;
    case HighlightMarkdown.STAR:
      this.append('*');
      break;
    case HighlightMarkdown.TICK:
      this.append('`');
      break;
    case HighlightMarkdown.TICK_TICK:
      this.append("``");
      break;
    case HighlightMarkdown.INCODE:
    case HighlightMarkdown.INCODE2:
    case HighlightMarkdown.INCODE2_TICK:
    case HighlightMarkdown.STRONG:
    case HighlightMarkdown.STRONG_BACKSLASH:
    case HighlightMarkdown.STRONG_STAR:
    case HighlightMarkdown.EMPHASIS:
    case HighlightMarkdown.EMPHASIS_BACKSLASH:
      this.pop();
      break;
    case HighlightMarkdown.CODE:
      this.highlighter.flush();
      this.highlighter = null;
      this.pop();
      break;
    case HighlightMarkdown.CODE_TICK:
      this.append('`');
      this.highlighter.flush();
      this.highlighter = null;
      this.pop();
      break;
    case HighlightMarkdown.CODE_TICK_TICK:
      this.append('``');
      this.highlighter.flush();
      this.highlighter = null;
      this.pop();
      break;
    default:
      break;
    }
    this.state = HighlightMarkdown.NORMAL;
    this.bol = true;
    this.tail = false;
    this.newlines = 0;
    this.delegate.flush();
  }
}

Highlighter.REGISTRY['markdown'] = HighlightMarkdown;
Highlighter.REGISTRY['md'] = HighlightMarkdown;