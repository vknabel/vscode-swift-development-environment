import { Disposable, ExtensionContext, window } from "vscode";

export interface LogStream {
  write(msg: string, show?: boolean): void;
  log(msg: string, show?: boolean): void;
  clear(): void;
}

let disposables: Disposable[] = [];
function makeChannel(name: string, showByDefault: boolean = true): LogStream {
  const _channel = window.createOutputChannel(`Swift - ${name}`);
  disposables.push(_channel);

  const retVal = {
    _channel,
    write(msg: string, show: boolean = showByDefault) {
      this._channel.append(msg);
      if (show) {
        this._channel.show(true);
      }
    },
    log(msg: string, show: boolean = showByDefault) {
      this._channel.appendLine(msg);
      if (show) {
        this._channel.show(true);
      }
    },
    clear() {
      this._channel.clear();
    },
  };
  return retVal;
}

function init(context: ExtensionContext) {
  context.subscriptions.push(...disposables);
}

export default {
  init,
  noop: {
    log(msg: string, show?: boolean) {},
    clear() {},
  },
  build: makeChannel("Build", false),
  run: makeChannel("Run"),
};
