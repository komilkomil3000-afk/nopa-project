import 'dart:async';
import 'package:flutter/material.dart';
import '../services/auth_service.dart';

class SuccessScreen extends StatefulWidget {
  const SuccessScreen({super.key});

  @override
  State<SuccessScreen> createState() => _SuccessScreenState();
}

class _SuccessScreenState extends State<SuccessScreen> {
  Timer? _navigationTimer;

  @override
  void initState() {
    super.initState();
    // Automatically navigate to dashboard after 2 seconds
    _navigationTimer = Timer(const Duration(seconds: 2), () {
      _navigateToDashboard();
    });
  }

  @override
  void dispose() {
    _navigationTimer?.cancel();
    super.dispose();
  }

  void _navigateToDashboard() {
    if (mounted) {
      Navigator.pushReplacementNamed(
        context,
        '/dashboard',
        arguments: AuthService.selectedRole,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF120c1f), // App background color
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.check_circle, color: Colors.green, size: 80),
            const SizedBox(height: 20),
            const Text(
              "ورود با موفقیت انجام شد!",
              style: TextStyle(
                color: Colors.white,
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              "در حال انتقال به صفحه اصلی...",
              style: TextStyle(
                color: Colors.white38,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 40),
            ElevatedButton(
              onPressed: _navigateToDashboard,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF8b5cf6),
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text(
                "ورود مستقیم",
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
