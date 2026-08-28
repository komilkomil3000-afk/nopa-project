const fs = require('fs');

const appPath = './public/app.js';
const newTailPath = './new_tail.js';

const appLines = fs.readFileSync(appPath, 'utf8').split('\n');
const newTail = fs.readFileSync(newTailPath, 'utf8');

const cutoff = appLines.findIndex(l => l.includes('window.closeChangeCaravanMentorModal = function() {'));
if (cutoff === -1) {
    console.error('Could not find closeChangeCaravanMentorModal in app.js');
    process.exit(1);
}

const newAppContent = appLines.slice(0, cutoff + 3).join('\n') + '\n\n' + newTail;

fs.writeFileSync(appPath, newAppContent, 'utf8');
console.log('Successfully replaced tail of app.js');
