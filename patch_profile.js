const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'lib/screens/profile_screen.dart');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add import
if (!content.includes('theme_provider.dart')) {
  content = content.replace("import '../services/app_state_repository.dart';", "import '../services/app_state_repository.dart';\nimport '../services/theme_provider.dart';");
}

// 2. Fix backgrounds
content = content.replace(/backgroundColor: const Color\(0xFF0F081D\),/g, 'backgroundColor: Theme.of(context).scaffoldBackgroundColor,');

// 3. Inject setting call in Mentor profile
content = content.replace('            _buildMentorManagementSection(context, currentUser),\n            \n            const SizedBox(height: 100),', '            _buildMentorManagementSection(context, currentUser),\n            \n            const SizedBox(height: 30),\n            _buildSettingsSection(context),\n            const SizedBox(height: 100),');

// 4. Inject setting call in Member profile
content = content.replace('            _buildSignOutSection(context),\n\n            const SizedBox(height: 100),', '            _buildSignOutSection(context),\n\n            const SizedBox(height: 30),\n            _buildSettingsSection(context),\n            const SizedBox(height: 100),');

// 5. Append _buildSettingsSection
const settingsFunction = `
  Widget _buildSettingsSection(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      width: double.infinity,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'تنظیمات نمایشی',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.white,
              fontFamily: 'Vazirmatn',
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('حالت تاریک', style: TextStyle(color: Colors.white, fontSize: 16, fontFamily: 'Vazirmatn')),
                    Switch(
                      value: themeProvider.isDarkMode,
                      activeColor: const Color(0xFFD946EF),
                      onChanged: (val) {
                        themeProvider.toggleTheme(val);
                      },
                    ),
                  ],
                ),
                const Divider(color: Colors.white12, height: 32),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('اندازه متن', style: TextStyle(color: Colors.white, fontSize: 16, fontFamily: 'Vazirmatn')),
                    Expanded(
                      child: Slider(
                        value: themeProvider.fontScale,
                        min: 0.8,
                        max: 1.5,
                        divisions: 7,
                        activeColor: const Color(0xFFD946EF),
                        onChanged: (val) {
                          themeProvider.setFontScale(val);
                        },
                      ),
                    ),
                    Text(
                      themeProvider.fontScale.toStringAsFixed(1),
                      style: const TextStyle(color: Colors.white54, fontSize: 14),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
`;

if (!content.includes('_buildSettingsSection')) {
  // Find the last closing brace before the end of the file
  const lastBraceIndex = content.lastIndexOf('}');
  content = content.substring(0, lastBraceIndex) + settingsFunction + content.substring(lastBraceIndex);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Patched profile_screen.dart successfully');
