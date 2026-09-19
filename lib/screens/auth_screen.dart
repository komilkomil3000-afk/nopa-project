export '../features/auth/presentation/screens/login_screen.dart';
import 'package:flutter/material.dart';
import '../features/auth/presentation/screens/login_screen.dart';

/// Legacy Bridge for AuthScreen route
class AuthScreen extends StatelessWidget {
  const AuthScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const LoginScreen();
  }
}
