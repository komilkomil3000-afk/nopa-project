import '../models/user_model.dart';

class AuthService {
  static UserRole selectedRole = UserRole.member;

  bool loginWithPhoneAndOtp(String phone, String otp) {
    // Phone can be variable, but OTP must be exactly "123456"
    if (phone.isNotEmpty && otp == "123456") {
      return true;
    }
    return false;
  }

  bool loginWithPassword(String password) {
    // Fixed passcode must be exactly "nepa123" for both roles
    if (password == "nepa123") {
      return true;
    }
    return false;
  }
}
