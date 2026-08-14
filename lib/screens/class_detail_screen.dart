import 'package:flutter/material.dart';
import '../utils/constants.dart';
import '../services/api_service.dart';

class ClassDetailScreen extends StatelessWidget {
  const ClassDetailScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final String title = ModalRoute.of(context)?.settings.arguments as String? ?? "کلاس آموزشی";

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(title),
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Video Placeholder
            Container(
              height: 220,
              width: double.infinity,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(24),
                image: DecorationImage(
                  image: NetworkImage(HttpApiService().resolveMediaUrl('/uploads/banners/class_default.jpg')),
                  onError: (e, s) => debugPrint('Image load error'),
                  fit: BoxFit.cover,
                ),
              ),
              child: Center(
                child: Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    color: Colors.pink.withValues(alpha: 0.8),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2),
                  ),
                  child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 40),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Online Play Button
            Container(
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 20),
              decoration: BoxDecoration(
                border: Border.all(color: Colors.purple.withValues(alpha: 0.5)),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.link, color: Colors.purple, size: 20),
                  const SizedBox(width: 10),
                  const Text("پخش آنلاین", style: TextStyle(color: Colors.purple, fontWeight: FontWeight.bold)),
                ],
              ),
            ),

            const SizedBox(height: 30),

            // Instructor
            const Text(
              "استاد: پیر نجوم",
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFFFFD700)),
            ),
            const SizedBox(height: 8),
            const Text(
              "مدرس مباحث هدف‌گذاری SMART و مدیریت مسیر کاروان",
              style: TextStyle(color: Colors.white70, fontSize: 14),
            ),

            const SizedBox(height: 30),

            // Curriculum
            const Text(
              "سرفصل‌ها",
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            _buildSyllabusItem("۱. اصول پنج‌گانه هدف‌گذاری"),
            _buildSyllabusItem("۲. ترسیم نقشه راه اختصاصی"),
            _buildSyllabusItem("۳. روش‌های غلبه بر چالش‌های مسیر"),

            const SizedBox(height: 40),

            // Bottom Action Buttons
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildActionButton("کلاس قبلی", Icons.arrow_back_ios, Colors.white10),
                  const SizedBox(width: 10),
                  _buildActionButton("کلاس بعدی", Icons.arrow_forward_ios, Colors.white10),
                  const SizedBox(width: 10),
                  _buildActionButton("ورود به آزمون", Icons.quiz, Colors.purple),
                  const SizedBox(width: 10),
                  _buildDisabledActionButton("ارتباط با راهبر", Icons.chat),
                ],
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildSyllabusItem(String text) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const Icon(Icons.check_circle_outline, color: Colors.green, size: 20),
          const SizedBox(width: 12),
          Text(text, style: const TextStyle(fontSize: 14)),
        ],
      ),
    );
  }

  Widget _buildActionButton(String title, IconData icon, Color color) {
    return Container(
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 8),
          Text(
            title,
            style: TextStyle(color: color, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
          ),
        ],
      ),
    );
  }

  Widget _buildDisabledActionButton(String title, IconData icon) {
    return Tooltip(
      message: "سیستم گفتگو به‌زودی فعال می‌شود",
      child: Container(
        decoration: BoxDecoration(
          color: Colors.grey.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.withValues(alpha: 0.5)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Icon(icon, color: Colors.grey, size: 20),
            const SizedBox(width: 8),
            Text(
              title,
              style: const TextStyle(color: Colors.grey, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
            ),
          ],
        ),
      ),
    );
  }
}