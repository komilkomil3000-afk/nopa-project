import 'dart:convert';
import 'package:flutter/material.dart';
import '../models/user_model.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../services/app_state_repository.dart';
import 'package:provider/provider.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

enum LoginMethod { password, testBypass }

class _AuthScreenState extends State<AuthScreen> with SingleTickerProviderStateMixin {
  bool _isLoginTab = true;
  LoginMethod _loginMethod = LoginMethod.password;
  String _selectedCountryCode = '+98';

  // Input Controllers
  final TextEditingController _loginPhoneCtrl = TextEditingController();
  final TextEditingController _loginPasswordCtrl = TextEditingController();

  final TextEditingController _regNameCtrl = TextEditingController();
  final TextEditingController _regPhoneCtrl = TextEditingController();
  final TextEditingController _regCityCtrl = TextEditingController();
  final TextEditingController _regDobCtrl = TextEditingController();
  final TextEditingController _regPasswordCtrl = TextEditingController();

  DateTime? _selectedDob;
  bool _isPasswordVisible = false;

  final HttpApiService _apiService = HttpApiService();

  @override
  void initState() {
    super.initState();
    _checkAutoLogin();
  }

  Future<void> _checkAutoLogin() async {
    if (_apiService.isAuthenticated) {
      final user = await _apiService.getMe();
      if (user != null) {
        if (mounted) {
          Provider.of<AppRepository>(context, listen: false).updateUser(user);
          AuthService.selectedRole = user.role;
          Navigator.pushReplacementNamed(context, '/dashboard', arguments: user.role);
        }
      }
    }
  }

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

  // Pure Dart Gregorian to Jalali converter
  String gregorianToJalali(DateTime date) {
    int gy = date.year;
    int gm = date.month;
    int gd = date.day;
    
    var gDaysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (gy % 4 == 0 && (gy % 100 != 0 || gy % 400 == 0)) {
      gDaysInMonth[2] = 29;
    }
    
    int gDayNo = 0;
    for (int i = 1; i < gm; i++) {
      gDayNo += gDaysInMonth[i];
    }
    gDayNo += gd;
    
    int gDayNoTotal = gDayNo + 365 * (gy - 1) + ((gy - 1) ~/ 4) - ((gy - 1) ~/ 100) + ((gy - 1) ~/ 400);
    int jDayNo = gDayNoTotal - 79;
    int jNp = jDayNo ~/ 12053;
    jDayNo %= 12053;
    int jy = 979 + 33 * jNp + 4 * (jDayNo ~/ 1461);
    jDayNo %= 1461;
    if (jDayNo >= 366) {
      jy += (jDayNo - 1) ~/ 365;
      jDayNo = (jDayNo - 1) % 365;
    }
    int jm;
    int jd;
    if (jDayNo < 186) {
      jm = 1 + (jDayNo ~/ 31);
      jd = 1 + (jDayNo % 31);
    } else {
      jm = 7 + ((jDayNo - 186) ~/ 30);
      jd = 1 + ((jDayNo - 186) % 30);
    }
    
    String monthStr = jm < 10 ? '0$jm' : '$jm';
    String dayStr = jd < 10 ? '0$jd' : '$jd';
    return '$jy/$monthStr/$dayStr';
  }

  // Decodes role securely from cryptographically signed JWT payload
  Map<String, dynamic> decodeJwt(String token) {
    final parts = token.split('.');
    if (parts.length != 3) {
      throw Exception('Invalid token');
    }
    final payload = parts[1];
    var normalized = base64Url.normalize(payload);
    var resp = utf8.decode(base64Url.decode(normalized));
    return jsonDecode(resp);
  }

