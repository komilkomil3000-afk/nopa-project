import 'package:flutter/material.dart';
import '../utils/constants.dart';
import '../widgets/education_calendar.dart';

class CalendarScreen extends StatelessWidget {
  const CalendarScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const SizedBox(height: 20),
              // App Logo & Title
              const Text(
                "نُپا",
                style: TextStyle(
                  fontSize: 42,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFFFFD700), // طلایی
                  letterSpacing: 2,
                ),
              ),
              const Text(
                "تقویم آموزشی کاروان",
                style: TextStyle(fontSize: 16, color: Colors.white70),
              ),

              const SizedBox(height: 40),

              // Education Calendar Widget
              const EducationCalendar(),

              const SizedBox(height: 40),

              // Quick Navigation Cards
              const Align(
                alignment: Alignment.centerRight,
                child: Text(
                  "دسترسی سریع",
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  _buildQuickNavCard(context, "نقشه راه", Icons.map_outlined, Colors.purple),
                  const SizedBox(width: 12),
                  _buildQuickNavCard(context, "چالش‌ها", Icons.emoji_events_outlined, Colors.pink),
                  const SizedBox(width: 12),
                  _buildQuickNavCard(context, "بازارچه", Icons.shopping_cart_outlined, Color(0xFFFFD700)),
                ],
              ),
              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildQuickNavCard(BuildContext context, String title, IconData icon, Color color) {
    return Expanded(
      child: GestureDetector(
        onTap: () {
          // فعلاً هیچ کاری نمی‌کند، بعداً می‌توانید ناوبری اضافه کنید
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: color.withValues(alpha: 0.3)),
          ),
          child: Column(
            children: [
              Icon(icon, color: color, size: 28),
              const SizedBox(height: 8),
              Text(
                title,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ),
      ),
    );
  }
}