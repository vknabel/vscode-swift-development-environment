import { window, StatusBarItem, StatusBarAlignment, ThemeColor } from "vscode";

const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
function buildAnimator() {
  let i = 0;
  return function() {
    i = (i + 1) % frames.length;
    return frames[i];
  };
}

let buildItem: StatusBarItem;
let defaultColor: string | ThemeColor;
let animationInterval: NodeJS.Timeout;

const getItem = () => {
  if (!buildItem) {
    buildItem = window.createStatusBarItem(StatusBarAlignment.Left);
    defaultColor = buildItem.color;
  }
  buildItem.color = defaultColor;
  buildItem.show();
  return buildItem;
};
const stopAnimation = () => clearInterval(animationInterval);

export const statusBarItem = {
  start(action: string = "building") {
    stopAnimation();
    const item = getItem();
    const nextFrame = buildAnimator();
    animationInterval = setInterval(() => {
      item.text = `${nextFrame()} ${action}`;
    }, 100);
  },
  succeeded(action: string = "build") {
    stopAnimation();
    const item = getItem();
    item.text = `$(check) ${action} succeeded`;
    item.color = defaultColor;
    setTimeout(() => item.hide(), 10000);
  },
  failed(action: string = "build") {
    stopAnimation();
    const item = getItem();
    item.text = `$(issue-opened) ${action} failed`;
    item.color = "red";
  },
};