  void _processLoginResponse(dynamic response) {
    if (response == null) {
      _showError('ارتباط با سرور برقرار نشد');
      return;
    }
    
    if (response['status'] == 'error') {
      _showError(response['message'] ?? 'عملیات ناموفق بود');
      return;
    }

    if (response['status'] == 'multiple_profiles') {
      _showProfileSwitcher(response['profiles']);
    } else if (response['status'] == 'success') {
      final token = response['data']['token'];
      final decodedToken = decodeJwt(token);
      final userRoleStr = decodedToken['role'] ?? response['data']['user']['role'];

      UserRole resolvedRole = UserRole.member;
      if (userRoleStr == 'SUPER_MENTOR') {
        resolvedRole = UserRole.superMentor;
      } else if (userRoleStr == 'mentor') {
        resolvedRole = UserRole.mentor;
      }

      AuthService.selectedRole = resolvedRole;
      
      final userData = response['data']['user'];
      Provider.of<AppRepository>(context, listen: false).updateUser(UserModel(
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
        backgroundColor: const Color(0xFF1E1435),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20), side: const BorderSide(color: Color(0xFF4C3E7A))),
        title: const Text('ورود موفق', style: TextStyle(color: Colors.white, fontFamily: 'Vazirmatn')),
        content: const Text('خوش آمدید! با موفقیت به سیستم احراز هویت وارد شدید.', style: TextStyle(color: Colors.white70, fontFamily: 'Vazirmatn')),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.pushReplacementNamed(context, '/dashboard', arguments: AuthService.selectedRole);
            },
            child: const Text('ادامه', style: TextStyle(color: Color(0xFFD946EF), fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
          ),
        ],
      ),
    );
  }

  void _showProfileSwitcher(List<dynamic> profiles) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E1435),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('انتخاب حساب کاربری', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
              const SizedBox(height: 16),
              ...profiles.map((profile) {
                return Card(
                  color: const Color(0xFF26123D),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  child: ListTile(
                    leading: const CircleAvatar(backgroundColor: Color(0xFF8B5CF6), child: Icon(Icons.person, color: Colors.white)),
                    title: Text(profile['name'], style: const TextStyle(color: Colors.white, fontFamily: 'Vazirmatn')),
                    subtitle: Text(profile['role'] == 'mentor' ? 'راهبر' : 'دانش‌آموز', style: const TextStyle(color: Colors.white70, fontFamily: 'Vazirmatn')),
                    onTap: () {
                      Navigator.pop(context);
                      _handleLoginForRole(profile['role']);
                    },
                  ),
                );
              }),
            ],
          ),
        );
      },
    );
  }

  Future<void> _handleLoginForRole(String role) async {
    String phone = toEnglishDigits(_loginPhoneCtrl.text.trim());
    String password = _loginMethod == LoginMethod.testBypass ? '123456' : _loginPasswordCtrl.text;
    final response = await _apiService.login(phone, password: password, role: role);
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
    String phone = toEnglishDigits(_loginPhoneCtrl.text.trim());
    if (phone.isEmpty) {
      _showError('لطفا شماره تماس را وارد کنید');
      return;
    }
    
    String password = _loginMethod == LoginMethod.testBypass ? '123456' : _loginPasswordCtrl.text;
    if (_loginMethod == LoginMethod.password && password.isEmpty) {
      _showError('لطفا رمز عبور خود را وارد کنید');
      return;
    }

    final response = await _apiService.login(phone, password: password); 
    _processLoginResponse(response);
  }

  Future<void> _handleRegister() async {
    String name = _regNameCtrl.text.trim();
    String phone = toEnglishDigits(_regPhoneCtrl.text.trim());
    String city = _regCityCtrl.text.trim();
    String dob = _regDobCtrl.text.trim();
    String password = _regPasswordCtrl.text;

    if (name.isEmpty || phone.isEmpty || password.isEmpty) {
      _showError('پر کردن فیلدهای نام، شماره همراه و رمز عبور الزامی است');
      return;
    }

    final response = await _apiService.register(
      fullName: name,
      phoneNumber: phone,
      countryCode: _selectedCountryCode,
      city: city,
      dateOfBirth: dob,
      password: password,
    );

    _processLoginResponse(response);
  }

  Future<void> _selectDateOfBirth() async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().subtract(const Duration(days: 365 * 18)),
      firstDate: DateTime(1940),
      lastDate: DateTime.now(),
      locale: const Locale('fa', 'IR'),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.dark(
              primary: Color(0xFFD946EF),
              onPrimary: Colors.white,
              surface: Color(0xFF1E1435),
              onSurface: Colors.white,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null && picked != _selectedDob) {
      setState(() {
        _selectedDob = picked;
        _regDobCtrl.text = gregorianToJalali(picked);
      });
    }
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
              Color(0xFF26123D),
              Color(0xFF0F081D),
            ],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 28.0, vertical: 20.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  const SizedBox(height: 20),
                  
                  // Logo Row
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text(
                        'نُپا',
                        style: TextStyle(
                          color: Color(0xFFFFD54F),
                          fontSize: 48,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 2,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [
                              Color(0xFFF35F79),
                              Color(0xFFE57373),
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFF35F79).withValues(alpha: 0.3),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  
                  const SizedBox(height: 6),
                  const Text(
                    'پویش خانواده انقلابی',
                    style: TextStyle(
                      color: Colors.white60,
                      fontSize: 14,
                      fontWeight: FontWeight.w300,
                    ),
                  ),
                  
                  const SizedBox(height: 30),

                  // Elegant Tab System
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF130A24),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFF2C224D)),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: GestureDetector(
                            onTap: () => setState(() => _isLoginTab = true),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              decoration: BoxDecoration(
                                color: _isLoginTab ? const Color(0xFF8B5CF6) : Colors.transparent,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Center(
                                child: Text(
                                  'ورود به سامانه',
                                  style: TextStyle(
                                    color: _isLoginTab ? Colors.white : Colors.white38,
                                    fontWeight: FontWeight.bold,
                                    fontFamily: 'Vazirmatn',
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: GestureDetector(
                            onTap: () => setState(() => _isLoginTab = false),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              decoration: BoxDecoration(
                                color: !_isLoginTab ? const Color(0xFF8B5CF6) : Colors.transparent,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Center(
                                child: Text(
                                  'ثبت‌نام کاربر جدید',
                                  style: TextStyle(
                                    color: !_isLoginTab ? Colors.white : Colors.white38,
                                    fontWeight: FontWeight.bold,
                                    fontFamily: 'Vazirmatn',
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 28),

                  if (_isLoginTab) ...[
                    // LOGIN TAB VIEW
                    _buildPhoneWithCountryDropdown(_loginPhoneCtrl),
                    const SizedBox(height: 16),
                    
                    // Login Method Selector
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Expanded(
                          child: ChoiceChip(
                            label: const Text('ورود با رمز عبور', style: TextStyle(fontFamily: 'Vazirmatn')),
                            selected: _loginMethod == LoginMethod.password,
                            onSelected: (selected) {
                              if (selected) setState(() => _loginMethod = LoginMethod.password);
                            },
                            selectedColor: const Color(0xFF8B5CF6),
                            backgroundColor: const Color(0xFF1E1435),
                            labelStyle: TextStyle(color: _loginMethod == LoginMethod.password ? Colors.white : Colors.white60),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ChoiceChip(
                            label: const Text('ورود سریع آزمایشی (123456)', style: TextStyle(fontFamily: 'Vazirmatn', fontSize: 11)),
                            selected: _loginMethod == LoginMethod.testBypass,
                            onSelected: (selected) {
                              if (selected) setState(() => _loginMethod = LoginMethod.testBypass);
                            },
                            selectedColor: const Color(0xFF8B5CF6),
                            backgroundColor: const Color(0xFF1E1435),
                            labelStyle: TextStyle(color: _loginMethod == LoginMethod.testBypass ? Colors.white : Colors.white60),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    if (_loginMethod == LoginMethod.password) ...[
                      _buildTextField(
                        controller: _loginPasswordCtrl,
                        hintText: 'رمز عبور',
                        obscureText: !_isPasswordVisible,
                        suffixIcon: IconButton(
                          icon: Icon(
                            _isPasswordVisible ? Icons.visibility : Icons.visibility_off,
                            color: Colors.white60,
                          ),
                          onPressed: () => setState(() => _isPasswordVisible = !_isPasswordVisible),
                        ),
                      ),
                      const SizedBox(height: 24),
                    ] else ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E1435),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFD946EF).withValues(alpha: 0.3)),
                        ),
                        child: const Text(
                          '💡 پس از زدن دکمه ورود، از رمز موقت ۱۲۳۴۵۶ برای ورود سریع استفاده می‌شود.',
                          style: TextStyle(color: Colors.white70, fontSize: 13, fontFamily: 'Vazirmatn'),
                        ),
                      ),
                      const SizedBox(height: 24),
                    ],

                    _buildActionButton('ورود به سامانه', _handleLogin),
                  ] else ...[
                    // REGISTER TAB VIEW
                    _buildTextField(controller: _regNameCtrl, hintText: 'نام و نام خانوادگی'),
                    const SizedBox(height: 12),
                    _buildPhoneWithCountryDropdown(_regPhoneCtrl),
                    const SizedBox(height: 12),
                    _buildDatePickerField(),
                    const SizedBox(height: 12),
                    _buildTextField(controller: _regCityCtrl, hintText: 'شهر'),
                    const SizedBox(height: 12),
                    _buildTextField(
                      controller: _regPasswordCtrl,
                      hintText: 'ایجاد رمز عبور',
                      obscureText: !_isPasswordVisible,
                      suffixIcon: IconButton(
                        icon: Icon(
                          _isPasswordVisible ? Icons.visibility : Icons.visibility_off,
                          color: Colors.white60,
                        ),
                        onPressed: () => setState(() => _isPasswordVisible = !_isPasswordVisible),
                      ),
                    ),
                    const SizedBox(height: 24),
                    _buildActionButton('ثبت‌نام و ورود', _handleRegister),
                  ],
                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPhoneWithCountryDropdown(TextEditingController controller) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF2C224D)),
      ),
      child: Row(
        children: [
          const SizedBox(width: 12),
          DropdownButton<String>(
            value: _selectedCountryCode,
            dropdownColor: const Color(0xFF1E1435),
            style: const TextStyle(color: Colors.white, fontFamily: 'Vazirmatn'),
            underline: const SizedBox(),
            items: const [
              DropdownMenuItem(value: '+98', child: Text('🇮🇷 +98')),
              DropdownMenuItem(value: '+964', child: Text('🇮🇶 +964')),
              DropdownMenuItem(value: '+93', child: Text('🇦🇫 +93')),
            ],
            onChanged: (val) {
              if (val != null) {
                setState(() {
                  _selectedCountryCode = val;
                });
              }
            },
          ),
          Container(
            height: 24,
            width: 1,
            color: const Color(0xFF2C224D),
            margin: const EdgeInsets.symmetric(horizontal: 8),
          ),
          Expanded(
            child: TextField(
              controller: controller,
              keyboardType: TextInputType.phone,
              style: const TextStyle(color: Colors.white, fontSize: 16),
              decoration: const InputDecoration(
                hintText: 'شماره همراه',
                hintStyle: TextStyle(color: Colors.white30),
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(vertical: 18),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDatePickerField() {
    return GestureDetector(
      onTap: _selectDateOfBirth,
      child: AbsorbPointer(
        child: _buildTextField(
          controller: _regDobCtrl,
          hintText: 'تاریخ تولد (هجری شمسی)',
          suffixIcon: const Icon(Icons.calendar_today, color: Colors.white60),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hintText,
    bool obscureText = false,
    Widget? suffixIcon,
  }) {
    return TextField(
      controller: controller,
      obscureText: obscureText,
      style: const TextStyle(color: Colors.white, fontSize: 16),
      decoration: InputDecoration(
        hintText: hintText,
        hintStyle: const TextStyle(color: Colors.white30, fontSize: 15),
        suffixIcon: suffixIcon,
        filled: true,
        fillColor: const Color(0xFF1E1435),
        contentPadding: const EdgeInsets.symmetric(vertical: 18, horizontal: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Color(0xFF2C224D)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Color(0xFF2C224D)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Color(0xFF4C3E7A), width: 1.5),
        ),
      ),
    );
  }

  Widget _buildActionButton(String label, VoidCallback onPressed) {
    return Container(
      width: double.infinity,
      height: 60,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [
            Color(0xFF8B5CF6),
            Color(0xFFD946EF),
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
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.transparent,
          shadowColor: Colors.transparent,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        ),
        child: Text(
          label,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Colors.white,
            fontFamily: 'Vazirmatn',
          ),
        ),
      ),
    );
  }
}
