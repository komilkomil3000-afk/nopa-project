import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/app_state_repository.dart';
import '../models/user_model.dart';
import 'complete_profile_dialog.dart';

class NopaNotificationDialog {
  static void show(BuildContext context) {
    final repository = Provider.of<AppRepository>(context, listen: false);
    // Fetch fresh notifications from server immediately
    repository.fetchNotifications().then((_) {
      repository.markAllNotificationsAsRead();
    });
    
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return ListenableBuilder(
          listenable: repository,
          builder: (context, _) {
            final userRole = repository.currentUser.role;
            final list = repository.notifications.where((n) => n['isForMentor'] == (userRole == UserRole.mentor || userRole == UserRole.superMentor)).toList();

            return Dialog(
              backgroundColor: const Color(0xFF1E1435),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              child: Container(
                padding: const EdgeInsets.all(20),
                width: double.infinity,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.close, color: Colors.white70),
                              onPressed: () => Navigator.pop(context),
                            ),
                            IconButton(
                              icon: const Icon(Icons.refresh, color: Colors.white70, size: 20),
                              tooltip: 'به‌روزرسانی',
                              onPressed: () => repository.fetchNotifications(),
                            ),
                          ],
                        ),
                        const Text(
                          'اعلان‌ها و پیام‌های نپا 🚩',
                          style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                        ),
                      ],
                    ),
                    const Divider(color: Colors.white10),
                    const SizedBox(height: 10),
                    if (list.isEmpty)
                      const Center(
                        child: Padding(
                          padding: EdgeInsets.symmetric(vertical: 30.0),
                          child: Text('پیام یا اعلانی وجود ندارد 🔔', style: TextStyle(color: Colors.white38, fontSize: 12, fontFamily: 'Vazirmatn')),
                        ),
                      )
                    else
                      Flexible(
                        child: ListView.builder(
                          shrinkWrap: true,
                          itemCount: list.length,
                          itemBuilder: (context, index) {
                            final notify = list[index];
                            final String title = notify['title'] ?? 'اعلان جدید';
                            final bool isReject = title.contains('رد شد') || title.contains('❌');
                            final bool isApprove = title.contains('تایید شد') || title.contains('✅');

                            return Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: isReject
                                    ? const Color(0xFFEF4444).withValues(alpha: 0.1)
                                    : (isApprove ? const Color(0xFF10B981).withValues(alpha: 0.1) : const Color(0xFF160E2A)),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: isReject
                                      ? const Color(0xFFEF4444).withValues(alpha: 0.3)
                                      : (isApprove ? const Color(0xFF10B981).withValues(alpha: 0.3) : Colors.white.withValues(alpha: 0.05)),
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        notify['time'] ?? 'الان',
                                        style: const TextStyle(color: Colors.white38, fontSize: 9, fontFamily: 'Vazirmatn'),
                                      ),
                                      Row(
                                        children: [
                                          Text(
                                            title,
                                            style: TextStyle(
                                              color: isReject ? const Color(0xFFF87171) : (isApprove ? const Color(0xFF34D399) : Colors.white),
                                              fontSize: 12,
                                              fontWeight: FontWeight.bold,
                                              fontFamily: 'Vazirmatn',
                                            ),
                                          ),
                                          const SizedBox(width: 6),
                                          Icon(
                                            isReject ? Icons.cancel_rounded : (isApprove ? Icons.check_circle_rounded : Icons.notifications_rounded),
                                            size: 15,
                                            color: isReject ? const Color(0xFFF87171) : (isApprove ? const Color(0xFF34D399) : const Color(0xFFD946EF)),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    notify['body'] ?? '',
                                    textAlign: TextAlign.right,
                                    style: TextStyle(
                                      color: isReject ? const Color(0xFFFCA5A5) : Colors.white70,
                                      fontSize: 11,
                                      height: 1.5,
                                      fontFamily: 'Vazirmatn',
                                    ),
                                  ),
                                  if (title.contains('تکمیل پروفایل') || (notify['body'] ?? '').toString().contains('تکمیل')) ...[
                                    const SizedBox(height: 10),
                                    SizedBox(
                                      width: double.infinity,
                                      child: ElevatedButton(
                                        onPressed: () {
                                          Navigator.pop(context);
                                          CompleteProfileDialog.show(context, repository.currentUser);
                                        },
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: const Color(0xFF8B5CF6),
                                          foregroundColor: Colors.white,
                                          padding: const EdgeInsets.symmetric(vertical: 8),
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                          elevation: 2,
                                        ),
                                        child: const Row(
                                          mainAxisAlignment: MainAxisAlignment.center,
                                          children: [
                                            Icon(Icons.stars_rounded, color: Color(0xFFFFD54F), size: 16),
                                            SizedBox(width: 6),
                                            Text(
                                              'تکمیل پروفایل (دریافت ۱۰۰ سکه)',
                                              style: TextStyle(
                                                fontFamily: 'Vazirmatn',
                                                fontWeight: FontWeight.bold,
                                                fontSize: 11.5,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            );
                          },
                        ),
                      ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}
