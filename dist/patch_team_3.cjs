const fs = require('fs');
let content = fs.readFileSync('dist/app.js', 'utf8');

const searchStr = `profileTopic === 'team' && (() => {
              if (selectedTeam) return null;`;

const profileBlockStart = content.indexOf('      selectedTeam && (() => {');
const profileBlockEnd = content.indexOf('      // ADD EXPENSE MODAL');

if (profileBlockStart > -1 && profileBlockEnd > -1) {
    const profileBlock = content.slice(profileBlockStart, profileBlockEnd);
    
    // Remove the profile block from its current position
    content = content.slice(0, profileBlockStart) + content.slice(profileBlockEnd);
    
    // Inject it into the team block
    const newTeamBlock = `profileTopic === 'team' && (() => {
              if (selectedTeam) {
                const innerBlock = ${profileBlock.trim().slice(0, -1)};
                return innerBlock;
              }`;
              
    content = content.replace(searchStr, newTeamBlock);
    
    fs.writeFileSync('dist/app.js', content, 'utf8');
    console.log('Fixed overlapping UI issue by moving the inline profile to the correct parent container.');
} else {
    console.log('Could not find profile block');
}
