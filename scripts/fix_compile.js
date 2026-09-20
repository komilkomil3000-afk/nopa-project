const fs = require('fs');

// 1. Fix api_service.dart
let apiContent = fs.readFileSync('lib/services/api_service.dart', 'utf8');
apiContent = apiContent.replace(/await getToken\(\)/g, '_token');
apiContent = apiContent.replace(/\$baseUrl/g, '${this.baseUrl}');
apiContent = apiContent.replace(/\$token/g, '$_token');
fs.writeFileSync('lib/services/api_service.dart', apiContent, 'utf8');

// 2. Fix profile_screen.dart
let profileContent = fs.readFileSync('lib/screens/profile_screen.dart', 'utf8');
profileContent = profileContent.replace(/activeThumbColor:/g, 'activeColor:');
fs.writeFileSync('lib/screens/profile_screen.dart', profileContent, 'utf8');

// 3. Fix reward_popup.dart
let rewardContent = fs.readFileSync('lib/widgets/reward_popup.dart', 'utf8');
rewardContent = rewardContent.replace(
  '  static void show(BuildContext context, {required String title, required int zarikAmount}) {',
  '  static void show(BuildContext context, {String? title, String? message, required int zarikAmount, int? starAmount}) {'
);
rewardContent = rewardContent.replace(
  '        title: title,',
  '        title: title ?? message ?? "",'
);
fs.writeFileSync('lib/widgets/reward_popup.dart', rewardContent, 'utf8');

console.log('Fixed compile errors.');
