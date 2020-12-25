import { Disposable, ExtensionContext, window } from "vscode";

interface OutputStream {
  log(msg: string, show?: boolean): void;
  clear(): void;
}

let disposables: Disposable[] = [];
function makeChannel(name: string): OutputStream {
  const _channel = window.createOutputChannel(`Swift - ${name}`);
  disposables.push(_channel);

  const retVal = {
    _channel,
    log(msg: string, show: boolean = true) {
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
  build: makeChannel("Build"),
  run: makeChannel("Run"),
};
