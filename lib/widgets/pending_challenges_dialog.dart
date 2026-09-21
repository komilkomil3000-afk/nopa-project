import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../main.dart'; // For MainScreenState

class PendingChallengesDialog extends StatelessWidget {
  final int pendingCount;

  const PendingChallengesDialog({super.key, required this.pendingCount});

  static Future<void> show(BuildContext context, int pendingCount) {
    return showDialog(
      context: context,
      builder: (ctx) => PendingChallengesDialog(pendingCount: pendingCount),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: const Color(0xFF231C38),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: Color(0xFFF87171), width: 1.5),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close, color: Colors.white70, size: 20),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
                Row(
                  children: [
                    const Text(
                      'عدم دسترسی به منزلگاه جدید',
                      style: TextStyle(
                        color: Color(0xFFF87171),
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'Vazirmatn',
                      ),
                    ),
                    const SizedBox(width: 6),
                    SvgPicture.asset(
                      'assets/svg_icons/lock02.svg',
                      width: 20,
                      height: 20,
                      fit: BoxFit.contain,
                    ),
                  ],
                ),
              ],
            ),
            const Divider(color: Colors.white12),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFEF4444).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.3)),
              ),
              child: Column(
                children: [
                  const Icon(Icons.warning_amber_rounded, color: Color(0xFFF87171), size: 44),
                  const SizedBox(height: 12),
                  const Text(
                    'شما باید چالش‌هایتان را تکمیل کنید',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Color(0xFFF87171),
                      fontSize: 15.5,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'Vazirmatn',
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'جهت ورود به منزلگاه جدید، تعداد چالش‌های انجام‌نشده شما باید صفر باشد (همه چالش‌ها را انجام داده باشید).\nدر حال حاضر $pendingCount چالش تکمیل‌نشده دارید.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 12,
                      fontFamily: 'Vazirmatn',
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                Navigator.of(context).popUntil((route) => route.isFirst || route.settings.name == '/dashboard');
                navigateToMainTab(2); // Switch to Challenges tab
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF8B5CF6),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 3,
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.assignment_turned_in_rounded, size: 18),
                  SizedBox(width: 8),
                  Text(
                    'مشاهده و انجام چالش‌ها',
                    style: TextStyle(
                      fontFamily: 'Vazirmatn',
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text(
                'متوجه شدم',
                style: TextStyle(
                  color: Colors.white54,
                  fontFamily: 'Vazirmatn',
                  fontSize: 12,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
