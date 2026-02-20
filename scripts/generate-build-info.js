export {};

import fs from "node:fs";

function pad(n) {
  return String(n).padStart(2, "0");
}

const now = new Date();

const stamp =
  `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
  `.${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

const content = `
// AUTO GENERATED — DO NOT EDIT
const BUILD_INFO = {
  build: "${stamp}"
};
export default BUILD_INFO;
`;

fs.writeFileSync("./src/build-info.js", content);

console.log("Build:", stamp);
