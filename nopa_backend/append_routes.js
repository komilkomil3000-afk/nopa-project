const fs = require('fs');
let content = fs.readFileSync('src/routes/api.ts', 'utf8');

const routesToAppend = `
// Mentor Workspace Routes
router.post('/mentor/challenges', authenticateJWT as any, authorizeRoles('mentor') as any, createMentorChallenge as any);
router.get('/mentor/challenges', authenticateJWT as any, authorizeRoles('mentor') as any, getMentorChallenges as any);
router.get('/mentor/challenges/:id/submissions', authenticateJWT as any, authorizeRoles('mentor') as any, getChallengeSubmissions as any);
router.post('/mentor/submissions/:id/review', authenticateJWT as any, authorizeRoles('mentor') as any, reviewChallengeSubmission as any);
router.get('/mentor/tickets/:id', authenticateJWT as any, authorizeRoles('mentor') as any, getMentorTicketDetails as any);
router.post('/mentor/tickets/:id/messages', authenticateJWT as any, authorizeRoles('mentor') as any, replyMentorTicket as any);

export default router;
`;

content = content.replace('export default router;', routesToAppend);
fs.writeFileSync('src/routes/api.ts', content);
