import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/app_state_repository.dart';
import '../models/user_model.dart';

class NopaNotificationDialog {
  static void show(BuildContext context) {
    final repository = Provider.of<AppRepository>(context, listen: false);
    repository.markAllNotificationsAsRead();
    
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
                        IconButton(
                          icon: const Icon(Icons.close, color: Colors.white70),
                          onPressed: () => Navigator.pop(context),
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
                            return Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: const Color(0xFF160E2A),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: Colors.white.withValues(alpha: 0.02)),
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
                                      Text(
                                        notify['title'] ?? 'اعلان جدید',
                                        style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    notify['body'] ?? '',
                                    textAlign: TextAlign.right,
                                    style: const TextStyle(color: Colors.white70, fontSize: 11, height: 1.5, fontFamily: 'Vazirmatn'),
                                  ),
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
