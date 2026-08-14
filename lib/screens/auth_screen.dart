import 'package:flutter/material.dart';
import '../models/user_model.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../services/app_state_repository.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  UserRole _selectedRole = UserRole.member;
  final TextEditingController _phoneController = TextEditingController();
  final HttpApiService _apiService = HttpApiService();

  String toEnglishDigits(String input) {
    const english = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const farsi = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const arabic = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

    for (int i = 0; i < 10; i++) {
      input = input.replaceAll(farsi[i], english[i]);
      input = input.replaceAll(arabic[i], english[i]);
    }
    return input;
  }

  void _processLoginResponse(dynamic response) {
    if (response == null) {
      _showError('ورود ناموفق بود. لطفاً اطلاعات را بررسی کنید');
      return;
    }
    
    if (response['status'] == 'error') {
      _showError(response['message'] ?? 'ورود ناموفق بود. لطفاً اطلاعات را بررسی کنید');
      return;
    }

    if (response['status'] == 'multiple_profiles') {
      _showProfileSwitcher(response['profiles']);
    } else if (response['status'] == 'success') {
      final userRoleStr = response['data']['user']['role'];
      UserRole resolvedRole = UserRole.member;
      if (userRoleStr == 'SUPER_MENTOR') {
        resolvedRole = UserRole.superMentor;
      } else if (userRoleStr == 'mentor') {
        resolvedRole = UserRole.mentor;
      } else if (userRoleStr == 'admin') {
        resolvedRole = UserRole.superMentor; // Or however admin maps to flutter role
      }

      AuthService.selectedRole = resolvedRole;
      
      // Setup current user in AppStateRepository
      final userData = response['data']['user'];
      AppRepository().updateUser(UserModel(
        id: userData['id'],
        name: userData['name'],
        phoneNumber: userData['phoneNumber'],
        avatarUrl: userData['avatarUrl'],
        role: resolvedRole,
        zarik: userData['zarikBalance'] ?? 0,
        levelFrame: userData['levelFrame'] ?? 1,
      ));
      
      _showWelcomeDialogAndNavigate();
    }
  }
  
  void _showWelcomeDialogAndNavigate() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1F2937),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('خوش آمدید', style: TextStyle(color: Colors.white, fontFamily: 'Vazirmatn')),
        content: const Text('ورود شما با موفقیت انجام شد.', style: TextStyle(color: Colors.white70, fontFamily: 'Vazirmatn')),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context); // Close dialog
              Navigator.pushReplacementNamed(context, '/dashboard', arguments: AuthService.selectedRole);
            },
            child: const Text('ورود به برنامه', style: TextStyle(color: Color(0xFF8B5CF6), fontFamily: 'Vazirmatn')),
          ),
        ],
      ),
    );
  }

  void _showProfileSwitcher(List<dynamic> profiles) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1F2937),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('انتخاب حساب کاربری', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
              const SizedBox(height: 16),
              ...profiles.map((profile) {
                return ListTile(
                  leading: const CircleAvatar(backgroundColor: Color(0xFF8B5CF6), child: Icon(Icons.person, color: Colors.white)),
                  title: Text(profile['name'], style: const TextStyle(color: Colors.white, fontFamily: 'Vazirmatn')),
                  subtitle: Text(profile['role'] == 'mentor' ? 'راهبر' : 'عضو', style: const TextStyle(color: Colors.white70, fontFamily: 'Vazirmatn')),
                  onTap: () {
                    Navigator.pop(context);
                    // Login specifically as this role
                    _handleLoginForRole(profile['role']);
                  },
                );
              }),
            ],
          ),
        );
      },
    );
  }

  Future<void> _handleLoginForRole(String role) async {
    String phone = toEnglishDigits(_phoneController.text.trim());
    
    final response = await _apiService.login(phone, role: role);
    _processLoginResponse(response);
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: const TextStyle(fontFamily: 'Vazirmatn')),
        backgroundColor: Colors.redAccent,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _handleLogin() async {
    String phone = toEnglishDigits(_phoneController.text.trim());
    if (phone.isEmpty) {
      _showError('لطفا شماره تماس را وارد کنید');
      return;
    }
    
    // Convert role to string expected by backend if needed, or rely on _selectedRole mapping
    String roleStr = _selectedRole == UserRole.mentor ? 'mentor' : 'student';
    final response = await _apiService.login(phone, role: roleStr); 
    _processLoginResponse(response);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0, -0.3),
            radius: 1.2,
            colors: [
              Color(0xFF26123D), // Deep rich purple-violet
              Color(0xFF0F081D), // Dark space black/navy
            ],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 36.0, vertical: 24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  const SizedBox(height: 30),
                  
                  // Logo Row
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      // Yellow text "نُپا"
                      const Text(
                        'نُپا',
                        style: TextStyle(
                          color: Color(0xFFFFD54F), // Premium Yellow/Gold
                          fontSize: 56,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 2,
                        ),
                      ),
                      const SizedBox(width: 14),
                      // Rounded Square Box
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [
                              Color(0xFFF35F79), // Coral pink
                              Color(0xFFE57373), // Coral red
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(14),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFF35F79).withValues(alpha: 0.3),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  
                  const SizedBox(height: 8),
                  const Text(
                    'پویش خانواده انقلابی',
                    style: TextStyle(
                      color: Colors.white60,
                      fontSize: 15,
                      fontWeight: FontWeight.w300,
                      letterSpacing: 0.5,
                    ),
                  ),
                  
                  const SizedBox(height: 45),
                  
                  // Role Selector
                  Row(
                    children: [
                      // Member (مخاطب) button
                      Expanded(
                        child: _buildRoleButton(
                          title: 'مخاطب',
                          emoji: '🧭',
                          role: UserRole.member,
                          activeColor: const Color(0xFFEC4899), // Pink
                        ),
                      ),
                      const SizedBox(width: 16),
                      // Mentor (راهبر) button
                      Expanded(
                        child: _buildRoleButton(
                          title: 'راهبر',
                          emoji: '🚩',
                          role: UserRole.mentor,
                          activeColor: const Color(0xFF8B5CF6), // Purple
                        ),
                      ),
                    ],
                  ),
                  
                  const SizedBox(height: 35),
                  
                  // Phone Number Input
                  _buildTextField(
                    controller: _phoneController,
                    hintText: 'شماره تماس',
                    keyboardType: TextInputType.phone,
                  ),
                  
                  const SizedBox(height: 16),
                  
                  // Large Main Login Button
                  Container(
                    width: double.infinity,
                    height: 60,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [
                          Color(0xFF8B5CF6), // Purple
                          Color(0xFFD946EF), // Fuchsia/pink
                        ],
                        begin: Alignment.centerRight,
                        end: Alignment.centerLeft,
                      ),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFD946EF).withValues(alpha: 0.3),
                          blurRadius: 15,
                          offset: const Offset(0, 5),
                        ),
                      ],
                    ),
                    child: ElevatedButton(
                      onPressed: _handleLogin,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.transparent,
                        shadowColor: Colors.transparent,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                        ),
                      ),
                      child: const Text(
                        'ورود به سامانه',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildRoleButton({
    required String title,
    required String emoji,
    required UserRole role,
    required Color activeColor,
  }) {
    final bool isSelected = _selectedRole == role;
    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedRole = role;
        });
      },
      child: Container(
        height: 56,
        decoration: BoxDecoration(
          color: const Color(0xFF1E1435), // Dark purple/black background
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: isSelected ? activeColor : const Color(0xFF2C224D),
            width: 2.0,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: activeColor.withValues(alpha: 0.2),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              emoji,
              style: const TextStyle(fontSize: 16),
            ),
            const SizedBox(width: 8),
            Text(
              title,
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hintText,
    bool obscureText = false,
    TextInputType keyboardType = TextInputType.text,
  }) {
    return TextField(
      controller: controller,
      obscureText: obscureText,
      keyboardType: keyboardType,
      textAlign: TextAlign.center,
      style: const TextStyle(
        color: Colors.white,
        fontSize: 16,
        fontWeight: FontWeight.w500,
      ),
      decoration: InputDecoration(
        hintText: hintText,
        hintStyle: const TextStyle(
          color: Colors.white30,
          fontSize: 15,
        ),
        filled: true,
        fillColor: const Color(0xFF1E1435),
        contentPadding: const EdgeInsets.symmetric(vertical: 18, horizontal: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(
            color: Color(0xFF2C224D),
            width: 1.0,
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(
            color: Color(0xFF2C224D),
            width: 1.0,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(
            color: Color(0xFF4C3E7A),
            width: 1.5,
          ),
        ),
      ),
    );
  }
}
